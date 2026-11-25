# 单会话 Token 消耗模型基线报告（FP-TOKO-002 / B3）

| 项目 | 内容 |
|------|------|
| 功能点 | FP-TOKO-002 budget-estimation-track |
| 日期 | 2026-11-25 |
| 来源 | docs/plans/05 §3.3.1、§6-T0 |
| 口径 | 现状（3.4.0）单会话 token 消耗模型 + 3.5.0 估算轨基线 |
| 状态 | 基线锁定，随 pdd-skills@3.5.0 发布 |

## 1. 现状消耗模型（budget-manager，3.4.0 基线，零改动）

| 项 | 现状值 | 说明 |
|----|--------|------|
| 默认总预算 | 100000 tokens | `TokenBudgetManager` 构造默认 |
| 阶段分配 | analysis 20% / design 15% / impl 40% / review 15% / verify 10% | 模块私有 `DEFAULT_ALLOCATION`（未导出） |
| 预警阈值 | 0.8（80%） | `warningThreshold` |
| 阻断阈值 | 0.95（95%） | `criticalThreshold`，触发 `CRITICAL_BUDGET_EXCEEDED` |
| 阶段状态口径 | ≥75% warning / ≥90% critical / ≥100% exceeded | `_getPhaseStatus` |
| 超分配告警 | 阶段用量 > 分配 ×1.2 时输出优化建议 | `_generateRecommendations` |

## 2. 估算轨基线（3.5.0 新增，FP-TOKO-001/002）

### 2.1 分段估算公式（R1：禁字符直报，一切估算经 profile）

```
tokens_est = ceil( zh/r.zh_chars_per_token + en/r.en_words_per_token + code/r.code_lines_per_token )
```

- 分段口径：fenced code block 按非空行计 code；其余文本 CJK 字符计 zh、空白切词计 en（CJK 标点与全角符号作分隔符）；
- 单一实现源：`lib/streaming/segment.js`（标定脚本与运行时估算轨共用，防系数漂移）。

### 2.2 家族系数摘要（content_hash 锁定，见各 profile JSON）

| family | zh_chars_per_token | en_words_per_token | code_lines_per_token | context_window |
|--------|--------------------|--------------------|----------------------|----------------|
| openai | 0.60 | 0.75 | 9 | 400000 |
| qwen | 0.62 | 0.75 | 9.5 | 131072 |
| 其余 6 家族 | 见 lib/streaming/profiles/{family}.json | — | — | — |

- 未登记家族 → 降级 openai(fallback)，估算照常、记录标注（ESTIMATE_WITHOUT_PROFILE）；
- PROFILE_STALE：calibrated_at 超过 92 天复标周期 → WARN 并在报告标注。

### 2.3 消耗记录与主值语义（R1）

consumption-record 9 字段：session_id / phase / tokens_est / tokens_measured(可选) / source / content_type / family / ts(RFC3339) / artifact_ref(可选)，附加 record_id 与降级标注（tokenizer_profile/notice）。

- 单主值：source=estimated 时主值为 tokens_est；实测回填（`backfillMeasured`）后 source=measured、主值切换为 tokens_measured；tokens_est 保留仅用于偏差核算；
- 状态转换（§3.3）：estimated →（FP-TOKO-008 usage 回填）→ measured；无 usage 保持 estimated 并在分布报告标注。

### 2.4 偏差复标触发线（R3）

```
deviation_pct = |est_sum − measured_sum| / measured_sum（分母口径与 FP-TOKO-001 calibrate error_pct 一致）
> 10% → 输出复标建议（node scripts/token-calibrate.js --family <f>，对接 PROFILE_STALE）
```

## 3. 阶段预算比较口径（流程步骤 4）

估算轨阶段预算 = totalBudget × 阶段分配比例（镜像 DEFAULT_ALLOCATION 20/15/40/15/10，未改动 budget-manager）；`getPhaseDistribution` 输出每阶段 budget / usage_percent / status（镜像 `_getPhaseStatus` 阈值）与全会话 totals / deviation。

## 4. 既有缺陷登记（实现期修复，经用户批准）

| 文件 | 缺陷 | 修复 |
|------|------|------|
| lib/token/budget-alert.js L324 | v3.0.1 发布即带语法错误（`console.log(chalk.yellow(...)` 缺右括号），budget-manager 全链自发布起不可加载（无运行时调用方故未暴露） | 补 1 个右括号，零逻辑改动（git diff 仅 1 行） |

影响：T2 枚举比对（导入 budget-manager `PHASES`）、FP-008 事件订阅接入、FP-014 发版核验第 7 项（编译通过）均依赖本修复。

## 5. 基线结论

- 现状模型（§1）与估算轨（§2/§3）口径已锚定并有单测固化（tests/toko/estimation-track.test.js，16 用例）；
- budget-manager 类签名零改动（git diff 审计通过）；
- I1（manifest.budget_state 数据源 = `getSessionRecords`/`getPhaseDistribution`）与 I2（usage 事件写入 = `backfillMeasured`）接口已预埋，FP-003/006/008 实现时复核。
