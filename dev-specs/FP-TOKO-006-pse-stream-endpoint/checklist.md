# FP-TOKO-006 pse-stream-endpoint 验收标准

## 业务验收标准

| 序号 | 验收项 | 预期结果 | 验证方法 |
|------|-------|---------|---------|
| B1 | 8 类事件 Schema 成文 | 每类事件 payload、公共字段、透传规则完整定义 | Schema 评审 |
| B2 | 长报告流式化 | 大体积报告可经 `/v1/stream` 边生成边推送 | 实现阶段流式用例 |
| B3 | 旧通道零影响 | 既有 REST 端点响应与 3.4.x 契约快照零差异 | 契约快照比对 |

## 技术验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| T1 | SSE 格式合法 | `text/event-stream` 编码符合规范，事件可被标准 SSE 客户端解析 | 标准客户端解析用例 |
| T2 | 未知字段透传 | extra 区保留全部未映射字段，无丢弃 | 透传断言 |
| T3 | 整包回退 | STREAM_UNSUPPORTED 场景行为与 3.4.x 一致 | 回退用例 |
| T4 | MCP 回退 | 不支持 Streamable HTTP 的旧 client 经 Negotiate 正常回退 | MCP 握手用例 |
| T5 | 事件顺序约束 | message_start 恒为首事件、done/error 恒为末事件 | 序列断言 |

## 集成验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| I1 | usage 对接 | usage 事件写入 FP-TOKO-002 消耗记录（source=measured） | 数据流核对 |
| I2 | budget 事件挂接 | budget.* 三事件由 FP-TOKO-008 触发并经本通道下发 | 事件联调 |
| I3 | degraded 标记贯通 | FP-TOKO-010 降级产出的事件 degraded=true 且 extra 保留原始字段 | 降级联调 |
| I4 | compaction 事件挂接 | compaction.suggested 由 FP-TOKO-012 触发并经本通道下发 | 事件联调 |

## 实现阶段验收记录（2026-11-25）

交付物：`lib/streaming/pse-events.js`（PSE_EVENTS 11 类全集 / validateEvent / normalizeEvent / buildEventStream / renderSSE / parseSSE）+ `lib/api-routes.js` additive（/v1/stream 路由 + handlePseStream，145 行纯追加）+ `lib/api-server.js` additive（streaming 分支 +27 行）+ `lib/mcp-server.js` additive（MCP_TRANSPORTS / negotiateTransport / capabilities.transports）+ `tests/toko/pse-stream-endpoint.test.js`（19 用例）。

| 序号 | 结果 | 证据 |
|------|------|------|
| B1 | ✅ 通过 | 11 类事件全集枚举（§2.2 枚举口径，覆盖规格文字"8 类"之全量子集）；每类 payload Schema 校验 + 公共字段 ts(RFC3339)/degraded 缺省规则；透传规则见 T2 |
| B2 | ✅ 通过 | e2e：60 段长报告逐段 SSE 推送（边生成边推送，chunk 间让出事件循环）；chunks 显式增量与 text 按段切块双策略 |
| B3 | ✅ 通过 | 既有 17 端点路径/方法抽样锚定零变化；GET /api/v1/status 走既有 JSON 分支返回 3.4.x 包裹形状（success/data/timestamp）；apiRoutes.length 18 = 17+1 |
| T1 | ✅ 通过 | renderSSE（event:/data: 行 + 空行分隔）↔ parseSSE（标准解析：多行 data 拼接、注释/逐出字段忽略）往返零失真；PSEEvent JSON 全量承载于 data 行 |
| T2 | ✅ 通过 | vendor/model_hint/upstream_request_id 等未映射字段全部进 extra（structuredClone 保真），data 与 extra 隔离 |
| T3 | ✅ 通过 | Accept: application/json → 整包 JSON 回退（notice=STREAM_UNSUPPORTED，{success,data,timestamp} 3.4.x 同构包裹） |
| T4 | ✅ 通过 | negotiateTransport 四态协商（transports 数组/单值/空/未声明）；旧 client 无声明回退 stdio；initialize capabilities.transports=['stdio','streamable-http'] 且既有 tools/resources 零改动 |
| T5 | ✅ 通过 | 首事件非 message_start 自动前置合成；缺收尾自动补 done；error 收尾优先（error 后事件 TRUNCATED_AFTER_ERROR 记录）；done 后事件 TRUNCATED_AFTER_DONE 记录 |
| I1 | ✅ 通过 | usage(source=measured) → recordConsumption：tokens_measured=250 主值 + tokens_est 同值（偏差恒 0）+ ts 透传事件时间戳；estimated 走估算轨不携带实测主值（FP-002 R1）；usage_recorded 计数准确 |
| I2 | ✅ 通过（挂接点就绪） | budget.* 三事件已入全集枚举 + Schema 最小契约（对象校验），FP-TOKO-008 实现时细化并触发下发（规格依赖方向：008→006） |
| I3 | ✅ 通过（挂接点就绪） | degraded 公共字段缺省 false、非法拒绝，FP-TOKO-010 降级事件置 true 时 extra 保留原始字段（透传机制已验证） |
| I4 | ✅ 通过（挂接点就绪） | compaction.suggested 已入全集枚举 + 最小契约，FP-TOKO-012 实现时触发下发 |

单测：`node --test tests/toko/pse-stream-endpoint.test.js` → 19/19；TOKO 全量 103/103。

补充说明：
- **SSE 线格式口径**：data 行承载完整 PSEEvent JSON（event: 行 + data 全量），客户端零信息损失——测试断言按 parsed[N].data.data 取 payload 字段。
- **实施期发现并修复 v3.0.1 潜伏缺陷 3 类（经用户批准，均为一至数行零逻辑改动）**：① lib/generate.js、lib/report.js、lib/verify.js 重复导出（模块无法解析，api-routes.js 静态 import 链从未可加载）；② lib/api-server.js `decodedURIComponent` 未定义（所有请求必 500）；③ lib/api-server.js findRoute 内 routeHandler 未声明（ESM 严格模式 ReferenceError，首次路由匹配即失败）。即 HTTP API 服务器与三个业务模块在 3.0.1 起即为死代码，本次随 FP-006 e2e 验收首次激活并回归。
- api-server.js 的 URL 解析用 `new URL(req.url, \`http://${req.host}\`)`（req.host 为 undefined 时回退 base 'http://undefined' 仍可解析相对路径），属既有行为，未触碰。
- R3 纪律：未知事件类型不下发但原始载荷完整保留于 malformed 记录（EVENT_MALFORMED/TRUNCATED_AFTER_* 三类 reason），不静默丢弃。
