# FP-TOKO-010 fallback-chain 开发规格

## 基本信息

| 项目 | 内容 |
|------|------|
| 功能点ID | FP-TOKO-010 |
| 名称 | 模型家族降级链（T2） |
| 版本 | v1.0 |
| 日期 | 2026-11-24 |
| 来源 | docs/plans/05 §4.5、§5.2、§6-T2 |
| 优先级 | P1 |
| 范围 | 仅规格；本 FP 不实现 |

## 1. 接口定义

### 1.1 模块导出（设计约定）

| 导出 | 类型 | 说明 |
|------|------|------|
| `classify(error)` | 函数 | 错误归类（4 类，见 §2.1） |
| `degrade(errorClass, currentFamily)` | 函数 | 返回降级决策：fallback_family 适配器 / 整包回退 / 估算轨接管 |
| `getDegradationTrace(sessionId)` | 函数 | 输出降级轨迹（审计用） |

### 1.2 错误码与决策表

| 错误类 | 判定 | 策略 |
|--------|------|------|
| retryable_stream_error | SSE 中断但已收到 content | `error{retryable:true}` + 断点续传建议（宿主决策） |
| family_protocol_drift | UnknownEvent ≥ 阈值 | 自动降级 `fallback_family` 适配器；事件标 `degraded:true` |
| streaming_unsupported | capabilities.streaming=false | 整包响应（=3.4.x 行为，天然向后兼容） |
| usage_missing | 流尾无 usage | 估算轨接管，manifest 标 `source:"estimated"` |

### 1.3 扩展家族验证范围

ERNIE / MiniMax / xAI：走 OpenAI 兼容降级链，T2 阶段仅验证（不出独立适配器）。

## 2. 数据模型

### 2.1 降级轨迹记录

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| session_id | string | 是 | 会话标识 |
| from_family | string | 是 | 原家族 |
| to_family | string | 否 | 降级目标（整包/估算轨时为空） |
| error_class | enum | 是 | 4 类错误枚举 |
| strategy | enum | 是 | `fallback_adapter` / `non_stream_fallback` / `estimated_track` |
| degraded | boolean | 是 | 下发事件标记 degraded=true |
| ts | string(RFC3339) | 是 | 时间 |

### 2.2 枚举值定义

| 字段 | 值 | 含义 |
|------|-----|------|
| error_class | retryable_stream_error / family_protocol_drift / streaming_unsupported / usage_missing | doc 05 §4.5 分类 |
| strategy | fallback_adapter / non_stream_fallback / estimated_track | 三种降级策略 |

## 3. 业务逻辑

### 3.1 处理流程

1. 捕获流式异常/异常计数 → 2. classify 归类 → 3. 按决策表选策略 → 4. 切换适配器或回退整包/估算轨 → 5. 下游事件标 degraded=true（extra 保留原始字段）→ 6. 轨迹记录供审计

### 3.2 业务规则

| 规则ID | 规则描述 | 约束类型 | 优先级 |
|--------|---------|---------|--------|
| R1 | 降级后行为必须可用：fallback 适配器 = OpenAI 兼容兜底；整包回退 = 3.4.x 行为 | 强制 | P0 |
| R2 | 降级不丢弃原始事件字段（extra 透传） | 强制 | P0 |
| R3 | 每会话降级次数上限 2 次，超限上报 error 并终止流（避免降级风暴） | 强制 | P1 |
| R4 | 降级轨迹可审计、可回放 | 强制 | P1 |

### 3.3 状态转换

normal →（drift）fallback_adapter；normal →（unsupported）non_stream_fallback；normal →（usage_missing）estimated_track；任一降级态 →（再异常且未超限）再降级；超限 → 终止流。

## 4. 不适用章节说明

前端页面/前端实现约定/关联数据源/权限与安全：N/A（容错层能力）。

## 5. 依赖检查清单

| 方向 | 依赖 | 说明 |
|------|------|------|
| 前置 | FP-TOKO-006（事件通道/degraded 标记）/ FP-TOKO-007（适配器与 capabilities） | — |
| 后续 | FP-TOKO-014（发版核验含降级链用例） | — |
| 外部 | ERNIE/MiniMax/xAI 兼容性验证样本 | 仅 T2 验证期需要 |
