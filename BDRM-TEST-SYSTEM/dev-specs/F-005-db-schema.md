# 数据库表设计与种子数据
ID: F-005
优先级: P0
来源: REQ-005

建 5 张表（InnoDB + utf8mb4，DDL 以《Java端对接文档》§4 为准）：bdrm_agent（注册表，uk_agent_id，idx_status/idx_last_seen）、bdrm_task（任务表，uk_task_id，idx_agent_status/idx_status_priority，status 11 态 pending/dispatched/acked/running/success/failed/aborted/partial/rejected/expired/unknown）、bdrm_round（轮次指标，uk_round(agent_id, round_id) 上报幂等关键，idx_task/idx_time/idx_group）、bdrm_event（事件告警，uk_event_id，idx_agent_time/idx_level）、bdrm_config（期望配置唯一真源，uk_agent_key(agent_id, key_name)，agent_id='*' 全局默认，具体机覆盖全局）。可选第 6 张 bdrm_agent_metric（心跳快照历史）。建表后初始化全局配置 5 条：N_PER_GROUP=6 / TIMES=450 / IP_PROVIDER=kdlapi / PURGE_PER_ROUND=1 / NO_RUN_WINDOWS=20:55-07:10。

## 验收标准
- 5 张表唯一键与索引与 DDL 一致，重复插入被数据库拒绝
- bdrm_config 初始化 5 条全局默认（agent_id='*'）
- bdrm_task.fence 落库默认 1（本期不改参重下发，仅预留）
