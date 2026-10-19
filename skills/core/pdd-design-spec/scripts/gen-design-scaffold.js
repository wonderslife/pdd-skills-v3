#!/usr/bin/env node
/**
 * DESIGN.md 骨架生成器
 *
 * 解决 LLM 生成设计规范时最容易出错的两个环节：
 *   1. 状态枚举漏项（凭印象写，总会漏 2-3 个）
 *   2. 状态色互相冲突（随手挑色，色相挤在一起）
 *
 * 本脚本做确定性抽取 + 算法配色，保证产出天生能通过 check-design.js。
 *
 * 用法:
 *   node gen-design-scaffold.js --prd ./my-feature.prdx --out ./ui/DESIGN.md
 *   node gen-design-scaffold.js --prd x.prd --spec ./specs/spec.md
 *   node gen-design-scaffold.js --prd x.prd --json          # 只输出清单
 *   node gen-design-scaffold.js --prd x.prd --dry-run       # 只打印统计
 *
 * 退出码: 0 成功 / 1 失败
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────
// 色族表：group = 语义组（组内靠明度差区分），hue = 色相
// 冲突判定：色相距离 <25° 且 明度差 <18 → 冲突（灰阶豁免）
// ─────────────────────────────────────────────
const FAMILIES = [
  { key: 'gray',       group: 'neutral', hex: '#86909C', hue: 218, sat: 0.08, light: 62, label: '灰' },
  { key: 'neutral',    group: 'neutral', hex: '#595959', hue: 0,   sat: 0.00, light: 37, label: '中性灰' },
  { key: 'silver',     group: 'neutral', hex: '#8C8C8C', hue: 0,   sat: 0.00, light: 58, label: '浅灰' },
  { key: 'orange',     group: 'warn',    hex: '#FF7D00', hue: 30,  sat: 1.00, light: 66, label: '橙' },
  { key: 'deepOrange', group: 'warn',    hex: '#AD4E00', hue: 27,  sat: 1.00, light: 44, label: '深橙' },
  { key: 'gold',       group: 'warn',    hex: '#D48806', hue: 41,  sat: 0.95, light: 52, label: '金' },
  { key: 'red',        group: 'danger',  hex: '#F53F3F', hue: 359, sat: 0.83, light: 55, label: '红' },
  { key: 'deepRed',    group: 'danger',  hex: '#A8071A', hue: 355, sat: 0.92, light: 34, label: '深红' },
  { key: 'green',      group: 'success', hex: '#00B42A', hue: 134, sat: 1.00, light: 62, label: '绿' },
  { key: 'deepGreen',  group: 'success', hex: '#237804', hue: 119, sat: 1.00, light: 40, label: '深绿' },
  { key: 'lime',       group: 'success', hex: '#52C41A', hue: 100, sat: 0.76, light: 66, label: '黄绿' },
  { key: 'deepBlue',   group: 'info',    hex: '#0F2A8C', hue: 228, sat: 0.90, light: 22, label: '深靛' },
  { key: 'purple',     group: 'accent',  hex: '#722ED1', hue: 265, sat: 0.80, light: 38, label: '紫' },
  { key: 'teal',       group: 'accent',  hex: '#08979C', hue: 182, sat: 0.90, light: 46, label: '青' },
  { key: 'magenta',    group: 'accent',  hex: '#C41D7F', hue: 328, sat: 0.74, light: 45, label: '洋红' },
];

const PRIMARY = { key: 'primary', hex: '#165DFF', hue: 217, sat: 1.0, light: 46 };

// 语义组容量不足时的降级顺序（保持语义邻近，不跳到无关色相）
const GROUP_CHAIN = {
  info:    ['info', 'accent', 'success'],
  success: ['success', 'accent', 'info'],
  warn:    ['warn', 'danger', 'accent'],
  danger:  ['danger', 'warn', 'accent'],
  accent:  ['accent', 'info', 'success'],
  neutral: ['neutral', 'accent'],
};

// 语义关键词 → [语义组, 首选变体]。顺序即优先级（越靠前越具体）
const SEMANTIC_MAP = [
  [['退回重写', '驳回重写', '重写', '返工', '重做', '重新生成'], 'danger', 'deepRed'],
  [['退回修改', '驳回修改', '驳回', '拒绝', '不通过'], 'danger', 'red'],
  [['部分成功', '部分完成', '部分失败', '半成功'], 'accent', 'teal'],
  [['发布失败', '执行失败', '异常', '错误', '超时', '失败'], 'warn', 'deepOrange'],
  [['定时', '预约', '计划', '待发'], 'accent', 'purple'],
  [['已发布', '已完成', '已生效', '已上线', '发布成功', '发布中'], 'success', 'deepGreen'],
  [['已通过', '已审核', '已确认', '已批准', '通过', '成功'], 'success', 'green'],
  [['审核中', '审批中', '处理中', '进行中', '运行中', '执行中'], 'info', 'deepBlue'],
  [['待审核', '待审批', '待处理', '待提交', '待支付'], 'warn', 'orange'],
  [['待确认', '撤回', '撤销', '已撤', '下架', '停用', '作废', '过期', '归档', '禁用'], 'neutral', 'neutral'],
  [['草稿', '暂存', '新建', '未提交'], 'neutral', 'gray'],
];

// 状态词表（按长度降序，避免「发布」命中「已发布」）
const STATUS_VOCAB = [
  '退回修改', '退回重写', '驳回修改', '驳回重写', '部分成功', '发布失败', '执行失败',
  '定时发布', '定时待发', '审核中', '审批中', '处理中', '进行中', '运行中', '执行中',
  '待审核', '待审批', '待处理', '待确认', '待提交', '待支付', '待发货', '待收货',
  '已通过', '已审核', '已确认', '已批准', '已完成', '已发布', '已上线', '已生效',
  '已驳回', '已拒绝', '已撤回', '已撤销', '已下架', '已停用', '已作废', '已过期',
  '已归档', '已成功', '已失败', '已锁定', '已冻结', '已结算', '已退款',
  '发布中', '上架中', '审核通过', '审核不通过', '草稿', '暂存', '未提交', '新建',
];

// 发布渠道（code → 名称）
const CHANNEL_VOCAB = [
  ['WEB', '网站'], ['APP', '客户端'], ['WECHAT_MP', '微信公众号'], ['WECHAT_VIDEO', '视频号'],
  ['WEIBO', '新浪微博'], ['DOUYIN', '抖音'], ['KUAISHOU', '快手'], ['BAIJIAHAO', '百家号'],
  ['TOUTIAO', '今日头条'], ['XIAOHONGSHU', '小红书'], ['BILIBILI', '哔哩哔哩'],
];

// 技术术语黑名单：这些全大写词不是渠道
const TECH_BLOCKLIST = new Set([
  'API', 'URL', 'URI', 'HTTP', 'HTTPS', 'JSON', 'SQL', 'XML', 'YAML', 'HTML', 'CSS', 'JWT',
  'REST', 'CRUD', 'EARS', 'SPEC', 'PRD', 'PDF', 'PPT', 'TODO', 'NOTE', 'WARN', 'INFO', 'ERROR',
  'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS',
  'UUID', 'ID', 'UID', 'DTO', 'VO', 'PO', 'DAO', 'ORM', 'RPC', 'GRPC', 'SDK', 'CLI', 'MCP',
  'INT', 'BIGINT', 'TINYINT', 'SMALLINT', 'VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT', 'DECIMAL',
  'TIMESTAMP', 'DATETIME', 'DATE', 'TIME', 'BOOLEAN', 'FLOAT', 'DOUBLE', 'BLOB',
  'YYYY', 'MM', 'DD', 'HH', 'SS', 'UTC', 'GMT', 'ISO',
  'UGC', 'PGC', 'PUGC', 'REQ', 'BPMN', 'XSS', 'CSRF', 'SQL', 'JDK', 'JVM', 'JRE',
  'HMAC', 'MD5', 'SHA', 'RSA', 'AES', 'TLS', 'SSL', 'CDN', 'DNS', 'CPU', 'RAM', 'SSD',
  'UI', 'UX', 'KPI', 'OKR', 'SLA', 'QPS', 'TPS', 'RPS', 'PV', 'UV', 'DAU', 'MAU',
  'NLP', 'OCR', 'ASR', 'TTS', 'LLM', 'AI', 'ML', 'CV', 'ETL', 'OLAP', 'OLTP',
]);

// ─────────────────────────────────────────────
// 参数解析
// ─────────────────────────────────────────────
const argv = process.argv.slice(2);
const opt = { prd: null, spec: null, out: null, preset: null, json: false, dryRun: false, title: null };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--json') opt.json = true;
  else if (a === '--dry-run') opt.dryRun = true;
  else if (a === '--prd') opt.prd = argv[++i];
  else if (a === '--spec') opt.spec = argv[++i];
  else if (a === '--out') opt.out = argv[++i];
  else if (a === '--preset') opt.preset = argv[++i];
  else if (a === '--title') opt.title = argv[++i];
  else if (a === '--help' || a === '-h') { usage(); process.exit(0); }
  else if (!opt.prd && !a.startsWith('--')) opt.prd = a;
}

if (!opt.prd) { usage(); process.exit(1); }
if (!fs.existsSync(opt.prd)) { console.error(`PRD 不存在: ${opt.prd}`); process.exit(1); }

function usage() {
  console.log(`
DESIGN.md 骨架生成器

  node gen-design-scaffold.js --prd <PRD> [选项]

选项:
  --prd <file>       PRD 文件（必填，支持 .prd/.prdx/.md）
  --spec <file>      开发规格 spec.md（可选）
  --out <file>       输出路径（默认 ui/DESIGN.md）
  --preset <name>    领域预设（当前支持 media）
  --title <name>     系统名称（默认从 PRD 首行推断）
  --json             只输出清单 JSON，不写文件
  --dry-run          只打印统计，不写文件
`);
}

// ─────────────────────────────────────────────
// 文本预处理
// ─────────────────────────────────────────────
const prdText = fs.readFileSync(opt.prd, 'utf8');
const specText = opt.spec && fs.existsSync(opt.spec) ? fs.readFileSync(opt.spec, 'utf8') : '';
const allText = prdText + '\n' + specText;
const lines = allText.split(/\r?\n/);

const stripMd = s => (s || '')
  .replace(/\*\*/g, '')
  .replace(/`/g, '')
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .trim();

// ─────────────────────────────────────────────
// 1. 状态枚举
// ─────────────────────────────────────────────
function extractStates() {
  const explicit = [];
  const seen = new Set();

  // 只在「状态机语境」的行里做显式抽取，避免把括号注释当成状态
  const STATE_CONTEXT = /状态流转|状态转换|状态机|生命周期|status\s*flow|状态[：:]/i;

  for (const raw of lines) {
    if (!STATE_CONTEXT.test(raw)) continue;
    const line = stripMd(raw);

    // a) 拉丁码 + 中文：draft(草稿) / pending_review（待审核）
    for (const m of line.matchAll(/[a-zA-Z_][\w-]*\s*[（(]\s*([\u4e00-\u9fa5]{2,6})\s*[)）]/g)) {
      add(m[1]);
    }
    // b) 箭头链：→ 后面紧跟的中文
    for (const m of line.matchAll(/[→➔>]{1,2}\s*([\u4e00-\u9fa5]{2,6})/g)) {
      add(m[1]);
    }
    // c) 「状态：A / B / C」枚举
    const sm = line.match(/状态[：:]\s*([^。；\n]+)/);
    if (sm) {
      for (const part of sm[1].split(/[\/、，,；;]|或/)) {
        const t = part.replace(/[（(].*?[)）]/g, '').trim();
        if (/^[\u4e00-\u9fa5]{2,6}$/.test(t)) add(t);
      }
    }
  }

  function add(t) {
    if (!t || seen.has(t)) return;
    // 必须像状态：含状态语素
    if (!/[中已待成败回改核布过稿审发撤废档期用结]/.test(t)) return;
    // 过滤明显不是状态的词
    if (/^(字段|类型|时间|人员|备注|说明|状态|流程|操作|变更|元数据|三方)/.test(t)) return;
    seen.add(t);
    explicit.push({ name: t, confidence: 'explicit' });
  }

  // 词表兜底
  const vocab = [];
  for (const term of [...STATUS_VOCAB].sort((a, b) => b.length - a.length)) {
    if (!allText.includes(term) || seen.has(term)) continue;
    // 若已有更长的状态词包含它，跳过（避免「发布」与「已发布」并存）
    if ([...seen].some(s => s.includes(term) && s !== term)) continue;
    seen.add(term);
    vocab.push({ name: term, confidence: 'vocabulary' });
  }

  return { explicit, vocab, all: [...explicit, ...vocab] };
}

// ─────────────────────────────────────────────
// 2. 页面清单（只认「页面名称 / 菜单名称」表头）
// ─────────────────────────────────────────────
const PAGE_HEADER = /^(页面名称|页面名|菜单名称|功能页面|页面清单|页面列表)$/;

function extractPages() {
  const pages = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*\|/.test(lines[i])) continue;
    const header = lines[i].split('|').map(s => stripMd(s)).filter(Boolean);
    const idxName = header.findIndex(h => PAGE_HEADER.test(h));
    if (idxName < 0) continue;

    const idxPath = header.findIndex(h => /路径|路由|path|url/i.test(h));
    const idxDesc = header.findIndex(h => /说明|描述|备注|功能/i.test(h));

    for (let j = i + 2; j < lines.length; j++) {
      if (!/^\s*\|/.test(lines[j])) break;
      const cells = lines[j].split('|').map(s => stripMd(s));
      const name = cells[idxName + 1];
      if (!name || /^[-: ]*$/.test(name)) continue;
      pages.push({
        name,
        path: idxPath >= 0 ? (cells[idxPath + 1] || '') : '',
        desc: idxDesc >= 0 ? (cells[idxDesc + 1] || '') : '',
      });
    }
    break;
  }
  return pages;
}

// ─────────────────────────────────────────────
// 3. 渠道（已知词表 + 上下文门控的未知码）
// ─────────────────────────────────────────────
function extractChannels() {
  const out = [];
  const known = new Map(CHANNEL_VOCAB);

  // a) 已知渠道：文档里出现中文名即认为存在
  for (const [code, name] of CHANNEL_VOCAB) {
    if (allText.includes(name)) out.push({ code, name, source: 'known' });
  }

  // b) 未知大写码：必须出现在渠道语境行内，且不在技术黑名单
  const CHANNEL_CONTEXT = /渠道|平台|分发|账号|发布到|同步到|推送至/;
  for (const raw of lines) {
    if (!CHANNEL_CONTEXT.test(raw)) continue;
    for (const m of raw.matchAll(/\b([A-Z][A-Z_]{2,15})\b/g)) {
      const code = m[1];
      if (known.has(code) || out.some(c => c.code === code)) continue;
      if (TECH_BLOCKLIST.has(code)) continue;
      if (!code.includes('_') && code.length < 4) continue;
      out.push({ code, name: '', source: 'inferred' });
    }
  }
  return out;
}

// ─────────────────────────────────────────────
// 4. 字段组件映射（表头必须同时有「字段」和「组件」）
// ─────────────────────────────────────────────
function extractFields() {
  const fields = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*\|/.test(lines[i])) continue;
    const header = lines[i].split('|').map(s => stripMd(s)).filter(Boolean);
    const idxField = header.findIndex(h => /字段|属性|名称/.test(h));
    const idxComp = header.findIndex(h => /组件/.test(h));
    if (idxField < 0 || idxComp < 0) continue;

    for (let j = i + 2; j < lines.length; j++) {
      if (!/^\s*\|/.test(lines[j])) break;
      const cells = lines[j].split('|').map(s => stripMd(s));
      const f = cells[idxField + 1], c = cells[idxComp + 1];
      if (!f || /^[-: ]*$/.test(f)) continue;
      fields.push({ field: f, component: c || '' });
    }
    break;
  }
  return fields;
}

// ─────────────────────────────────────────────
// 5. 配色：语义组 → 组内变体 → 冲突顺延
// ─────────────────────────────────────────────
function hueDistance(a, b) {
  const d = Math.abs(a.hue - b.hue);
  return d > 180 ? 360 - d : d;
}

function conflicts(a, b) {
  if (a.sat < 0.20 || b.sat < 0.20) return false;   // 灰阶豁免
  return hueDistance(a, b) < 25 && Math.abs(a.light - b.light) < 18;
}

function pickVariant(stateName, used) {
  const hit = SEMANTIC_MAP.find(([keys]) => keys.some(k => stateName.includes(k)));
  const wantGroup = hit?.[1] || null;
  const preferKey = hit?.[2] || null;

  const usable = fam => !used.includes(fam.hex)
    && !conflicts(PRIMARY, fam)
    && !used.some(h => {
      const u = FAMILIES.find(f => f.hex === h);
      return u ? conflicts(u, fam) : false;
    });

  // 1. 首选变体
  if (preferKey) {
    const p = FAMILIES.find(f => f.key === preferKey);
    if (p && usable(p)) return p;
  }

  // 2. 沿语义组降级链找同组/邻近组变体
  const chain = wantGroup ? (GROUP_CHAIN[wantGroup] || [wantGroup]) : [];
  for (const g of chain) {
    const pool = FAMILIES
      .filter(f => f.group === g && f.key !== preferKey)
      .sort((a, b) => {
        const ref = FAMILIES.find(x => x.key === preferKey)?.light ?? 50;
        return Math.abs(b.light - ref) - Math.abs(a.light - ref);
      });
    for (const f of pool) if (usable(f)) return f;
  }

  // 3. 无任何可用 → 兜底（必然冲突，交给 check-design.js 报错）
  return FAMILIES[0];
}

// ─────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────
const states = extractStates();
const pages = extractPages();
const channels = extractChannels();
const fields = extractFields();

const usedHexes = [];
const assignments = states.all.map(s => {
  const fam = pickVariant(s.name, usedHexes);
  usedHexes.push(fam.hex);
  return { ...s, family: fam.key, group: fam.group, label: fam.label, hex: fam.hex, hue: fam.hue, light: fam.light };
});

const title = opt.title
  || stripMd((prdText.match(/^#\s+(.+)$/m) || [])[1] || '')
       .replace(/Product Requirements Document/i, '').replace(/需求文档|产品需求/g, '').trim()
  || path.basename(opt.prd).replace(/\.(prd|prdx|md)$/i, '');

const inventory = {
  title,
  prd: opt.prd,
  spec: opt.spec || null,
  preset: opt.preset || null,
  states: assignments,
  pages,
  channels,
  fields,
  stats: {
    states: assignments.length,
    statesExplicit: states.explicit.length,
    statesVocabulary: states.vocab.length,
    pages: pages.length,
    channels: channels.length,
    fields: fields.length,
    families: new Set(assignments.map(a => a.group)).size,
  },
};

if (opt.json) { console.log(JSON.stringify(inventory, null, 2)); process.exit(0); }

if (opt.dryRun) {
  console.log('\n抽取统计');
  console.log('─'.repeat(52));
  console.log(`状态   ${inventory.stats.states} 个（显式 ${inventory.stats.statesExplicit} / 词表 ${inventory.stats.statesVocabulary}）`);
  console.log(`语义组 ${inventory.stats.families} 个`);
  console.log(`页面   ${inventory.stats.pages} 个`);
  console.log(`渠道   ${inventory.stats.channels} 个`);
  console.log(`字段   ${inventory.stats.fields} 个`);
  console.log('\n状态 → 色值');
  for (const a of assignments) {
    console.log(`  ${a.name.padEnd(8, '　')} ${a.hex}  ${a.label.padEnd(4, '　')} [${a.confidence}]`);
  }
  process.exit(0);
}

// ─────────────────────────────────────────────
// 生成 DESIGN.md
// ─────────────────────────────────────────────
const outPath = opt.out || 'ui/DESIGN.md';
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const slug = makeSlugger();
const stateColorLines = assignments
  .map(a => `  state-${slug(a.name)}: "${a.hex}"${' '.repeat(Math.max(1, 16 - slug(a.name).length))}# ${a.name} · ${a.label}`)
  .join('\n');

const stateRows = assignments
  .map(a => `| ${a.name} | \`{colors.state-${slug(a.name)}}\` ${a.hex} | ○ | 待确认 | 待确认 | 待确认 |`)
  .join('\n');

const groupNames = new Map();
for (const a of assignments) {
  if (!groupNames.has(a.group)) groupNames.set(a.group, []);
  groupNames.get(a.group).push(a);
}
const groupRows = [...groupNames.entries()]
  .map(([g, list]) => {
    const names = list.map(a => `${a.name}(${a.hex})`).join(' / ');
    const how = list.length > 1 ? '明度差 + 图标' : '色相';
    return `| ${list[0].label.split('').slice(0, 1).join('')}族 | ${names} | ${how} |`;
  })
  .join('\n');

const pageRows = pages.length
  ? pages.map(p => `| ${p.name} | ${p.path || '—'} | ${p.desc || '—'} |`).join('\n')
  : '| （PRD 未提供页面列表，需人工补充） | — | — |';

const channelRows = channels.length
  ? channels.map(c => `| \`${c.code}\` | ${c.name || '待确认'} | 待确认 | 待确认 |`).join('\n')
  : '| （未识别到发布渠道，非多渠道系统可删除本章） | — | — | — |';

const fieldRows = fields.length
  ? fields.map(f => `| ${f.field} | ${f.component} | — | — |`).join('\n')
  : '| （PRD 未提供字段组件映射，需人工补充） | — | — | — |';

const byGroup = g => assignments.find(a => a.group === g)?.hex || '#000000';
const firstState = assignments[0];
const dangerState = assignments.find(a => a.group === 'danger') || firstState;

const doc = `---
version: 0.1
name: ${title} Design System
description: <一句话说清性格。例：以信息密度为第一优先的编辑生产工具，浅灰画布 + 单一蓝色强调，业务状态色独立成体系>

colors:
  primary: "${PRIMARY.hex}"
  primary-hover: "#4080FF"
  primary-active: "#0E42D2"
  primary-light: "#E8F3FF"
  on-primary: "#FFFFFF"

  # 业务状态色（自动分配：${inventory.stats.families} 个语义组承载 ${inventory.stats.states} 个状态）
${stateColorLines}

  # 表面阶梯
  canvas: "#F7F8FA"
  surface-1: "#FFFFFF"
  surface-2: "#F2F3F5"
  surface-3: "#FFFFFF"
  surface-inverse: "#1D2129"

  # 描边
  hairline: "#E5E6EB"
  hairline-strong: "#C9CDD4"
  hairline-focus: "${PRIMARY.hex}"

  # 文字
  ink: "#1D2129"
  ink-body: "#4E5969"
  ink-subtle: "#86909C"
  ink-tertiary: "#C9CDD4"
  ink-inverse: "#FFFFFF"

typography:
  font-sans: "PingFang SC, Microsoft YaHei, Source Han Sans SC, -apple-system, sans-serif"
  font-mono: "JetBrains Mono, SFMono-Regular, Consolas, monospace"
  display-lg: { size: 24px, weight: 600, lineHeight: 1.4 }
  title-lg:   { size: 20px, weight: 600, lineHeight: 1.4 }
  title-md:   { size: 16px, weight: 600, lineHeight: 1.5 }
  body-md:    { size: 14px, weight: 400, lineHeight: 1.6 }
  body-sm:    { size: 13px, weight: 400, lineHeight: 1.5 }
  label:      { size: 14px, weight: 500, lineHeight: 1.4 }
  caption:    { size: 12px, weight: 400, lineHeight: 1.4 }
  table-head: { size: 14px, weight: 600, lineHeight: 1.4 }
  mono-tag:   { size: 12px, weight: 500, lineHeight: 1.2 }

spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  xxl: 24px
  xxxl: 32px

rounded:
  xs: 2px
  sm: 4px
  md: 6px
  lg: 8px
  full: 9999px

density:
  table-row-height: 40px
  table-header-height: 44px
  table-cell-padding: "8px 12px"
  table-min-rows-per-screen: 15
  table-column-min-width: 100px
  table-action-column-width: 140px
  toolbar-height: 48px
  form-label-width: 100px
  form-item-gap: 20px
  page-padding: 16px
  page-default-size: 20
  page-size-options: [10, 20, 50, 100]
  text-truncate-lines: 1

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: "5px 16px"
    typography: "{typography.body-md}"
  button-secondary:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink-body}"
    borderColor: "{colors.hairline-strong}"
    rounded: "{rounded.sm}"
  button-danger:
    backgroundColor: "{colors.state-${slug(dangerState.name)}}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
  button-text:
    textColor: "{colors.primary}"
    padding: "0 4px"
  status-dot:
    rounded: "{rounded.xs}"
    typography: "{typography.mono-tag}"
    size: 14px
  status-label:
    textColor: "{colors.ink-body}"
    typography: "{typography.caption}"
  data-table:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink-body}"
    headerBackground: "{colors.surface-2}"
    headerTypography: "{typography.table-head}"
    rowBorder: "{colors.hairline}"
  filter-bar:
    backgroundColor: "{colors.surface-1}"
    padding: "{spacing.md} {spacing.lg}"
    rounded: "{rounded.md}"
  detail-panel:
    backgroundColor: "{colors.surface-1}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  drawer:
    backgroundColor: "{colors.surface-3}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xxl}"
  timeline-item:
    textColor: "{colors.ink-body}"
    railColor: "{colors.hairline}"
    dotColor: "{colors.primary}"
  empty-state:
    textColor: "{colors.ink-subtle}"
    padding: "{spacing.xxxl}"
---

## 1. 视觉主题与气质

> TODO：200-400 字。回答三个问题：这是什么工具？给谁用？一整天用下来应该是什么感受？
> 例：这是编辑生产工具，不是营销官网。使用者一天处理 200 条记录，密度优先于呼吸感。

**关键特征**：
- 页面底 \`{colors.canvas}\` 与卡片 \`{colors.surface-1}\` 构成唯一层级差，L0/L1 禁止投影
- 品牌蓝只出现在主按钮、选中态、链接、聚焦环，绝不用于状态标记
- 所有状态标记 = 彩色圆点 + 中性文字，缺一不可

## 2. 颜色与角色

### 品牌色

| Token | 值 | 允许用在哪 | 禁止用在哪 |
|-------|----|-----------|-----------|
| \`{colors.primary}\` | ${PRIMARY.hex} | 主按钮、选中态、链接、聚焦环 | 状态标签、栏目标识、大面积背景 |

### 业务状态色（${inventory.stats.states} 态 / ${inventory.stats.families} 组）

| 状态 | Token | 图标 | 可编辑 | 可发布 | 谁可操作 |
|------|-------|------|--------|--------|---------|
${stateRows}

**语义组结构**：

| 组 | 状态（色值） | 区分手段 |
|----|-------------|---------|
${groupRows}

> 状态超过 9 个时**不要新增色相**——色相距离会挤到 15° 以内，反而更难分。
> 正确做法是收敛成语义组，用明度差 ≥18 + 图标承担细分。

> **状态色只用于圆点/图标，不用于文字**。高明度橙/绿做 12px 文字对比度必然不足。

### 表面与描边

- \`{colors.hairline}\` — 表格行、卡片边、区块分隔
- \`{colors.hairline-strong}\` — 输入框、可聚焦容器
- \`{colors.hairline-focus}\` — 聚焦环，恒等于 primary

### 语义禁区

- 品牌蓝禁止表示任何业务状态
- 状态色禁止用作 12px 文字色
- 禁止用同一色相承担两个不同语义

## 3. 字体规则

| Token | 字号 | 字重 | 用途 |
|-------|------|------|------|
| \`{typography.display-lg}\` | 24px | 600 | 页面主标题 |
| \`{typography.title-lg}\` | 20px | 600 | 区块标题、抽屉标题 |
| \`{typography.body-md}\` | 14px | 400 | 后台正文基准 |
| \`{typography.caption}\` | 12px | 400 | 时间戳、辅助 |
| \`{typography.table-head}\` | 14px | 600 | 表头 |
| \`{typography.mono-tag}\` | 12px | 500 | 渠道码、ID |

**原则**：
- 后台正文基准 14px（16px 会让 1080p 一屏少 3 行）
- 表头靠字重区分（400 vs 600），不靠字号
- 所有数字列启用 \`font-variant-numeric: tabular-nums\`

## 4. 组件规范

> 每个组件必须写全 8 态：rest / hover / active / focus / disabled / loading / error / 无权限。

### 按钮

| 类型 | 用途 | rest | hover | disabled | loading |
|------|------|------|-------|----------|---------|
| primary | 一屏最多 1 个 | primary 底 + 白字 | primary-hover 底 | 灰底灰字 | 转圈 + "提交中" |
| secondary | 常规操作 | 白底 + 灰描边 | primary-light 底 | 同左 | 同左 |
| danger | 删除/驳回/撤回 | 红色底 + 白字 | 加深 10% | 同左 | 同左 |
| text | 表格行内操作 | primary 字无底 | primary-light 底 | ink-tertiary 字 | 不可 loading |

**规则**：一页主操作 ≤1 个；表格操作列 ≤3 个按钮；危险操作必须二次确认。

### 状态标签（圆点 + 中性文字）

\`\`\`html
<span class="status"><i class="dot dot--${slug(firstState.name)}">○</i>${firstState.name}</span>
\`\`\`
\`\`\`css
.status { display:inline-flex; align-items:center; gap:4px;
          font-size:12px; color:var(--ink-body); }
.dot { width:14px; height:14px; border-radius:2px;
       display:inline-flex; align-items:center; justify-content:center;
       font-size:10px; color:#fff; }
\`\`\`

### 数据表格

- 行高 40px（compact 32px），表头 44px
- 操作列固定右侧 140px，≤3 个按钮
- 状态列独立成列，宽 60-90px，可筛选
- 文本一律单行 + tooltip
- 加载用行骨架，不用全屏转圈

### 表单

- 标签右对齐 100px，输入框高 32px
- 校验时机：失焦 + 提交，不做输入时实时校验
- 错误文案在输入框下方 12px

### 空态 / 加载 / 错误

| 场景 | 表现 | 文案 |
|------|------|------|
| 首次无数据 | 插画 + 引导按钮 | "还没有{对象}，去创建第一条" |
| 筛选无结果 | 仅文字 + 清除筛选 | "没有符合条件的{对象}" |
| 加载中 | 行骨架 | — |
| 加载失败 | 错误图标 + 原因 + 重试 | "加载失败，{原因}，请重试" |

### 权限不足态

> TODO：三选一并写死——隐藏 / 置灰 / 可见但点击提示。不允许各模块自选。

## 5. 布局原则

### 页面骨架

| 类型 | 结构 | 用于 |
|------|------|------|
| 列表页 | 筛选栏 48px + 工具栏 48px + 表格 + 分页 56px | 各类清单 |
| 表单页 | 页头 48px + 双列表单 + 底部固定操作条 | 新建/编辑 |
| 详情页 | 页头 + 左右分栏（7:3） | 详情查看 |
| 看板页 | 指标卡行 + 图表区 | 数据统计 |
| 配置页 | 左侧二级导航 200px + 右侧表单 | 系统配置 |

### 页面清单（来自 PRD）

| 页面名称 | 页面路径 | 说明 |
|---------|---------|------|
${pageRows}

### 间距

4px 基准。页面左右内边距 16px，区块间距 24px，表单项间距 20px。
**禁止** 5/10/15/18/25px——出现这些值说明在凭感觉调。

### 留白哲学

后台的留白是奢侈品。分隔用底色差和 1px 描边，不用空白。

## 6. 层级与深度

| 层级 | 表现 | 用在哪 |
|------|------|--------|
| L0 页面底 | \`{colors.canvas}\` | 全屏背景 |
| L1 卡片 | \`{colors.surface-1}\` + 1px \`{colors.hairline}\` | 表格、表单、详情块 |
| L2 浮层 | \`{colors.surface-3}\` + \`0 4px 12px rgba(0,0,0,.08)\` | 下拉、Popover |
| L3 抽屉 | \`{colors.surface-3}\` + \`0 8px 24px rgba(0,0,0,.12)\` + 遮罩 | 编辑抽屉、确认弹窗 |

**投影只在 L2/L3 使用，L0/L1 禁止。**

## 7. 数据密度

| 指标 | default | compact | 说明 |
|------|---------|---------|------|
| 表格行高 | 40px | 32px | |
| 一屏行数（1920×1080） | ≥15 | ≥20 | 不含表头与分页 |
| 一屏行数（1366×768） | ≥11 | ≥15 | **必须实测这个分辨率** |
| 分页默认条数 | 20 | 50 | |
| 操作列宽 | 140px | 120px | 固定右侧 |
| 最小列宽 | 100px | 80px | |
| 列数上限 | 10 | 10 | 超出时合并/移入详情/列自定义 |

## 8. Do's and Don'ts

### Do
- 状态标记必须 = 彩色圆点 + 中性文字 + 文案
- 状态色只用于 14px 圆点，文字恒为 \`{colors.ink-body}\`
- 所有数字列启用 \`tabular-nums\`
- 提交类按钮必须实现 loading + disabled
- 表格操作列固定右侧，≤3 个按钮

### Don't
- 禁止用 \`{colors.primary}\` 表示任何业务状态
- 禁止用状态色作 12px 文字色
- 禁止在 L0/L1 使用投影
- 禁止用 16px 作为后台正文基准
- 禁止同一页面出现两个 primary 按钮
- 禁止使用 5/10/15/18/25px 间距

## 9. 响应式与多端差异

| 名称 | 宽度 | 关键变化 |
|------|------|---------|
| Desktop | ≥1440px | 完整侧栏 220px |
| Laptop | 1024-1439px | 侧栏折叠为 64px |
| Tablet | 768-1023px | 侧栏抽屉化，表格横向滚动 |
| Mobile | <768px | 单列，表格转卡片列表 |

## 10. 内容模型与模板映射

| 内容类型 | 必填字段 | 专属字段 | 列表列 | 详情模板 |
|---------|---------|---------|--------|---------|
${fieldRows}

### 发布渠道

| 渠道码 | 名称 | 类型 | 特殊要求 |
|--------|------|------|---------|
${channelRows}

## 11. 组件库映射（RuoYi / Vue3 + Element Plus）

\`\`\`css
:root {
  --el-color-primary: ${PRIMARY.hex};
  --el-color-success: ${byGroup('success')};
  --el-color-warning: ${byGroup('warn')};
  --el-color-danger: ${byGroup('danger')};
  --el-color-error: ${byGroup('warn')};
  --el-color-info: ${byGroup('neutral')};
  --el-border-radius-base: 4px;
  --el-font-size-base: 14px;
  --el-text-color-primary: #1D2129;
  --el-text-color-regular: #4E5969;
  --el-text-color-secondary: #86909C;
  --el-border-color: #E5E6EB;
  --el-fill-color-blank: #FFFFFF;
  --el-bg-color-page: #F7F8FA;
}
\`\`\`

| 设计概念 | Element Plus 实现 | 注意 |
|---------|------------------|------|
| 状态标签 | 自定义 span + 圆点 | **禁用** \`el-tag\` 默认 type 色 |
| 数据表格 | \`el-table size="default"\` | 行高由 cell padding 控制 |
| 操作列 | \`el-table-column fixed="right"\` | 宽 140px |
| 表单 | \`el-form label-width="100px"\` | 校验 \`trigger: 'blur'\` |
| 抽屉 | \`el-drawer size="40%"\` | 最小 480px |
| 空态 | \`el-empty\` | 自定义 description，禁用默认图 |

## 12. Agent Prompt Guide

### 速查色板
- 主按钮：\`primary\` ${PRIMARY.hex}
- 页面底：\`canvas\` #F7F8FA
- 卡片：\`surface-1\` #FFFFFF
- 主文字：\`ink\` #1D2129
- 正文：\`ink-body\` #4E5969
- 分隔线：\`hairline\` #E5E6EB

### 现成 Prompt
1. *"生成一个列表页：页面底 \`{colors.canvas}\`，筛选栏 \`{colors.surface-1}\` + \`{rounded.md}\` + 16px 内边距；表格行高 40px、表头 44px、操作列固定右侧 140px。状态列用圆点 + 中性文字，不用 el-tag 默认色。"*
2. *"生成一个表单抽屉：宽 40%，标题 20px/600，标签右对齐 100px，间距 20px，主按钮右下，取消在左。校验统一失焦触发。"*

### 迭代审计清单
逐条对照 \`references/audit-checklist.md\` 的 12 项。

---

## 生成说明

本文件由 \`gen-design-scaffold.js\` 生成骨架，以下内容**必须人工补全**：

1. **第 1 章** 视觉主题（TODO 标记）
2. **第 2 章** 状态表的"可编辑 / 可发布 / 谁可操作"三列（当前为"待确认"）
3. **第 4 章** 权限不足态策略（三选一）
4. **第 10 章** 内容模型与渠道特殊要求
${states.vocab.length ? `5. **置信度 vocabulary 的 ${states.vocab.length} 个状态**：由词表兜底命中，可能不是真实状态，需逐条确认` : ''}

抽取来源：\`${opt.prd}\`${opt.spec ? ` + \`${opt.spec}\`` : ''}
生成时间：${new Date().toISOString().slice(0, 10)}
`;

fs.writeFileSync(outPath, doc, 'utf8');

console.log('\nDESIGN.md 骨架已生成');
console.log('─'.repeat(52));
console.log(`输出     ${outPath}`);
console.log(`状态     ${inventory.stats.states} 个（显式 ${inventory.stats.statesExplicit} / 词表 ${inventory.stats.statesVocabulary}）`);
console.log(`语义组   ${inventory.stats.families} 个`);
console.log(`页面     ${inventory.stats.pages} 个`);
console.log(`渠道     ${inventory.stats.channels} 个`);
console.log(`字段     ${inventory.stats.fields} 个`);

const lowConf = assignments.filter(a => a.confidence === 'vocabulary');
if (lowConf.length) {
  console.log(`\n需人工确认（词表命中，可能非真实状态）：`);
  lowConf.forEach(a => console.log(`  - ${a.name}`));
}
console.log(`\n下一步：node ${path.join(__dirname, 'check-design.js')} ${outPath}\n`);

// ─────────────────────────────────────────────
// 中文状态名 → 合法 token 后缀
// ─────────────────────────────────────────────
function makeSlugger() {
  const EN = {
    草稿: 'draft', 暂存: 'temp', 未提交: 'unsubmitted', 新建: 'created',
    待审核: 'pending', 待审批: 'pending-approval', 待处理: 'todo', 待确认: 'pending-confirm',
    待提交: 'to-submit', 待支付: 'unpaid', 待发货: 'to-ship', 待收货: 'to-receive',
    审核中: 'reviewing', 审批中: 'approving', 处理中: 'processing', 进行中: 'in-progress',
    运行中: 'running', 执行中: 'executing', 发布中: 'publishing', 上架中: 'listing',
    已通过: 'approved', 已审核: 'reviewed', 已确认: 'confirmed', 已批准: 'authorized',
    已完成: 'completed', 已发布: 'published', 已上线: 'online', 已生效: 'effective',
    已驳回: 'rejected', 已拒绝: 'refused', 已撤回: 'withdrawn', 已撤销: 'revoked',
    已下架: 'delisted', 已停用: 'disabled', 已作废: 'voided', 已过期: 'expired',
    已归档: 'archived', 已成功: 'succeeded', 已失败: 'failed', 已锁定: 'locked',
    已冻结: 'frozen', 已结算: 'settled', 已退款: 'refunded',
    退回修改: 'returned', 退回重写: 'rewrite', 驳回修改: 'rejected-edit', 驳回重写: 'rejected-rewrite',
    部分成功: 'partial', 发布失败: 'publish-failed', 执行失败: 'exec-failed',
    定时发布: 'scheduled', 定时待发: 'scheduled', 审核通过: 'audit-passed', 审核不通过: 'audit-failed',
  };
  const cache = new Map();
  return function slug(name) {
    if (cache.has(name)) return cache.get(name);
    let v = EN[name];
    if (!v) {
      // 兜底：字符码，保证唯一且是合法 token
      v = 's' + [...name].map(c => c.codePointAt(0).toString(36)).join('').slice(0, 10);
    }
    cache.set(name, v);
    return v;
  };
}
