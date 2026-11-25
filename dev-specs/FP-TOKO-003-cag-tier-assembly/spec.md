# FP-TOKO-003 cag-tier-assembly 开发规格

## 基本信息

| 项目 | 内容 |
|------|------|
| 功能点ID | FP-TOKO-003 |
| 名称 | CAG 上下文装配网关（T1） |
| 版本 | v1.0 |
| 日期 | 2026-11-24 |
| 来源 | docs/plans/05 §3.1.1、§3.1.5、§6-T1 |
| 优先级 | P0 |
| 范围 | 仅规格；本 FP 不实现 |

## 1. 接口定义

### 1.1 模块导出（设计约定：新模块 `lib/context-assembly/`，既有模块零改动）

| 导出 | 类型 | 说明 |
|------|------|------|
| `assemble(request)` | 函数 | 输入 {phase, sessionId, family, tierLimits?} → 输出装配计划 + manifest |
| `buildManifest(plan)` | 函数 | 生成装配报价单（机器可读） |
| MCP resource `pdd://context/manifest` | 资源 | 暴露最近一次 manifest（新增 resource，不改动既有 resource） |

### 1.2 装配报价单 Manifest Schema

```jsonc
{
  "manifest_version": "1.0",
  "phase": "impl",
  "tiers": {
    "t0": { "skills": 53, "tokens_estimate": 7100 },
    "t1": { "skills": ["expert-ruoyi", "pdd-implement-feature"], "tokens_estimate": 4200 },
    "t2": { "references": ["expert-ruoyi/references/permission-rules.md"], "tokens_estimate": 1500 },
    "t3": { "artifacts": ["contract-report#digest"], "tokens_estimate": 620 }
  },
  "tokenizer_profile": "qwen",
  "total_estimate": 13420,
  "budget_state": { "phase_share": 40000, "consumed": 28500, "remaining": 11500 }
}
```

### 1.3 错误码

| 错误 | 触发 | 处理 |
|------|------|------|
| TIER_OVERFLOW | 单 Tier 估算超 tierLimits | 摘要化降级（对接 FP-TOKO-004）或拒绝并返回原因 |
| PHASE_UNKNOWN | phase 不在 5 枚举 | 拒绝装配并返回合法枚举 |
| MANIFEST_MALFORMED | 生成的 manifest 不合 Schema | 视为缺陷，不得下发宿主 |

## 2. 数据模型

### 2.1 四层装配模型（Tier）

| Tier | 内容 | 加载时机 | 默认 |
|------|------|---------|------|
| Tier 0 索引层 | name + 精简 description + 触发词 | 会话开始常驻 | **默认只装 Tier 0** |
| Tier 1 核心层 | SKILL.md 正文 | 触发词命中按需 | 单技能注入 |
| Tier 2 参考层 | references/*.md | 技能步骤显式声明 | 懒注入 |
| Tier 3 工件层 | 运行时产物 | 工具调用返回后 | 摘要化注入（FP-TOKO-004） |

### 2.2 枚举值定义

| 字段 | 值 | 含义 |
|------|-----|------|
| tier | 0 / 1 / 2 / 3 | 来源 FP-TOKO-009 元数据，缺省按目录类别推导 |
| manifest_version | 1.0 | 语义化；新增事件不升 major，语义变更必须升 major 并双发 6 个月（doc 05 §5.3） |
| tokenizer_profile | family 枚举值（openai/anthropic/gemini/deepseek/qwen/glm/kimi/doubao）或 openai(fallback) | 取值域 = FP-TOKO-001 family 枚举；profile 文件名 = {family}.json（qwen 家族 → qwen.json）；禁用 qwen3 等模型型号名 |

## 3. 业务逻辑

### 3.1 处理流程

1. 接收装配请求（phase/session/family）→ 2. Tier 0 全量索引装配 → 3. 触发词命中的技能按需装 Tier 1 → 4. 步骤声明需要时装 Tier 2 → 5. 工具产物经 Digest 装 Tier 3 → 6. 生成 manifest（含 budget_state，数据源 FP-TOKO-002）→ 7. 交付宿主装配计划

### 3.2 业务规则

| 规则ID | 规则描述 | 约束类型 | 优先级 |
|--------|---------|---------|--------|
| R1 | 默认只装 Tier 0；Tier 1/2/3 必须有显式触发依据 | 强制 | P0 |
| R2 | 技能一旦装配，会话内不回溯移除（前缀稳定，见 FP-TOKO-005） | 强制 | P0 |
| R3 | 装配估算与实测偏差 ≤10%（验收指标） | 强制 | P0 |
| R4 | 既有模块（list/budget/cache 等）零改动，CAG 只读消费其输出 | 强制 | P0 |
| R5 | 技能触发词语义不变——CAG 约束注入顺序与默认深度，不改变触发判定 | 强制 | P0 |
| R6 | Tier 0 规模阈值（≤7,100）为 doc 03 48 技能基线口径的推算值；53 技能实际阈值以 FP-TOKO-002 B3 的 T0 基线报告复标为准，届时回写本阈值 | 口径声明 | P0 |

### 3.3 状态转换

未装配 → Tier0 常驻；Tier0 → 触发命中 → Tier1 追加（不可逆）；Tier1 → 步骤需要 → Tier2 追加（不可逆）；产物返回 → Tier3 摘要注入（可被新产物替换）。

## 4. 不适用章节说明

前端页面/前端实现约定/关联数据源/权限与安全：N/A（平台库能力；manifest 为进程内数据结构，MCP resource 沿用宿主既有鉴权通道）。

## 5. 依赖检查清单

| 方向 | 依赖 | 说明 |
|------|------|------|
| 前置 | FP-TOKO-001（profile）/ FP-TOKO-002（budget_state）/ FP-TOKO-009（tier 元数据） | — |
| 后续 | FP-TOKO-004 / 005 / 008 / 011 / 012 | 摘要化、前缀稳定、熔断、阶段白名单、压实均挂接 CAG |
| 外部 | 无 | 离线可用 |
