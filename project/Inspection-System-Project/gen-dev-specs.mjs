#!/usr/bin/env node
/**
 * 从 my-feature.prd 自动生成 dev-specs/*.md（每个功能点一个文件）
 *
 * 用法:
 *   node gen-dev-specs.mjs                 # 用默认 my-feature.prd -> dev-specs/
 *   node gen-dev-specs.mjs --force         # 覆盖已存在的功能点文件
 *   node gen-dev-specs.mjs --prd x.prd --out dev-specs
 *   node gen-dev-specs.mjs --dry-run       # 只打印将要生成的文件，不落盘
 *
 * 解析目标：PRD 中的「#### 模块 N: 标题」块
 *   每个块内提取：**需求ID** / **功能描述** / **用户故事** / **验收标准** / **优先级**
 *
 * 输出格式与 gen-spec.mjs 的解析规则严格对齐：
 *   # 标题 / ID: / 优先级: / <单行描述> / ## 验收标准 / - 条目
 *   （描述必须是属性行后的第一个段落；验收标准必须是最后一个 ## 区块，
 *     否则 gen-spec.mjs 会把后续区块的列表项误当验收标准）
 */
import fs from 'fs';
import path from 'path';

// ---------- 参数解析 ----------
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const PROJECT_ROOT = process.cwd();
const PRD_PATH = path.resolve(PROJECT_ROOT, val('--prd', 'my-feature.prd'));
const OUT_DIR = path.resolve(PROJECT_ROOT, val('--out', 'dev-specs'));
const MATRIX_PATH = path.join(PROJECT_ROOT, 'specs', 'features', 'feature-matrix.md');
const FORCE = has('--force');
const DRY = has('--dry-run');

// ---------- 模块标题 -> ASCII slug（用于文件名，便于 gen-spec.mjs 提取 tags） ----------
const SLUG_MAP = {
  '机房管理': 'room',
  '区域管理': 'area',
  '点位管理': 'point',
  '点位 Excel 批量导入': 'point-import',
  '点位Excel批量导入': 'point-import',
  '二维码生成与导出': 'qrcode',
  '巡检项模板管理': 'item-template',
  'H5 扫码进入巡检': 'h5-scan',
  'H5 巡检执行与拍照上传': 'h5-inspect',
  'PC 巡检记录管理': 'record',
  'PC 逾期补录': 'makeup',
  '统计报表': 'report',
  '异常项处理与提醒': 'exception',
};

// 优先级 High/Medium/Low -> P0/P1/P2
const PRIORITY_MAP = { high: 'P0', medium: 'P1', low: 'P2' };

/** 文件名安全化（兜底 slug） */
function fallbackSlug(title, index) {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || `module-${index}`;
}

/**
 * 解析 PRD：切出所有「#### 模块 N: xxx」块，逐块提取字段
 * @returns {Array<Object>}
 */
function parsePrd(content) {
  const lines = content.split(/\r?\n/);
  const modules = [];
  let cur = null;
  let field = null; // 当前正在收集的字段: desc | story | criteria

  const isModuleHead = (l) => /^####\s*模块\s*(\d+)\s*[:：]\s*(.+?)\s*$/.test(l);

  for (const raw of lines) {
    const line = raw.trimEnd();
    const m = line.match(/^####\s*模块\s*(\d+)\s*[:：]\s*(.+?)\s*$/);

    if (m) {
      if (cur) modules.push(cur);
      cur = {
        seq: parseInt(m[1], 10),
        title: m[2].trim(),
        reqId: '',
        desc: [],
        story: [],
        criteria: [],
        priority: '',
      };
      field = null;
      continue;
    }
    // 遇到同级或更高级标题，结束当前模块
    if (cur && /^#{1,4}\s+/.test(line) && !isModuleHead(line)) {
      // 仅在离开「2. 功能需求」区时结束；模块内部不会出现 #### 级标题
      if (/^##\s+/.test(line) || /^###\s+/.test(line)) {
        modules.push(cur);
        cur = null;
        field = null;
        continue;
      }
    }
    if (!cur) continue;

    // 字段锚点
    const anchor = line.match(/^\*\*(需求ID|功能描述|用户故事|验收标准|优先级)\*\*\s*[:：]?\s*(.*)$/);
    if (anchor) {
      const key = anchor[1];
      const rest = anchor[2].trim();
      if (key === '需求ID') { cur.reqId = rest; field = null; }
      else if (key === '优先级') { cur.priority = rest; field = null; }
      else if (key === '功能描述') { field = 'desc'; if (rest) cur.desc.push(rest); }
      else if (key === '用户故事') { field = 'story'; if (rest) cur.story.push(rest); }
      else if (key === '验收标准') { field = 'criteria'; if (rest) cur.criteria.push(rest); }
      continue;
    }

    if (field === 'desc') {
      const t = line.trim();
      if (t) cur.desc.push(t);
      continue;
    }
    if (field === 'story') {
      const t = line.trim();
      const b = t.match(/^[-*+]\s+(.+)$/);
      if (b) cur.story.push(b[1].trim());
      else if (t && !/^\*\*/.test(t)) cur.story.push(t);
      continue;
    }
    if (field === 'criteria') {
      const t = line.trim();
      const b = t.match(/^[-*+]\s+(?:\[\s*\]\s*)?(.+)$/);
      if (b) cur.criteria.push(b[1].trim());
      continue;
    }
  }
  if (cur) modules.push(cur);
  return modules.filter((m) => m.title);
}

/** 组装单个 dev-spec 文件内容（格式对齐 gen-spec.mjs） */
function renderSpec(mod, featureId) {
  const out = [];
  out.push(`# ${mod.title}`);
  out.push(`ID: ${featureId}`);
  out.push(`优先级: ${PRIORITY_MAP[mod.priority.toLowerCase()] || 'P2'}`);
  out.push(`来源: ${mod.reqId || '（未标注）'}`);
  out.push('');
  // 描述必须单行：gen-spec.mjs 只取属性行后的第一个段落
  const desc = mod.desc.join('').replace(/\s+/g, ' ').trim();
  out.push(desc || '（待补充功能描述）');
  out.push('');
  if (mod.story.length) {
    // 用引用块承载用户故事：gen-spec.mjs 会安全忽略
    out.push('> **用户故事**');
    for (const s of mod.story) out.push(`> - ${s}`);
    out.push('');
  }
  // 验收标准放最后，避免后续 ## 区块的列表被误收
  out.push('## 验收标准');
  if (mod.criteria.length) {
    for (const c of mod.criteria) out.push(`- ${c}`);
  } else {
    out.push('- （待补充验收标准）');
  }
  out.push('');
  return out.join('\n');
}

function main() {
  if (!fs.existsSync(PRD_PATH)) {
    console.error(`✗ 未找到 PRD 文件: ${PRD_PATH}`);
    process.exit(1);
  }
  const content = fs.readFileSync(PRD_PATH, 'utf-8');
  const modules = parsePrd(content);

  if (modules.length === 0) {
    console.error('✗ PRD 中未解析到任何「#### 模块 N: 标题」块');
    console.error('  请确认 PRD 采用「#### 模块 N: xxx」作为功能模块标题');
    process.exit(1);
  }

  if (!DRY) fs.mkdirSync(OUT_DIR, { recursive: true });

  const created = [];
  const skipped = [];

  modules.forEach((mod, i) => {
    // REQ-001 -> F-001；无需求ID时按顺序编号
    const numMatch = (mod.reqId || '').match(/(\d+)/);
    const num = numMatch ? numMatch[1].padStart(3, '0') : String(i + 1).padStart(3, '0');
    const featureId = `F-${num}`;
    const slug = SLUG_MAP[mod.title] || fallbackSlug(mod.title, mod.seq || i + 1);
    const fileName = `${featureId}-${slug}.md`;
    const filePath = path.join(OUT_DIR, fileName);

    if (fs.existsSync(filePath) && !FORCE) {
      skipped.push({ featureId, fileName, reason: '已存在（--force 可覆盖）' });
      return;
    }
    if (!DRY) fs.writeFileSync(filePath, renderSpec(mod, featureId), 'utf-8');
    created.push({
      featureId,
      fileName,
      title: mod.title,
      priority: PRIORITY_MAP[mod.priority.toLowerCase()] || 'P2',
      criteria: mod.criteria.length,
    });
  });

  // ---------- 功能点矩阵（放到 specs/features，避免被 gen-spec.mjs 扫成功能点） ----------
  if (!DRY) {
    fs.mkdirSync(path.dirname(MATRIX_PATH), { recursive: true });
    const rows = created.map((c) => `| ${c.featureId} | ${c.title} | ${c.priority} | ${c.criteria} | ${c.fileName} |`);
    const byPriority = created.reduce((acc, c) => {
      acc[c.priority] = (acc[c.priority] || 0) + 1;
      return acc;
    }, {});
    const matrix = [
      `# 功能点矩阵 — ${path.basename(PROJECT_ROOT)}`,
      '',
      `来源 PRD: \`${path.relative(PROJECT_ROOT, PRD_PATH).replace(/\\/g, '/')}\``,
      `生成时间: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
      '',
      `## 汇总`,
      '',
      `| 指标 | 值 |`,
      `|------|-----|`,
      `| 功能点总数 | ${created.length} |`,
      `| P0（High） | ${byPriority.P0 || 0} |`,
      `| P1（Medium） | ${byPriority.P1 || 0} |`,
      `| P2（Low） | ${byPriority.P2 || 0} |`,
      `| 验收标准总数 | ${created.reduce((s, c) => s + c.criteria, 0)} |`,
      '',
      `## 功能点清单`,
      '',
      `| 功能点 | 名称 | 优先级 | 验收标准数 | dev-spec 文件 |`,
      `|--------|------|--------|-----------|---------------|`,
      ...rows,
      '',
    ].join('\n');
    fs.writeFileSync(MATRIX_PATH, matrix, 'utf-8');
  }

  console.log(`\n${DRY ? '🔎 [dry-run] ' : '✓ '}PRD 功能点解析完成：${PRD_PATH}`);
  console.log(`  输出目录: ${OUT_DIR}`);
  console.log(`  新建/覆盖: ${created.length} 个，跳过: ${skipped.length} 个\n`);
  for (const c of created) {
    console.log(`   + ${c.featureId} ${c.title}  [${c.priority}]  验收标准 ${c.criteria} 条  ->  ${c.fileName}`);
  }
  for (const s of skipped) {
    console.log(`   ⊘ ${s.featureId} ${s.fileName}  (${s.reason})`);
  }
  if (!DRY) {
    console.log(`\n  功能点矩阵: ${path.relative(PROJECT_ROOT, MATRIX_PATH)}`);
    console.log(`\n下一步: node gen-spec.mjs   （dev-specs/*.md -> specs/spec.md）`);
  }
}

main();
