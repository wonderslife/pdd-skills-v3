// lib/streaming/adapters/glm/index.js - GLM（智谱）家族适配器（FP-TOKO-007 §2.1）
// OpenAI 兼容信封；reasoning_delta ← delta.thinking（glm-4.5+ 深度思考）；
// usage 末块；done ← finish_reason
import { createOpenAICompatibleAdapter } from '../shared/openai-compatible.js';
import { createAdapterPlugin } from '../shared/adapter-kit.js';

export const adapter = createOpenAICompatibleAdapter({
  family: 'glm',
  envelope: 'openai',
  reasoningField: 'thinking',
  toolCallStreaming: 'incremental',
  adapterVersion: '1.0.0',
  testedAt: '2026-11-25',
  upstreamVersion: 'open.bigmodel.cn v4（chat/completions，thinking 字段）'
});

export default createAdapterPlugin(adapter, adapter.meta);
