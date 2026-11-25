// lib/streaming/adapters/qwen/index.js - Qwen（DashScope）家族适配器（FP-TOKO-007 §2.1）
// DashScope 原生信封：content ← output.text（incremental_output）；
// reasoning ← output.reasoning_content / output.thinking；tool ← message.tool_calls；
// usage 末块（input_tokens/output_tokens）；done ← output.finish_reason
import { createOpenAICompatibleAdapter } from '../shared/openai-compatible.js';
import { createAdapterPlugin } from '../shared/adapter-kit.js';

export const adapter = createOpenAICompatibleAdapter({
  family: 'qwen',
  envelope: 'dashscope',
  toolCallStreaming: 'incremental',
  adapterVersion: '1.0.0',
  testedAt: '2026-11-25',
  upstreamVersion: 'DashScope 原生协议（incremental_output，qwen3 thinking 系列）'
});

export default createAdapterPlugin(adapter, adapter.meta);
