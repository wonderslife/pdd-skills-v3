# 失联判定与任务回收定时任务
ID: F-006
优先级: P0
来源: REQ-006

失联扫描（每 15s）：WHERE status IN ('online','busy') AND last_seen < NOW() - 30 SECOND（超时=3×heartbeat_interval）→ 标 offline + 推 SSE agent_offline；该机存在 running 任务时标 unknown + 推 AGENT_LOST_WITH_TASK error 告警。失联不自动重派任务——无法确认设备侧是否真在跑，自动重派会让两台机操作同一批 redroid 容器直接撞车，压测场景安全底线，必须人工确认。任务回收（每 30s）：status='dispatched' AND expire_at < NOW() 的未 ack 任务改回 status='pending', dispatched_at=NULL，防 Agent 死亡导致任务卡死。Agent 被 kill -9 不会调 /offline，本模块是唯一失联兜底。

## 验收标准
- 杀掉 Agent 进程 ≤30s 内 bdrm_agent.status 变 offline 并推送 agent_offline
- 失联 Agent 的在跑任务标 unknown 并触发 AGENT_LOST_WITH_TASK 告警，不被自动重派
- dispatched 超过 expire_at（5min）未 ack 的任务自动回 pending
