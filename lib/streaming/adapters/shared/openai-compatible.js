// lib/streaming/adapters/shared/openai-compatible.js - OpenAI 兼容信封通用映射引擎（FP-TOKO-007 §2.1）
//
// 覆盖家族：openai（delta.reasoning）/ deepseek（delta.reasoning_content）/ glm（delta.thinking）/
//           kimi（delta.reasoning_content，部分模型）/ doubao（delta.reasoning_content + 方舟扩展）/
//           qwen（DashScope 信封：output.text / output.reasoning_content|thinking）
//
// 映射纪律（§3.2）：
//   - R2/T2：未覆盖字段透传 extra（顶层剩余 → 全部事件 extra；delta 剩余 → delta 事件 extra.usage；
//     usage 剩余 → usage 事件 extra.usage），禁止丢弃；
//   - R4/T5：estimateTokens 必须经 FP-TOKO-001 profile（复用 FP-TOKO-002 estimateTokens，不自造系数）；
//   - usage 一律 source='measured'（供应商实测口径）；
//   - OpenAI data 行哨兵 "[DONE]"（字符串）识别为 ignored，不计 UnknownEvent。

import { loadProfile } from '../../profiles/index.js';
import { estimateTokens as trackEstimateTokens } from '../../../token/estimation-track.js';
import { deriveCapabilities, splitExtra, isPlainObject, validateAdapterShape } from './adapter-kit.js';

/** openai 信封顶层已消费键（仅真正映射进 PSE 的键；其余 → extra，R2/T2） */
const OPENAI_CONSUMED = ['choices', 'usage'];
/** dashscope 信封顶层已消费键 */
const DASHSCOPE_CONSUMED = ['output', 'usage'];
/** delta 层已消费键（其余 → extra.delta，如 role） */
const DELTA_CONSUMED = ['content', 'tool_calls'];
/** usage 层已消费键（其余 → extra.usage，如 total_tokens / details 对象 / 缓存明细） */
const USAGE_CONSUMED = ['prompt_tokens', 'completion_tokens', 'input_tokens', 'output_tokens'];
/** dashscope output 层已消费键（其余 → extra.output） */
const OUTPUT_CONSUMED = ['text', 'reasoning_content', 'thinking', 'tool_calls', 'finish_reason', 'choices', 'message'];

/**
 * 创建 OpenAI 兼容（或 DashScope）信封适配器
 *
 * @param {Object} config
 * @param {string} config.family - 家族标识（须为 FP-001 已登记家族）
 * @param {'openai'|'dashscope'} [config.envelope='openai'] - 信封形态
 * @param {string|null} [config.reasoningField=null] - delta 推理字段名（openai 信封）
 * @param {boolean} [config.partialReasoning=false] - 部分模型支持推理通道（kimi：映射表显式标注"部分"）
 * @param {string} config.toolCallStreaming - §1.3 tool_call_streaming 声明
 * @param {string} [config.sseTransport='openai-style'] - §1.3 sse_transport 声明
 * @param {string} config.adapterVersion - 适配器独立版本（R3）
 * @param {string} config.testedAt - 夹具测试日期（ISO 日期）
 * @param {string} config.upstreamVersion - 上游 API 版本说明
 * @returns {Object} MSSA 适配器（§1.1 SPI + normalizeDetailed/resetStreamState 内部扩展）
 */
export function createOpenAICompatibleAdapter(config) {
  const profile = loadProfile(config.family);
  const capabilities = deriveCapabilities(profile, config);
  const meta = {
    family: config.family,
    version: config.adapterVersion,
    tested_at: config.testedAt,
    upstream_version: config.upstreamVersion,
    sample_source: 'synthetic'
  };

  /** 工具调用状态（index → {id,name}），用于增量分片补齐 id/name */
  const toolState = new Map();

  function resetStreamState() {
    toolState.clear();
  }

  /** usage 对象 → PSE usage payload（含 cached_tokens 探测链） */
  function buildUsageData(usage) {
    const inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
    const outputTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;
    const cached = usage.prompt_tokens_details?.cached_tokens
      ?? usage.completion_tokens_details?.cached_tokens
      ?? usage.input_tokens_details?.cached_tokens
      ?? usage.prompt_cache_hit_tokens;
    const data = { input_tokens: inputTokens, output_tokens: outputTokens, source: 'measured' };
    if (typeof cached === 'number' && Number.isFinite(cached) && cached >= 0) data.cached_tokens = cached;
    return data;
  }

  /** usage 对象 → done.usage_total */
  function buildUsageTotal(usage) {
    if (!isPlainObject(usage)) return {};
    return {
      input_tokens: usage.prompt_tokens ?? usage.input_tokens ?? 0,
      output_tokens: usage.completion_tokens ?? usage.output_tokens ?? 0
    };
  }

  /**
   * 详细归一：SPI normalize 的内部视图（kind 供 registry 计数 UnknownEvent）
   * @param {*} raw - 原生事件（SSE data 行 JSON 解析产物）
   * @returns {{events:Object[], kind:'mapped'|'ignored'|'unknown'}}
   */
  function normalizeDetailed(raw) {
    // 哨兵与异形输入
    if (typeof raw === 'string') {
      return { events: [], kind: raw.trim() === '[DONE]' ? 'ignored' : 'unknown' };
    }
    if (!isPlainObject(raw)) {
      return { events: [], kind: 'unknown' };
    }

    const isDash = config.envelope === 'dashscope';
    const recognized = isDash
      ? (isPlainObject(raw.output) || isPlainObject(raw.usage))
      : (Array.isArray(raw.choices) || isPlainObject(raw.usage));
    if (!recognized) {
      return { events: [], kind: 'unknown' };
    }

    const events = [];
    const baseExtra = isDash ? splitExtra(raw, DASHSCOPE_CONSUMED) : splitExtra(raw, OPENAI_CONSUMED);
    let deltaLeftover = null;
    let usageLeftover = null;
    // 收尾信息延后推送：同一 chunk 同时携带 usage 与 finish_reason 时，保证 T5（done 恒末）
    let finishReason = null;
    let finishUsageTotal = {};

    /** 追加事件：baseExtra 恒附加；extraPatch 仅附加到本事件 */
    const push = (event, data, extraPatch) => {
      const ev = { event, data };
      const extra = { ...(baseExtra || {}), ...(extraPatch || {}) };
      if (Object.keys(extra).length > 0) ev.extra = extra;
      events.push(ev);
    };

    if (isDash) {
      // ---- DashScope 信封（qwen 原生形态）----
      const out = raw.output;
      if (out) {
        if (typeof out.text === 'string') push('content_delta', { text: out.text }, deltaLeftoverPatch(out));
        const reasoning = typeof out.reasoning_content === 'string' ? out.reasoning_content : (typeof out.thinking === 'string' ? out.thinking : null);
        if (reasoning !== null) push('reasoning_delta', { text: reasoning, channel: 'reasoning' }, deltaLeftoverPatch(out));
        const calls = Array.isArray(out.tool_calls)
          ? out.tool_calls
          : (Array.isArray(out.choices?.[0]?.message?.tool_calls) ? out.choices[0].message.tool_calls : null);
        if (calls) {
          calls.forEach((tc, i) => {
            const name = tc.function?.name ?? tc.name;
            if (typeof name !== 'string' || name.length === 0) return; // 无名调用不可映射（数据不完整，丢弃前保留于 extra.output）
            const args = tc.function?.arguments ?? tc.arguments;
            push('tool_delta', {
              tool_id: typeof tc.id === 'string' && tc.id.length > 0 ? tc.id : `qwen-call-${tc.index ?? i}`,
              name,
              args_fragment: typeof args === 'string' ? args : JSON.stringify(args ?? {})
            }, deltaLeftoverPatch(out));
          });
        }
        if (out.finish_reason !== undefined && out.finish_reason !== null) {
          finishReason = String(out.finish_reason);
          finishUsageTotal = buildUsageTotal(raw.usage);
        }
      }
    } else {
      // ---- OpenAI 信封（choices[].delta）----
      const choice = Array.isArray(raw.choices) ? raw.choices[0] : null;
      const delta = choice?.delta;
      if (isPlainObject(delta)) {
        deltaLeftover = splitExtra(delta, config.reasoningField ? [...DELTA_CONSUMED, config.reasoningField] : DELTA_CONSUMED);
        if (typeof delta.content === 'string') push('content_delta', { text: delta.content }, { ...(deltaLeftover ? { delta: deltaLeftover } : {}) });
        if (config.reasoningField && typeof delta[config.reasoningField] === 'string') {
          push('reasoning_delta', { text: delta[config.reasoningField], channel: 'reasoning' }, { ...(deltaLeftover ? { delta: deltaLeftover } : {}) });
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            const st = toolState.get(idx) ?? {};
            const id = (typeof tc.id === 'string' && tc.id.length > 0) ? tc.id : (st.id ?? `tool-${idx}`);
            const name = (typeof tc.function?.name === 'string' && tc.function.name.length > 0) ? tc.function.name : (st.name ?? `tool-${idx}`);
            toolState.set(idx, { id, name: (typeof tc.function?.name === 'string' && tc.function.name.length > 0) ? tc.function.name : st.name });
            push('tool_delta', {
              tool_id: id,
              name,
              args_fragment: typeof tc.function?.arguments === 'string' ? tc.function.arguments : ''
            }, { ...(deltaLeftover ? { delta: deltaLeftover } : {}) });
          }
        }
      }
      const finish = choice?.finish_reason;
      if (finish !== undefined && finish !== null) {
        finishReason = String(finish);
        finishUsageTotal = buildUsageTotal(raw.usage);
      }
    }

    // T5 顺序保障：usage 先于 done（同一 chunk 携带两者时 done 恒末，FP-TOKO-006 截断纪律）
    if (isPlainObject(raw.usage)) {
      usageLeftover = splitExtra(raw.usage, USAGE_CONSUMED);
      push('usage', buildUsageData(raw.usage), { ...(usageLeftover ? { usage: usageLeftover } : {}) });
    }
    if (finishReason !== null) {
      push('done', { finish_reason: finishReason, usage_total: finishUsageTotal });
      toolState.clear(); // 流收尾，自动重置增量分片状态
    }

    return { events, kind: events.length > 0 ? 'mapped' : 'ignored' };

    /** dashscope output 层剩余键 → extra.output */
    function deltaLeftoverPatch(out) {
      const lo = splitExtra(out, OUTPUT_CONSUMED);
      return lo ? { output: lo } : {};
    }
  }

  /** SPI §1.1：原生事件 → PSE 事件数组（UnknownEvent 计数由 registry 层负责） */
  function normalize(raw) {
    return normalizeDetailed(raw).events;
  }

  /** SPI §1.1/R4：estimateTokens 经 FP-TOKO-001 profile（复用 FP-TOKO-002 估算轨） */
  function estimateTokens(content, contentType) {
    if (!['zh', 'en', 'code'].includes(contentType)) {
      throw new Error(`ADAPTER_INVALID_CONTENT_TYPE: contentType 必须为 zh/en/code，得到 ${contentType}`);
    }
    return trackEstimateTokens(content, contentType, config.family).tokens_est;
  }

  /** SPI §1.1：装配提示（FP-011 消费；数值取自 FP-001 profile） */
  function assemblyHints(profileArg) {
    const p = profileArg ?? loadProfile(config.family);
    return {
      family: config.family,
      context_window: p.context_window,
      prefix_cache: {
        billing_multiplier: p.prefix_cache?.billing,
        min_tokens: p.prefix_cache?.min_tokens
      },
      usage_semantics: p.usage_semantics,
      reasoning_channel: p.reasoning_channel,
      stream_protocol: p.stream_protocol,
      fallback_family: capabilities.fallback_family
    };
  }

  const adapter = {
    family: config.family,
    capabilities,
    meta,
    normalize,
    normalizeDetailed,
    estimateTokens,
    assemblyHints,
    resetStreamState
  };
  validateAdapterShape(adapter);
  return Object.freeze(adapter);
}

export default { createOpenAICompatibleAdapter };
