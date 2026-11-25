// lib/streaming/adapters/deepseek/index.js - DeepSeek 家族适配器（FP-TOKO-007 §2.1）
// OpenAI 兼容信封；reasoning_delta ← delta.reasoning_content（R1 系列）；
// usage 末块（prompt_cache_hit_tokens 计入 cached_tokens）；done ← finish_reason
import { createOpenAICompatibleAdapter } from '../shared/openai-compatible.js';
import { createAdapterPlugin } from '../shared/adapter-kit.js';

export const adapter = createOpenAICompatibleAdapter({
  family: 'deepseek',
  envelope: 'openai',
  reasoningField: 'reasoning_content',
  toolCallStreaming: 'incremental',
  adapterVersion: '1.0.0',
  testedAt: '2026-11-25',
  upstreamVersion: 'api-docs（OpenAI 兼容，reasoner 系列 reasoning_content）'
});

export default createAdapterPlugin(adapter, adapter.meta);
