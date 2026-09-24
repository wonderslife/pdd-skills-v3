# YUQING-System-Project 开发规格
版本: v1.0.0

## 监测任务管理 |task
#### 功能描述
监测任务是自动化作业的配置基座，把"抓什么、多久抓一次、怎么判、推给谁、出什么报"五类规则打包为一个可启停的任务单元。支持常态化任务（后台统一配置、长期生效）与临时/专项任务（企业微信端随时发布）。任务变更即时生效，无需重启服务。

#### 验收标准
- 验收标准 1: When 用户提交任务表单, the system shall 校验任务名称、任务类型、至少 1 个关键词组、至少 1 个采集渠道为必填, 缺失时前端定位到出错字段并拦截提交
- 验收标准 2: The system shall 保证任务名称全局唯一, 重复时提示"该任务名称已存在"且不落库
- 验收标准 3: When 舆情主管在 PC 端创建任务, the system shall 支持选择任务类型为 `normal`（常态化）/`temporary`（临时）/`special`（专项）
- 验收标准 4: When 用户在企业微信端发布任务, the system shall 自动把任务来源标记为 `wecom`, PC 端任务列表可查且状态与移动端实时同步
- 验收标准 5: When 任务被停用（状态置为 `paused`）, the system shall 立即停止其采集调度, 但已采集数据、研判结论、推送与报告记录全部保留可查
- 验收标准 6: When 临时/专项任务到达配置的结束时间, the system shall 自动置为 `archived` 并保留历史数据
- 验收标准 7: The system shall 记录任务的创建人、创建时间、最后修改人与修改时间, 并在任务详情页展示变更留痕
- 验收标准 8: If 任务配置引用的关键词组或渠道已被删除, then the system shall 在任务详情页高亮提示失效引用, 并阻止任务被启用
- 验收标准 9: When 任务的关键词、渠道或频率被修改, the system shall 在下一次调度周期即按新规则执行, 不要求重启服务
- 验收标准 10: The system shall 对任务的增删改与启停操作写入操作日志, 记录操作人、时间与变更前后状态

#### 接口定义
| 方法 | 路径 | 权限标识 | 说明 |
|------|------|---------|------|
| GET | /yuqing/task/list | yuqing:task:list | 任务列表（分页+筛选） |
| GET | /yuqing/task/{taskId} | yuqing:task:query | 任务详情 |
| POST | /yuqing/task | yuqing:task:add | 新增任务 |
| PUT | /yuqing/task | yuqing:task:edit | 修改任务 |
| PUT | /yuqing/task/{taskId}/status | yuqing:task:edit | 启停任务 |
| DELETE | /yuqing/task/{taskIds} | yuqing:task:remove | 批量软删任务 |
| GET | /yuqing/task/optionselect | yuqing:task:list | 任务下拉选项 |

## 关键词库管理 |keyword
#### 功能描述
关键词库是"抓什么"的语义入口，决定采集与过滤的边界。支持精准关键词（完全匹配）、模糊关键词（包含匹配）、否定关键词（命中即排除）、组合关键词（布尔表达式），并按核心监测词、关联监测词、屏蔽词三类归档。支持单条录入与批量文本/Excel 导入。

#### 验收标准
- 验收标准 1: The system shall 支持 `precise`（精准）/`fuzzy`（模糊）/`negative`（否定）/`combo`（组合）四种关键词类型并存
- 验收标准 2: The system shall 按 `core`（核心监测词）/`related`（关联监测词）/`block`（屏蔽词）三类归档关键词, 且同一分类下关键词文本唯一
- 验收标准 3: When 用户选择关键词类型为 `combo`, the system shall 要求填写布尔表达式并提供语法校验, 表达式非法时给出具体错误位置
- 验收标准 4: When 用户批量导入关键词, the system shall 支持粘贴文本（一行一词）与上传 Excel 两种方式, 并逐行返回成功/重复/非法明细
- 验收标准 5: If 导入的批量数据超过 2000 行, then the system shall 提示分批导入且不执行入库
- 验收标准 6: When 用户停用某关键词, the system shall 使该词在下一次采集调度中不再生效, 但不删除历史关联数据
- 验收标准 7: The system shall 在关键词列表展示每个关键词被引用（被任务、预警规则、降噪规则引用）的次数, 支持按引用次数排序
- 验收标准 8: If 关键词已被任务引用, then the system shall 允许停用但禁止物理删除, 并提示引用该词的任务数量
- 验收标准 9: The system shall 对关键词的增删改与批量导入写入操作日志

#### 接口定义
| 方法 | 路径 | 权限标识 | 说明 |
|------|------|---------|------|
| GET | /yuqing/keyword/list | yuqing:keyword:list | 关键词列表 |
| GET | /yuqing/keyword/{keywordId} | yuqing:keyword:query | 关键词详情 |
| POST | /yuqing/keyword | yuqing:keyword:add | 新增关键词 |
| PUT | /yuqing/keyword | yuqing:keyword:edit | 修改关键词 |
| DELETE | /yuqing/keyword/{keywordIds} | yuqing:keyword:remove | 批量软删关键词 |
| GET | /yuqing/keyword/importTemplate | - | 下载关键词导入模板 |
| POST | /yuqing/keyword/importData | yuqing:keyword:import | 批量导入关键词（返回逐行结果） |
| GET | /yuqing/keywordGroup/list | yuqing:keyword:list | 关键词分组列表 |
| POST | /yuqing/keywordGroup | yuqing:keyword:add | 新增分组 |
| PUT | /yuqing/keywordGroup | yuqing:keyword:edit | 修改分组 |
| DELETE | /yuqing/keywordGroup/{groupIds} | yuqing:keyword:remove | 删除分组 |
| GET | /yuqing/keywordGroup/optionselect | yuqing:keyword:list | 分组下拉选项 |

## 采集渠道管理 |channel
#### 功能描述
维护全网采集渠道字典，覆盖社交平台、新闻媒体、论坛贴吧、短视频平台、问答社区、博客专栏、数字报等类别。渠道可绑定采集器、设置渠道级开关与频率覆盖、配置反爬参数（请求间隔、代理池分组、并发上限），供监测任务按渠道勾选。

#### 验收标准
- 验收标准 1: The system shall 内置渠道类别字典, 覆盖 `social`/`news`/`forum`/`video`/`qa`/`blog`/`epaper` 七类, 且支持新增自定义类别
- 验收标准 2: The system shall 支持渠道名称唯一性校验, 并按类别、状态筛选渠道列表
- 验收标准 3: When 渠道被停用, the system shall 使其不再被新建任务勾选, 已有任务中的该渠道高亮提示失效
- 验收标准 4: When 用户为渠道设置频率覆盖值, the system shall 对引用该渠道的所有任务生效, 优先级高于任务级频率
- 验收标准 5: The system shall 支持配置请求间隔（毫秒）、并发上限、代理池分组、User-Agent 池标识, 并校验取值区间合法
- 验收标准 6: The system shall 记录渠道最近一次采集时间、近 24 小时采集条数、近 24 小时失败率并展示在渠道列表
- 验收标准 7: If 某渠道近 24 小时失败率超过配置阈值, then the system shall 在渠道列表标红并在运行监控页生成一条异常提醒
- 验收标准 8: The system shall 对渠道的增删改与启停写入操作日志

#### 接口定义
| 方法 | 路径 | 权限标识 | 说明 |
|------|------|---------|------|
| GET | /yuqing/channel/list | yuqing:channel:list | 渠道列表 |
| GET | /yuqing/channel/{channelId} | yuqing:channel:query | 渠道详情 |
| POST | /yuqing/channel | yuqing:channel:add | 新增渠道 |
| PUT | /yuqing/channel | yuqing:channel:edit | 修改渠道 |
| DELETE | /yuqing/channel/{channelIds} | yuqing:channel:remove | 批量软删渠道 |
| GET | /yuqing/channel/optionselect | yuqing:channel:list | 渠道下拉选项 |
| GET | /yuqing/channel/health | yuqing:channel:list | 渠道健康度（采集量/失败率） |
| GET | /yuqing/channel/collectorOptionselect | yuqing:channel:query | 采集器下拉选项 |

## 全网自动采集与调度 |collect
#### 功能描述
系统按任务预设规则启动 7×24 无人值守采集，全程无需人工启动、监控、整理。支持定时轮询、增量抓取、实时监听三种策略并行；采用多模态模型与智能体混合的拟人化操作方式提升覆盖与存活率；配置反爬策略、IP 轮换与请求限流。原始数据完整落库，保留溯源依据。

#### 验收标准
- 验收标准 1: The system shall 支持 `polling`（定时轮询）/`incremental`（增量抓取）/`realtime`（实时监听）三种采集策略, 可按渠道分别配置
- 验收标准 2: The system shall 支持采集频率按秒级、分钟级、小时级、日级四档配置, 并校验最小间隔不低于渠道限流下限
- 验收标准 3: The system shall 对每条舆情采集以下字段：标题、原文内容、发布链接、发布时间、发布作者、点赞量、评论量、转发量、阅读量、发布地域、设备信息、话题标签
- 验收标准 4: The system shall 将原始采集数据完整入库, 不做有损截断, 并保留采集批次与采集时间用于溯源
- 验收标准 5: When 采集请求返回失败, the system shall 按退避策略自动重试, 重试次数可配置, 超过上限则记录失败明细并继续后续任务, 不阻塞整体调度
- 验收标准 6: The system shall 在采集链路启用 IP 轮换与请求限流, 单渠道并发不超过配置上限
- 验收标准 7: When 采集到的新舆情链接已存在于库中, the system shall 直接判定重复并剔除, 不重复入库、不重复进入研判
- 验收标准 8: The system shall 提供采集运行概览：累计采集条数、当日采集条数、去重剔除条数、失败条数、各任务最近执行时间
- 验收标准 9: If 某任务连续 N 次调度零采集或全部失败, then the system shall 在运行监控页生成告警并向企业微信推送异常提醒
- 验收标准 10: The system shall 逐条记录采集日志（任务、渠道、批次、结果、耗时、失败原因）, 支持按任务与时间范围筛选

#### 接口定义
| 方法 | 路径 | 说明 |
|------|------|------|
<!-- 待补充: 该功能点相关接口 -->

## 手动链接导入 |link-import
#### 功能描述
针对系统未覆盖的小众平台、专项舆情链接与人工发现的重点舆情，提供专属链接导入通道。支持单条链接手动输入与 Excel 批量导入两种方式；导入后系统自动发起定向解析，抓取该链接的完整内容、互动数据与发布信息，纳入原始舆情库与自动化采集数据同源管理，后续统一进入净化与研判流程。

#### 验收标准
- 验收标准 1: The system shall 支持单条链接输入导入, 并在提交前校验链接格式合法性
- 验收标准 2: The system shall 支持上传 Excel 批量导入链接, 并提供标准模板下载
- 验收标准 3: When 用户导入链接, the system shall 逐条校验有效性并区分返回：解析成功、链接无效、死链、重复链接四类结果
- 验收标准 4: If 导入链接已存在于舆情库, then the system shall 判定为重复并跳过, 提示导入人该链接的既有舆情标题与采集时间
- 验收标准 5: When 链接解析成功, the system shall 抓取完整正文、互动数据与发布信息并落库, 字段口径与自动采集一致
- 验收标准 6: The system shall 把导入来源标记为 `manual_import`, 在台账中与自动采集数据可区分展示
- 验收标准 7: If 导入数据超过 500 条, then the system shall 提示分批导入且不执行入库
- 验收标准 8: When 批量导入完成, the system shall 返回成功条数、失败条数, 并提供失败明细下载（含行号与失败原因）
- 验收标准 9: The system shall 将链接导入操作写入操作日志, 记录导入人、时间、条数与来源（PC 端 / 企业微信端）
- 验收标准 10: When 用户在企业微信端补充事件信息, the system shall 支持以"链接 + 备注"形式提交并纳入同源管理

#### 接口定义
| 方法 | 路径 | 权限标识 | 说明 |
|------|------|---------|------|
| POST | /yuqing/opinion/import | yuqing:opinion:import | 单条/批量链接导入 |
| GET | /yuqing/opinion/importTemplate | - | 下载链接导入模板 |

## 数据净化与链接去重 |dedup
#### 功能描述
对采集与导入的原始数据做标准化清洗、降噪去重，剔除无效冗余内容，统一数据格式，为研判与分析提供高质量输入。核心规则：以舆情原文链接为唯一重复判定标准，摒弃传统文本相似度去重，从而精准识别同源转发、转载、二次分发。

#### 验收标准
- 验收标准 1: The system shall 内置降噪规则引擎, 默认过滤垃圾内容、广告营销、重复灌水评论、无意义短句、机器人发布内容、空白内容、违规屏蔽内容七类低价值数据
- 验收标准 2: The system shall 支持自定义降噪关键词与内容规则（正则）, 业务端可动态启停与调整优先级
- 验收标准 3: When 一条舆情被判定为降噪剔除, the system shall 记录剔除原因, 支持在台账中按原因统计剔除量, 且该数据不进入研判流程
- 验收标准 4: The system shall 以原文链接为唯一去重主键, 若链接已存在则判定为重复并剔除, 不进入后续业务流程
- 验收标准 5: The system shall 维护舆情清洗状态, 取值 `raw`（原始）/`cleaned`（已净化）/`rejected`（已剔除）, 并支持按状态筛选台账
- 验收标准 6: When 净化完成, the system shall 保留有效舆情主体内容与完整溯源字段, 不得因清洗丢失发布时间、来源与原文链接
- 验收标准 7: The system shall 在统计看板展示去重率与降噪剔除率, 支持按任务、渠道、时间范围下钻
- 验收标准 8: If 同一链接被不同渠道重复采集, then the system shall 只保留首条有效记录并在其来源渠道字段补充其他渠道标识
- 验收标准 9: The system shall 支持对历史数据按新降噪规则批量重跑净化, 并提供影响条数预览与执行结果记录

#### 接口定义
| 方法 | 路径 | 权限标识 | 说明 |
|------|------|---------|------|
| GET | /yuqing/noiseRule/list | yuqing:noiseRule:list | 降噪规则列表 |
| POST | /yuqing/noiseRule | yuqing:noiseRule:add | 新增降噪规则 |
| PUT | /yuqing/noiseRule | yuqing:noiseRule:edit | 修改降噪规则 |
| DELETE | /yuqing/noiseRule/{ruleIds} | yuqing:noiseRule:remove | 删除降噪规则 |
| POST | /yuqing/clean/replayClean | yuqing:clean:replay | 历史数据重跑净化 |

## 智能研判（研判数字员工） |analysis
#### 功能描述
基于大语言模型对净化后的有效舆情做全维度智能研判，替代传统规则化判定。研判维度包含舆情主题识别、核心内容提炼、情感倾向判定、风险属性判定；通过语义理解、上下文关联与场景化分析识别隐性舆情、变体表述舆情与复杂场景舆情，输出标准化研判结果并结构化存储。同时对相似舆情做聚合汇总，梳理传播脉络。

#### 验收标准
- 验收标准 1: When 舆情进入研判环节, the system shall 自动输出主题识别、核心内容提炼、情感倾向、风险属性四类结构化结果
- 验收标准 2: The system shall 将研判结论结构化落库, 字段包含主题、摘要、情感倾向、风险属性、风险等级、标签集合、置信度、模型版本与研判时间
- 验收标准 3: The system shall 支持识别隐性舆情与变体表述（如谐音、别字、缩写、英文替换）, 并在研判详情中标注命中依据
- 验收标准 4: The system shall 对相似舆情自动聚合为舆情事件并生成聚合编号, 在聚合详情中按时间轴展示传播脉络
- 验收标准 5: The system shall 维护研判状态 `pending`/`processing`/`completed`/`failed`, 台账可按状态筛选
- 验收标准 6: If 大模型调用失败或返回格式不合法, then the system shall 将研判状态置为 `failed`、记录失败原因、按退避策略重试, 且不阻塞其他舆情研判
- 验收标准 7: When 研判完成, the system shall 自动为舆情打上标签并展示单条舆情研判结论, 结论含舆情内容、来源、热度、风险等级、研判分析与处置建议
- 验收标准 8: The system shall 支持研判员人工修正研判结论（情感倾向、风险等级、标签）, 修正记录留痕并标记修正人
- 验收标准 9: When 研判员修正了模型结论, the system shall 自动把该条修正后的数据登记为待标注训练样本
- 验收标准 10: The system shall 在批量研判完成后生成批量舆情汇总台账, 并支持按事件聚合维度查看
- 验收标准 11: The system shall 记录每次研判的模型版本与提示词版本, 以便结论可追溯、效果可比对

#### 接口定义
| 方法 | 路径 | 权限标识 | 说明 |
|------|------|---------|------|
| POST | /yuqing/opinion/analyze | yuqing:opinion:analyze | 批量重新研判 |
| PUT | /yuqing/opinion/analysis/correct | yuqing:opinion:correct | 人工修正研判结论 |
| GET | /yuqing/cluster/list | yuqing:cluster:list | 事件聚合列表 |
| GET | /yuqing/cluster/{clusterId} | yuqing:cluster:query | 事件聚合详情（含传播脉络） |
| GET | /yuqing/analyze/stats | yuqing:analyze:list | 研判执行统计（成功率/失败数） |

## 研判规则与分级体系 |level-rule
#### 功能描述
后台预设并管理研判标准，为数字员工提供标准化判定依据。可自定义舆情分级（一般、关注、预警、紧急）、舆情属性（正面、中性、负面）、传播量级、风险等级与舆情标签体系；负面舆情进一步细化为一般、较重、严重三级风险，匹配不同预警与处置策略。

#### 验收标准
- 验收标准 1: The system shall 内置舆情分级字典 `normal`（一般）/`attention`（关注）/`warning`（预警）/`urgent`（紧急）, 且支持调整各级的判定条件
- 验收标准 2: The system shall 内置舆情属性字典 `positive`（正面）/`neutral`（中性）/`negative`（负面）, 且属性判定口径可在提示词中配置
- 验收标准 3: The system shall 支持负面风险等级 `general`（一般）/`moderate`（较重）/`severe`（严重）三级, 且三级可分别绑定不同的预警与推送策略
- 验收标准 4: The system shall 支持传播量级 `low`/`medium`/`high`/`viral` 四档, 判定依据可在配置中定义（阅读量、转发量、评论量阈值）
- 验收标准 5: The system shall 支持自定义舆情标签, 标签名称唯一, 支持父子层级与启停
- 验收标准 6: When 用户修改分级或标签规则, the system shall 在规则详情页展示影响范围（涉及多少任务）并要求二次确认后才生效
- 验收标准 7: The system shall 支持规则配置的版本留痕, 可查看每次修改的前后值与操作人
- 验收标准 8: If 分级规则的取值区间存在重叠或空缺, then the system shall 在保存时校验并提示冲突项
- 验收标准 9: The system shall 支持用当前规则对指定历史舆情重新研判, 并提供影响条数预览

#### 接口定义
| 方法 | 路径 | 权限标识 | 说明 |
|------|------|---------|------|
| GET | /yuqing/tag/list | yuqing:tag:list | 标签列表（树形） |
| POST | /yuqing/tag | yuqing:tag:add | 新增标签 |
| PUT | /yuqing/tag | yuqing:tag:edit | 修改标签 |
| DELETE | /yuqing/tag/{tagIds} | yuqing:tag:remove | 删除标签 |
| GET | /yuqing/tag/optionselect | yuqing:tag:list | 标签下拉选项 |
| GET | /yuqing/levelRule/list | yuqing:levelRule:list | 分级规则列表 |
| GET | /yuqing/levelRule/{ruleId} | yuqing:levelRule:query | 分级规则详情 |
| POST | /yuqing/levelRule | yuqing:levelRule:add | 新增分级规则 |
| PUT | /yuqing/levelRule | yuqing:levelRule:edit | 修改分级规则 |
| DELETE | /yuqing/levelRule/{ruleIds} | yuqing:levelRule:remove | 删除分级规则 |
| GET | /yuqing/levelRule/optionselect | yuqing:levelRule:list | 分级规则下拉选项 |

## 舆情多维分析 |analytics
#### 功能描述
基于大模型研判结果完成周期内的数据汇总统计与多维分析，形成标准化分析结论，为预警、推送与报告输出提供数据支撑。核心分析维度包含舆情总量、正负面占比、各平台分布、热点舆情 TOP 排行、传播趋势、互动数据统计、地域分布与话题聚类，并自动提炼核心舆情事件、传播路径、舆论焦点与潜在风险点。

#### 验收标准
- 验收标准 1: The system shall 在同一看板展示舆情总量、正负面占比、各平台分布、热点 TOP 排行、传播趋势、互动数据统计、地域分布七类指标
- 验收标准 2: The system shall 支持按时间范围、任务、渠道、舆情属性、风险等级多维筛选, 所有指标随筛选条件联动刷新
- 验收标准 3: The system shall 输出热点舆情 TOP 排行, 支持按阅读量、转发量、评论量或综合热度排序
- 验收标准 4: The system shall 输出传播趋势曲线, 支持按小时/日/周粒度切换
- 验收标准 5: The system shall 自动提炼核心舆情事件、传播路径、舆论焦点与潜在风险点, 形成结构化分析结论
- 验收标准 6: When 用户点击任一统计数值, the system shall 下钻到对应的舆情台账明细列表
- 验收标准 7: The system shall 支持把当前分析结果一键带入报告生成流程, 作为报告的"数据分析"章节来源
- 验收标准 8: The system shall 由定时任务预聚合周期统计数据, 保证看板查询响应不随数据量增长而显著变慢
- 验收标准 9: If 预聚合任务执行失败, then the system shall 不影响舆情主流程, 看板展示最近一次成功聚合的结果并标注数据截止时间
- 验收标准 10: The system shall 支持看板数据导出为 Excel

#### 接口定义
| 方法 | 路径 | 权限标识 | 说明 |
|------|------|---------|------|
| GET | /yuqing/dashboard/overview | yuqing:dashboard:list | 看板总览（七类指标） |
| GET | /yuqing/dashboard/trend | yuqing:dashboard:list | 传播趋势（按小时/日/周） |
| GET | /yuqing/dashboard/topRank | yuqing:dashboard:list | 热点 TOP 排行 |
| GET | /yuqing/dashboard/regionDist | yuqing:dashboard:list | 地域分布 |
| POST | /yuqing/dashboard/export | yuqing:dashboard:export | 看板数据导出 |

## 风险预警 |alert
#### 功能描述
基于舆情分级结果与自定义预警规则实现风险舆情自动预警。支持自定义预警阈值、预警场景与预警级别；针对负面舆情、高风险舆情、突发增量舆情与重点专项舆情自动触发预警，标记预警状态、生成预警标签、记录触发时间并联动企业微信推送。普通中性、正面舆情仅常规记录留存。

#### 验收标准
- 验收标准 1: The system shall 支持预警场景 `new_negative`（新增负面）/`high_risk`（高风险）/`burst_increment`（突发增量）/`special_topic`（重点专项）四类
- 验收标准 2: The system shall 支持自定义预警阈值, 包含时间窗口内同类舆情条数阈值、传播量级阈值与风险等级阈值
- 验收标准 3: When 舆情达到预警标准, the system shall 自动置预警状态、生成预警标签并记录预警触发时间
- 验收标准 4: The system shall 支持预警级别配置, 并与推送策略绑定（如 `severe` 走即时推送、`general` 走定时批量）
- 验收标准 5: The system shall 维护预警处置状态 `pending`（未处置）/`processing`（处置中）/`handled`（已处置）/`ignored`（已忽略）, 支持按状态筛选
- 验收标准 6: When 用户标记已处置, the system shall 强制要求填写处置说明, 未填写时拒绝提交
- 验收标准 7: If 同一事件在预警后持续发酵, then the system shall 支持关联多次预警到同一舆情事件聚合编号, 避免重复预警刷屏
- 验收标准 8: The system shall 对未处置预警在台账与应用内列表做醒目提示（红标 + 未处置计数）
- 验收标准 9: The system shall 预留短信、电话等通道的触发接口与字段, 本期不实际开通
- 验收标准 10: The system shall 记录每条预警的触发规则、触发值、触发时间与推送结果, 支持按时间与级别统计

#### 接口定义
| 方法 | 路径 | 权限标识 | 说明 |
|------|------|---------|------|
| GET | /yuqing/alertRule/list | yuqing:alert:list | 预警规则列表 |
| POST | /yuqing/alertRule | yuqing:alert:add | 新增预警规则 |
| PUT | /yuqing/alertRule | yuqing:alert:edit | 修改预警规则 |
| DELETE | /yuqing/alertRule/{ruleIds} | yuqing:alert:remove | 删除预警规则 |
| GET | /yuqing/alertRule/optionselect | yuqing:alert:list | 预警规则下拉选项 |
| GET | /yuqing/alert/list | yuqing:alert:list | 预警记录列表 |
| GET | /yuqing/alert/{alertId} | yuqing:alert:query | 预警详情 |
| PUT | /yuqing/alert/{alertId}/process | yuqing:alert:process | 标记处置 + 处置说明 |
| GET | /yuqing/alert/unhandledCount | - | 未处置预警数（首页红标/弹窗） |
| POST | /yuqing/alert/export | yuqing:alert:export | 导出预警记录 |

## 企业微信推送（推送数字员工） |push
#### 功能描述
推送数字员工专职承接研判结果的主动触达，全程无需人工导出转发。通过企业微信自建应用消息通道，把研判结果与预警信息按配置对象与场景分级推送至指定人员，采用统一标准化模板，支持高风险即时提醒、常规定时批量推送。所有推送记录自动留存，可追溯、可统计。

#### 验收标准
- 验收标准 1: The system shall 支持按角色、部门、指定人员配置推送对象, 并支持免打扰时段设置
- 验收标准 2: The system shall 支持推送场景 `new_opinion`（新增舆情）/`high_risk`（高风险舆情）/`batch_completed`（批量研判完成）/`report_ready`（报告生成完成）四类
- 验收标准 3: The system shall 支持推送级别 `immediate`（即时）与 `scheduled`（定时批量）, 并支持配置定时批量的推送频次
- 验收标准 4: When 触发即时推送, the system shall 在舆情研判完成后 120 秒内发送企业微信应用消息
- 验收标准 5: The system shall 采用统一标准化推送模板, 固定包含舆情标题、舆情等级、发布平台、发布时间、舆情核心内容、风险分析、传播态势、舆情原文链接、处置建议、推送时间
- 验收标准 6: The system shall 支持摘要式推送模板, 包含采集概况统计（采集内容总数、负面信息数、中性信息数、去重后记录数）与负面信息明细（序号、标题、来源、时间、链接、内容、风险等级）
- 验收标准 7: The system shall 自动把长正文截断为摘要并保留原文链接, 单条消息长度不超过企业微信应用消息上限
- 验收标准 8: If 推送发送失败, then the system shall 自动重试并在超过上限后记录失败原因, 在推送记录中标红
- 验收标准 9: The system shall 完整留存推送记录（推送对象、场景、模板、内容快照、发送时间、发送结果）, 支持按时间与对象统计推送量与成功率
- 验收标准 10: When 报告生成完成, the system shall 把报告以文件形式推送到企业微信, 并提供 H5 查看入口
- 验收标准 11: The system shall 支持推送开关按对象独立管控, 关闭后该对象不再收到对应场景的推送

#### 接口定义
| 方法 | 路径 | 权限标识 | 说明 |
|------|------|---------|------|
| GET | /yuqing/pushRule/list | yuqing:push:list | 推送规则列表 |
| POST | /yuqing/pushRule | yuqing:push:add | 新增推送规则 |
| PUT | /yuqing/pushRule | yuqing:push:edit | 修改推送规则 |
| DELETE | /yuqing/pushRule/{ruleIds} | yuqing:push:remove | 删除推送规则 |
| GET | /yuqing/pushRule/optionselect | yuqing:push:list | 推送规则下拉选项 |
| GET | /yuqing/pushTemplate/list | yuqing:push:list | 推送模板列表 |
| POST | /yuqing/pushTemplate | yuqing:push:add | 新增推送模板 |
| PUT | /yuqing/pushTemplate | yuqing:push:edit | 修改推送模板 |
| PUT | /yuqing/pushTemplate/{templateId}/preview | yuqing:push:list | 模板预览（示例数据渲染） |
| GET | /yuqing/pushRecord/list | yuqing:push:list | 推送记录列表 |
| GET | /yuqing/pushRecord/{recordId} | yuqing:push:query | 推送记录详情（含内容快照） |
| POST | /yuqing/pushRecord/{recordId}/retry | yuqing:push:retry | 手工重试失败推送 |
| POST | /yuqing/push/test | yuqing:push:retry | 推送连通性测试 |

## 企业微信端任务管控（H5） |h5-console
#### 功能描述
企业微信自建应用内嵌 H5 承载移动端任务管控，与 PC 后台双向连通、数据实时互通、操作双向生效。管理人员可在移动端独立发布常态化/临时专项采集任务、补充事件舆情信息、管控推送预警、触发智能研判、一键生成报告并线上提交，适配突发舆情处置、外勤值守、远程监管等场景。

#### 验收标准
- 验收标准 1: When 用户从企业微信工作台进入应用, the system shall 通过企业微信网页授权完成免登并绑定若依账号, 无需重复输入账号密码
- 验收标准 2: The system shall 在 H5 首页展示待处置预警数、当日采集概况、最近研判结论与待办报告入口
- 验收标准 3: When 用户在企业微信端发布临时/专项采集任务, the system shall 支持配置任务名称、关键词组、渠道范围、结束时间, 并在提交后立即同步到 PC 端任务列表
- 验收标准 4: When 用户在企业微信端补充事件信息, the system shall 支持提交链接与备注, 并纳入舆情库同源管理
- 验收标准 5: When 用户在企业微信端调整推送权限、推送频次或预警阈值, the system shall 实时生效并在 PC 端配置页同步展示最新值
- 验收标准 6: When 用户在企业微信端下达自然语言指令, the system shall 解析为任务调取指令并回推响应结果, 同时记录指令日志
- 验收标准 7: When 用户在企业微信端触发报告生成, the system shall 按所选模板生成报告并支持在线预览与线上提交
- 验收标准 8: When 用户在移动端提交表单, the system shall 执行与 PC 端相同的必填与合法性校验, 校验失败时给出字段级提示
- 验收标准 9: The system shall 保证移动端与 PC 端台账数据实时同步, 移动端可查看预警详情、研判结论与报告历史
- 验收标准 10: If 用户在企业微信端发起超出其权限范围的操作, then the system shall 拒绝并提示无访问权限, 不依赖前端隐藏按钮
- 验收标准 11: When 网络异常导致提交失败, the system shall 明确提示失败原因且不丢失已填写内容
- 验收标准 12: The system shall 对移动端的关键操作（建任务、改推送规则、触发报告、提交报告）写入操作日志

#### 接口定义
| 方法 | 路径 | 权限标识 | 说明 |
|------|------|---------|------|
| GET | /yuqing/wecom/auth/url | - | 获取企业微信网页授权地址 |
| GET | /yuqing/wecom/auth/callback | - | 网页授权回调（换 code 免登） |
| GET | /yuqing/wecom/command/list | yuqing:wecom:list | 指令日志列表 |
| POST | /yuqing/wecom/command | - | 提交自然语言指令（H5） |
| GET | /yuqing/wecom/bindStatus | - | 当前企业微信成员绑定状态 |
| GET | /yuqing/mobile/workbench | - | H5 工作台首页数据 |
| GET | /yuqing/mobile/opinion/list | - | H5 台账查阅 |
| GET | /yuqing/mobile/report/list | - | H5 报告列表 |

## 报告模板管理 |report-template
#### 功能描述
维护报告模板，定义各类报告（实时快报、日报、月报、专项分析报告）的固定结构、章节模块与排版格式，支持预设多套模板以应对不同客户或不同报送口径需求。模板由报告数字员工在生成环节调用。

#### 验收标准
- 验收标准 1: The system shall 支持报告类型 `flash`（快报）/`daily`（日报）/`monthly`（月报）/`special`（专项）四类模板
- 验收标准 2: The system shall 支持配置报告的章节模块与排列顺序, 章节可从预置模块库中勾选并支持自定义标题
- 验收标准 3: The system shall 支持配置排版格式（字体、字号、标题编号规则、页眉页脚、封面字段）
- 验收标准 4: The system shall 支持同一报告类型下存在多套模板并指定默认模板, 且同类型默认模板唯一
- 验收标准 5: The system shall 支持模板名称唯一性校验与模板启停
- 验收标准 6: When 报告基于某模板生成, the system shall 把模板结构完整应用为报告正文, 且后续修改模板不影响已生成的历史报告
- 验收标准 7: The system shall 支持模板复制（以现有模板为基线派生新模板）
- 验收标准 8: If 模板被引用为某任务的默认模板, then the system shall 允许停用但禁止物理删除, 并提示引用任务数量
- 验收标准 9: The system shall 提供模板预览能力, 用示例数据渲染一版样张供确认

#### 接口定义
| 方法 | 路径 | 权限标识 | 说明 |
|------|------|---------|------|
| GET | /yuqing/reportTemplate/list | yuqing:reportTemplate:list | 报告模板列表 |
| GET | /yuqing/reportTemplate/{templateId} | yuqing:reportTemplate:query | 报告模板详情（含章节） |
| POST | /yuqing/reportTemplate | yuqing:reportTemplate:add | 新增报告模板 |
| PUT | /yuqing/reportTemplate | yuqing:reportTemplate:edit | 修改报告模板 |
| DELETE | /yuqing/reportTemplate/{templateIds} | yuqing:reportTemplate:remove | 删除报告模板 |
| POST | /yuqing/reportTemplate/{templateId}/copy | yuqing:reportTemplate:add | 复制模板 |
| GET | /yuqing/reportTemplate/optionselect | yuqing:reportTemplate:list | 报告模板下拉选项 |
| GET | /yuqing/reportSection/optionselect | yuqing:reportTemplate:list | 报告章节下拉选项 |

## 舆情日报生成 |daily-report
#### 功能描述
每日固定时间自动生成舆情日报，汇总当日全量舆情数据。日报内容包含当日舆情总量、正负面分布、热点舆情事件、新增预警舆情、重点舆情详情、传播趋势与当日舆情小结；支持人工调整纳入日报的舆情链接（增删），支持预设多模板，导出 PDF 与 Word 并推送至企业微信。

#### 验收标准
- 验收标准 1: When 到达配置的日报生成时间, the system shall 自动归集当日全量舆情数据并生成日报, 无需人工触发
- 验收标准 2: The system shall 生成日报正文包含当日舆情总量、正负面分布、热点舆情事件、新增预警舆情、重点舆情详情、传播趋势、当日舆情小结
- 验收标准 3: The system shall 支持报送员在日报详情页手工增删纳入报告的舆情条目, 并记录增删操作人与时间
- 验收标准 4: The system shall 支持按报告模板渲染日报, 生成后自动完成格式统一与图文排版
- 验收标准 5: The system shall 支持把日报导出为 PDF 与 Word 两种格式
- 验收标准 6: When 日报生成完成, the system shall 按推送规则把日报文件推送至企业微信, 并提供 H5 在线查看入口
- 验收标准 7: The system shall 支持报送员手工触发日报重新生成, 重新生成覆盖当前草稿并保留版本记录
- 验收标准 8: The system shall 维护日报状态 `generating`/`generated`/`published`/`failed`, 台账可按日期与状态查询历史日报
- 验收标准 9: If 日报生成失败, then the system shall 记录失败原因并向管理员推送异常提醒, 支持一键重试
- 验收标准 10: The system shall 支持配置多套日报模板并在生成时选择
- 验收标准 11: When 报送员完成线上提交, the system shall 记录提交人、提交时间与提报对象, 并写入操作日志

#### 接口定义
| 方法 | 路径 | 权限标识 | 说明 |
|------|------|---------|------|
| GET | /yuqing/report/list | yuqing:report:list | 报告台账（按类型/日期/状态） |
| GET | /yuqing/report/{reportId} | yuqing:report:query | 报告详情（含正文） |
| POST | /yuqing/report/generate | yuqing:report:generate | 手工生成报告（日报/月报/快报/专项） |
| PUT | /yuqing/report/{reportId}/opinions | yuqing:report:edit | 增删报告纳入的舆情条目 |
| POST | /yuqing/report/{reportId}/regenerate | yuqing:report:generate | 重新生成（保留版本） |
| GET | /yuqing/report/{reportId}/export | yuqing:report:export | 导出 PDF / Word |
| POST | /yuqing/report/{reportId}/push | yuqing:report:push | 推送报告至企业微信 |
| POST | /yuqing/report/{reportId}/submit | yuqing:report:submit | 线上提交报告 |

## 舆情月报生成 |monthly-report
#### 功能描述
每月自动归集全月舆情数据，完成月度舆情整体分析并生成月报。月报包含月度舆情总体态势、各维度数据统计、重点舆情事件复盘、风险舆情汇总、舆情传播规律、月度工作总结与下月舆情风险预判；支持预设多套模板，可导出与推送。

#### 验收标准
- 验收标准 1: When 到达配置的月报生成时间, the system shall 自动归集全月舆情数据并生成月报
- 验收标准 2: The system shall 生成月报正文包含月度舆情总体态势、各维度数据统计、重点舆情事件复盘、风险舆情汇总、舆情传播规律、月度工作总结、下月舆情风险预判
- 验收标准 3: The system shall 支持月报基于指定月份重新生成, 并保留历史版本
- 验收标准 4: The system shall 支持按报告模板渲染月报并导出 PDF 与 Word
- 验收标准 5: When 月报生成完成, the system shall 按推送规则推送至企业微信并提供 H5 查看入口
- 验收标准 6: The system shall 支持跨月对比视图（环比舆情总量、正负面占比、风险舆情数量）
- 验收标准 7: If 某月数据不完整（如某日采集任务未运行）, then the system shall 在月报中标注数据缺失区间, 不虚假填充
- 验收标准 8: The system shall 维护月报状态与历史台账, 支持按月份与状态查询
- 验收标准 9: The system shall 支持配置多套月报模板并在生成时选择

#### 接口定义
| 方法 | 路径 | 权限标识 | 说明 |
|------|------|---------|------|
| GET | /yuqing/report/list | yuqing:report:list | 报告台账（按类型/日期/状态） |
| GET | /yuqing/report/{reportId} | yuqing:report:query | 报告详情（含正文） |
| POST | /yuqing/report/generate | yuqing:report:generate | 手工生成报告（日报/月报/快报/专项） |
| POST | /yuqing/report/{reportId}/regenerate | yuqing:report:generate | 重新生成（保留版本） |
| GET | /yuqing/report/{reportId}/export | yuqing:report:export | 导出 PDF / Word |
| POST | /yuqing/report/{reportId}/push | yuqing:report:push | 推送报告至企业微信 |

## 舆情台账与数据查询 |ledger
#### 功能描述
平台全程自动留存所有作业数据，形成统一舆情台账。管理人员可在后台按时间、渠道、任务、舆情属性、风险等级、标签、关键词、聚合事件等维度检索舆情，查看单条舆情详情（原文、互动数据、溯源字段、研判结论、预警与推送记录），并支持导出。

#### 验收标准
- 验收标准 1: The system shall 支持按时间范围、任务、渠道、舆情属性、风险等级、舆情分级、标签、关键词、采集来源、清洗状态、研判状态组合筛选台账
- 验收标准 2: The system shall 在台账列表展示标题、来源渠道、发布时间、发布作者、舆情属性、风险等级、热度、采集时间、研判状态
- 验收标准 3: When 用户打开舆情详情, the system shall 展示原文内容、互动数据、完整溯源字段（含原始链接）、研判结论、预警记录与推送记录
- 验收标准 4: The system shall 支持按聚合事件查看关联的全部舆情, 并在时间轴上展示传播脉络
- 验收标准 5: The system shall 支持按当前筛选条件导出 Excel, 导出条数与字段范围可配置
- 验收标准 6: If 导出条数超过配置上限, then the system shall 转为异步导出任务并在完成后推送下载链接, 不阻塞页面
- 验收标准 7: The system shall 提供全文检索能力, 支持按标题与正文关键词检索, 并高亮命中片段
- 验收标准 8: The system shall 实现数据权限隔离, 不同角色仅能查询其授权范围内的舆情数据
- 验收标准 9: When 查询无结果, the system shall 展示空状态提示并给出可放宽的筛选建议
- 验收标准 10: The system shall 记录台账导出操作（导出人、时间、条件、条数）以符合审计要求

#### 接口定义
| 方法 | 路径 | 权限标识 | 说明 |
|------|------|---------|------|
| GET | /yuqing/opinion/list | yuqing:opinion:list | 舆情台账（多维筛选） |
| GET | /yuqing/opinion/{opinionId} | yuqing:opinion:query | 舆情详情（含研判/预警/推送记录） |
| GET | /yuqing/opinion/search | yuqing:opinion:list | 全文检索（高亮命中片段） |
| DELETE | /yuqing/opinion/{opinionIds} | yuqing:opinion:remove | 批量软删舆情 |
| POST | /yuqing/opinion/export | yuqing:opinion:export | 导出台账 Excel |

## 知识库沉淀与迭代 |knowledge
#### 功能描述
建立舆情专属知识库，实现重点舆情数据沉淀、案例积累、模型持续迭代，形成业务闭环。系统自动筛选高价值舆情入库，业务人员可标注样本、修正模型结论、录入行业专属规则与案例；系统定期归集标注数据与错误案例完成模型微调与参数迭代，使研判精准度持续提升。

#### 验收标准
- 验收标准 1: The system shall 自动筛选高价值舆情入库, 入库范围包含重点舆情事件、专项宣传舆情、各级别负面风险舆情、突发热点舆情、人工标注修正的典型舆情、研判易错典型案例、行业专属舆情场景案例
- 验收标准 2: The system shall 不把普通中性、无价值重复舆情纳入知识库
- 验收标准 3: The system shall 按结构化结构存储案例, 字段包含舆情原始数据、舆情链接、研判结果、分级标签、处置记录、人工修正标注、场景分类、风险特征、关键词特征
- 验收标准 4: The system shall 支持知识库案例的检索、查询、复用与查看引用情况
- 验收标准 5: The system shall 支持业务人员手动新增、修正、完善与淘汰知识库案例, 操作留痕
- 验收标准 6: The system shall 把人工修正过的案例自动登记为待标注训练样本, 并维护样本状态 `pending`/`labeled`/`trained`
- 验收标准 7: When 执行模型微调迭代, the system shall 记录模型版本、训练样本量、训练时间与迭代前后的评测指标
- 验收标准 8: The system shall 支持查看模型迭代效果对比（同一批评测样本在迭代前后的准确率变化）
- 验收标准 9: If 微调后评测指标下降, then the system shall 保留回滚到上一模型版本的能力, 并记录回滚原因
- 验收标准 10: The system shall 把知识库样本持续反哺研判提示词与模型训练, 形成"业务数据积累 → 模型能力提升 → 舆情处理更精准 → 优质样本再积累"的正向循环

#### 接口定义
| 方法 | 路径 | 权限标识 | 说明 |
|------|------|---------|------|
| GET | /yuqing/knowledge/list | yuqing:knowledge:list | 知识库案例列表 |
| GET | /yuqing/knowledge/{knowledgeId} | yuqing:knowledge:query | 知识库案例详情 |
| POST | /yuqing/knowledge | yuqing:knowledge:add | 手动新增案例 |
| PUT | /yuqing/knowledge | yuqing:knowledge:edit | 修正案例 |
| PUT | /yuqing/knowledge/sink | yuqing:knowledge:sink | 舆情一键入知识库 |
| DELETE | /yuqing/knowledge/{knowledgeIds} | yuqing:knowledge:remove | 淘汰案例 |
| GET | /yuqing/trainSample/list | yuqing:sample:list | 训练样本列表（按状态） |
| PUT | /yuqing/trainSample/{sampleId}/label | yuqing:sample:label | 标注样本 |
| GET | /yuqing/modelVersion/list | yuqing:model:list | 模型版本列表（含评测指标） |
| POST | /yuqing/modelVersion/iterate | yuqing:model:iterate | 触发模型迭代（归集样本+训练） |
| PUT | /yuqing/modelVersion/{modelVersionId}/rollback | yuqing:model:rollback | 回滚到指定模型版本 |

## 运营监控与权限日志 |monitor
#### 功能描述
提供平台运行的可观测性与管控能力。管理人员可在后台实时监控系统运行状态与各作业环节的执行情况，查看采集、净化、研判、预警、推送、报告、知识库迭代各链路的执行记录与失败明细，并管理用户、角色、菜单、字典与操作日志。

#### 验收标准
- 验收标准 1: The system shall 在运行监控页展示采集、净化、研判、预警、推送、报告、知识库迭代各链路的当日执行量与成功率
- 验收标准 2: The system shall 展示各定时任务的最近一次执行时间、耗时与执行结果（成功/失败）, 支持手动触发一次
- 验收标准 3: If 任一环节出现连续失败或成功率低于阈值, then the system shall 在监控页标红并向企业微信推送异常提醒
- 验收标准 4: The system shall 提供链路级失败明细查询, 可下钻到具体舆情或具体批次
- 验收标准 5: The system shall 复用若依内置能力实现用户、角色、菜单、部门、字典的维护, 不重复开发
- 验收标准 6: The system shall 复用若依操作日志能力, 记录关键操作的操作人、IP、时间、操作类型与结果
- 验收标准 7: The system shall 支持按角色分配菜单与接口权限, 权限变更后需重新登录或清缓存生效
- 验收标准 8: The system shall 提供关键业务指标的统计报表（采集量、去重率、研判量、预警量、推送量、报告量）, 支持按日/周/月粒度导出
- 验收标准 9: If 未授权用户访问受保护接口, then the system shall 返回 403 并记录访问日志, 不泄露业务数据

#### 接口定义
| 方法 | 路径 | 权限标识 | 说明 |
|------|------|---------|------|
| GET | /yuqing/monitor/overview | yuqing:monitor:list | 运行监控总览（链路成功率） |
| GET | /yuqing/monitor/taskJob | yuqing:monitor:list | 定时任务执行明细 |
| POST | /yuqing/monitor/taskJob/{jobId}/runOnce | yuqing:monitor:run | 手动触发一次任务 |
| GET | /yuqing/monitor/failDetail | yuqing:monitor:list | 链路级失败明细 |
| GET | /yuqing/monitor/collectLog | yuqing:monitor:list | 采集日志查询 |
| GET | /yuqing/collectLog/export | yuqing:monitor:export | 采集日志导出 |
| GET | /yuqing/stats/report | yuqing:monitor:list | 业务指标统计报表 |
