// tests/toko/fallback-chain.test.js - FP-TOKO-010 fallback-chain 契约测试
//
// 验收覆盖：B1 四类错误全归类 / B2 扩展家族（ERNIE/MiniMax/xAI）OpenAI 兼容兜底 /
// B3+T4 轨迹可回放与 extra 透传 / T1 drift 全流程联调 FP-007 / T2 unsupported 整包回退 /
// T3 usage_missing 估算轨接管 / T5 降级风暴防护 / I1 适配器对接 / I2 PSE 贯通 / I3 兼容矩阵。

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ERROR_CLASSES,
  DEGRADE_STRATEGIES,
  DEGRADE_LIMIT_PER_SESSION,
  RESUME_HINT,
  classify,
  degrade,
  markDegraded,
  getDegradationTrace,
  resetDegradationTrace,
  getCompatibilityMatrix
} from '../../lib/streaming/fallback-chain.js';
import {
  ADAPTER_FAMILIES,
  getAdapter,
  normalizeStream,
  resetUnknownEventStats
} from '../../lib/streaming/adapters/index.js';
import { validateEvent, normalizeEvent } from '../../lib/streaming/pse-events.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADAPTERS_DIR = path.join(__dirname, '../../lib/streaming/adapters');

/** @private 读取家族夹具 */
function fixture(family) {
  return JSON.parse(readFileSync(path.join(ADAPTERS_DIR, family, 'fixtures.json'), 'utf-8'));
}

const RFC3339_RE = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

describe('FP-TOKO-010 fallback-chain', () => {
  beforeEach(() => {
    resetDegradationTrace();
    resetUnknownEventStats();
  });

  // ==================== 常量 ====================

  describe('常量与枚举', () => {
    test('ERROR_CLASSES 为 §2.2 四类枚举（冻结）', () => {
      assert.deepEqual([...ERROR_CLASSES], [
        'retryable_stream_error',
        'family_protocol_drift',
        'streaming_unsupported',
        'usage_missing'
      ]);
      assert.equal(Object.isFrozen(ERROR_CLASSES), true);
    });

    test('DEGRADE_STRATEGIES 为 §2.2 三策略枚举（冻结）', () => {
      assert.deepEqual([...DEGRADE_STRATEGIES], ['fallback_adapter', 'non_stream_fallback', 'estimated_track']);
      assert.equal(Object.isFrozen(DEGRADE_STRATEGIES), true);
    });

    test('DEGRADE_LIMIT_PER_SESSION = 2（R3），RESUME_HINT 非空文案', () => {
      assert.equal(DEGRADE_LIMIT_PER_SESSION, 2);
      assert.equal(typeof RESUME_HINT, 'string');
      assert.ok(RESUME_HINT.length > 0);
      assert.ok(RESUME_HINT.includes('断点续传'));
    });
  });

  // ==================== B1 classify 四类全归类 ====================

  describe('B1 classify 四类全归类（§1.2 决策表）', () => {
    test('非对象输入 → null（不降级，原样上抛）', () => {
      assert.equal(classify(null), null);
      assert.equal(classify(undefined), null);
      assert.equal(classify('plain string'), null);
      assert.equal(classify(42), null);
    });

    test('FP-007 降级建议对象 error_class 直认（四类逐一遍历）', () => {
      for (const errorClass of ERROR_CLASSES) {
        assert.equal(classify({ error_class: errorClass, family: 'glm' }), errorClass);
      }
    });

    test('USAGE_MISSING 关键码（FP-008 notice / message 双入口）→ usage_missing', () => {
      assert.equal(classify({ notice: 'USAGE_MISSING' }), 'usage_missing');
      assert.equal(classify(new Error('USAGE_MISSING: 流尾部无 usage')), 'usage_missing');
    });

    test('STREAM_UNSUPPORTED 关键码（FP-006）与 streaming=false → streaming_unsupported', () => {
      assert.equal(classify({ notice: 'STREAM_UNSUPPORTED' }), 'streaming_unsupported');
      assert.equal(classify(new Error('STREAM_UNSUPPORTED: 家族不支持流式')), 'streaming_unsupported');
      assert.equal(classify({ message: 'no streaming', streaming: false }), 'streaming_unsupported');
    });

    test('UNKNOWN_EVENT_THRESHOLD（FP-007 计数超限）→ family_protocol_drift', () => {
      assert.equal(classify({ code: 'UNKNOWN_EVENT_THRESHOLD' }), 'family_protocol_drift');
      assert.equal(classify(new Error('UNKNOWN_EVENT_THRESHOLD: 未映射事件累计超限')), 'family_protocol_drift');
      assert.equal(classify(new Error('FAMILY_PROTOCOL_DRIFT')), 'family_protocol_drift');
    });

    test('retryable=true / STREAM_BROKEN / 网络层错误码 → retryable_stream_error', () => {
      assert.equal(classify({ retryable: true, message: 'x' }), 'retryable_stream_error');
      assert.equal(classify(new Error('STREAM_BROKEN: SSE 中断')), 'retryable_stream_error');
      assert.equal(classify(Object.assign(new Error('request failed'), { code: 'ECONNRESET' })), 'retryable_stream_error');
      assert.equal(classify(new Error('socket hang up')), 'retryable_stream_error');
      assert.equal(classify(Object.assign(new Error('write failed'), { code: 'EPIPE' })), 'retryable_stream_error');
    });

    test('无法归类 → null', () => {
      assert.equal(classify(new Error('some random failure')), null);
      assert.equal(classify({ code: 'TOTALLY_UNKNOWN' }), null);
    });
  });

  // ==================== B2 扩展家族 OpenAI 兼容兜底（§1.3/R1） ====================

  describe('B2 扩展家族验证（ERNIE/MiniMax/xAI 走 OpenAI 兼容链）', () => {
    for (const family of ['ernie', 'minimax', 'xai']) {
      test(`${family}（未注册家族）drift 降级兜底 openai 适配器`, () => {
        const decision = degrade('family_protocol_drift', family, { sessionId: `b2-${family}` });
        assert.equal(decision.strategy, 'fallback_adapter');
        assert.equal(decision.to_family, 'openai'); // R1：fallback 适配器 = OpenAI 兼容兜底
        assert.equal(decision.degraded, true);
        const trace = getDegradationTrace(`b2-${family}`);
        assert.equal(trace.length, 1);
        assert.equal(trace[0].to_family, 'openai');
      });
    }

    test('兼容矩阵包含 3 个扩展家族行（registered=false，兜底 openai）', () => {
      const matrix = getCompatibilityMatrix();
      for (const family of ['ernie', 'minimax', 'xai']) {
        const row = matrix.find(r => r.family === family);
        assert.ok(row, `矩阵缺少扩展家族 ${family}`);
        assert.equal(row.registered, false);
        assert.equal(row.fallback_family, 'openai');
        assert.ok(row.conclusion.includes('OpenAI 兼容'));
      }
    });
  });

  // ==================== T1 drift 全流程联调 FP-007 ====================

  describe('T1 family_protocol_drift 全流程（FP-007 计数 → classify → degrade → markDegraded）', () => {
    test('UnknownEvent 跨阈值 → 降级建议 → openai 适配器 → 事件全量 degraded 标记', () => {
      const sessionId = 't1-drift-e2e';
      const glmFixture = fixture('glm');
      // 构造 10 个 glm 未映射事件（无 choices/usage 消费键）夹杂映射事件
      const unknownRaw = { glm_special_field: { note: 'not-in-mapping' } };
      const rawEvents = [
        unknownRaw, unknownRaw, unknownRaw, unknownRaw, unknownRaw,
        glmFixture.events[0],
        unknownRaw, unknownRaw, unknownRaw, unknownRaw, unknownRaw, // 累计 10 = 阈值
        glmFixture.events[3]
      ];
      const { events, unknown, stats } = normalizeStream(rawEvents, 'glm', { sessionId });

      assert.equal(unknown.length, 10);
      assert.equal(stats.degrade_suggested, true);
      assert.ok(stats.suggestion, '跨阈值后应携带降级建议');
      assert.equal(stats.suggestion.error_class, 'family_protocol_drift');

      // classify 消费 FP-007 建议 → degrade 决策
      const errorClass = classify(stats.suggestion);
      assert.equal(errorClass, 'family_protocol_drift');
      const decision = degrade(errorClass, 'glm', { sessionId });
      assert.equal(decision.strategy, 'fallback_adapter');
      assert.equal(decision.to_family, 'openai'); // glm capabilities.fallback_family

      // markDegraded：下游事件全量标 degraded=true
      const marked = markDegraded(events, {
        fromFamily: 'glm', toFamily: decision.to_family, errorClass
      });
      assert.equal(marked.length, events.length);
      for (const ev of marked) {
        assert.equal(ev.degraded, true);
        assert.equal(ev.extra.degradation.from_family, 'glm');
        assert.equal(ev.extra.degradation.to_family, 'openai');
        assert.equal(ev.extra.degradation.error_class, 'family_protocol_drift');
        assert.match(ev.extra.degradation.ts, RFC3339_RE);
      }

      // 轨迹落账（B3 回放）
      const trace = getDegradationTrace(sessionId);
      assert.equal(trace.length, 1);
      assert.equal(trace[0].error_class, 'family_protocol_drift');
      assert.equal(trace[0].strategy, 'fallback_adapter');
    });
  });

  // ==================== B3+T4 轨迹可回放 + extra 透传 ====================

  describe('B3+T4 降级轨迹与字段透传（R2/R4）', () => {
    test('轨迹记录 §2.1 字段齐备且按序追加', () => {
      degrade('family_protocol_drift', 'kimi', { sessionId: 'b3-order' });
      degrade('usage_missing', 'kimi', { sessionId: 'b3-order' });
      const trace = getDegradationTrace('b3-order');
      assert.equal(trace.length, 2);
      assert.equal(trace[0].session_id, 'b3-order');
      assert.equal(trace[0].from_family, 'kimi');
      assert.equal(trace[0].to_family, 'openai');
      assert.equal(trace[0].error_class, 'family_protocol_drift');
      assert.equal(trace[0].strategy, 'fallback_adapter');
      assert.equal(trace[0].degraded, true);
      assert.match(trace[0].ts, RFC3339_RE);
      assert.equal(trace[1].error_class, 'usage_missing');
      assert.equal(trace[1].strategy, 'estimated_track');
      assert.equal(trace[1].to_family, null); // 估算轨时为空（§2.1）
    });

    test('轨迹为深拷贝（外部改写不影响内部账本）', () => {
      degrade('usage_missing', 'qwen', { sessionId: 'b3-clone' });
      const trace = getDegradationTrace('b3-clone');
      trace[0].error_class = 'tampered';
      const again = getDegradationTrace('b3-clone');
      assert.equal(again[0].error_class, 'usage_missing');
    });

    test('R2/T4：markDegraded 保留事件原有 extra 字段（不覆盖）', () => {
      const ev = normalizeEvent({ event: 'content_delta', data: { text: 'hi' }, vendor_ref: 'raw-payload' });
      assert.ok(ev, 'normalizeEvent 应产出合法事件');
      const before = { ...ev.extra };
      markDegraded([ev], { fromFamily: 'glm', toFamily: 'openai', errorClass: 'family_protocol_drift' });
      // 原透传字段保留
      for (const key of Object.keys(before)) {
        assert.deepEqual(ev.extra[key], before[key], `原有 extra 字段 ${key} 不得丢失`);
      }
      assert.deepEqual(ev.extra.vendor_ref, 'raw-payload');
      // 降级元信息合入
      assert.equal(ev.extra.degradation.from_family, 'glm');
      assert.equal(ev.extra.degradation.to_family, 'openai');
    });

    test('I2：markDegraded 后的事件通过 FP-006 validateEvent', () => {
      const ev = normalizeEvent({ event: 'usage', data: { input_tokens: 10, output_tokens: 5, source: 'measured' } });
      markDegraded([ev], { fromFamily: 'deepseek', toFamily: null, errorClass: 'usage_missing' });
      const check = validateEvent(ev);
      assert.equal(check.valid, true, `校验失败: ${check.errors.join('; ')}`);
      assert.equal(ev.degraded, true);
    });

    test('无后续映射事件时 unknown_events 透传字段在降级后保留', () => {
      const sessionId = 'b3-unknown-passthrough';
      const { events } = normalizeStream(
        [{ odd_field: 1 }, { choices: [{ index: 0, delta: { role: 'assistant', content: 'x' }, finish_reason: null }] }],
        'glm',
        { sessionId }
      );
      const marked = markDegraded(events, { fromFamily: 'glm', toFamily: 'openai', errorClass: 'family_protocol_drift' });
      const withUnknown = marked.find(ev => Array.isArray(ev.extra?.unknown_events));
      assert.ok(withUnknown, '带内透传的 unknown_events 应保留');
      assert.equal(withUnknown.extra.unknown_events.length, 1);
    });
  });

  // ==================== T2/T3 整包回退与估算轨接管 ====================

  describe('T2 streaming_unsupported 整包回退（=3.4.x 行为）', () => {
    test('strategy=non_stream_fallback，无降级目标家族，notice=STREAM_UNSUPPORTED', () => {
      const decision = degrade('streaming_unsupported', 'anthropic', { sessionId: 't2-unsupported' });
      assert.equal(decision.strategy, 'non_stream_fallback');
      assert.equal(decision.notice, 'STREAM_UNSUPPORTED');
      assert.equal(decision.degraded, true);
      assert.equal(decision.to_family, undefined); // 整包响应无目标家族
      const trace = getDegradationTrace('t2-unsupported');
      assert.equal(trace[0].to_family, null);
      assert.equal(trace[0].strategy, 'non_stream_fallback');
    });
  });

  describe('T3 usage_missing 估算轨接管', () => {
    test('strategy=estimated_track，notice=USAGE_MISSING（对齐 FP-008 finalizeBudgetStream）', () => {
      const decision = degrade('usage_missing', 'deepseek', { sessionId: 't3-usage' });
      assert.equal(decision.strategy, 'estimated_track');
      assert.equal(decision.notice, 'USAGE_MISSING');
      assert.equal(decision.to_family, undefined);
      const trace = getDegradationTrace('t3-usage');
      assert.equal(trace[0].to_family, null);
      assert.equal(trace[0].strategy, 'estimated_track');
    });
  });

  // ==================== retryable 宿主决策分支 ====================

  describe('retryable_stream_error 宿主决策（非降级策略）', () => {
    test('产出 error{retryable:true} + 断点续传建议；不入轨迹、不计降级次数', () => {
      const sessionId = 'r1-retryable';
      const decision = degrade('retryable_stream_error', 'kimi', { sessionId });
      assert.equal(decision.strategy, null); // 不属于三策略枚举
      assert.equal(decision.action, 'emit_retryable_error');
      assert.equal(decision.resume_hint, true);
      // errorEvent 为合法 PSE error 事件（I2）
      const check = validateEvent(decision.errorEvent);
      assert.equal(check.valid, true, `errorEvent 校验失败: ${check.errors.join('; ')}`);
      assert.equal(decision.errorEvent.event, 'error');
      assert.equal(decision.errorEvent.data.retryable, true);
      assert.equal(decision.errorEvent.data.code, 'STREAM_BROKEN');
      assert.ok(decision.errorEvent.data.message.includes('断点续传'));
      // 不入轨迹（§1.2：宿主决策，非降级）
      assert.deepEqual(getDegradationTrace(sessionId), []);
      // 不计次：随后两次降级仍可执行（R3 上限不受影响）
      degrade('usage_missing', 'kimi', { sessionId });
      degrade('usage_missing', 'kimi', { sessionId });
      const trace = getDegradationTrace(sessionId);
      assert.equal(trace.length, 2);
    });
  });

  // ==================== T5 降级风暴防护（R3） ====================

  describe('T5 降级风暴防护（每会话上限 2 次）', () => {
    test('第 3 次降级 → terminate:true + DEGRADE_LIMIT_EXCEEDED，且不追加轨迹', () => {
      const sessionId = 't5-storm';
      degrade('usage_missing', 'qwen', { sessionId });
      degrade('streaming_unsupported', 'qwen', { sessionId });
      assert.equal(getDegradationTrace(sessionId).length, 2);

      const third = degrade('family_protocol_drift', 'qwen', { sessionId });
      assert.equal(third.terminate, true);
      assert.equal(third.degraded_count, 2);
      const check = validateEvent(third.errorEvent);
      assert.equal(check.valid, true, `超限 errorEvent 校验失败: ${check.errors.join('; ')}`);
      assert.equal(third.errorEvent.event, 'error');
      assert.equal(third.errorEvent.data.code, 'DEGRADE_LIMIT_EXCEEDED');
      assert.equal(third.errorEvent.data.retryable, false);
      // 超限该次未实际降级：轨迹不追加
      assert.equal(getDegradationTrace(sessionId).length, 2);
    });

    test('降级计数按会话隔离（其他会话不受影响）', () => {
      degrade('usage_missing', 'glm', { sessionId: 't5-iso-a' });
      degrade('usage_missing', 'glm', { sessionId: 't5-iso-a' });
      const decisionB = degrade('usage_missing', 'glm', { sessionId: 't5-iso-b' });
      assert.equal(decisionB.terminate, undefined); // 会话 b 未超限
      assert.equal(decisionB.strategy, 'estimated_track');
    });

    test('resetDegradationTrace 后计数清零（会话级与全量）', () => {
      degrade('usage_missing', 'doubao', { sessionId: 't5-reset' });
      degrade('usage_missing', 'doubao', { sessionId: 't5-reset' });
      assert.equal(getDegradationTrace('t5-reset').length, 2);
      resetDegradationTrace('t5-reset');
      assert.deepEqual(getDegradationTrace('t5-reset'), []);
      // 全量重置
      degrade('usage_missing', 'openai', { sessionId: 't5-reset-all' });
      resetDegradationTrace();
      assert.deepEqual(getDegradationTrace('t5-reset-all'), []);
    });
  });

  // ==================== 输入校验与无会话行为 ====================

  describe('输入校验', () => {
    test('非法 errorClass → DEGRADE_INVALID_CLASS', () => {
      assert.throws(() => degrade('not_a_class', 'openai'), /DEGRADE_INVALID_CLASS/);
      assert.throws(() => degrade(undefined, 'openai'), /DEGRADE_INVALID_CLASS/);
    });

    test('非法 currentFamily → DEGRADE_INVALID_FAMILY', () => {
      assert.throws(() => degrade('usage_missing', ''), /DEGRADE_INVALID_FAMILY/);
      assert.throws(() => degrade('usage_missing', 123), /DEGRADE_INVALID_FAMILY/);
    });

    test('markDegraded 非数组输入 → DEGRADE_INVALID_INPUT', () => {
      assert.throws(() => markDegraded('nope', { fromFamily: 'a', errorClass: 'usage_missing' }), /DEGRADE_INVALID_INPUT/);
    });

    test('无 sessionId 时仅返回决策，不记轨迹', () => {
      const decision = degrade('usage_missing', 'openai');
      assert.equal(decision.strategy, 'estimated_track');
      assert.equal(decision.session_id, undefined);
      assert.equal(decision.trace_index, undefined);
      assert.deepEqual(getDegradationTrace('global'), []);
    });
  });

  // ==================== I1 适配器对接 / I3 兼容矩阵 ====================

  describe('I1/I3 适配器对接与兼容矩阵', () => {
    test('I1：8 注册家族 fallback_family 均指向 FP-007 已注册适配器', () => {
      for (const family of ADAPTER_FAMILIES) {
        const adapter = getAdapter(family);
        const fallback = adapter.capabilities.fallback_family;
        assert.equal(fallback, 'openai');
        // 指向的适配器确实可查（已注册）
        assert.doesNotThrow(() => getAdapter(fallback));
        // R1：降级决策与 capabilities 声明一致
        const decision = degrade('family_protocol_drift', family, { sessionId: `i1-${family}` });
        assert.equal(decision.to_family, fallback);
      }
    });

    test('I3：兼容矩阵 8+3 行，注册/扩展行结论齐备', () => {
      const matrix = getCompatibilityMatrix();
      assert.equal(matrix.length, 11);
      const registered = matrix.filter(r => r.registered === true);
      const extensions = matrix.filter(r => r.registered === false);
      assert.equal(registered.length, 8);
      assert.equal(extensions.length, 3);
      for (const row of matrix) {
        assert.equal(typeof row.family, 'string');
        assert.equal(typeof row.fallback_family, 'string');
        assert.equal(typeof row.conclusion, 'string');
        assert.ok(row.conclusion.length > 0);
      }
      assert.deepEqual(registered.map(r => r.family), [...ADAPTER_FAMILIES]);
    });
  });
});
