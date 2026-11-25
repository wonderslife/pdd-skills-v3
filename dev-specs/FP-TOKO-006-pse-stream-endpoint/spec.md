# FP-TOKO-006 pse-stream-endpoint 开发规格

## 基本信息

| 项目 | 内容 |
|------|------|
| 功能点ID | FP-TOKO-006 |
| 名称 | PSE 统一流式事件层（T2） |
| 版本 | v1.0 |
| 日期 | 2026-11-24 |
| 来源 | docs/plans/05 §4.1、§4.6、附录 B |
| 优先级 | P0 |
| 范围 | 仅规格；本 FP 不实现 |

## 1. 接口定义

### 1.1 API 列表

| 序号 | 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|------|
| 1 | POST | `/v1/stream` | SSE 流式输出（`Content-Type: text/event-stream`），承载平台产物与 usage 遥测 | 沿用宿主既有通道约定 |
| 2 | POST | `/api/v1/report`（既有整包端点，不变） | 对照组：整包响应（=3.4.x 行为，向后兼容锚点；api-routes.js 既有注册） | 同上 |

> 前缀声明：既有端点统一前缀 `/api/v1/*`；新增 `/v1/stream` 采用独立前缀，属 doc 05 §4.6 有意设计，实施时不得将两类前缀"统一化"（避免破坏契约快照边界）。

### 1.2 PSE 事件 Schema（事件全集）

| 事件 | payload | 说明 |
|------|---------|------|
| `message_start` | `{ id, family, context_tokens }` | 流开始 |
| `content_delta` | `{ text }` | 增量文本 |
| `reasoning_delta` | `{ text, channel: "reasoning" }` | 推理通道增量 |
| `tool_delta` | `{ tool_id, name, args_fragment }` | 工具调用增量 |
| `usage` | `{ input_tokens, output_tokens, cached_tokens?, source: "measured" }` | 计量归一 |
| `budget.warning` / `budget.tighten` / `budget.stop_suggested` | 见 FP-TOKO-008 | 预算事件 |
| `compaction.suggested` | 见 FP-TOKO-012 §2.1 压实建议结构 | 会话压实建议（FP-TOKO-012） |
| `done` | `{ finish_reason, usage_total }` | 流结束 |
| `error` | `{ code, message, retryable }` | 归一错误 |

公共字段：`ts`（RFC3339）、`degraded`（boolean，降级链标记）。未覆盖字段一律透传至 `PSEEvent.extra`，**禁止丢弃**（前向兼容，doc 05 §4.3 映射纪律）。

### 1.3 MCP 通道

- 声明支持 Streamable HTTP transport；旧 client 经 Negotiate 自动回退（doc 05 §4.6）；
- 新增 resource `pdd://context/manifest`（FP-TOKO-003），既有 resource 零改动。

### 1.4 错误码

| 错误 | 触发 | 处理 |
|------|------|------|
| STREAM_UNSUPPORTED | 客户端/环境不支持 SSE | 整包响应回退（与 3.4.x 行为一致） |
| EVENT_MALFORMED | 事件不合 Schema | 不下发，记录并继续后续事件 |
| STREAM_BROKEN | SSE 连接中断且已有 content | `error{retryable:true}` + 断点续传建议（宿主决策） |

## 2. 数据模型

### 2.1 事件流（PSEEvent）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| event | enum | 是 | 8 类事件名 |
| data | object | 是 | 对应 payload |
| ts | string(RFC3339) | 是 | 时间戳 |
| degraded | boolean | 是 | 是否降级产出（默认 false） |
| extra | object | 否 | 原生字段透传区 |

### 2.2 枚举值定义

| 字段 | 值 | 含义 |
|------|-----|------|
| event | message_start / content_delta / reasoning_delta / tool_delta / usage / budget.warning / budget.tighten / budget.stop_suggested / compaction.suggested / done / error | 事件全集 |
| source（usage） | measured / estimated | 实测优先，估算兜底 |

## 3. 业务逻辑

### 3.1 处理流程

1. 平台侧产物生成（报告/扫描/计量）→ 2. 组装 PSE 事件序列 → 3. 经 `/v1/stream` 以 SSE 推送 → 4. 宿主消费 → 5. `done` 收尾（含 usage_total）→ 6. 任何异常走 `error` 归一分类

### 3.2 业务规则

| 规则ID | 规则描述 | 约束类型 | 优先级 |
|--------|---------|---------|--------|
| R1 | PSE 只承载**平台侧产物**的流式化 + usage 遥测，**不介入宿主与供应商的生成链路** | 强制 | P0 |
| R2 | 既有 REST 17 端点请求/响应字节级不变；`/v1/stream` 为纯新增 | 强制 | P0 |
| R3 | 未知事件类型不得静默丢弃，透传 extra | 强制 | P0 |
| R4 | CLI（bin/pdd.js）行为不变 | 强制 | P1 |

### 3.3 状态转换

连接建立（message_start）→ 增量推送（content/reasoning/tool/usage/budget.*）→ 正常收尾（done）| 异常收尾（error，可含 retryable）。

## 4. 不适用章节说明

前端页面/前端实现约定/关联数据源：N/A（API 层能力）；权限与安全：沿用 api-server 既有约定，本 FP 不新增鉴权面。

## 5. 依赖检查清单

| 方向 | 依赖 | 说明 |
|------|------|------|
| 前置（规格） | FP-TOKO-002 | estimated 兜底数据源；同时为 usage 事件记录写入方（006→002 写入方向） |
| 运行时上游 | FP-TOKO-007 | measured 事件生产者：适配器 normalize → 本通道下发（数据流 007→006→008→002） |
| 后续 | FP-TOKO-007（适配器产出 PSE 事件）/ FP-TOKO-008（budget.* 事件）/ FP-TOKO-010（degraded 标记） | — |
| 外部 | 无 | 纯输出通道 |
