// tests/toko/compaction-templates.test.js - FP-TOKO-012 compaction-templates 契约测试
//
// 验收覆盖：B1 模板库成文 / B2 建议不越权 / B3 保留要素受保护 / T1 触发条件精确（边界值）/
// T2 单次建议（拒绝后不再重复）/ T3 压实后审计（FP-005 联调）/ T4 效果指标（-30% 目标）/
// I1 预算联动（消费 FP-008 阶段预算）/ I2 M3 目标支撑。

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  COMPACTION_TRIGGER,
  COMPACTION_REDUCTION_TARGET,
  KEEP_ELEMENTS,
  DISCARD_ELEMENTS,
  PROTECTED_KEEP_ELEMENTS,
  TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  validateTemplate,
  getTemplate,
  shouldCompact,
  recordCompactionDecision,
  recordCompactionEffect,
  getCompactionState,
  resetCompactionState
} from '../../lib/context-assembly/compaction-templates.js';
import { validateEvent } from '../../lib/streaming/pse-events.js';
import { assemble } from '../../lib/context-assembly/index.js';
import { recordEstimate, getLadderState, resetBudgetCycle } from '../../lib/token/budget-closure.js';
import { clearSession } from '../../lib/token/estimation-track.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('FP-TOKO-012 compaction-templates', () => {
  beforeEach(() => {
    resetCompactionState();
    resetBudgetCycle();
  });

  // ==================== B1 模板库成文 ====================

  describe('B1 pdd-default 模板（§1.2 Schema）', () => {
    test('含 template_id/keep/discard/ratio_target 三要素，枚举与规格一致', () => {
      const t = TEMPLATES['pdd-default'];
      assert.equal(t.template_id, 'pdd-default');
      assert.deepEqual([...t.keep], ['decisions', 'contracts', 'acceptance_criteria', 'open_questions']);
      assert.deepEqual([...t.discard], ['intermediate_exploration', 'failed_attempts_fulltext', 'superseded_artifacts']);
      assert.equal(t.ratio_target, 0.5);
      assert.deepEqual([...KEEP_ELEMENTS], t.keep);
      assert.deepEqual([...DISCARD_ELEMENTS], t.discard);
    });

    test('getTemplate 精确命中原样返回（matched=true）', () => {
      const t = getTemplate('pdd-default');
      assert.equal(t.matched, true);
      assert.equal(t.fallback_used, undefined);
      assert.equal(t.notice, undefined);
    });

    test('getTemplate 未知 taskType → TEMPLATE_MISSING 回退 pdd-default（§1.3）', () => {
      const t = getTemplate('mystery-task');
      assert.equal(t.template_id, DEFAULT_TEMPLATE_ID); // 回退目标
      assert.equal(t.matched, false);
      assert.equal(t.fallback_used, true);
      assert.equal(t.notice, 'TEMPLATE_MISSING');
      assert.equal(t.requested_task_type, 'mystery-task');
      // 回退模板结构与 pdd-default 一致（keep/discard/ratio_target）
      assert.deepEqual(t.keep, [...TEMPLATES['pdd-default'].keep]);
      assert.deepEqual(t.discard, [...TEMPLATES['pdd-default'].discard]);
    });
  });

  // ==================== B3/R2 保留要素受保护 ====================

  describe('B3/R2 模板校验（保留要素不进 discard）', () => {
    test('pdd-default：keep ∩ discard = ∅ 且受保护要素不在 discard', () => {
      const check = validateTemplate(TEMPLATES['pdd-default']);
      assert.equal(check.valid, true, `校验失败: ${check.errors.join('; ')}`);
      for (const el of PROTECTED_KEEP_ELEMENTS) {
        assert.equal(TEMPLATES['pdd-default'].discard.includes(el), false, `受保护要素 ${el} 不得进入 discard`);
      }
    });

    test('R2 违例：受保护要素出现在 discard → TEMPLATE_INVALID', () => {
      const bad = { template_id: 'bad', keep: ['decisions'], discard: ['decisions'], ratio_target: 0.5 };
      const check = validateTemplate(bad);
      assert.equal(check.valid, false);
      assert.ok(check.errors.some(e => e.includes('R2')));
      assert.ok(check.errors.some(e => e.includes('受保护保留要素')));
    });

    test('R2 违例：要素同时出现在 keep 与 discard → TEMPLATE_INVALID', () => {
      const bad = { template_id: 'bad2', keep: ['open_questions'], discard: ['open_questions', 'intermediate_exploration'], ratio_target: 0.5 };
      const check = validateTemplate(bad);
      assert.equal(check.valid, false);
      assert.ok(check.errors.some(e => e.includes('同时出现在 keep 与 discard')));
    });

    test('结构违例：缺 keep / ratio_target 越界 → TEMPLATE_INVALID', () => {
      assert.equal(validateTemplate({ template_id: 'x', keep: [], discard: [], ratio_target: 0.5 }).valid, false);
      assert.equal(validateTemplate({ template_id: 'x', keep: ['decisions'], discard: [], ratio_target: 1.5 }).valid, false);
      assert.equal(validateTemplate(null).valid, false);
    });
  });

  // ==================== B2 建议不越权 ====================

  describe('B2 建议不越权（R1：平台只建议不改写）', () => {
    test('模块零 fs 写操作、零历史改写 API（结构断言）', () => {
      const source = readFileSync(path.join(__dirname, '../../lib/context-assembly/compaction-templates.js'), 'utf-8');
      assert.doesNotMatch(source, /writeFileSync|appendFileSync|rmSync|unlinkSync/);
      // 导出面无任何"执行压实/改写历史"函数——执行权在宿主
      assert.equal(typeof shouldCompact, 'function'); // 仅建议
      assert.equal(typeof recordCompactionDecision, 'function'); // 仅记录宿主决策
      assert.equal(typeof recordCompactionEffect, 'function'); // 仅记录效果
    });

    test('建议产物为纯数据（§2.1 六字段），不含执行动作', () => {
      const result = shouldCompact({ sessionId: 'b2-pure', phase: 'impl', turnIndex: 4, historyRatio: 0.9 });
      assert.ok(result);
      assert.deepEqual(Object.keys(result.suggestion).sort(), [
        'discard', 'history_ratio', 'keep', 'session_id', 'template_id', 'turn_index'
      ]);
    });
  });

  // ==================== T1 触发条件精确（边界值） ====================

  describe('T1 触发边界（turn≥4 且 ratio 严格 >50%）', () => {
    test('边界矩阵：turn 3 不触发；ratio=0.5 不触发；turn≥4 且 ratio>0.5 触发', () => {
      assert.equal(shouldCompact({ sessionId: 't1-a', phase: 'impl', turnIndex: 3, historyRatio: 0.9 }), null);
      assert.equal(shouldCompact({ sessionId: 't1-b', phase: 'impl', turnIndex: 4, historyRatio: 0.5 }), null);
      assert.equal(shouldCompact({ sessionId: 't1-c', phase: 'impl', turnIndex: 4, historyRatio: 0.4999 }), null);
      const hit = shouldCompact({ sessionId: 't1-d', phase: 'impl', turnIndex: 4, historyRatio: 0.5001 });
      assert.ok(hit, 'turn=4 且 ratio=0.5001 应触发');
      assert.ok(shouldCompact({ sessionId: 't1-e', phase: 'impl', turnIndex: 5, historyRatio: 0.6 }));
      assert.ok(shouldCompact({ sessionId: 't1-f', phase: 'impl', turnIndex: 10, historyRatio: 0.999 }));
      assert.match(COMPACTION_TRIGGER.min_turn + '', /^4$/);
      assert.equal(COMPACTION_TRIGGER.min_history_ratio, 0.5);
    });

    test('建议 §2.1 字段与事件一致性（I2：经 FP-006 通道）', () => {
      const result = shouldCompact({ sessionId: 't1-schema', phase: 'impl', turnIndex: 4, historyRatio: 0.8 });
      assert.equal(result.suggestion.session_id, 't1-schema');
      assert.equal(result.suggestion.turn_index, 4);
      assert.equal(result.suggestion.history_ratio, 0.8);
      assert.equal(result.suggestion.template_id, 'pdd-default');
      assert.ok(Array.isArray(result.suggestion.keep) && result.suggestion.keep.length > 0);
      assert.ok(Array.isArray(result.suggestion.discard) && result.suggestion.discard.length > 0);
      // 事件为合法 PSE compaction.suggested，data 与建议字段一致
      const check = validateEvent(result.event);
      assert.equal(check.valid, true, `事件校验失败: ${check.errors.join('; ')}`);
      assert.equal(result.event.event, 'compaction.suggested');
      assert.deepEqual(result.event.data, result.suggestion);
    });
  });

  // ==================== T2 单次建议（R3） ====================

  describe('T2 单次建议（拒绝后不再重复）', () => {
    test('拒绝路径：decision(false) → rejected=true → 再次判定 null（COMPACT_REJECTED）', () => {
      shouldCompact({ sessionId: 't2-reject', phase: 'impl', turnIndex: 4, historyRatio: 0.9 });
      const state = recordCompactionDecision('t2-reject', false);
      assert.equal(state.status, 'monitoring');
      assert.equal(state.rejected, true);
      assert.equal(shouldCompact({ sessionId: 't2-reject', phase: 'impl', turnIndex: 5, historyRatio: 0.99 }), null);
    });

    test('接受路径：decision(true) → compacted → 不再建议（R3 每会话最多一次）', () => {
      shouldCompact({ sessionId: 't2-accept', phase: 'impl', turnIndex: 4, historyRatio: 0.9 });
      const state = recordCompactionDecision('t2-accept', true);
      assert.equal(state.status, 'compacted');
      assert.equal(shouldCompact({ sessionId: 't2-accept', phase: 'impl', turnIndex: 5, historyRatio: 0.99 }), null);
    });

    test('建议待决策期间（suggested）重复判定 → null（不重复输出）', () => {
      shouldCompact({ sessionId: 't2-pending', phase: 'impl', turnIndex: 4, historyRatio: 0.9 });
      assert.equal(shouldCompact({ sessionId: 't2-pending', phase: 'impl', turnIndex: 4, historyRatio: 0.95 }), null);
    });

    test('无待决策建议时记录 → COMPACT_NO_PENDING_SUGGESTION', () => {
      assert.throws(() => recordCompactionDecision('t2-none', false), /COMPACT_NO_PENDING_SUGGESTION/);
    });

    test('getCompactionState 可审计（含建议与效果快照）；reset 恢复 monitoring', () => {
      shouldCompact({ sessionId: 't2-audit', phase: 'impl', turnIndex: 4, historyRatio: 0.9 });
      const state = getCompactionState('t2-audit');
      assert.equal(state.status, 'suggested');
      assert.ok(state.suggestion);
      assert.equal(state.rejected, false);
      resetCompactionState('t2-audit');
      assert.equal(getCompactionState('t2-audit'), null);
      // 全量重置
      shouldCompact({ sessionId: 't2-audit-all', phase: 'impl', turnIndex: 4, historyRatio: 0.9 });
      resetCompactionState();
      assert.equal(getCompactionState('t2-audit-all'), null);
    });
  });

  // ==================== T3 压实后审计（R4） ====================

  describe('T3 压实后装配通过 FP-TOKO-005 审计', () => {
    test('宿主以压实后产物重跑 assemble：审计通过不抛错', () => {
      const sessionId = 't3-reaudit';
      // 压实前：装配含大体量 Tier 3 产物
      const before = assemble({
        phase: 'impl',
        sessionId,
        family: 'openai',
        triggeredSkills: ['pdd-implement-feature'],
        artifacts: [{ ref: 'report#full', content: Array.from({ length: 200 }, (_, i) => `决策记录${i}：采用方案A并记录接口契约条款${i}的验收口径。`).join('\n') }]
      });
      assert.ok(before.manifest.tiers.t3.tokens_estimate > 0);
      // 建议与宿主接受
      shouldCompact({ sessionId, phase: 'impl', turnIndex: 4, historyRatio: 0.9 });
      recordCompactionDecision(sessionId, true);
      // 宿主执行压实：以摘要产物替换（执行权在宿主，R1）后重跑装配
      const after = assemble({
        phase: 'impl',
        sessionId,
        family: 'openai',
        triggeredSkills: ['pdd-implement-feature'],
        artifacts: [{ ref: 'report#digest', content: 'compacted digest: 决策+契约+验收标准摘要' }]
      });
      assert.ok(after.manifest.tiers.t3.tokens_estimate < before.manifest.tiers.t3.tokens_estimate);
      // R4：assemble 主流程内嵌 FP-005 auditOrder，未抛 AUDIT_* 即为通过
    });
  });

  // ==================== T4/I2 效果指标 ====================

  describe('T4/I2 压实效果核算（-30% 目标 / M3 支撑）', () => {
    test('达标：-35% ≥ 目标 30% → target_met=true', () => {
      shouldCompact({ sessionId: 't4-hit', phase: 'impl', turnIndex: 4, historyRatio: 0.9 });
      const result = recordCompactionEffect('t4-hit', { before_tokens: 40000, after_tokens: 26000 });
      assert.equal(result.reduction_ratio, 0.35);
      assert.equal(result.target_met, true);
      assert.equal(result.target, COMPACTION_REDUCTION_TARGET);
      assert.equal(COMPACTION_REDUCTION_TARGET, 0.30);
      const state = getCompactionState('t4-hit');
      assert.equal(state.effect.reduction_ratio, 0.35);
    });

    test('未达标：-25% < 目标 → target_met=false（如实上报不修饰）', () => {
      shouldCompact({ sessionId: 't4-miss', phase: 'impl', turnIndex: 4, historyRatio: 0.9 });
      const result = recordCompactionEffect('t4-miss', { before_tokens: 40000, after_tokens: 30000 });
      assert.equal(result.reduction_ratio, 0.25);
      assert.equal(result.target_met, false);
    });

    test('无建议会话不可记效果 → COMPACT_NO_SUGGESTION；非法入参 → COMPACT_EFFECT_INVALID', () => {
      assert.throws(() => recordCompactionEffect('t4-none', { before_tokens: 100, after_tokens: 50 }), /COMPACT_NO_SUGGESTION/);
      shouldCompact({ sessionId: 't4-bad', phase: 'impl', turnIndex: 4, historyRatio: 0.9 });
      assert.throws(() => recordCompactionEffect('t4-bad', { before_tokens: 0, after_tokens: 50 }), /COMPACT_EFFECT_INVALID/);
      assert.throws(() => recordCompactionEffect('t4-bad', { before_tokens: 100, after_tokens: -1 }), /COMPACT_EFFECT_INVALID/);
    });
  });

  // ==================== I1 预算联动（FP-008 数据流） ====================

  describe('I1 ratio 消费 FP-TOKO-008 阶段预算', () => {
    test('真实数据流：recordEstimate(impl) 60% 占比 → shouldCompact 读 FP-008 ratio 触发', () => {
      const sessionId = 'i1-budget-flow';
      // impl 阶段预算 = 40% × 100000 = 40000；估算 24000 → ratio 0.6
      recordEstimate(sessionId, 'impl', 24000, { family: 'openai' });
      const ladder = getLadderState(sessionId, 'impl');
      assert.equal(ladder.phase_ratio, 0.6);
      const result = shouldCompact({ sessionId, phase: 'impl', turnIndex: 4 });
      assert.ok(result, 'FP-008 占比 0.6 > 0.5 应触发');
      assert.equal(result.suggestion.history_ratio, 0.6); // 与 FP-008 状态一致
      clearSession(sessionId);
    });

    test('无 FP-008 状态（ratio=0）→ 即使 turn≥4 也不触发', () => {
      assert.equal(shouldCompact({ sessionId: 'i1-no-state', phase: 'impl', turnIndex: 4 }), null);
    });

    test('FP-008 占比未过半（0.3）→ 不触发', () => {
      const sessionId = 'i1-low';
      recordEstimate(sessionId, 'impl', 12000, { family: 'openai' }); // 12000/40000 = 0.3
      assert.equal(getLadderState(sessionId, 'impl').phase_ratio, 0.3);
      assert.equal(shouldCompact({ sessionId, phase: 'impl', turnIndex: 5 }), null);
      clearSession(sessionId);
    });
  });

  // ==================== 输入校验 ====================

  describe('输入校验', () => {
    test('COMPACT_SESSION_REQUIRED / COMPACT_INVALID_PHASE / COMPACT_TURN_INVALID / COMPACT_RATIO_INVALID', () => {
      assert.throws(() => shouldCompact({ phase: 'impl', turnIndex: 4 }), /COMPACT_SESSION_REQUIRED/);
      assert.throws(() => shouldCompact({ sessionId: 'x', phase: 'nope', turnIndex: 4 }), /COMPACT_INVALID_PHASE/);
      assert.throws(() => shouldCompact({ sessionId: 'x', phase: 'impl', turnIndex: 3.5 }), /COMPACT_TURN_INVALID/);
      assert.throws(() => shouldCompact({ sessionId: 'x', phase: 'impl', turnIndex: 4, historyRatio: -1 }), /COMPACT_RATIO_INVALID/);
      assert.throws(() => shouldCompact({ sessionId: 'x', phase: 'impl', turnIndex: 4, historyRatio: '0.9' }), /COMPACT_RATIO_INVALID/);
    });
  });
});
