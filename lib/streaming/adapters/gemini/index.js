// lib/streaming/adapters/gemini/index.js - Gemini 家族适配器（FP-TOKO-007 §2.1）
// streamGenerateContent（alt=sse）：candidates[].content.parts[].text（thought 分片）；
// functionCall 聚合下发；usageMetadata 随流（in_stream）；done ← finishReason=STOP
import { createGeminiAdapter } from '../shared/gemini-adapter.js';
import { createAdapterPlugin } from '../shared/adapter-kit.js';

export const adapter = createGeminiAdapter({
  adapterVersion: '1.0.0',
  testedAt: '2026-11-25',
  upstreamVersion: 'generativelanguage v1beta（streamGenerateContent alt=sse）'
});

export default createAdapterPlugin(adapter, adapter.meta);
