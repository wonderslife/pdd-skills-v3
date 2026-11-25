# FP-TOKO-002 budget-estimation-track 验收标准

## 业务验收标准

| 序号 | 验收项 | 预期结果 | 验证方法 |
|------|-------|---------|---------|
| B1 | 5 阶段消耗分布可输出 | 指定 session 可产出 analysis/design/impl/review/verify 五段消耗占比 | 规格行为评审（实现阶段为单元测试） |
| B2 | budget-manager 零改动 | 既有调用点与类签名不变 | git diff 审计（实现阶段） |
| B3 | 基线报告产出 | 现状单会话 token 消耗模型写入 docs/reviews/ | 文档存在性 + 口径评审 |

## 技术验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| T1 | 记录 Schema 完备 | consumption-record 8 字段齐备、枚举合法 | Schema 校验 |
| T2 | phase 枚举一致 | 与 budget-manager PHASES **值**逐一相等 | 枚举比对 |
| T3 | 实测覆盖语义 | measured 记录覆盖 estimated，不并存双主值 | 规则用例 |
| T4 | 无 profile 降级 | 缺 family profile 时 fallback 标注不丢失 | 降级用例 |
| T5 | 估算经 profile | 所有 tokens_est 可追溯至 FP-TOKO-001 系数 | 数据溯源审计 |

## 集成验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| I1 | manifest 对接 | FP-TOKO-003 manifest.budget_state 数据源为本 FP 输出 | 交叉引用检查 |
| I2 | usage 事件对接 | FP-TOKO-006 `usage` 事件可写入本记录 | 事件契约检查 |
| I3 | 阈值沿用 | 预警/阻断阈值与既有 DEFAULT_ALLOCATION 一致 | 数值比对（20/15/40/15/10） |

## 实现阶段验收记录（2026-11-25）

交付物：`lib/token/estimation-track.js`（新）、`lib/streaming/segment.js`（新，分段原语单一实现源，脚本 re-export 零差异）、`tests/toko/estimation-track.test.js`（16 用例）、`docs/reviews/20261125-fp002-single-session-token-baseline.md`（B3 基线报告）。

| 序号 | 结果 | 证据 |
|------|------|------|
| B1 | ✅ 通过 | 单测：5 阶段分布/占比/预算/状态口径（2 用例） |
| B2 | ✅ 通过 | `git diff lib/token/budget-manager.js` 为空；既有文件仅 budget-alert.js 1 行修复（见下） |
| B3 | ✅ 通过 | 基线报告已产出并锚定现状口径 |
| T1 | ✅ 通过 | 9 字段齐备（含显式可选键位占位）+ 11 组 RECORD_MALFORMED 拒绝用例 |
| T2 | ✅ 通过 | 导入 budget-manager `PHASES` 做枚举比对（PHASE_ALLOCATION_RATIOS 键=PHASES 值） |
| T3 | ✅ 通过 | backfillMeasured 覆盖回填：source→measured 单主值，tokens_est 保留供 R3 偏差核算 |
| T4 | ✅ 通过 | 降级 openai(fallback) 标注（tokenizer_profile/notice）写入记录不丢失 |
| T5 | ✅ 通过 | 估算经 loadProfile 系数，分段口径与 FP-001 标定脚本同源（segment.js 单一实现） |
| I1 | ✅ 预埋 | getSessionRecords/getPhaseDistribution 为 FP-003 数据源（FP-003 实现时复核） |
| I2 | ✅ 预埋 | backfillMeasured 为 FP-006/008 usage 写入入口（FP-008 实现时复核） |
| I3 | ✅ 通过 | 镜像常量 20/15/40/15/10 + 阈值 0.8/0.95 数值断言 |

单测：`node --test tests/toko/estimation-track.test.js tests/toko/token-profiles.test.js` → 26/26 通过。

**既有缺陷修复登记（经用户批准）**：`lib/token/budget-alert.js` L324 自 v3.0.1 发布即缺右括号（语法错误），budget-manager 全链不可加载且无运行时调用方故未暴露；修复为补 1 个右括号，零逻辑改动。T2 导入比对与 FP-008 订阅接入、FP-014 发版核验第 7 项依赖此修复。
