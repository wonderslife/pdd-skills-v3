# FP-TOKO-007 mssa-adapters 开发规格

## 基本信息

| 项目 | 内容 |
|------|------|
| 功能点ID | FP-TOKO-007 |
| 名称 | MSSA 模型流式适配器（T2） |
| 版本 | v1.0 |
| 日期 | 2026-11-24 |
| 来源 | docs/plans/05 §4.2、§4.3、§4.4、§6-T2 |
| 优先级 | P0 |
| 范围 | 仅规格；本 FP 不实现 |

## 1. 接口定义

### 1.1 适配器 SPI（TypeScript 表达，实现为 ESM JS；以插件规范打包）

```ts
interface MSSAAdapter {
  family: string;                     // openai|anthropic|gemini|deepseek|qwen|glm|kimi|doubao
  capabilities: AdapterCapabilities;  // §1.3 能力声明
  normalize(rawEvent: RawEvent): PSEEvent[];              // 原生事件 → PSE
  estimateTokens(content: string, contentType: 'zh'|'en'|'code'): number;  // 经 FP-TOKO-001 profile
  assemblyHints(profile: TokenizerProfile): AssemblyHints;
}
```

### 1.2 打包约定

| 项 | 约定 |
|----|------|
| 插件声明 | `plugin.json` 声明 `provides: "mssa-adapter"`（复用现有插件机制） |
| 版本声明 | 每适配器含 `tested_at` + `upstream_version`；供应商 API 变更只改 adapter 文件，PSE 规范版本不变 |
| 存放路径 | `lib/streaming/adapters/{family}/` |

### 1.3 AdapterCapabilities Schema

```jsonc
{
  "streaming": true,
  "tool_call_streaming": "incremental" | "aggregated" | "none",
  "reasoning_channel": "dedicated_field" | "interleaved" | "none",
  "usage_reporting": "tail_chunk" | "start_and_delta" | "in_stream" | "unsupported",
  "prefix_cache": { "billing_multiplier": 0.5, "min_tokens": 1024 },
  "max_context": 131072,
  "sse_transport": "openai-style" | "mcp-streamable-http",
  "fallback_family": "openai"
}
```

### 1.4 错误码

| 错误 | 触发 | 处理 |
|------|------|------|
| UNKNOWN_EVENT | normalize 遇到未映射原生事件 | 透传至 PSEEvent.extra 并计数；累计≥阈值触发降级（FP-TOKO-010） |
| CAPABILITY_MISMATCH | 能力声明与实际行为不符 | 契约测试失败，禁止发布该适配器 |

## 2. 数据模型

### 2.1 协议映射总表（核心，8 家族 × 5 事件）

| PSE 事件 | OpenAI | Anthropic | Gemini | DeepSeek | Qwen(DashScope) | GLM | Kimi | Doubao(方舟) |
|---|---|---|---|---|---|---|---|---|
| content_delta | choices[].delta.content | content_block_delta(text_delta) | candidates[].content.parts[].text | delta.content | output.text | delta.content | delta.content | delta.content |
| reasoning_delta | delta.reasoning(o系) | thinking_delta | thought parts | delta.reasoning_content | output.reasoning_content/thinking | delta.thinking | —(部分) | delta.reasoning_content |
| tool_delta | delta.tool_calls[].function.arguments | input_json_delta | functionCall(聚合) | 同 OpenAI | message.tool_calls | 同 OpenAI | 同 OpenAI | 同 OpenAI |
| usage | 末 chunk(stream_options) | message_start+message_delta | usageMetadata 随流 | 末 chunk usage | 末 usage | 末 usage | 末 usage | 末 usage+方舟扩展 |
| done | finish_reason=stop | message_delta(stop_reason) | finishReason=STOP | finish_reason | finish | finish | finish | finish |

### 2.2 枚举值定义

见 §1.3 capabilities 枚举；测试夹具样本来源标记：`recorded`（录制真实 SSE）/ `synthetic`（构造样本）。

## 3. 业务逻辑

### 3.1 处理流程

1. 接入原生 SSE 事件流 → 2. 按家族适配器 normalize → 3. 产出 PSE 事件（FP-TOKO-006 规范）→ 4. 未映射事件透传 extra 并计数 → 5. 计数超阈值上报降级 → 6. 契约测试夹具回放断言

### 3.2 业务规则

| 规则ID | 规则描述 | 约束类型 | 优先级 |
|--------|---------|---------|--------|
| R1 | 每适配器配契约测试夹具（录制真实 SSE 样本回放，断言归一化结果） | 强制 | P0 |
| R2 | 未覆盖字段透传 extra，禁止丢弃 | 强制 | P0 |
| R3 | 适配器独立版本，PSE 规范版本不受供应商变更影响 | 强制 | P0 |
| R4 | estimateTokens 必须经 FP-TOKO-001 profile，不得自造系数 | 强制 | P0 |

### 3.3 状态转换

适配器 active → UnknownEvent 计数超阈值 → 上报降级建议（degraded 流转 FP-TOKO-010）→ 修复/复标 → active。

## 4. 不适用章节说明

前端页面/前端实现约定/关联数据源：N/A（适配层能力）；权限与安全：N/A（不新增网络监听面，仅协议转换）。

## 5. 依赖检查清单

| 方向 | 依赖 | 说明 |
|------|------|------|
| 前置 | FP-TOKO-001（profile）/ FP-TOKO-006（PSE 目标格式） | — |
| 后续 | FP-TOKO-010（降级链消费 capabilities 与 UnknownEvent 计数） | — |
| 外部 | 8 家族真实 SSE 样本（录制一次，回放断言；录制期允许网络访问） | — |
