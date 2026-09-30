# 前端管理页面
ID: F-010
优先级: P1
来源: REQ-010
接口: GET /bdrm/agent/list, GET /bdrm/task/list, GET /bdrm/round/list, GET /bdrm/event/list

RuoYi-Vue-Plus（plus-ui Vue3 + Element Plus）新增「BDRM 压测调度」菜单组，5 个页面：① Agent 状态页：卡片网格，每 Agent 一卡展示 IP/version/CPU/内存/磁盘/容器数/groups_running 与 groups_idle 徽标/心跳新鲜度（超 30s 红色高亮），SSE 实时增减；② 任务下发页：组 1-6 Checkbox（运行中禁选），参数表单 TIMES/IP_PROVIDER/PURGE_PER_ROUND/IP_REUSE 等（默认取 bdrm_config 全局值），按钮区立即启动/停止/环境体检/重启Appium/测试连接；③ 任务列表页：表格列 task_id/类型/优先级/状态标签/标题/创建人/时间，行点击抽屉展示 precheck 逐项/summary/groups_result/error/reason_code；④ 轮次指标页：bdrm_round 表格 + 图表（每组每轮 duration/identity 通过率/e2e 通过率趋势，全局进度 total_target/rounds_done/ok/failed/void）；⑤ 事件告警页：bdrm_event 按 level/code/时间筛选，error 置顶，detail JSON 展开。

## 验收标准
- 5 个页面挂入 RuoYi 动态菜单（sys_menu 三层 M/C/F 配置），权限标识生效
- Agent 状态页数据随 SSE 实时刷新，无需手动刷新页面
- 任务下发表单校验：groups 至少选 1 组，TIMES 为正整数
- 轮次指标图表数据源为 /bdrm/round 列表接口（分页+按组筛选）
