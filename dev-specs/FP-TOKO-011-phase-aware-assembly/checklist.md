# FP-TOKO-011 phase-aware-assembly 验收标准

## 业务验收标准

| 序号 | 验收项 | 预期结果 | 验证方法 |
|------|-------|---------|---------|
| B1 | 五阶段白名单齐备 | PHASES × 类别矩阵覆盖 5 阶段且含排除列 | 矩阵核对 |
| B2 | IMPL 收敛达标 | RuoYi 工程下 expert 池 18 → 3–4 | 装配规模对比报告 |
| B3 | 触发语义不变 | 53 技能触发回归全绿（白名单不改变触发判定） | 技能触发回归 |

## 技术验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| T1 | 栈限定正确 | android 工程不装配 ruoyi expert，反之亦然 | 双栈用例 |
| T2 | 未识别栈降级 | STACK_UNRESOLVED 时仅 core 类 + WARN | 降级用例 |
| T3 | 稳定化联动 | 白名单输出通过 FP-TOKO-005 审计 | 联调用例 |
| T4 | Android 链路受益 | expert-kotlin/expert-jetpack 等在 android 工程被正确保留 | Android 装配用例 |
| T5 | 全量对比 | T3 全量接入后产出各阶段 before/after 装配规模报告（M1/T1 灰度对比由 FP-TOKO-003 支撑） | 报告评审 |

## 集成验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| I1 | CAG 注入点 | 白名单在 assemble(request) 主流程中生效 | FP-TOKO-003 联调 |
| I2 | 量化目标支撑 | 与 doc 05 §6 M3"综合≥40%"目标的核算口径衔接 | 指标核算 |

## 实现阶段验收记录（2026-11-25）

交付物：`lib/context-assembly/phase-whitelist.js`（getWhitelist / buildAssemblyScaleReport + PROJECT_TYPES/STACK_EXPERT_MAP/PHASE_WHITELIST_MATRIX/IMPL_EXPERT_POOL_TARGET 常量）+ `tests/toko/phase-whitelist.test.js`（23 用例）。既有源码零改动（git diff 审计：7 个 M 文件均为 FP-001~006 已批准修改；FP-003 index.js 未触碰，白名单经既有 assemble({whitelist}) 注入点接入）。

| 序号 | 结果 | 证据 |
|------|------|------|
| B1 | ✅ 通过 | 矩阵覆盖 5 阶段且每阶段含 include 与排除列；7×5 阶段×栈组合解析结果均 ⊆ 53 技能清单且非空（矩阵与技能树不失配，失配时 WHITELIST_STALE 守卫抛错） |
| B2 | ✅ 通过 | ruoyi 工程 expert 池 18→4（expert-ruoyi/expert-ruoyi-permission/expert-activiti/expert-mysql），落于 R1 目标区间 3–4；对比报告 expert_pool {before:18, after:4} |
| B3 | ✅ 通过 | 触发语义不变三证据：白名单输出深冻结（零副作用）；模块源码零 fs 写操作（静态断言）；白名单装配后 Tier 0 索引仍全量 53 技能（触发层常驻不缩减） |
| T1 | ✅ 通过 | STACK_EXPERT_MAP android-kotlin ∩ ruoyi = ∅（双向断言）；装配端到端：android 工程注入 expert-jetpack、ruoyi expert 被跳过 |
| T2 | ✅ 通过 | impl+unknown → degraded:true + notice=STACK_UNRESOLVED + WARN（t.mock 捕获）+ 白名单降级为 core 目录全量（无 expert，expert_pool.after=0）；非法 projectType 按 unknown 归一同路径 |
| T3 | ✅ 通过 | 白名单输出投喂 assemble({whitelist}) 主流程（内嵌 FP-005 auditOrder）无违规抛错，manifest_v1.0 有效下发；白名单外触发技能静默跳过不报错（FP-003 注入点语义） |
| T4 | ✅ 通过 | android-kotlin 保留 expert-kotlin/expert-android/expert-android-test（不含 compose 专属 expert-jetpack）；android-compose 保留 expert-jetpack+kotlin 系（池=4 在 R1 区间） |
| T5 | ✅ 通过 | buildAssemblyScaleReport：5 阶段 before/after 齐备，after ≤ before 逐行断言；unknown 栈报告 impl 行带 degraded/STACK_UNRESOLVED 标注 |
| I1 | ✅ 通过 | 白名单经 assemble({whitelist: config.skills}) 在装配主流程生效：白名单内注入（pdd-implement-feature/expert-ruoyi）、白名单外跳过（expert-security） |
| I2 | ✅ 通过 | overall.reduction_ratio 有限、∈(0,1]、after_tokens < before_tokens（正向压缩）；m3_note 明示 M3 综合压缩口径衔接（装配侧分量，全量口径由 FP-TOKO-014 核算） |

单测：`node --test tests/toko/phase-whitelist.test.js` → 23/23；TOKO 全量回归 218/218（基线 195 + 新增 23）。

补充说明：
- **矩阵到技能树的映射口径**（§2.1 行 → 实际 53 技能树，随包配置 PHASE_WHITELIST_MATRIX 注记）：analysis"core 拆解类+BA"→ pdd-main/pdd-ba/pdd-extract-features/pdd-generate-spec；design"架构专家"→ software-architect/system-architect；review"bug 模式"→ expert-bug-fixer；verify"对应测试 expert"→ testcase-agent/testcase-modeler + 栈测试 expert（android→expert-android-test）。
- **栈映射**（STACK_EXPERT_MAP）：ruoyi→expert-ruoyi 系 4 个（B2 达标）；spring-boot→通用工程角色 3 个（无专属栈 expert，§2.1 口径）；vue3→expert-vue3+通用；android-kotlin/android-compose→expert-kotlin/expert-jetpack 系；mixed→双栈并集（保全功能，R2）；unknown→降级。
- **降级实现**：§1.3"仅 core 类"落地为 degraded 路径 include_categories 归一 ['core']（core 目录整目录纳入，无 expert），配置输出如实反映降级列。
- **R4 报告会话隔离**：before/after 两组装配分别使用 `${sessionId}-before/after-${phase}` 独立会话（FP-003 R2 会话内 Tier 1 不可逆并集，互不污染）；报告项 whitelist_source/degraded 逐行标注。
- **实现期修复 2 处**：① 降级路径初版仅含 pdd-implement-feature 单技能，未按 §1.3"仅 core 类"整目录展开——已修正并补 T2 断言；② 无其他既有文件改动。
