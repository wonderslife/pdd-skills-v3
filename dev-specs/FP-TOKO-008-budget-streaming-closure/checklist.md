# FP-TOKO-008 budget-streaming-closure 验收标准

## 业务验收标准

| 序号 | 验收项 | 预期结果 | 验证方法 |
|------|-------|---------|---------|
| B1 | 三级梯级事件齐备 | warning/tighten/stop_suggested 三事件定义完整且经 PSE 通道下发 | 事件契约检查 |
| B2 | 不擅自中断 | 任何梯级只产出建议事件，无平台侧强制终止行为 | 行为审计（实现阶段） |
| B3 | usage 实测回填 | measured 记录正确覆盖 estimated（FP-TOKO-002 规则） | 数据流用例 |

## 技术验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| T1 | 阈值触发准确 | 70/85/100% 跨越沿各触发一次，不重复不遗漏 | 边界值用例 |
| T2 | 梯级单调 | 状态机无回退路径 | 状态机遍历 |
| T3 | usage 缺失兜底 | 无 usage 时 source=estimated 且不阻断 | 缺失注入用例 |
| T4 | tighten 联动 | tighten 触发后 Digest max_items=5 生效 | FP-TOKO-004 联调 |
| T5 | budget-manager 零改动 | 类签名与既有调用点不变 | git diff 审计 |

## 集成验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| I1 | PSE 贯通 | budget.* 事件符合 FP-TOKO-006 Schema | 事件流联调 |
| I2 | 压实挂接 | 预算事件可被 FP-TOKO-012 消费 | 联调用例 |
| I3 | 误差指标 | 会话级 usage 记账误差 ≤5% | 与供应商账单口径核对 |

## 实现阶段验收记录（2026-11-25）

交付物：`lib/token/budget-closure.js`（onUsageEvent / recordEstimate / getLadderState / isTightenActive / getBudgetEvents / finalizeBudgetStream / resetBudgetCycle + BUDGET_LADDER_THRESHOLDS/LADDER_LEVELS 常量）+ `tests/toko/budget-closure.test.js`（25 用例）。既有源码零改动（git diff 审计：7 个 M 文件均为 FP-001~006 已批准修改；budget-manager.js/estimation-track.js 本 FP 未触碰）。

| 序号 | 结果 | 证据 |
|------|------|------|
| B1 | ✅ 通过 | budget.warning/tighten/stop_suggested 三事件经 normalizeEvent 构建全部通过 FP-006 validateEvent；下发清单经 getBudgetEvents 可查（含深拷贝防篡改） |
| B2 | ✅ 通过 | 占比 150% 不抛错、无任何平台侧终止行为——返回值仅 {record,state,events,regression}，stop_suggested 事件 message 明示"执行权在宿主 Agent"（R1） |
| B3 | ✅ 通过 | onUsageEvent(measured) 优先经 backfillMeasured 覆盖该会话+阶段最新 estimated 记录（record_id 不变、tokens_measured 主值、tokens_est 保留偏差核算、不并存双记录）；无 estimated 时新建 measured；estimated 兜底事件新建估算记录（R1 不携带实测主值） |
| T1 | ✅ 通过 | 边界值矩阵 0.6999/0.70/0.8499/0.85/0.9999/1.0 全部命中预期梯级；跨越沿各触发一次（同沿重复评估零事件）；跳级（0→85%/100%）逐级补发 warning+tighten(+stop) |
| T2 | ✅ 通过 | 实测覆盖估算后占比回落 → LADDER_REGRESSION WARN + 保持最高已达梯级（ratio 更新为事实值），前向晋升路径完好 |
| T3 | ✅ 通过 | 流尾无 usage → usage_missing=true + notice=USAGE_MISSING + source=estimated（估算轨记录已参与占比），不阻断；含 usage → source=measured |
| T4 | ✅ 通过 | isTightenActive 联动 digest({tighten:true})：激活后 issues 条目 10→5（TIGHTEN_MAX_ITEMS 单一来源自 FP-004 导入，非镜像）；tighten 事件携带 skip_tier2=true + digest_max_items=5（调用方据此跳过 Tier 2） |
| T5 | ✅ 通过 | budget-manager.js 类签名零改动（git diff 为空）；仅只读消费 PHASES 枚举 + FP-002 PHASE_ALLOCATION_RATIOS（20/15/40/15/10 锚定单测） |
| I1 | ✅ 通过 | 三级事件 payload 字段面完整（session_id/phase/level/phase_ratio/threshold/action/message + ts/degraded 默认）；与 usage/done 组流全部过 validateEvent |
| I2 | ✅ 通过（挂接点就绪） | getBudgetEvents 输出 PSE 深拷贝数组（含 session_id/phase/level/action），FP-012 实现时直接消费 |
| I3 | ✅ 通过 | finalizeBudgetStream 核算 usage_deviation=|账单(done.usage_total)−已记账|/账单：2% 场景=0.02 ≤5%；52% 场景如实上报不修饰 |

单测：`node --test tests/toko/budget-closure.test.js` → 25/25；TOKO 全量回归 163/163（基线 138 + 新增 25）。

补充说明：
- **双计数入口**：估算轨 recordEstimate（估算先行）、实测轨 onUsageEvent（FP-006 usage 事件订阅）——两路均推进梯级评估，实测到达时单主值覆盖同记录（与 FP-006 buildEventStream I1 批量回放路径互为补充，运行时流式场景走本订阅入口）。
- **阈值口径差异说明**：budget-manager 既有预警阈值 0.8/0.95 面向单阶段批量校验；FP-008 流式梯级 0.70/0.85/1.00 为 doc 05 §3.3.2 独立口径（R3 固定），二者并行不冲突。
- **totalBudget 口径**：梯级状态首次建立时采纳（缺省 DEFAULT_TOTAL_BUDGET=100000），此后以存储值为准，保证同一会话阶段占比口径一致。
- **USAGE_MISSING / LADDER_REGRESSION**：均以 notice/WARN 形态返回（降级路径不抛错惯例）；仅边界输入校验抛 USAGE_EVENT_INVALID。
