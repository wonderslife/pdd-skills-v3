# SSE 实时推送
ID: F-008
优先级: P1
来源: REQ-008
接口: GET /api/bdrm/stream

提供 SseService（ConcurrentHashMap 管理 SseEmitter，0L 不超时，onCompletion/onTimeout/onError 清理）与订阅入口 GET /api/bdrm/stream（produces=text/event-stream）。事件类型 9 种：agent_online/agent_offline/task_dispatched/task_progress/task_finished/group_state/event/config_drift/heartbeat（15s 保活防代理断连）。订阅接口走 RuoYi 正常登录鉴权（浏览器原生 EventSource 不支持自定义头，带 cookie 即可），绝不加入 /api/bdrm/agent 的放行白名单。前端 Vue3 new EventSource('/api/bdrm/stream') + addEventListener 按事件类型分发。

## 验收标准
- 未登录用户访问 /api/bdrm/stream 被拒（401），登录用户正常订阅
- register/offline/心跳下发任务/report/result 全链路事件均可实时到达前端
- 客户端断开后 emitter 从 Map 清理，无内存泄漏
