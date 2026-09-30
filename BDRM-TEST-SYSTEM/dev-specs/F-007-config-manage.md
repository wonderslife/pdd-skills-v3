# 配置管理与任务类型透传
ID: F-007
优先级: P1
来源: REQ-007
接口: GET /api/bdrm/agent/config/{agentId}

bdrm_config 表为配置唯一真源（全局 '*' + 单机覆盖）。GET /config/{agentId}：合并该机记录与全局默认（具体机覆盖全局）返回 config 对象，key 必须与本机 config.ini 键名一字不差（大写+下划线），Agent 备份后逐行替换落盘。config_reload 任务随时可下发——Agent 只改盘上 config.ini，不打断正在跑的轮次（新配置下次 start 生效）。config_drift 判定：期望配置拼 k=v\n 取 md5 前 12 位与 Agent 上报 config_version 比对；初期恒返回 false，基本流程跑通后再启用，启用后心跳响应携带并自动下发 config_reload。12 种任务类型原样透传不理解语义：start_groups/start_group/stop_groups/stop_group/config_reload/config_set/preflight/report_generate/fetch_log/restart_appium/upgrade/ping；params 中配置类键名（N_PER_GROUP/TIMES/IP_PROVIDER/PURGE_PER_ROUND/IP_REUSE/IP_REUSE_MIN/ROUND_BUDGET_MIN/PROXY_MAX_RTT/NO_RUN_WINDOWS/NO_RUN_MODE/IP_PROXIES）与 config.ini 完全同名，Java 侧只放值不解释。

## 验收标准
- GET /config/{agentId} 返回的 key 与 config.ini 键名完全一致
- 压测运行中下发 config_reload，在跑轮次不被打断
- 12 种任务类型下发后 Agent 均能受理（capabilities 内的类型）
