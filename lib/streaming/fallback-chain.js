// lib/streaming/fallback-chain.js - 模型家族降级链（FP-TOKO-010 / doc 05 §4.5、§5.2）
//
// 职责（FP-TOKO-010 §3.1 处理流程）：
//   1. 捕获流式异常/异常计数（classify 归类 4 类）→ 2. 按决策表选策略（degrade）→
//   3. 切换适配器 / 整包回退 / 估算轨接管 → 4. 下游事件标 degraded=true（extra 保留原始字段）→
//   5. 轨迹记录供审计回放（getDegradationTrace）。
//
// 决策表（§1.2）：
//   retryable_stream_error → error{retryable:true} + 断点续传建议（宿主决策，非降级策略，不入轨迹）；
//   family_protocol_drift  → 自动降级 fallback_family 适配器（未注册家族亦兜底 openai，R1）；
//   streaming_unsupported  → 整包响应（=3.4.x 行为，notice=STREAM_UNSUPPORTED 对齐 FP-006 回退分支）；
//   usage_missing          → 估算轨接管（notice=USAGE_MISSING 对齐 FP-008 finalizeBudgetStream）。
//
// 红线：
//   - R1：降级后行为必须可用——fallback 适配器 = OpenAI 兼容兜底；整包回退 = 3.4.x 行为；
//   - R2：降级不丢弃原始事件字段（extra 合并透传，不覆盖）；
//   - R3：每会话降级次数上限 2 次，超限上报 error 并终止流（避免降级风暴）；
//   - R4：降级轨迹可审计、可回放（§2.1 记录按序追加，深拷贝输出）。

import { getAdapter, ADAPTER_FAMILIES } from './adapters/index.js';
import { normalizeEvent } from './pse-events.js';

/** §2.2 错误类枚举（doc 05 §4.5 分类） */
export const ERROR_CLASSES = Object.freeze([
  'retryable_stream_error',
  'family_protocol_drift',
  'streaming_unsupported',
  'usage_missing'
]);

/** §2.2 降级策略枚举 */
export const DEGRADE_STRATEGIES = Object.freeze(['fallback_adapter', 'non_stream_fallback', 'estimated_track']);

/** R3：每会话降级次数上限（超限终止流） */
export const DEGRADE_LIMIT_PER_SESSION = 2;

/** 断点续传建议文案（宿主决策依据） */
export const RESUME_HINT = 'SSE 中断但已收到部分内容；建议宿主基于已收到的部分结果断点续传（是否续传由宿主决定）';

/** 降级轨迹（sessionId → 记录数组，R4 可审计） */
const degradationTraces = new Map();

/** @private */
function nowIso() {
  return new Date().toISOString();
}

/**
 * 错误归类（§1.1：4 类，doc 05 §4.5）
 *
 * 识别口径（按优先序）：
 *   1. FP-007 降级建议对象（error_class 字段已在枚举内）直接归类；
 *   2. notice/code/message 关键码：USAGE_MISSING（FP-008）/ STREAM_UNSUPPORTED（FP-006）/
 *      UNKNOWN_EVENT_THRESHOLD（FP-007 计数超限）/ STREAM_BROKEN（FP-006 流中断）；
 *   3. retryable=true 或网络层错误码（ECONNRESET/EPIPE/ETIMEDOUT 等）→ retryable_stream_error；
 *   4. 无法归类返回 null（调用方不降级，原样上抛）。
 *
 * @param {*} error - 错误对象（Error 实例 / FP 模块返回的 notice 对象 / FP-007 降级建议）
 * @returns {'retryable_stream_error'|'family_protocol_drift'|'streaming_unsupported'|'usage_missing'|null}
 */
export function classify(error) {
  if (!error || typeof error !== 'object') return null;

  // FP-007 降级建议 / FP-010 轨迹对象：error_class 已归类
  if (ERROR_CLASSES.includes(error.error_class)) return error.error_class;

  const code = typeof error.code === 'string' ? error.code : '';
  const message = typeof error.message === 'string' ? error.message : '';
  const haystack = `${code} ${message}`;

  if (error.notice === 'USAGE_MISSING' || haystack.includes('USAGE_MISSING')) return 'usage_missing';
  if (error.streaming === false || error.notice === 'STREAM_UNSUPPORTED' || haystack.includes('STREAM_UNSUPPORTED')) {
    return 'streaming_unsupported';
  }
  if (haystack.includes('UNKNOWN_EVENT_THRESHOLD') || haystack.includes('FAMILY_PROTOCOL_DRIFT')) {
    return 'family_protocol_drift';
  }
  if (
    error.retryable === true ||
    haystack.includes('STREAM_BROKEN') ||
    /ECONNRESET|ECONNREFUSED|EPIPE|ETIMEDOUT|EAI_AGAIN|socket hang up|network/i.test(haystack)
  ) {
    return 'retryable_stream_error';
  }
  return null;
}

/** @private 解析降级目标家族（I1：指向 FP-007 已注册适配器；未注册家族兜底 openai，R1） */
function resolveFallbackFamily(currentFamily) {
  try {
    const adapter = getAdapter(currentFamily);
    return adapter.capabilities.fallback_family; // 8 家族声明均为 openai
  } catch {
    // 未注册家族（ERNIE/MiniMax/xAI 等扩展验证对象）：走 OpenAI 兼容兜底（R1）
    return 'openai';
  }
}

/** @private 追加轨迹记录（R4） */
function appendTrace(sessionId, record) {
  const list = degradationTraces.get(sessionId) ?? [];
  list.push(record);
  degradationTraces.set(sessionId, list);
  return list.length;
}

/**
 * 降级决策（§1.1/§1.2 决策表；R3 降级风暴防护）
 *
 * @param {'retryable_stream_error'|'family_protocol_drift'|'streaming_unsupported'|'usage_missing'} errorClass
 * @param {string} currentFamily - 当前模型家族（可为未注册家族名）
 * @param {{sessionId?:string}} [opts] - sessionId 提供时启用 R3 计数与轨迹记录
 * @returns {Object} 降级决策
 *   - fallback_adapter/non_stream_fallback/estimated_track：
 *     { error_class, strategy, from_family, to_family?, notice?, degraded:true }
 *   - retryable_stream_error（宿主决策，非降级策略）：
 *     { error_class, strategy:null, action:'emit_retryable_error', errorEvent, resume_hint:true, degraded:true }
 *   - 超限（R3）：{ terminate:true, errorEvent, degraded_count }
 * @throws {Error} DEGRADE_INVALID_CLASS
 */
export function degrade(errorClass, currentFamily, opts = {}) {
  if (!ERROR_CLASSES.includes(errorClass)) {
    throw new Error(`DEGRADE_INVALID_CLASS: errorClass 必须为 ${ERROR_CLASSES.join('/')}，得到 ${JSON.stringify(errorClass)}`);
  }
  if (typeof currentFamily !== 'string' || currentFamily.length === 0) {
    throw new Error(`DEGRADE_INVALID_FAMILY: currentFamily 必须为非空字符串，得到 ${JSON.stringify(currentFamily)}`);
  }
  const sessionId = typeof opts.sessionId === 'string' && opts.sessionId.length > 0 ? opts.sessionId : null;

  if (sessionId) {
    const degradedCount = (degradationTraces.get(sessionId) ?? []).length;
    if (degradedCount >= DEGRADE_LIMIT_PER_SESSION) {
      // R3：超限上报 error 并终止流（避免降级风暴）；该次不执行降级、不追加轨迹
      const errorEvent = normalizeEvent({
        event: 'error',
        data: {
          code: 'DEGRADE_LIMIT_EXCEEDED',
          message: `会话 ${sessionId} 降级次数已达上限 ${DEGRADE_LIMIT_PER_SESSION}，终止流式降级（原始家族 ${currentFamily}）`,
          retryable: false
        }
      });
      return { terminate: true, errorEvent, degraded_count: degradedCount };
    }
  }

  if (errorClass === 'retryable_stream_error') {
    // §1.2：error{retryable:true} + 断点续传建议（宿主决策）；非降级策略，不入轨迹、不计降级次数
    const errorEvent = normalizeEvent({
      event: 'error',
      data: { code: 'STREAM_BROKEN', message: RESUME_HINT, retryable: true }
    });
    return {
      error_class: errorClass,
      strategy: null,
      action: 'emit_retryable_error',
      from_family: currentFamily,
      errorEvent,
      resume_hint: true,
      degraded: true
    };
  }

  let strategy;
  let toFamily;
  let notice;
  switch (errorClass) {
    case 'family_protocol_drift':
      strategy = 'fallback_adapter';
      toFamily = resolveFallbackFamily(currentFamily);
      break;
    case 'streaming_unsupported':
      strategy = 'non_stream_fallback';
      toFamily = null; // 整包响应（=3.4.x 行为），无降级目标家族
      notice = 'STREAM_UNSUPPORTED';
      break;
    case 'usage_missing':
      strategy = 'estimated_track';
      toFamily = null; // 估算轨接管（FP-008 finalizeBudgetStream 兜底）
      notice = 'USAGE_MISSING';
      break;
  }

  const record = {
    session_id: sessionId ?? 'global',
    from_family: currentFamily,
    to_family: toFamily ?? null,
    error_class: errorClass,
    strategy,
    degraded: true, // §2.1：下发事件标记 degraded=true（配合 markDegraded）
    ts: nowIso()
  };
  const traceIndex = sessionId ? appendTrace(sessionId, record) : -1; // 无会话时仅返回决策不记轨迹

  return {
    error_class: errorClass,
    strategy,
    from_family: currentFamily,
    ...(toFamily !== null ? { to_family: toFamily } : {}),
    ...(notice ? { notice } : {}),
    degraded: true,
    ...(sessionId ? { session_id: sessionId, trace_index: traceIndex } : {})
  };
}

/**
 * 降级标记注入（§3.1 步骤 5；R2：extra 合并透传不覆盖）
 *
 * 对事件流逐事件置 degraded=true，并在 extra.degradation 记录降级元信息
 * （from_family/to_family/error_class/ts）；事件原有 extra 字段全部保留（R2/T4）。
 *
 * @param {Object[]} pseEvents - PSE 事件数组
 * @param {{fromFamily:string, toFamily?:string|null, errorClass:string}} info
 * @returns {Object[]} 标记后的同一事件数组（原地修改，便于链式调用）
 */
export function markDegraded(pseEvents, { fromFamily, toFamily, errorClass }) {
  if (!Array.isArray(pseEvents)) {
    throw new Error(`DEGRADE_INVALID_INPUT: pseEvents 必须为数组，得到 ${typeof pseEvents}`);
  }
  for (const ev of pseEvents) {
    if (!ev || typeof ev !== 'object') continue;
    ev.degraded = true;
    ev.extra = {
      ...(ev.extra || {}),
      degradation: {
        from_family: fromFamily,
        to_family: toFamily ?? null,
        error_class: errorClass,
        ts: nowIso()
      }
    };
  }
  return pseEvents;
}

/**
 * 降级轨迹查询（§1.1；B3 可审计可回放）
 * @param {string} sessionId
 * @returns {Array<{session_id:string, from_family:string, to_family:string|null,
 *            error_class:string, strategy:string, degraded:boolean, ts:string}>} 按序深拷贝
 */
export function getDegradationTrace(sessionId) {
  const list = degradationTraces.get(sessionId);
  return list ? structuredClone(list) : [];
}

/**
 * 重置降级轨迹（测试/会话隔离用）
 * @param {string} [sessionId] - 缺省重置全部
 */
export function resetDegradationTrace(sessionId) {
  if (sessionId === undefined) {
    degradationTraces.clear();
    return;
  }
  degradationTraces.delete(sessionId);
}

/**
 * 兼容矩阵核对（I3：8+3 家族在 doc 05 §5.2 矩阵中的验证结论）
 * @returns {Array<{family:string, registered:boolean, fallback_family:string, conclusion:string}>}
 */
export function getCompatibilityMatrix() {
  const registered = ADAPTER_FAMILIES.map(family => ({
    family,
    registered: true,
    fallback_family: getAdapter(family).capabilities.fallback_family,
    conclusion: '独立适配器 + fallback_family 声明（契约测试覆盖）'
  }));
  const extensions = ['ernie', 'minimax', 'xai'].map(family => ({
    family,
    registered: false,
    fallback_family: 'openai',
    conclusion: '走 OpenAI 兼容降级链（R1 兜底，T2 阶段验证，不出独立适配器 §1.3）'
  }));
  return [...registered, ...extensions];
}

export default {
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
};
