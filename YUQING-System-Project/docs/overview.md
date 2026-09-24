# P0 关键词链路改造 · 概览

**日期**：2026-09-22  ·  **范围**：P0-1 ~ P0-4 + PC 端类型缺陷  ·  **交付文档**：`docs/P0-关键词链路改造-交付说明.html`

---

## 做了什么

修好了「**采不到东西、而且不报错**」这条链路。改造前，业务同事手写的组合表达式在系统里只是一个普通字符串——
类型、分类、组合表达式、匹配策略全被丢弃，采集只取第一个词去检索，结果是**任务显示成功、入库 0 条、日志无任何错误**。

| 项 | 内容 |
|---|---|
| P0-1 | 关键词生效改造：`buildMatcher(taskId)` 装载全字段；检索词组逐词请求（请求量 = 主题词数，非笛卡尔积）；入库前本地过滤，且过滤发生在去重之前；新增 `filteredCount` / `isAllFiltered()` 让「全被过滤」可观测且不误报异常 |
| P0-2 | 组合表达式校验器：带列号的错误提示 + 全角容错 + 冗余外层括号剥离 + 冒号标题剥离 + 裸 OR 组；PC 表单实时校验 |
| P0-3 | 任务级降噪：`keyword_type=negative` 经 `yq_task_keyword` 绑定后生效；全局 `yq_noise_rule` 默认不参与（无任务维度会误杀） |
| P0-4 | 词表导入工具：PC 对话框（上传/粘贴 → 预览 → 确认）+ 2 个 REST 接口 + SQL 种子，按 `keyword_text` / `(task_id, keyword_id)` 幂等 |

## 关键决策

- **主题词检索 + 地区本地校验**，不做笛卡尔积：样例1 从 96 次请求降到 6 次，避免触发渠道限流。
- **解析出错整份拒绝**：不写半成品，避免又制造一个「静默 0 条」。
- **超长表达式报错而非截断**：`keyword_text` 列宽 100，超出直接提示拆分。
- **排除词必须绑定任务才生效**：177 个「东北超」排除词绑到药监任务会误杀。

## 实测数据（脚本核验，非估算）

真实词表《关键词样例.txt》：组合 **2** 条（16+6 / 5+4）+ 排除词 **188 → 177** 条（跳 11 重复）= 待入库 **179** 条；预计检索请求 **10** 次/轮。

## 验证结果

| 验证项 | 结果 |
|---|---|
| 生成器语法自检 | 通过 ×2 |
| 后端编译 | `exit=0`，206 主类 / 10 测试类 |
| 离线自测 | **34 / 34 PASS**（10 引擎 + 13 关键词 + 11 导入） |
| SQL 交付前校验（10 类） | **ALL PASS，警告 0** |
| PC 类型检查 | **yuqing 0 错误**（全项目 126 → 69，余量属 presale / inspect / monitor） |

## 过程中发现并修掉的 8 个真实缺陷

D1 冗余外层括号导致样例2 无法解析 · D2 归一化残留前后空格 · D3 拆词内部去重使重复计数恒为 0 ·
D4 冒号标题撞左括号缺配对 · D5 30 个 types.ts 误 import 全局 `PageQuery`（40 错） ·
D6 VO 重复声明 `createTime`（8 错） · D7 无条件调用 `loadForeignOptions`（3 错） · D8 `el-tag` type 联合类型（1 错）

> **流程教训**：`gen-yuqing-collect.mjs` 尾部 4 段由 `part11a~d.js` 合并生成。本次两次「直接改生成器里的这段」，
> 随后合并脚本用旧 part 文件把修改**静默覆盖**，表现仅为部署报告 `~0 覆盖`，极难察觉。
> 现已让合并脚本在段头写明来源、并在合并后自检关键符号，缺失即报错退出。

## 下一步

1. 其他项目的同类 `PageQuery` 缺陷（presale 41 / inspect 26 / monitor 2）——修法相同，本次未动。
2. 9 个待手写模块：F-006 净化去重、F-007 智能研判、F-009 多维分析、F-010 预警处置、F-011 推送发送、F-014/F-015 报告生成与渲染、F-017 知识库与模型迭代、F-018 运行监控 + 9 个企业微信 H5 页面。
3. 词表导入若需支持 Excel：在 `KeywordImportParser` 前加「表头映射 → 文本」适配层即可，解析逻辑不变。
4. 网址清单（32 条：1 就绪 / 1 需栏目遍历 / 7 需登录态 / 18 无 URL）仍是独立推进线。

---

# 第二轮：全项目类型错误清零 + F-006 方案

## P1：vue-tsc 69 → 0

| 根因 | 条数 | 修法 | 生成器源头 |
|---|---|---|---|
| `import type { PageQuery } from '@/api/types'`（PageQuery 实为全局环境接口） | 10（连带消 33 条 TS2339） | 删该行 | `gen-inspect.mjs:1141`、`gen-ruoyi.mjs:586` |
| presale `@click="handleDelete"` 绑 el-button 签名不兼容 | 5 | 改 `handleDelete()` | `gen-ruoyi.mjs:631` |
| inspect 照片预览 `:initial-index="pi"`（索引被推成 `string\|number`） | 2 | `Number(pi)` | 手写页，直改 |
| monitor `logininfo` import 大小写撞 `loginInfo` | 2 | 改成驼峰 | 框架自带文件 |
| `views/presale/_manual-backup-*` 备份目录（死代码） | 18 | 加进 tsconfig `exclude`（未删除） | — |

**验证**：复跑 vue-tsc → 0 条；生成器重跑后与已部署文件 diff **字节一致**（`presalegoods/index.vue`、`inspect room/types.ts`），
证明补丁等价于重新生成。

## F-006：设计完成，待确认后实现

`docs/F-006-数据净化与去重-技术方案.html`。

- `yq_noise_rule` 是**死表**（有 CRUD、无消费者）；`CollectPipeline.dedupeAndFilter()` 第 3 步是预留位
- 字典 7 类降噪类别已齐全，与验收标准 1 一一对应，无需新增字典
- 需加列 `yq_opinion.dup_channel_ids`（Doris + MySQL 镜像）
- **2 项待拍板**：跨天去重口径（按天 / 全局索引表）、重跑记录载体（新建表 / 复用 `yq_collect_log`）

---

# 第三轮：F-006 实现完成（用户拍板：按天去重 + 新建 yq_clean_batch）

**交付文档**：`docs/F-006-数据净化与去重-实现说明.html`

## 交付内容

| 层 | 新增 | 改写 |
|---|---|---|
| 后端 Java | 18（`collect/clean/` 10 + `YqCleanBatch` CRUD 5 + 重跑服务/控制器 3） | 5（配置 / RawOpinion / CollectResult / CollectPipeline / YqOpinion） |
| 后端测试 | 1（`F006CleanTest`，19 用例） | 3 |
| SQL | 0 | 5（schema +1 表、Doris 与 MySQL 镜像 +2 列、字典 +2 类、菜单 +1 菜单 6 按钮） |
| PC 前端 | 5（cleanBatch api/views + `clean/replay.ts` + 重跑对话框） | 0 |
| H5 | 1（`cleanBatch.js`） | 0 |

## 关键设计

- **按天去重**：去重键 `(collect_date, url_hash)`，跨天不算重复（保留多天传播态势）
- **判定顺序**：空白 → 库表规则（按 priority）→ 机器人 → 灌水 → 无意义短句；库表规则排在内置启发式之前，让业务意图优先
- **管线顺序**：关键词过滤 → 净化降噪 → 按天跨渠道合并 → 跨批次 Redis 去重 → 快照；刻意「先净化后去重」，否则首次误判会永久化
- **正则写错降级为字面量匹配**，不让一条坏规则拖垮整批（与 P0 修的「静默失败」同一类防线）
- **重跑不加 `@Transactional`**：Doris 与 MySQL 无法共享本地事务，改为「逐条更新 + 失败即停 + 批次标记 failed」，重跑即可续跑

## 实测验证

| 验证项 | 结果 |
|---|---|
| 后端 `test-compile` | `exit=0`（205 主类 / 5 测试类） |
| 离线自测 | **53 / 53 PASS**（原 34 + F-006 新增 19） |
| SQL 交付前校验（11 类） | **ALL PASS，警告 0**（第 11 类为本次新增，16 项） |
| PC `vue-tsc` | **0 错误**（全项目） |
| 残留 `.bak-*` | 0（清理 14 个） |

## 已知边界

1. 跨渠道合并只覆盖「同一次调度内」；跨批次撞车计入 `dupChannelCount` 但不回写首条渠道列表（攒批已落盘，回头改不划算）
2. `dedupScope=global` 未实现，配成 global 会按 day 处理并打告警
3. `yq_doris_mysql_fallback.sql` 仍是手写模板 —— 曾尝试改为 `gen-yuqing.mjs` 产出，发现两个生成器会互相覆盖，已回退保留单一归属

## 下一步

1. F-007 智能研判（依赖 F-006 产出的 `clean_status=cleaned` 数据）
2. F-009 多维分析看板接入去重率 / 降噪率指标（数据侧已就绪，缺 UI）
3. 词表导入若需支持 Excel：在 `KeywordImportParser` 前加「表头映射 → 文本」适配层即可
4. 网址清单（32 条：1 就绪 / 1 需栏目遍历 / 7 需登录态 / 18 无 URL）仍是独立推进线

---

# 第四轮：F-010 风险预警 + F-011 企业微信推送 实现完成

**交付文档**：`docs/F-010-F-011-预警处置与企业微信推送-实现说明.html`
**新生成器**：`gen-yuqing-alert.mjs`（主入口 + `tpl1~tpl5` 五个模板分片）

## 交付内容

| 分组 | 文件 | 内容 |
|---|---|---|
| `alert/` | 15 | AlertEngine / AlertRuleSpec / AlertScene / AlertStatusMachine / AlertFingerprint / BurstDetector / LevelResolver / AlertCountSource / AlertCandidate / AlertDecision / AlertScanRequest / AlertScanStats / YqOpinionReader + 配置 |
| `push/` | 15 | PushDispatcher / PushTargetResolver / PushTemplateRenderer / QuietHours / PushRetryPolicy / WecomTransport / HttpWecomTransport / LoggingWecomTransport / WecomTokenHolder / JdbcPushUserDirectory + 模型 |
| `service/` | 4 | `IYqAlertDispatchService` / `YqAlertDispatchServiceImpl` / `IYqPushDispatchService` / `YqPushDispatchServiceImpl` |
| `controller/` | 2 | `YqAlertDispatchController`（6 端点）/ `YqPushDispatchController`（3 端点） |
| `job/` | 1 | `YqAlertScanJobExecutor`（`@JobExecutor("yuqingAlertScan")`） |
| `config/` | 1 | `yq_alert.yml` |
| PC 端 | 7 | `api/yuqing/{alert,push}/dispatch.ts` + 预警处置台 / 推送台账 view |
| H5 端 | 2 | `api/yuqing/alert/dispatch.js` + `pages/yuqing/alert/index.vue` |
| 测试 | 1 | `F010AlertPushTest`（63 用例） |

合计 **48 文件 / 250.7 KB**；新增 **9 列**（`yq_alert_rule` 6 / `yq_push_rule` 2 / `yq_alert` 1）；**未新增字典**。

## 四个拍板决策

- **预警独立定时扫描**（`yuqingAlertScan`，建议 5min），不挂采集管线尾部：突发增量必须跨批次看窗口，且采集失败不应连累预警
- **兜底分级器 `LevelResolver`**：F-007 未落地时本地判级，落地后自动让位，不改调用方
- **突发基线 = 近 7 窗口移动均值**，且要求 `cur ≥ min_burst_count`，防「1 条变 3 条 = 300% 突发」虚高
- **企微真实 HTTP；无凭据一律记失败**（通道降级为日志但返回 failed + 原因），不做假成功

## 关键设计

- **判定链**：场景匹配 → 分级兜底 → 窗口计数 → 突发判定 → 阈值比对 → 指纹冷却 → 落库；单条规则异常只降级该规则
- **预警状态机**：`pending/processing/handled/ignored`，`handled`/`ignored` 强制处置说明；处置人只从 Sa-Token 取，请求体里的 `processBy` 一律忽略
- **事件指纹**：任务 + 场景 + 事件键 + 级别 拼 SHA-256（`VARCHAR(64)`），同指纹在 `cooldown_minutes` 内不重复落库
- **推送流水线**：目标解析 → 场景/级别绑定 → 免打扰（支持跨夜，命中记 `deferred` 不算失败）→ 模板渲染（10 要素明细 / 摘要式）→ 截断 → 传输 → 重试（2000ms × 2^(n-1)，硬上限 10）→ 落 `yq_push_record` → 回写 `yq_alert.push_result`
- **定时批量顺延**：免打扰期的消息不丢，由 `flushScheduled()` 在下一非免打扰时段刷出（PC 与定时任务双入口）
- **权限码前后端逐一对齐**：PC 处置按钮 = `yuqing:alert:process` = 后端注解；扫描/预览/统计 = `yuqing:alert:list`；推送 = `yuqing:push:edit`，杜绝「按钮看得见点了 403」
- **产物归属边界写进生成器头注释**：本生成器不产出 domain/mapper/CRUD service/CRUD 前端，避免与 `gen-yuqing.mjs` 互相覆盖

## 自测抓出的两个真实缺陷

1. `applyTemplate` 未清空未知占位符 → 企微里会原样出现 `链接：{url}`。修法：替换已知占位符后扫一遍清掉未被提供的 `{xxx}`（单层、长度 ≤33 才认）
2. `normalizeMaxRetry` 负数语义反了 → `-1` 被当「未配置」回落成 3，**想关掉重试反而重试 3 次**。修法：负数 = 显式禁用（0 次），只有 `0`/缺失才回落默认

## 实测验证

| 验证项 | 结果 |
|---|---|
| 生成器 `node --check` ×6 | exit 0 |
| 生成 | 48 文件 / 250.7 KB |
| 部署 | `+0 新增 / ~2 覆盖 / 380 未变`（三端总计 381 文件） |
| 后端 `test-compile` | `exit=0`（yuqing 主类 **242** / 测试类 **6**） |
| 离线自测 | **116 / 116 PASS**（既有 53 + `F010AlertPushTest` 63） |
| SQL 交付前校验（12 类） | **ALL PASS，警告 0**（第 12 类为本次新增，17 项；权限闭环 28 个码全部命中菜单） |
| PC `vue-tsc` | **0 错误**（全项目） |
| 残留 `.bak-*` | 0（清理 5 个） |

## 已知边界

1. 判级仍是兜底的（F-007 未落地），高风险判定的准确度受限于规则而非模型
2. 企微真实链路未在真实凭据下跑通（本机无 `corpId/corpSecret/agentId`，实测走的是「降级记失败」分支）
3. 验收 10 报告文件推送只完成一半：`sendFile()` + H5 入口基址已就绪，触发方在 F-014/015
4. 验收 9 短信/电话只留扩展点（实现 `WecomTransport` + 加一枚 `channel_type` 字典值即可），本期按 PRD 不开通
5. 「120 秒内送达」是机制上满足而非压测过：扫描周期 5min 时最坏会超，生产建议即时场景调 1min
6. 突发基线依赖 Doris 有历史数据，冷启动头 7 窗口只靠 `min_burst_count` 兜底（偏保守）

## 下一步候选

1. **F-009 多维分析**：去重率/降噪率 + 预警命中率看板（数据侧全部就绪，缺 UI）
2. **F-007 智能研判**：落地后 `LevelResolver` 自动让位，预警准确度上一个台阶
3. **F-014/F-015 报告生成与渲染**：打通验收 10 的后半段（文件推送）
4. 9 个企业微信 H5 页面 + 3 个企微免登后端接口
