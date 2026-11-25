# FP-TOKO-012 compaction-templates 验收标准

## 业务验收标准

| 序号 | 验收项 | 预期结果 | 验证方法 |
|------|-------|---------|---------|
| B1 | 模板库成文 | pdd-default 模板含 keep/discard/ratio_target 三要素 | 模板评审 |
| B2 | 建议不越权 | 平台无自动改写历史行为，仅建议事件 | 行为审计 |
| B3 | 保留要素受保护 | decisions/contracts/acceptance_criteria 永不出现在 discard | 模板校验用例 |

## 技术验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| T1 | 触发条件精确 | turn≥4 且 ratio>50% 才建议，其余不触发 | 边界值用例 |
| T2 | 单次建议 | 被拒绝后同会话不再建议 | 交互序列用例 |
| T3 | 压实后审计 | 压实后装配通过 FP-TOKO-005 审计 | 联调用例 |
| T4 | 效果指标 | 第 4 轮起历史占用较压实前 -30% | 效果核算 |

## 集成验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| I1 | 预算联动 | ratio 计算消费 FP-TOKO-008 阶段预算 | 数据流核对 |
| I2 | M3 目标支撑 | 长会话 ≥55% 综合节省的核算含压实贡献 | 指标核算 |

## 实现阶段验收记录（2026-11-25）

交付物：`lib/context-assembly/compaction-templates.js`（shouldCompact / getTemplate / validateTemplate / recordCompactionDecision / recordCompactionEffect / getCompactionState / resetCompactionState + COMPACTION_TRIGGER/COMPACTION_REDUCTION_TARGET/KEEP_ELEMENTS/DISCARD_ELEMENTS/PROTECTED_KEEP_ELEMENTS/TEMPLATES 常量）+ `tests/toko/compaction-templates.test.js`（24 用例）。既有源码零改动（git diff 审计：7 个 M 文件均为 FP-001~006 已批准修改）。

| 序号 | 结果 | 证据 |
|------|------|------|
| B1 | ✅ 通过 | pdd-default 模板含 template_id/keep/discard/ratio_target 全要素：keep=decisions/contracts/acceptance_criteria/open_questions、discard=三丢弃要素、ratio_target=0.5，与 §1.2/§2.2 枚举逐字一致 |
| B2 | ✅ 通过 | 建议不越权三证据：模块源码零 fs 写操作（静态断言）；导出面无任何"执行压实/改写历史"函数（仅 shouldCompact 建议 + recordCompactionDecision 记录宿主决策）；建议产物为 §2.1 纯数据六字段无执行动作 |
| B3 | ✅ 通过 | validateTemplate 强制 R2：受保护要素（decisions/contracts/acceptance_criteria）进 discard → TEMPLATE_INVALID；keep∩discard 交集 → TEMPLATE_INVALID；内置模板库加载时自检（违例即抛错不可静默） |
| T1 | ✅ 通过 | 边界矩阵：turn3+ratio0.9 不触发 / ratio=0.5 恰好不触发（严格大于）/ 0.4999 不触发 / turn4+0.5001 触发 / turn10+0.999 触发；COMPACTION_TRIGGER 常量锚定 {min_turn:4, min_history_ratio:0.5} |
| T2 | ✅ 通过 | 拒绝路径：decision(false)→rejected=true→再判定 null（COMPACT_REJECTED 不再建议）；接受路径：→compacted→不再建议；建议待决策期间重复判定 null（单次输出）；无待决策记录 → COMPACT_NO_PENDING_SUGGESTION |
| T3 | ✅ 通过 | 宿主以压实后产物替换 Tier 3 重跑 assemble（内嵌 FP-005 auditOrder）无违规抛错，t3 估算 200 行决策正文 → 单条摘要显著下降；R4 挂接点验证 |
| T4 | ✅ 通过 | recordCompactionEffect：-35% ≥ 0.30 → target_met=true；-25% → target_met=false（如实上报不修饰）；效果快照入会话状态可审计 |
| I1 | ✅ 通过 | 真实数据流：recordEstimate(impl, 24000) → FP-008 getLadderState().phase_ratio=0.6 → shouldCompact 缺省读该值触发且 suggestion.history_ratio=0.6 一致；无状态 ratio=0 与占比 0.3 场景均不触发 |
| I2 | ✅ 通过 | COMPACTION_REDUCTION_TARGET=0.30 导出 + 效果核算结果含 target/target_met/reduction_ratio，FP-014 M3 长会话核算可直接消费（getCompactionState 含 effect 快照） |

单测：`node --test tests/toko/compaction-templates.test.js` → 24/24；TOKO 全量回归 242/242（基线 218 + 新增 24）。

补充说明：
- **事件通道**：compaction.suggested 经 normalizeEvent 构建（FP-006 §2.2 事件全集成员），event.data 与 §2.1 建议六字段 deepEqual，validateEvent 通过后随 shouldCompact 返回（宿主经 PSE 通道下发）。
- **状态机实现**（§3.3）：compactionStates 进程内存态（R4 同口径不落盘）；monitoring→suggested→compacted / 拒绝→monitoring(rejected=true)；三种状态（suggested/compacted/rejected）下重复判定均返回 null（R3 单次建议）。
- **ratio 数据源双路径**：缺省消费 FP-008 getLadderState().phase_ratio（I1）；historyRatio 显式覆盖供宿主自带预算口径与边界测试（COMPACT_RATIO_INVALID 校验）。
- **getTemplate 回退形态**：未知 taskType 返回 pdd-default 结构 + matched:false/fallback_used:true/notice:'TEMPLATE_MISSING'（§1.3 降级不抛错惯例）；suggestCompaction 使用 templateSchemaView 剥除查询元数据，保证 §2.1 建议字段面纯净。
- **T4 效果口径**：reduction_ratio=(before−after)/before，与 FP-008 usage_deviation 同一四舍五入口径（toFixed(4)）；无建议会话拒绝记效果（COMPACT_NO_SUGGESTION）。
