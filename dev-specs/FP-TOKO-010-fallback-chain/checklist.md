# FP-TOKO-010 fallback-chain 验收标准

## 业务验收标准

| 序号 | 验收项 | 预期结果 | 验证方法 |
|------|-------|---------|---------|
| B1 | 四类错误全归类 | §1.2 决策表覆盖 doc 05 §4.5 全部错误类别 | 表格核对 |
| B2 | 扩展家族验证 | ERNIE/MiniMax/xAI 经 OpenAI 兼容链可用 | T2 验证报告 |
| B3 | 降级轨迹可审计 | 任一会话可回放完整降级过程 | 轨迹回放 |

## 技术验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| T1 | drift 降级 | UnknownEvent 超阈值自动切 fallback 适配器且事件 degraded=true | 畸形流注入用例 |
| T2 | unsupported 回退 | streaming=false 家族走整包，行为=3.4.x | 回退用例 |
| T3 | usage 缺失接管 | estimated 接管且 manifest 标注正确 | 缺失注入用例 |
| T4 | 字段不丢失 | 降级事件 extra 保留原始字段 | 透传断言 |
| T5 | 降级风暴防护 | 单会话降级 >2 次终止流并上报 | 超限用例 |

## 集成验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| I1 | 适配器对接 | fallback_family 指向 FP-TOKO-007 已注册适配器 | 注册表核对 |
| I2 | PSE 贯通 | degraded 标记与 extra 规则符合 FP-TOKO-006 | 事件联调 |
| I3 | 兼容矩阵覆盖 | 8+3 家族在 doc 05 §5.2 矩阵中各有验证结论 | 矩阵核对 |

## 实现阶段验收记录（2026-11-25）

交付物：`lib/streaming/fallback-chain.js`（classify / degrade / markDegraded / getDegradationTrace / resetDegradationTrace / getCompatibilityMatrix + ERROR_CLASSES/DEGRADE_STRATEGIES/DEGRADE_LIMIT_PER_SESSION=2/RESUME_HINT 常量）+ `tests/toko/fallback-chain.test.js`（32 用例）。既有源码零改动（git diff 审计：7 个 M 文件均为 FP-001~006 已批准修改；本 FP 仅新增 lib/streaming/fallback-chain.js 与测试文件）。

| 序号 | 结果 | 证据 |
|------|------|------|
| B1 | ✅ 通过 | 四类错误全归类：error_class 直认（FP-007 建议对象四类遍历）/ USAGE_MISSING（notice+message 双入口）/ STREAM_UNSUPPORTED（notice+message+streaming=false 三入口）/ UNKNOWN_EVENT_THRESHOLD→drift / retryable=true、STREAM_BROKEN、ECONNRESET/EPIPE/socket hang up→retryable；无法归类返回 null 不降级 |
| B2 | ✅ 通过 | ERNIE/MiniMax/xAI 三个未注册家族 drift 降级均兜底 to_family='openai'（R1 OpenAI 兼容链），轨迹落账一致；§1.3 仅验证不出独立适配器 |
| B3 | ✅ 通过 | 轨迹 §2.1 七字段齐备（session_id/from_family/to_family/error_class/strategy/degraded/ts RFC3339）按序追加；深拷贝输出（外部改写不影响内部账本）；可 reset（会话级/全量） |
| T1 | ✅ 通过 | 全流程联调：normalizeStream(glm) 注入 10 个未映射事件 → stats.degrade_suggested=true + suggestion.error_class → classify → degrade('glm')→to_family='openai'（capabilities.fallback_family）→ markDegraded 全事件 degraded=true + extra.degradation 元信息 → 轨迹落账 |
| T2 | ✅ 通过 | degrade('streaming_unsupported') → strategy=non_stream_fallback + notice=STREAM_UNSUPPORTED + to_family=null（整包=3.4.x 行为），轨迹 to_family:null 符合 §2.1 |
| T3 | ✅ 通过 | degrade('usage_missing') → strategy=estimated_track + notice=USAGE_MISSING（对齐 FP-008 finalizeBudgetStream），估算轨接管不抛错 |
| T4 | ✅ 通过 | markDegraded 合并不覆盖：原有 extra 字段（含 vendor_ref 与带内透传 unknown_events）全部保留（R2）；降级后事件通过 FP-006 validateEvent（I2） |
| T5 | ✅ 通过 | 会话内 2 次降级后第 3 次 → terminate:true + errorEvent(DEGRADE_LIMIT_EXCEEDED, retryable:false, 过 validateEvent) + degraded_count=2 且不追加轨迹；计数按会话隔离 |
| I1 | ✅ 通过 | 8 注册家族 capabilities.fallback_family 均='openai' 且指向已注册适配器；degrade 决策与声明逐家族一致 |
| I2 | ✅ 通过 | markDegraded 后事件与 retryable/超限 errorEvent 均过 FP-006 validateEvent；degraded 布尔标记符合 Schema |
| I3 | ✅ 通过 | 兼容矩阵 11 行（8 注册+3 扩展），全部含 fallback_family 与验证结论；扩展行明示"走 OpenAI 兼容降级链（T2 阶段验证）" |

单测：`node --test tests/toko/fallback-chain.test.js` → 32/32；TOKO 全量回归 195/195（基线 163 + 新增 32）。

补充说明：
- **retryable_stream_error 设计定案**：§1.2 中该类为"宿主决策"（error{retryable:true}+断点续传建议），不属于三策略枚举且不在 §3.3 降级状态转换内——实现为 strategy:null + action:'emit_retryable_error' + errorEvent（合法 PSE error 事件，code=STREAM_BROKEN），不入轨迹、不计降级次数（避免宿主重试与降级账本混淆）。
- **R3 超限行为**：达到 2 次上限后再降级 → {terminate:true, errorEvent, degraded_count}，该次不执行降级、不追加轨迹（无实际降级发生）；retryable 分支不计次。
- **无会话调用**：degrade 不传 sessionId 时仅返回决策（session_id/trace_index 缺省），不落 'global' 轨迹，避免无主降级污染审计账本。
- **classify 归类口径**：按优先序 error_class 直认 → USAGE_MISSING → STREAM_UNSUPPORTED → UNKNOWN_EVENT_THRESHOLD/FAMILY_PROTOCOL_DRIFT → retryable 特征 → null；实现期修复一处 notice 字段识别遗漏（STREAM_UNSUPPORTED 的 notice 形态，对齐 FP-006 回退分支产出）。
- **适配只读消费**：仅调用 FP-007 getAdapter 读取 capabilities.fallback_family，未注册家族 catch 兜底 openai（R1），不触适配器内部状态。
