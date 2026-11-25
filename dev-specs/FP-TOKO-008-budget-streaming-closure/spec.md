# FP-TOKO-008 budget-streaming-closure 开发规格

## 基本信息

| 项目 | 内容 |
|------|------|
| 功能点ID | FP-TOKO-008 |
| 名称 | 预算流式闭环：usage 回填 + 三级软熔断（T2） |
| 版本 | v1.0 |
| 日期 | 2026-11-24 |
| 来源 | docs/plans/05 §3.3.2、§6-T2 |
| 优先级 | P0 |
| 范围 | 仅规格；本 FP 不实现 |

## 1. 接口定义

### 1.1 事件定义（经 FP-TOKO-006 通道下发）

| 事件 | 触发条件（占阶段预算） | 建议动作 |
|------|----------------------|---------|
| `budget.warning` | 70% | 模型收到一句话成本提示（不改变任务） |
| `budget.tighten` | 85% | 建议跳过 Tier 2 装配、摘要更激进（Digest max_items 收紧为 5） |
| `budget.stop_suggested` | 100% | 建议终止本轮生成，产出已有部分结果 + 未完成清单 |

### 1.2 usage 回填接口

| 导出 | 类型 | 说明 |
|------|------|------|
| `onUsageEvent(pseUsage)` | 订阅 | 消费 FP-TOKO-006 `usage` 事件 → 写入 FP-TOKO-002 消耗记录（source=measured） |
| `getLadderState(sessionId, phase)` | 函数 | 返回当前熔断梯级（none/warning/tighten/stop_suggested） |

### 1.3 错误码

| 错误 | 触发 | 处理 |
|------|------|------|
| USAGE_MISSING | 流尾部无 usage | 估算轨接管（FP-TOKO-002），manifest 标注 source=estimated |
| LADDER_REGRESSION | 梯级回退（如 tighten→warning） | 视为异常，WARN 并保持最高已达梯级 |

## 2. 数据模型

### 2.1 熔断梯级状态

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| session_id | string | 是 | 会话标识 |
| phase | enum | 是 | 5 阶段（同 FP-TOKO-002） |
| level | enum | 是 | none / warning / tighten / stop_suggested |
| phase_ratio | number | 是 | 当前消耗占阶段预算比例 |
| ts | string(RFC3339) | 是 | 状态时间 |

### 2.2 枚举值定义

| 字段 | 值 | 含义 |
|------|-----|------|
| level | none / warning / tighten / stop_suggested | 梯级单调不减（不回退） |

## 3. 业务逻辑

### 3.1 处理流程

1. 每次实测/估算计数更新 → 2. 计算阶段占比 → 3. 跨越 70/85/100% 阈值时发出对应事件（仅跨越沿触发一次）→ 4. usage 事件回填消耗记录 → 5. usage 缺失时估算轨兜底 → 6. 梯级状态可查询

### 3.2 业务规则

| 规则ID | 规则描述 | 约束类型 | 优先级 |
|--------|---------|---------|--------|
| R1 | **平台只发建议事件，不擅自中断生成**——执行权在宿主 Agent | 强制 | P0 |
| R2 | 梯级单调不减，不得回退 | 强制 | P0 |
| R3 | 阈值固定 70/85/100%，不做动态调整（可配置化为后续独立能力） | 强制 | P1 |
| R4 | budget-manager 类签名零改动，以订阅方式接入 | 强制 | P0 |

### 3.3 状态转换

none →（≥70%）warning →（≥85%）tighten →（≥100%）stop_suggested；每级转换触发对应事件一次；不回退。

## 4. 不适用章节说明

前端页面/前端实现约定/关联数据源/权限与安全：N/A（运行时事件层能力）。

## 5. 依赖检查清单

| 方向 | 依赖 | 说明 |
|------|------|------|
| 前置 | FP-TOKO-002（消耗记录）/ FP-TOKO-004（tighten 收紧摘要）/ FP-TOKO-006（事件通道）/ FP-TOKO-007（usage 实测事件生产者，运行时依赖） | — |
| 后续 | FP-TOKO-012（压实模板消费预算事件）/ FP-TOKO-013（cost 子项） | — |
| 外部 | 无 | — |
