# FP-TOKO-004 artifact-digesting 开发规格

## 基本信息

| 项目 | 内容 |
|------|------|
| 功能点ID | FP-TOKO-004 |
| 名称 | 工件摘要化 Digest Profile（T1） |
| 版本 | v1.0 |
| 日期 | 2026-11-24 |
| 来源 | docs/plans/05 §3.1.3、§6-T1 |
| 优先级 | P0 |
| 范围 | 仅规格；本 FP 不实现 |

## 1. 接口定义

### 1.1 模块导出（设计约定）

| 导出 | 类型 | 说明 |
|------|------|------|
| `digest(artifact, profileId, opts?)` | 函数 | 输入结构化报告 → 输出摘要化注入体（≤800 tokens 目标） |
| `listProfiles()` | 函数 | 列出已注册 Digest Profile |

### 1.2 Digest Profile Schema（每类工件一份）

```jsonc
{
  "profile_id": "contract-report",
  "keep_fields": ["summary", "issues.top_n"],
  "max_items": 10,                    // budget.tighten 事件下收紧为 5（FP-TOKO-008）
  "token_ceiling": 800,
  "degraded_output": "path + one-line description + fetch instruction"
}
```

### 1.3 首期 Profile 清单（3 类）

| profile_id | 工件 | 保留内容 |
|-----------|------|---------|
| contract-report | 契约扫描报告 | summary + top-N 异常项（N≤10） |
| health-report | Gradle 体检报告 | 评分行 + ERROR 行 |
| route-table | 组件化路由清单 | 变更路由条目 + 影响面汇总 |

### 1.4 错误码

| 错误 | 触发 | 处理 |
|------|------|------|
| PROFILE_MISSING | artifactType 无对应 profile | 降级为"路径 + 一句话说明 + 取用指令"输出 |
| CEILING_BREACH | 摘要后仍超 token_ceiling | 进一步降级为 degraded_output，禁止字符级硬截断 |

## 2. 数据模型

### 2.1 摘要注入体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| artifact_ref | string | 是 | 原工件路径/标识 |
| digest_kind | enum | 是 | `digest` / `pointer`（指针：仅路径+说明+取用指令） |
| items | array | 否 | 保留条目（结构边界完整） |
| tokens_estimate | number | 是 | 经 FP-TOKO-001 profile 估算 |

### 2.2 枚举值定义

| 字段 | 值 | 含义 |
|------|-----|------|
| digest_kind | digest / pointer | 摘要注入 / 指针降级 |

## 3. 业务逻辑

### 3.1 处理流程

1. 工具调用返回结构化报告 → 2. 匹配 Digest Profile → 3. 按 keep_fields 提取 → 4. 超 ceiling 则降级 pointer → 5. 输出注入体（进 CAG Tier 3）→ 6. 全程记录估算值

### 3.2 业务规则

| 规则ID | 规则描述 | 约束类型 | 优先级 |
|--------|---------|---------|--------|
| R1 | 截断只按条目/行等结构边界，禁止字符级硬截断（防破坏 JSON/YAML 致模型误读） | 强制 | P0 |
| R2 | 摘要必须保留"取全文指令"，由模型决定是否工具调用取回 | 强制 | P0 |
| R3 | 单报告注入 ≤800 tokens（vs 现 2,000+） | 强制 | P0 |
| R4 | 无 profile 的工件类型一律 pointer 降级，不做自由发挥摘要 | 强制 | P1 |

### 3.3 状态转换

原始工件 →（有 profile 且 ≤ceiling）digest 注入；原始工件 →（超 ceiling 或无 profile）pointer 注入。

## 4. 不适用章节说明

前端页面/前端实现约定/关联数据源/权限与安全：N/A（平台库能力，进程内数据变换）。

## 5. 依赖检查清单

| 方向 | 依赖 | 说明 |
|------|------|------|
| 前置 | FP-TOKO-003（Tier 3 挂接）/ FP-TOKO-001（token 估算） | — |
| 后续 | FP-TOKO-008（budget.tighten 触发 N≤5 收紧） | — |
| 外部 | 无 | — |
