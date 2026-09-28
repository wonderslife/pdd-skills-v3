# 任务下发管理
ID: F-009
优先级: P0
来源: REQ-009
接口: POST /bdrm/task/dispatch

后台管理动作插入 bdrm_task：task_id 规则 T-yyyyMMdd-0001；priority='urgent'（页面立即执行）/normal/low；status='pending'；fence=1；params JSON（groups/stagger_sec 及 config 同名键）；expire_at=当前+5 分钟；created_by=操作人。典型入口：启动组 1-6（start_groups，串行 stagger_sec=20 避免抢 IP）、停止单/多组（stop_groups，purge）、连通性测试（ping）。「立即执行」不需要额外推送通道——Agent 心跳周期 10s 决定时延上限 ≤10s。

## 验收标准
- 页面点「立即启动 组1-6」后 ≤10s Agent 取走任务，bdrm_task 状态流转 pending→dispatched→acked→running→success 可查
- 停止指令在压测运行期间下发立即生效（Agent 中止 start 任务）
- 任务列表可按 agent_id/status/priority 筛选，展示 title/params/created_by/时间戳
