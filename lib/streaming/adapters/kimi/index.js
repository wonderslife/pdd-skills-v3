// lib/streaming/adapters/kimi/index.js - Kimi（月之暗面）家族适配器（FP-TOKO-007 §2.1）
// OpenAI 兼容信封；content ← delta.content；usage 末块；done ← finish_reason。
// reasoning_delta ← delta.reasoning_content：**部分模型**支持（k2 thinking 系列），
// 映射表显式标注"部分"；主流 moonshot-v1 系列无该字段（profile.reasoning_channel=none）。
import { createOpenAICompatibleAdapter } from '../shared/openai-compatible.js';
import { createAdapterPlugin } from '../shared/adapter-kit.js';

export const adapter = createOpenAICompatibleAdapter({
  family: 'kimi',
  envelope: 'openai',
  reasoningField: 'reasoning_content',
  partialReasoning: true,
  toolCallStreaming: 'incremental',
  adapterVersion: '1.0.0',
  testedAt: '2026-11-25',
  upstreamVersion: 'api.moonshot.cn v1（OpenAI 兼容，k2 thinking 部分支持 reasoning_content）'
});

export default createAdapterPlugin(adapter, adapter.meta);
