# FP-TOKO-002 budget-estimation-track 开发规格

## 基本信息

| 项目 | 内容 |
|------|------|
| 功能点ID | FP-TOKO-002 |
| 名称 | 预算估算轨（T0 基线标定） |
| 版本 | v1.0 |
| 日期 | 2026-11-24 |
| 来源 | docs/plans/05 §3.3.1、§6-T0 |
| 优先级 | P0 |
| 范围 | 仅规格；本 FP 不实现 |

## 1. 接口定义

### 1.1 模块导出（设计约定）

| 导出 | 类型 | 说明 |
|------|------|------|
| `estimateTokens(content, contentType, family)` | 函数 | 估算轨入口：经 FP-TOKO-001 profile 系数计算 |
| `recordConsumption(record)` | 函数 | 写入消耗记录（估算轨先行，实测轨由 FP-TOKO-008 回填） |
| `getPhaseDistribution(sessionId)` | 函数 | 输出 5 阶段（analysis/design/impl/review/verify）消耗分布 |

### 1.2 与 budget-manager 的关系（红线）

- `lib/token/budget-manager.js` **类签名零改动**（doc 05 §0.2）；新增能力以**可选事件订阅/外部模块**形式接入；
- 沿用既有 DEFAULT_ALLOCATION（20/15/40/15/10）与预警阈值。

### 1.3 错误码

| 错误 | 触发 | 处理 |
|------|------|------|
| ESTIMATE_WITHOUT_PROFILE | family 无 profile | 降级 openai(fallback) 并在记录标注 |
| RECORD_MALFORMED | 记录缺必填字段 | 拒绝写入并 WARN |

## 2. 数据模型

### 2.1 消耗记录（consumption-record）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| session_id | string | 是 | 会话标识 |
| phase | enum | 是 | `analysis` / `design` / `impl` / `review` / `verify`（取 budget-manager PHASES **值**，非键） |
| tokens_est | number | 是 | 估算轨 token 数 |
| tokens_measured | number | 否 | 实测轨（供应商 usage 回填，FP-TOKO-008） |
| source | enum | 是 | `estimated` / `measured` |
| content_type | enum | 是 | `zh` / `en` / `code` / `mixed` |
| family | string | 是 | tokenizer family |
| ts | string(RFC3339) | 是 | 记录时间 |
| artifact_ref | string | 否 | 关联产物（如 manifest id） |

### 2.2 枚举值定义

| 字段 | 值 | 含义 |
|------|-----|------|
| source | estimated / measured | 计数来源；实测优先，估算兜底 |
| phase | analysis / design / impl / review / verify | 与 budget-manager PHASES 值严格一致 |

## 3. 业务逻辑

### 3.1 处理流程

1. 内容进入 → 2. 按 profile 分段估算（R1：禁字符直报）→ 3. 写入 consumption-record（source=estimated）→ 4. 阶段内累计并与阶段预算比较 → 5. 实测回填时覆盖同记录（source=measured）→ 6. 输出阶段分布与估算/实测偏差报告

### 3.2 业务规则

| 规则ID | 规则描述 | 约束类型 | 优先级 |
|--------|---------|---------|--------|
| R1 | 同一记录实测覆盖估算，不得并存双主值 | 强制 | P0 |
| R2 | budget-manager 类签名/既有调用点零改动 | 强制 | P0 |
| R3 | 估算/实测偏差 >10% 触发 profile 复标建议（对接 FP-TOKO-001 PROFILE_STALE） | 建议 | P1 |
| R4 | 记录不落盘持久化（会话内存态），跨会话统计为后续独立能力 | 强制 | P1 |

### 3.3 状态转换

估算轨记录（estimated）→ 收到 usage 事件（FP-TOKO-008）→ 实测记录（measured）；无 usage → 保持 estimated 并在报告标注。

## 4. 不适用章节说明

前端页面/前端实现约定/关联数据源/路由注册：N/A（平台库能力）；权限与安全：N/A（进程内记账，无鉴权面）。

## 5. 依赖检查清单

| 方向 | 依赖 | 说明 |
|------|------|------|
| 前置 | FP-TOKO-001 | estimateTokens 必须经 profile |
| 后续 | FP-TOKO-003（manifest.budget_state）/ FP-TOKO-006（usage 事件）/ FP-TOKO-008（实测回填+熔断）/ FP-TOKO-013（cost 子项） | — |
| 外部 | 无运行时外部依赖 | — |
