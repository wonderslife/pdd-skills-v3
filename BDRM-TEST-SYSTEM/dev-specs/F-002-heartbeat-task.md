# 心跳兼取任务
ID: F-002
优先级: P0
来源: REQ-002
接口: POST /api/bdrm/agent/heartbeat

一次请求办两件事。① 更新 bdrm_agent.last_seen=NOW()，status=有 running_tasks?'busy':'online'，summary/health 快照落库（last_summary/last_health JSON，可选 bdrm_agent_metric 历史表）。② 原子取任务：SELECT ... WHERE agent_id=? AND status='pending' AND (expire_at IS NULL OR expire_at>NOW()) ORDER BY FIELD(priority,'urgent','normal','low'), created_at LIMIT 1 FOR UPDATE，取到后立即 UPDATE status='dispatched', dispatched_at=NOW()（防两台机抢同一任务）。Agent 忙（running_tasks 非空）时只下发 stop_groups/stop_group（停止必须可插队），其他类型跳过。响应含 has_task/task/heartbeat_interval/idle_heartbeat_interval/report_interval/config_drift/max_concurrent_tasks=2；无任务时 task=null。

## 验收标准
- 任务必须在响应 data.task 内，has_task 与 task 一致
- 并发心跳不重复下发同一 task_id（FOR UPDATE + 立即 dispatched）
- priority 排序生效：urgent 插到 normal/low 之前
- Agent 忙时非 stop 任务不下发，stop_groups/stop_group 正常下发（插队）
- 心跳后 last_seen 每 10 秒刷新，status 随 running_tasks 切换 online/busy
- 过期任务（expire_at<NOW()）不被下发
