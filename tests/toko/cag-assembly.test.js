// tests/toko/cag-assembly.test.js - FP-TOKO-003 cag-tier-assembly 单元测试
// 覆盖验收项：B1（默认只装 Tier 0）、B2（Tier 0 ≤7100）、B3（manifest Schema）、
//             T1（估算经 profile）、T2（R2 不可逆追加）、T3（Tier 3 可替换）、
//             I1（budget_state 数据源）、I2（Android 4 技能装配）、I3（白名单注入点）、
//             T5（MCP resource 新增，旧 client 无感）
// 运行：node --test tests/toko/cag-assembly.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PHASES } from '../../lib/token/budget-manager.js';
import { recordConsumption } from '../../lib/token/estimation-track.js';
import { FAMILIES } from '../../lib/streaming/profiles/index.js';
import {
  assemble,
  buildManifest,
  validateManifest,
  getLatestManifest,
  clearSession,
  TIER0_TOKEN_LIMIT,
  MANIFEST_VERSION
} from '../../lib/context-assembly/index.js';
import { PDD_RESOURCES } from '../../lib/mcp-server.js';

const RFC3339 = '2026-11-25T00:00:00Z';

// ==================== B1/R1: 默认只装 Tier 0 ====================

test('B1/R1: 未触发任何技能时仅 Tier 0 有内容', () => {
  const sid = 'fp003-b1-default';
  try {
    const { plan, manifest } = assemble({ phase: 'impl', sessionId: sid, family: 'qwen' });
    assert.equal(manifest.tiers.t0.skills, 53, 'Tier 0 索引覆盖全部 53 技能');
    assert.deepEqual(manifest.tiers.t1.skills, [], 'Tier 1 无显式触发依据不装配');
    assert.deepEqual(manifest.tiers.t2.references, [], 'Tier 2 无步骤声明不装配');
    assert.deepEqual(manifest.tiers.t3.artifacts, [], 'Tier 3 无产物不装配');
    assert.equal(plan.tiers.t0.index.length, 53);
    assert.equal(plan.tiers.t1.skills.length, 0);
    // Tier 0 索引行含 name + description（doc 03 Layer 0 口径）
    const line = plan.tiers.t0.index.find(i => i.name === 'pdd-main');
    assert.match(line.text, /^pdd-main: /);
    assert.ok(line.text.length > 10);
  } finally {
    clearSession(sid);
  }
});

// ==================== B2: Tier 0 规模阈值 ====================

test('B2: 8 家族口径 Tier 0 估算均 ≤7100（R6 阈值）', () => {
  let i = 0;
  try {
    for (const family of FAMILIES) {
      const { manifest } = assemble({ phase: 'design', sessionId: `fp003-b2-${family}`, family });
      assert.ok(
        manifest.tiers.t0.tokens_estimate <= TIER0_TOKEN_LIMIT,
        `${family}: t0=${manifest.tiers.t0.tokens_estimate} > ${TIER0_TOKEN_LIMIT}`
      );
      assert.ok(manifest.tiers.t0.tokens_estimate > 0);
    }
  } finally {
    for (const family of FAMILIES) clearSession(`fp003-b2-${family}`);
  }
});

// ==================== B3: manifest Schema ====================

test('B3: manifest 符合 §1.2 Schema 且通过 validateManifest', () => {
  const sid = 'fp003-b3-schema';
  try {
    const { manifest } = assemble({ phase: 'impl', sessionId: sid, family: 'qwen' });
    assert.equal(manifest.manifest_version, MANIFEST_VERSION);
    assert.equal(manifest.manifest_version, '1.0');
    assert.equal(manifest.phase, 'impl');
    assert.equal(typeof manifest.tiers.t0.skills, 'number', 't0.skills 为数量');
    assert.ok(Array.isArray(manifest.tiers.t1.skills), 't1.skills 为数组');
    assert.ok(Array.isArray(manifest.tiers.t2.references), 't2.references 为数组');
    assert.ok(Array.isArray(manifest.tiers.t3.artifacts), 't3.artifacts 为数组');
    assert.equal(manifest.tokenizer_profile, 'qwen', '取值域 = FP-TOKO-001 family 枚举');
    const sum = ['t0', 't1', 't2', 't3'].reduce((s, k) => s + manifest.tiers[k].tokens_estimate, 0);
    assert.equal(manifest.total_estimate, sum);
    for (const key of ['phase_share', 'consumed', 'remaining']) {
      assert.equal(typeof manifest.budget_state[key], 'number');
    }
    assert.equal(validateManifest(manifest).valid, true);
  } finally {
    clearSession(sid);
  }
});

// ==================== T2/R2: 不可逆追加（状态机） ====================

test('T2/R2: 技能一旦装配，会话内不回溯移除', () => {
  const sid = 'fp003-t2-irreversible';
  try {
    assemble({ phase: 'impl', sessionId: sid, family: 'qwen', triggeredSkills: ['expert-android'] });
    const { manifest: second } = assemble({ phase: 'impl', sessionId: sid, family: 'qwen' });
    assert.deepEqual(second.tiers.t1.skills, ['expert-android'], '无新触发依据时先前装配保留');
  } finally {
    clearSession(sid);
  }
});

test('T2/R2: Tier 2 引用装配后不可逆保留（skillsRoot 覆盖 + 临时 fixture）', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'toko-cag-refs-'));
  const sid = 'fp003-t2-refs';
  try {
    // fixture：core/fixture-skill + references/guide.md
    const skillDir = path.join(tmpRoot, 'core', 'fixture-skill');
    fs.mkdirSync(path.join(skillDir, 'references'), { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'),
      '---\nname: fixture-skill\ndescription: fixture skill for tier2 union test\n---\n\n# fixture\n\nbody\n', 'utf-8');
    fs.writeFileSync(path.join(skillDir, 'references', 'guide.md'), '# 指南\n参考内容。\n', 'utf-8');

    const ref = 'fixture-skill/references/guide.md';
    const first = assemble({
      phase: 'impl', sessionId: sid, family: 'qwen', skillsRoot: tmpRoot, tier2References: [ref]
    });
    assert.deepEqual(first.manifest.tiers.t2.references, [ref]);
    assert.ok(first.manifest.tiers.t2.tokens_estimate > 0, 'Tier 2 载荷参与估算（T1）');
    assert.ok(first.plan.tiers.t2.references[0].content.includes('参考内容'), '载荷含引用正文');

    // 无新声明 → 先前装配保留（R2 不可逆）
    const second = assemble({ phase: 'impl', sessionId: sid, family: 'qwen', skillsRoot: tmpRoot });
    assert.deepEqual(second.manifest.tiers.t2.references, [ref]);
  } finally {
    clearSession(sid);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

// ==================== T3: Tier 3 最新产物替换 ====================

test('T3: Tier 3 工件可被新产物替换', () => {
  const sid = 'fp003-t3-replace';
  try {
    const { manifest: first } = assemble({
      phase: 'impl', sessionId: sid, family: 'qwen',
      artifacts: [{ ref: 'contract-report#digest', content: '合同报告摘要：共 5 处权益变更。' }]
    });
    assert.deepEqual(first.tiers.t3.artifacts, ['contract-report#digest']);
    assert.ok(first.tiers.t3.tokens_estimate > 0, 'Tier 3 载荷参与估算（T1）');

    const { manifest: second } = assemble({
      phase: 'impl', sessionId: sid, family: 'qwen',
      artifacts: [{ ref: 'new-artifact#v2', content: '最新产物摘要。' }]
    });
    assert.deepEqual(second.tiers.t3.artifacts, ['new-artifact#v2'], '新产物替换旧产物');
  } finally {
    clearSession(sid);
  }
});

// ==================== 错误码 ====================

test('PHASE_UNKNOWN: 非法阶段拒绝并列出合法枚举', () => {
  assert.throws(
    () => assemble({ phase: 'coding', sessionId: 'fp003-e1', family: 'qwen' }),
    (err) => {
      assert.match(err.message, /PHASE_UNKNOWN/);
      for (const p of Object.values(PHASES)) assert.ok(err.message.includes(p), `合法枚举 ${p} 必须出现在错误信息中`);
      return true;
    }
  );
});

test('TIER_OVERFLOW: 单 Tier 估算超限拒绝并返回原因', () => {
  const sid = 'fp003-e2-overflow';
  try {
    assert.throws(
      () => assemble({ phase: 'impl', sessionId: 'fp003-e2-t0', family: 'qwen', tierLimits: { t0: 100 } }),
      /TIER_OVERFLOW.*t0/
    );
    assert.throws(
      () => assemble({ phase: 'impl', sessionId: sid, family: 'qwen', triggeredSkills: ['expert-android'], tierLimits: { t1: 50 } }),
      /TIER_OVERFLOW.*t1/
    );
    // 未装配状态（无产物）下 t3 空载荷不应超限
    const { manifest } = assemble({ phase: 'impl', sessionId: sid, family: 'qwen', tierLimits: { t3: 10 } });
    assert.equal(manifest.tiers.t3.tokens_estimate, 0);
  } finally {
    clearSession(sid);
  }
});

test('Tier 1/2 入参校验：SKILL_NOT_FOUND / REF 格式与存在性', () => {
  const sid = 'fp003-e3-refs';
  try {
    assert.throws(
      () => assemble({ phase: 'impl', sessionId: sid, family: 'qwen', triggeredSkills: ['no-such-skill'] }),
      /SKILL_NOT_FOUND/
    );
    assert.throws(
      () => assemble({ phase: 'impl', sessionId: sid, family: 'qwen', tier2References: ['no-such-skill/references/x.md'] }),
      /SKILL_NOT_FOUND/
    );
    assert.throws(
      () => assemble({ phase: 'impl', sessionId: sid, family: 'qwen', tier2References: ['expert-android/SKILL.md'] }),
      /REF_MALFORMED/,
      '非 references/ 路径拒绝'
    );
    assert.throws(
      () => assemble({ phase: 'impl', sessionId: sid, family: 'qwen', tier2References: ['expert-android/references/no-such-file.md'] }),
      /REF_NOT_FOUND/
    );
  } finally {
    clearSession(sid);
  }
});

// ==================== I3: 白名单注入点（FP-TOKO-011 挂接） ====================

test('I3: 白名单过滤触发技能（双维挂接点就绪）', () => {
  const sid = 'fp003-i3-whitelist';
  try {
    const { manifest } = assemble({
      phase: 'impl', sessionId: sid, family: 'qwen',
      triggeredSkills: ['expert-android', 'expert-jetpack'],
      whitelist: ['expert-android']
    });
    assert.deepEqual(manifest.tiers.t1.skills, ['expert-android'], '白名单外技能不注入');
    // 无白名单（null/缺省）→ 全部注入
    const { manifest: full } = assemble({
      phase: 'impl', sessionId: sid, family: 'qwen',
      triggeredSkills: ['expert-jetpack']
    });
    assert.ok(full.tiers.t1.skills.includes('expert-jetpack'));
  } finally {
    clearSession(sid);
  }
});

// ==================== I2: Android 4 技能装配 ====================

test('I2: Android 4 技能可正常装配（Kotlin 全链路）', () => {
  const sid = 'fp003-i2-android';
  try {
    const androidSkills = ['expert-android', 'expert-android-test', 'expert-jetpack', 'expert-kotlin'];
    const { manifest } = assemble({
      phase: 'impl', sessionId: sid, family: 'qwen', triggeredSkills: androidSkills
    });
    for (const name of androidSkills) {
      assert.ok(manifest.tiers.t1.skills.includes(name), `${name} 必须装配`);
    }
    assert.ok(manifest.tiers.t1.tokens_estimate > 0);
    // 装配计划载荷存在且为 SKILL.md 正文
    const plan = assemble({ phase: 'impl', sessionId: sid, family: 'qwen' }).plan;
    for (const name of androidSkills) {
      const payload = plan.tiers.t1.skills.find(s => s.name === name);
      assert.ok(payload && payload.content.length > 0, `${name} 正文载荷非空`);
      assert.ok(!payload.content.startsWith('---\n'), '正文已剥离 front matter');
    }
  } finally {
    clearSession(sid);
  }
});

// ==================== I1: budget_state 数据源 = FP-TOKO-002 ====================

test('I1: budget_state 来自 FP-TOKO-002 阶段分布（阶段预算/已耗/剩余）', () => {
  const sid = 'fp003-i1-budget';
  try {
    // 无记录时：全额预算
    const { manifest: empty } = assemble({ phase: 'impl', sessionId: sid, family: 'qwen' });
    assert.equal(empty.budget_state.phase_share, 40000, 'impl 分配 = 100000 × 40%');
    assert.equal(empty.budget_state.consumed, 0);
    assert.equal(empty.budget_state.remaining, 40000);

    // 记录消耗后（FP-002 recordConsumption）
    recordConsumption({
      session_id: sid, phase: 'impl', tokens_est: 4000, source: 'estimated',
      content_type: 'zh', family: 'qwen', ts: RFC3339
    });
    const { manifest } = assemble({ phase: 'impl', sessionId: sid, family: 'qwen' });
    assert.equal(manifest.budget_state.consumed, 4000);
    assert.equal(manifest.budget_state.remaining, 36000);
    // design 阶段视角
    const { manifest: design } = assemble({ phase: 'design', sessionId: sid, family: 'qwen' });
    assert.equal(design.budget_state.phase_share, 15000);
  } finally {
    clearSession(sid);
  }
});

// ==================== T1/降级: tokenizer_profile 与估算溯源 ====================

test('T1/降级: 未登记家族 manifest.tokenizer_profile = openai(fallback)', () => {
  const sid = 'fp003-t1-fallback';
  try {
    const { manifest } = assemble({ phase: 'review', sessionId: sid, family: 'ernie' });
    assert.equal(manifest.tokenizer_profile, 'openai(fallback)');
    assert.equal(validateManifest(manifest).valid, true);
  } finally {
    clearSession(sid);
  }
});

// ==================== buildManifest / validateManifest 纯函数 ====================

test('buildManifest: 纯函数按 plan 生成报价单，估算经 profile 系数', () => {
  const plan = {
    phase: 'impl',
    family: 'qwen',
    tokenizer_profile: 'qwen',
    tiers: {
      t0: { index: [] },
      t1: { skills: [{ name: 'tiny-skill', content: '标题功能说明' }] },
      t2: { references: [] },
      t3: { artifacts: [] }
    },
    budget_state: { phase_share: 40000, consumed: 0, remaining: 40000 }
  };
  const manifest = buildManifest(plan);
  // 6 个 CJK 字符 ÷ 0.62 → ceil = 10（与 FP-002 T5 同口径）
  assert.equal(manifest.tiers.t1.tokens_estimate, 10);
  assert.deepEqual(manifest.tiers.t1.skills, ['tiny-skill']);
  assert.equal(manifest.tiers.t0.skills, 0);
  assert.equal(manifest.total_estimate, 10);
});

test('MANIFEST_MALFORMED: Schema 被篡改时 validateManifest 拒绝', () => {
  const sid = 'fp003-b3-tamper';
  try {
    const { manifest } = assemble({ phase: 'impl', sessionId: sid, family: 'qwen' });

    // 篡改 total_estimate
    const tampered = { ...manifest, total_estimate: manifest.total_estimate + 1 };
    const check = validateManifest(tampered);
    assert.equal(check.valid, false);
    assert.ok(check.errors.some(e => e.includes('total_estimate')));

    // 篡改 tokenizer_profile（取值域外）
    const badProfile = { ...manifest, tokenizer_profile: 'gpt5' };
    assert.ok(validateManifest(badProfile).errors.some(e => e.includes('tokenizer_profile')));

    // 缺 budget_state 字段
    const badBudget = { ...manifest, budget_state: { phase_share: 1 } };
    assert.ok(validateManifest(badBudget).errors.length > 0);
  } finally {
    clearSession(sid);
  }
});

// ==================== T5: MCP resource 新增，旧 client 无感 ====================

test('T5: pdd://context/manifest 已注册，既有 4 资源零改动，数据源为最近装配', () => {
  // 旧 resource 全部保留
  for (const uri of ['pdd://specs', 'pdd://features', 'pdd://reviews', 'pdd://status']) {
    assert.ok(uri in PDD_RESOURCES, `既有资源 ${uri} 必须保留`);
  }
  assert.ok('pdd://context/manifest' in PDD_RESOURCES, '新增 resource 已注册');
  assert.equal(Object.keys(PDD_RESOURCES).length, 5);

  // 数据源 = 最近一次装配报价单（模块态可能已被前序测试装配过，故只校验指向最新）
  const sid = 'fp003-t5-latest';
  try {
    const { manifest } = assemble({ phase: 'impl', sessionId: sid, family: 'qwen' });
    assert.equal(getLatestManifest(), manifest, 'resource 暴露最近一次报价单');
  } finally {
    clearSession(sid);
  }
});
