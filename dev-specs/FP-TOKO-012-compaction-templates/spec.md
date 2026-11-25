# FP-TOKO-012 compaction-templates 开发规格

## 基本信息

| 项目 | 内容 |
|------|------|
| 功能点ID | FP-TOKO-012 |
| 名称 | 多轮会话上下文压实模板（T3） |
| 版本 | v1.0 |
| 日期 | 2026-11-24 |
| 来源 | docs/plans/05 §3.3.3、§6-T3 |
| 优先级 | P1 |
| 范围 | 仅规格；本 FP 不实现 |

## 1. 接口定义

### 1.1 模块导出（设计约定）

| 导出 | 类型 | 说明 |
|------|------|------|
| `shouldCompact(session)` | 函数 | 判定是否输出压实建议：第 4 轮起且历史占用 > 阶段预算 50% |
| `getTemplate(taskType)` | 函数 | 返回压实模板（保留/丢弃清单） |
| `compaction.suggested` 事件 | PSE 事件 | 经 FP-TOKO-006 通道下发（已纳入其 §2.2 事件全集），payload 见本 spec §2.1，由宿主 Agent 决策执行 |

### 1.2 压实模板 Schema

```jsonc
{
  "template_id": "pdd-default",
  "keep": ["decisions", "contracts", "acceptance_criteria", "open_questions"],
  "discard": ["intermediate_exploration", "failed_attempts_fulltext", "superseded_artifacts"],
  "ratio_target": 0.5                 // 压实后历史占用目标 ≤ 原占用的 50%
}
```

### 1.3 错误码

| 错误 | 触发 | 处理 |
|------|------|------|
| TEMPLATE_MISSING | taskType 无模板 | 回退 pdd-default 模板 |
| COMPACT_REJECTED | 宿主拒绝建议 | 记录决策，本会话不再重复建议 |

## 2. 数据模型

### 2.1 压实建议

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| session_id | string | 是 | 会话标识 |
| turn_index | number | 是 | 当前轮次（≥4 才可触发） |
| history_ratio | number | 是 | 历史占用/阶段预算 |
| template_id | string | 是 | 选用的模板 |
| keep | array | 是 | 保留要素清单 |
| discard | array | 是 | 丢弃要素清单 |

### 2.2 枚举值定义

| 字段 | 值 | 含义 |
|------|-----|------|
| keep 要素 | decisions / contracts / acceptance_criteria / open_questions | 决策、契约、验收标准、未决问题 |
| discard 要素 | intermediate_exploration / failed_attempts_fulltext / superseded_artifacts | 中间探索、失败尝试原文、被取代产物 |

## 3. 业务逻辑

### 3.1 处理流程

1. 会话轮次与历史占用监测 → 2. 满足触发条件输出建议事件 → 3. 宿主决策执行压实 → 4. 压实后重跑 FP-TOKO-005 前缀稳定化审计 → 5. 记录效果（第 4 轮起历史占用 -30% 目标）

### 3.2 业务规则

| 规则ID | 规则描述 | 约束类型 | 优先级 |
|--------|---------|---------|--------|
| R1 | **平台只定义模板与触发建议，不自动改写历史**——执行权在宿主（功能语义零变更红线） | 强制 | P0 |
| R2 | 保留要素（决策/契约/验收标准）不得进入 discard 清单 | 强制 | P0 |
| R3 | 每会话最多输出一次压实建议（被拒绝后不再重复） | 强制 | P1 |
| R4 | 压实后装配计划必须重新通过前缀稳定化审计 | 强制 | P0 |

### 3.3 状态转换

monitoring →（turn≥4 且 ratio>50%）suggested → 宿主接受 → compacted；宿主拒绝 → monitoring（不再建议）。

## 4. 不适用章节说明

前端页面/前端实现约定/关联数据源/权限与安全：N/A（会话治理层能力）。

## 5. 依赖检查清单

| 方向 | 依赖 | 说明 |
|------|------|------|
| 前置 | FP-TOKO-003（装配计划）/ FP-TOKO-006（事件通道）/ FP-TOKO-008（预算状态） | — |
| 后续 | FP-TOKO-014（M3 长会话 ≥55% 目标核算） | — |
| 外部 | 无 | — |
