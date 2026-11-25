// lib/streaming/adapters/openai/index.js - OpenAI 家族适配器（FP-TOKO-007 §2.1）
// reasoning_delta ← delta.reasoning（o 系列思考字段）；usage ← 末 chunk（stream_options.include_usage）；
// done ← finish_reason=stop；tool ← delta.tool_calls[].function.arguments（增量分片）
import { createOpenAICompatibleAdapter } from '../shared/openai-compatible.js';
import { createAdapterPlugin } from '../shared/adapter-kit.js';

export const adapter = createOpenAICompatibleAdapter({
  family: 'openai',
  envelope: 'openai',
  reasoningField: 'reasoning',
  toolCallStreaming: 'incremental',
  adapterVersion: '1.0.0',
  testedAt: '2026-11-25',
  upstreamVersion: 'chat-completions v1（stream_options.include_usage，usage 末块）'
});

export default createAdapterPlugin(adapter, adapter.meta);
