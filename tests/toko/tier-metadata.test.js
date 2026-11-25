// tests/toko/tier-metadata.test.js - FP-TOKO-009 tier-metadata 单元测试
// 覆盖验收项：B1（53 技能全覆盖）、B2（推导映射）、B3（Schema 双态）、
//             T2（冲突裁决）、T3（非法值回退）、T5（tokens_char 自动回填）、
//             R1/R3/R4（只读零改写）、§2.1（references 参考层）
// 运行：node --test tests/toko/tier-metadata.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

import {
  TIER_DERIVATION_MAP,
  REFERENCE_TIER,
  BODY_TIER,
  isValidTier,
  parseFrontMatter,
  resolveTier,
  buildTierManifest
} from '../../lib/streaming/tier-metadata.js';

/** 构造临时技能目录（front matter 追加键 / _meta.json / references 可选） */
function mkSkill(root, category, name, { fmExtra = '', meta = null, refs = {}, bodyExtra = '' } = {}) {
  const dir = path.join(root, category, name);
  fs.mkdirSync(dir, { recursive: true });
  const fm = `---\nname: ${name}\ndescription: ${name} desc${fmExtra}\n---\n\n# ${name}\n\nBody text.\n${bodyExtra}`;
  fs.writeFileSync(path.join(dir, 'SKILL.md'), fm, 'utf-8');
  if (meta) fs.writeFileSync(path.join(dir, '_meta.json'), JSON.stringify(meta), 'utf-8');
  for (const [rel, content] of Object.entries(refs)) {
    const refPath = path.join(dir, rel);
    fs.mkdirSync(path.dirname(refPath), { recursive: true });
    fs.writeFileSync(refPath, content, 'utf-8');
  }
  return dir;
}

function listFilesRecursive(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(root);
  return files.sort();
}

// ==================== B1: 53 技能 tier 全覆盖（真实技能树） ====================

test('B1/R2: 53 技能全部有确定 tier（显式或推导），分布可汇总', () => {
  const manifest = buildTierManifest();
  assert.equal(manifest.total, 53, `技能总数应为 53，实际 ${manifest.total}`);
  assert.equal(manifest.skills.length, 53);
  for (const skill of manifest.skills) {
    assert.ok(isValidTier(skill.tier), `${skill.name}: tier=${skill.tier} 非法`);
    assert.ok(['front-matter', '_meta.json', 'derived'].includes(skill.tier_source), `${skill.name}: tier_source 非法`);
    assert.ok(Number.isInteger(skill.tokens_char) && skill.tokens_char > 0, `${skill.name}: tokens_char 必须自动回填`);
    assert.equal(typeof skill.description, 'string');
  }
  const sum = Object.values(manifest.tier_distribution).reduce((s, v) => s + v, 0);
  assert.equal(sum, 53, 'tier 分布之和必须等于 53');
});

test('B2: 缺省推导映射表覆盖全部目录类别（core/expert/pr/openspec→1，entropy→2）', () => {
  assert.deepEqual(TIER_DERIVATION_MAP, { core: 1, expert: 1, pr: 1, openspec: 1, entropy: 2 });
  const manifest = buildTierManifest();
  const byName = Object.fromEntries(manifest.skills.map(s => [s.name, s]));
  // 每类别抽真实技能核对推导结果
  assert.equal(byName['pdd-main'].tier, BODY_TIER);
  assert.equal(byName['pdd-main'].category, 'core');
  assert.equal(byName['expert-arch-enforcer'].tier, 2);
  assert.equal(byName['expert-arch-enforcer'].category, 'entropy');
  assert.equal(byName['openspec-ff-change'].tier, BODY_TIER);
  assert.equal(byName['pdd-pr-create'].tier, BODY_TIER);
});

test('T5: tokens_char = SKILL.md 全文字符数（自动回填，无手工维护）', () => {
  const manifest = buildTierManifest();
  const pddMain = manifest.skills.find(s => s.name === 'pdd-main');
  const actual = fs.readFileSync(
    path.join(manifest.skills_root, 'core', 'pdd-main', 'SKILL.md'), 'utf-8'
  ).length;
  assert.equal(pddMain.tokens_char, actual);
});

test('R1/R3/R4: 只读扫描不改写任何文件（清单前后文件集合一致）', () => {
  const tmp = fs.mkdtempSync('/tmp/toko-tier-readonly-');
  try {
    mkSkill(tmp, 'core', 'sample-skill');
    mkSkill(tmp, 'entropy', 'sample-entropy', { meta: { version: '1.0.0' } });
    const before = listFilesRecursive(tmp);
    const manifest = buildTierManifest({ skillsRoot: tmp });
    const after = listFilesRecursive(tmp);
    assert.deepEqual(after, before, 'buildTierManifest 不得创建/改写任何文件');
    assert.equal(manifest.skills.length, 2);
    // R3：description 透传，不因本 FP 变化
    assert.equal(manifest.skills[0].description, 'sample-skill desc');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ==================== B3: Schema 双态（含/不含新字段均可通过） ====================

test('B3: 双态校验——无标注推导生效，显式标注直接生效', () => {
  const tmp = fs.mkdtempSync('/tmp/toko-tier-dual-');
  try {
    // 态一：无 tier 字段（3.4.x 既有形态）→ 目录类别推导
    mkSkill(tmp, 'core', 'plain-skill');
    // 态二：front matter 显式 tier
    mkSkill(tmp, 'core', 'explicit-fm', { fmExtra: '\ntier: 0' });
    // 态三：_meta.json 显式 tier
    mkSkill(tmp, 'pr', 'explicit-meta', { meta: { tier: 2 } });

    const manifest = buildTierManifest({ skillsRoot: tmp });
    const byName = Object.fromEntries(manifest.skills.map(s => [s.name, s]));
    assert.equal(byName['plain-skill'].tier, 1);
    assert.equal(byName['plain-skill'].tier_source, 'derived');
    assert.equal(byName['explicit-fm'].tier, 0);
    assert.equal(byName['explicit-fm'].tier_source, 'front-matter');
    assert.equal(byName['explicit-meta'].tier, 2);
    assert.equal(byName['explicit-meta'].tier_source, '_meta.json');
    assert.equal(manifest.warnings.length, 0, '双态合法场景不得产生 WARN');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ==================== T2: 冲突裁决（front matter 胜出 + WARN） ====================

test('T2/META_CONFLICT: front matter 与 _meta.json tier 不一致 → 前者胜出 + WARN', () => {
  const tmp = fs.mkdtempSync('/tmp/toko-tier-conflict-');
  try {
    const dir = mkSkill(tmp, 'core', 'conflicted', { fmExtra: '\ntier: 2', meta: { tier: 1 } });
    const result = resolveTier(dir, 'core');
    assert.equal(result.tier, 2, 'front matter 优先');
    assert.equal(result.tier_source, 'front-matter');
    const conflict = result.warnings.find(w => w.code === 'META_CONFLICT');
    assert.ok(conflict, '必须输出 META_CONFLICT WARN');
    assert.match(conflict.detail, /front matter/);
    // 两者一致时不告警
    const same = mkSkill(tmp, 'core', 'consistent', { fmExtra: '\ntier: 1', meta: { tier: 1 } });
    const r2 = resolveTier(same, 'core');
    assert.equal(r2.tier, 1);
    assert.equal(r2.warnings.find(w => w.code === 'META_CONFLICT'), undefined);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ==================== T3: 非法值回退 ====================

test('T3/TIER_INVALID: tier=5 回退推导值且不中断', () => {
  const tmp = fs.mkdtempSync('/tmp/toko-tier-invalid-');
  try {
    const dir = mkSkill(tmp, 'core', 'bad-tier', { fmExtra: '\ntier: 5' });
    const result = resolveTier(dir, 'core');
    assert.equal(result.tier, 1, '回退为类别推导值');
    assert.equal(result.tier_source, 'derived');
    const invalid = result.warnings.find(w => w.code === 'TIER_INVALID');
    assert.ok(invalid, '必须输出 TIER_INVALID WARN');

    // 非整数 / 非数字 / 越界同样拒绝
    for (const bad of ['abc', 1.5, 4, -1]) {
      const d = mkSkill(tmp, 'core', `bad-${String(bad).replace('.', '_')}`, { fmExtra: `\ntier: ${JSON.stringify(bad)}` });
      const r = resolveTier(d, 'core');
      assert.equal(r.tier_source, 'derived', `非法值 ${JSON.stringify(bad)} 必须回退`);
      assert.ok(r.warnings.some(w => w.code === 'TIER_INVALID'));
    }

    // front matter 非法但 _meta.json 合法 → 跳过非法来源，后者生效
    const mixed = mkSkill(tmp, 'entropy', 'mixed-invalid', { fmExtra: '\ntier: 9', meta: { tier: 3 } });
    const rMixed = resolveTier(mixed, 'entropy');
    assert.equal(rMixed.tier, 3);
    assert.equal(rMixed.tier_source, '_meta.json');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ==================== §2.1: references 参考层与未登记类别 ====================

test('§2.1: 技能 references/ 归入 tier 2 参考层并回填 tokens_char', () => {
  const tmp = fs.mkdtempSync('/tmp/toko-tier-refs-');
  try {
    mkSkill(tmp, 'expert', 'with-refs', {
      refs: { 'references/guide.md': '# 指南\n这是参考内容。\n' }
    });
    const manifest = buildTierManifest({ skillsRoot: tmp });
    const skill = manifest.skills[0];
    assert.equal(skill.tier, 1, 'expert 类别技能本体为正文层');
    assert.equal(skill.references.length, 1);
    assert.equal(skill.references[0].tier, REFERENCE_TIER);
    assert.equal(skill.references[0].tokens_char, fs.readFileSync(
      path.join(tmp, 'expert', 'with-refs', 'references', 'guide.md'), 'utf-8'
    ).length);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('未登记目录类别 → 保守缺省 tier 2 + WARN（R2 兜底）', () => {
  const tmp = fs.mkdtempSync('/tmp/toko-tier-unknown-');
  try {
    mkSkill(tmp, 'future-cat', 'new-skill');
    const manifest = buildTierManifest({ skillsRoot: tmp });
    assert.equal(manifest.skills[0].tier, 2);
    assert.ok(manifest.warnings.some(w => w.code === 'TIER_CATEGORY_UNKNOWN'), '必须 WARN 未登记类别');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ==================== parseFrontMatter 健壮性 ====================

test('parseFrontMatter: 无 front matter / 非法 YAML 返回 null（回退推导不中断）', () => {
  assert.equal(parseFrontMatter('# 无 front matter\n正文'), null);
  const broken = parseFrontMatter('---\ninvalid: [unclosed\n---\n正文');
  assert.equal(broken, null);
  assert.equal(parseFrontMatter(123), null);
  const ok = parseFrontMatter('---\nname: x\ntier: 1\n---\nbody');
  assert.equal(ok.tier, 1);
});
