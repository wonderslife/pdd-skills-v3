// lib/streaming/adapters/shared/gemini-adapter.js - Gemini streamGenerateContent SSE 映射引擎（FP-TOKO-007 §2.1）
//
// 事件映射（§2.1 Gemini 列）：
//   content_delta  ← candidates[].content.parts[].text（thought!==true）
//   reasoning_delta← candidates[].content.parts[].text（thought===true，interleaved 思考分片）
//   tool_delta     ← parts[].functionCall（聚合完整调用，aggregated）
//   usage          ← usageMetadata（随流 in_stream）
//   done           ← candidates[].finishReason=STOP
//
// 注：usageMetadata 随每个分块到达 → 每块产出 usage 事件（in_stream 口径，capabilities 声明一致）。

import { loadProfile } from '../../profiles/index.js';
import { estimateTokens as trackEstimateTokens } from '../../../token/estimation-track.js';
import { deriveCapabilities, splitExtra, isPlainObject, validateAdapterShape } from './adapter-kit.js';

const GEMINI_CONSUMED = ['candidates', 'usageMetadata'];
const CANDIDATE_CONSUMED = ['content', 'finishReason'];
const PART_CONSUMED = ['text', 'thought', 'functionCall'];

/**
 * 创建 Gemini 适配器（streamGenerateContent SSE，alt=sse 形态）
 * @param {{adapterVersion:string, testedAt:string, upstreamVersion:string}} config
 */
export function createGeminiAdapter(config) {
  const profile = loadProfile('gemini');
  const capabilities = deriveCapabilities(profile, { toolCallStreaming: 'aggregated' });
  const meta = {
    family: 'gemini',
    version: config.adapterVersion,
    tested_at: config.testedAt,
    upstream_version: config.upstreamVersion,
    sample_source: 'synthetic'
  };

  /** 聚合 functionCall 的序号计数（tool_id 生成） */
  let toolSeq = 0;

  function resetStreamState() {
    toolSeq = 0;
  }

  function normalizeDetailed(raw) {
    if (!isPlainObject(raw) || (!Array.isArray(raw.candidates) && !isPlainObject(raw.usageMetadata))) {
      return { events: [], kind: 'unknown' };
    }

    const events = [];
    const baseExtra = splitExtra(raw, GEMINI_CONSUMED);
    const push = (event, data, extraPatch) => {
      const ev = { event, data };
      const extra = { ...(baseExtra || {}), ...(extraPatch || {}) };
      if (Object.keys(extra).length > 0) ev.extra = extra;
      events.push(ev);
    };

    /** 候选/分片剩余键合并为透传补丁（T2） */
    const leftoverPatch = (candLeftover, partLeftovers) => {
      const patch = {};
      if (candLeftover) patch.candidates = [candLeftover];
      if (partLeftovers.length > 0) patch.parts = partLeftovers.map(p => ({ ...p }));
      return patch;
    };

    const usageMeta = raw.usageMetadata;
    const usageTotal = isPlainObject(usageMeta)
      ? {
          input_tokens: usageMeta.promptTokenCount ?? 0,
          output_tokens: usageMeta.candidatesTokenCount ?? usageMeta.totalTokenCount ?? 0
        }
      : {};
    // 收尾信息延后推送：usageMetadata 与 finishReason 同 chunk 时保证 T5（usage 先于 done，done 恒末）
    let finishReason = null;
    let finishPatch = null;

    for (const cand of Array.isArray(raw.candidates) ? raw.candidates : []) {
      const parts = Array.isArray(cand?.content?.parts) ? cand.content.parts : [];
      // T2 透传：候选/分片未消费键 → 该候选产出事件的 extra.candidates / extra.parts
      const candLeftover = splitExtra(cand, CANDIDATE_CONSUMED);
      const partLeftovers = [];
      for (const part of parts) {
        const partLeftover = splitExtra(part, PART_CONSUMED);
        if (partLeftover) partLeftovers.push(partLeftover);
        if (isPlainObject(part?.functionCall)) {
          toolSeq += 1;
          push('tool_delta', {
            tool_id: `gemini-call-${toolSeq}`,
            name: typeof part.functionCall.name === 'string' && part.functionCall.name.length > 0 ? part.functionCall.name : 'unknown_tool',
            args_fragment: JSON.stringify(part.functionCall.args ?? {})
          }, leftoverPatch(candLeftover, partLeftovers));
        } else if (typeof part?.text === 'string') {
          if (part.thought === true) {
            push('reasoning_delta', { text: part.text, channel: 'reasoning' }, leftoverPatch(candLeftover, partLeftovers));
          } else {
            push('content_delta', { text: part.text }, leftoverPatch(candLeftover, partLeftovers));
          }
        }
        // 其余 part 类型（functionResponse 等）→ 无事件，剩余键仍在 partLeftovers 透传
      }
      if (cand?.finishReason !== undefined && cand.finishReason !== null) {
        finishReason = String(cand.finishReason);
        finishPatch = leftoverPatch(candLeftover, partLeftovers);
      }
    }

    // T5 顺序保障：usage 先于 done
    if (isPlainObject(usageMeta)) {
      const usageData = {
        input_tokens: usageMeta.promptTokenCount ?? 0,
        output_tokens: usageMeta.candidatesTokenCount ?? 0,
        source: 'measured'
      };
      if (typeof usageMeta.cachedContentTokenCount === 'number') usageData.cached_tokens = usageMeta.cachedContentTokenCount;
      const usageLeftover = splitExtra(usageMeta, ['promptTokenCount', 'candidatesTokenCount', 'totalTokenCount', 'cachedContentTokenCount', 'thoughtsTokenCount']);
      push('usage', usageData, { ...(usageLeftover ? { usage: usageLeftover } : {}) });
    }
    if (finishReason !== null) {
      push('done', { finish_reason: finishReason, usage_total: usageTotal }, finishPatch ?? {});
      toolSeq = 0; // 流收尾，重置聚合序号
    }

    return { events, kind: events.length > 0 ? 'mapped' : 'ignored' };
  }

  function normalize(raw) {
    return normalizeDetailed(raw).events;
  }

  function estimateTokens(content, contentType) {
    if (!['zh', 'en', 'code'].includes(contentType)) {
      throw new Error(`ADAPTER_INVALID_CONTENT_TYPE: contentType 必须为 zh/en/code，得到 ${contentType}`);
    }
    return trackEstimateTokens(content, contentType, 'gemini').tokens_est;
  }

  function assemblyHints(profileArg) {
    const p = profileArg ?? loadProfile('gemini');
    return {
      family: 'gemini',
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
    family: 'gemini',
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

export default { createGeminiAdapter };
