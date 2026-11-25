// tests/toko/mssa-adapters.test.js - FP-TOKO-007 mssa-adapters 契约测试
//
// 验收覆盖：B1 清单齐全 / B2 插件加载冒烟 / B3 映射总表（T1 逐家族回放）/
// T2 透传完整性 / T3 UnknownEvent 计数与降级 / T4 能力一致性 / T5 tokenizer 经 profile /
// I1 PSE 贯通 / I2 降级链接缝 / I3 既有插件共存。

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADAPTER_FAMILIES,
  UNKNOWN_EVENT_THRESHOLD,
  getAdapter,
  listAdapters,
  normalizeWithAdapter,
  normalizeStream,
  getUnknownEventStats,
  resetUnknownEventStats,
  getDegradeSuggestions
} from '../../lib/streaming/adapters/index.js';
import { auditCapabilityConsistency, validateAdapterShape } from '../../lib/streaming/adapters/shared/adapter-kit.js';
import { validateEvent, buildEventStream, renderSSE, parseSSE } from '../../lib/streaming/pse-events.js';
import { FAMILIES, loadProfile } from '../../lib/streaming/profiles/index.js';
import { estimateTokens as trackEstimateTokens } from '../../lib/token/estimation-track.js';
import { PluginManifest, PluginBase } from '../../lib/plugin/plugin-sdk.js';
import { PluginManager } from '../../lib/plugin/plugin-manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADAPTERS_DIR = path.join(__dirname, '../../lib/streaming/adapters');

/** @private 读取家族夹具 */
function fixture(family) {
  return JSON.parse(readFileSync(path.join(ADAPTERS_DIR, family, 'fixtures.json'), 'utf-8'));
}

/** @private 读取家族 plugin.json */
function pluginJson(family) {
  return JSON.parse(readFileSync(path.join(ADAPTERS_DIR, family, 'plugin.json'), 'utf-8'));
}

// ==================== B1 清单齐全 ====================

describe('B1 清单齐全', () => {
  test('8 家族适配器注册齐全且 SPI 形状完整', () => {
    assert.deepEqual([...ADAPTER_FAMILIES], ['openai', 'anthropic', 'gemini', 'deepseek', 'qwen', 'glm', 'kimi', 'doubao']);
    assert.deepEqual([...ADAPTER_FAMILIES], [...FAMILIES]); // 与 FP-TOKO-001 家族表对齐
    for (const family of ADAPTER_FAMILIES) {
      const adapter = getAdapter(family);
      validateAdapterShape(adapter);
      assert.equal(adapter.meta.family, family);
      assert.equal(typeof adapter.meta.tested_at, 'string'); // §1.2：每适配器含 tested_at
      assert.equal(typeof adapter.meta.upstream_version, 'string'); // §1.2：upstream_version
      assert.equal(adapter.meta.sample_source, 'synthetic'); // §2.2 夹具来源标记
    }
  });

  test('plugin.json 声明 provides=mssa-adapter 且与 adapter.meta 一致（R3 版本独立）', () => {
    for (const family of ADAPTER_FAMILIES) {
      const pj = pluginJson(family);
      const adapter = getAdapter(family);
      assert.equal(pj.provides, 'mssa-adapter');
      assert.equal(pj.name, `mssa-adapter-${family}`);
      assert.equal(pj.main, 'index.js');
      assert.equal(pj.mssa.family, family);
      assert.equal(pj.mssa.tested_at, adapter.meta.tested_at);
      assert.equal(pj.mssa.upstream_version, adapter.meta.upstream_version);
      assert.equal(pj.version, adapter.meta.version);
    }
  });

  test('每家族 fixtures.json 存在且标记 synthetic（R1 契约夹具）', () => {
    for (const family of ADAPTER_FAMILIES) {
      const fx = fixture(family);
      assert.equal(fx.sample_source, 'synthetic');
      assert.ok(Array.isArray(fx.events) && fx.events.length > 0);
    }
  });
});

// ==================== B2 加载冒烟 ====================

describe('B2 加载冒烟', () => {
  test('PluginManifest 校验 8 份 plugin.json 全通过', async () => {
    for (const family of ADAPTER_FAMILIES) {
      const manifest = await PluginManifest.load(path.join(ADAPTERS_DIR, family, 'plugin.json'));
      const result = manifest.validate();
      assert.equal(result.valid, true, `${family} manifest 校验失败: ${result.errors.join('; ')}`);
    }
  });

  test('PluginManager 可发现并激活全部 8 个适配器插件', async () => {
    const manager = new PluginManager({
      pluginsDir: ADAPTERS_DIR,
      pddVersion: '3.5.0',
      logger: { info() {}, warn() {}, error() {}, debug() {} }
    });
    const discovered = await manager.discover();
    assert.equal(discovered.length, 8);
    const instances = await manager.loadAll();
    assert.equal(instances.length, 8);
    for (const inst of instances) {
      assert.ok(inst instanceof PluginBase);
      assert.equal(inst.status, 'activated');
      assert.ok(ADAPTER_FAMILIES.includes(inst.adapter.family));
    }
    await manager.destroy();
  });

  test('I3：android-toolchain 既有插件加载不受影响', async () => {
    const manager = new PluginManager({
      pluginsDir: path.join(__dirname, '../../lib/plugin'),
      pddVersion: '3.5.0',
      logger: { info() {}, warn() {}, error() {}, debug() {} }
    });
    const instance = await manager.load('android-toolchain');
    assert.ok(instance instanceof PluginBase);
    assert.equal(instance.status, 'activated');
    await manager.destroy();
  });
});

// ==================== T1 契约回放（B3 映射总表逐家族落地） ====================

describe('T1 契约回放', () => {
  test('openai：content/reasoning/tool 增量分片/usage 末块/done + [DONE] 哨兵忽略', () => {
    resetUnknownEventStats('openai');
    const { events, unknown, stats } = normalizeStream(fixture('openai').events, 'openai');
    assert.equal(unknown.length, 0);
    assert.equal(stats.count, 0);

    const content = events.filter(e => e.event === 'content_delta');
    assert.equal(content[0].data.text, '你好');
    assert.equal(content[1].data.text, '扩展字段');

    const reasoning = events.find(e => e.event === 'reasoning_delta');
    assert.equal(reasoning.data.text, '分析需求边界');
    assert.equal(reasoning.data.channel, 'reasoning');

    const tools = events.filter(e => e.event === 'tool_delta');
    assert.equal(tools.length, 2);
    assert.equal(tools[0].data.tool_id, 'call_1'); // 首片携带 id/name
    assert.equal(tools[0].data.name, 'get_weather');
    assert.equal(tools[1].data.tool_id, 'call_1'); // 后续分片经 toolState 补齐
    assert.equal(tools[1].data.name, 'get_weather');
    assert.equal(tools[1].data.args_fragment, '{"city":"北京"}');

    const usage = events.find(e => e.event === 'usage');
    assert.deepEqual(usage.data, { input_tokens: 12, output_tokens: 34, source: 'measured', cached_tokens: 8 });

    const done = events[events.length - 1];
    assert.equal(done.event, 'done');
    assert.equal(done.data.finish_reason, 'stop');
    assert.deepEqual(done.data.usage_total, { input_tokens: 12, output_tokens: 34 });
  });

  test('anthropic：message_start/thinking_delta/input_json_delta 归位/message_delta + 忽略事件不产出', () => {
    resetUnknownEventStats('anthropic');
    const { events, unknown, stats } = normalizeStream(fixture('anthropic').events, 'anthropic');
    assert.equal(unknown.length, 0);
    assert.equal(stats.count, 0);

    const starts = events.filter(e => e.event === 'message_start');
    assert.equal(starts.length, 1);
    assert.equal(starts[0].data.id, 'msg_fixture_1');
    assert.equal(starts[0].data.family, 'anthropic');
    assert.equal(starts[0].data.context_tokens, 100);

    const content = events.find(e => e.event === 'content_delta');
    assert.equal(content.data.text, '你好');

    const reasoning = events.find(e => e.event === 'reasoning_delta');
    assert.equal(reasoning.data.text, '推理中');

    const tools = events.filter(e => e.event === 'tool_delta');
    assert.equal(tools.length, 2);
    assert.deepEqual(tools[0].data, { tool_id: 'toolu_1', name: 'get_weather', args_fragment: '' });
    assert.deepEqual(tools[1].data, { tool_id: 'toolu_1', name: 'get_weather', args_fragment: '{"city":"北京"}' }); // index→block 归位

    const usages = events.filter(e => e.event === 'usage');
    assert.equal(usages.length, 2); // start_and_delta：message_start(input) + message_delta(output)
    assert.equal(usages[0].data.input_tokens, 100);
    assert.equal(usages[0].data.cached_tokens, 40);
    assert.equal(usages[1].data.output_tokens, 42);

    const done = events[events.length - 1];
    assert.equal(done.event, 'done');
    assert.equal(done.data.finish_reason, 'end_turn');

    // ping/content_block_stop/message_stop/signature_delta 显式忽略：不产出事件、不计数
    assert.ok(!events.some(e => e.extra?.unknown_events));
  });

  test('gemini：thought 分片/text/functionCall 聚合/usageMetadata 随流/finishReason', () => {
    resetUnknownEventStats('gemini');
    const { events, unknown } = normalizeStream(fixture('gemini').events, 'gemini');
    assert.equal(unknown.length, 0);

    const reasoning = events.find(e => e.event === 'reasoning_delta');
    assert.equal(reasoning.data.text, '推理过程');

    const content = events.find(e => e.event === 'content_delta');
    assert.equal(content.data.text, '最终答案');

    const tool = events.find(e => e.event === 'tool_delta');
    assert.equal(tool.data.name, 'get_weather');
    assert.deepEqual(JSON.parse(tool.data.args_fragment), { city: '北京' });

    const usages = events.filter(e => e.event === 'usage');
    assert.equal(usages.length, 4); // in_stream：每 chunk 一次
    assert.equal(usages[1].data.cached_tokens, 3);

    const done = events[events.length - 1];
    assert.equal(done.event, 'done');
    assert.equal(done.data.finish_reason, 'STOP');
    assert.deepEqual(done.data.usage_total, { input_tokens: 10, output_tokens: 16 });
  });

  test('deepseek：reasoning_content/content/tool/usage 末块（cache 命中计 cached_tokens）', () => {
    resetUnknownEventStats('deepseek');
    const { events, unknown } = normalizeStream(fixture('deepseek').events, 'deepseek');
    assert.equal(unknown.length, 0);

    const reasoning = events.find(e => e.event === 'reasoning_delta');
    assert.equal(reasoning.data.text, '深度推理');

    const contents = events.filter(e => e.event === 'content_delta');
    assert.equal(contents[0].data.text, ''); // reasoner 空内容首块
    assert.equal(contents[1].data.text, '答案内容');

    const tool = events.find(e => e.event === 'tool_delta');
    assert.equal(tool.data.tool_id, 'call_ds');
    assert.equal(tool.data.name, 'search');

    const usage = events.find(e => e.event === 'usage');
    assert.equal(usage.data.cached_tokens, 16); // prompt_cache_hit_tokens
    assert.equal(usage.data.input_tokens, 20);
    assert.equal(usage.data.output_tokens, 30);

    const done = events[events.length - 1];
    assert.equal(done.data.finish_reason, 'stop');
  });

  test('qwen：DashScope output.text/reasoning_content/tool_calls/finish_reason', () => {
    resetUnknownEventStats('qwen');
    const { events, unknown } = normalizeStream(fixture('qwen').events, 'qwen');
    assert.equal(unknown.length, 0);

    const content = events.find(e => e.event === 'content_delta');
    assert.equal(content.data.text, '答案片段');

    const reasoning = events.find(e => e.event === 'reasoning_delta');
    assert.equal(reasoning.data.text, '推理链');

    const tool = events.find(e => e.event === 'tool_delta');
    assert.equal(tool.data.tool_id, 'call_q');
    assert.equal(tool.data.name, 'get_weather');

    const usage = events.find(e => e.event === 'usage');
    assert.deepEqual({ input_tokens: usage.data.input_tokens, output_tokens: usage.data.output_tokens }, { input_tokens: 15, output_tokens: 25 });

    const done = events[events.length - 1];
    assert.equal(done.data.finish_reason, 'stop');
  });

  test('glm：delta.thinking 推理通道', () => {
    resetUnknownEventStats('glm');
    const { events, unknown } = normalizeStream(fixture('glm').events, 'glm');
    assert.equal(unknown.length, 0);
    const reasoning = events.find(e => e.event === 'reasoning_delta');
    assert.equal(reasoning.data.text, '深度思考');
    assert.equal(reasoning.data.channel, 'reasoning');
    const done = events[events.length - 1];
    assert.equal(done.data.finish_reason, 'stop');
  });

  test('kimi：content + 部分模型 reasoning（映射表标注"部分"）', () => {
    resetUnknownEventStats('kimi');
    const { events, unknown } = normalizeStream(fixture('kimi').events, 'kimi');
    assert.equal(unknown.length, 0);
    const content = events.find(e => e.event === 'content_delta');
    assert.equal(content.data.text, '月光');
    const reasoning = events.find(e => e.event === 'reasoning_delta'); // k2 thinking 样本
    assert.equal(reasoning.data.text, 'k2 推理');
    assert.equal(getAdapter('kimi').capabilities.reasoning_channel, 'none'); // profile 口径：主流系列无独立通道
    const done = events[events.length - 1];
    assert.equal(done.data.finish_reason, 'stop');
  });

  test('doubao：content/reasoning_content/usage 末块（方舟扩展）', () => {
    resetUnknownEventStats('doubao');
    const { events, unknown } = normalizeStream(fixture('doubao').events, 'doubao');
    assert.equal(unknown.length, 0);
    const content = events.find(e => e.event === 'content_delta');
    assert.equal(content.data.text, '豆包');
    const reasoning = events.find(e => e.event === 'reasoning_delta');
    assert.equal(reasoning.data.text, '深度推理');
    const done = events[events.length - 1];
    assert.equal(done.data.finish_reason, 'stop');
  });
});

// ==================== T2 透传完整性 ====================

describe('T2 透传完整性', () => {
  test('openai：生僻顶层/嵌套字段全部落 extra 且无丢失', () => {
    const { events } = normalizeStream(fixture('openai').events, 'openai');
    const exotic = events.find(e => e.data?.text === '扩展字段');
    assert.deepEqual(exotic.extra.x_vendor_extension, { trace: 't-9' });
    assert.equal(exotic.extra.delta.custom_flag, true);
    assert.equal(exotic.extra.id, 'chatcmpl-fixture-2');
  });

  test('anthropic：delta 未映射字段（citation）落 extra.delta', () => {
    const { events } = normalizeWithAdapter('anthropic', {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: '带引用', citation: { doc: 'd-1' } }
    });
    assert.equal(events[0].data.text, '带引用');
    assert.deepEqual(events[0].extra.delta.citation, { doc: 'd-1' });
  });

  test('gemini：候选未映射字段（safetyRatings）落 extra.candidates', () => {
    const { events } = normalizeWithAdapter('gemini', {
      candidates: [{ content: { parts: [{ text: '安全检查' }] }, index: 0, safetyRatings: [{ category: 'HARM' }] }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 }
    });
    assert.equal(events[0].data.text, '安全检查');
    assert.deepEqual(events[0].extra.candidates, [{ index: 0, safetyRatings: [{ category: 'HARM' }] }]);
  });

  test('deepseek：usage 扩展字段（prompt_cache_miss_tokens）不丢弃', () => {
    const { events } = normalizeStream(fixture('deepseek').events, 'deepseek');
    const usage = events.find(e => e.event === 'usage');
    assert.equal(usage.extra.usage.prompt_cache_hit_tokens, 16);
    assert.equal(usage.extra.usage.prompt_cache_miss_tokens, 4);
  });

  test('doubao：方舟扩展 completion_tokens_details 落 extra.usage', () => {
    const { events } = normalizeStream(fixture('doubao').events, 'doubao');
    const usage = events.find(e => e.event === 'usage');
    assert.deepEqual(usage.extra.usage.completion_tokens_details, { reasoning_tokens: 7 });
  });
});

// ==================== T3 UnknownEvent 计数与降级 ====================

describe('T3 UnknownEvent 计数与降级', () => {
  test('未映射事件计数且原始载荷保留（openai 收到 anthropic 形态）', () => {
    resetUnknownEventStats('openai');
    const alien = { type: 'message_start', message: { id: 'msg_x' } };
    const { kind, stats } = normalizeWithAdapter('openai', alien);
    assert.equal(kind, 'unknown');
    assert.equal(stats.count, 1);
    assert.equal(getUnknownEventStats('openai').count, 1);
  });

  test('显式忽略事件（ping/message_stop）不计数', () => {
    resetUnknownEventStats('anthropic');
    normalizeWithAdapter('anthropic', { type: 'ping' });
    normalizeWithAdapter('anthropic', { type: 'message_stop' });
    normalizeWithAdapter('anthropic', { type: 'content_block_stop', index: 0 });
    assert.equal(getUnknownEventStats('anthropic').count, 0);
  });

  test('累计 ≥ 阈值触发降级建议（family_protocol_drift，FP-010 接缝）', () => {
    resetUnknownEventStats('glm');
    const drift = { provider: 'glm-unknown-extension', seq: 0 };
    const raws = Array.from({ length: UNKNOWN_EVENT_THRESHOLD }, (_, i) => ({ ...drift, seq: i }));
    const { stats } = normalizeStream(raws, 'glm');
    assert.equal(stats.count, UNKNOWN_EVENT_THRESHOLD);
    assert.equal(stats.degrade_suggested, true);
    const suggestions = getDegradeSuggestions('glm');
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].error_class, 'family_protocol_drift');
    assert.equal(suggestions[0].degraded, true);
    assert.equal(suggestions[0].count, UNKNOWN_EVENT_THRESHOLD);
    assert.equal(suggestions[0].session_id, 'global');
    assert.ok(typeof suggestions[0].ts === 'string');
    assert.deepEqual(suggestions[0].last_unknown_raw, raws[raws.length - 1]);
  });

  test('未映射事件载荷经 extra.unknown_events 带内透传（前置/流尾兜底）', () => {
    resetUnknownEventStats('kimi');
    const preUnknown = { heartbeat: true };
    const trailingUnknown = { goodbye: true };
    const contentChunk = { choices: [{ index: 0, delta: { content: '正文' }, finish_reason: null }] };
    const midStream = normalizeStream([preUnknown, contentChunk], 'kimi');
    assert.deepEqual(midStream.events[0].extra.unknown_events, [preUnknown]);
    assert.equal(midStream.unknown.length, 1);

    const finishChunk = { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } };
    const endStream = normalizeStream([finishChunk, trailingUnknown], 'kimi');
    assert.deepEqual(endStream.events[endStream.events.length - 1].extra.unknown_events, [trailingUnknown]);
  });

  test('resetUnknownEventStats 重置计数与降级建议', () => {
    resetUnknownEventStats('glm');
    assert.equal(getUnknownEventStats('glm').count, 0);
    assert.equal(getUnknownEventStats('glm').degrade_suggested, false);
    assert.equal(getDegradeSuggestions('glm').length, 0);
    resetUnknownEventStats(); // 全量重置不抛错
  });
});

// ==================== T4 能力一致性 ====================

describe('T4 能力一致性', () => {
  test('8 家族 capabilities 声明与 FP-001 profile 锚定一致', () => {
    for (const family of ADAPTER_FAMILIES) {
      const adapter = getAdapter(family);
      const result = auditCapabilityConsistency(adapter);
      assert.equal(result.ok, true);
      const profile = loadProfile(family);
      assert.equal(adapter.capabilities.prefix_cache.billing_multiplier, profile.prefix_cache.billing);
      assert.equal(adapter.capabilities.max_context, profile.context_window);
      assert.equal(adapter.capabilities.fallback_family, 'openai');
    }
  });

  test('数值漂移 → CAPABILITY_MISMATCH', () => {
    const base = getAdapter('openai');
    const drifted = {
      family: 'openai',
      capabilities: { ...base.capabilities, prefix_cache: { billing_multiplier: 0.99, min_tokens: 1024 } },
      normalize: () => [],
      estimateTokens: () => 0,
      assemblyHints: () => ({})
    };
    assert.throws(() => auditCapabilityConsistency(drifted), err => err.code === 'CAPABILITY_MISMATCH');
  });

  test('推理通道声明不符 → CAPABILITY_MISMATCH', () => {
    const base = getAdapter('glm');
    const drifted = {
      family: 'glm',
      capabilities: { ...base.capabilities, reasoning_channel: 'none' },
      normalize: () => [],
      estimateTokens: () => 0,
      assemblyHints: () => ({})
    };
    assert.throws(() => auditCapabilityConsistency(drifted), err => err.code === 'CAPABILITY_MISMATCH');
  });
});

// ==================== T5 tokenizer 经 profile ====================

describe('T5 tokenizer 经 profile', () => {
  const SAMPLES = {
    zh: '预算流式闭环需要把实测用量回填到消耗记录，并在跨阈值时下发建议事件。',
    en: 'streaming budget closure backfills measured usage into consumption records',
    code: 'function onUsage(evt) {\n  return evt.output_tokens;\n}\n'
  };

  test('8 家族 × zh/en/code 输出与 FP-TOKO-001 系数完全一致（R4）', () => {
    for (const family of ADAPTER_FAMILIES) {
      const adapter = getAdapter(family);
      for (const ct of ['zh', 'en', 'code']) {
        assert.equal(
          adapter.estimateTokens(SAMPLES[ct], ct),
          trackEstimateTokens(SAMPLES[ct], ct, family).tokens_est,
          `${family}/${ct} 系数不一致`
        );
      }
    }
  });

  test('contentType 越界拒绝（SPI 限定 zh/en/code）', () => {
    const adapter = getAdapter('openai');
    assert.throws(() => adapter.estimateTokens('x', 'mixed'), /ADAPTER_INVALID_CONTENT_TYPE/);
    assert.throws(() => adapter.estimateTokens('x', 'zh '), /ADAPTER_INVALID_CONTENT_TYPE/);
    assert.throws(() => adapter.estimateTokens(42, 'zh'), /ESTIMATE_INVALID_CONTENT/); // FP-002 错误码透传
  });
});

// ==================== I1 PSE 贯通 ====================

describe('I1 PSE 贯通', () => {
  test('8 家族 normalizeStream 产物全部满足 FP-TOKO-006 Schema', () => {
    for (const family of ADAPTER_FAMILIES) {
      resetUnknownEventStats(family);
      const { events } = normalizeStream(fixture(family).events, family);
      assert.ok(events.length > 0, `${family} 无产物`);
      for (const ev of events) {
        const check = validateEvent(ev);
        assert.equal(check.valid, true, `${family} 事件 ${ev.event} 校验失败: ${check.errors.join('; ')}`);
      }
    }
  });

  test('anthropic SSE 文本端到端：parseSSE → normalizeStream → buildEventStream → renderSSE', () => {
    resetUnknownEventStats('anthropic');
    const sseText = fixture('anthropic').events
      .filter(e => typeof e !== 'string')
      .map(e => `event: native\ndata: ${JSON.stringify(e)}\n\n`)
      .join('');
    const raws = parseSSE(sseText).map(p => p.data);
    const { events, unknown } = normalizeStream(raws, 'anthropic');
    assert.equal(unknown.length, 0);

    const stream = buildEventStream(events, {
      sessionId: 'fp007-i1',
      phase: 'impl',
      family: 'anthropic',
      id: 'msg_fixture_1',
      context_tokens: 100
    });
    assert.equal(stream.malformed.length, 0);
    assert.equal(stream.events[0].event, 'message_start'); // T5：恒首
    assert.equal(stream.events[stream.events.length - 1].event, 'done'); // T5：恒末
    assert.equal(stream.usage_recorded, 2); // start_and_delta 两笔 usage 均入 FP-002 消耗记录

    const rendered = renderSSE(stream.events);
    assert.ok(rendered.includes('event: done'));
    assert.ok(rendered.includes('event: usage'));
  });
});

// ==================== I2 降级链接缝 ====================

describe('I2 降级链接缝', () => {
  test('fallback_family 全量指向 openai + 降级建议字段齐备', () => {
    for (const family of ADAPTER_FAMILIES) {
      assert.equal(getAdapter(family).capabilities.fallback_family, 'openai');
    }
    resetUnknownEventStats('doubao');
    const raw = { ark_unknown_signal: { v: 1 } };
    normalizeStream(Array.from({ length: UNKNOWN_EVENT_THRESHOLD }, () => raw), 'doubao', { sessionId: 'fp007-i2' });
    const stats = getUnknownEventStats('doubao', 'fp007-i2');
    assert.equal(stats.session_id, 'fp007-i2');
    assert.equal(stats.degrade_suggested, true);
    const suggestion = stats.suggestion;
    assert.equal(suggestion.family, 'doubao');
    assert.equal(suggestion.error_class, 'family_protocol_drift');
    assert.equal(suggestion.degraded, true);
    assert.ok('ts' in suggestion && 'count' in suggestion && 'threshold' in suggestion);
    // 会话隔离：其他会话/全局计数不受影响
    assert.equal(getUnknownEventStats('doubao').count, 0);
  });
});

// ==================== assemblyHints 与注册表边界 ====================

describe('assemblyHints 与注册表边界', () => {
  test('assemblyHints 数值锚定 FP-001 profile，支持自定义 profile 覆盖', () => {
    const adapter = getAdapter('qwen');
    const profile = loadProfile('qwen');
    const hints = adapter.assemblyHints();
    assert.equal(hints.family, 'qwen');
    assert.equal(hints.context_window, profile.context_window);
    assert.deepEqual(hints.prefix_cache, { billing_multiplier: profile.prefix_cache.billing, min_tokens: profile.prefix_cache.min_tokens });
    assert.equal(hints.usage_semantics, profile.usage_semantics);
    assert.equal(hints.stream_protocol, profile.stream_protocol);
    assert.equal(hints.fallback_family, 'openai');

    const custom = adapter.assemblyHints({ ...profile, context_window: 999 });
    assert.equal(custom.context_window, 999);
  });

  test('未注册家族 → ADAPTER_NOT_FOUND；非法输入 → ADAPTER_INVALID_INPUT', () => {
    assert.throws(() => getAdapter('ernie'), /ADAPTER_NOT_FOUND/); // FP-010：未覆盖家族走降级链
    assert.throws(() => getAdapter(''), /ADAPTER_NOT_FOUND/);
    assert.throws(() => normalizeStream('not-array', 'openai'), /ADAPTER_INVALID_INPUT/);
  });

  test('listAdapters 摘要齐备；UNKNOWN_EVENT_THRESHOLD=10', () => {
    const list = listAdapters();
    assert.equal(list.length, 8);
    for (const item of list) {
      assert.ok(ADAPTER_FAMILIES.includes(item.family));
      assert.ok(item.capabilities && item.meta);
    }
    assert.equal(UNKNOWN_EVENT_THRESHOLD, 10);
  });
});
