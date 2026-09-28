# Agent 注册与鉴权
ID: F-001
优先级: P0
来源: REQ-001
接口: POST /api/bdrm/agent/register

py Agent 启动后报备上线。校验请求头 X-Agent-Key（共享密钥，配置于 application.yml），错误返回 code=403。按 agent_id 幂等 upsert bdrm_agent：不存在插入 status='online'，存在则更新 hostname/ip/version/cpu/mem_mb/config_version/last_seen（重复注册绝不新增记录）；同 agent_id 不同 IP 返回 409 提示人工确认。签发 JWT agent_token（subject=agentId，24h 有效期）写入响应；返回 heartbeat_interval=10 / idle_heartbeat_interval=30 / report_interval=15 / log_tail_lines=200 / server_time（yyyy-MM-dd HH:mm:ss 字符串）；推 SSE agent_online。其余接口校验 X-Agent-Token，失效返回 code=401（Agent 自动重新 register 不中断在跑轮次）。6+1 个 /api/bdrm/agent/** 接口加入 Sa-Token 放行白名单（excludePathPatterns）。

## 验收标准
- X-Agent-Key 错误时返回 code=403 msg=共享密钥错误
- 同一 agent_id 重复 register 不产生第二条记录且 status 置回 online
- 同 agent_id 不同 IP 返回 409 并提示人工确认
- 响应必含 agent_token/heartbeat_interval/server_time，时间格式 yyyy-MM-dd HH:mm:ss
- /api/bdrm/agent/** 无登录态可访问（白名单生效），X-Agent-Token 错误返回 code=401
