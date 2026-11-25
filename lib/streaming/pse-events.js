// lib/streaming/pse-events.js - PSE 统一流式事件层（FP-TOKO-006 / doc 05 §4.1、§4.3、附录 B）
//
// 职责（FP-TOKO-006 §3.1 处理流程）：
//   1. 平台侧产物事件序列归一（normalizeEvent / buildEventStream）→ 2. 顺序约束
//   （T5：message_start 恒首、done/error 恒末）→ 3. SSE 编解码（renderSSE/parseSSE，T1 标准格式）→
//   4. usage 遥测写入 FP-TOKO-002 消耗记录（I1，006→002 写入方向）。
//
// 红线：
//   - R1：PSE 只承载平台侧产物流式化 + usage 遥测，不介入宿主与供应商生成链路；
//   - R2：既有 REST 17 端点字节级不变，/v1/stream 纯新增（api-routes.js additive 追加）；
//   - R3：未知事件类型不得静默丢弃——EVENT_MALFORMED 不下发，但原始载荷完整保留在
//     malformed 记录中（doc 05 §4.3 映射纪律：透传真，不丢弃）；
//   - R4：CLI（bin/pdd.js）行为不变。
//
// 前缀声明（§1.1）：既有端点 /api/v1/*，新增 /v1/stream 独立前缀为 doc 05 §4.6 有意设计。

import { recordConsumption } from '../token/estimation-track.js';

/** PSE 事件全集（§1.2/§2.2 枚举；budget.* 由 FP-TOKO-008 触发、compaction.suggested 由 FP-TOKO-012 触发） */
export const PSE_EVENTS = Object.freeze([
  'message_start',
  'content_delta',
  'reasoning_delta',
  'tool_delta',
  'usage',
  'budget.warning',
  'budget.tighten',
  'budget.stop_suggested',
  'compaction.suggested',
  'done',
  'error'
]);

/** usage.source 取值域（§2.2：实测优先，估算兜底） */
export const USAGE_SOURCES = Object.freeze(['measured', 'estimated']);

/** PSEEvent 公共字段（§2.1；其余原生字段一律透传 extra，禁止丢弃） */
const PSE_PUBLIC_FIELDS = Object.freeze(['event', 'data', 'ts', 'degraded']);

/** RFC3339 严格校验（与 FP-TOKO-002 同口径） */
const RFC3339_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

/** @private */
function isNonNegNum(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/** @private */
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * 事件 payload Schema 校验表（§1.2 每事件 payload 约束）
 * budget.* / compaction.suggested 的细化结构分别由 FP-TOKO-008 / FP-TOKO-012 落地，
 * 本层最小契约 = data 必须为对象（前向兼容：细化时只增校验不改形状）。
 * @private
 */
const PAYLOAD_VALIDATORS = {
  message_start(d, errors) {
    if (typeof d.id !== 'string' || d.id.length === 0) errors.push('id 必须为非空字符串');
    if (typeof d.family !== 'string' || d.family.length === 0) errors.push('family 必须为非空字符串');
    if (!isNonNegNum(d.context_tokens)) errors.push('context_tokens 必须为非负数字');
  },
  content_delta(d, errors) {
    if (typeof d.text !== 'string') errors.push('text 必须为字符串');
  },
  reasoning_delta(d, errors) {
    if (typeof d.text !== 'string') errors.push('text 必须为字符串');
    if (d.channel !== 'reasoning') errors.push('channel 必须为 "reasoning"');
  },
  tool_delta(d, errors) {
    if (typeof d.tool_id !== 'string' || d.tool_id.length === 0) errors.push('tool_id 必须为非空字符串');
    if (typeof d.name !== 'string' || d.name.length === 0) errors.push('name 必须为非空字符串');
    if (typeof d.args_fragment !== 'string') errors.push('args_fragment 必须为字符串');
  },
  usage(d, errors) {
    if (!isNonNegNum(d.input_tokens)) errors.push('input_tokens 必须为非负数字');
    if (!isNonNegNum(d.output_tokens)) errors.push('output_tokens 必须为非负数字');
    if (!USAGE_SOURCES.includes(d.source)) errors.push(`source 必须为 ${USAGE_SOURCES.join('/')}，得到 ${d.source}`);
    if (d.cached_tokens !== undefined && !isNonNegNum(d.cached_tokens)) errors.push('cached_tokens 必须为非负数字');
  },
  'budget.warning'(d, errors) { if (!isPlainObject(d)) errors.push('data 必须为对象'); },
  'budget.tighten'(d, errors) { if (!isPlainObject(d)) errors.push('data 必须为对象'); },
  'budget.stop_suggested'(d, errors) { if (!isPlainObject(d)) errors.push('data 必须为对象'); },
  'compaction.suggested'(d, errors) { if (!isPlainObject(d)) errors.push('data 必须为对象'); },
  done(d, errors) {
    if (typeof d.finish_reason !== 'string' || d.finish_reason.length === 0) errors.push('finish_reason 必须为非空字符串');
    if (!isPlainObject(d.usage_total)) errors.push('usage_total 必须为对象');
  },
  error(d, errors) {
    if (typeof d.code !== 'string' || d.code.length === 0) errors.push('code 必须为非空字符串');
    if (typeof d.message !== 'string') errors.push('message 必须为字符串');
    if (typeof d.retryable !== 'boolean') errors.push('retryable 必须为布尔值');
  }
};

/**
 * PSE 事件校验（normalizeEvent 的诊断视图；畸形原因明细）
 * @param {*} raw - 原始事件
 * @returns {{valid:boolean, errors:string[]}}
 */
export function validateEvent(raw) {
  const errors = [];
  if (!isPlainObject(raw)) {
    return { valid: false, errors: ['事件必须为对象'] };
  }
  if (!PSE_EVENTS.includes(raw.event)) {
    errors.push(`event 必须为 PSE_EVENTS 全集成员，得到 ${JSON.stringify(raw.event)}`);
    return { valid: false, errors };
  }
  if (!isPlainObject(raw.data)) {
    errors.push(`data 必须为对象，得到 ${raw.data === null ? 'null' : Array.isArray(raw.data) ? 'array' : typeof raw.data}`);
    return { valid: false, errors };
  }
  if (raw.ts !== undefined && (typeof raw.ts !== 'string' || !RFC3339_RE.test(raw.ts))) {
    errors.push(`ts 必须为 RFC3339 时间字符串，得到 ${JSON.stringify(raw.ts)}`);
  }
  if (raw.degraded !== undefined && typeof raw.degraded !== 'boolean') {
    errors.push(`degraded 必须为布尔值，得到 ${typeof raw.degraded}`);
  }
  const validator = PAYLOAD_VALIDATORS[raw.event];
  if (validator) validator(raw.data, errors);
  return { valid: errors.length === 0, errors };
}

/**
 * 归一单事件为 PSEEvent（§2.1）
 *
 * - 公共字段：ts 缺省补当前时间（RFC3339）、degraded 缺省 false；
 * - R3/T2 透传纪律：raw 中未映射字段全部进 extra（structuredClone 保真），禁止丢弃；
 * - 畸形（不含枚举成员/data 非对象/payload 违例/ts 或 degraded 非法）→ 返回 null，
 *   交由 buildEventStream 按 EVENT_MALFORMED 记录（不下发、不静默）。
 *
 * @param {*} raw - 原始事件
 * @returns {Object|null} PSEEvent 或 null（EVENT_MALFORMED）
 */
export function normalizeEvent(raw) {
  const check = validateEvent(raw);
  if (!check.valid) return null;

  const extraSrc = { ...raw };
  for (const key of PSE_PUBLIC_FIELDS) delete extraSrc[key];
  const extraKeys = Object.keys(extraSrc);

  const pseEvent = {
    event: raw.event,
    data: structuredClone(raw.data),
    ts: raw.ts !== undefined ? raw.ts : new Date().toISOString(),
    degraded: raw.degraded !== undefined ? raw.degraded : false
  };
  if (extraKeys.length > 0) {
    pseEvent.extra = structuredClone(extraSrc); // R3：原生字段透传区（前向兼容）
  }
  return pseEvent;
}

/**
 * 组装 PSE 事件流（§3.1 步骤 2 + T5 顺序约束 + I1 usage 写入）
 *
 * 顺序约束（§3.3 状态转换）：
 * - message_start 恒为首事件：首事件非 message_start 时自动前置合成；
 * - done/error 恒为末事件：error 之后的事件截断记录（异常收尾优先，TRUNCATED_AFTER_ERROR）；
 *   无 error 时 done 之后事件截断；整流缺失收尾时自动补 done。
 *
 * I1（006→002 写入方向）：opts.sessionId/phase 提供时，usage 事件写入 FP-TOKO-002
 * 消耗记录——measured 记录 tokens_measured=output_tokens（R1 主值）、estimated 记录
 * tokens_est=output_tokens（估算轨）；tokens_est 对 measured 记录取同值（usage 事件无独立估算值，偏差恒 0）。
 *
 * @param {Array} rawEvents - 原始事件数组
 * @param {{sessionId?:string, phase?:string, family?:string, id?:string, context_tokens?:number}} [opts]
 * @returns {{events:Object[], malformed:Array<{index:number,reason:string,detail?:string,raw:*}>, usage_recorded:number}}
 * @throws {Error} EVENT_MALFORMED（rawEvents 非数组）
 */
export function buildEventStream(rawEvents, opts = {}) {
  if (!Array.isArray(rawEvents)) {
    throw new Error(`EVENT_MALFORMED: rawEvents 必须为数组，得到 ${typeof rawEvents}`);
  }

  const events = [];
  const malformed = [];
  rawEvents.forEach((raw, index) => {
    const normalized = normalizeEvent(raw);
    if (normalized === null) {
      // R3：不下发但完整保留原始载荷（不静默丢弃）
      const check = validateEvent(raw);
      malformed.push({ index, reason: 'EVENT_MALFORMED', detail: check.errors.join('; '), raw: structuredClone(raw) });
      return;
    }
    events.push({ normalized, rawIndex: index });
  });

  // T5 首事件：message_start 恒为首
  if (events.length === 0 || events[0].normalized.event !== 'message_start') {
    const synthesized = normalizeEvent({
      event: 'message_start',
      data: {
        id: opts.id || 'pse-stream',
        family: opts.family || 'openai(fallback)',
        context_tokens: opts.context_tokens !== undefined ? opts.context_tokens : 0
      }
    });
    events.unshift({ normalized: synthesized, rawIndex: -1 });
  }

  // T5 末事件：error 收尾优先（异常截断），其次 done 截断
  const errorIdx = events.findIndex(e => e.normalized.event === 'error');
  const doneIdx = events.findIndex(e => e.normalized.event === 'done');
  const terminalIdx = errorIdx >= 0 ? errorIdx : doneIdx;
  if (terminalIdx >= 0 && terminalIdx < events.length - 1) {
    const truncated = events.splice(terminalIdx + 1);
    for (const t of truncated) {
      malformed.push({
        index: t.rawIndex,
        reason: errorIdx >= 0 ? 'TRUNCATED_AFTER_ERROR' : 'TRUNCATED_AFTER_DONE',
        detail: errorIdx >= 0 ? '异常收尾后事件不再下发（error 恒为末事件）' : 'done 之后事件不再下发（done 恒为末事件）',
        raw: structuredClone(rawEvents[t.rawIndex])
      });
    }
  }

  // 缺失收尾 → 自动补 done（§3.3 正常收尾）
  const lastEvent = events[events.length - 1].normalized.event;
  if (lastEvent !== 'done' && lastEvent !== 'error') {
    const synthesized = normalizeEvent({
      event: 'done',
      data: { finish_reason: 'complete', usage_total: {} }
    });
    events.push({ normalized: synthesized, rawIndex: -1 });
  }

  // I1：usage 事件写入 FP-TOKO-002 消耗记录（006→002 写入方向）
  let usageRecorded = 0;
  if (opts.sessionId && opts.phase) {
    const family = opts.family || 'openai(fallback)';
    for (const { normalized } of events) {
      if (normalized.event !== 'usage') continue;
      try {
        const record = {
          session_id: opts.sessionId,
          phase: opts.phase,
          tokens_est: normalized.data.output_tokens,
          source: normalized.data.source,
          content_type: 'mixed',
          family,
          ts: normalized.ts // §2.1：consumption-record 必带 RFC3339 ts（透传事件时间戳，保证时序一致）
        };
        if (normalized.data.source === 'measured') {
          record.tokens_measured = normalized.data.output_tokens; // FP-002 R1：measured 主值
        }
        recordConsumption(record);
        usageRecorded++;
      } catch (err) {
        // 写入失败不阻断流（遥测尽力而为）；recordConsumption 内部已 WARN
        malformed.push({ index: -1, reason: 'USAGE_WRITE_FAILED', detail: err.message, raw: null });
      }
    }
  }

  return {
    events: events.map(e => e.normalized),
    malformed,
    usage_recorded: usageRecorded
  };
}

// ==================== SSE 编解码（T1：标准格式） ====================

/**
 * 渲染 SSE 文本（text/event-stream 规范：event:/data: 行 + 空行分隔）
 * @param {Array<Object>} events - PSEEvent 数组
 * @returns {string}
 */
export function renderSSE(events) {
  return events
    .map(ev => `event: ${ev.event}\ndata: ${JSON.stringify(ev)}\n\n`)
    .join('');
}

/**
 * 解析 SSE 文本（标准 SSE 客户端解析口径：data 多行以 \n 拼接、忽略注释/逐出字段）
 * @param {string} text
 * @returns {Array<{event:string, data:*}>}
 */
export function parseSSE(text) {
  const parsed = [];
  for (const block of String(text).split(/\r?\n\r?\n/)) {
    let eventName = null;
    const dataLines = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith(':') || line.length === 0) continue; // 注释/空行
      if (line.startsWith('event:')) eventName = line.slice(6).trimStart();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
      // id:/retry: 等逐出字段忽略（不影响事件解析）
    }
    if (eventName === null || dataLines.length === 0) continue;
    const dataRaw = dataLines.join('\n');
    let data;
    try {
      data = JSON.parse(dataRaw);
    } catch {
      data = dataRaw; // 非 JSON data 按原文（SSE 规范允许）
    }
    parsed.push({ event: eventName, data });
  }
  return parsed;
}

export default {
  PSE_EVENTS,
  USAGE_SOURCES,
  validateEvent,
  normalizeEvent,
  buildEventStream,
  renderSSE,
  parseSSE
};
