# BDRM-TEST-SYSTEM 开发规格
版本: v1.0.0

## Agent 注册与鉴权 |agent-register
#### 功能描述
py Agent 启动后报备上线。校验请求头 X-Agent-Key（共享密钥，配置于 application.yml），错误返回 code=403。按 agent_id 幂等 upsert bdrm_agent：不存在插入 status='online'，存在则更新 hostname/ip/version/cpu/mem_mb/config_version/last_seen（重复注册绝不新增记录）；同 agent_id 不同 IP 返回 409 提示人工确认。签发 JWT agent_token（subject=agentId，24h 有效期）写入响应；返回 heartbeat_interval=10 / idle_heartbeat_interval=30 / report_interval=15 / log_tail_lines=200 / server_time（yyyy-MM-dd HH:mm:ss 字符串）；推 SSE agent_online。其余接口校验 X-Agent-Token，失效返回 code=401（Agent 自动重新 register 不中断在跑轮次）。6+1 个 /api/bdrm/agent/** 接口加入 Sa-Token 放行白名单（excludePathPatterns）。

#### 验收标准
- X-Agent-Key 错误时返回 code=403 msg=共享密钥错误
- 同一 agent_id 重复 register 不产生第二条记录且 status 置回 online
- 同 agent_id 不同 IP 返回 409 并提示人工确认
- 响应必含 agent_token/heartbeat_interval/server_time，时间格式 yyyy-MM-dd HH:mm:ss
- /api/bdrm/agent/** 无登录态可访问（白名单生效），X-Agent-Token 错误返回 code=401

#### 接口定义
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /register | - |
| GET | /bdrm/task/{taskId} | - |
| GET | /bdrm/config/global | - |
| PUT | /bdrm/config | - |

## 心跳兼取任务 |heartbeat-task
#### 功能描述
一次请求办两件事。① 更新 bdrm_agent.last_seen=NOW()，status=有 running_tasks?'busy':'online'，summary/health 快照落库（last_summary/last_health JSON，可选 bdrm_agent_metric 历史表）。② 原子取任务：SELECT ... WHERE agent_id=? AND status='pending' AND (expire_at IS NULL OR expire_at>NOW()) ORDER BY FIELD(priority,'urgent','normal','low'), created_at LIMIT 1 FOR UPDATE，取到后立即 UPDATE status='dispatched', dispatched_at=NOW()（防两台机抢同一任务）。Agent 忙（running_tasks 非空）时只下发 stop_groups/stop_group（停止必须可插队），其他类型跳过。响应含 has_task/task/heartbeat_interval/idle_heartbeat_interval/report_interval/config_drift/max_concurrent_tasks=2；无任务时 task=null。

#### 验收标准
- 任务必须在响应 data.task 内，has_task 与 task 一致
- 并发心跳不重复下发同一 task_id（FOR UPDATE + 立即 dispatched）
- priority 排序生效：urgent 插到 normal/low 之前
- Agent 忙时非 stop 任务不下发，stop_groups/stop_group 正常下发（插队）
- 心跳后 last_seen 每 10 秒刷新，status 随 running_tasks 切换 online/busy
- 过期任务（expire_at<NOW()）不被下发

#### 接口定义
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /heartbeat | - |

## 任务受理确认与终态回执 |task-ack-result
#### 功能描述
POST /task/ack：按 accepted 更新 bdrm_task.status='acked'/'rejected'，保存 precheck 明细 JSON 与 reason_code；accepted=false 时推 SSE 告警（level=error）。reason_code 自动决策表：TASK_RUNNING→任务改回 pending 等下次心跳重派；GROUP_BUSY→提示管理员或改派空闲组；PRECHECK_FAIL/DISK_LOW→告警不自动重试；NO_RUN_WINDOW→计算窗口结束时间到点重派；EXPIRED→丢弃；UNSUPPORTED→禁用该任务类型；INTERNAL_ERROR→重试 1 次。

#### 验收标准
- 8 种 reason_code 均有对应处理分支，TASK_RUNNING 场景任务最终回到 pending 且能被重新取走
- 重复 POST /task/result（同 task_id）第二次返回 duplicate=true，bdrm_task 状态与 SSE 均不变
- aborted 状态不触发 error 告警；partial 高亮失败组
- 停止场景闭环：压测期间下发 stop_groups → start 任务变 aborted、stop 任务变 success

#### 接口定义
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /task/ack | - |
| POST | /task/result | - |

## 进度指标与事件上报 |report-metrics
#### 功能描述
处理 report：遍历 metrics.rounds[] 幂等 upsert 到 bdrm_round（唯一键 uk_round(agent_id, round_id)，INSERT ... ON DUPLICATE KEY UPDATE）；遍历 events[] 按 event_id 幂等插入 bdrm_event（INSERT IGNORE）；更新 bdrm_task 进度快照（progress.percent/stage/eta_min）；将 rounds 与 events 转发 SSE 给前端。响应：accepted=true（限流时 false，Agent 自动降频）、ack_event_ids、next_report_in=15、discard_fence=false（本期恒 false）。日志不上报正文（只含结构化事件），查日志走 fetch_log 任务（Agent 把尾部若干行放在 task/result 回传）。

#### 验收标准
- 同一 round_id 重复上报只更新不重复插（uk_round 生效），e2e_pass_rate 取最新值
- 同一 event_id 重复上报不产生第二条事件记录
- report 期间 SSE 实时收到 task_progress/group_state/event 事件
- error 级事件（DEVICE_INSTALL_FAIL/E2E_CASE_FAIL）在前端告警区可见

#### 接口定义
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /report | - |

## 数据库表设计与种子数据 |db-schema
#### 功能描述
建 5 张表（InnoDB + utf8mb4，DDL 以《Java端对接文档》§4 为准）：bdrm_agent（注册表，uk_agent_id，idx_status/idx_last_seen）、bdrm_task（任务表，uk_task_id，idx_agent_status/idx_status_priority，status 11 态 pending/dispatched/acked/running/success/failed/aborted/partial/rejected/expired/unknown）、bdrm_round（轮次指标，uk_round(agent_id, round_id) 上报幂等关键，idx_task/idx_time/idx_group）、bdrm_event（事件告警，uk_event_id，idx_agent_time/idx_level）、bdrm_config（期望配置唯一真源，uk_agent_key(agent_id, key_name)，agent_id='*' 全局默认，具体机覆盖全局）。可选第 6 张 bdrm_agent_metric（心跳快照历史）。建表后初始化全局配置 5 条：N_PER_GROUP=6 / TIMES=450 / IP_PROVIDER=kdlapi / PURGE_PER_ROUND=1 / NO_RUN_WINDOWS=20:55-07:10。

#### 验收标准
- 5 张表唯一键与索引与 DDL 一致，重复插入被数据库拒绝
- bdrm_config 初始化 5 条全局默认（agent_id='*'）
- bdrm_task.fence 落库默认 1（本期不改参重下发，仅预留）

#### 接口定义
| 方法 | 路径 | 说明 |
|------|------|------|
<!-- 待补充: 该功能点相关接口 -->

## 失联判定与任务回收定时任务 |health-job
#### 功能描述
失联扫描（每 15s）：WHERE status IN ('online','busy') AND last_seen < NOW() - 30 SECOND（超时=3×heartbeat_interval）→ 标 offline + 推 SSE agent_offline；该机存在 running 任务时标 unknown + 推 AGENT_LOST_WITH_TASK error 告警。失联不自动重派任务——无法确认设备侧是否真在跑，自动重派会让两台机操作同一批 redroid 容器直接撞车，压测场景安全底线，必须人工确认。任务回收（每 30s）：status='dispatched' AND expire_at < NOW() 的未 ack 任务改回 status='pending', dispatched_at=NULL，防 Agent 死亡导致任务卡死。Agent 被 kill -9 不会调 /offline，本模块是唯一失联兜底。

#### 验收标准
- 杀掉 Agent 进程 ≤30s 内 bdrm_agent.status 变 offline 并推送 agent_offline
- 失联 Agent 的在跑任务标 unknown 并触发 AGENT_LOST_WITH_TASK 告警，不被自动重派
- dispatched 超过 expire_at（5min）未 ack 的任务自动回 pending

#### 接口定义
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /offline | - |

## 配置管理与任务类型透传 |config-manage
#### 功能描述
bdrm_config 表为配置唯一真源（全局 '*' + 单机覆盖）。GET /config/{agentId}：合并该机记录与全局默认（具体机覆盖全局）返回 config 对象，key 必须与本机 config.ini 键名一字不差（大写+下划线），Agent 备份后逐行替换落盘。config_reload 任务随时可下发——Agent 只改盘上 config.ini，不打断正在跑的轮次（新配置下次 start 生效）。config_drift 判定：期望配置拼 k=v\n 取 md5 前 12 位与 Agent 上报 config_version 比对；初期恒返回 false，基本流程跑通后再启用，启用后心跳响应携带并自动下发 config_reload。12 种任务类型原样透传不理解语义：start_groups/start_group/stop_groups/stop_group/config_reload/config_set/preflight/report_generate/fetch_log/restart_appium/upgrade/ping；params 中配置类键名（N_PER_GROUP/TIMES/IP_PROVIDER/PURGE_PER_ROUND/IP_REUSE/IP_REUSE_MIN/ROUND_BUDGET_MIN/PROXY_MAX_RTT/NO_RUN_WINDOWS/NO_RUN_MODE/IP_PROXIES）与 config.ini 完全同名，Java 侧只放值不解释。

#### 验收标准
- GET /config/{agentId} 返回的 key 与 config.ini 键名完全一致
- 压测运行中下发 config_reload，在跑轮次不被打断
- 12 种任务类型下发后 Agent 均能受理（capabilities 内的类型）

#### 接口定义
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /config/{agentId} | - |

## SSE 实时推送 |sse-push
#### 功能描述
提供 SseService（ConcurrentHashMap 管理 SseEmitter，0L 不超时，onCompletion/onTimeout/onError 清理）与订阅入口 GET /api/bdrm/stream（produces=text/event-stream）。事件类型 9 种：agent_online/agent_offline/task_dispatched/task_progress/task_finished/group_state/event/config_drift/heartbeat（15s 保活防代理断连）。订阅接口走 RuoYi 正常登录鉴权（浏览器原生 EventSource 不支持自定义头，带 cookie 即可），绝不加入 /api/bdrm/agent 的放行白名单。前端 Vue3 new EventSource('/api/bdrm/stream') + addEventListener 按事件类型分发。

#### 验收标准
- 未登录用户访问 /api/bdrm/stream 被拒（401），登录用户正常订阅
- register/offline/心跳下发任务/report/result 全链路事件均可实时到达前端
- 客户端断开后 emitter 从 Map 清理，无内存泄漏

#### 接口定义
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/bdrm/stream | - |

## 任务下发管理 |task-dispatch
#### 功能描述
后台管理动作插入 bdrm_task：task_id 规则 T-yyyyMMdd-0001；priority='urgent'（页面立即执行）/normal/low；status='pending'；fence=1；params JSON（groups/stagger_sec 及 config 同名键）；expire_at=当前+5 分钟；created_by=操作人。典型入口：启动组 1-6（start_groups，串行 stagger_sec=20 避免抢 IP）、停止单/多组（stop_groups，purge）、连通性测试（ping）。「立即执行」不需要额外推送通道——Agent 心跳周期 10s 决定时延上限 ≤10s。

#### 验收标准
- 页面点「立即启动 组1-6」后 ≤10s Agent 取走任务，bdrm_task 状态流转 pending→dispatched→acked→running→success 可查
- 停止指令在压测运行期间下发立即生效（Agent 中止 start 任务）
- 任务列表可按 agent_id/status/priority 筛选，展示 title/params/created_by/时间戳

#### 接口定义
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /bdrm/task/dispatch | - |

## 前端管理页面 |admin-ui
#### 功能描述
RuoYi-Vue-Plus（plus-ui Vue3 + Element Plus）新增「BDRM 压测调度」菜单组，5 个页面：① Agent 状态页：卡片网格，每 Agent 一卡展示 IP/version/CPU/内存/磁盘/容器数/groups_running 与 groups_idle 徽标/心跳新鲜度（超 30s 红色高亮），SSE 实时增减；② 任务下发页：组 1-6 Checkbox（运行中禁选），参数表单 TIMES/IP_PROVIDER/PURGE_PER_ROUND/IP_REUSE 等（默认取 bdrm_config 全局值），按钮区立即启动/停止/环境体检/重启Appium/测试连接；③ 任务列表页：表格列 task_id/类型/优先级/状态标签/标题/创建人/时间，行点击抽屉展示 precheck 逐项/summary/groups_result/error/reason_code；④ 轮次指标页：bdrm_round 表格 + 图表（每组每轮 duration/identity 通过率/e2e 通过率趋势，全局进度 total_target/rounds_done/ok/failed/void）；⑤ 事件告警页：bdrm_event 按 level/code/时间筛选，error 置顶，detail JSON 展开。

#### 验收标准
- 5 个页面挂入 RuoYi 动态菜单（sys_menu 三层 M/C/F 配置），权限标识生效
- Agent 状态页数据随 SSE 实时刷新，无需手动刷新页面
- 任务下发表单校验：groups 至少选 1 组，TIMES 为正整数
- 轮次指标图表数据源为 /bdrm/round 列表接口（分页+按组筛选）

#### 接口定义
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /bdrm/agent/list | - |
| GET | /bdrm/task/list | - |
| GET | /bdrm/round/list | - |
| GET | /bdrm/event/list | - |
