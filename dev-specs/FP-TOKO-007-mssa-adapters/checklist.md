# FP-TOKO-007 mssa-adapters 验收标准

## 业务验收标准

| 序号 | 验收项 | 预期结果 | 验证方法 |
|------|-------|---------|---------|
| B1 | 8 家族适配器全量 | openai/anthropic/gemini/deepseek/qwen/glm/kimi/doubao 各一份，含 capabilities + tested_at | 清单核对 |
| B2 | SPI 与插件规范一致 | plugin.json 声明 provides=mssa-adapter，可被现有插件加载器识别 | 加载冒烟 |
| B3 | 映射总表落地 | §2.1 表 5 事件 × 8 家族全部有映射或显式标注"部分/无" | 表格逐格核对 |

## 技术验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| T1 | 契约测试全绿 | 每适配器夹具（录制样本回放）断言归一化结果一致 | 夹具回放 |
| T2 | 透传完整性 | 未映射字段全部出现在 extra 且无丢失 | 构造含生僻字段的样本 |
| T3 | UnknownEvent 计数 | 累计计数可查询并触发降级上报 | 注入畸形流用例 |
| T4 | 能力声明一致 | capabilities 声明与夹具实测行为一致 | CAPABILITY_MISMATCH 用例 |
| T5 | tokenizer 经 profile | estimateTokens 输出与 FP-TOKO-001 系数一致 | 系数比对 |

## 集成验收标准

| 序号 | 验收项 | 标注 | 验证方法 |
|------|-------|------|---------|
| I1 | PSE 贯通 | normalize 产物直接满足 FP-TOKO-006 Schema | 事件流联调 |
| I2 | 降级链贯通 | fallback_family 与 FP-TOKO-010 决策器对接 | 降级联调 |
| I3 | 现有插件共存 | android-toolchain 等既有插件加载不受影响 | 插件加载冒烟 |

## 实现阶段验收记录（2026-11-25）

交付物：`lib/streaming/adapters/`（shared/ 三引擎：adapter-kit + openai-compatible（openai/deepseek/qwen/glm/kimi/doubao 六家族参数化）+ anthropic-adapter + gemini-adapter；registry index.js：getAdapter/listAdapters/normalizeWithAdapter/normalizeStream/UnknownEvent 计数与降级建议；8 家族目录各含 index.js + plugin.json(provides=mssa-adapter) + fixtures.json 契约夹具）+ `tests/toko/mssa-adapters.test.js`（35 用例）。既有源码零改动（git diff 审计：本次 7 个 M 文件均为 FP-001~006 已批准修改）。

| 序号 | 结果 | 证据 |
|------|------|------|
| B1 | ✅ 通过 | 8 家族全量注册（ADAPTER_FAMILIES 与 FP-001 FAMILIES 对齐），meta 含 tested_at=2026-11-25 + upstream_version + sample_source=synthetic；fixtures.json/plugin.json 逐家族齐备 |
| B2 | ✅ 通过 | 每份 plugin.json 经 PluginManifest.validate 全通过；PluginManager 指向 adapters 目录 discover=8、loadAll 全部激活（PluginBase 子类 + provides=mssa-adapter） |
| B3 | ✅ 通过 | §2.1 映射总表逐家族契约回放落地：5 事件 × 8 家族全部有映射（kimi reasoning 显式标注"部分"——k2 thinking 系列 delta.reasoning_content，主流系列无字段与 profile 口径一致）；anthropic ping/content_block_stop/message_stop/signature_delta 显式忽略清单不计数 |
| T1 | ✅ 通过 | 8 家族夹具（synthetic）回放断言归一化结果逐字段一致（openai tool 增量分片 toolState 补齐 id/name、anthropic input_json_delta 经 blockMap 归位、gemini functionCall 聚合、qwen DashScope 信封）；同一 chunk usage+finish 时 usage 先于 done（T5 顺序保障） |
| T2 | ✅ 通过 | 未映射字段全部落 extra：openai x_vendor_extension/delta.custom_flag、anthropic citation、gemini safetyRatings、deepseek prompt_cache_miss_tokens、doubao 方舟 completion_tokens_details；消费键清单仅含真正映射键（id/model/request_id 等一并透传） |
| T3 | ✅ 通过 | UnknownEvent 按 family::session 计数可查询；≥阈值 10 触发降级建议（error_class=family_protocol_drift，last_unknown_raw 保留，仅首次跨越 WARN）；载荷经 extra.unknown_events 带内透传（前置挂下一事件/流尾兜底挂末事件）；reset 可清 |
| T4 | ✅ 通过 | auditCapabilityConsistency：8 家族声明 vs FP-001 profile 全一致（prefix_cache/max_context/reasoning_channel/usage_reporting 数值锚定）；负例（billing 漂移、reasoning_channel 虚报）→ CAPABILITY_MISMATCH(err.code) |
| T5 | ✅ 通过 | 8 家族 × zh/en/code estimateTokens 输出与 FP-002 estimateTokens 全等（经 profile 不自造系数，R4）；mixed 越界 → ADAPTER_INVALID_CONTENT_TYPE，非字符串 → ESTIMATE_INVALID_CONTENT 透传 |
| I1 | ✅ 通过 | 8 家族 normalizeStream 产物逐事件通过 FP-006 validateEvent；anthropic SSE 文本端到端 parseSSE→normalizeStream→buildEventStream（malformed=0，message_start 恒首/done 恒末，usage_recorded=2 入 FP-002 消耗记录）→renderSSE |
| I2 | ✅ 通过（接缝就绪） | fallback_family 全量 openai；降级建议对象含 family/session_id/error_class/count/threshold/degraded/ts/last_unknown_raw，FP-010 classify(family_protocol_drift) 可直接消费；会话隔离验证（fp007-i2 不影响 global） |
| I3 | ✅ 通过 | android-toolchain 经 PluginManager 加载激活成功（pddVersion 3.5.0），与 adapters 共存零影响 |

单测：`node --test tests/toko/mssa-adapters.test.js` → 35/35；TOKO 全量回归 138/138（基线 103 + 新增 35）。

补充说明：
- **UnknownEvent 计数分层**：SPI normalize() 纯映射不计数；计数/降级集中在 registry（normalizeWithAdapter/normalizeStream 单一入口），避免包装双层计数。
- **带内透传纪律**：PSE_EVENTS 为封闭枚举，未知事件不得另造事件类型——载荷经 extra.unknown_events 挂载（镜像 FP-006 "不静默丢弃" 纪律）。
- **适配器实例态**（openai toolState/anthropic blockMap/gemini toolSeq）随 done 自动清空，normalizeStream 回放前置 resetStreamState 保证幂等。
- usage 事件一律 source='measured'（供应商实测口径）；fp007 契约记录的降级建议为内存态（与 FP-002 R4 同口径不落盘），FP-010 实现时按其决策器格式归一。
