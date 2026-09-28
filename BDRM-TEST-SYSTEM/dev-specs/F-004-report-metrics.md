# 进度指标与事件上报
ID: F-004
优先级: P0
来源: REQ-004
接口: POST /api/bdrm/agent/report

处理 report：遍历 metrics.rounds[] 幂等 upsert 到 bdrm_round（唯一键 uk_round(agent_id, round_id)，INSERT ... ON DUPLICATE KEY UPDATE）；遍历 events[] 按 event_id 幂等插入 bdrm_event（INSERT IGNORE）；更新 bdrm_task 进度快照（progress.percent/stage/eta_min）；将 rounds 与 events 转发 SSE 给前端。响应：accepted=true（限流时 false，Agent 自动降频）、ack_event_ids、next_report_in=15、discard_fence=false（本期恒 false）。日志不上报正文（只含结构化事件），查日志走 fetch_log 任务（Agent 把尾部若干行放在 task/result 回传）。

## 验收标准
- 同一 round_id 重复上报只更新不重复插（uk_round 生效），e2e_pass_rate 取最新值
- 同一 event_id 重复上报不产生第二条事件记录
- report 期间 SSE 实时收到 task_progress/group_state/event 事件
- error 级事件（DEVICE_INSTALL_FAIL/E2E_CASE_FAIL）在前端告警区可见
