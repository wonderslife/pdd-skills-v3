// tests/toko/estimation-track.test.js - FP-TOKO-002 budget-estimation-track 单元测试
// 覆盖验收项：B1（5 阶段分布）、T1（Schema）、T2（phase 枚举一致）、T3（实测覆盖）、
//             T4（无 profile 降级）、T5（估算经 profile 溯源）、I3（阈值沿用）、
//             R1（单主值）、R3（偏差复标建议）、R4（内存态）、§3.3（状态转换）
// 运行：node --test tests/toko/estimation-track.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PHASES } from '../../lib/token/budget-manager.js';
import {
  PHASE_ALLOCATION_RATIOS,
  WARNING_THRESHOLD,
  CRITICAL_THRESHOLD,
  DEVIATION_RECALIBRATION_THRESHOLD,
  estimateTokens,
  recordConsumption,
  backfillMeasured,
  getPhaseDistribution,
  getSessionRecords,
  getRecord,
  clearSession
} from '../../lib/token/estimation-track.js';
import { loadProfile, FALLBACK_PROFILE_ID } from '../../lib/streaming/profiles/index.js';
import { segmentContent, estimateTokensFromSegments } from '../../lib/streaming/segment.js';

const MIXED_TEXT = [
  '# 标题：功能说明',
  '',
  'This is an English intro line with a few words.',
  '',
  '```js',
  'const a = 1;',
  'const b = 2;',
  '```',
  ''
].join('\n');

/** 构造合法 consumption-record（§2.1 Schema） */
function mkRecord(sessionId, overrides = {}) {
  return {
    session_id: sessionId,
    phase: 'impl',
    tokens_est: 1000,
    source: 'estimated',
    content_type: 'mixed',
    family: 'qwen',
    ts: '2026-11-25T00:00:00Z',
    ...overrides
  };
}

// ==================== T5: 估算经 FP-TOKO-001 profile（数据溯源） ====================

test('T5: mixed 估算 = 分段套 profile 系数求和（溯源 FP-TOKO-001）', () => {
  const profile = loadProfile('qwen');
  const result = estimateTokens(MIXED_TEXT, 'mixed', 'qwen');
  const seg = segmentContent(MIXED_TEXT);
  assert.deepEqual(result.segments, seg, '分段口径必须与 FP-TOKO-001 标定脚本一致');
  assert.equal(result.tokens_est, estimateTokensFromSegments(seg, profile));
  assert.equal(result.fallback, false);
  assert.equal(result.profile_used, 'qwen');
  // FP-001 T3 基准样本：6/0.62 + 11/0.75 + 2/9.5 → 25
  assert.equal(result.tokens_est, 25);
});

test('T5: 单一内容类型 zh/en/code 分别套对应系数（禁字符直报）', () => {
  const profile = loadProfile('qwen');
  // zh：6 个 CJK 字符 → ceil(6/0.62) = 10
  const zh = estimateTokens('标题功能说明', 'zh', 'qwen');
  assert.equal(zh.segments.zh, 6);
  assert.equal(zh.tokens_est, Math.ceil(6 / profile.ratios.zh_chars_per_token));
  // en：6 词 → ceil(6/0.75) = 8
  const en = estimateTokens('This is a test with words', 'en', 'qwen');
  assert.equal(en.segments.en, 6);
  assert.equal(en.tokens_est, Math.ceil(6 / profile.ratios.en_words_per_token));
  // code：3 非空行 → ceil(3/9.5) = 1
  const code = estimateTokens('const a = 1;\nconst b = 2;\n\nconst c = 3;', 'code', 'qwen');
  assert.equal(code.segments.code, 3);
  assert.equal(code.tokens_est, Math.ceil(3 / profile.ratios.code_lines_per_token));
  // 同字符规模不同类型，估算不同（T4 解耦：禁止字符直报）
  assert.notEqual(zh.tokens_est, code.tokens_est);
});

test('T4: 未登记家族降级 openai(fallback)，降级估算套 openai 系数', () => {
  const result = estimateTokens('标题功能说明', 'zh', 'ernie');
  assert.equal(result.fallback, true);
  assert.equal(result.tokenizer_profile, FALLBACK_PROFILE_ID);
  assert.equal(result.notice, 'ESTIMATE_WITHOUT_PROFILE');
  assert.equal(result.profile_used, 'openai');
  const openai = loadProfile('openai');
  assert.equal(result.tokens_est, Math.ceil(6 / openai.ratios.zh_chars_per_token));

  // 降级标注写入记录后不丢失（T4：fallback 标注不丢失）
  const sid = 'fp002-t4-fallback';
  const stored = recordConsumption(mkRecord(sid, {
    family: 'ernie',
    tokens_est: result.tokens_est,
    tokenizer_profile: result.tokenizer_profile,
    notice: result.notice
  }));
  const loaded = getRecord(sid, stored.record_id);
  assert.equal(loaded.tokenizer_profile, FALLBACK_PROFILE_ID);
  assert.equal(loaded.notice, 'ESTIMATE_WITHOUT_PROFILE');
  clearSession(sid);
});

test('estimateTokens 入参校验（错误处理优先）', () => {
  assert.throws(() => estimateTokens(123, 'zh', 'qwen'), /ESTIMATE_INVALID_CONTENT/);
  assert.throws(() => estimateTokens('内容', 'markdown', 'qwen'), /ESTIMATE_INVALID_CONTENT_TYPE/);
  assert.throws(() => estimateTokens('内容', 'zh', ''), /ESTIMATE_INVALID_FAMILY/);
  assert.throws(() => estimateTokens('内容', 'zh', null), /ESTIMATE_INVALID_FAMILY/);
});

// ==================== T1: 记录 Schema ====================

test('T1: 合法记录写入，9 字段齐备 + record_id 分配', () => {
  const sid = 'fp002-t1-valid';
  const stored = recordConsumption(mkRecord(sid, { artifact_ref: 'FP-TOKO-003-manifest-1' }));
  assert.ok(stored.record_id, '必须分配 record_id');
  const loaded = getRecord(sid, stored.record_id);
  // §2.1 全字段
  for (const field of ['session_id', 'phase', 'tokens_est', 'tokens_measured', 'source', 'content_type', 'family', 'ts', 'artifact_ref']) {
    assert.ok(field in loaded, `缺少字段 ${field}`);
  }
  assert.equal(loaded.tokens_measured, undefined, 'estimated 记录不携带实测主值（R1）');
  assert.equal(loaded.source, 'estimated');
  clearSession(sid);
});

test('T1: RECORD_MALFORMED 非法记录拒绝写入并 WARN', () => {
  const sid = 'fp002-t1-malformed';
  const cases = [
    ['缺 session_id', { session_id: undefined }],
    ['非法 phase', { phase: 'coding' }],
    ['负 tokens_est', { tokens_est: -1 }],
    ['NaN tokens_est', { tokens_est: Number.NaN }],
    ['非法 source', { source: 'guess' }],
    ['非法 content_type', { content_type: 'markdown' }],
    ['缺 family', { family: '' }],
    ['非 RFC3339 ts', { ts: '2026/11/25 00:00:00' }],
    ['无时区 ts', { ts: '2026-11-25T00:00:00' }],
    ['R1: estimated 携带实测', { tokens_measured: 500 }],
    ['R1: measured 缺主值', { source: 'measured' }]
  ];
  for (const [name, overrides] of cases) {
    assert.throws(
      () => recordConsumption(mkRecord(sid, overrides)),
      (err) => err.code === 'RECORD_MALFORMED',
      `用例「${name}」应拒绝`
    );
  }
  // 拒绝的记录一律未入库
  assert.equal(getSessionRecords(sid).length, 0);
  clearSession(sid);
});

test('T2: phase 枚举与 budget-manager PHASES 值逐一相等', () => {
  const sid = 'fp002-t2-phases';
  // 5 个 PHASES 值全部可写入（枚举严格一致）
  for (const phase of Object.values(PHASES)) {
    const stored = recordConsumption(mkRecord(sid, { phase }));
    assert.equal(stored.phase, phase);
  }
  // 分配比例镜像的键 = PHASES 值
  assert.deepEqual(Object.keys(PHASE_ALLOCATION_RATIOS).sort(), Object.values(PHASES).sort());
  clearSession(sid);
});

// ==================== T3/R1: 实测覆盖语义 ====================

test('T3/R1: 实测覆盖估算（source: estimated → measured），不并存双主值', () => {
  const sid = 'fp002-t3-backfill';
  const stored = recordConsumption(mkRecord(sid, { tokens_est: 1000 }));
  const updated = backfillMeasured(sid, stored.record_id, 1200, '2026-11-25T01:00:00Z');
  // 主值切换：source=measured，tokens_measured 为唯一主值
  assert.equal(updated.source, 'measured');
  assert.equal(updated.tokens_measured, 1200);
  assert.equal(updated.measured_at, '2026-11-25T01:00:00Z');
  // tokens_est 保留用于偏差核算（R3），但不再作为主值
  assert.equal(updated.tokens_est, 1000);

  const dist = getPhaseDistribution(sid);
  assert.equal(dist.phases.impl.primary_tokens, 1200, '主值取实测');
  assert.equal(dist.phases.impl.tokens_est, 1000);
  assert.equal(dist.phases.impl.tokens_measured, 1200);
  assert.equal(dist.totals.primary_tokens, 1200);
  assert.equal(dist.totals.measured_records, 1);
  clearSession(sid);
});

test('T3: backfillMeasured 定位失败与入参校验', () => {
  const sid = 'fp002-t3-notfound';
  const stored = recordConsumption(mkRecord(sid));
  assert.throws(() => backfillMeasured(sid, 'no-such-id', 100), /RECORD_NOT_FOUND/);
  assert.throws(() => backfillMeasured(sid, stored.record_id, -5), /RECORD_MALFORMED/);
  assert.throws(() => backfillMeasured(sid, stored.record_id, Number.NaN), /RECORD_MALFORMED/);
  // 校验失败不影响原记录主值
  assert.equal(getRecord(sid, stored.record_id).source, 'estimated');
  clearSession(sid);
});

// ==================== B1: 5 阶段消耗分布 ====================

test('B1: 5 阶段消耗分布可输出（analysis/design/impl/review/verify）', () => {
  const sid = 'fp002-b1-distribution';
  recordConsumption(mkRecord(sid, { phase: 'analysis', tokens_est: 2000 }));
  recordConsumption(mkRecord(sid, { phase: 'design', tokens_est: 1000 }));
  const impl = recordConsumption(mkRecord(sid, { phase: 'impl', tokens_est: 1000 }));
  recordConsumption(mkRecord(sid, { phase: 'review', tokens_est: 800 }));
  recordConsumption(mkRecord(sid, { phase: 'verify', tokens_est: 300 }));
  backfillMeasured(sid, impl.record_id, 5000);

  const dist = getPhaseDistribution(sid);
  assert.deepEqual(Object.keys(dist.phases), Object.values(PHASES), '恰好 5 个阶段');
  assert.equal(dist.phases.analysis.primary_tokens, 2000);
  assert.equal(dist.phases.design.primary_tokens, 1000);
  assert.equal(dist.phases.impl.primary_tokens, 5000, 'impl 主值为实测');
  assert.equal(dist.phases.review.primary_tokens, 800);
  assert.equal(dist.phases.verify.primary_tokens, 300);
  assert.equal(dist.totals.primary_tokens, 9100);
  // 占比可计算（B1：五段消耗占比）
  const total = dist.totals.primary_tokens;
  const share = dist.phases.impl.primary_tokens / total;
  assert.ok(share > 0 && share <= 1);
  clearSession(sid);
});

test('B1: 阶段预算与状态口径（budget = 100000 × 分配比例，镜像 budget-manager）', () => {
  const sid = 'fp002-b1-budget';
  recordConsumption(mkRecord(sid, { phase: 'impl', tokens_est: 31000 }));
  const dist = getPhaseDistribution(sid);
  assert.equal(dist.phases.impl.budget, 40000, 'impl 预算 = 100000 × 40%');
  assert.equal(dist.phases.impl.usage_percent, 77.5);
  assert.equal(dist.phases.impl.status, 'warning', '≥75% 进入 warning（镜像 _getPhaseStatus）');
  // 空会话全 idle
  const empty = getPhaseDistribution('fp002-b1-empty');
  assert.equal(empty.phases.analysis.status, 'idle');
  assert.equal(empty.totals.records, 0);
  clearSession(sid);
});

// ==================== I3: 阈值沿用 DEFAULT_ALLOCATION ====================

test('I3: 分配比例 20/15/40/15/10 与预警/阻断阈值沿用既有口径', () => {
  assert.deepEqual(PHASE_ALLOCATION_RATIOS, {
    analysis: 0.20,
    design: 0.15,
    impl: 0.40,
    review: 0.15,
    verify: 0.10
  });
  assert.equal(WARNING_THRESHOLD, 0.8);
  assert.equal(CRITICAL_THRESHOLD, 0.95);
  const dist = getPhaseDistribution('fp002-i3-defaults');
  assert.deepEqual(dist.allocation_ratios, PHASE_ALLOCATION_RATIOS);
  assert.deepEqual(dist.thresholds, { warning: 0.8, critical: 0.95 });
  assert.equal(dist.phases.analysis.budget, 20000);
  assert.equal(dist.phases.design.budget, 15000);
  assert.equal(dist.phases.impl.budget, 40000);
  assert.equal(dist.phases.review.budget, 15000);
  assert.equal(dist.phases.verify.budget, 10000);
});

// ==================== R3: 偏差复标建议 ====================

test('R3: 估算/实测偏差 >10% 触发 profile 复标建议', () => {
  const sid = 'fp002-r3-deviation';
  const qwenRec = recordConsumption(mkRecord(sid, { family: 'qwen', tokens_est: 1000, phase: 'impl' }));
  const glmRec = recordConsumption(mkRecord(sid, { family: 'glm', tokens_est: 1000, phase: 'review' }));
  backfillMeasured(sid, qwenRec.record_id, 1300); // qwen 偏差 |1000-1300|/1300 ≈ 23.08%
  backfillMeasured(sid, glmRec.record_id, 1050);  // glm 偏差 50/1000 = 5%（阈值内）

  const dist = getPhaseDistribution(sid);
  assert.equal(dist.deviation.recalibration_suggested, true);
  assert.equal(dist.deviation.suggestions.length, 1, '仅超阈值家族建议复标');
  const suggestion = dist.deviation.suggestions[0];
  assert.equal(suggestion.family, 'qwen');
  assert.equal(suggestion.deviation_pct, 23.08, '偏差分母口径 = measured（与 FP-001 calibrate 一致）');
  assert.match(suggestion.action, /token-calibrate\.js --family qwen/);
  assert.ok(dist.deviation.deviation_pct !== null);
  clearSession(sid);
});

test('R3: 偏差 ≤10% 不建议复标', () => {
  const sid = 'fp002-r3-within';
  const rec = recordConsumption(mkRecord(sid, { tokens_est: 1050 }));
  backfillMeasured(sid, rec.record_id, 1000); // 偏差 5%
  const dist = getPhaseDistribution(sid);
  assert.equal(dist.deviation.recalibration_suggested, false);
  assert.equal(dist.deviation.deviation_pct, 5);
  assert.equal(DEVIATION_RECALIBRATION_THRESHOLD, 0.10);
  clearSession(sid);
});

// ==================== §3.3: 状态转换与标注 ====================

test('§3.3: 无 usage 回填保持 estimated 并在报告标注', () => {
  const sid = 'fp002-330-estimated-only';
  recordConsumption(mkRecord(sid, { tokens_est: 500 }));
  const dist = getPhaseDistribution(sid);
  assert.equal(dist.phases.impl.status, 'active');
  assert.ok(dist.estimated_only_note, '必须标注无实测回填');
  assert.match(dist.estimated_only_note, /source=estimated/);
  assert.equal(dist.deviation.covered_records, 0);
  assert.equal(dist.deviation.deviation_pct, null);
  assert.equal(dist.deviation.recalibration_suggested, false);
  // 空会话不标注
  assert.equal(getPhaseDistribution('fp002-330-empty').estimated_only_note, null);
  clearSession(sid);
});

// ==================== R4: 会话内存态 ====================

test('R4: 会话内存态不落盘——clearSession 销毁 + 读取返回拷贝', () => {
  const sid = 'fp002-r4-memory';
  const stored = recordConsumption(mkRecord(sid));
  // 拷贝语义：改写返回值不影响内部状态
  const records = getSessionRecords(sid);
  assert.equal(records.length, 1);
  records[0].tokens_est = 999999;
  assert.equal(getRecord(sid, stored.record_id).tokens_est, 1000);
  // 清空即销毁
  clearSession(sid);
  assert.equal(getSessionRecords(sid).length, 0);
  assert.equal(getPhaseDistribution(sid).totals.records, 0);
  assert.equal(getRecord(sid, stored.record_id), null);
  assert.throws(() => backfillMeasured(sid, stored.record_id, 1), /RECORD_NOT_FOUND/);
});
