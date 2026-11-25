// lib/streaming/adapters/index.js - MSSA 适配器注册表（FP-TOKO-007 / doc 05 §4.2）
//
// 职责：
//   1. 8 家族适配器注册与查询（getAdapter/listAdapters）；
//   2. UnknownEvent 计数（§1.4：normalize 遇未映射原生事件 → 计数并可查询，T3）；
//   3. 阈值观测与降级建议（≥ UNKNOWN_EVENT_THRESHOLD → degrade_suggested=true 并记录建议，
//      error_class=family_protocol_drift，供 FP-TOKO-010 classify/degrade 消费，I2）；
//   4. 流级归一 normalizeStream（未映射事件载荷经 extra.unknown_events 带内透传，不静默丢弃）。
//
// 红线：
//   - 适配器对象只读消费，注册表不改写其任何成员；
//   - 计数与建议为进程内存态（与 FP-TOKO-002 R4 同口径，不落盘）。

import { FAMILIES } from '../profiles/index.js';
import { adapter as openaiAdapter } from './openai/index.js';
import { adapter as anthropicAdapter } from './anthropic/index.js';
import { adapter as geminiAdapter } from './gemini/index.js';
import { adapter as deepseekAdapter } from './deepseek/index.js';
import { adapter as qwenAdapter } from './qwen/index.js';
import { adapter as glmAdapter } from './glm/index.js';
import { adapter as kimiAdapter } from './kimi/index.js';
import { adapter as doubaoAdapter } from './doubao/index.js';
import { isPlainObject } from './shared/adapter-kit.js';

/** 已注册家族（与 FP-TOKO-001 FAMILIES 对齐，B1） */
export const ADAPTER_FAMILIES = Object.freeze([...FAMILIES]);

/** UnknownEvent 累计阈值（§1.4/§3.3：累计≥阈值触发降级上报；FP-010 family_protocol_drift） */
export const UNKNOWN_EVENT_THRESHOLD = 10;

const ADAPTERS = new Map([
  ['openai', openaiAdapter],
  ['anthropic', anthropicAdapter],
  ['gemini', geminiAdapter],
  ['deepseek', deepseekAdapter],
  ['qwen', qwenAdapter],
  ['glm', glmAdapter],
  ['kimi', kimiAdapter],
  ['doubao', doubaoAdapter]
]);

/** UnknownEvent 计数与降级建议（key = `${family}::${sessionId}`，sessionId 缺省 'global'） */
const unknownCounters = new Map();
const degradeSuggestions = new Map();

/** @private */
function counterKey(family, sessionId) {
  return `${family}::${sessionId || 'global'}`;
}

/**
 * 查询适配器（§1.1）
 * @param {string} family
 * @returns {Object} MSSA 适配器
 * @throws {Error} ADAPTER_NOT_FOUND
 */
export function getAdapter(family) {
  const adapter = ADAPTERS.get(family);
  if (!adapter) {
    throw new Error(`ADAPTER_NOT_FOUND: 未注册的模型家族 ${JSON.stringify(family)}，已注册：${ADAPTER_FAMILIES.join('/')}`);
  }
  return adapter;
}

/**
 * 列出全部适配器摘要（B1 清单核对）
 * @returns {Array<{family:string, capabilities:Object, meta:Object}>}
 */
export function listAdapters() {
  return ADAPTER_FAMILIES.map(family => {
    const adapter = ADAPTERS.get(family);
    return { family, capabilities: adapter.capabilities, meta: adapter.meta };
  });
}

/**
 * UnknownEvent 统计（T3：累计计数可查询；I2：degrade_suggested 供 FP-010 消费）
 * @param {string} family
 * @param {string} [sessionId='global']
 * @returns {{family:string, session_id:string, count:number, threshold:number, degrade_suggested:boolean, suggestion?:Object}}
 */
export function getUnknownEventStats(family, sessionId) {
  const key = counterKey(family, sessionId);
  const counter = unknownCounters.get(key);
  const count = counter?.count ?? 0;
  const stats = {
    family,
    session_id: sessionId || 'global',
    count,
    threshold: UNKNOWN_EVENT_THRESHOLD,
    degrade_suggested: count >= UNKNOWN_EVENT_THRESHOLD
  };
  const suggestion = degradeSuggestions.get(key);
  if (suggestion) stats.suggestion = suggestion;
  return stats;
}

/**
 * 重置 UnknownEvent 计数与降级建议（测试/会话隔离用）
 * @param {string} [family] - 缺省重置全部
 * @param {string} [sessionId]
 */
export function resetUnknownEventStats(family, sessionId) {
  if (family === undefined) {
    unknownCounters.clear();
    degradeSuggestions.clear();
    return;
  }
  const key = counterKey(family, sessionId);
  unknownCounters.delete(key);
  degradeSuggestions.delete(key);
}

/**
 * 读取降级建议（FP-010 接缝：error_class=family_protocol_drift）
 * @param {string} [family] - 缺省返回全部
 * @returns {Array<Object>}
 */
export function getDegradeSuggestions(family) {
  const out = [];
  for (const [key, suggestion] of degradeSuggestions) {
    if (family === undefined || key.startsWith(`${family}::`)) out.push({ ...suggestion });
  }
  return out;
}

/** @private 计数并在跨阈值时记录降级建议（仅首次跨越时 WARN，避免刷屏） */
function countUnknown(family, sessionId, raw) {
  const key = counterKey(family, sessionId);
  const counter = unknownCounters.get(key) ?? { count: 0, warned: false };
  counter.count += 1;
  unknownCounters.set(key, counter);
  if (counter.count >= UNKNOWN_EVENT_THRESHOLD && !counter.warned) {
    counter.warned = true;
    const suggestion = {
      family,
      session_id: sessionId || 'global',
      error_class: 'family_protocol_drift',
      count: counter.count,
      threshold: UNKNOWN_EVENT_THRESHOLD,
      degraded: true,
      ts: new Date().toISOString(),
      last_unknown_raw: structuredClone(raw)
    };
    degradeSuggestions.set(key, suggestion);
    console.warn(`[UNKNOWN_EVENT_THRESHOLD] ${family}（session=${suggestion.session_id}）未映射事件累计 ${counter.count} ≥ 阈值 ${UNKNOWN_EVENT_THRESHOLD}，建议降级 fallback_family=openai（FP-TOKO-010 family_protocol_drift）`);
  }
  return counter.count;
}

/**
 * 单事件归一 + UnknownEvent 计数（§3.1 步骤 2/4）
 * @param {string} family
 * @param {*} rawEvent
 * @param {{sessionId?:string}} [opts]
 * @returns {{events:Object[], kind:'mapped'|'ignored'|'unknown', stats:Object}}
 * @throws {Error} ADAPTER_NOT_FOUND
 */
export function normalizeWithAdapter(family, rawEvent, opts = {}) {
  const adapter = getAdapter(family);
  const { events, kind } = adapter.normalizeDetailed(rawEvent);
  if (kind === 'unknown') countUnknown(family, opts.sessionId, rawEvent);
  return { events, kind, stats: getUnknownEventStats(family, opts.sessionId) };
}

/**
 * 流级归一（§3.1 步骤 1→4：原生事件数组 → PSE 事件流）
 *
 * - 未映射事件计数并保留（unknown 数组完整保留原始载荷）；
 * - 带内透传：unknown 载荷挂载到其后首个映射事件的 extra.unknown_events；
 *   流尾无后续事件时挂载到最后一个映射事件；完全无映射事件时仅在 unknown 中保留；
 * - 回放前重置适配器分片状态（toolState/blockMap/toolSeq），保证幂等回放。
 *
 * @param {Array} rawEvents - 原生事件数组（SSE data 行 JSON 解析产物）
 * @param {string} family
 * @param {{sessionId?:string, threshold?:number}} [opts] - threshold 仅用于结果标注（阈值常量为注册表级）
 * @returns {{events:Object[], unknown:Array<{index:number,raw:*}>, stats:Object}}
 * @throws {Error} ADAPTER_NOT_FOUND / ADAPTER_INVALID_INPUT
 */
export function normalizeStream(rawEvents, family, opts = {}) {
  if (!Array.isArray(rawEvents)) {
    throw new Error(`ADAPTER_INVALID_INPUT: rawEvents 必须为数组，得到 ${typeof rawEvents}`);
  }
  const adapter = getAdapter(family);
  adapter.resetStreamState?.();

  const events = [];
  const unknown = [];
  let pendingUnknown = [];

  rawEvents.forEach((raw, index) => {
    const { events: mapped, kind } = adapter.normalizeDetailed(raw);
    if (kind === 'unknown') {
      countUnknown(family, opts.sessionId, raw);
      unknown.push({ index, raw: isPlainObject(raw) || Array.isArray(raw) ? structuredClone(raw) : raw });
      pendingUnknown.push(isPlainObject(raw) || Array.isArray(raw) ? structuredClone(raw) : raw);
      return;
    }
    for (const ev of mapped) {
      if (pendingUnknown.length > 0) {
        ev.extra = { ...(ev.extra || {}), unknown_events: pendingUnknown };
        pendingUnknown = [];
      }
      events.push(ev);
    }
  });

  // 流尾兜底：pending unknown 挂载到最后一个映射事件（带内透传，不静默）
  if (pendingUnknown.length > 0 && events.length > 0) {
    const last = events[events.length - 1];
    last.extra = { ...(last.extra || {}), unknown_events: pendingUnknown };
    pendingUnknown = [];
  }

  const stats = getUnknownEventStats(family, opts.sessionId);
  return { events, unknown, stats };
}

export default {
  ADAPTER_FAMILIES,
  UNKNOWN_EVENT_THRESHOLD,
  getAdapter,
  listAdapters,
  normalizeWithAdapter,
  normalizeStream,
  getUnknownEventStats,
  resetUnknownEventStats,
  getDegradeSuggestions
};
