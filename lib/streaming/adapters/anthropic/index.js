// lib/streaming/adapters/anthropic/index.js - Anthropic 家族适配器（FP-TOKO-007 §2.1）
// messages SSE：content_block_delta(text_delta/thinking_delta/input_json_delta)；
// usage ← message_start(input) + message_delta(output)；done ← message_delta(stop_reason)
import { createAnthropicAdapter } from '../shared/anthropic-adapter.js';
import { createAdapterPlugin } from '../shared/adapter-kit.js';

export const adapter = createAnthropicAdapter({
  adapterVersion: '1.0.0',
  testedAt: '2026-11-25',
  upstreamVersion: 'messages API v1（streaming，start_and_delta usage）'
});

export default createAdapterPlugin(adapter, adapter.meta);
