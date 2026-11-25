# FP-TOKO-013 quality-cost-score 验收标准

## 业务验收标准

| 序号 | 验收项 | 预期结果 | 验证方法 |
|------|-------|---------|---------|
| B1 | 开关默认关闭 | 新装环境 quality.cost_scoring.enabled=false | 配置默认值核对 |
| B2 | 关闭一致性 | 关闭时评分输出与 3.4.x 逐字节一致 | 评分快照比对 |
| B3 | 不拦截交付 | cost 低分不触发任何门控拦截 | 行为审计 |

## 技术验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| T1 | 签名不变 | scorer 类公开签名零变化 | git diff 审计 |
| T2 | 数据缺失降级 | 开启但无消耗记录时 cost=null + WARN，其余维度正常 | 缺失注入用例 |
| T3 | 权重上限 | cost 权重 ≤0.1 | 配置断言 |
| T4 | 数据源正确 | cost 输入来自 FP-TOKO-002 记录 | 数据流核对 |

## 集成验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| I1 | 4 级门控不受影响 | 既有质量门控行为在开关两种状态下均不变 | 门控回归 |
| I2 | 发版核验衔接 | FP-TOKO-014 核验清单含本项一致性检查 | 清单核对 |

## 实现阶段验收记录（2026-11-25）

交付物：`lib/quality/cost-score.js`（新增：computeCostScore / clampCostWeight + DEFAULT_COST_WEIGHT/COST_WEIGHT_LIMIT/CACHE_HIT_WEIGHT/BUDGET_EFFICIENCY_CEILING/UTILIZATION_PENALTY_RATE 常量）+ `lib/quality/scorer.js` 最小挂接（additive 分支：costConfig 归一 / 构造器第 6 维挂载 / scoreFile 数据驱动评分 / getWeightedScore null 跳过 / getRecommendations cost 排除 + `_scoreCost` 私有方法）+ `tests/toko/quality-cost-score.test.js`（20 用例）。

**既有文件修改审计（本 FP 批准范围）**：
- `lib/quality/scorer.js`：**修复 1 处潜伏语法缺陷**（`_loadRules` 非 async 方法内使用 `await`——模块级 SyntaxError，lib/quality 全子树自 3.4.x 起不可导入，与 lessons 中 budget-alert.js 同类别：无 importer + 无测试所致；按已批准先例循例修复，规则集改静态导入、构造期同步载入语义不变）+ FP-013 规格指定的扩展挂接。公开签名零变化（constructor/scoreFile/scoreDirectory/scoreDimension/getWeightedScore/getGrade/getRecommendations/registerRule/exportJSON 方法面与 GRADES 结构断言锚定）。
- `lib/quality/rules/{performance,robustness,security}.js`：**修复 3 处潜伏语法缺陷**（performance.js 括号配平错误+字符串引号残句；robustness.js 正则 `??` 未转义；security.js 正则 `knex(...)` 括号未转义）——均为确定性语法错误修复，检测语义按原注释意图保留。
- 其余 7 个 M 文件（api-routes/api-server/generate/mcp-server/report/budget-alert/verify）均为 FP-001~006 已批准修改，本 FP 未触碰。

| 序号 | 结果 | 证据 |
|------|------|------|
| B1 | ✅ 通过 | 默认构造 costConfig.enabled=false、无 cost 维度、五维保持；scoreFile 输出 JSON 无 `"cost"` 键 |
| B2 | ✅ 通过 | 默认构造与显式 `{cost:{enabled:false}}` 对同一文件输出逐字节一致（JSON.stringify 相等，剥离运行时 scoredAt 时间戳）；R1 关闭路径零分支生效 |
| B3 | ✅ 通过 | 不拦截交付：cost 低分不进 getRecommendations（信息性维度非门控，R2）；门控判定 getGrade 只读 weightedScore，cost 无强制拦截行为 |
| T1 | ✅ 通过 | 公开签名零变化：8 个公开方法存在性断言 + GRADES S/A/B/C/D/F minScore 深等于（git diff 显示改动均为 additive 分支或私有方法内部修复） |
| T2 | ✅ 通过 | enabled+无 records：cost.score=null + notice=COST_DATA_MISSING + WARN（t.mock 捕获）；五维评分与加权分与关闭形态完全一致（null 不计权重，getWeightedScore 跳过） |
| T3 | ✅ 通过 | DEFAULT_COST_WEIGHT=COST_WEIGHT_LIMIT=0.10；clampCostWeight 缺省回退/0.05 通过/0.5 强制 clamp+标记；构造器 weight 0.5 → 0.1 + weightClamped=true |
| T4 | ✅ 通过 | cost 输入即 FP-002 消耗记录（§2.1 consumption-record：session_id/phase/tokens_est/source/family/ts）：measured 主值优先与 R1 同口径；COST_RECORD_MALFORMED 守卫（phase 非法/token 主值非法/非对象）；多阶段按 PHASE_ALLOCATION_RATIOS 归一加权 |
| I1 | ✅ 通过 | getGrade 边界 95/85/70/55/40 全部不变；cost 开启且无数据时门控判定不受影响 |
| I2 | ✅ 通过（就绪） | 本记录含"关闭一致性（B2）+ 签名不变（T1）"两项可复验证据，FP-TOKO-014 核验清单可直接引用 |

单测：`node --test tests/toko/quality-cost-score.test.js` → 20/20；TOKO 全量回归 262/262（基线 242 + 新增 20）。

补充说明：
- **cost 子项公式**（lib/quality/cost-score.js 单一来源）：token 效率 = 各阶段预算利用率效率分按 FP-002 阶段分配比例归一加权（利用率 ≤0.80 满分——与 budget-manager 既有预警阈值同口径；超出线性扣分 250/单位，u=1.0→50、u≥1.2→0）；综合分 = 0.7×token效率 + 0.3×(cache_hit_ratio×100)，命中率缺失退化为纯 token 效率（breakdown.cache_weight=0 标注）。
- **cache_hit_ratio 数据来源**：FP-005 观测值由调用方经 `config.cost.cacheHitRatio` 传入（∈[0,1] 校验，非法按缺失处理）；FP-005 当前未导出命中率统计，运行时对接为宿主职责（§1.1 可选字段语义）。
- **预算口径**：阶段预算 = FP-002 PHASE_ALLOCATION_RATIOS × totalBudget（缺省 100000，可经 config.cost.totalBudget 覆盖）；权重合计 1.0→1.1 自归一（getWeightedScore 除以 totalWeight 既有语义）。
- **实现期修复 4 处潜伏语法缺陷**（node --check 核验 + 全量回归证明无行为回归）：scorer.js await 误用、performance.js 括号/引号、robustness.js `??` 正则、security.js knex 正则；同步登记 .trae/rules/lessons.md。
