// lib/streaming/adapters/shared/anthropic-adapter.js - Anthropic messages SSE 映射引擎（FP-TOKO-007 §2.1）
//
// 事件映射（§2.1 Anthropic 列）：
//   content_delta  ← content_block_delta(delta.type=text_delta)
//   reasoning_delta← content_block_delta(delta.type=thinking_delta)（dedicated_field）
//   tool_delta     ← content_block_start(tool_use) 供 id/name + content_block_delta(input_json_delta) 供参数分片
//   usage          ← message_start（input）+ message_delta（output）（start_and_delta）
//   done           ← message_delta(delta.stop_reason)
//
// 显式忽略（不计数 UnknownEvent，映射表标注）：content_block_stop / message_stop / ping /
//   signature_delta（思考块签名噪声）。error 类型事件映射为 PSE error{retryable:false}。

import { loadProfile } from '../../profiles/index.js';
import { estimateTokens as trackEstimateTokens } from '../../../token/estimation-track.js';
import { deriveCapabilities, splitExtra, isPlainObject, validateAdapterShape } from './adapter-kit.js';

const ANTHROPIC_CONSUMED = ['type', 'index', 'delta', 'message', 'usage', 'content_block', 'error'];
const DELTA_CONSUMED = ['type', 'text', 'thinking', 'partial_json'];
const KNOWN_TYPES = ['message_start', 'content_block_start', 'content_block_delta', 'content_block_stop', 'message_delta', 'message_stop', 'ping', 'error'];
/** 显式忽略清单（§2.1 映射表标注：映射为空、不计 UnknownEvent） */
export const ANTHROPIC_IGNORED = Object.freeze(['content_block_stop', 'message_stop', 'ping', 'signature_delta']);

/**
 * 创建 Anthropic 适配器（messages API SSE）
 * @param {{adapterVersion:string, testedAt:string, upstreamVersion:string}} config
 */
export function createAnthropicAdapter(config) {
  const profile = loadProfile('anthropic');
  const capabilities = deriveCapabilities(profile, { toolCallStreaming: 'incremental' });
  const meta = {
    family: 'anthropic',
    version: config.adapterVersion,
    tested_at: config.testedAt,
    upstream_version: config.upstreamVersion,
    sample_source: 'synthetic'
  };

  /** content_block index → {id,name}（tool_use 分片归位状态） */
  const blockMap = new Map();

  function resetStreamState() {
    blockMap.clear();
  }

  function normalizeDetailed(raw) {
    if (!isPlainObject(raw) || !KNOWN_TYPES.includes(raw.type)) {
      return { events: [], kind: 'unknown' };
    }

    const events = [];
    const baseExtra = splitExtra(raw, ANTHROPIC_CONSUMED);
    const push = (event, data, extraPatch) => {
      const ev = { event, data };
      const extra = { ...(baseExtra || {}), ...(extraPatch || {}) };
      if (Object.keys(extra).length > 0) ev.extra = extra;
      events.push(ev);
    };

    switch (raw.type) {
      case 'message_start': {
        const msg = raw.message;
        const inputTokens = msg?.usage?.input_tokens ?? 0;
        push('message_start', {
          id: typeof msg?.id === 'string' && msg.id.length > 0 ? msg.id : 'anthropic-stream',
          family: 'anthropic',
          context_tokens: inputTokens
        });
        if (isPlainObject(msg?.usage)) {
          const usageData = {
            input_tokens: inputTokens,
            output_tokens: msg.usage.output_tokens ?? 0,
            source: 'measured'
          };
          if (typeof msg.usage.cache_read_input_tokens === 'number') usageData.cached_tokens = msg.usage.cache_read_input_tokens;
          const usageLeftover = splitExtra(msg.usage, ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens']);
          push('usage', usageData, { ...(usageLeftover ? { usage: usageLeftover } : {}) });
        }
        break;
      }
      case 'content_block_start': {
        const block = raw.content_block;
        if (block?.type === 'tool_use') {
          const entry = {
            id: typeof block.id === 'string' && block.id.length > 0 ? block.id : `anthropic-block-${raw.index}`,
            name: typeof block.name === 'string' && block.name.length > 0 ? block.name : 'unknown_tool'
          };
          blockMap.set(raw.index, entry);
          push('tool_delta', { tool_id: entry.id, name: entry.name, args_fragment: '' });
        }
        // text/thinking 块声明无载荷 → 忽略（无事件产出）
        break;
      }
      case 'content_block_delta': {
        const d = raw.delta ?? {};
        const deltaLeftover = splitExtra(d, DELTA_CONSUMED);
        const patch = { ...(deltaLeftover ? { delta: deltaLeftover } : {}) };
        if (d.type === 'text_delta') {
          push('content_delta', { text: typeof d.text === 'string' ? d.text : '' }, patch);
        } else if (d.type === 'thinking_delta') {
          push('reasoning_delta', { text: typeof d.thinking === 'string' ? d.thinking : '', channel: 'reasoning' }, patch);
        } else if (d.type === 'input_json_delta') {
          const st = blockMap.get(raw.index);
          push('tool_delta', {
            tool_id: st?.id ?? `anthropic-block-${raw.index}`,
            name: st?.name ?? 'unknown_tool',
            args_fragment: typeof d.partial_json === 'string' ? d.partial_json : ''
          }, patch);
        }
        // signature_delta 等噪声类型 → 忽略
        break;
      }
      case 'content_block_stop': {
        blockMap.delete(raw.index);
        break;
      }
      case 'message_delta': {
        if (isPlainObject(raw.usage)) {
          const usageData = {
            input_tokens: 0,
            output_tokens: raw.usage.output_tokens ?? 0,
            source: 'measured'
          };
          if (typeof raw.usage.cache_read_input_tokens === 'number') usageData.cached_tokens = raw.usage.cache_read_input_tokens;
          push('usage', usageData);
        }
        const stop = raw.delta?.stop_reason;
        if (stop !== undefined && stop !== null) {
          push('done', {
            finish_reason: String(stop),
            usage_total: isPlainObject(raw.usage) ? { output_tokens: raw.usage.output_tokens ?? 0 } : {}
          });
          blockMap.clear();
        }
        break;
      }
      case 'error': {
        push('error', {
          code: typeof raw.error?.type === 'string' && raw.error.type.length > 0 ? raw.error.type : 'UNKNOWN',
          message: typeof raw.error?.message === 'string' ? raw.error.message : '',
          retryable: false
        });
        break;
      }
      // message_stop / ping → 显式忽略
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
    return trackEstimateTokens(content, contentType, 'anthropic').tokens_est;
  }

  function assemblyHints(profileArg) {
    const p = profileArg ?? loadProfile('anthropic');
    return {
      family: 'anthropic',
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
    family: 'anthropic',
    capabilities,
    meta,
    normalize,
    normalizeDetailed,
    estimateTokens,
    assemblyHints,
    resetStreamState,
    ignoredEventTypes: ANTHROPIC_IGNORED
  };
  validateAdapterShape(adapter);
  return Object.freeze(adapter);
}

export default { createAnthropicAdapter };
