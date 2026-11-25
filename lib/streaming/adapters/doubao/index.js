// lib/streaming/adapters/doubao/index.js - Doubao（火山方舟）家族适配器（FP-TOKO-007 §2.1）
// OpenAI 兼容信封；reasoning_delta ← delta.reasoning_content（seed thinking）；
// usage 末块 + 方舟扩展（completion_tokens_details 等经 extra.usage 透传）；done ← finish_reason
import { createOpenAICompatibleAdapter } from '../shared/openai-compatible.js';
import { createAdapterPlugin } from '../shared/adapter-kit.js';

export const adapter = createOpenAICompatibleAdapter({
  family: 'doubao',
  envelope: 'openai',
  reasoningField: 'reasoning_content',
  toolCallStreaming: 'incremental',
  adapterVersion: '1.0.0',
  testedAt: '2026-11-25',
  upstreamVersion: 'ark.cn-beijing.volces.com v3（OpenAI 兼容 + 方舟扩展字段）'
});

export default createAdapterPlugin(adapter, adapter.meta);
