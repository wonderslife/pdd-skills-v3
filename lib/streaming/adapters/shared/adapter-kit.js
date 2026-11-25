// lib/streaming/adapters/shared/adapter-kit.js - MSSA 适配器公共工具（FP-TOKO-007 / doc 05 §4.2、§4.4）
//
// 职责：
//   1. AdapterCapabilities 枚举校验与派生（§1.3，数值锚定 FP-TOKO-001 profile，R4）；
//   2. 透传纪律工具 splitExtra（R2：未覆盖字段一律进 extra，禁止丢弃）；
//   3. 能力一致性审计 auditCapabilityConsistency（T4：声明与 profile/实测行为不符 → CAPABILITY_MISMATCH）；
//   4. 插件包装类工厂 createAdapterPlugin（§1.2 打包约定：plugin.json provides=mssa-adapter，
//      复用现有插件加载器 PluginManager，B2 加载冒烟）。
//
// 红线：
//   - R3：适配器独立版本（meta.adapter_version），PSE 规范版本不受供应商 API 变更影响；
//   - 既有插件机制只读消费（plugin-sdk 仅 import，不改其任何导出）。

import { PluginBase } from '../../../plugin/plugin-sdk.js';
import { loadProfile } from '../../profiles/index.js';

/** §1.3 枚举值域 */
export const TOOL_CALL_STREAMING_MODES = Object.freeze(['incremental', 'aggregated', 'none']);
export const REASONING_CHANNELS = Object.freeze(['dedicated_field', 'interleaved', 'none']);
export const USAGE_REPORTING_MODES = Object.freeze(['tail_chunk', 'start_and_delta', 'in_stream', 'unsupported']);
export const SSE_TRANSPORTS = Object.freeze(['openai-style', 'mcp-streamable-http']);

/** @private */
export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * R2/T2 透传纪律：从原始对象中剥离已消费键，剩余键打包为 extra
 * @param {Object} raw - 原始对象
 * @param {string[]} consumedKeys - 映射已消费的键
 * @returns {Object|null} 剩余字段对象（无剩余时返回 null）
 */
export function splitExtra(raw, consumedKeys) {
  if (!isPlainObject(raw)) return null;
  const leftover = {};
  for (const key of Object.keys(raw)) {
    if (!consumedKeys.includes(key)) leftover[key] = raw[key];
  }
  return Object.keys(leftover).length > 0 ? leftover : null;
}

/**
 * 从 FP-TOKO-001 profile 派生 AdapterCapabilities（§1.3；数值锚定 profile，T4）
 *
 * 口径映射（profile.reasoning_channel / usage_semantics → §1.3 枚举）：
 *   - thinking_block → dedicated_field（thinking 独立块/字段）
 *   - openai-compatible-tail → tail_chunk；anthropic-start-and-delta → start_and_delta；
 *     gemini-in-stream → in_stream
 *
 * @param {Object} profile - FP-TOKO-001 profile（loadProfile 产物）
 * @param {{toolCallStreaming:string, sseTransport?:string, fallbackFamily?:string}} config
 * @returns {Object} AdapterCapabilities
 */
export function deriveCapabilities(profile, { toolCallStreaming, sseTransport = 'openai-style', fallbackFamily = 'openai' } = {}) {
  const reasoningMap = { dedicated_field: 'dedicated_field', thinking_block: 'dedicated_field', interleaved: 'interleaved', none: 'none' };
  const usageMap = {
    'openai-compatible-tail': 'tail_chunk',
    'anthropic-start-and-delta': 'start_and_delta',
    'gemini-in-stream': 'in_stream'
  };
  return {
    streaming: true,
    tool_call_streaming: toolCallStreaming,
    reasoning_channel: reasoningMap[profile.reasoning_channel] ?? 'none',
    usage_reporting: usageMap[profile.usage_semantics] ?? 'unsupported',
    prefix_cache: {
      billing_multiplier: profile.prefix_cache?.billing,
      min_tokens: profile.prefix_cache?.min_tokens
    },
    max_context: profile.context_window,
    sse_transport: sseTransport,
    fallback_family: fallbackFamily
  };
}

/**
 * T4 能力一致性审计：capabilities 声明与 FP-001 profile / 实际行为不符 → CAPABILITY_MISMATCH
 * （§1.4：契约测试失败，禁止发布该适配器）
 *
 * @param {Object} adapter - MSSA 适配器对象
 * @returns {{ok:true, family:string}}
 * @throws {Error} CAPABILITY_MISMATCH（err.code / err.reasons）
 */
export function auditCapabilityConsistency(adapter) {
  const reasons = [];
  const c = adapter.capabilities || {};
  const family = adapter.family;

  if (!TOOL_CALL_STREAMING_MODES.includes(c.tool_call_streaming)) {
    reasons.push(`tool_call_streaming 必须为 ${TOOL_CALL_STREAMING_MODES.join('/')}，得到 ${c.tool_call_streaming}`);
  }
  if (!REASONING_CHANNELS.includes(c.reasoning_channel)) {
    reasons.push(`reasoning_channel 必须为 ${REASONING_CHANNELS.join('/')}，得到 ${c.reasoning_channel}`);
  }
  if (!USAGE_REPORTING_MODES.includes(c.usage_reporting)) {
    reasons.push(`usage_reporting 必须为 ${USAGE_REPORTING_MODES.join('/')}，得到 ${c.usage_reporting}`);
  }
  if (!SSE_TRANSPORTS.includes(c.sse_transport)) {
    reasons.push(`sse_transport 必须为 ${SSE_TRANSPORTS.join('/')}，得到 ${c.sse_transport}`);
  }
  if (c.streaming !== true) {
    reasons.push('streaming 必须为 true（非流式走 FP-010 streaming_unsupported 整包回退，适配器仅声明流式家族）');
  }
  if (c.fallback_family !== 'openai') {
    reasons.push(`fallback_family 必须为 openai（FP-010 R1：OpenAI 兼容兜底），得到 ${c.fallback_family}`);
  }

  // 数值锚定 FP-TOKO-001 profile（T4/T5）
  const profile = loadProfile(family);
  if (c.prefix_cache?.billing_multiplier !== profile.prefix_cache?.billing) {
    reasons.push(`prefix_cache.billing_multiplier=${c.prefix_cache?.billing_multiplier} 与 profile.prefix_cache.billing=${profile.prefix_cache?.billing} 不一致`);
  }
  if (c.prefix_cache?.min_tokens !== profile.prefix_cache?.min_tokens) {
    reasons.push(`prefix_cache.min_tokens=${c.prefix_cache?.min_tokens} 与 profile.prefix_cache.min_tokens=${profile.prefix_cache?.min_tokens} 不一致`);
  }
  if (c.max_context !== profile.context_window) {
    reasons.push(`max_context=${c.max_context} 与 profile.context_window=${profile.context_window} 不一致`);
  }
  const derived = deriveCapabilities(profile, {
    toolCallStreaming: c.tool_call_streaming,
    sseTransport: c.sse_transport,
    fallbackFamily: c.fallback_family
  });
  if (c.reasoning_channel !== derived.reasoning_channel) {
    reasons.push(`reasoning_channel=${c.reasoning_channel} 与 profile.reasoning_channel=${profile.reasoning_channel} 派生值 ${derived.reasoning_channel} 不一致`);
  }
  if (c.usage_reporting !== derived.usage_reporting) {
    reasons.push(`usage_reporting=${c.usage_reporting} 与 profile.usage_semantics=${profile.usage_semantics} 派生值 ${derived.usage_reporting} 不一致`);
  }

  if (reasons.length > 0) {
    const err = new Error(`CAPABILITY_MISMATCH: ${family} 能力声明与 FP-TOKO-001 profile/实际行为不符 — ${reasons.join('; ')}`);
    err.code = 'CAPABILITY_MISMATCH';
    err.reasons = reasons;
    throw err;
  }
  return { ok: true, family };
}

/**
 * SPI 形状校验（§1.1：family/capabilities/normalize/estimateTokens/assemblyHints）
 * @param {Object} adapter
 * @throws {Error} ADAPTER_SHAPE_INVALID
 */
export function validateAdapterShape(adapter) {
  const missing = [];
  if (typeof adapter?.family !== 'string' || adapter.family.length === 0) missing.push('family');
  if (!isPlainObject(adapter?.capabilities)) missing.push('capabilities');
  if (typeof adapter?.normalize !== 'function') missing.push('normalize');
  if (typeof adapter?.estimateTokens !== 'function') missing.push('estimateTokens');
  if (typeof adapter?.assemblyHints !== 'function') missing.push('assemblyHints');
  if (missing.length > 0) {
    throw new Error(`ADAPTER_SHAPE_INVALID: 适配器缺少 SPI 必备成员 — ${missing.join(', ')}`);
  }
  return { ok: true, family: adapter.family };
}

/**
 * 插件包装类工厂（§1.2 B2：默认导出 PluginBase 子类，供现有插件加载器 PluginManager 加载）
 *
 * @param {Object} adapter - MSSA 适配器对象
 * @param {{version:string, tested_at:string, upstream_version:string}} meta
 * @returns {Function} PluginBase 子类（default export 约定）
 */
export function createAdapterPlugin(adapter, meta) {
  const family = adapter.family;
  const MSSAAdapterPlugin = class extends PluginBase {
    constructor() {
      super({
        name: `mssa-adapter-${family}`,
        version: meta.version,
        description: `MSSA 模型流式适配器：${family}（provides=mssa-adapter）`,
        author: 'PDD Team',
        license: 'MIT',
        keywords: ['mssa', 'adapter', family],
        pddVersionRange: '>=3.4.0'
      });
      this.adapter = adapter;
      this.mssaMeta = meta;
    }

    async onActivate(context) {
      const logger = context?.logger ?? { info: () => {} };
      logger.info(`[mssa-adapter-${family}] 就绪（upstream=${meta.upstream_version}, tested_at=${meta.tested_at}, PSE 规范版本独立于本适配器版本 ${meta.version}）`);
    }
  };
  Object.defineProperty(MSSAAdapterPlugin, 'name', { value: `MSSAAdapterPlugin(${family})` });
  return MSSAAdapterPlugin;
}

export default {
  TOOL_CALL_STREAMING_MODES,
  REASONING_CHANNELS,
  USAGE_REPORTING_MODES,
  SSE_TRANSPORTS,
  isPlainObject,
  splitExtra,
  deriveCapabilities,
  auditCapabilityConsistency,
  validateAdapterShape,
  createAdapterPlugin
};
