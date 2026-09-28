# 任务受理确认与终态回执
ID: F-003
优先级: P0
来源: REQ-003
接口: POST /api/bdrm/agent/task/ack, POST /api/bdrm/agent/task/result

POST /task/ack：按 accepted 更新 bdrm_task.status='acked'/'rejected'，保存 precheck 明细 JSON 与 reason_code；accepted=false 时推 SSE 告警（level=error）。reason_code 自动决策表：TASK_RUNNING→任务改回 pending 等下次心跳重派；GROUP_BUSY→提示管理员或改派空闲组；PRECHECK_FAIL/DISK_LOW→告警不自动重试；NO_RUN_WINDOW→计算窗口结束时间到点重派；EXPIRED→丢弃；UNSUPPORTED→禁用该任务类型；INTERNAL_ERROR→重试 1 次。

POST /task/result：按 task_id 幂等——重复上报（状态非 dispatched/acked/running）只记日志并返回 duplicate=true，不改状态不重复推 SSE。status 四枚举：success（看 stop_reason：times_reached/no_run_window/budget_exhausted）/ failed（推告警）/ aborted（被主动中止，不算失败不告警）/ partial（部分组成功，高亮失败组）。落 summary/groups_result 到 bdrm_task.summary，更新 bdrm_round 终态，推 SSE task_finished。results 里只含产物路径（artifact_dir/log），不传文件内容。

## 验收标准
- 8 种 reason_code 均有对应处理分支，TASK_RUNNING 场景任务最终回到 pending 且能被重新取走
- 重复 POST /task/result（同 task_id）第二次返回 duplicate=true，bdrm_task 状态与 SSE 均不变
- aborted 状态不触发 error 告警；partial 高亮失败组
- 停止场景闭环：压测期间下发 stop_groups → start 任务变 aborted、stop 任务变 success
