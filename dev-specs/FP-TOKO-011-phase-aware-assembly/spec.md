# FP-TOKO-011 phase-aware-assembly 开发规格

## 基本信息

| 项目 | 内容 |
|------|------|
| 功能点ID | FP-TOKO-011 |
| 名称 | 阶段感知装配白名单（T3） |
| 版本 | v1.0 |
| 日期 | 2026-11-24 |
| 来源 | docs/plans/05 §3.1.2、§6-T3 |
| 优先级 | P1 |
| 范围 | 仅规格；本 FP 不实现 |

## 1. 接口定义

### 1.1 模块导出（设计约定）

| 导出 | 类型 | 说明 |
|------|------|------|
| `getWhitelist(phase, projectType)` | 函数 | 返回该阶段+工程类型下允许装配的技能类别/技能清单 |
| 白名单配置表 | 静态配置 | PHASES × 技能类别矩阵（§2.1），随包发布 |

### 1.2 白名单配置 Schema

```jsonc
{
  "phase": "impl",
  "include_categories": ["core", "expert-ruoyi", "quality"],   // 栈映射见 §2.1：按 detector 实际 type 注入对应 expert
  "include_skills": ["pdd-implement-feature"],
  "exclude_categories": ["ba", "spec", "testcase"],
  "source": "detector"            // 栈限定来源：工程类型探测器结果
}
```

### 1.3 错误码

| 错误 | 触发 | 处理 |
|------|------|------|
| PHASE_UNKNOWN | 非法 phase | 拒绝并返回 5 枚举 |
| STACK_UNRESOLVED | 探测器无法判定工程类型 | IMPL 期降级为"仅 core 类"，WARN 记录 |

## 2. 数据模型

### 2.1 PHASES × 技能类别白名单矩阵（强制表，源自 doc 05 §3.1.2）

| 阶段 | 默认可装配 | 明确排除 |
|------|-----------|---------|
| analysis | core 拆解类 + BA | pr 类、expert 实现类 |
| design | pdd-design-spec、架构专家 | testcase 类 |
| impl | 探测器 type 对应栈 expert（ruoyi→expert-ruoyi 系；spring-boot→通用 core 无专属 expert；vue3→expert-vue3；android-kotlin/android-compose→expert-kotlin/expert-jetpack 系；mixed→双栈并集）+ pdd-implement-feature | 全量 expert（探测器命中哪栈才装哪栈；unknown→仅 core） |
| review | pdd-code-reviewer + bug 模式 | BA/spec 类 |
| verify | pdd-verify-feature + 对应测试 expert | 设计类 |

### 2.2 枚举值定义

| 字段 | 值 | 含义 |
|------|-----|------|
| phase | analysis / design / impl / review / verify | 与 budget-manager PHASES 值一致 |
| project_type | spring-boot / ruoyi / vue3 / android-kotlin / android-compose / mixed / unknown | 工程类型探测器实际输出（detector.js JSDoc 7 值，3.4.0 既有能力，只读消费） |

## 3. 业务逻辑

### 3.1 处理流程

1. CAG 发起装配（带 phase）→ 2. 探测器结果解析工程类型 → 3. 查白名单矩阵 → 4. 过滤可装配集合 → 5. 交给 FP-TOKO-005 稳定化审计 → 6. 输出收敛后的装配计划

### 3.2 业务规则

| 规则ID | 规则描述 | 约束类型 | 优先级 |
|--------|---------|---------|--------|
| R1 | IMPL 期 expert 池从 18 收敛到 3–4（命中栈限定） | 目标值 | P0 |
| R2 | 白名单只约束注入顺序与默认深度，**不改变触发词语义**（doc 05 §7 风险对策） | 强制 | P0 |
| R3 | 白名单装配必须通过前缀稳定化审计 | 强制 | P0 |
| R4 | T3 全量接入后产出各阶段装配规模对比报告（doc 05 §6-T3 验收）；M1（T1）灰度对比报告由 FP-TOKO-003 的 Tier 装配支撑 | 强制 | P1 |

### 3.3 状态转换

未过滤 → 白名单过滤 → 稳定化审计通过 → 放行；STACK_UNRESOLVED → 降级白名单（仅 core）+ WARN。

## 4. 不适用章节说明

前端页面/前端实现约定/关联数据源/权限与安全：N/A（装配策略层能力）。

## 5. 依赖检查清单

| 方向 | 依赖 | 说明 |
|------|------|------|
| 前置 | FP-TOKO-003（CAG）/ FP-TOKO-009（tier 元数据） | — |
| 后续 | FP-TOKO-014（M1/M3 量化验收消费本 FP 的对比报告） | — |
| 外部 | 工程类型探测器（3.4.0 既有，lib/project-type/detector.js） | 只读调用 |
