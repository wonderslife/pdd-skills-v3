// tests/toko/budget-closure.test.js - FP-TOKO-008 budget-streaming-closure 测试
//
// 验收覆盖：B1 三级事件齐备 / B2 不擅自中断 / B3 usage 实测回填覆盖估算 /
// T1 阈值跨越沿准确 / T2 梯级单调（LADDER_REGRESSION）/ T3 usage 缺失兜底 /
// T4 tighten 联动 Digest / T5 budget-manager 零改动（git diff 审计 + PHASES 锚定）/
// I1 PSE Schema / I2 FP-012 消费挂接 / I3 记账误差 ≤5%。

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  BUDGET_LADDER_THRESHOLDS,
  LADDER_LEVELS,
  TIGHTEN_MAX_ITEMS,
  onUsageEvent,
  recordEstimate,
  getLadderState,
  isTightenActive,
  getBudgetEvents,
  finalizeBudgetStream,
  resetBudgetCycle
} from '../../lib/token/budget-closure.js';
import { validateEvent, normalizeEvent } from '../../lib/streaming/pse-events.js';
import { PHASES } from '../../lib/token/budget-manager.js';
import { PHASE_ALLOCATION_RATIOS, DEFAULT_TOTAL_BUDGET, getRecord, getSessionRecords, clearSession } from '../../lib/token/estimation-track.js';
import { digest, listProfiles, TIGHTEN_MAX_ITEMS as DIGEST_TIGHTEN_MAX_ITEMS } from '../../lib/context-assembly/digest.js';

/** @private 构建合法 usage 事件（FP-006 Schema） */
function usageEvent(outputTokens, source = 'measured', inputTokens = 0) {
  return normalizeEvent({
    event: 'usage',
    data: { input_tokens: inputTokens, output_tokens: outputTokens, source }
  });
}

/** @private 会话名隔离 */
let sessionSeq = 0;
function freshSession() {
  sessionSeq += 1;
  return `fp008-${sessionSeq}`;
}

// ==================== B1/B2 ====================

describe('B1 三级梯级事件', () => {
  test('三事件定义齐备且全部通过 FP-006 Schema', () => {
    const sid = freshSession();
    const { events } = recordEstimate(sid, 'impl', DEFAULT_TOTAL_BUDGET * PHASE_ALLOCATION_RATIOS.impl * 1.2);
    assert.deepEqual(events.map(e => e.event), ['budget.warning', 'budget.tighten', 'budget.stop_suggested']);
    for (const ev of events) {
      assert.equal(validateEvent(ev).valid, true);
      assert.equal(ev.data.session_id, sid);
      assert.equal(ev.data.phase, 'impl');
      assert.equal(ev.data.level, ev.event.replace('budget.', ''));
    }
    assert.deepEqual(getBudgetEvents(sid, 'impl').map(e => e.event), events.map(e => e.event)); // 下发清单可查
  });

  test('常量契约：阈值固定 70/85/100（R3）+ 梯级枚举 + tighten 收紧值与 FP-004 同源', () => {
    assert.deepEqual(BUDGET_LADDER_THRESHOLDS, { warning: 0.70, tighten: 0.85, stop_suggested: 1.0 });
    assert.deepEqual([...LADDER_LEVELS], ['none', 'warning', 'tighten', 'stop_suggested']);
    assert.equal(TIGHTEN_MAX_ITEMS, 5);
    assert.equal(TIGHTEN_MAX_ITEMS, DIGEST_TIGHTEN_MAX_ITEMS); // T4 口径单一来源
  });
});

describe('B2 不擅自中断（R1）', () => {
  test('占比 150% 不抛错、无强制终止行为，仅产出建议事件', () => {
    const sid = freshSession();
    let result;
    assert.doesNotThrow(() => {
      result = recordEstimate(sid, 'impl', DEFAULT_TOTAL_BUDGET * PHASE_ALLOCATION_RATIOS.impl * 1.5);
    });
    assert.equal(result.state.level, 'stop_suggested');
    const stopEvent = result.events.find(e => e.event === 'budget.stop_suggested');
    assert.equal(stopEvent.data.action, 'stop_suggested');
    assert.equal(stopEvent.data.partial_result_hint, true);
    assert.ok(stopEvent.data.message.includes('建议'));
    assert.ok(stopEvent.data.message.includes('宿主')); // 执行权在宿主 Agent
    // 无任何平台侧终止信号：返回值仅含记录/状态/事件
    assert.deepEqual(Object.keys(result).sort(), ['events', 'record', 'regression', 'state']);
  });
});

// ==================== T1 阈值跨越沿 ====================

describe('T1 阈值触发准确', () => {
  const REVIEW_BUDGET = DEFAULT_TOTAL_BUDGET * PHASE_ALLOCATION_RATIOS.review; // 15000

  test('边界值矩阵：0.6999/0.70/0.8499/0.85/0.9999/1.0', () => {
    const cases = [
      { ratio: 0.6999, level: 'none', events: [] },
      { ratio: 0.70, level: 'warning', events: ['budget.warning'] },
      { ratio: 0.8499, level: 'warning', events: ['budget.warning'] }, // 全新会话直落 84.99%：跨越 70 沿一次
      { ratio: 0.85, level: 'tighten', events: ['budget.warning', 'budget.tighten'] }, // 跳级逐级补发
      { ratio: 0.9999, level: 'tighten', events: ['budget.warning', 'budget.tighten'] },
      { ratio: 1.0, level: 'stop_suggested', events: ['budget.warning', 'budget.tighten', 'budget.stop_suggested'] }
    ];
    for (const c of cases) {
      const sid = freshSession();
      const { state, events } = recordEstimate(sid, 'review', REVIEW_BUDGET * c.ratio);
      assert.equal(state.level, c.level, `ratio=${c.ratio}`);
      assert.deepEqual(events.map(e => e.event), c.events, `ratio=${c.ratio} 事件沿`);
    }
  });

  test('跳级逐级补发各一次；同沿重复评估不重复发', () => {
    const sid = freshSession();
    const first = recordEstimate(sid, 'design', DEFAULT_TOTAL_BUDGET * PHASE_ALLOCATION_RATIOS.design * 1.05);
    assert.deepEqual(first.events.map(e => e.event), ['budget.warning', 'budget.tighten', 'budget.stop_suggested']);
    // 继续累加计数（占比仍 ≥100%）：无新跨越沿 → 零事件
    const second = recordEstimate(sid, 'design', DEFAULT_TOTAL_BUDGET * PHASE_ALLOCATION_RATIOS.design * 0.05);
    assert.deepEqual(second.events, []);
    assert.equal(second.state.level, 'stop_suggested');
    assert.equal(getBudgetEvents(sid, 'design').length, 3); // 全局下发清单仍为 3
  });
});

// ==================== T2 梯级单调 ====================

describe('T2 梯级单调（R2）', () => {
  test('实测覆盖估算后占比回落 → LADDER_REGRESSION 保持最高梯级', () => {
    const sid = freshSession();
    const IMPL_BUDGET = DEFAULT_TOTAL_BUDGET * PHASE_ALLOCATION_RATIOS.impl; // 40000
    recordEstimate(sid, 'impl', IMPL_BUDGET * 0.9); // 90% → tighten
    // 实测回填远小于估算：占比回落至 20%
    const result = onUsageEvent(usageEvent(IMPL_BUDGET * 0.2), { sessionId: sid, phase: 'impl' });
    assert.equal(result.regression, true);
    assert.equal(result.state.level, 'tighten'); // R2：保持最高已达梯级
    assert.ok(result.state.phase_ratio < 0.7); // 事实占比已更新
    assert.equal(getLadderState(sid, 'impl').level, 'tighten');
    // 单调路径仍然前向：继续累加占比 → 可继续晋升
    const advance = recordEstimate(sid, 'impl', IMPL_BUDGET * 0.9);
    assert.equal(advance.state.level, 'stop_suggested');
    assert.deepEqual(advance.events.map(e => e.event), ['budget.tighten', 'budget.stop_suggested'].filter(x => x !== 'budget.tighten'));
  });
});

// ==================== B3 usage 实测回填 ====================

describe('B3 usage 实测回填（FP-002 规则）', () => {
  test('measured 事件覆盖最新 estimated 记录（单主值，tokens_est 保留偏差核算）', () => {
    const sid = freshSession();
    const { record: estRecord } = recordEstimate(sid, 'analysis', 5000);
    assert.equal(getSessionRecords(sid).length, 1);

    const { record } = onUsageEvent(usageEvent(4200), { sessionId: sid, phase: 'analysis' });
    assert.equal(record.record_id, estRecord.record_id); // 同记录覆盖
    const stored = getRecord(sid, estRecord.record_id);
    assert.equal(stored.source, 'measured');
    assert.equal(stored.tokens_measured, 4200); // 主值
    assert.equal(stored.tokens_est, 5000); // 保留用于偏差核算（R3）
    assert.equal(getSessionRecords(sid).length, 1); // 不并存双记录
  });

  test('无 estimated 记录时新建 measured 记录；后续实测逐条新建', () => {
    const sid = freshSession();
    const first = onUsageEvent(usageEvent(100), { sessionId: sid, phase: 'analysis' });
    assert.equal(first.record.source, 'measured');
    const second = onUsageEvent(usageEvent(200), { sessionId: sid, phase: 'analysis' });
    assert.notEqual(second.record.record_id, first.record.record_id);
    assert.equal(getSessionRecords(sid).length, 2);
  });

  test('estimated 兜底事件 → 新建估算记录（不携带实测主值，R1）', () => {
    const sid = freshSession();
    const { record } = onUsageEvent(usageEvent(300, 'estimated'), { sessionId: sid, phase: 'analysis' });
    assert.equal(record.source, 'estimated');
    assert.equal(record.tokens_measured, undefined);
    assert.equal(record.tokens_est, 300);
  });
});

// ==================== T3 usage 缺失兜底 ====================

describe('T3 usage 缺失兜底（USAGE_MISSING）', () => {
  test('流尾无 usage：估算轨接管，不阻断，manifest 口径 source=estimated', () => {
    const sid = freshSession();
    recordEstimate(sid, 'review', DEFAULT_TOTAL_BUDGET * PHASE_ALLOCATION_RATIOS.review * 0.75);
    const stream = [
      normalizeEvent({ event: 'message_start', data: { id: 's1', family: 'openai', context_tokens: 0 } }),
      normalizeEvent({ event: 'content_delta', data: { text: '内容' } }),
      normalizeEvent({ event: 'done', data: { finish_reason: 'stop', usage_total: {} } })
    ];
    const result = finalizeBudgetStream(sid, 'review', stream);
    assert.equal(result.usage_missing, true);
    assert.equal(result.notice, 'USAGE_MISSING');
    assert.equal(result.source, 'estimated');
    assert.equal(result.state.level, 'warning'); // 估算记录已参与占比（75% → warning）
    assert.ok('events' in result);
  });

  test('流内含 usage：source=measured', () => {
    const sid = freshSession();
    const stream = [
      usageEvent(800),
      normalizeEvent({ event: 'done', data: { finish_reason: 'stop', usage_total: { output_tokens: 800 } } })
    ];
    const result = finalizeBudgetStream(sid, 'verify', stream);
    assert.equal(result.usage_missing, false);
    assert.equal(result.source, 'measured');
    assert.equal(result.notice, undefined);
  });
});

// ==================== T4 tighten 联动 ====================

describe('T4 tighten 联动（FP-004 Digest）', () => {
  test('tighten 激活后 digest max_items=5 生效；未激活走 profile 默认 10', () => {
    const sid = freshSession();
    const profile = listProfiles().find(p => p.profile_id === 'contract-report');
    assert.equal(profile.max_items, 10);
    const artifact = {
      artifact_ref: 'fp008-test/contract-report.json',
      summary: '契约扫描完成，共 12 处偏差',
      issues: Array.from({ length: 12 }, (_, i) => ({ path: `src/mod-${i}.js`, desc: `偏差 ${i}` }))
    };

    // 未激活：默认 10 条
    const before = digest(artifact, 'contract-report', { tighten: isTightenActive(sid, 'impl') });
    assert.equal(before.items.find(i => i.field === 'issues').value.length, 10);

    // 推进至 tighten（85%）
    recordEstimate(sid, 'impl', DEFAULT_TOTAL_BUDGET * PHASE_ALLOCATION_RATIOS.impl * 0.9);
    assert.equal(isTightenActive(sid, 'impl'), true);
    const after = digest(artifact, 'contract-report', { tighten: isTightenActive(sid, 'impl') });
    assert.equal(after.items.find(i => i.field === 'issues').value.length, TIGHTEN_MAX_ITEMS); // 5（T4）
  });

  test('skip_tier2 建议位：tighten 事件携带 skip_tier2=true（调用方据此不传 tier2References）', () => {
    const sid = freshSession();
    recordEstimate(sid, 'review', DEFAULT_TOTAL_BUDGET * PHASE_ALLOCATION_RATIOS.review * 0.9);
    const tightenEvent = getBudgetEvents(sid, 'review').find(e => e.event === 'budget.tighten');
    assert.equal(tightenEvent.data.skip_tier2, true);
    assert.equal(tightenEvent.data.digest_max_items, 5);
  });
});

// ==================== T5 budget-manager 零改动（R4） ====================

describe('T5 budget-manager 零改动锚定', () => {
  test('PHASES 枚举只读消费且值集不变；阶段预算比例沿用 FP-002 镜像', () => {
    assert.deepEqual(Object.values(PHASES), ['analysis', 'design', 'impl', 'review', 'verify']);
    assert.deepEqual(PHASE_ALLOCATION_RATIOS, {
      analysis: 0.20, design: 0.15, impl: 0.40, review: 0.15, verify: 0.10
    });
    // 本模块未向 budget-manager/estimation-track 写入任何导出（git diff 审计见验收记录）
    assert.equal(typeof onUsageEvent, 'function');
    assert.equal(typeof recordEstimate, 'function');
  });
});

// ==================== I1 PSE 贯通 ====================

describe('I1 PSE 贯通', () => {
  test('三级事件 payload 字段面完整（session_id/phase/level/phase_ratio/threshold/action/message）', () => {
    const sid = freshSession();
    recordEstimate(sid, 'impl', DEFAULT_TOTAL_BUDGET * PHASE_ALLOCATION_RATIOS.impl * 1.1);
    const [warning, tighten, stop] = getBudgetEvents(sid, 'impl');
    assert.equal(warning.data.action, 'cost_hint');
    assert.equal(warning.data.threshold, 0.70);
    assert.equal(tighten.data.threshold, 0.85);
    assert.equal(stop.data.threshold, 1.0);
    for (const ev of [warning, tighten, stop]) {
      assert.equal(typeof ev.data.phase_ratio, 'number');
      assert.ok(ev.ts && !Number.isNaN(Date.parse(ev.ts))); // RFC3339
      assert.equal(ev.degraded, false);
    }
  });

  test('预算事件可与 usage/done 组成合法 PSE 流', () => {
    const sid = freshSession();
    recordEstimate(sid, 'verify', DEFAULT_TOTAL_BUDGET * PHASE_ALLOCATION_RATIOS.verify * 0.95); // warning+tighten
    const stream = [
      ...getBudgetEvents(sid, 'verify'),
      usageEvent(1200),
      normalizeEvent({ event: 'done', data: { finish_reason: 'stop', usage_total: { output_tokens: 1200 } } })
    ];
    for (const ev of stream) assert.equal(validateEvent(ev).valid, true);
  });
});

// ==================== I2 FP-012 消费挂接 ====================

describe('I2 压实挂接（FP-012 就绪）', () => {
  test('getBudgetEvents 输出可供 FP-012 直接消费（事件携带 session/phase/level）', () => {
    const sid = freshSession();
    recordEstimate(sid, 'design', DEFAULT_TOTAL_BUDGET * PHASE_ALLOCATION_RATIOS.design * 0.75);
    const events = getBudgetEvents(sid, 'design');
    assert.equal(events.length, 1);
    assert.equal(events[0].event, 'budget.warning');
    assert.equal(events[0].data.session_id, sid);
    assert.equal(events[0].data.phase, 'design');
    assert.equal(events[0].data.level, 'warning');
    const copy = getBudgetEvents(sid, 'design');
    copy.pop(); // 深拷贝：外部修改不影响内部下发清单
    assert.equal(getBudgetEvents(sid, 'design').length, 1);
  });
});

// ==================== I3 记账误差 ====================

describe('I3 会话级记账误差 ≤5%', () => {
  test('usage_total 与实测记录和偏差 2% → usage_deviation=0.02', () => {
    const sid = freshSession();
    recordEstimate(sid, 'impl', 500);
    onUsageEvent(usageEvent(480), { sessionId: sid, phase: 'impl' }); // 覆盖估算记录 → 480
    onUsageEvent(usageEvent(500), { sessionId: sid, phase: 'impl' }); // 新建实测记录 → 累计 980
    const stream = [
      usageEvent(480), usageEvent(500),
      normalizeEvent({ event: 'done', data: { finish_reason: 'stop', usage_total: { output_tokens: 1000 } } })
    ];
    const result = finalizeBudgetStream(sid, 'impl', stream);
    assert.equal(result.usage_deviation, 0.02);
    assert.ok(result.usage_deviation <= 0.05); // I3 达标
  });

  test('偏差超 5% 时如实上报（不修饰）', () => {
    const sid = freshSession();
    onUsageEvent(usageEvent(480), { sessionId: sid, phase: 'impl' });
    const stream = [
      usageEvent(480),
      normalizeEvent({ event: 'done', data: { finish_reason: 'stop', usage_total: { output_tokens: 1000 } } })
    ];
    const result = finalizeBudgetStream(sid, 'impl', stream);
    assert.equal(result.usage_deviation, 0.52);
  });
});

// ==================== 错误路径与边界 ====================

describe('错误路径与边界', () => {
  test('onUsageEvent 拒绝非 usage / 畸形事件 / ctx 缺失 / phase 非法', () => {
    const sid = freshSession();
    assert.throws(() => onUsageEvent(normalizeEvent({ event: 'content_delta', data: { text: 'x' } }), { sessionId: sid, phase: 'impl' }), /USAGE_EVENT_INVALID/);
    assert.throws(() => onUsageEvent({ event: 'usage', data: { output_tokens: -1, source: 'measured' } }, { sessionId: sid, phase: 'impl' }), /USAGE_EVENT_INVALID/);
    assert.throws(() => onUsageEvent(usageEvent(1), { phase: 'impl' }), /USAGE_EVENT_INVALID.*sessionId/);
    assert.throws(() => onUsageEvent(usageEvent(1), { sessionId: sid, phase: 'coding' }), /USAGE_EVENT_INVALID.*phase/);
  });

  test('未评估状态：getLadderState → null / getBudgetEvents → [] / isTightenActive → false', () => {
    const sid = freshSession();
    assert.equal(getLadderState(sid, 'impl'), null);
    assert.deepEqual(getBudgetEvents(sid, 'impl'), []);
    assert.equal(isTightenActive(sid, 'impl'), false);
  });

  test('finalizeBudgetStream 输入校验', () => {
    assert.throws(() => finalizeBudgetStream('s', 'impl', 'not-array'), /USAGE_EVENT_INVALID/);
    assert.throws(() => finalizeBudgetStream('s', 'bad-phase', []), /USAGE_EVENT_INVALID.*phase/);
  });

  test('recordEstimate 拒绝空 sessionId 与非法 phase', () => {
    assert.throws(() => recordEstimate('', 'impl', 100), /USAGE_EVENT_INVALID/);
    assert.throws(() => recordEstimate('s', 'coding', 100), /USAGE_EVENT_INVALID/);
  });

  test('resetBudgetCycle 清空梯级状态（会话隔离）', () => {
    const sid = freshSession();
    recordEstimate(sid, 'impl', DEFAULT_TOTAL_BUDGET * PHASE_ALLOCATION_RATIOS.impl * 0.8);
    assert.ok(getLadderState(sid, 'impl'));
    resetBudgetCycle(sid);
    clearSession(sid); // 消耗记录一并清空，避免残留记录抬高占比
    assert.equal(getLadderState(sid, 'impl'), null);
    recordEstimate(sid, 'impl', DEFAULT_TOTAL_BUDGET * PHASE_ALLOCATION_RATIOS.impl * 0.8); // 跨越沿重新触发
    assert.ok(getBudgetEvents(sid, 'impl').length > 0);
    resetBudgetCycle();
  });

  test('clearSession 后重跑闭环无残留（FP-002 会话内存态隔离）', () => {
    const sid = freshSession();
    recordEstimate(sid, 'impl', DEFAULT_TOTAL_BUDGET * PHASE_ALLOCATION_RATIOS.impl);
    onUsageEvent(usageEvent(1000), { sessionId: sid, phase: 'impl' });
    clearSession(sid);
    resetBudgetCycle(sid);
    assert.equal(getSessionRecords(sid).length, 0);
    assert.equal(getLadderState(sid, 'impl'), null);
  });
});
