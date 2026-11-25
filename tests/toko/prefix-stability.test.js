// tests/toko/prefix-stability.test.js - FP-TOKO-005 前缀稳定化单测
// 覆盖：B1 规范顺序成文（getAssemblyOrder）/ B2 审计脚本（脚本入口 main 导出）
//       T1 顺序违规检出 / T2 易变内容检出 / T3 前缀哈希稳定 / T4 只增不改 / T5 缓存命中观测
//       I1 auditOrder 嵌入 assemble 违规必退回 / I2 白名单联动
// 运行：node --test tests/toko/prefix-stability.test.js

import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PHASES } from '../../lib/token/budget-manager.js';
import { assemble, clearSession } from '../../lib/context-assembly/index.js';
import {
  CANONICAL_ORDER,
  VOLATILE_PATTERNS,
  getAssemblyOrder,
  scanVolatileContent,
  auditOrder,
  observeCacheUsage,
  getCacheStats,
  clearSession as clearCacheObs
} from '../../lib/context-assembly/prefix-stability.js';
import { main as auditMain } from '../../scripts/prefix-stability-audit.js';

// ==================== B1: 规范装配顺序 ====================

test('B1: getAssemblyOrder 对 5 个合法 phase 返回规范五区块序列', () => {
  for (const phase of Object.values(PHASES)) {
    const order = getAssemblyOrder(phase);
    assert.deepEqual(order.map(b => b.key), CANONICAL_ORDER.map(b => b.key));
    assert.deepEqual(order.map(b => b.position), [0, 1, 2, 3, 4], '§2.1 区块序位 0-4');
    for (const b of order) {
      assert.equal(typeof b.stability, 'string', '区块含稳定性要求（§2.1）');
    }
  }
});

test('B1: getAssemblyOrder 非法 phase 拒绝（PHASE_UNKNOWN）', () => {
  assert.throws(() => getAssemblyOrder('invalid-phase'), /PHASE_UNKNOWN/);
  assert.throws(() => getAssemblyOrder(undefined), /PHASE_UNKNOWN/);
});

// ==================== 形态 A：CAG 装配计划审计 ====================

test('形态 A: assemble 产出的真实计划审计通过，区块哈希为 sha256 十六进制', () => {
  const sid = 'fp005-a-pass';
  try {
    const { plan } = assemble({
      phase: 'impl', sessionId: sid, family: 'openai', triggeredSkills: ['pdd-main']
    });
    const audit = auditOrder(plan);
    assert.equal(audit.passed, true, `不应有违规: ${JSON.stringify(audit.violations)}`);
    assert.deepEqual(audit.violations, []);
    assert.deepEqual(audit.order, CANONICAL_ORDER.map(b => b.key));
    assert.match(audit.block_hashes.tier0, /^[0-9a-f]{64}$/, 'tier0 哈希为 sha256 hex');
    assert.match(audit.block_hashes.tier1, /^[0-9a-f]{64}$/, 'tier1 哈希为 sha256 hex');
  } finally {
    clearSession(sid);
  }
});

test('T2: 形态 A Tier 0 混入 uuid → VOLATILE_CONTENT（HIGH）', () => {
  const plan = {
    phase: 'impl', family: 'openai',
    tiers: {
      t0: { index: [{ name: 'x', text: 'pdd-main: 索引行 550e8400-e29b-41d4-a716-446655440000' }] },
      t1: { skills: [] }, t2: { references: [] }, t3: { artifacts: [] }
    }
  };
  const audit = auditOrder(plan);
  assert.equal(audit.passed, false);
  assert.equal(audit.violations.length, 1);
  assert.equal(audit.violations[0].code, 'VOLATILE_CONTENT');
  assert.equal(audit.violations[0].severity, 'HIGH');
  assert.equal(audit.violations[0].block, 'tier0_index');
});

test('T2: 形态 A Tier 1 正文混入 RFC3339 时间戳 → VOLATILE_CONTENT（HIGH）', () => {
  const plan = {
    phase: 'impl', family: 'openai',
    tiers: {
      t0: { index: [] },
      t1: { skills: [{ name: 'x', content: '生成于 2026-05-08T14:30:52.123Z 的报告' }] },
      t2: { references: [] }, t3: { artifacts: [] }
    }
  };
  const audit = auditOrder(plan);
  assert.equal(audit.passed, false);
  assert.equal(audit.violations[0].code, 'VOLATILE_CONTENT');
  assert.equal(audit.violations[0].block, 'tier1_skills');
  assert.equal(audit.violations[0].severity, 'HIGH');
});

// ==================== 形态 B：宿主自定义区块序列 ====================

test('形态 B: 规范序 blocks 审计通过（含别名与并列尾部区块）', () => {
  const audit = auditOrder({
    blocks: [
      { key: 'system-prompt', content: '系统提示' },
      { key: 'tier0', content: 'Tier 0 索引' },
      { key: 'tier1-skills', content: '技能正文' },
      { key: 'history', content: '对话历史' },
      { key: 'tier23-content', content: '按需内容' },
      { key: 'tier3', content: '尾部工件' }
    ]
  });
  assert.equal(audit.passed, true, `不应有违规: ${JSON.stringify(audit.violations)}`);
  assert.equal(audit.block_hashes.sequence.length, 6, '逐块哈希齐全');
});

test('T1: 形态 B Tier 3 置于对话历史之前 → ORDER_VIOLATION（CRITICAL）', () => {
  const audit = auditOrder({
    blocks: [
      { key: 'system', content: '系统提示' },
      { key: 'tier0', content: 'Tier 0 索引' },
      { key: 'tier1', content: '技能正文' },
      { key: 'tier3', content: '按需工件' },
      { key: 'history', content: '对话历史' }
    ]
  });
  assert.equal(audit.passed, false);
  const v = audit.violations[0];
  assert.equal(v.code, 'ORDER_VIOLATION', 'Tier 3 先于 history 必须被检出');
  assert.equal(v.severity, 'CRITICAL');
  assert.equal(v.block, 'tier3', 'R3 置尾违规标记尾部区块本身');
  assert.match(v.detail, /置尾/);
});

test('形态 B: 通用序位回退（history 先于 tier1）→ ORDER_VIOLATION（CRITICAL）', () => {
  const audit = auditOrder({
    blocks: [
      { key: 'system', content: '' },
      { key: 'history', content: '历史' },
      { key: 'tier1', content: '技能' }
    ]
  });
  assert.equal(audit.passed, false);
  assert.equal(audit.violations[0].code, 'ORDER_VIOLATION');
  assert.equal(audit.violations[0].severity, 'CRITICAL');
  assert.equal(audit.violations[0].block, 'tier1');
});

test('形态 B: 未知区块键 → ORDER_VIOLATION（CRITICAL）', () => {
  const audit = auditOrder({
    blocks: [
      { key: 'system', content: '' },
      { key: 'mystery-block', content: '' }
    ]
  });
  assert.equal(audit.passed, false);
  assert.equal(audit.violations[0].code, 'ORDER_VIOLATION');
  assert.equal(audit.violations[0].severity, 'CRITICAL');
  assert.equal(audit.violations[0].block, 'mystery-block');
});

test('T2: 形态 B Tier 1 块混入 generated_at 键 → VOLATILE_CONTENT（HIGH）', () => {
  const audit = auditOrder({
    blocks: [
      { key: 'system', content: '' },
      { key: 'tier1', content: 'generated_at: 2026-11-25T00:00:00Z' }
    ]
  });
  assert.equal(audit.passed, false);
  assert.equal(audit.violations[0].code, 'VOLATILE_CONTENT');
  assert.equal(audit.violations[0].block, 'tier1_skills');
});

test('形态 B: 既非 tiers 又非 blocks → AUDIT_PLAN_MALFORMED', () => {
  assert.throws(() => auditOrder({}), /AUDIT_PLAN_MALFORMED/);
  assert.throws(() => auditOrder(null), /AUDIT_PLAN_MALFORMED/);
  assert.throws(() => auditOrder({ foo: 1 }), /AUDIT_PLAN_MALFORMED/);
});

// ==================== R1 扫描口径（防误伤锚定：skills/ 全树实测结论） ====================

test('R1 口径: 四类易变内容命中；裸日期与 {timestamp} 占位符不误伤', () => {
  assert.deepEqual(
    scanVolatileContent('报告生成于 2026-05-08T14:30:52.123Z，id=550e8400-e29b-41d4-a716-446655440000，ts=1715184000000'),
    [{ pattern_id: 'rfc3339-timestamp', match: '2026-05-08T14:30' },
     { pattern_id: 'uuid', match: '550e8400-e29b-41d4-a716-446655440000' },
     { pattern_id: 'epoch-millis', match: '1715184000000' }]
  );
  assert.deepEqual(scanVolatileContent('request_id: abc-123'), [{ pattern_id: 'volatile-key', match: 'request_id:' }]);
  assert.deepEqual(scanVolatileContent('trace_id = xyz'), [{ pattern_id: 'volatile-key', match: 'trace_id =' }]);
  // 裸日期（无 T 时间分量）不算易变——避免误伤规格日期等静态正文
  assert.deepEqual(scanVolatileContent('日期 2026-11-24 发布'), []);
  // {timestamp} 占位符（无 [:=] 后缀）不匹配——skills 树 SKILL.md 正文实测安全口径
  assert.deepEqual(scanVolatileContent('step_1_click_{timestamp}.png 与 review-{timestamp}.md'), []);
  assert.deepEqual(scanVolatileContent(''), []);
  // 模式表完整性锚定
  assert.deepEqual(VOLATILE_PATTERNS.map(p => p.id),
    ['rfc3339-timestamp', 'uuid', 'epoch-millis', 'volatile-key']);
});

// ==================== T3: 前缀逐字节稳定 ====================

test('T3: 相同 phase 连续两次装配，Tier 0/1 区块哈希一致', () => {
  const sid = 'fp005-t3-stable';
  try {
    const first = assemble({
      phase: 'analysis', sessionId: sid, family: 'openai', triggeredSkills: ['pdd-main']
    });
    const second = assemble({
      phase: 'analysis', sessionId: sid, family: 'openai', triggeredSkills: ['pdd-main']
    });
    const h1 = auditOrder(first.plan).block_hashes;
    const h2 = auditOrder(second.plan).block_hashes;
    assert.equal(h1.tier0, h2.tier0, 'Tier 0 哈希逐字节稳定');
    assert.equal(h1.tier1, h2.tier1, 'Tier 1 哈希逐字节稳定');
    assert.notEqual(h1.tier0, h1.tier1, '不同区块哈希不碰撞（内容不同）');
  } finally {
    clearSession(sid);
  }
});

// ==================== T4: 只增不改 ====================

test('T4: 会话第二次触发技能仅追加 Tier 1，先前载荷字节不变', () => {
  const sid = 'fp005-t4-append';
  try {
    const first = assemble({
      phase: 'impl', sessionId: sid, family: 'openai', triggeredSkills: ['pdd-main']
    });
    const second = assemble({
      phase: 'impl', sessionId: sid, family: 'openai', triggeredSkills: ['pdd-main', 'software-engineer']
    });
    const t1First = first.plan.tiers.t1.skills;
    const t1Second = second.plan.tiers.t1.skills;
    assert.deepEqual(second.manifest.tiers.t1.skills, ['pdd-main', 'software-engineer']);
    assert.deepEqual(first.manifest.tiers.t1.skills, ['pdd-main']);
    assert.equal(t1Second.length, 2, '追加一个技能');
    assert.equal(t1Second[0].name, t1First[0].name);
    assert.equal(t1Second[0].content, t1First[0].content, '先前技能载荷逐字节不变（只增不改）');
    assert.ok(t1Second[1].content.length > 0, '新技能载荷追加');
    assert.equal(auditOrder(second.plan).passed, true, '追加后的计划仍通过审计');
  } finally {
    clearSession(sid);
  }
});

// ==================== T5: 缓存命中观测 ====================

test('T5: 缓存命中率随会话轮次提升且可观测', () => {
  const sid = 'fp005-t5-cache';
  try {
    assert.deepEqual(getCacheStats(sid), {
      session_id: sid, rounds: 0, hit_ratio_first: null, hit_ratio_latest: null, hit_ratio_best: null, improved: false
    }, '无记录时统计为空值');

    observeCacheUsage({ sessionId: sid, cacheReadTokens: 0, cacheWriteTokens: 100 });
    observeCacheUsage({ sessionId: sid, cacheReadTokens: 50, cacheWriteTokens: 50 });
    const third = observeCacheUsage({ sessionId: sid, cacheReadTokens: 90, cacheWriteTokens: 10 });
    assert.deepEqual(third, {
      cache_read: 90, cache_write: 10, hit_ratio: 0.9, at: third.at
    }, '逐轮观测记录可追溯（供应商用量报表回填口径）');

    const stats = getCacheStats(sid);
    assert.equal(stats.rounds, 3);
    assert.equal(stats.hit_ratio_first, 0);
    assert.equal(stats.hit_ratio_latest, 0.9);
    assert.equal(stats.hit_ratio_best, 0.9);
    assert.equal(stats.improved, true, '命中率随轮次提升（T5）');
  } finally {
    clearCacheObs(sid);
  }
});

test('T5: observeCacheUsage 非法记录拒绝（RECORD_MALFORMED）', () => {
  assert.throws(() => observeCacheUsage({ sessionId: '', cacheReadTokens: 0, cacheWriteTokens: 0 }), /RECORD_MALFORMED/);
  assert.throws(() => observeCacheUsage({ sessionId: 's', cacheReadTokens: -1, cacheWriteTokens: 0 }), /RECORD_MALFORMED/);
  assert.throws(() => observeCacheUsage({ sessionId: 's', cacheReadTokens: NaN, cacheWriteTokens: 0 }), /RECORD_MALFORMED/);
  assert.throws(() => observeCacheUsage({ sessionId: 's', cacheReadTokens: 'x', cacheWriteTokens: 0 }), /RECORD_MALFORMED/);
  assert.throws(() => observeCacheUsage(null), /RECORD_MALFORMED/);
});

test('T5: clearSession 清空观测内存态', () => {
  const sid = 'fp005-t5-clear';
  observeCacheUsage({ sessionId: sid, cacheReadTokens: 10, cacheWriteTokens: 10 });
  assert.equal(getCacheStats(sid).rounds, 1);
  clearCacheObs(sid);
  assert.equal(getCacheStats(sid).rounds, 0);
});

// ==================== I1: auditOrder 嵌入 assemble 主流程 ====================

test('I1: 正常装配通过嵌入审计返回；稳定区混入易变内容时 assemble 必退回', () => {
  // 对照：真实技能树装配通过嵌入门禁
  const sid = 'fp005-i1-pass';
  try {
    const { plan } = assemble({ phase: 'impl', sessionId: sid, family: 'openai', triggeredSkills: ['pdd-main'] });
    assert.equal(auditOrder(plan).passed, true);
  } finally {
    clearSession(sid);
  }

  // 违规退回：fixture 技能 description 含 uuid → Tier 0 索引行命中 R1 → assemble 抛 VOLATILE_CONTENT
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'toko-fp005-volatile-'));
  const sid2 = 'fp005-i1-violation';
  try {
    const skillDir = path.join(tmpRoot, 'expert', 'volatile-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'),
      '---\nname: volatile-skill\ndescription: 测试技能 uuid 550e8400-e29b-41d4-a716-446655440000\n---\n\n# 正文\n', 'utf-8');

    assert.throws(() => assemble({
      phase: 'impl', sessionId: sid2, family: 'openai',
      triggeredSkills: ['volatile-skill'], skillsRoot: tmpRoot
    }), /VOLATILE_CONTENT/, '§3.3 审计失败必退回（抛错阻断下发）');
  } finally {
    clearSession(sid2);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

// ==================== I2: 白名单联动 ====================

test('I2: 白名单拦截触发技能后装配（t1 空）同样通过审计', () => {
  const sid = 'fp005-i2-whitelist';
  try {
    const { plan, manifest } = assemble({
      phase: 'impl', sessionId: sid, family: 'openai',
      triggeredSkills: ['pdd-main'], whitelist: ['software-engineer']
    });
    assert.deepEqual(manifest.tiers.t1.skills, [], '白名单外技能不注入（FP-003 注入点）');
    const audit = auditOrder(plan);
    assert.equal(audit.passed, true, '白名单装配通过本审计（I2）');
    assert.match(audit.block_hashes.tier1, /^[0-9a-f]{64}$/);
  } finally {
    clearSession(sid);
  }
});

// ==================== B2: stability-audit 脚本 ====================

test('B2: 审计脚本对任意装配计划可运行（--plan 落盘报告 + 违规计划非零退出）', async () => {
  const sid = 'fp005-b2-script';
  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), 'toko-fp005-b2-'));
  try {
    const { plan } = assemble({ phase: 'impl', sessionId: sid, family: 'openai', triggeredSkills: ['pdd-main'] });
    const planFile = path.join(tmpOut, 'plan.json');
    fs.writeFileSync(planFile, JSON.stringify(plan), 'utf-8');
    const reportFile = path.join(tmpOut, 'audit-report.json');

    const report = await auditMain(['--plan', planFile, '--report', reportFile]);
    assert.equal(report.passed, true);
    assert.equal(report.tool, 'prefix-stability-audit');
    assert.ok(fs.existsSync(reportFile), '报告已落盘（docs/reviews/ 惯例同构）');
    const persisted = JSON.parse(fs.readFileSync(reportFile, 'utf-8'));
    assert.equal(persisted.verdict, 'pass');

    // 违规计划：脚本先输出报告再抛 AUDIT_FAILED（退出码非 0 由 main guard 转换）
    const badPlanFile = path.join(tmpOut, 'bad-plan.json');
    fs.writeFileSync(badPlanFile, JSON.stringify({
      blocks: [{ key: 'tier3', content: '工件' }, { key: 'system', content: '提示' }]
    }), 'utf-8');
    await assert.rejects(() => auditMain(['--plan', badPlanFile]), /AUDIT_FAILED/);
  } finally {
    clearSession(sid);
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }
});

test('B2: --live 模式实时装配并审计通过；缺参数报用法错误', async () => {
  const report = await auditMain(['--live', '--phase', 'verify', '--session', 'fp005-b2-live']);
  assert.equal(report.passed, true, 'live 装配（默认技能树）通过审计');
  assert.equal(report.plan_source.includes('fp005-b2-live'), true);
  assert.equal(report.canonical_order.length, 5);
  await assert.rejects(() => auditMain([]), /USAGE_MISSING/);
  await assert.rejects(() => auditMain(['--plan', '/nonexistent/plan.json']), /PLAN_NOT_FOUND/);
});
