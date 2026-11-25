// tests/toko/pse-stream-endpoint.test.js - FP-TOKO-006 PSE 统一流式事件层单测
// 覆盖：B1 事件全集 Schema / B2 长报告流式（e2e）/ B3 旧通道零影响（既有端点回归）
//       T1 SSE 编解码标准格式 / T2 extra 透传 / T3 整包回退 / T4 MCP 协商回退 / T5 顺序约束
//       I1 usage 写入 FP-TOKO-002 / STREAM_BROKEN
// 运行：node --test tests/toko/pse-stream-endpoint.test.js

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'events';

import { startApiServer } from '../../lib/api-server.js';
import { apiRoutes } from '../../lib/api-routes.js';
import {
  PSE_EVENTS,
  USAGE_SOURCES,
  validateEvent,
  normalizeEvent,
  buildEventStream,
  renderSSE,
  parseSSE
} from '../../lib/streaming/pse-events.js';
import { getSessionRecords, clearSession } from '../../lib/token/estimation-track.js';
import { negotiateTransport, MCP_TRANSPORTS, PDDMCPServer } from '../../lib/mcp-server.js';

const RFC3339_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

/** startApiServer 返回时 listen 尚未完成（异步回调），测试侧等待 listening 后 address() 才可用 */
async function waitForListening(server) {
  if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
  return server;
}

// ==================== B1: 事件全集 Schema ====================

test('B1: PSE 事件全集 11 类 + usage source 取值域（§1.2/§2.2）', () => {
  assert.deepEqual(PSE_EVENTS, [
    'message_start', 'content_delta', 'reasoning_delta', 'tool_delta', 'usage',
    'budget.warning', 'budget.tighten', 'budget.stop_suggested',
    'compaction.suggested', 'done', 'error'
  ]);
  assert.deepEqual(USAGE_SOURCES, ['measured', 'estimated']);
});

test('B1: normalizeEvent 合法 message_start → 公共字段齐备（ts 缺省补齐、degraded 缺省 false）', () => {
  const ev = normalizeEvent({
    event: 'message_start',
    data: { id: 's-001', family: 'openai(fallback)', context_tokens: 6383 }
  });
  assert.equal(ev.event, 'message_start');
  assert.deepEqual(ev.data, { id: 's-001', family: 'openai(fallback)', context_tokens: 6383 });
  assert.match(ev.ts, RFC3339_RE, 'ts 缺省补 RFC3339 当前时间');
  assert.equal(ev.degraded, false);
  assert.equal(ev.extra, undefined, '无透传字段时无 extra 区');
});

test('B1: 各类事件 payload 违例 → null（validateEvent 给出明细）', () => {
  const badCases = [
    [{ event: 'message_start', data: { id: 'x', context_tokens: 0 } }, /family/],
    [{ event: 'content_delta', data: {} }, /text/],
    [{ event: 'reasoning_delta', data: { text: 'x', channel: 'main' } }, /channel/],
    [{ event: 'tool_delta', data: { name: 't', args_fragment: '' } }, /tool_id/],
    [{ event: 'usage', data: { input_tokens: 0, output_tokens: -1, source: 'measured' } }, /output_tokens/],
    [{ event: 'usage', data: { input_tokens: 0, output_tokens: 1, source: 'guessed' } }, /source/],
    [{ event: 'done', data: { usage_total: {} } }, /finish_reason/],
    [{ event: 'error', data: { code: 'X', message: 'm' } }, /retryable/]
  ];
  for (const [raw, pattern] of badCases) {
    assert.equal(normalizeEvent(raw), null, `应判畸形: ${raw.event}`);
    const check = validateEvent(raw);
    assert.equal(check.valid, false);
    assert.match(check.errors.join('; '), pattern);
  }
});

test('B1: 事件类型未知 / data 非对象 / ts 或 degraded 非法 → null', () => {
  assert.equal(normalizeEvent({ event: 'vendor.custom', data: {} }), null, '未知事件类型（R3 记录不静默）');
  assert.equal(normalizeEvent({ event: 'done', data: 'not-object' }), null);
  assert.equal(normalizeEvent({ event: 'done', data: null }), null);
  assert.equal(normalizeEvent({ event: 'done', data: {} }), null, 'data 缺失');
  assert.equal(
    normalizeEvent({ event: 'done', data: { finish_reason: 'x', usage_total: {} }, ts: '2026-11-25 00:00:00' }),
    null, 'ts 非 RFC3339'
  );
  assert.equal(
    normalizeEvent({ event: 'done', data: { finish_reason: 'x', usage_total: {} }, degraded: 'yes' }),
    null, 'degraded 非布尔'
  );
});

// ==================== T2: 透传纪律 ====================

test('T2: 原生未映射字段全部进 extra，无丢弃（R3 前向兼容）', () => {
  const ev = normalizeEvent({
    event: 'usage',
    data: { input_tokens: 10, output_tokens: 20, source: 'measured', tokens_measured: 20 },
    vendor: 'deepseek',
    model_hint: 'deepseek-chat',
    upstream_request_id: 'req-42'
  });
  assert.deepEqual(ev.extra, {
    vendor: 'deepseek',
    model_hint: 'deepseek-chat',
    upstream_request_id: 'req-42'
  });
  // extra 与 data 隔离：data 不含未映射键
  assert.deepEqual(ev.data, { input_tokens: 10, output_tokens: 20, source: 'measured', tokens_measured: 20 });
});

// ==================== T5: 顺序约束 ====================

test('T5: 首事件非 message_start 自动前置合成；缺收尾自动补 done', () => {
  const { events } = buildEventStream([
    { event: 'content_delta', data: { text: '增量' } }
  ]);
  assert.equal(events[0].event, 'message_start', 'message_start 恒为首事件');
  assert.deepEqual(events[0].data, { id: 'pse-stream', family: 'openai(fallback)', context_tokens: 0 });
  assert.equal(events[events.length - 1].event, 'done', 'done 恒为末事件');
  assert.deepEqual(events[events.length - 1].data, { finish_reason: 'complete', usage_total: {} });
  assert.deepEqual(events.map(e => e.event), ['message_start', 'content_delta', 'done']);
});

test('T5: error 恒为末事件——error 后事件截断并记录（异常收尾优先）', () => {
  const trailing = { event: 'done', data: { finish_reason: 'complete', usage_total: {} } };
  const { events, malformed } = buildEventStream([
    { event: 'content_delta', data: { text: 'a' } },
    { event: 'error', data: { code: 'UPSTREAM_FAIL', message: '上游中断', retryable: true } },
    trailing
  ]);
  assert.equal(events[events.length - 1].event, 'error', 'error 收尾（异常优先于 done）');
  assert.equal(events.length, 3);
  assert.equal(malformed.length, 1);
  assert.equal(malformed[0].reason, 'TRUNCATED_AFTER_ERROR');
  assert.deepEqual(malformed[0].raw, trailing, '截断载荷原文保留（R3 不丢弃）');
});

test('T5: done 恒为末事件——done 后事件截断记录', () => {
  const { events, malformed } = buildEventStream([
    { event: 'done', data: { finish_reason: 'complete', usage_total: {} } },
    { event: 'content_delta', data: { text: '迟到增量' } }
  ]);
  assert.equal(events[events.length - 1].event, 'done');
  assert.equal(events.length, 2); // 合成 message_start + done
  assert.equal(malformed[0].reason, 'TRUNCATED_AFTER_DONE');
});

test('buildEventStream 输入非数组 / R3 畸形事件保留原文', () => {
  assert.throws(() => buildEventStream('not-array'), /EVENT_MALFORMED/);
  const badRaw = { event: 'vendor.custom', data: { foo: 1 } };
  const { events, malformed } = buildEventStream([badRaw]);
  assert.equal(malformed.length, 1);
  assert.equal(malformed[0].reason, 'EVENT_MALFORMED');
  assert.deepEqual(malformed[0].raw, badRaw, '原始载荷完整保留');
  assert.equal(malformed[0].detail.includes('PSE_EVENTS'), true);
  // 全畸形 → 仅剩合成首尾事件，流仍成立
  assert.deepEqual(events.map(e => e.event), ['message_start', 'done']);
});

// ==================== I1: usage 写入 FP-TOKO-002 ====================

test('I1: usage(source=measured) 写入消耗记录（tokens_measured 主值）；estimated 走估算轨', () => {
  const sid = 'fp006-i1-usage';
  try {
    const { events, usage_recorded } = buildEventStream([
      {
        event: 'usage',
        data: { input_tokens: 100, output_tokens: 250, cached_tokens: 80, source: 'measured' },
        vendor: 'openai'
      },
      {
        event: 'usage',
        data: { input_tokens: 50, output_tokens: 60, source: 'estimated' }
      },
      { event: 'done', data: { finish_reason: 'complete', usage_total: {} } }
    ], { sessionId: sid, phase: 'impl', family: 'openai' });

    assert.equal(usage_recorded, 2);
    const records = getSessionRecords(sid);
    assert.equal(records.length, 2, '两条 usage 事件各写入一条消耗记录（006→002 写入方向）');

    const measured = records.find(r => r.source === 'measured');
    assert.equal(measured.session_id, sid);
    assert.equal(measured.phase, 'impl');
    assert.equal(measured.tokens_measured, 250, 'FP-002 R1：measured 主值 = output_tokens');
    assert.equal(measured.tokens_est, 250, 'usage 事件无独立估算值，tokens_est 同值（偏差恒 0）');
    assert.equal(measured.content_type, 'mixed');
    assert.equal(measured.family, 'openai');
    assert.equal(typeof measured.record_id, 'string');
    assert.equal(typeof measured.ts, 'string', '§2.1 consumption-record 必带 RFC3339 ts（透传事件时间戳）');

    const estimated = records.find(r => r.source === 'estimated');
    assert.equal(estimated.tokens_est, 60);
    assert.equal(estimated.tokens_measured, undefined, 'estimated 记录不携带实测主值（FP-002 R1）');
    assert.equal(events.filter(e => e.event === 'usage').length, 2, 'usage 事件本身仍正常下发');
    assert.equal(events.find(e => e.event === 'usage').extra.vendor, 'openai', 'usage 事件透传区保留');
  } finally {
    clearSession(sid);
  }
});

// ==================== T1: SSE 编解码 ====================

test('T1: renderSSE/parseSSE 往返（标准 SSE 格式，事件零失真）', () => {
  const evts = [
    normalizeEvent({ event: 'message_start', data: { id: 'r1', family: 'qwen', context_tokens: 100 } }),
    normalizeEvent({ event: 'content_delta', data: { text: '第一段' } }),
    normalizeEvent({ event: 'done', data: { finish_reason: 'complete', usage_total: {} } })
  ];
  const sse = renderSSE(evts);
  // 标准格式锚定：event:/data: 行 + 空行分隔
  assert.match(sse, /^event: message_start\ndata: /);
  assert.equal(sse.includes('\n\n'), true, '事件以空行分隔');
  const parsed = parseSSE(sse);
  assert.equal(parsed.length, 3);
  assert.deepEqual(parsed.map(p => p.event), ['message_start', 'content_delta', 'done']);
  // 线格式：data 行携带完整 PSEEvent JSON（事件级保真，客户端零信息损失）
  assert.deepEqual(parsed[1].data, evts[1], 'PSEEvent JSON 零失真往返');
  assert.equal(parsed[0].data.data.id, 'r1');
  // data 内含换行也能往返（JSON 序列化转义）
  const withNewline = normalizeEvent({ event: 'content_delta', data: { text: 'a\nb' } });
  assert.deepEqual(parseSSE(renderSSE([withNewline]))[0].data, withNewline);
});

test('T1: parseSSE 忽略注释与逐出字段；多行 data 按 \n 拼接', () => {
  const sse = ': ping\n\nid: 42\nevent: content_delta\ndata: {"text":"l1"}\n\n';
  const parsed = parseSSE(sse);
  assert.equal(parsed.length, 1, '注释块与 id 字段不产生事件');
  assert.deepEqual(parsed[0].data, { text: 'l1' });
});

// ==================== HTTP 集成（e2e）：B2 / B3 / T3 ====================

test('B2: 长报告经 /v1/stream 分段 SSE 推送（首尾约束 + usage 遥测）', async () => {
  const server = await waitForListening(await startApiServer({ port: 0, host: '127.0.0.1', rateLimit: { enabled: false } }));
  const port = server.address().port;
  try {
    const report = Array.from({ length: 30 }, (_, i) => `## 章节 ${i + 1}\n\n报告正文段落 ${i + 1}：权益变更扫描结论。`).join('\n\n');
    const resp = await fetch(`http://127.0.0.1:${port}/v1/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body: JSON.stringify({ text: report, sessionId: 'fp006-e2e', phase: 'impl', id: 'report-stream' })
    });
    assert.equal(resp.status, 200);
    assert.equal(resp.headers.get('content-type').includes('text/event-stream'), true, 'SSE Content-Type');
    const parsed = parseSSE(await resp.text());
    assert.equal(parsed[0].event, 'message_start', 'T5 首事件');
    assert.equal(parsed[0].data.data.id, 'report-stream', '线格式 data=完整 PSEEvent');
    assert.equal(parsed[parsed.length - 1].event, 'done', 'T5 末事件');
    const deltas = parsed.filter(p => p.event === 'content_delta');
    assert.equal(deltas.length, 60, '按段落切块：30 元素 × （标题+正文）= 60 段逐段推送（B2 边生成边推送）');
    const usageEv = parsed.find(p => p.event === 'usage');
    assert.equal(usageEv.data.data.source, 'estimated', '端点侧估算兜底（§2.2）');
    assert.ok(usageEv.data.data.output_tokens > 0, 'usage 遥测有值');
  } finally {
    clearSession('fp006-e2e');
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
  }
});

test('T3: Accept 不支持 SSE → 整包 JSON 回退（STREAM_UNSUPPORTED，3.4.x 包裹形状）', async () => {
  const server = await waitForListening(await startApiServer({ port: 0, host: '127.0.0.1', rateLimit: { enabled: false } }));
  const port = server.address().port;
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/v1/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ chunks: ['a', 'b'] })
    });
    assert.equal(resp.status, 200);
    assert.equal(resp.headers.get('content-type').includes('application/json'), true);
    const json = await resp.json();
    assert.equal(json.success, true, '3.4.x 包裹形状 {success,data,timestamp}');
    assert.equal(typeof json.timestamp, 'string');
    assert.equal(json.data.notice, 'STREAM_UNSUPPORTED');
    assert.equal(json.data.mode, 'json');
    assert.equal(json.data.events[0].event, 'message_start');
    assert.equal(json.data.events[json.data.events.length - 1].event, 'done');
    assert.equal(json.data.events.filter(e => e.event === 'content_delta').length, 2);
  } finally {
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
  }
});

test('B3: 既有 REST 端点回归——/v1/stream 纯新增不影响既有 JSON 分支', async () => {
  const server = await waitForListening(await startApiServer({ port: 0, host: '127.0.0.1', rateLimit: { enabled: false } }));
  const port = server.address().port;
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/api/v1/status`);
    assert.equal(resp.status, 200);
    assert.equal(resp.headers.get('content-type').includes('application/json'), true);
    const json = await resp.json();
    assert.equal(json.success, true);
    assert.equal(json.data.name, 'PDD-Skills API Server');
    assert.equal(json.data.endpoints, 18, '既有 17 端点 + /v1/stream 纯新增 1 条（apiRoutes.length）');
    // 既有端点在 apiRoutes 中路径与方法零变化（R2 抽样锚定）
    const paths = apiRoutes.map(r => `${r.method} ${r.path}`);
    for (const p of ['GET /api/v1/status', 'POST /api/v1/report', 'GET /api/v1/skills/:category/:name']) {
      assert.equal(paths.includes(p), true, `既有端点保留: ${p}`);
    }
  } finally {
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
  }
});

// ==================== STREAM_BROKEN ====================

test('STREAM_BROKEN: 连接中断 → error{retryable:true} 恒为末事件 + 断点续传建议', async () => {
  const handler = apiRoutes.find(r => r.path === '/v1/stream').handler;
  class FakeRes extends EventEmitter {
    constructor() {
      super();
      this.statusCode = null;
      this.headers = null;
      this.chunks = [];
      this.writableEnded = false;
    }
    writeHead(code, h) { this.statusCode = code; this.headers = h; }
    write(chunk) {
      this.chunks.push(chunk);
      if (this.chunks.length === 2) this.emit('close', ); // 模拟第 2 个事件写出后连接中断
      return true;
    }
    end() { this.writableEnded = true; return this; }
  }
  const res = new FakeRes();
  const result = await handler({
    req: null, res,
    body: { chunks: ['a', 'b', 'c'] },
    headers: { accept: 'text/event-stream' }
  });
  assert.equal(result.mode, 'sse');
  assert.equal(result.broken, true, '中断被检出（writableEnded=false 时 close）');
  assert.ok(result.pushed < 5, '中断后停止后续推送');
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'].includes('text/event-stream'), true);
  const parsed = parseSSE(res.chunks.join(''));
  const last = parsed[parsed.length - 1];
  assert.equal(last.event, 'error', 'error 恒为末事件（§1.4）');
  assert.equal(last.data.data.code, 'STREAM_BROKEN', '线格式 data=完整 PSEEvent');
  assert.equal(last.data.data.retryable, true);
  assert.match(last.data.data.message, /断点续传/);
});

test('SSE 正常收尾的 close 不误判 broken（writableEnded 区分）', async () => {
  const handler = apiRoutes.find(r => r.path === '/v1/stream').handler;
  class FakeRes extends EventEmitter {
    constructor() { super(); this.chunks = []; this.writableEnded = false; }
    writeHead() {}
    write(c) { this.chunks.push(c); return true; }
    end() {
      this.writableEnded = true;
      this.emit('close'); // 正常收尾后 close 也触发（Node ServerResponse 语义）
      return this;
    }
  }
  const res = new FakeRes();
  const result = await handler({
    req: null, res,
    body: { chunks: ['x'] },
    headers: { accept: 'text/event-stream' }
  });
  assert.equal(result.broken, false, '正常收尾不误判');
  const parsed = parseSSE(res.chunks.join(''));
  assert.equal(parsed[parsed.length - 1].event, 'done');
});

// ==================== T4: MCP 协商回退 ====================

test('T4: negotiateTransport——支持 Streamable HTTP 的 client 协商成功，旧 client 回退 stdio', () => {
  assert.equal(negotiateTransport({ transports: ['stdio', 'streamable-http'] }), 'streamable-http');
  assert.equal(negotiateTransport({ transports: ['streamable-http'] }), 'streamable-http');
  assert.equal(negotiateTransport({ transport: 'streamable-http' }), 'streamable-http', '单值声明形式');
  assert.equal(negotiateTransport({ transports: ['stdio'] }), 'stdio', '不支持 → 回退');
  assert.equal(negotiateTransport({}), 'stdio', '空声明 → 回退');
  assert.equal(negotiateTransport(undefined), 'stdio', '旧 client 无声明 → 回退');
  assert.deepEqual([...MCP_TRANSPORTS], ['stdio', 'streamable-http']);
});

test('T4: initialize 声明 transports 能力（既有 tools/resources 零改动）', async () => {
  const server = new PDDMCPServer();
  const result = await server._processRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' });
  assert.deepEqual(result.result.capabilities.transports, ['stdio', 'streamable-http']);
  assert.deepEqual(Object.keys(result.result.capabilities).filter(k => ['tools', 'resources'].includes(k)), ['tools', 'resources'], '既有能力声明保留');
  assert.equal(result.result.serverInfo.name, 'pdd-mcp-server');
});
