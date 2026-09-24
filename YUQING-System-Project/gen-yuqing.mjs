#!/usr/bin/env node
/**
 * 全自动化舆情监测研判报送平台（YUQING）三端代码生成器
 * RuoYi-Vue-Plus v6.0.0 适配版（PC 后端 + PC 前端 plus-ui + 手机端 RuoYi-App-Plus）
 *
 * 数据来源（权威）：
 *   - PRD §5.2 数据字典      -> TABLES（29 张表 / 字段 / 类型 / 注释）
 *   - PRD §5.5 Doris 建表约定 -> doris=true 的表走独立 DDL 与只读查询
 *   - PRD §6.3 API 设计约定   -> 各模块端点与权限标识
 *   - PRD §7.2 菜单配置规范   -> sys_menu 22 列
 *   - dev-specs/F-0xx-*.md    -> 功能点边界（决定 ctrl / pcPage 是否交给手写）
 *
 * 用法:
 *   node gen-yuqing.mjs                 # 默认读 ./specs/spec.md，输出 ./yq-code
 *   node gen-yuqing.mjs <spec> <out>
 *
 * 输出结构:
 *   <OUT>/java/org/dromara/yuqing/{domain,mapper,service,service/impl,controller}/
 *   <OUT>/sql/{yq_schema.sql,yq_doris_schema.sql,yq_dict.sql,yq_menu.sql}
 *   <OUT>/pc/{api/yuqing/**,views/yuqing/**}
 *   <OUT>/h5/api/yuqing/**, <OUT>/h5/pages/yuqing/**
 *
 * 核心原则：生成器只做机械 CRUD；涉及事务/多表写入/聚合统计/大模型调用的端点
 * 一律 ctrl:false, svcHandwritten:true 留给手写 Controller + IXxxExtService。
 */
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const SPEC = process.argv[2]
  ? path.resolve(PROJECT_ROOT, process.argv[2])
  : path.join(PROJECT_ROOT, 'specs', 'spec.md');
const OUT = process.argv[3]
  ? path.resolve(PROJECT_ROOT, process.argv[3])
  : path.join(PROJECT_ROOT, 'yq-code');

const PACKAGE = 'org.dromara.yuqing';
const JAVA_BASE = path.join(OUT, 'java', PACKAGE.replace(/\./g, '/'));

/* ============================================================
 * 1. 表定义 —— 严格照 PRD §5.2 数据字典（29 张表）
 *    doris      : true 表示该表落在 Apache Doris（只读查询，DDL 走 yq_doris_schema.sql）
 *    ctrl       : 是否由生成器产出通用 CRUD Controller（复杂模块留给手写）
 *    pcPage     : 是否产出 PC 端 page（列表 + 弹窗）
 *    audit      : 是否继承 BaseEntity（false 时 implements Serializable）
 *    logicDelete: 逻辑删除字段名，null 表示无
 *    queryParams: 需要 beginTime/endTime 范围查询（v6 BaseEntity 无 params，需自带）
 *    detail/details: 主子表配置（明细的查 / 覆盖式存 / 级联删）
 * ============================================================ */
const S  = (name, column, comment, extra = {}) => ({ name, column, javaType: 'String', sqlType: 'VARCHAR(255)', comment, ...extra });
const L  = (name, column, comment, extra = {}) => ({ name, column, javaType: 'Long', sqlType: 'BIGINT', comment, ...extra });
const I  = (name, column, comment, extra = {}) => ({ name, column, javaType: 'Integer', sqlType: 'INT', comment, ...extra });
const D  = (name, column, comment, extra = {}) => ({ name, column, javaType: 'LocalDateTime', sqlType: 'DATETIME', comment, ...extra });
const DT = (name, column, comment, extra = {}) => ({ name, column, javaType: 'LocalDate', sqlType: 'DATE', comment, ...extra });
const N  = (name, column, comment, extra = {}) => ({ name, column, javaType: 'BigDecimal', sqlType: 'DECIMAL(5,2)', comment, ...extra });
const C1 = (name, column, comment, extra = {}) => ({ name, column, javaType: 'String', sqlType: 'CHAR(1)', comment, ...extra });
const TX = (name, column, comment, extra = {}) => ({ name, column, javaType: 'String', sqlType: 'TEXT', comment, ...extra });
const JS = (name, column, comment, extra = {}) => ({ name, column, javaType: 'String', sqlType: 'JSON', comment, ...extra });

/** 删除标志的标准声明（v6 约定 0存在 2删除） */
const DEL = () => C1('delFlag', 'del_flag', '删除标志（0存在 2删除）', { hidden: true, default: '0' });
/** 通用状态（sys_normal_disable） */
const ST = (comment = '状态（0正常 1停用）') => C1('status', 'status', comment, { dict: 'sys_normal_disable', default: '0' });

const TABLES = [
  /* ---------- 配置域（MySQL / 事务） ---------- */
  {
    key: 'task', entity: 'YqTask', table: 'yq_task', title: '监测任务',
    pk: 'taskId', pkColumn: 'task_id', pkComment: '任务ID,主键',
    perm: 'yuqing:task', basePath: '/yuqing/task',
    ctrl: true, pcPage: true, logicDelete: 'delFlag', queryParams: true,
    // 主子表：任务下挂「关键词关联」与「渠道关联」两张明细表
    details: [
      { key: 'taskKeyword', foreignField: 'taskId', listField: 'keywordList' },
      { key: 'taskChannel', foreignField: 'taskId', listField: 'channelList' },
    ],
    fields: [
      S('taskName', 'task_name', '任务名称', { sqlType: 'VARCHAR(100)', required: true, excel: true }),
      S('taskType', 'task_type', '任务类型', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_task_type', default: 'normal', excel: true }),
      S('taskSource', 'task_source', '任务来源', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_task_source', default: 'pc', excel: true }),
      S('collectStrategy', 'collect_strategy', '采集策略', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_collect_strategy', default: 'polling', excel: true }),
      I('collectInterval', 'collect_interval', '采集间隔（秒）', { required: true, default: '1800' }),
      L('levelRuleId', 'level_rule_id', '分级规则ID', { foreign: 'levelRule', refName: 'levelRuleName' }),
      L('alertRuleId', 'alert_rule_id', '预警规则ID', { foreign: 'alertRule', refName: 'alertRuleName' }),
      L('pushRuleId', 'push_rule_id', '推送规则ID', { foreign: 'pushRule', refName: 'pushRuleName' }),
      D('startTime', 'start_time', '任务生效起始', { required: true, excel: true }),
      D('endTime', 'end_time', '任务结束时间（常态化为空）', { excel: true }),
      D('lastScheduleTime', 'last_schedule_time', '最近一次调度时间', { excel: true }),
      ST(),
      DEL(),
      S('remark', 'remark', '备注', { sqlType: 'VARCHAR(500)' }),
    ],
    virtual: [
      S('levelRuleName', null, '分级规则名称', { virtual: true, excel: true }),
      S('alertRuleName', null, '预警规则名称', { virtual: true, excel: true }),
      S('pushRuleName', null, '推送规则名称', { virtual: true, excel: true }),
      { name: 'keywordList', javaType: 'List<YqTaskKeyword>', comment: '关键词关联', virtual: true },
      { name: 'channelList', javaType: 'List<YqTaskChannel>', comment: '渠道关联', virtual: true },
    ],
  },
  {
    key: 'keywordGroup', entity: 'YqKeywordGroup', table: 'yq_keyword_group', title: '关键词分组',
    pk: 'groupId', pkColumn: 'group_id', pkComment: '分组ID,主键',
    perm: 'yuqing:keyword', basePath: '/yuqing/keywordGroup',
    ctrl: true, pcPage: false, logicDelete: 'delFlag',
    fields: [
      S('groupName', 'group_name', '分组名称', { sqlType: 'VARCHAR(50)', required: true, excel: true }),
      DEL(),
    ],
    virtual: [],
  },
  {
    key: 'keyword', entity: 'YqKeyword', table: 'yq_keyword', title: '关键词',
    pk: 'keywordId', pkColumn: 'keyword_id', pkComment: '关键词ID,主键',
    perm: 'yuqing:keyword', basePath: '/yuqing/keyword',
    ctrl: true, pcPage: true, logicDelete: 'delFlag', queryParams: true,
    fields: [
      L('groupId', 'group_id', '所属分组ID', { required: true, foreign: 'keywordGroup', refName: 'groupName' }),
      S('keywordText', 'keyword_text', '关键词文本', { sqlType: 'VARCHAR(100)', required: true, excel: true }),
      S('keywordType', 'keyword_type', '关键词类型', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_keyword_type', default: 'fuzzy', excel: true }),
      S('keywordCategory', 'keyword_category', '关键词分类', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_keyword_category', default: 'core', excel: true }),
      S('comboExpression', 'combo_expression', '组合表达式（type=combo 必填）', { sqlType: 'VARCHAR(500)' }),
      I('refCount', 'ref_count', '被引用次数', { default: '0' }),
      ST(),
      DEL(),
      S('remark', 'remark', '备注', { sqlType: 'VARCHAR(200)' }),
    ],
    virtual: [S('groupName', null, '分组名称', { virtual: true, excel: true })],
  },
  {
    key: 'taskKeyword', entity: 'YqTaskKeyword', table: 'yq_task_keyword', title: '任务关键词关联',
    pk: 'id', pkColumn: 'id', pkComment: '主键',
    perm: 'yuqing:task', basePath: '/yuqing/taskKeyword',
    ctrl: false, pcPage: false, logicDelete: null,
    fields: [
      L('taskId', 'task_id', '任务ID', { required: true, foreign: 'task' }),
      L('keywordId', 'keyword_id', '关键词ID', { required: true, foreign: 'keyword', refName: 'keywordText' }),
      S('matchStrategy', 'match_strategy', '任务级匹配策略（覆盖全局）', { sqlType: 'VARCHAR(20)' }),
    ],
    virtual: [S('keywordText', null, '关键词文本', { virtual: true, excel: true })],
  },
  {
    key: 'taskChannel', entity: 'YqTaskChannel', table: 'yq_task_channel', title: '任务渠道关联',
    pk: 'id', pkColumn: 'id', pkComment: '主键',
    perm: 'yuqing:task', basePath: '/yuqing/taskChannel',
    ctrl: false, pcPage: false, logicDelete: null,
    fields: [
      L('taskId', 'task_id', '任务ID', { required: true, foreign: 'task' }),
      L('channelId', 'channel_id', '渠道ID', { required: true, foreign: 'channel', refName: 'channelName' }),
      I('overrideInterval', 'override_interval', '任务级频率覆盖（秒）'),
    ],
    virtual: [S('channelName', null, '渠道名称', { virtual: true, excel: true })],
  },
  {
    key: 'channel', entity: 'YqChannel', table: 'yq_channel', title: '采集渠道',
    pk: 'channelId', pkColumn: 'channel_id', pkComment: '渠道ID,主键',
    perm: 'yuqing:channel', basePath: '/yuqing/channel',
    ctrl: true, pcPage: true, logicDelete: 'delFlag', queryParams: true,
    fields: [
      S('channelName', 'channel_name', '渠道名称', { sqlType: 'VARCHAR(50)', required: true, excel: true }),
      S('channelCategory', 'channel_category', '渠道类别', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_channel_category', default: 'news', excel: true }),
      S('channelDomain', 'channel_domain', '域名或平台标识', { sqlType: 'VARCHAR(200)', excel: true }),
      S('adapterClass', 'adapter_class', '站点适配器标识（YAML 配置键）', { sqlType: 'VARCHAR(100)', excel: true }),
      L('collectorId', 'collector_id', '绑定采集器ID'),
      I('intervalOverride', 'interval_override', '渠道级频率覆盖（秒）', { default: '0' }),
      I('requestInterval', 'request_interval', '请求间隔（毫秒）', { default: '3000' }),
      I('concurrencyLimit', 'concurrency_limit', '并发上限', { default: '2' }),
      L('proxyGroupId', 'proxy_group_id', '代理池分组ID'),
      L('uaPoolId', 'ua_pool_id', 'UA 池ID'),
      I('failRateThreshold', 'fail_rate_threshold', '失败率告警阈值（%）', { default: '30' }),
      D('lastCollectTime', 'last_collect_time', '最近采集时间', { excel: true }),
      ST(),
      DEL(),
      S('remark', 'remark', '备注', { sqlType: 'VARCHAR(500)' }),
    ],
    virtual: [],
  },
  {
    key: 'noiseRule', entity: 'YqNoiseRule', table: 'yq_noise_rule', title: '降噪规则',
    pk: 'ruleId', pkColumn: 'rule_id', pkComment: '规则ID,主键',
    perm: 'yuqing:noiseRule', basePath: '/yuqing/noiseRule',
    ctrl: true, pcPage: false, logicDelete: null,
    fields: [
      S('ruleName', 'rule_name', '规则名称', { sqlType: 'VARCHAR(50)', required: true, excel: true }),
      S('ruleType', 'rule_type', '规则类型', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_noise_rule_type', default: 'system', excel: true }),
      S('noiseCategory', 'noise_category', '降噪类别', { sqlType: 'VARCHAR(30)', required: true, dict: 'yq_noise_category', default: 'advertisement', excel: true }),
      S('matchType', 'match_type', '匹配方式', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_match_type', default: 'keyword', excel: true }),
      S('matchValue', 'match_value', '匹配内容', { sqlType: 'VARCHAR(500)', required: true, excel: true }),
      I('priority', 'priority', '执行优先级', { default: '10' }),
      ST(),
      S('remark', 'remark', '备注', { sqlType: 'VARCHAR(500)' }),
    ],
    virtual: [],
  },
  {
    key: 'levelRule', entity: 'YqLevelRule', table: 'yq_level_rule', title: '研判分级规则',
    pk: 'ruleId', pkColumn: 'rule_id', pkComment: '规则ID,主键',
    perm: 'yuqing:levelRule', basePath: '/yuqing/levelRule',
    ctrl: true, pcPage: false, logicDelete: null,
    fields: [
      S('ruleName', 'rule_name', '规则名称', { sqlType: 'VARCHAR(50)', required: true, excel: true }),
      C1('isDefault', 'is_default', '是否默认规则（0是 1否）', { default: '1' }),
      S('scoreMetric', 'score_metric', '评分依据', { sqlType: 'VARCHAR(30)', required: true, dict: 'yq_score_metric', default: 'heat_score' }),
      JS('levelRanges', 'level_ranges', '四档分级区间定义', { required: true }),
      JS('riskMapping', 'risk_mapping', '三级风险等级判定条件', { required: true }),
      N('sentiThreshold', 'senti_threshold', '负面情感占比判定阈值', { default: '0.30' }),
      ST(),
      S('remark', 'remark', '备注', { sqlType: 'VARCHAR(500)' }),
    ],
    virtual: [],
  },
  {
    key: 'tag', entity: 'YqTag', table: 'yq_tag', title: '标签',
    pk: 'tagId', pkColumn: 'tag_id', pkComment: '标签ID,主键',
    perm: 'yuqing:tag', basePath: '/yuqing/tag',
    ctrl: true, pcPage: false, logicDelete: 'delFlag',
    fields: [
      S('tagName', 'tag_name', '标签名称', { sqlType: 'VARCHAR(50)', required: true, excel: true }),
      L('parentId', 'parent_id', '父标签ID（顶级为0）', { foreign: 'tag', refName: 'parentName', refZeroLabel: '顶级' }),
      I('orderNum', 'order_num', '显示顺序'),
      ST(),
      DEL(),
    ],
    virtual: [S('parentName', null, '父标签名称', { virtual: true })],
  },
];


const TABLES_2 = [
  {
    key: 'alertRule', entity: 'YqAlertRule', table: 'yq_alert_rule', title: '预警规则',
    pk: 'ruleId', pkColumn: 'rule_id', pkComment: '规则ID,主键',
    perm: 'yuqing:alert', basePath: '/yuqing/alertRule',
    ctrl: true, pcPage: false, logicDelete: null,
    fields: [
      S('ruleName', 'rule_name', '规则名称', { sqlType: 'VARCHAR(50)', required: true, excel: true }),
      S('triggerScenes', 'trigger_scenes', '触发场景（逗号分隔）', { sqlType: 'VARCHAR(200)', default: 'new_negative,high_risk', excel: true }),
      I('windowMinutes', 'window_minutes', '统计时间窗口（分钟）', { required: true, default: '10' }),
      I('countThreshold', 'count_threshold', '条数阈值'),
      I('heatThreshold', 'heat_threshold', '热度阈值'),
      S('riskLevelThreshold', 'risk_level_threshold', '最低触发风险等级', { sqlType: 'VARCHAR(20)', dict: 'yq_risk_level', default: 'moderate' }),
      S('spreadThreshold', 'spread_threshold', '最低触发传播量级', { sqlType: 'VARCHAR(20)', dict: 'yq_spread_level', default: 'medium' }),
      N('burstRatio', 'burst_ratio', '突发增量倍数阈值', { default: '3.00' }),
      I('minBurstCount', 'min_burst_count', '突发增量最小条数（防小样本虚高）', { default: '5' }),
      I('cooldownMinutes', 'cooldown_minutes', '同一事件聚合冷却期（分钟）', { default: '360' }),
      S('topicTags', 'topic_tags', '重点专项标签（逗号分隔）', { sqlType: 'VARCHAR(500)' }),
      S('alertLevel', 'alert_level', '预警级别', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_alert_level', default: 'warning', excel: true }),
      S('pushLevel', 'push_level', '推送级别', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_push_level', default: 'immediate', excel: true }),
      S('notifyUserIds', 'notify_user_ids', '通知人用户ID（逗号分隔）', { sqlType: 'VARCHAR(1000)' }),
      ST(),
    ],
    virtual: [],
  },
  {
    key: 'alert', entity: 'YqAlert', table: 'yq_alert', title: '预警记录',
    pk: 'alertId', pkColumn: 'alert_id', pkComment: '预警ID,主键',
    perm: 'yuqing:alert', basePath: '/yuqing/alert',
    // 含「处置闭环」端点（/process），Controller 与 ExtService 手写
    ctrl: false, pcPage: false, svcHandwritten: true, logicDelete: null, queryParams: true,
    fields: [
      L('ruleId', 'rule_id', '触发规则ID', { foreign: 'alertRule', refName: 'ruleName' }),
      L('opinionId', 'opinion_id', '关联舆情ID'),
      L('clusterId', 'cluster_id', '关联事件聚合ID'),
      S('alertTitle', 'alert_title', '预警标题', { sqlType: 'VARCHAR(300)', required: true, excel: true }),
      S('triggerScene', 'trigger_scene', '触发场景', { sqlType: 'VARCHAR(30)', required: true, dict: 'yq_alert_scene', default: 'new_negative', excel: true }),
      S('alertLevel', 'alert_level', '预警级别', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_alert_level', default: 'warning', excel: true }),
      S('triggerValue', 'trigger_value', '触发值描述', { sqlType: 'VARCHAR(200)', excel: true }),
      S('fingerprint', 'fingerprint', '事件聚合指纹（同指纹冷却期内不重复预警）', { sqlType: 'VARCHAR(64)' }),
      D('triggerTime', 'trigger_time', '触发时间', { required: true, excel: true }),
      S('status', 'status', '处置状态', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_alert_status', default: 'pending', excel: true }),
      S('processRemark', 'process_remark', '处置说明', { sqlType: 'VARCHAR(500)' }),
      L('processBy', 'process_by', '处置人用户ID'),
      D('processTime', 'process_time', '处置时间', { excel: true }),
      S('pushResult', 'push_result', '推送结果', { sqlType: 'VARCHAR(20)', dict: 'yq_push_status', excel: true }),
    ],
    virtual: [
      S('ruleName', null, '触发规则名称', { virtual: true, excel: true }),
      S('opinionTitle', null, '舆情标题', { virtual: true, excel: true }),
      S('clusterTitle', null, '事件标题', { virtual: true, excel: true }),
      S('processByName', null, '处置人', { virtual: true, excel: true }),
      S('channelName', null, '来源渠道', { virtual: true, excel: true }),
      D('publishTime', null, '发布时间', { virtual: true, excel: true }),
    ],
  },
  {
    key: 'pushRule', entity: 'YqPushRule', table: 'yq_push_rule', title: '推送规则',
    pk: 'ruleId', pkColumn: 'rule_id', pkComment: '规则ID,主键',
    perm: 'yuqing:push', basePath: '/yuqing/pushRule',
    ctrl: true, pcPage: false, logicDelete: null,
    fields: [
      S('ruleName', 'rule_name', '规则名称', { sqlType: 'VARCHAR(50)', required: true, excel: true }),
      S('pushScenes', 'push_scenes', '推送场景（逗号分隔）', { sqlType: 'VARCHAR(200)', required: true, excel: true }),
      S('pushLevel', 'push_level', '推送级别', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_push_level', default: 'immediate', excel: true }),
      S('scheduleCron', 'schedule_cron', '定时批量 cron', { sqlType: 'VARCHAR(50)' }),
      L('pushTemplateId', 'push_template_id', '推送模板ID', { foreign: 'pushTemplate', refName: 'templateName' }),
      S('targetType', 'target_type', '目标类型', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_push_target', default: 'user', excel: true }),
      S('targetIds', 'target_ids', '目标ID（逗号分隔）', { sqlType: 'VARCHAR(1000)', required: true }),
      S('quietStart', 'quiet_start', '免打扰开始时间 HH:mm', { sqlType: 'VARCHAR(5)', default: '22:00', excel: true }),
      S('quietEnd', 'quiet_end', '免打扰结束时间 HH:mm', { sqlType: 'VARCHAR(5)', default: '08:00', excel: true }),
      I('maxRetry', 'max_retry', '失败重试上限', { default: '3' }),
      ST(),
    ],
    virtual: [S('templateName', null, '推送模板名称', { virtual: true, excel: true })],
  },
  {
    key: 'pushTemplate', entity: 'YqPushTemplate', table: 'yq_push_template', title: '推送模板',
    pk: 'templateId', pkColumn: 'template_id', pkComment: '模板ID,主键',
    perm: 'yuqing:push', basePath: '/yuqing/pushTemplate',
    ctrl: true, pcPage: false, logicDelete: null,
    fields: [
      S('templateName', 'template_name', '模板名称', { sqlType: 'VARCHAR(50)', required: true, excel: true }),
      S('contentType', 'content_type', '内容形式', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_push_content_type', default: 'summary', excel: true }),
      TX('bodyTemplate', 'body_template', '模板正文（含占位符）', { required: true }),
      S('fieldList', 'field_list', '模板包含字段清单', { sqlType: 'VARCHAR(1000)', required: true }),
      ST(),
    ],
    virtual: [],
  },
  {
    key: 'pushRecord', entity: 'YqPushRecord', table: 'yq_push_record', title: '推送记录',
    pk: 'recordId', pkColumn: 'record_id', pkComment: '记录ID,主键',
    perm: 'yuqing:push', basePath: '/yuqing/pushRecord',
    ctrl: false, pcPage: false, logicDelete: null, queryParams: true,
    fields: [
      L('ruleId', 'rule_id', '推送规则ID', { foreign: 'pushRule', refName: 'ruleName' }),
      S('pushScene', 'push_scene', '推送场景', { sqlType: 'VARCHAR(30)', required: true, dict: 'yq_push_scene', default: 'new_opinion', excel: true }),
      S('pushLevel', 'push_level', '推送级别', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_push_level', default: 'immediate', excel: true }),
      TX('contentSnapshot', 'content_snapshot', '推送内容快照', { required: true }),
      S('targetIds', 'target_ids', '实际接收人（逗号分隔）', { sqlType: 'VARCHAR(1000)' }),
      S('opinionIds', 'opinion_ids', '关联舆情ID（逗号分隔）', { sqlType: 'VARCHAR(1000)' }),
      L('reportId', 'report_id', '关联报告ID'),
      S('sendStatus', 'send_status', '发送状态', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_push_status', default: 'pending', excel: true }),
      I('retryCount', 'retry_count', '已重试次数', { default: '0' }),
      S('failReason', 'fail_reason', '失败原因', { sqlType: 'VARCHAR(500)' }),
      D('sendTime', 'send_time', '发送时间', { excel: true }),
    ],
    virtual: [S('ruleName', null, '推送规则名称', { virtual: true, excel: true })],
  },
  {
    key: 'wecomCommand', entity: 'YqWecomCommand', table: 'yq_wecom_command', title: '企业微信指令',
    pk: 'commandId', pkColumn: 'command_id', pkComment: '主键',
    perm: 'yuqing:wecom', basePath: '/yuqing/wecomCommand',
    ctrl: true, pcPage: false, logicDelete: null, queryParams: true,
    fields: [
      L('userId', 'user_id', '发起人用户ID', { required: true }),
      S('wecomUserId', 'wecom_user_id', '企业微信成员ID', { sqlType: 'VARCHAR(100)', required: true, excel: true }),
      S('commandText', 'command_text', '指令原文', { sqlType: 'VARCHAR(500)', required: true, excel: true }),
      S('commandType', 'command_type', '识别出的指令类型', { sqlType: 'VARCHAR(50)', dict: 'yq_command_type', excel: true }),
      S('parsedParams', 'parsed_params', '解析出的参数（JSON）', { sqlType: 'VARCHAR(1000)' }),
      L('refTaskId', 'ref_task_id', '关联任务ID'),
      L('refReportId', 'ref_report_id', '关联报告ID'),
      S('execStatus', 'exec_status', '执行状态', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_exec_status', default: 'pending', excel: true }),
      S('execResult', 'exec_result', '执行结果摘要', { sqlType: 'VARCHAR(1000)' }),
      D('execTime', 'exec_time', '执行时间', { excel: true }),
    ],
    virtual: [],
  },
  {
    key: 'reportTemplate', entity: 'YqReportTemplate', table: 'yq_report_template', title: '报告模板',
    pk: 'templateId', pkColumn: 'template_id', pkComment: '模板ID,主键',
    perm: 'yuqing:reportTemplate', basePath: '/yuqing/reportTemplate',
    ctrl: true, pcPage: true, logicDelete: 'delFlag',
    detail: { key: 'reportSection', foreignField: 'templateId', listField: 'sectionList' },
    fields: [
      S('templateName', 'template_name', '模板名称', { sqlType: 'VARCHAR(50)', required: true, excel: true }),
      S('reportType', 'report_type', '报告类型', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_report_type', default: 'daily', excel: true }),
      C1('isDefault', 'is_default', '是否同类型默认（0否 1是）', { default: '0' }),
      S('coverFields', 'cover_fields', '封面字段（JSON）', { sqlType: 'VARCHAR(1000)' }),
      S('fontFamily', 'font_family', '正文字体', { sqlType: 'VARCHAR(50)', default: '仿宋_GB2312' }),
      S('headingNumberRule', 'heading_number_rule', '标题编号规则', { sqlType: 'VARCHAR(20)', dict: 'yq_heading_number', default: 'chinese' }),
      ST(),
      DEL(),
    ],
    virtual: [{ name: 'sectionList', javaType: 'List<YqReportSection>', comment: '模板章节', virtual: true }],
  },
  {
    key: 'reportSection', entity: 'YqReportSection', table: 'yq_report_section', title: '报告模板章节',
    pk: 'sectionId', pkColumn: 'section_id', pkComment: '主键',
    perm: 'yuqing:reportTemplate', basePath: '/yuqing/reportSection',
    ctrl: false, pcPage: false, logicDelete: null,
    fields: [
      L('templateId', 'template_id', '所属模板ID', { required: true, foreign: 'reportTemplate' }),
      S('sectionCode', 'section_code', '章节编码', { sqlType: 'VARCHAR(50)', required: true, excel: true }),
      S('sectionName', 'section_name', '章节标题', { sqlType: 'VARCHAR(100)', required: true, excel: true }),
      I('orderNum', 'order_num', '排序'),
      C1('required', 'required', '是否必含（0否 1是）', { default: '1' }),
    ],
    virtual: [],
  },
  {
    key: 'report', entity: 'YqReport', table: 'yq_report', title: '舆情报告',
    pk: 'reportId', pkColumn: 'report_id', pkComment: '报告ID,主键',
    perm: 'yuqing:report', basePath: '/yuqing/report',
    // 生成/校对/导出/提交/推送端点复杂（文档渲染 + MinIO），Controller 与 ExtService 手写
    ctrl: false, pcPage: false, svcHandwritten: true, logicDelete: 'delFlag', queryParams: true,
    fields: [
      S('reportName', 'report_name', '报告名称', { sqlType: 'VARCHAR(200)', required: true, excel: true }),
      S('reportType', 'report_type', '报告类型', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_report_type', default: 'daily', excel: true }),
      DT('reportDate', 'report_date', '报告归属日期', { required: true, excel: true }),
      L('templateId', 'template_id', '使用模板ID', { foreign: 'reportTemplate', refName: 'templateName' }),
      S('triggerType', 'trigger_type', '生成方式', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_report_trigger', default: 'manual', excel: true }),
      TX('content', 'content', '报告正文（渲染后）'),
      S('fileUrl', 'file_url', '报告文件URL（MinIO）', { sqlType: 'VARCHAR(500)' }),
      S('fileFormat', 'file_format', '文件格式', { sqlType: 'VARCHAR(20)', dict: 'yq_report_format' }),
      I('version', 'version', '版本号', { default: '1' }),
      S('status', 'status', '状态', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_report_status', default: 'generating', excel: true }),
      S('submitStatus', 'submit_status', '提交状态', { sqlType: 'VARCHAR(20)', dict: 'yq_report_submit_status', default: 'unsubmitted', excel: true }),
      L('submitBy', 'submit_by', '提交人用户ID'),
      D('submitTime', 'submit_time', '提交时间', { excel: true }),
      S('failReason', 'fail_reason', '生成失败原因', { sqlType: 'VARCHAR(1000)' }),
      DEL(),
    ],
    virtual: [
      S('templateName', null, '使用模板名称', { virtual: true, excel: true }),
      S('submitByName', null, '提交人', { virtual: true, excel: true }),
      I('opinionCount', null, '纳入舆情条数', { virtual: true, excel: true }),
    ],
  },
  {
    key: 'reportOpinion', entity: 'YqReportOpinion', table: 'yq_report_opinion', title: '报告舆情关联',
    pk: 'id', pkColumn: 'id', pkComment: '主键',
    perm: 'yuqing:report', basePath: '/yuqing/reportOpinion',
    ctrl: false, pcPage: false, logicDelete: null,
    fields: [
      L('reportId', 'report_id', '报告ID', { required: true, foreign: 'report' }),
      L('opinionId', 'opinion_id', '舆情ID', { required: true }),
      S('includeSource', 'include_source', '纳入方式', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_include_source', default: 'auto' }),
      L('operateBy', 'operate_by', '增删操作人'),
    ],
    virtual: [],
  },
  {
    key: 'knowledge', entity: 'YqKnowledge', table: 'yq_knowledge', title: '知识库案例',
    pk: 'knowledgeId', pkColumn: 'knowledge_id', pkComment: '案例ID,主键',
    perm: 'yuqing:knowledge', basePath: '/yuqing/knowledge',
    ctrl: true, pcPage: true, logicDelete: 'delFlag', queryParams: true,
    fields: [
      L('opinionId', 'opinion_id', '来源舆情ID'),
      S('caseType', 'case_type', '案例类型', { sqlType: 'VARCHAR(30)', required: true, dict: 'yq_case_type', default: 'negative_risk', excel: true }),
      S('caseTitle', 'case_title', '案例标题', { sqlType: 'VARCHAR(300)', required: true, excel: true }),
      TX('originData', 'origin_data', '原始数据快照（JSON）'),
      S('opinionUrl', 'opinion_url', '舆情链接', { sqlType: 'VARCHAR(1000)' }),
      TX('analyzeResult', 'analyze_result', '研判结果快照'),
      S('levelTags', 'level_tags', '分级标签', { sqlType: 'VARCHAR(200)', excel: true }),
      S('processRecord', 'process_record', '处置记录', { sqlType: 'VARCHAR(1000)', excel: true }),
      S('manualCorrection', 'manual_correction', '人工修正标注', { sqlType: 'VARCHAR(1000)' }),
      S('sceneCategory', 'scene_category', '场景分类', { sqlType: 'VARCHAR(50)', excel: true }),
      S('riskFeature', 'risk_feature', '风险特征', { sqlType: 'VARCHAR(500)' }),
      S('keywordFeature', 'keyword_feature', '关键词特征', { sqlType: 'VARCHAR(500)' }),
      ST('状态（0有效 1已淘汰）'),
      DEL(),
    ],
    virtual: [],
  },
  {
    key: 'trainSample', entity: 'YqTrainSample', table: 'yq_train_sample', title: '训练样本',
    pk: 'sampleId', pkColumn: 'sample_id', pkComment: '样本ID,主键',
    perm: 'yuqing:knowledge', basePath: '/yuqing/trainSample',
    ctrl: true, pcPage: false, logicDelete: null, audit: false,
    fields: [
      L('knowledgeId', 'knowledge_id', '来源案例ID', { foreign: 'knowledge', refName: 'caseTitle' }),
      L('modelVersionId', 'model_version_id', '使用的模型版本ID', { foreign: 'modelVersion', refName: 'versionName' }),
      S('sampleStatus', 'sample_status', '样本状态', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_sample_status', default: 'pending', excel: true }),
      S('labelContent', 'label_content', '标注内容（JSON）', { sqlType: 'VARCHAR(1000)' }),
      L('labeledBy', 'labeled_by', '标注人'),
      D('labeledTime', 'labeled_time', '标注时间', { excel: true }),
    ],
    virtual: [
      S('caseTitle', null, '来源案例标题', { virtual: true, excel: true }),
      S('versionName', null, '模型版本', { virtual: true, excel: true }),
    ],
  },
  {
    key: 'modelVersion', entity: 'YqModelVersion', table: 'yq_model_version', title: '模型版本',
    pk: 'modelVersionId', pkColumn: 'model_version_id', pkComment: '主键',
    perm: 'yuqing:knowledge', basePath: '/yuqing/modelVersion',
    ctrl: true, pcPage: false, logicDelete: null, audit: false,
    fields: [
      S('versionName', 'version_name', '版本名称', { sqlType: 'VARCHAR(50)', required: true, excel: true }),
      S('modelType', 'model_type', '类型', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_model_type', default: 'base', excel: true }),
      S('provider', 'provider', '提供方', { sqlType: 'VARCHAR(50)', default: 'deepseek', excel: true }),
      I('sampleCount', 'sample_count', '训练样本量'),
      D('trainTime', 'train_time', '训练时间', { excel: true }),
      N('evalAccuracy', 'eval_accuracy', '评测准确率（%）'),
      C1('isActive', 'is_active', '是否启用（0否 1是）', { default: '0' }),
      L('rollbackFrom', 'rollback_from', '从哪个版本回滚而来'),
      S('remark', 'remark', '备注/回滚原因', { sqlType: 'VARCHAR(500)' }),
    ],
    virtual: [],
  },
  /* ---------- F-006 净化去重：重跑批次台账（验收标准 9） ---------- */
  {
    key: 'cleanBatch', entity: 'YqCleanBatch', table: 'yq_clean_batch', title: '净化批次',
    pk: 'batchId', pkColumn: 'batch_id', pkComment: '批次ID,主键',
    perm: 'yuqing:clean', basePath: '/yuqing/cleanBatch',
    ctrl: true, pcPage: true, logicDelete: null, queryParams: true,
    fields: [
      S('batchName', 'batch_name', '批次名称', { sqlType: 'VARCHAR(100)', required: true, excel: true }),
      S('batchType', 'batch_type', '重跑类型', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_clean_batch_type', default: 'condition_replay', excel: true }),
      L('scopeTaskId', 'scope_task_id', '范围-任务ID', { foreign: 'task', refName: 'taskName' }),
      L('scopeChannelId', 'scope_channel_id', '范围-渠道ID', { foreign: 'channel', refName: 'channelName' }),
      DT('scopeStartDate', 'scope_start_date', '范围-起始采集日', { excel: true }),
      DT('scopeEndDate', 'scope_end_date', '范围-截止采集日', { excel: true }),
      I('totalCount', 'total_count', '扫描条数', { default: '0', excel: true }),
      I('cleanedCount', 'cleaned_count', '净化保留条数', { default: '0', excel: true }),
      I('rejectedCount', 'rejected_count', '降噪剔除条数', { default: '0', excel: true }),
      I('dupCount', 'dup_count', '链接去重条数', { default: '0', excel: true }),
      I('dupChannelCount', 'dup_channel_count', '跨渠道重复条数', { default: '0', excel: true }),
      I('noiseSpam', 'noise_spam', '垃圾内容剔除量', { default: '0', excel: true }),
      I('noiseAdvertisement', 'noise_advertisement', '广告营销剔除量', { default: '0', excel: true }),
      I('noiseFlooding', 'noise_flooding', '灌水评论剔除量', { default: '0', excel: true }),
      I('noiseMeaningless', 'noise_meaningless', '无意义短句剔除量', { default: '0', excel: true }),
      I('noiseBot', 'noise_bot', '机器人内容剔除量', { default: '0', excel: true }),
      I('noiseBlank', 'noise_blank', '空白内容剔除量', { default: '0', excel: true }),
      I('noiseViolation', 'noise_violation', '违规屏蔽剔除量', { default: '0', excel: true }),
      C1('previewOnly', 'preview_only', '仅预览未落库（0否 1是）', { default: '0', excel: true }),
      S('status', 'status', '执行状态', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_clean_batch_status', default: 'running', excel: true }),
      S('failReason', 'fail_reason', '失败原因', { sqlType: 'VARCHAR(1000)' }),
      I('costMs', 'cost_ms', '耗时（毫秒）', { excel: true }),
    ],
    virtual: [
      S('taskName', null, '任务名称', { virtual: true, excel: true }),
      S('channelName', null, '渠道名称', { virtual: true, excel: true }),
      N('dupRate', null, '去重率（%）', { virtual: true, excel: true }),
      N('rejectRate', null, '降噪率（%）', { virtual: true, excel: true }),
    ],
  },
  {
    /* F-009：预聚合执行批次（MySQL）—— 对应 yq_clean_batch 的角色，供看板标注「数据截止时间」 */
    key: 'statsBatch', entity: 'YqStatsBatch', table: 'yq_stats_batch', title: '聚合批次',
    pk: 'batchId', pkColumn: 'batch_id', pkComment: '批次ID,主键',
    perm: 'yuqing:dashboard', basePath: '/yuqing/statsBatch',
    ctrl: false, pcPage: false, logicDelete: null, queryParams: true,
    fields: [
      S('batchNo', 'batch_no', '批次号', { sqlType: 'VARCHAR(50)', required: true, excel: true }),
      DT('beginDate', 'begin_date', '聚合起始统计日', { required: true, excel: true }),
      DT('endDate', 'end_date', '聚合截止统计日', { required: true, excel: true }),
      S('triggerType', 'trigger_type', '触发方式', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_stats_trigger_type', default: 'auto', excel: true }),
      S('status', 'status', '执行状态', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_stats_batch_status', default: 'running', excel: true }),
      I('sourceCount', 'source_count', '读取明细条数', { default: '0', excel: true }),
      I('dailyRows', 'daily_rows', '写入 daily 行数', { default: '0', excel: true }),
      I('dimRows', 'dim_rows', '写入 dim 行数', { default: '0', excel: true }),
      I('hotRows', 'hot_rows', '写入 hot 行数', { default: '0', excel: true }),
      L('costMs', 'cost_ms', '耗时（毫秒）', { excel: true }),
      D('dataUntil', 'data_until', '数据截止时间（本次覆盖到的最新发布时间）', { excel: true }),
      S('notice', 'notice', '非致命提示（如命中读取上限被截断）', { sqlType: 'VARCHAR(500)' }),
      /* F-009 验收标准 5：核心事件 / 传播路径这类结论必须有明细才能提炼，
       * 而看板又只能读预聚合表 —— 因此在聚合时把结论一起落库。
       * 放 TEXT 而不是 JSON 类型：MySQL 与 Doris 镜像都能写，跨库搬运零风险。 */
      S('conclusionJson', 'conclusion_json', '结构化分析结论（JSON）', { sqlType: 'TEXT' }),
      S('failReason', 'fail_reason', '失败原因', { sqlType: 'VARCHAR(1000)' }),
    ],
    virtual: [],
  },
  {
    /* F-016：台账导出记录（MySQL / 事务域）。
     *
     * 一张表同时承载两件事：
     *   1) 验收标准 10 的导出审计 —— 导出人(create_by)/时间(create_time)/条件/条数；
     *   2) 验收标准 6 的异步导出任务状态 —— 超限转异步后，任务在哪个状态、
     *      产物在哪、失败为什么，都落在本表（②A 复用 SnailJob 拉起的作业据此推进）。
     *
     * 为什么必须落库而不是只写 sys_oper_log：异步导出要跨「请求线程 → SnailJob 线程」，
     * 操作日志记不到执行结果与下载地址；且导出条数、字段范围是审计口径的一部分。
     *
     * ctrl:false —— 导出记录的查询端点由 F-016 的 YqOpinionController 一并提供，
     * 不再单独产一个 CRUD Controller（避免多一个前端用不到的入口）。
     *
     * export_mode / status 刻意不给 dict：它们是内部任务状态而非用户可配置枚举，
     * 前端用本地常量表渲染标签即可，新增字典反而要动字典号段。
     */
    key: 'ledgerExportLog', entity: 'YqLedgerExportLog', table: 'yq_ledger_export_log', title: '台账导出记录',
    pk: 'exportId', pkColumn: 'export_id', pkComment: '导出记录ID,主键',
    perm: 'yuqing:opinion', basePath: '/yuqing/ledgerExportLog',
    ctrl: false, pcPage: false, logicDelete: null, audit: true, queryParams: true,
    fields: [
      S('exportScope', 'export_scope', '导出范围（台账/事件聚合）', { sqlType: 'VARCHAR(20)', required: true, default: 'ledger', excel: true }),
      S('querySummary', 'query_summary', '筛选条件可读摘要', { sqlType: 'VARCHAR(1000)', excel: true }),
      S('queryJson', 'query_json', '筛选条件快照（JSON）', { sqlType: 'TEXT' }),
      S('columnsJson', 'columns_json', '导出字段清单（JSON 数组）', { sqlType: 'TEXT' }),
      I('rowCount', 'row_count', '导出条数', { default: '0', excel: true }),
      I('columnCount', 'column_count', '导出字段数', { default: '0', excel: true }),
      S('exportMode', 'export_mode', '导出方式（sync同步 / async异步）', { sqlType: 'VARCHAR(20)', required: true, default: 'sync', excel: true }),
      S('status', 'status', '任务状态（pending/running/success/failed）', { sqlType: 'VARCHAR(20)', required: true, default: 'pending', excel: true }),
      S('fileName', 'file_name', '导出文件名', { sqlType: 'VARCHAR(300)', excel: true }),
      S('fileUrl', 'file_url', '下载地址（异步任务完成后回填）', { sqlType: 'VARCHAR(1000)' }),
      D('finishTime', 'finish_time', '完成时间', { excel: true }),
      S('failReason', 'fail_reason', '失败原因', { sqlType: 'VARCHAR(1000)' }),
      S('operIp', 'oper_ip', '操作来源IP', { sqlType: 'VARCHAR(64)' }),
    ],
    virtual: [],
  },
];

/* ============================================================
 * 1.2 Doris 事实表（PRD §5.5）—— 只读查询，DDL 独立
 *    这些表由采集 / 研判 Worker 经 Stream Load 批量写入，
 *    业务侧一律只读（禁止 INSERT/UPDATE/DELETE），故不生成写端点。
 * ============================================================ */
const TABLES_DORIS = [
  {
    key: 'collectLog', entity: 'YqCollectLog', table: 'yq_collect_log', title: '采集日志',
    pk: 'logId', pkColumn: 'log_id', pkComment: '主键',
    perm: 'yuqing:monitor', basePath: '/yuqing/collectLog',
    doris: true, ctrl: false, pcPage: false, logicDelete: null, audit: false, queryParams: true,
    fields: [
      L('taskId', 'task_id', '任务ID', { foreign: 'task', refName: 'taskName' }),
      L('channelId', 'channel_id', '渠道ID', { foreign: 'channel', refName: 'channelName' }),
      S('batchNo', 'batch_no', '采集批次号', { sqlType: 'VARCHAR(50)', required: true, excel: true }),
      S('collectSource', 'collect_source', '采集来源', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_collect_source', default: 'auto', excel: true }),
      S('strategy', 'strategy', '采集策略', { sqlType: 'VARCHAR(20)', dict: 'yq_collect_strategy', excel: true }),
      I('fetchedCount', 'fetched_count', '抓取条数'),
      I('insertedCount', 'inserted_count', '入库条数'),
      I('dupCount', 'dup_count', '去重剔除条数'),
      I('rejectedCount', 'rejected_count', '降噪剔除条数'),
      I('failedCount', 'failed_count', '失败条数'),
      I('costMs', 'cost_ms', '耗时（毫秒）'),
      S('resultStatus', 'result_status', '执行结果', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_exec_result', default: 'success', excel: true }),
      S('failReason', 'fail_reason', '失败原因', { sqlType: 'VARCHAR(1000)' }),
      D('createTime', 'create_time', '记录时间', { excel: true }),
    ],
    virtual: [
      S('taskName', null, '任务名称', { virtual: true, excel: true }),
      S('channelName', null, '渠道名称', { virtual: true, excel: true }),
    ],
  },
  {
    key: 'opinion', entity: 'YqOpinion', table: 'yq_opinion', title: '舆情明细',
    pk: 'opinionId', pkColumn: 'opinion_id', pkComment: '舆情ID,主键',
    perm: 'yuqing:opinion', basePath: '/yuqing/opinion',
    doris: true, ctrl: false, pcPage: false, svcHandwritten: true, logicDelete: 'delFlag', audit: false, queryParams: true,
    fields: [
      DT('collectDate', 'collect_date', '分区列=采集日期', { required: true }),
      L('taskId', 'task_id', '所属任务ID', { foreign: 'task', refName: 'taskName' }),
      L('channelId', 'channel_id', '来源渠道ID', { required: true, foreign: 'channel', refName: 'channelName' }),
      S('title', 'title', '舆情标题', { sqlType: 'VARCHAR(500)', required: true, excel: true }),
      TX('content', 'content', '原文内容'),
      S('opinionUrl', 'opinion_url', '原文链接', { sqlType: 'VARCHAR(1000)', required: true }),
      S('urlHash', 'url_hash', '链接 SHA-256（唯一去重主键载体）', { sqlType: 'CHAR(64)', required: true }),
      D('publishTime', 'publish_time', '发布时间', { excel: true }),
      S('author', 'author', '发布作者/主体', { sqlType: 'VARCHAR(200)', excel: true }),
      L('likeCount', 'like_count', '点赞量'),
      L('commentCount', 'comment_count', '评论量'),
      L('shareCount', 'share_count', '转发量'),
      L('readCount', 'read_count', '阅读量'),
      S('region', 'region', '发布地域', { sqlType: 'VARCHAR(100)', excel: true }),
      S('deviceInfo', 'device_info', '设备信息', { sqlType: 'VARCHAR(200)' }),
      S('topicTags', 'topic_tags', '话题标签（逗号分隔）', { sqlType: 'VARCHAR(500)' }),
      I('heatScore', 'heat_score', '综合热度分值'),
      S('sentiAttr', 'senti_attr', '舆情属性', { sqlType: 'VARCHAR(20)', dict: 'yq_senti_attr', excel: true }),
      S('opinionLevel', 'opinion_level', '舆情分级', { sqlType: 'VARCHAR(20)', dict: 'yq_opinion_level', excel: true }),
      S('riskLevel', 'risk_level', '风险等级', { sqlType: 'VARCHAR(20)', dict: 'yq_risk_level', excel: true }),
      S('spreadLevel', 'spread_level', '传播量级', { sqlType: 'VARCHAR(20)', dict: 'yq_spread_level', excel: true }),
      L('clusterId', 'cluster_id', '事件聚合ID'),
      S('collectSource', 'collect_source', '采集来源', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_collect_source', default: 'auto', excel: true }),
      D('collectTime', 'collect_time', '采集时间', { required: true, excel: true }),
      S('batchNo', 'batch_no', '采集批次号', { sqlType: 'VARCHAR(50)' }),
      S('cleanStatus', 'clean_status', '清洗状态', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_clean_status', default: 'raw', excel: true }),
      S('noiseReason', 'noise_reason', '降噪剔除原因', { sqlType: 'VARCHAR(200)', dict: 'yq_noise_category' }),
      /* F-006：跨渠道重复时，把其余渠道ID补到首条记录上（验收标准 8） */
      S('dupChannelIds', 'dup_channel_ids', '重复渠道ID（逗号分隔）', { sqlType: 'VARCHAR(500)' }),
      D('cleanTime', 'clean_time', '净化时间', { excel: true }),
      S('analyzeStatus', 'analyze_status', '研判状态', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_analyze_status', default: 'pending', excel: true }),
      C1('alertFlag', 'alert_flag', '是否已预警（0否 1是）', { default: '0' }),
      C1('pushFlag', 'push_flag', '是否已推送（0否 1是）', { default: '0' }),
      DEL(),
    ],
    virtual: [
      S('taskName', null, '任务名称', { virtual: true, excel: true }),
      S('channelName', null, '渠道名称', { virtual: true, excel: true }),
      S('clusterTitle', null, '事件标题', { virtual: true, excel: true }),
    ],
  },
  {
    key: 'opinionAnalysis', entity: 'YqOpinionAnalysis', table: 'yq_opinion_analysis', title: '研判结果',
    pk: 'analysisId', pkColumn: 'analysis_id', pkComment: '主键',
    perm: 'yuqing:opinion', basePath: '/yuqing/opinionAnalysis',
    doris: true, ctrl: false, pcPage: false, logicDelete: null, audit: false,
    fields: [
      L('opinionId', 'opinion_id', '舆情ID', { required: true }),
      S('topic', 'topic', '主题识别结果', { sqlType: 'VARCHAR(200)', excel: true }),
      S('summary', 'summary', '核心内容提炼', { sqlType: 'VARCHAR(1000)' }),
      S('sentiAttr', 'senti_attr', '情感倾向判定', { sqlType: 'VARCHAR(20)', dict: 'yq_senti_attr', excel: true }),
      S('riskAttr', 'risk_attr', '风险属性判定', { sqlType: 'VARCHAR(200)' }),
      S('riskLevel', 'risk_level', '风险等级', { sqlType: 'VARCHAR(20)', dict: 'yq_risk_level', excel: true }),
      S('opinionLevel', 'opinion_level', '舆情分级', { sqlType: 'VARCHAR(20)', dict: 'yq_opinion_level', excel: true }),
      S('tags', 'tags', '模型输出标签（逗号分隔）', { sqlType: 'VARCHAR(500)' }),
      S('matchEvidence', 'match_evidence', '隐性/变体命中依据', { sqlType: 'VARCHAR(1000)' }),
      S('suggestion', 'suggestion', '处置建议', { sqlType: 'VARCHAR(1000)' }),
      N('confidence', 'confidence', '置信度（%）'),
      S('modelVersion', 'model_version', '模型版本', { sqlType: 'VARCHAR(50)', excel: true }),
      S('promptVersion', 'prompt_version', '提示词版本', { sqlType: 'VARCHAR(50)' }),
      I('analyzeVersion', 'analyze_version', '研判版本号', { default: '1' }),
      C1('correctedFlag', 'corrected_flag', '是否人工修正（0否 1是）', { default: '0' }),
      L('correctedBy', 'corrected_by', '修正人用户ID'),
      D('correctedTime', 'corrected_time', '修正时间', { excel: true }),
      D('analyzeTime', 'analyze_time', '研判时间', { excel: true }),
      S('failReason', 'fail_reason', '失败原因', { sqlType: 'VARCHAR(1000)' }),
    ],
    virtual: [],
  },
  {
    key: 'opinionTag', entity: 'YqOpinionTag', table: 'yq_opinion_tag', title: '舆情标签关联',
    pk: 'id', pkColumn: 'id', pkComment: '主键',
    perm: 'yuqing:opinion', basePath: '/yuqing/opinionTag',
    doris: true, ctrl: false, pcPage: false, logicDelete: null, audit: false,
    fields: [
      L('opinionId', 'opinion_id', '舆情ID', { required: true }),
      L('tagId', 'tag_id', '标签ID', { required: true, foreign: 'tag', refName: 'tagName' }),
      S('tagSource', 'tag_source', '标签来源', { sqlType: 'VARCHAR(20)', required: true, dict: 'yq_tag_source', default: 'model' }),
    ],
    virtual: [S('tagName', null, '标签名称', { virtual: true, excel: true })],
  },
  {
    key: 'opinionCluster', entity: 'YqOpinionCluster', table: 'yq_opinion_cluster', title: '事件聚合',
    pk: 'clusterId', pkColumn: 'cluster_id', pkComment: '聚合ID,主键',
    perm: 'yuqing:opinion', basePath: '/yuqing/opinionCluster',
    doris: true, ctrl: false, pcPage: false, logicDelete: null, audit: false, queryParams: true,
    fields: [
      S('clusterTitle', 'cluster_title', '事件标题', { sqlType: 'VARCHAR(200)', required: true, excel: true }),
      S('clusterTopic', 'cluster_topic', '事件主题', { sqlType: 'VARCHAR(200)', excel: true }),
      I('opinionCount', 'opinion_count', '关联舆情条数'),
      D('firstTime', 'first_time', '首次出现时间', { excel: true }),
      D('lastTime', 'last_time', '最近出现时间', { excel: true }),
      TX('spreadPath', 'spread_path', '传播脉络（时间轴 JSON）'),
      I('peakHeat', 'peak_heat', '峰值热度'),
      S('riskLevel', 'risk_level', '事件风险等级', { sqlType: 'VARCHAR(20)', dict: 'yq_risk_level', excel: true }),
      D('createTime', 'create_time', '创建时间', { excel: true }),
    ],
    virtual: [],
  },
  {
    key: 'opinionMetric', entity: 'YqOpinionMetric', table: 'yq_opinion_metric', title: '互动数据快照',
    pk: 'metricId', pkColumn: 'metric_id', pkComment: '主键',
    perm: 'yuqing:opinion', basePath: '/yuqing/opinionMetric',
    doris: true, ctrl: false, pcPage: false, logicDelete: null, audit: false,
    fields: [
      L('opinionId', 'opinion_id', '舆情ID', { required: true }),
      DT('snapshotDate', 'snapshot_date', '快照日期', { required: true, excel: true }),
      L('likeCount', 'like_count', '点赞量'),
      L('commentCount', 'comment_count', '评论量'),
      L('shareCount', 'share_count', '转发量'),
      L('readCount', 'read_count', '阅读量'),
      I('heatScore', 'heat_score', '热度分值'),
      D('createTime', 'create_time', '采集时间', { excel: true }),
    ],
    virtual: [],
  },
  {
    key: 'statsDaily', entity: 'YqStatsDaily', table: 'yq_stats_daily', title: '统计预聚合',
    pk: 'statsId', pkColumn: 'stats_id', pkComment: '主键',
    perm: 'yuqing:dashboard', basePath: '/yuqing/statsDaily',
    doris: true, ctrl: false, pcPage: false, logicDelete: null, audit: false, queryParams: true,
    /* F-009：以 (统计日, 任务, 渠道) 业务主键作为 Doris Unique Key —— 聚合任务重跑同一天只会覆盖，
     * 不会累积重复行。任务/渠道缺失时写 0（0 表示未归属），因此两列改为 NOT NULL 以满足键列约束。 */
    dorisKey: ['stats_date', 'task_id', 'channel_id'],
    fields: [
      DT('statsDate', 'stats_date', '统计日期', { required: true, excel: true }),
      L('taskId', 'task_id', '任务ID', { required: true, default: '0', foreign: 'task', refName: 'taskName' }),
      L('channelId', 'channel_id', '渠道ID', { required: true, default: '0', foreign: 'channel', refName: 'channelName' }),
      I('totalCount', 'total_count', '舆情总量'),
      I('positiveCount', 'positive_count', '正面条数'),
      I('neutralCount', 'neutral_count', '中性条数'),
      I('negativeCount', 'negative_count', '负面条数'),
      I('dupCount', 'dup_count', '去重剔除条数'),
      I('rejectedCount', 'rejected_count', '降噪剔除条数'),
      I('alertCount', 'alert_count', '预警条数'),
      I('pushCount', 'push_count', '推送条数'),
      I('reportCount', 'report_count', '报告生成数'),
      /* F-009 验收标准 1「互动数据统计」：四条互动总量，由聚合任务按日累加 */
      L('readSum', 'read_sum', '阅读量合计'),
      L('commentSum', 'comment_sum', '评论量合计'),
      L('shareSum', 'share_sum', '转发量合计'),
      L('likeSum', 'like_sum', '点赞量合计'),
      N('negativeRate', 'negative_rate', '负面占比（%）'),
      D('createTime', 'create_time', '聚合时间', { excel: true }),
    ],
    virtual: [
      S('taskName', null, '任务名称', { virtual: true, excel: true }),
      S('channelName', null, '渠道名称', { virtual: true, excel: true }),
    ],
  },
  {
    /* F-009：通用维度分布长表。grain = (统计日, 维度类型, 维度取值, 时间粒度, 任务, 渠道)
     * 之所以用长表而非宽表：地域 / 话题这类维度取值是开放集合，宽表无法预知列。
     * 「各平台分布 / 地域分布 / 话题分布 / 属性分布 / 风险分布 / 传播趋势」七类指标里
     * 除总量与互动总量外，其余全部由本表承载。 */
    key: 'statsDim', entity: 'YqStatsDim', table: 'yq_stats_dim', title: '维度分布',
    pk: 'dimId', pkColumn: 'dim_id', pkComment: '主键',
    perm: 'yuqing:dashboard', basePath: '/yuqing/statsDim',
    doris: true, ctrl: false, pcPage: false, logicDelete: null, audit: false,
    dorisKey: ['stats_date', 'dim_type', 'dim_key', 'time_grain', 'task_id', 'channel_id'],
    fields: [
      /* —— 键列必须声明在最前，且与 Doris UNIQUE KEY 顺序一致（校验器会检查） —— */
      DT('statsDate', 'stats_date', '统计日期', { required: true }),
      S('dimType', 'dim_type', '维度类型', { sqlType: 'VARCHAR(20)', required: true }),
      S('dimKey', 'dim_key', '维度取值（ID 或文本）', { sqlType: 'VARCHAR(96)', required: true }),
      S('timeGrain', 'time_grain', '时间粒度', { sqlType: 'VARCHAR(10)', required: true }),
      L('taskId', 'task_id', '任务ID（0=未归属）', { required: true }),
      L('channelId', 'channel_id', '渠道ID（0=未归属）', { required: true }),
      /* —— 值列 —— */
      /* ⚠️ 主键列不要写进 fields：生成器会自动以 pkColumn 补在列清单里，
       *    两边都写会渲染出两行 `dim_id`（Doris duplicate column + TS Duplicate identifier）。 */
      S('dimLabel', 'dim_label', '维度展示名', { sqlType: 'VARCHAR(200)' }),
      I('opinionCount', 'opinion_count', '舆情条数'),
      I('positiveCount', 'positive_count', '正面条数'),
      I('neutralCount', 'neutral_count', '中性条数'),
      I('negativeCount', 'negative_count', '负面条数'),
      I('highRiskCount', 'high_risk_count', '高风险条数'),
      L('readSum', 'read_sum', '阅读量合计'),
      L('commentSum', 'comment_sum', '评论量合计'),
      L('shareSum', 'share_sum', '转发量合计'),
      L('likeSum', 'like_sum', '点赞量合计'),
      L('heatSum', 'heat_sum', '热度分值合计'),
      N('negativeRate', 'negative_rate', '负面占比（%）'),
      D('createTime', 'create_time', '聚合时间'),
    ],
    virtual: [],
  },
  {
    /* F-009 验收标准 3：热点 TOP 排行。按 rank_by 预存 topN 快照，
     * 看板查询退化为「按 (stats_date, rank_by, rank_no) 主键前缀扫描」，与总量无关。 */
    key: 'statsHot', entity: 'YqStatsHot', table: 'yq_stats_hot', title: '热点排行',
    pk: 'hotId', pkColumn: 'hot_id', pkComment: '主键',
    perm: 'yuqing:dashboard', basePath: '/yuqing/statsHot',
    doris: true, ctrl: false, pcPage: false, logicDelete: null, audit: false,
    dorisKey: ['stats_date', 'rank_by', 'rank_no'],
    fields: [
      DT('statsDate', 'stats_date', '统计日期', { required: true }),
      S('rankBy', 'rank_by', '排序口径', { sqlType: 'VARCHAR(20)', required: true }),
      I('rankNo', 'rank_no', '名次', { required: true }),
      /* 同 statsDim：主键由生成器补，不在 fields 里重复声明 */
      L('opinionId', 'opinion_id', '舆情ID'),
      L('taskId', 'task_id', '任务ID（0=未归属）'),
      L('channelId', 'channel_id', '渠道ID（0=未归属）'),
      S('title', 'title', '舆情标题', { sqlType: 'VARCHAR(500)' }),
      S('channelName', 'channel_name', '渠道名称', { sqlType: 'VARCHAR(50)' }),
      S('opinionUrl', 'opinion_url', '原文链接', { sqlType: 'VARCHAR(1000)' }),
      D('publishTime', 'publish_time', '发布时间'),
      S('sentiAttr', 'senti_attr', '舆情属性', { sqlType: 'VARCHAR(20)' }),
      S('riskLevel', 'risk_level', '风险等级', { sqlType: 'VARCHAR(20)' }),
      L('readCount', 'read_count', '阅读量'),
      L('commentCount', 'comment_count', '评论量'),
      L('shareCount', 'share_count', '转发量'),
      L('likeCount', 'like_count', '点赞量'),
      I('heatScore', 'heat_score', '综合热度分值'),
      D('createTime', 'create_time', '聚合时间'),
    ],
    virtual: [],
  },
];


/* ============================================================
 * 2. 工具函数
 * ============================================================ */
const ALL_TABLES = [...TABLES, ...TABLES_2, ...TABLES_DORIS];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const getter = (n) => 'get' + cap(n);
const toSnake = (n) => n.replace(/([A-Z])/g, '_$1').toLowerCase();
const tsType = (jt) => ({
  String: 'string', Long: 'string', Integer: 'number', BigDecimal: 'number',
  LocalDateTime: 'string', LocalDate: 'string',
}[jt] || 'string');

/** 只取持久化字段 */
const pFields = (t) => t.fields.filter(f => !f.virtual && !f.hidden);
/** 持久化字段 + 关联（@TableField(exist=false)）字段 */
const allFields = (t) => [...t.fields, ...(t.virtual || [])];
/** 是否为 Apache Doris 表（只读、独立 DDL、独立数据源） */
const isDoris = (t) => t.doris === true;

/* ---------- 关联下拉（foreign）----------
 * foreign 指向另一张表的 key；这里声明「用它哪个字段做显示文本」。
 * 未登记的 key（如 'user'）无法生成可用下拉 —— 退化成普通输入框。
 * ⚠️ 只生成 el-select 而不加载选项 = 下拉永远是空的，必须避免。
 */
const FOREIGN_LABEL = {
  task: 'taskName',
  keywordGroup: 'groupName',
  keyword: 'keywordText',
  channel: 'channelName',
  levelRule: 'ruleName',
  alertRule: 'ruleName',
  pushRule: 'ruleName',
  pushTemplate: 'templateName',
  reportTemplate: 'templateName',
  knowledge: 'caseTitle',
  modelVersion: 'versionName',
  tag: 'tagName',
};

/** 解析 foreign 目标；返回 null 表示无法生成可用下拉 */
function foreignTarget(key) {
  const t = ALL_TABLES.find(x => x.key === key);
  const label = FOREIGN_LABEL[key];
  if (!t || !label) return null;
  return { key, entity: t.entity, api: `optionselect${t.entity}`, module: t.key, label, value: t.pk };
}
/** 该字段是否应渲染成「有关联数据的下拉框」 */
const isForeignSelect = (f) => !!(f.foreign && foreignTarget(f.foreign));

/* ---------- 主子表（master-detail）----------
 * 主表声明 detail（单个）或 details（多个）后：
 *   - 后端 ServiceImpl 负责多张明细的查询 / 覆盖式保存 / 级联删除
 *   - PC 端主表弹窗内嵌对应的明细编辑表格
 * 典型：监测任务(yq_task) -> 关键词关联 + 渠道关联；报告模板 -> 模板章节
 */
function detailTargetOf(t, d) {
  const sub = ALL_TABLES.find(x => x.key === d.key);
  if (!sub) return null;
  return {
    ...d, sub, entity: sub.entity, title: sub.title,
    /** 明细表格要渲染的持久化字段（去掉外键） */
    fields: pFields(sub).filter(f => f.name !== d.foreignField),
    keyFields: [...new Set(pFields(sub).filter(f => f.dict).map(f => f.dict))],
  };
}
function detailTargets(t) {
  const raw = [];
  if (t.detail) raw.push(t.detail);
  if (t.details) raw.push(...t.details);
  if (!raw.length) return [];
  return raw.map(d => detailTargetOf(t, d)).filter(Boolean);
}

/** 列表/标签展示用的属性名：外键字段优先用后端回填的名称列 */
const fieldProp = (f) => f.refName || f.name;
/** 展示用的中文标签：外键字段去掉多余的 "ID" 后缀 */
const fieldLabel = (f) => (f.refName ? f.comment.replace(/ID/, '') : f.comment);

/** 主键并非写在 fields 里，这里合成一个描述对象（照 PRD §5.2 数据字典） */
const pkField = (t) => ({
  name: t.pk, column: t.pkColumn, javaType: 'Long', sqlType: 'BIGINT',
  comment: t.pkComment || `${t.title}ID,主键`, required: true,
});

/* ============================================================
 * 3. 实体 Domain
 * ============================================================ */
function genDomain(t) {
  const needBigDecimal = allFields(t).some(f => f.javaType === 'BigDecimal');
  const needDate = allFields(t).some(f => f.javaType === 'LocalDate');
  const hasList = (t.virtual || []).some(v => String(v.javaType).startsWith('List<'));

  const decls = [];
  for (const f of allFields(t)) {
    if (f.name === t.pk) continue;
    const annos = [];
    if (f.virtual) {
      annos.push('    @TableField(exist = false)');
      if (f.excel) annos.push(`    @ExcelProperty(value = "${f.comment}")`);
    } else if (f.name === t.logicDelete) {
      annos.push('    @TableLogic');
    } else if (f.excel) {
      annos.push(`    @ExcelProperty(value = "${f.comment}")`);
    }
    // Javadoc 必须在注解之前（Java 规范）
    decls.push([`    /** ${f.comment} */`, ...annos, `    private ${f.javaType} ${f.name};`].join('\n'));
  }

  // 请求参数容器：v6 的 BaseEntity 没有 params 字段（已核对 BaseEntity.java），
  // 需要范围查询（beginTime/endTime）的实体必须自己声明。
  if (t.queryParams) {
    decls.push([
      '    /**',
      '     * 扩展请求参数（beginTime / endTime 等），不映射数据库字段',
      '     */',
      '    @TableField(exist = false)',
      '    private Map<String, Object> params = new HashMap<>();',
    ].join('\n'));
  }

  const imports = [
    'import com.baomidou.mybatisplus.annotation.TableId;',
    'import com.baomidou.mybatisplus.annotation.TableName;',
  ];
  if (t.logicDelete) imports.push('import com.baomidou.mybatisplus.annotation.TableLogic;');
  if (allFields(t).some(f => f.virtual) || t.queryParams) imports.push('import com.baomidou.mybatisplus.annotation.TableField;');
  imports.push('import lombok.Data;');
  const audited = t.audit !== false;
  if (audited) {
    imports.push('import lombok.EqualsAndHashCode;');
    imports.push('import org.dromara.common.mybatis.core.domain.BaseEntity;');
  } else {
    imports.push('import java.io.Serializable;');
  }
  imports.push(
    'import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;',
    'import org.apache.fesod.sheet.annotation.ExcelProperty;',
  );
  if (needBigDecimal) imports.push('import java.math.BigDecimal;');
  imports.push('import java.time.LocalDateTime;');
  if (needDate) imports.push('import java.time.LocalDate;');
  if (t.queryParams) imports.push('import java.util.HashMap;', 'import java.util.Map;');
  if (hasList) imports.push('import java.util.List;');
  imports.push('import java.io.Serial;');

  const pk = pkField(t);
  // 审计表继承 BaseEntity；非审计表（表内没有 create_dept/create_by/update_by/update_time 列，
  // 典型如 Doris 事实表与统计预聚合）若继承 BaseEntity，MyBatis-Plus 会拼出不存在的列
  // → 运行期 Unknown column 'create_dept'。故按 v6 惯例 implements Serializable。
  const extendsClause = audited ? ' extends BaseEntity' : ' implements Serializable';
  const eqAnno = audited ? '@EqualsAndHashCode(callSuper = true)\n' : '';
  const dsComment = isDoris(t)
    ? ` *\n * <p>⚠ 本表存储于 <b>Apache Doris</b>，业务侧只读（禁止 INSERT/UPDATE/DELETE），\n * 写入由采集/研判 Worker 经 Stream Load 完成，详见《技术架构说明》§4.6。</p>\n *`
    : '';

  return `package ${PACKAGE}.domain;

${imports.join('\n')}

/**
 * ${t.title}对象 ${t.table}${dsComment}
 *
 * @author ruoyi
 */
@Data
${eqAnno}@TableName("${t.table}")
@ExcelIgnoreUnannotated
public class ${t.entity}${extendsClause} {

    @Serial
    private static final long serialVersionUID = 1L;

    /** ${pk.comment} */
    @TableId(value = "${t.pkColumn}")
    private Long ${t.pk};

${decls.join('\n\n')}
}
`;
}

/* ============================================================
 * 4. Mapper
 * ============================================================ */
function genMapper(t) {
  const dsAnno = isDoris(t)
    ? [
      '',
      '/**',
      ' * ⚠ 本表位于 Apache Doris 数据源，查询经 @DS("doris") 路由。',
      ' * 未接入 Doris 前如需本地跑通，请把 yq_datasource.yml 里的 doris 源指向主库，',
      ' * 或在 ServiceImpl 上临时改为 @DS("master")。',
      ' */',
    ].join('\n')
    : '';
  return `package ${PACKAGE}.mapper;

import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import ${PACKAGE}.domain.${t.entity};
${dsAnno}
/**
 * ${t.title}Mapper接口
 *
 * @author ruoyi
 */
public interface ${t.entity}Mapper extends BaseMapperPlus<${t.entity}, ${t.entity}> {
}
`;
}

/* ============================================================
 * 5. Service 接口
 * ============================================================ */
function genService(t) {
  const E = t.entity;
  const ro = isDoris(t) ? `

    /**
     * ⚠ ${t.title}位于 Apache Doris，本接口只提供只读查询；
     * 写入由采集/研判 Worker 经 Stream Load 完成（见《技术架构说明》§4.6）。
     */` : '';
  return `package ${PACKAGE}.service;

import ${PACKAGE}.domain.${E};
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * ${t.title}Service接口
 *
 * @author ruoyi
 */
public interface I${E}Service {${ro}

    /**
     * 分页查询${t.title}列表
     */
    PageResult<${E}> queryPageList(${E} bo, PageQuery pageQuery);

    /**
     * 查询${t.title}列表（不分页）
     */
    List<${E}> queryList(${E} bo);

    /**
     * 查询${t.title}详情
     */
    ${E} queryById(Long ${t.pk});
${isDoris(t) ? '' : `
    /**
     * 新增${t.title}
     */
    Boolean insertByBo(${E} bo);

    /**
     * 修改${t.title}
     */
    Boolean updateByBo(${E} bo);

    /**
     * 批量删除${t.title}
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);`}
}
`;
}

/* ============================================================
 * 6. ServiceImpl（含主子表与关联名称回填）
 * ============================================================ */
function genServiceImpl(t) {
  const E = t.entity;
  const varName = 'baseMapper';
  const doris = isDoris(t);

  const filterFields = pFields(t).filter(f => tfIsFilterable(f)).slice(0, 6);

  const likeClauses = filterFields.filter(f => f.javaType === 'String' && !f.dict)
    .map(f => `        lqw.like(StringUtils.isNotBlank(bo.${getter(f.name)}()), ${E}::${getter(f.name)}, bo.${getter(f.name)}());`);
  const eqClauses = filterFields.filter(f => f.javaType !== 'String' || f.dict)
    .map(f => `        lqw.eq(ObjectUtil.isNotNull(bo.${getter(f.name)}()), ${E}::${getter(f.name)}, bo.${getter(f.name)}());`);
  const orderClause = `        lqw.orderByDesc(${E}::${getter(t.pk)});`;
  const conds = [...likeClauses, ...eqClauses, orderClause].join('\n');
  const needObjectUtil = eqClauses.length > 0;

  // --- 主子表（可能多张明细）---
  const dts = detailTargets(t);

  // --- 关联名称回填 ---
  // ⚠️ Doris 表不做跨库回填：dynamic-datasource 的 @DS 是调用栈级的，
  //    在 @DS("doris") 的 Service 里回调 MySQL 的 mapper 会被一并路由到 Doris。
  //    按 PRD §6.3「跨库先查 Doris 明细再回表 MySQL 补字段」，名称回填放在
  //    master 数据源的 ExtService / 应用层批量补，故这里留 TODO 不生成。
  const refFields = isDoris(t) ? [] : pFields(t).filter(f => f.refName);
  const dorisRefTodo = isDoris(t) && pFields(t).some(f => f.refName)
    ? `\n    // TODO 关联名称回填：本表在 Doris，按 PRD §6.3 需由 master 数据源的 ExtService 批量补\n    //      ${pFields(t).filter(f => f.refName).map(f => `${f.name} -> ${f.refName}`).join('、')}\n`
    : '';
  const refTargets = [...new Map(refFields.map(f => [f.foreign, foreignTarget(f.foreign)])).values()];
  const extTargets = refTargets.filter(x => x.key !== t.key);
  const refImports = extTargets.length
    ? extTargets.flatMap(x => [
      `import ${PACKAGE}.domain.${x.entity};`,
      `import ${PACKAGE}.mapper.${x.entity}Mapper;`,
    ]).join('\n') + '\n'
    : '';
  const refMappers = extTargets.map(x => `\n    private final ${x.entity}Mapper ${x.key}Mapper;`).join('');

  const refFillBlocks = refFields.map(f => {
    const target = foreignTarget(f.foreign);
    const mapper = target.key === t.key ? varName : `${target.key}Mapper`;
    const setName = `set${cap(f.refName)}`;
    const asserter = f.refZeroLabel
      ? `            list.forEach(e -> {
                Long refId = e.${getter(f.name)}();
                e.${setName}(refId != null && refId == 0L ? "${f.refZeroLabel}" : ${f.name}NameMap.get(refId));
            });`
      : `            list.forEach(e -> e.${setName}(${f.name}NameMap.get(e.${getter(f.name)}())));`;
    return `        Set<Long> ${f.name}Set = list.stream().map(${E}::${getter(f.name)}).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!${f.name}Set.isEmpty()) {
            Map<Long, String> ${f.name}NameMap = ${mapper}.selectByIds(${f.name}Set).stream()
                .collect(Collectors.toMap(${target.entity}::${getter(target.value)}, ${target.entity}::${getter(target.label)}, (a, b) -> a));
${asserter}
        }`;
  }).join('\n');

  const refMethod = refFields.length
    ? `
    /**
     * 回填关联名称（列表只返回 ID 会导致前端「所属XX」列空白）
     */
    private void fillRefNames(List<${E}> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
${refFillBlocks}
    }
`
    : '';

  /* ---------- 主子表：写入 / 删除 / 明细私有方法 ---------- */
  const saveCalls = dts.map(d => `            save${cap(d.listField)}(bo);`).join('\n');
  const clearAndSave = dts.map(d => `            // ${d.title}整体覆盖：先清后插，否则前端删掉的行会残留在库里
            ${d.key}Mapper.delete(new LambdaQueryWrapper<${d.entity}>()
                .eq(${d.entity}::${getter(d.foreignField)}, bo.${getter(t.pk)}()));
            save${cap(d.listField)}(bo);`).join('\n');
  const cascadeDeletes = dts.map(d => `            ${d.key}Mapper.delete(new LambdaQueryWrapper<${d.entity}>()
                .in(${d.entity}::${getter(d.foreignField)}, ids));`).join('\n');

  const insertBody = dts.length
    ? `        boolean flag = ${varName}.insert(bo) > 0;
        if (flag) {
${saveCalls}
        }
        return flag;`
    : `        return ${varName}.insert(bo) > 0;`;

  const updateBody = dts.length
    ? `        boolean flag = ${varName}.updateById(bo) > 0;
        if (flag) {
${clearAndSave}
        }
        return flag;`
    : `        return ${varName}.updateById(bo) > 0;`;

  const deleteBody = dts.length
    ? `        boolean flag = ${varName}.deleteByIds(ids) > 0;
        if (flag) {
${cascadeDeletes}
        }
        return flag;`
    : `        return ${varName}.deleteByIds(ids) > 0;`;

  const dtMethods = dts.map(d => {
    const hasOrder = d.fields.some(f => f.name === 'orderNum');
    return `
    /**
     * 批量回填「${d.title}」（一次 in 查询，避免 N+1）
     */
    private void fill${cap(d.listField)}(List<${E}> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        List<Long> ids = list.stream().map(${E}::${getter(t.pk)}).filter(Objects::nonNull).toList();
        if (ids.isEmpty()) {
            return;
        }
        Map<Long, List<${d.entity}>> detailMap = ${d.key}Mapper.selectList(new LambdaQueryWrapper<${d.entity}>()
            .in(${d.entity}::${getter(d.foreignField)}, ids)${hasOrder ? `
            .orderByAsc(${d.entity}::getOrderNum)` : ''})
            .stream().collect(Collectors.groupingBy(${d.entity}::${getter(d.foreignField)}));
        list.forEach(e -> e.set${cap(d.listField)}(detailMap.getOrDefault(e.${getter(t.pk)}(), List.of())));
    }

    /**
     * 查询「${d.title}」明细
     */
    private List<${d.entity}> select${cap(d.listField)}(Long ${t.pk}) {
        return ${d.key}Mapper.selectList(new LambdaQueryWrapper<${d.entity}>()
            .eq(${d.entity}::${getter(d.foreignField)}, ${t.pk})${hasOrder ? `
            .orderByAsc(${d.entity}::getOrderNum)` : ''});
    }

    /**
     * 保存「${d.title}」明细（覆盖式写入）
     */
    private void save${cap(d.listField)}(${E} bo) {
        List<${d.entity}> detailList = bo.${getter(d.listField)}();
        if (detailList == null || detailList.isEmpty()) {
            return;
        }
        int order = 0;
        for (${d.entity} d : detailList) {
            // 主键置空：交给雪花 ID 重新分配，避免前端「删掉再新增」的行按旧主键插入而冲突
            d.set${cap(d.sub.pk)}(null);
            d.set${cap(d.foreignField)}(bo.${getter(t.pk)}());${hasOrder ? `
            if (d.getOrderNum() == null) {
                d.setOrderNum(order);
            }` : ''}
            order++;
            ${d.key}Mapper.insert(d);
        }
    }
`;
  }).join('');

  const needCollections = refFields.length > 0 || dts.length > 0;
  const streamImports = refFields.length
    ? '\nimport java.util.Map;\nimport java.util.Objects;\nimport java.util.Set;\nimport java.util.stream.Collectors;'
    : (dts.length ? '\nimport java.util.Map;\nimport java.util.Objects;\nimport java.util.stream.Collectors;' : '');

  const pageListBody = needCollections
    ? [
      `        List<${E}> records = page.getRecords();`,
      ...(refFields.length ? ['        fillRefNames(records);'] : []),
      ...dts.map(d => `        fill${cap(d.listField)}(records);`),
      '        return PageResult.build(records, page.getTotal());',
    ].join('\n')
    : `        return PageResult.build(page.getRecords(), page.getTotal());`;

  const byIdBody = (refFields.length || dts.length)
    ? `        ${E} e = ${varName}.selectById(${t.pk});
        if (e != null) {${refFields.length ? `
            fillRefNames(List.of(e));` : ''}${dts.map(d => `
            e.set${cap(d.listField)}(select${cap(d.listField)}(${t.pk}));`).join('')}
        }
        return e;`
    : `        return ${varName}.selectById(${t.pk});`;

  const dtEntities = dts.map(d => `\nimport ${PACKAGE}.domain.${d.entity};\nimport ${PACKAGE}.mapper.${d.entity}Mapper;`).join('');
  // ⚠️ 类型名必须用实体名（YqTaskKeywordMapper），变量名才用 key（taskKeywordMapper）；
  //    两者混用会生成 `private final taskKeywordMapper taskKeywordMapper;` 直接编译失败。
  const dtMappers = dts.map(d => `\n    private final ${d.entity}Mapper ${d.key}Mapper;`).join('');
  const txAnno = (dts.length && !doris) ? '\n    @Transactional(rollbackFor = Exception.class)' : '';
  const dsAnno = doris
    ? `\n/**\n * ⚠ ${t.title}位于 Apache Doris 数据源（PRD §6.3 数据源路由约定）。\n * 只读；如需本地无 Doris 环境跑通，先把 @DS("doris") 改为 @DS("master") 或按\n * yq_datasource.yml 给出的从库配置接入。\n */\n@DS("doris")`
    : '';
  const writeMethods = doris ? '' : `
    @Override${txAnno}
    public Boolean insertByBo(${E} bo) {
${insertBody}
    }

    @Override${txAnno}
    public Boolean updateByBo(${E} bo) {
${updateBody}
    }

    @Override${txAnno}
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        if (Boolean.TRUE.equals(isValid)) {
            // TODO: 删除前业务校验（存在关联数据时应拒绝删除）
        }
${deleteBody}
    }`;

  return `package ${PACKAGE}.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;${doris ? '\nimport com.baomidou.dynamic.datasource.annotation.DS;' : ''}
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;${needObjectUtil ? '\nimport cn.hutool.core.util.ObjectUtil;' : ''}
import org.dromara.common.mybatis.core.page.PageQuery;
import ${PACKAGE}.domain.${E};${dtEntities}
import ${PACKAGE}.mapper.${E}Mapper;
import ${PACKAGE}.service.I${E}Service;
import org.springframework.stereotype.Service;${(dts.length && !doris) ? '\nimport org.springframework.transaction.annotation.Transactional;' : ''}
${refImports}import java.util.Collection;
import java.util.List;${streamImports}

/**
 * ${t.title} Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor${dsAnno}
public class ${E}ServiceImpl implements I${E}Service {

    private final ${E}Mapper ${varName};${refMappers}${dtMappers}${dorisRefTodo}

    @Override
    public PageResult<${E}> queryPageList(${E} bo, PageQuery pageQuery) {
        LambdaQueryWrapper<${E}> lqw = buildQueryWrapper(bo);
        Page<${E}> page = ${varName}.selectPage(pageQuery.build(), lqw);
${pageListBody}
    }

    @Override
    public List<${E}> queryList(${E} bo) {
        return ${varName}.selectList(buildQueryWrapper(bo));
    }

    @Override
    public ${E} queryById(Long ${t.pk}) {
${byIdBody}
    }
${writeMethods}${dtMethods}${refMethod}
    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<${E}> buildQueryWrapper(${E} bo) {
        LambdaQueryWrapper<${E}> lqw = new LambdaQueryWrapper<>();
${conds}
        return lqw;
    }
}
`;
}

/** 是否适合作为查询条件 */
function tfIsFilterable(f) {
  if (f.virtual || f.hidden) return false;
  if (f.name === 'delFlag') return false;
  if (['remark', 'content', 'originData', 'analyzeResult', 'bodyTemplate',
    'processRecord', 'manualCorrection', 'riskFeature', 'keywordFeature',
    'opinionUrl', 'fileUrl', 'commandText'].includes(f.name)) return false;
  return /^(String|Long|Integer|LocalDate|LocalDateTime)$/.test(f.javaType);
}

/* ============================================================
 * 7. Controller（通用 CRUD，仅 ctrl=true 且非 Doris 的模块）
 * ============================================================ */
function genController(t) {
  const E = t.entity;
  const perm = t.perm;
  const varName = t.key + 'Service';
  const iface = `I${E}Service`;

  return `package ${PACKAGE}.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.domain.R;
import org.dromara.common.excel.utils.ExcelBuilder;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.web.core.BaseController;
import ${PACKAGE}.domain.${E};
import ${PACKAGE}.service.${iface};
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * ${t.title}Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("${t.basePath}")
public class ${E}Controller extends BaseController {

    private final ${iface} ${varName};

    /**
     * 查询${t.title}列表
     */
    @SaCheckPermission("${perm}:list")
    @GetMapping("/list")
    public R<PageResult<${E}>> list(${E} bo, PageQuery pageQuery) {
        return R.ok(${varName}.queryPageList(bo, pageQuery));
    }

    /**
     * 导出${t.title}列表
     */
    @SaCheckPermission("${perm}:export")
    @Log(title = "${t.title}", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(${E} bo, HttpServletResponse response) {
        List<${E}> list = ${varName}.queryList(bo);
        ExcelBuilder.of(list, ${E}.class).sheetName("${t.title}").toResponse(response);
    }

    /**
     * 查询${t.title}下拉选项（PRD §4.5；必须声明在 /{${t.pk}} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("${perm}:list")
    @GetMapping("/optionselect")
    public R<List<${E}>> optionselect(${E} bo) {
        return R.ok(${varName}.queryList(bo));
    }

    /**
     * 获取${t.title}详细信息
     */
    @SaCheckPermission("${perm}:query")
    @GetMapping("/{${t.pk}}")
    public R<${E}> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long ${t.pk}) {
        return R.ok(${varName}.queryById(${t.pk}));
    }

    /**
     * 新增${t.title}
     */
    @SaCheckPermission("${perm}:add")
    @Log(title = "${t.title}", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody ${E} bo) {
        return toAjax(${varName}.insertByBo(bo));
    }

    /**
     * 修改${t.title}
     */
    @SaCheckPermission("${perm}:edit")
    @Log(title = "${t.title}", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody ${E} bo) {
        return toAjax(${varName}.updateByBo(bo));
    }

    /**
     * 删除${t.title}
     */
    @SaCheckPermission("${perm}:remove")
    @Log(title = "${t.title}", businessType = BusinessType.DELETE)
    @DeleteMapping("/{${t.pk}s}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] ${t.pk}s) {
        return toAjax(${varName}.deleteWithValidByIds(List.of(${t.pk}s), true));
    }
}
`;
}

/* ============================================================
 * 8. 建表 SQL（MySQL · PRD §5.2 + BaseEntity 审计字段）
 * ============================================================ */
function genSql(t) {
  const lines = [];
  for (const f of allFields(t)) {
    if (f.virtual || f.name === t.pk) continue;
    if (f.name === t.logicDelete && f.hidden) { /* 仍要建列 */ }
    const notNull = f.required ? ' NOT NULL' : '';
    // ⚠️ 不能写成 NOT NULL DEFAULT NULL —— MySQL 严格模式报 1067 Invalid default value。
    const def = f.default != null
      ? ` DEFAULT '${f.default}'`
      : (f.required ? '' : ' DEFAULT NULL');
    lines.push(`  ${f.column.padEnd(20)} ${f.sqlType.padEnd(14)}${notNull}${def} COMMENT '${f.comment.replace(/'/g, "''")}'`);
  }
  const audit = t.audit !== false
    ? [
      `  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门'`,
      `  create_by        BIGINT         DEFAULT NULL COMMENT '创建者'`,
      `  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间'`,
      `  update_by        BIGINT         DEFAULT NULL COMMENT '更新者'`,
      `  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间'`,
    ]
    : [];

  const cols = [`  ${t.pkColumn.padEnd(20)} BIGINT         NOT NULL COMMENT '${pkField(t).comment}'`, ...lines, ...audit];

  return `-- ============================================================
-- ${t.title}表 ${t.table}
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   ${t.audit !== false ? '继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;' : '不继承 BaseEntity（表内无完整审计列）;'}
--                   ${t.logicDelete ? 'del_flag 逻辑删除(0存在 2删除)' : '无逻辑删除'}
-- ============================================================
DROP TABLE IF EXISTS ${t.table};
CREATE TABLE ${t.table} (
${cols.join(',\n')},
  PRIMARY KEY (${t.pkColumn})${genIndexes(t)}
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='${t.title}';
`;
}

/** 索引：仅引用表内已定义的列，避免 MySQL 1072 Key column doesn't exist */
function genIndexes(t) {
  const cols = new Set(allFields(t).filter(f => !f.virtual).map(f => f.column));
  /* ⚠️ 审计列（create_dept/create_by/create_time/update_by/update_time）由 genTable 的
   *    audit 分支在【主键 + fields 之后】追加，因此不在 t.fields 里。早期版本此处漏加，
   *    导致下面「列存在性」守卫把引用 create_by / create_time 的索引【静默丢弃】——
   *    现象是 DDL 与线上表都没有这条索引，却没有任何报错（校验器只查 SQL 文件，
   *    文件里没写自然查不出来）。已由此修复三处：
   *      yq_push_record.idx_yq_pushrec_status(send_status, create_time)     F-011
   *      yq_wecom_command.idx_yq_cmd_status(exec_status, create_time)       F-012
   *      yq_ledger_export_log.idx_yq_lexp_owner(create_by, create_time)     F-016
   *    现在同时把「被丢弃」改成显式告警，避免同类问题再次静默发生。 */
  if (t.audit !== false) {
    ['create_dept', 'create_by', 'create_time', 'update_by', 'update_time'].forEach((c) => cols.add(c));
  }
  const idx = [];
  const dropped = [];
  const push = (s) => {
    const refs = [...s.matchAll(/\(([^()]+)\)/g)].flatMap(m => m[1].split(',').map(x => x.trim()));
    if (refs.every(c => cols.has(c))) {
      idx.push(s);
    } else {
      dropped.push(`${s.trim()}  ->  未定义列: ${refs.filter(c => !cols.has(c)).join(', ')}`);
    }
  };
  const MAP = {
    task: [`  UNIQUE KEY uk_yq_task_name (task_name)`, `  KEY idx_yq_task_status (status, start_time)`, `  KEY idx_yq_task_rule (level_rule_id)`],
    keywordGroup: [`  UNIQUE KEY uk_yq_kwgroup_name (group_name)`],
    keyword: [`  KEY idx_yq_kw_group (group_id)`, `  KEY idx_yq_kw_text (keyword_text)`, `  KEY idx_yq_kw_cat (keyword_category)`],
    taskKeyword: [`  KEY idx_yq_tk_task (task_id)`, `  KEY idx_yq_tk_kw (keyword_id)`],
    taskChannel: [`  KEY idx_yq_tc_task (task_id)`, `  KEY idx_yq_tc_channel (channel_id)`],
    channel: [`  UNIQUE KEY uk_yq_channel_name (channel_name)`, `  KEY idx_yq_channel_cat (channel_category)`],
    noiseRule: [`  UNIQUE KEY uk_yq_noise_name (rule_name)`, `  KEY idx_yq_noise_cat (noise_category, priority)`],
    levelRule: [`  UNIQUE KEY uk_yq_level_name (rule_name)`, `  KEY idx_yq_level_default (is_default)`],
    tag: [`  UNIQUE KEY uk_yq_tag_name (tag_name)`, `  KEY idx_yq_tag_parent (parent_id)`],
    alertRule: [`  UNIQUE KEY uk_yq_alertrule_name (rule_name)`],
    alert: [`  KEY idx_yq_alert_status (status, trigger_time)`, `  KEY idx_yq_alert_opinion (opinion_id)`, `  KEY idx_yq_alert_cluster (cluster_id)`],
    pushRule: [`  UNIQUE KEY uk_yq_pushrule_name (rule_name)`],
    pushTemplate: [`  UNIQUE KEY uk_yq_pushtpl_name (template_name)`],
    pushRecord: [`  KEY idx_yq_pushrec_status (send_status, create_time)`, `  KEY idx_yq_pushrec_scene (push_scene)`],
    wecomCommand: [`  KEY idx_yq_cmd_status (exec_status, create_time)`, `  KEY idx_yq_cmd_user (user_id)`],
    reportTemplate: [`  UNIQUE KEY uk_yq_rpttpl_name (template_name)`, `  KEY idx_yq_rpttpl_type (report_type, is_default)`],
    reportSection: [`  KEY idx_yq_rptsec_tpl (template_id, order_num)`],
    report: [`  KEY idx_yq_report_type (report_type, report_date)`, `  KEY idx_yq_report_status (status)`, `  KEY idx_yq_report_submit (submit_status)`],
    reportOpinion: [`  KEY idx_yq_rptop_report (report_id)`, `  KEY idx_yq_rptop_opinion (opinion_id)`],
    knowledge: [`  KEY idx_yq_know_type (case_type, status)`, `  KEY idx_yq_know_scene (scene_category)`],
    trainSample: [`  KEY idx_yq_sample_status (sample_status)`, `  KEY idx_yq_sample_model (model_version_id)`],
    modelVersion: [`  UNIQUE KEY uk_yq_modelver_name (version_name)`, `  KEY idx_yq_modelver_active (is_active)`],
    /* F-016 台账导出记录：审计列表按 (create_by, create_time) 过滤 + 倒序；
     * 非全量角色只能看自己的记录，因此 create_by 必须在前导位置。
     * status 索引供运维捞「卡在 pending/running」的任务做人工补偿。 */
    ledgerExportLog: [`  KEY idx_yq_lexp_owner (create_by, create_time)`, `  KEY idx_yq_lexp_status (status)`],
  };
  (MAP[t.key] || []).forEach(push);
  if (dropped.length) {
    console.warn(`  ⚠ ${t.table} 丢弃 ${dropped.length} 条索引（引用了表内不存在的列）：`);
    dropped.forEach((d) => console.warn(`      ${d}`));
  }
  return idx.length ? ',\n' + idx.join(',\n') : '';
}

/* ============================================================
 * 8.2 Doris 建表脚本（PRD §5.5）
 * ============================================================ */
function genDorisSql(t) {
  /* 键列：优先用表上声明的 dorisKey（F-009 预聚合表用它把「业务主键」作为 Unique Key，
   * 这样重复聚合同一天只会覆盖同名次/同粒度行，天然幂等，不需要先 DELETE）。 */
  const keyCols = t.dorisKey || (t.key === 'opinion'
    ? ['collect_date', 'url_hash']
    : [pkColumnOf(t)]);
  // ⚠️ 踩坑记录：主键列只写在 t.pkColumn 上、不在 t.fields 里，
  //    早期版本直接用 allFields 渲染列清单 → UNIQUE KEY 引用了不存在的列，Doris 建表直接报错。
  //    这里显式把主键列补进 schema。
  const pkField = {
    column: pkColumnOf(t),
    sqlType: 'BIGINT',
    required: true,
    comment: t.pkComment || '主键',
  };
  const render = (f) => {
    const notNull = f.required ? ' NOT NULL' : ' NULL    ';
    const t2 = f.sqlType === 'TEXT' ? 'STRING' : f.sqlType;
    return `    \`${f.column}\`${' '.repeat(Math.max(1, 16 - f.column.length))}${t2.padEnd(14)}${notNull}  COMMENT '${String(f.comment || '').replace(/'/g, "''")}'`;
  };
  const pool0 = [pkField, ...allFields(t).filter(f => !f.virtual)];
  // ⚠️ 踩坑记录（F-009）：如果某张表的 t.fields 里**也**声明了主键列（例如 statsDim 为了让
  //    键列顺序可控而把 dim_id 写进了 fields），上面的数组就会同时含「补的主键列」和
  //    「fields 里的同名列」，渲染出两行同名 `dim_id` —— Doris 建表直接报 duplicate column。
  //    这里按列名去重，且保留先出现的（补的主键列，comment/required 口径统一）。
  const seenCols = new Set();
  const pool = pool0.filter(f => (seenCols.has(f.column) ? false : (seenCols.add(f.column), true)));
  const lines = [];
  keyCols.forEach(c => {
    const f = pool.find(x => x.column === c);
    if (f) lines.push(render(f));
  });
  pool.filter(f => !keyCols.includes(f.column)).forEach(f => lines.push(render(f)));
  // Doris 动态分区列（键列已保证置首，无需再排序）
  const partitionCol = t.key === 'opinion' ? 'collect_date' : null;

  const inverted = t.key === 'opinion'
    ? `,\n    INDEX idx_title (\`title\`) USING INVERTED PROPERTIES("parser" = "chinese") COMMENT '标题中文倒排',\n    INDEX idx_content (\`content\`) USING INVERTED PROPERTIES("parser" = "chinese") COMMENT '正文中文倒排'`
    : '';
  const partition = partitionCol
    ? `\nPARTITION BY RANGE(\`${partitionCol}\`) ()`
    : '';
  const bucket = t.key === 'opinion' ? 'url_hash' : pkColumnOf(t);
  const modelNote = t.key === 'opinion'
    ? 'Unique Key(collect_date, url_hash) + Merge-on-Write，天然承接全流程链接去重'
    : (t.dorisKey
      ? 'Unique Key(' + t.dorisKey.join(', ') + ') + Merge-on-Write，同键重复写入即覆盖（聚合任务重跑幂等）'
      : '详见 PRD §5.5 表设计通则');
  return `-- ============================================================
-- ${t.title}表 ${t.table}（Apache Doris）
-- 来源: PRD §5.5 Doris 建表约定与写入链路
-- 模型: ${modelNote}
-- 写入: 采集/研判 Worker 经 Stream Load 批量导入（label 幂等）；业务侧只读
-- ============================================================
DROP TABLE IF EXISTS ${t.table};
CREATE TABLE IF NOT EXISTS ${t.table} (
${lines.join(',\n')}${inverted}
)
ENGINE = OLAP
UNIQUE KEY(${keyCols.map(c => '`' + c + '`').join(', ')})
COMMENT '${t.title}'
${partition}
DISTRIBUTED BY HASH(\`${bucket}\`) BUCKETS 16
PROPERTIES (
    "replication_num"                    = "3",
    "enable_unique_key_merge_on_write"   = "true"${partitionCol ? `,
    "dynamic_partition.enable"           = "true",
    "dynamic_partition.time_unit"        = "DAY",
    "dynamic_partition.start"            = "-1095",
    "dynamic_partition.end"              = "3",
    "dynamic_partition.prefix"           = "p",
    "dynamic_partition.replication_num"  = "3"` : ''}
];
`;
}
const pkColumnOf = (t) => t.pkColumn;

/* ============================================================
 * 9. 字典 SQL（PRD §5.3 枚举值编码约定）
 * ============================================================ */
const DICTS = [
  { type: 'yq_task_type', name: '舆情任务类型', data: [['normal', '常态化', 1], ['temporary', '临时', 2], ['special', '专项', 3]] },
  { type: 'yq_task_source', name: '舆情任务来源', data: [['pc', 'PC后台', 1], ['wecom', '企业微信', 2]] },
  { type: 'yq_collect_strategy', name: '舆情采集策略', data: [['polling', '定时轮询', 1], ['incremental', '增量抓取', 2], ['realtime', '实时监听', 3]] },
  { type: 'yq_keyword_type', name: '舆情关键词类型', data: [['precise', '精准', 1], ['fuzzy', '模糊', 2], ['negative', '否定', 3], ['combo', '组合', 4]] },
  { type: 'yq_keyword_category', name: '舆情关键词分类', data: [['core', '核心监测词', 1], ['related', '关联监测词', 2], ['block', '屏蔽词', 3]] },
  { type: 'yq_channel_category', name: '舆情渠道类别', data: [['social', '社交平台', 1], ['news', '新闻媒体', 2], ['forum', '论坛贴吧', 3], ['video', '短视频平台', 4], ['qa', '问答社区', 5], ['blog', '博客专栏', 6], ['epaper', '数字报', 7]] },
  { type: 'yq_collect_source', name: '舆情采集来源', data: [['auto', '自动采集', 1], ['manual_link', '链接导入', 2], ['file_import', '文件导入', 3]] },
  { type: 'yq_clean_status', name: '舆情清洗状态', data: [['raw', '原始', 1], ['cleaned', '已净化', 2], ['rejected', '已剔除', 3]] },
  { type: 'yq_noise_category', name: '舆情降噪类别', data: [['spam', '垃圾内容', 1], ['advertisement', '广告营销', 2], ['flooding', '灌水评论', 3], ['meaningless', '无意义短句', 4], ['bot', '机器人内容', 5], ['blank', '空白内容', 6], ['violation', '违规屏蔽', 7]] },
  { type: 'yq_noise_rule_type', name: '降噪规则类型', data: [['system', '系统内置', 1], ['custom', '自定义', 2]] },
  { type: 'yq_match_type', name: '规则匹配方式', data: [['keyword', '关键词', 1], ['regex', '正则', 2]] },
  { type: 'yq_analyze_status', name: '舆情研判状态', data: [['pending', '待研判', 1], ['processing', '研判中', 2], ['completed', '已完成', 3], ['failed', '已失败', 4]] },
  { type: 'yq_senti_attr', name: '舆情属性', data: [['positive', '正面', 1], ['neutral', '中性', 2], ['negative', '负面', 3]] },
  { type: 'yq_opinion_level', name: '舆情分级', data: [['normal', '一般', 1], ['attention', '关注', 2], ['warning', '预警', 3], ['urgent', '紧急', 4]] },
  { type: 'yq_risk_level', name: '舆情风险等级', data: [['general', '一般', 1], ['moderate', '较重', 2], ['severe', '严重', 3]] },
  { type: 'yq_spread_level', name: '舆情传播量级', data: [['low', '低', 1], ['medium', '中', 2], ['high', '高', 3], ['viral', '爆', 4]] },
  { type: 'yq_alert_scene', name: '预警触发场景', data: [['new_negative', '新增负面', 1], ['high_risk', '高风险', 2], ['burst_increment', '突发增量', 3], ['special_topic', '重点专项', 4]] },
  { type: 'yq_alert_status', name: '预警处置状态', data: [['pending', '未处置', 1], ['processing', '处置中', 2], ['handled', '已处置', 3], ['ignored', '已忽略', 4]] },
  { type: 'yq_alert_level', name: '预警级别', data: [['info', '提示', 1], ['attention', '关注', 2], ['warning', '预警', 3], ['urgent', '紧急', 4]] },
  { type: 'yq_push_scene', name: '推送场景', data: [['new_opinion', '新增舆情', 1], ['high_risk', '高风险舆情', 2], ['batch_completed', '批量研判完成', 3], ['report_ready', '报告生成完成', 4], ['ledger_export_ready', '台账导出完成', 5]] },
  { type: 'yq_push_level', name: '推送级别', data: [['immediate', '即时', 1], ['scheduled', '定时批量', 2]] },
  { type: 'yq_push_content_type', name: '推送内容形式', data: [['summary', '摘要式', 1], ['detail', '明细式', 2]] },
  { type: 'yq_push_target', name: '推送目标类型', data: [['role', '按角色', 1], ['dept', '按部门', 2], ['user', '按指定人', 3]] },
  { type: 'yq_push_status', name: '推送状态', data: [['success', '成功', 1], ['failed', '失败', 2], ['pending', '待发送', 3]] },
  { type: 'yq_report_type', name: '报告类型', data: [['flash', '快报', 1], ['daily', '日报', 2], ['monthly', '月报', 3], ['special', '专项', 4]] },
  { type: 'yq_report_status', name: '报告状态', data: [['generating', '生成中', 1], ['generated', '已生成', 2], ['published', '已提交', 3], ['failed', '生成失败', 4]] },
  { type: 'yq_report_trigger', name: '报告生成方式', data: [['scheduled', '定时', 1], ['manual', '手动', 2], ['wecom', '企业微信', 3]] },
  { type: 'yq_report_submit_status', name: '报告提交状态', data: [['unsubmitted', '未提交', 1], ['submitted', '已提交', 2]] },
  { type: 'yq_report_format', name: '报告文件格式', data: [['docx', 'Word', 1], ['pdf', 'PDF', 2]] },
  { type: 'yq_case_type', name: '知识库案例类型', data: [['key_event', '重点事件', 1], ['publicity', '专项宣传', 2], ['negative_risk', '负面风险', 3], ['hotspot', '突发热点', 4], ['correction', '人工修正', 5], ['error_case', '易错案例', 6], ['industry_scene', '行业场景', 7]] },
  { type: 'yq_sample_status', name: '训练样本状态', data: [['pending', '待标注', 1], ['labeled', '已标注', 2], ['trained', '已训练', 3]] },
  { type: 'yq_model_type', name: '模型类型', data: [['base', '基座', 1], ['finetuned', '微调', 2]] },
  { type: 'yq_tag_source', name: '标签来源', data: [['model', '模型', 1], ['manual', '人工', 2]] },
  { type: 'yq_score_metric', name: '分级评分依据', data: [['heat_score', '热度', 1], ['senti_weight', '情感加权', 2]] },
  { type: 'yq_heading_number_rule', name: '报告标题编号规则', data: [['chinese', '中文（一、二、三）', 1], ['arabic', '阿拉伯数字（1. 2. 3.）', 2], ['none', '不编号', 3]] },
  { type: 'yq_command_type', name: '企业微信指令类型', data: [['gen_report', '生成报告', 1], ['create_task', '发布任务', 2], ['query_opinion', '查询舆情', 3], ['set_rule', '调整规则', 4]] },
  { type: 'yq_exec_status', name: '指令执行状态', data: [['pending', '待执行', 1], ['success', '成功', 2], ['failed', '失败', 3]] },
  { type: 'yq_exec_result', name: '采集执行结果', data: [['success', '成功', 1], ['partial', '部分成功', 2], ['failed', '失败', 3]] },
  { type: 'yq_include_source', name: '报告纳入方式', data: [['auto', '自动纳入', 1], ['manual_add', '人工添加', 2]] },
  /* F-006 净化去重：重跑批次 */
  { type: 'yq_clean_batch_type', name: '净化重跑类型', data: [['incremental', '增量净化', 1], ['condition_replay', '条件重跑', 2], ['full_replay', '全量重跑', 3]] },
  { type: 'yq_clean_batch_status', name: '净化批次状态', data: [['running', '执行中', 1], ['success', '成功', 2], ['failed', '失败', 3]] },
  /* F-009 多维分析：预聚合批次 */
  { type: 'yq_stats_trigger_type', name: '聚合触发方式', data: [['auto', '定时任务', 1], ['manual', '手动重算', 2], ['replay', '补算历史', 3]] },
  { type: 'yq_stats_batch_status', name: '聚合批次状态', data: [['running', '执行中', 1], ['success', '成功', 2], ['failed', '失败', 3]] },
];

// v6 ry_vue.sql 中的审计常量：顶级部门 / admin 用户（写 103 / 1 会让 create_by 落进无意义值）
const V6_DEPT = '1761000000000000103';
const V6_USER = '1761100000000000001';
// 本模块独占的字典 ID 号段（勿与其他模块重叠）
// ⚠ 号段变更史（实测取证，勿再改回）:
//   原用 1770000000000001000/2000 —— 与「机房巡检系统」的 sys_inspect_* 字典【逐号重叠】，
//   INSERT 会因主键 dict_id 重复直接报错（DELETE 按 dict_type 精确匹配，不会误删对方）。
//   现改用 1771400000000001000/2000：保留 1770 前缀、第 9 位取 4，与巡检 1770 段错开，实测 0 占用。
const DICT_TYPE_BASE = 1771400000000001000n;
const DICT_DATA_BASE = 1771400000000002000n;

function genDictSql() {
  const types = DICTS.map(d => `'${d.type}'`).join(', ');
  const out = [
    '-- ============================================================',
    '-- 全自动化舆情监测研判报送平台 数据字典初始化（PRD §5.3 枚举值编码约定）',
    '-- 依赖: sys_dict_type / sys_dict_data（若依 v6 内置）',
    '-- 注意: v6 的这两张表【没有 tenant_id 列】，不要照搬旧版多租户脚本',
    `-- ID 号段: dict_id ${DICT_TYPE_BASE}+1 / dict_code ${DICT_DATA_BASE}+1（每类占 1 / N 个）`,
    `-- 共 ${DICTS.length} 类字典，${DICTS.reduce((a, d) => a + d.data.length, 0)} 条字典项`,
    '-- 本脚本可重复执行（先按 dict_type 清理，再插入）',
    '-- ============================================================',
    '',
    `-- 清理旧数据（按 dict_type 精确匹配本模块的 ${DICTS.length} 个字典）`,
    `DELETE FROM sys_dict_data WHERE dict_type IN (${types});`,
    `DELETE FROM sys_dict_type WHERE dict_type IN (${types});`,
    '',
  ];
  let typeSeq = DICT_TYPE_BASE;
  let dataSeq = DICT_DATA_BASE;
  for (const d of DICTS) {
    out.push(`-- ${d.name}`);
    out.push(`INSERT INTO sys_dict_type (dict_id, dict_name, dict_type, create_dept, create_by, create_time, remark) VALUES (${typeSeq++}, '${d.name}', '${d.type}', ${V6_DEPT}, ${V6_USER}, sysdate(), '舆情监测平台');`);
    for (const [val, label, ord] of d.data) {
      out.push(`INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, create_dept, create_by, create_time, remark) VALUES (${dataSeq++}, ${ord}, '${label}', '${val}', '${d.type}', '', 'default', 'N', ${V6_DEPT}, ${V6_USER}, sysdate(), '舆情监测平台');`);
    }
    out.push('');
  }
  out.push(`-- 执行后自检：应返回 ${DICTS.length}`);
  out.push(`-- SELECT COUNT(*) AS dict_type_total FROM sys_dict_type WHERE dict_type IN (${types});`);
  return out.join('\n');
}

/* ============================================================
 * 10. 菜单 SQL（PRD §7.2 若依 v6 规范，sys_menu 22 列）
 *     按钮 ID = btnBase + 序号，与 PRD §7.2 已评审的 ID 完全一致
 * ============================================================ */
const MENU_ROOT = '1761400000000000900';
const MENU_C_MAX = '1761400000000000913';   // C 菜单号段上界（新增菜单时同步上调）
const MENU_LIMIT = '1761400000000006139';   // 含 F 按钮在内的整体号段上界
const BTN_MIN = '1761400000000006011';      // F 按钮号段下界
const MENUS = [
  { id: '1761400000000000900', name: '舆情监测', path: 'yuqing', comp: null, type: 'M', icon: 'monitor', perm: '', parent: '0', order: 7 },
  {
    id: '1761400000000000901', name: '统计看板', path: 'dashboard', comp: 'yuqing/dashboard/index', type: 'C', icon: 'chart', perm: 'yuqing:dashboard:list', order: 1,
    btnBase: '1761400000000006010',
    btns: ['看板查询:yuqing:dashboard:list', '看板导出:yuqing:dashboard:export', '看板重算:yuqing:dashboard:aggregate'],
  },
  {
    id: '1761400000000000902', name: '监测任务', path: 'task', comp: 'yuqing/task/index', type: 'C', icon: 'job', perm: 'yuqing:task:list', order: 2,
    btnBase: '1761400000000006020',
    btns: ['任务查询:yuqing:task:query', '任务新增:yuqing:task:add', '任务修改:yuqing:task:edit', '任务删除:yuqing:task:remove', '任务导出:yuqing:task:export'],
  },
  {
    id: '1761400000000000903', name: '关键词库', path: 'keyword', comp: 'yuqing/keyword/index', type: 'C', icon: 'search', perm: 'yuqing:keyword:list', order: 3,
    btnBase: '1761400000000006030',
    btns: ['关键词查询:yuqing:keyword:query', '关键词新增:yuqing:keyword:add', '关键词修改:yuqing:keyword:edit', '关键词删除:yuqing:keyword:remove', '关键词导入:yuqing:keyword:import', '关键词导出:yuqing:keyword:export'],
  },
  {
    id: '1761400000000000904', name: '采集渠道', path: 'channel', comp: 'yuqing/channel/index', type: 'C', icon: 'link', perm: 'yuqing:channel:list', order: 4,
    btnBase: '1761400000000006040',
    btns: ['渠道查询:yuqing:channel:query', '渠道新增:yuqing:channel:add', '渠道修改:yuqing:channel:edit', '渠道删除:yuqing:channel:remove', '渠道导出:yuqing:channel:export',
      '降噪规则查询:yuqing:noiseRule:list', '降噪规则新增:yuqing:noiseRule:add', '降噪规则修改:yuqing:noiseRule:edit', '降噪规则删除:yuqing:noiseRule:remove', '净化重跑:yuqing:clean:replay'],
  },
  {
    id: '1761400000000000905', name: '舆情台账', path: 'opinion', comp: 'yuqing/opinion/index', type: 'C', icon: 'list', perm: 'yuqing:opinion:list', order: 5,
    btnBase: '1761400000000006050',
    btns: ['舆情查询:yuqing:opinion:query', '舆情导入:yuqing:opinion:import', '舆情导出:yuqing:opinion:export', '舆情研判:yuqing:opinion:analyze', '研判修正:yuqing:opinion:correct', '舆情删除:yuqing:opinion:remove'],
  },
  {
    id: '1761400000000000906', name: '预警管理', path: 'alert', comp: 'yuqing/alert/index', type: 'C', icon: 'warning', perm: 'yuqing:alert:list', order: 6,
    btnBase: '1761400000000006060',
    btns: ['预警查询:yuqing:alert:query', '预警规则新增:yuqing:alert:add', '预警规则修改:yuqing:alert:edit', '预警规则删除:yuqing:alert:remove', '预警处置:yuqing:alert:process', '预警导出:yuqing:alert:export'],
  },
  {
    id: '1761400000000000907', name: '推送管理', path: 'push', comp: 'yuqing/push/index', type: 'C', icon: 'message', perm: 'yuqing:push:list', order: 7,
    btnBase: '1761400000000006070',
    btns: ['推送查询:yuqing:push:query', '推送新增:yuqing:push:add', '推送修改:yuqing:push:edit', '推送删除:yuqing:push:remove', '推送重试:yuqing:push:retry'],
  },
  {
    id: '1761400000000000908', name: '报告管理', path: 'report', comp: 'yuqing/report/index', type: 'C', icon: 'documentation', perm: 'yuqing:report:list', order: 8,
    btnBase: '1761400000000006080',
    btns: ['报告查询:yuqing:report:query', '报告生成:yuqing:report:generate', '报告编辑:yuqing:report:edit', '报告导出:yuqing:report:export', '报告推送:yuqing:report:push', '报告提交:yuqing:report:submit', '报告删除:yuqing:report:remove'],
  },
  {
    id: '1761400000000000909', name: '报告模板', path: 'reportTemplate', comp: 'yuqing/reportTemplate/index', type: 'C', icon: 'form', perm: 'yuqing:reportTemplate:list', order: 9,
    btnBase: '1761400000000006090',
    btns: ['模板查询:yuqing:reportTemplate:query', '模板新增:yuqing:reportTemplate:add', '模板修改:yuqing:reportTemplate:edit', '模板删除:yuqing:reportTemplate:remove', '模板导出:yuqing:reportTemplate:export'],
  },
  {
    id: '1761400000000000910', name: '知识库', path: 'knowledge', comp: 'yuqing/knowledge/index', type: 'C', icon: 'education', perm: 'yuqing:knowledge:list', order: 10,
    btnBase: '1761400000000006100',
    btns: ['案例查询:yuqing:knowledge:query', '案例新增:yuqing:knowledge:add', '案例修改:yuqing:knowledge:edit', '案例删除:yuqing:knowledge:remove', '案例导出:yuqing:knowledge:export',
      '舆情入库:yuqing:knowledge:sink', '样本标注:yuqing:sample:label', '模型迭代:yuqing:model:iterate', '模型回滚:yuqing:model:rollback'],
  },
  {
    id: '1761400000000000911', name: '运行监控', path: 'monitor', comp: 'yuqing/monitor/index', type: 'C', icon: 'monitor', perm: 'yuqing:monitor:list', order: 11,
    btnBase: '1761400000000006110',
    btns: ['监控查询:yuqing:monitor:list', '手动触发:yuqing:monitor:run', '监控导出:yuqing:monitor:export'],
  },
  {
    id: '1761400000000000912', name: '净化批次', path: 'cleanBatch', comp: 'yuqing/cleanBatch/index', type: 'C', icon: 'clipboard', perm: 'yuqing:clean:list', order: 12,
    btnBase: '1761400000000006120',
    btns: ['批次查询:yuqing:clean:list', '批次新增:yuqing:clean:add', '批次修改:yuqing:clean:edit', '批次删除:yuqing:clean:remove', '批次导出:yuqing:clean:export', '净化重跑:yuqing:clean:replay'],
  },
  {
    /* F-007 智能研判。菜单 component 指向 yuqing/analysis/index，
     * 由 gen-yuqing-analysis.mjs 产出（本生成器不产该视图，只挂菜单）。
     *
     * 权限码零新增：下面 4 枚都是别处已有按钮用过的同一枚权限码。
     * 之所以在研判中心再挂一次，是为了让「研判员」这个角色可以只勾选
     * 「研判中心」一件事就具备完整可用权限，而不必连带勾选整个「舆情台账」
     * 与「知识库」。sys_menu 对 perms 无唯一约束，同一码出现在两个菜单下
     * 是合法且常见的做法；Sa-Token 只关心这枚码在不在用户的授权集合里。
     *
     * 模型回滚（yuqing:model:rollback）刻意**不**在此重复挂载：它与
     * 「模型版本」是同一件事的正反两面，两处都挂会让权限树里同一功能
     * 出现两次，配置角色时反而容易漏勾。 */
    id: '1761400000000000913', name: '研判中心', path: 'analysis', comp: 'yuqing/analysis/index', type: 'C', icon: 'skill', perm: 'yuqing:opinion:list', order: 13,
    btnBase: '1761400000000006130',
    btns: ['研判查询:yuqing:opinion:query', '批量研判:yuqing:opinion:analyze', '研判修正:yuqing:opinion:correct', '模型版本:yuqing:model:iterate'],
  },
];

/** 菜单按钮 ID = 该菜单的 btnBase + 1-based 序号（号段互不重叠，防 Duplicate entry） */
const menuButtonId = (menu, i) => String(BigInt(menu.btnBase) + BigInt(i + 1));

function menuNodes() {
  const nodes = [];
  for (const m of MENUS) {
    // C 菜单默认挂在「舆情监测」目录下（PRD §7.2 菜单规划表）
    const parent = m.parent ?? (m.type === 'C' ? MENU_ROOT : '0');
    nodes.push({ id: m.id, label: m.name, parent, type: m.type, order: m.order, path: m.path, comp: m.comp, perm: m.perm, icon: m.icon });
    (m.btns || []).forEach((b, i) => {
      const [label, perm] = b.split(':').length > 2 ? [b.split(':')[0], b.split(':').slice(1).join(':')] : [b.split(':')[0], b];
      nodes.push({ id: menuButtonId(m, i), label, parent: m.id, type: 'F', order: i + 1, path: '', comp: null, perm, icon: '#' });
    });
  }
  return nodes;
}

function assertMenusSampled() {
  const nodes = menuNodes();
  const seen = new Map();
  for (const n of nodes) {
    if (seen.has(n.id)) throw new Error(`[gen-menu] 菜单ID重复: ${n.id} —— ${seen.get(n.id)} / ${n.label}`);
    seen.set(n.id, n.label);
  }
  for (const n of nodes) {
    if (n.parent !== '0' && !seen.has(n.parent)) throw new Error(`[gen-menu] 父菜单不存在: ${n.id} ${n.label} -> ${n.parent}`);
  }
  const outside = nodes.filter(n => BigInt(n.id) < BigInt(MENU_ROOT) || BigInt(n.id) > BigInt(MENU_LIMIT));
  if (outside.length) throw new Error(`[gen-menu] 菜单ID越界(应在 ${MENU_ROOT}~${MENU_LIMIT}): ${outside.map(n => n.id).join(', ')}`);
  return nodes;
}

function genMenuSql() {
  const nodes = assertMenusSampled();
  const out = [
    '-- ============================================================',
    '-- 全自动化舆情监测研判报送平台 菜单初始化（RuoYi-Vue-Plus v6）',
    '-- sys_menu 共 22 列，INSERT 必须严格按列顺序提供 22 个值',
    '-- 列顺序: menu_id, menu_name, parent_id, order_num, path, component,',
    '--         query_param, is_frame, is_cache, menu_type, visible, status,',
    '--         perms, icon, active_menu, ext, create_dept, create_by,',
    '--         create_time, update_by, update_time, remark',
    '--',
    `-- ID 号段（本模块独占，共 ${nodes.length} 个节点）:`,
    `--   M 目录 : ${MENU_ROOT}`,
    `--   C 菜单 : ${MENUS.filter(m => m.type === 'C').map(m => m.id).join(' / ')}`,
    '--   F 按钮 : 每菜单独占 10 号段，按钮 = btnBase + 序号:',
    `--            ${MENUS.filter(m => m.btns?.length).map(m => `${m.name} ${menuButtonId(m, 0)}-${menuButtonId(m, m.btns.length - 1)}`).join(' / ')}`,
    '--',
    '-- 本脚本可重复执行：先清理本号段的菜单与角色关联，再重新插入',
    '-- ============================================================',
    '',
    '-- 清理旧数据（两段号段：C 菜单段 + F 按钮段），保证幂等',
    `DELETE FROM sys_role_menu WHERE menu_id BETWEEN ${MENU_ROOT} AND ${MENU_C_MAX};`,
    `DELETE FROM sys_menu      WHERE menu_id BETWEEN ${MENU_ROOT} AND ${MENU_C_MAX};`,
    `DELETE FROM sys_role_menu WHERE menu_id BETWEEN ${BTN_MIN} AND ${MENU_LIMIT};`,
    `DELETE FROM sys_menu      WHERE menu_id BETWEEN ${BTN_MIN} AND ${MENU_LIMIT};`,
    '',
  ];
  const cols = '(menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache, menu_type, visible, status, perms, icon, active_menu, ext, create_dept, create_by, create_time, update_by, update_time, remark)';
  const row = (id, name, parent, order, p, comp, type, icon, perm, active) =>
    `(${id}, '${name}', ${parent}, ${order}, '${p}', ${comp ? `'${comp}'` : 'NULL'}, '', 'N', 'Y', '${type}', '0', '0', '${perm}', '${icon}', ${active ? `'${active}'` : 'NULL'}, NULL, ${V6_DEPT}, ${V6_USER}, sysdate(), NULL, NULL, '舆情监测平台')`;

  for (const n of nodes) {
    out.push(`INSERT INTO sys_menu ${cols} VALUES ${row(n.id, n.label, n.parent, n.order, n.path, n.comp, n.type, n.icon, n.perm, n.type === 'C' ? n.path : null)};`);
  }
  out.push('');
  out.push('-- 角色授权：按 role_key 关联超级管理员（v6 的 role_id 并非 1，硬编码会授权失效）');
  out.push('-- 如需授权给其它角色（如「舆情主管」），改 role_key 即可；去掉 WHERE 则授权给全部角色');
  out.push('INSERT INTO sys_role_menu (role_id, menu_id)');
  out.push('SELECT r.role_id, m.menu_id');
  out.push('FROM sys_role r');
  out.push('CROSS JOIN sys_menu m');
  out.push(`WHERE r.role_key = 'superadmin'`);
  out.push(`  AND (m.menu_id BETWEEN ${MENU_ROOT} AND ${MENU_C_MAX}`);
  out.push(`       OR m.menu_id BETWEEN ${BTN_MIN} AND ${MENU_LIMIT});`);
  out.push('');
  out.push('-- ---------- 执行后自检（第 1 条必须返回 0 行）----------');
  out.push(`-- SELECT menu_id, COUNT(*) AS c FROM sys_menu WHERE menu_id BETWEEN ${MENU_ROOT} AND ${MENU_LIMIT} GROUP BY menu_id HAVING c > 1;`);
  out.push(`-- SELECT COUNT(*) AS menu_total FROM sys_menu WHERE menu_id BETWEEN ${MENU_ROOT} AND ${MENU_LIMIT};`);
  return out.join('\n');
}

/* ============================================================
 * 10.2 Doris 数据源配置片段（PRD §5.5 / §6.3）
 * ============================================================ */
function genDatasourceYml() {
  return `# ============================================================
# 舆情监测平台 · dynamic-datasource 多数据源配置片段
# 追加到 ruoyi-admin/src/main/resources/application-dev.yml 的 spring.datasource.dynamic.datasource 下
#
# 说明（见《技术架构说明》§4.6 / PRD §6.3）：
#   master  → MySQL，承接 sys_* 与全部配置/状态表（事务）
#   doris   → Apache Doris，承接 9 张事实表与分析（只读）
#
# ⚠ 当前落地形态（架构决策 ①A：Doris 未接入期，"结构等价替代"）
#   yq_opinion / yq_collect_log / yq_stats_* 等 9 张事实表，已用
#   yq_doris_mysql_fallback.sql 在【同一个 ruoyi_zhai 库】里建出等价表结构，
#   故此处把 doris 指向主库同一连接串。业务代码里的 @DS("doris") 一行不改，
#   将来接入真 Doris 时，只替换本段的 url/username/password 即可切换。
#
#   等价性边界（务必知悉，非等价之处）：
#     · Doris 版用 UNIQUE KEY + Merge-on-Write 做去重与高吞吐写入；
#       MySQL 镜像版用复合主键 (collect_date, url_hash) 达到同样的幂等语义。
#     · Doris 版有动态分区与倒排索引；MySQL 镜像版退化为普通二级索引。
#     · 因此【语义等价、性能不等价】—— 当前形态用于打通全链路与功能验收，
#       不可用于容量/并发压测结论。生产必须切真 Doris。
#
#   本段中的表位于主库，因此【与 master 共享同一事务管理器】：
#   跨 master / doris 的写操作可被同一事务覆盖（真 Doris 下不可，届时需改为最终一致）。
# ============================================================
spring:
  datasource:
    dynamic:
      datasource:
        doris:
          type: \${spring.datasource.type}
          driverClassName: com.mysql.cj.jdbc.Driver
          url: jdbc:mysql://43.138.34.68:3306/ruoyi_zhai?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull&useSSL=true&serverTimezone=GMT%2B8&autoReconnect=true&rewriteBatchedStatements=true&allowPublicKeyRetrieval=true&nullCatalogMeansCurrent=true
          username: ruoyi_zhai
          password: BWnSwWmCSAyLtAr4
`;
}

/* ============================================================
 * 11. PC 前端（plus-ui v6：Vue3 + TS + Element Plus）
 * ============================================================ */
function genPcApiTypes(t) {
  const E = t.entity;
  const fields = pFields(t);
  const props = fields.map(f => `  /** ${f.comment} */
  ${f.name}?: ${tsType(f.javaType)};`).join('\n');
  /* VO 里补 createTime 便于列表展示，但表里若已声明同名字段就不能再补一次（TS2300 Duplicate identifier） */
  const voCreateTime = fields.some(f => f.name === 'createTime') ? '' : '  /** 创建时间 */\n  createTime?: string;\n';
  /* ⚠ PageQuery 是 src/types/global.d.ts 里的全局环境接口，不能再从 '@/api/types' 引入（TS2305） */
  return `/**
 * ${t.title} 查询
 */
export interface ${E}Query extends PageQuery {
${props}
}

/**
 * ${t.title} 表单
 */
export interface ${E}Form {
  /** 主键 */
  ${t.pk}?: string;
${props}
${(t.virtual || []).map(v => `  /** ${v.comment} */
  ${v.name}?: ${String(v.javaType).startsWith('List<') ? 'any[]' : 'string'};`).join('\n')}
}

/**
 * ${t.title} 视图
 */
export interface ${E}VO {
  /** 主键 */
  ${t.pk}?: string;
${props}
${voCreateTime}${(t.virtual || []).map(v => `  /** ${v.comment} */
  ${v.name}?: any;`).join('\n')}
}
`;
}

function genPcApiIndex(t) {
  const E = t.entity;
  const bp = t.basePath;
  const readOnlyNote = isDoris(t)
    ? `// ⚠ ${t.title}位于 Apache Doris，业务侧只读；写入由采集/研判 Worker 经 Stream Load 完成。\n`
    : '';
  const writes = isDoris(t) ? '' : `
/**
 * 新增${t.title}
 */
export const add${E} = (data: ${E}Form): AxiosPromise => {
  return request({
    url: '${bp}',
    method: 'post',
    data
  });
};

/**
 * 修改${t.title}
 */
export const update${E} = (data: ${E}Form): AxiosPromise => {
  return request({
    url: '${bp}',
    method: 'put',
    data
  });
};

/**
 * 删除${t.title}
 */
export const del${E} = (${t.pk}: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '${bp}/' + ${t.pk},
    method: 'delete'
  });
};
`;
  return `${readOnlyNote}import type { ${E}Form, ${E}Query, ${E}VO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询${t.title}列表
 */
export const list${E} = (query?: ${E}Query): AxiosPromise<PageResult<${E}VO>> => {
  return request({
    url: '${bp}/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询${t.title}详细
 */
export const get${E} = (${t.pk}: string | number): AxiosPromise<${E}VO> => {
  return request({
    url: '${bp}/' + ${t.pk},
    method: 'get'
  });
};
${writes}
/**
 * ${t.title}下拉选项
 */
export const optionselect${E} = (params?: any): AxiosPromise<${E}VO[]> => {
  return request({
    url: '${bp}/optionselect',
    method: 'get',
    params
  });
};
`;
}

/* ---------- PC 页面片段 ---------- */
const PC_QUERY_SKIP = ['remark', 'status'];

/** 查询项：取前 3 个适合筛选的字段 */
function pcQueryItems(t) {
  return pFields(t).filter(f => tfIsFilterable(f) && !PC_QUERY_SKIP.includes(f.name)).slice(0, 3);
}

function pcQueryHtml(t) {
  return pcQueryItems(t).map(f => {
    if (isForeignSelect(f)) {
      const tg = foreignTarget(f.foreign);
      return `      <el-form-item label="${fieldLabel(f)}" prop="${f.name}">
        <el-select v-model="queryParams.${f.name}" placeholder="请选择${fieldLabel(f)}" clearable filterable style="width: 200px">
          <el-option v-for="o in ${f.foreign}Options" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>`;
    }
    if (f.dict) {
      return `      <el-form-item label="${f.comment}" prop="${f.name}">
        <el-select v-model="queryParams.${f.name}" placeholder="请选择${f.comment}" clearable style="width: 180px">
          <el-option v-for="d in ${f.dict}" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>`;
    }
    return `      <el-form-item label="${f.comment}" prop="${f.name}">
        <el-input v-model="queryParams.${f.name}" placeholder="请输入${f.comment}" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>`;
  }).join('\n');
}

/** 表格列：全部持久化字段（去掉超长文本与备注） */
function pcTableCols(t) {
  return pFields(t).filter(f => !['remark', 'content', 'originData', 'analyzeResult', 'bodyTemplate', 'originData'].includes(f.name));
}

function pcTableHtml(t) {
  const cols = pcTableCols(t).map(f => {
    if (f.dict) {
      return `      <el-table-column label="${f.comment}" align="center" prop="${f.name}">
        <template #default="scope">
          <dict-tag :options="${f.dict}" :value="scope.row.${f.name}" />
        </template>
      </el-table-column>`;
    }
    if (isForeignSelect(f)) {
      return `      <el-table-column label="${fieldLabel(f)}" align="center" prop="${fieldProp(f)}" show-overflow-tooltip />`;
    }
    const w = ['title', 'taskName', 'channelName', 'ruleName', 'templateName', 'caseTitle', 'clusterTitle', 'reportName', 'keywordText', 'groupName', 'channelDomain'].includes(f.name) ? '' : ' width="120"';
    return `      <el-table-column label="${f.comment}" align="center" prop="${f.name}"${w} show-overflow-tooltip />`;
  }).join('\n');
  const dtCols = detailTargets(t).map(d => `      <el-table-column label="${d.title}数" align="center" width="110">
        <template #default="scope">
          <el-tag :type="(scope.row.${d.listField}?.length ?? 0) > 0 ? 'success' : 'info'">{{ scope.row.${d.listField}?.length ?? 0 }}</el-tag>
        </template>
      </el-table-column>`).join('\n');
  return [cols, dtCols].filter(Boolean).join('\n');
}

/** 表单项 */
function pcFormItems(t) {
  return pFields(t).map(f => {
    const req = f.required ? ' required' : '';
    if (isForeignSelect(f)) {
      return `        <el-form-item label="${fieldLabel(f)}" prop="${f.name}">
          <el-select v-model="form.${f.name}" placeholder="请选择${fieldLabel(f)}" clearable filterable style="width: 100%">
            <el-option v-for="o in ${f.foreign}Options" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>`;
    }
    if (f.dict) {
      return `        <el-form-item label="${f.comment}" prop="${f.name}">
          <el-select v-model="form.${f.name}" placeholder="请选择${f.comment}" style="width: 100%">
            <el-option v-for="d in ${f.dict}" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>`;
    }
    if (f.javaType === 'LocalDate') {
      return `        <el-form-item label="${f.comment}" prop="${f.name}">
          <el-date-picker v-model="form.${f.name}" type="date" value-format="YYYY-MM-DD" placeholder="请选择${f.comment}" style="width: 100%" />
        </el-form-item>`;
    }
    if (f.javaType === 'LocalDateTime') {
      return `        <el-form-item label="${f.comment}" prop="${f.name}">
          <el-date-picker v-model="form.${f.name}" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="请选择${f.comment}" style="width: 100%" />
        </el-form-item>`;
    }
    if (f.javaType === 'Integer') {
      return `        <el-form-item label="${f.comment}" prop="${f.name}">
          <el-input-number v-model="form.${f.name}" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>`;
    }
    if (f.sqlType === 'TEXT') {
      return `        <el-form-item label="${f.comment}" prop="${f.name}">
          <el-input v-model="form.${f.name}" type="textarea" :rows="4" placeholder="请输入${f.comment}" />
        </el-form-item>`;
    }
    return `        <el-form-item label="${f.comment}" prop="${f.name}"${req}>
          <el-input v-model="form.${f.name}" placeholder="请输入${f.comment}" />
        </el-form-item>`;
  }).join('\n');
}

/** 明细子表格 */
function pcDetailHtml(d) {
  const label = d.title.replace(/^任务/, '').replace(/^报告模板/, '');
  const cols = d.fields.map(f => {
    if (isForeignSelect(f)) {
      return `        <el-table-column label="${fieldLabel(f)}" min-width="200">
          <template #default="{ row }">
            <el-select v-model="row.${f.name}" placeholder="请选择${fieldLabel(f)}" clearable filterable>
              <el-option v-for="o in ${f.foreign}Options" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </template>
        </el-table-column>`;
    }
    if (f.dict) {
      return `        <el-table-column label="${f.comment}" ${f.name === 'required' ? 'width="100" align="center"' : 'width="150"'}>
          <template #default="{ row }">
            ${f.name === 'required'
        ? `<el-switch v-model="row.${f.name}" active-value="1" inactive-value="0" />`
        : `<el-select v-model="row.${f.name}" placeholder="${f.comment}">
              <el-option v-for="dd in ${f.dict}" :key="dd.value" :label="dd.label" :value="dd.value" />
            </el-select>`}
          </template>
        </el-table-column>`;
    }
    if (f.javaType === 'Integer') {
      return `        <el-table-column label="${f.comment}" width="110" align="center">
          <template #default="{ row }">
            <el-input-number v-model="row.${f.name}" :min="0" controls-position="right" style="width: 100%" />
          </template>
        </el-table-column>`;
    }
    return `        <el-table-column label="${f.comment}" min-width="180">
          <template #default="{ row }">
            <el-input v-model="row.${f.name}" placeholder="请输入${f.comment}" />
          </template>
        </el-table-column>`;
  }).join('\n');
  return `      <el-divider content-position="left">
        ${label}
        <el-button link type="primary" icon="Plus" style="margin-left: 12px" @click="handleAdd${cap(d.listField)}">添加${label}</el-button>
      </el-divider>
      <el-table :data="form.${d.listField} || []" size="small" border>
        <el-table-column label="序号" type="index" width="55" align="center" />
${cols}
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ $index }">
            <el-button link type="danger" icon="Delete" @click="handleRemove${cap(d.listField)}($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>`;
}

/** 页面用到的字典 */
function pcDicts(t) {
  const s = new Set();
  for (const f of pFields(t)) if (f.dict) s.add(f.dict);
  for (const d of detailTargets(t)) for (const k of d.keyFields) s.add(k);
  return [...s];
}

/** 页面用到的关联下拉（去重，含明细里的） */
function pcForeignKeys(t) {
  const s = new Set();
  for (const f of pFields(t)) if (isForeignSelect(f)) s.add(f.foreign);
  for (const d of detailTargets(t)) for (const f of d.fields) if (isForeignSelect(f)) s.add(f.foreign);
  return [...s];
}

function pcForeignImports(t) {
  const keys = pcForeignKeys(t);
  if (!keys.length) return '';
  return keys.map(k => {
    const tg = foreignTarget(k);
    return `import { optionselect${tg.entity} } from '@/api/yuqing/${tg.module}/index';`;
  }).join('\n');
}

function pcForeignRefs(t) {
  const keys = pcForeignKeys(t);
  if (!keys.length) return '';
  return '\n' + keys.map(k => `const ${k}Options = ref<Array<{ label: string; value: any }>>([]);`).join('\n');
}

function pcForeignLoader(t) {
  const keys = pcForeignKeys(t);
  if (!keys.length) return '';
  const body = keys.map(k => {
    const tg = foreignTarget(k);
    return `  const ${k}Res = await optionselect${tg.entity}({});
  ${k}Options.value = (${k}Res.data ?? []).map((i: any) => ({ label: i.${tg.label}, value: i.${tg.value} }));`;
  }).join('\n');
  return `
/** 加载关联下拉选项（不加载则下拉框为空） */
async function loadForeignOptions() {
${body}
}
`;
}

/** 没有关联字段的表不能调用 loadForeignOptions，否则 TS2304 Cannot find name */
function pcForeignBootstrap(t) {
  return pcForeignKeys(t).length ? 'loadForeignOptions();\n' : '';
}

/**
 * yq_keyword 页面的专属挂载点：词表导入（P0-4）+ 组合表达式实时校验（P0-2 / F-002 验收标准 3）。
 *
 * <p>只对 keyword 生效，其余表一律返回空串 —— 通用模板与生成逻辑保持同一条路径。</p>
 *
 * @param {object} t    表定义
 * @param {string} slot 挂载点：toolbar / form / dialog / import / tail
 * @returns {string} 注入片段
 */
function keywordExtras(t, slot) {
  if (t.key !== 'keyword') return '';
  if (slot === 'toolbar') {
    return `      <el-col :span="1.5">
        <el-button type="info" plain icon="Upload" v-hasPermi="['${t.perm}:add']" @click="handleImport">导入词表</el-button>
      </el-col>
`;
  }
  if (slot === 'form') {
    return `        <el-form-item v-if="form.comboExpression" label="表达式校验">
          <el-alert v-if="expressionIssues.length === 0" type="success" :closable="false" show-icon title="表达式语法正确，保存后即可用于采集" />
          <el-alert v-else type="error" :closable="false" show-icon :title="expressionIssues.join('；')" />
        </el-form-item>
`;
  }
  if (slot === 'dialog') {
    return `    <KeywordImportDialog ref="importRef" @success="getList" />
`;
  }
  if (slot === 'import') {
    return `import { watch } from 'vue';
import KeywordImportDialog from './KeywordImportDialog.vue';
import { validateKeywordExpression } from '@/api/yuqing/keyword/import';
`;
  }
  if (slot === 'tail') {
    return `const importRef = ref();
const expressionIssues = ref<string[]>([]);
let expressionTimer: any = null;

/** 打开词表导入对话框 */
function handleImport() {
  importRef.value?.open();
}

/** 组合表达式实时校验：录错会「采集成功、入库 0 条」且不报错，必须在录入阶段拦住 */
watch(
  () => form.value.comboExpression,
  (value: string | undefined) => {
    if (expressionTimer) {
      clearTimeout(expressionTimer);
    }
    if (!value || !String(value).trim()) {
      expressionIssues.value = [];
      return;
    }
    expressionTimer = setTimeout(async () => {
      try {
        const res = await validateKeywordExpression(String(value));
        expressionIssues.value = res.data ?? [];
      } catch (e) {
        expressionIssues.value = [];
      }
    }, 400);
  }
);

`;
  }
  return '';
}

/**
 * 净化批次页的专属挂载点（F-006 验收标准 9）。
 *
 * <p>与 keywordExtras 同一套路：通用 CRUD 页面只给「查/增/改/删/导出」，
 * 「按新规则重跑并先看影响条数」是 F-006 独有能力，用受控挂载点补进去，
 * 不把生成器主模板改脏。</p>
 */
function cleanBatchExtras(t, slot) {
  if (t.key !== 'cleanBatch') return '';
  if (slot === 'toolbar') {
    return `      <el-col :span="1.5">
        <el-button type="warning" plain icon="Refresh" v-hasPermi="['${t.perm}:replay']" @click="openReplay">净化重跑</el-button>
      </el-col>
`;
  }
  if (slot === 'dialog') {
    return `    <CleanReplayDialog ref="replayRef" @success="getList" />
`;
  }
  if (slot === 'import') {
    return `import CleanReplayDialog from './CleanReplayDialog.vue';
`;
  }
  if (slot === 'tail') {
    return `const replayRef = ref();

/** 打开净化重跑对话框：先预览影响条数，确认后才真正落库 */
function openReplay() {
  replayRef.value?.open();
}

`;
  }
  return '';
}

function genPcView(t) {
  const E = t.entity;
  const tPath = t.key;
  const dts = detailTargets(t);
  const dicts = pcDicts(t);
  const dictLine = dicts.length ? `const { ${dicts.join(', ')} } = toRefs<any>(useDict(${dicts.map(d => `'${d}'`).join(', ')}));` : '// 本页无字典字段';
  const detailAdders = dts.map(d => {
    const defaults = d.fields.map(f => {
      if (f.dict) return `${f.name}: ${f.dict}.value?.[0]?.value ?? ''`;
      if (isForeignSelect(f)) return `${f.name}: undefined`;
      if (f.javaType === 'Integer') return `${f.name}: 0`;
      return `${f.name}: ''`;
    }).join(', ');
    return `
/** ${d.title}：新增一行 */
function handleAdd${cap(d.listField)}() {
  if (!form.value.${d.listField}) form.value.${d.listField} = [];
  form.value.${d.listField}!.push({ ${defaults} });
}

/** ${d.title}：删除一行 */
function handleRemove${cap(d.listField)}(index: number) {
  form.value.${d.listField}?.splice(index, 1);
}
`;
  }).join('');
  const resetDetails = dts.map(d => `${d.listField}: []`).join(', ');
  const detailValidators = dts.map(d => {
    const firstText = d.fields.find(f => f.javaType === 'String' && !f.dict) || d.fields[0];
    return `  const ${d.listField} = form.value.${d.listField} ?? [];
  for (let i = 0; i < ${d.listField}.length; i++) {
    if (!${d.listField}[i].${firstText.name}) {
      proxy?.$modal.msgError(\`第 \${i + 1} 行${d.title}的「${firstText.comment}」不能为空\`);
      return;
    }
  }`;
  }).join('\n');
  const detailGuard = dts.map(d => `  if (!form.value.${d.listField}) form.value.${d.listField} = [];`).join('\n');

  return `<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="90px">
${pcQueryHtml(t)}
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" v-hasPermi="['${t.perm}:add']" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" v-hasPermi="['${t.perm}:edit']" @click="handleUpdate()">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" v-hasPermi="['${t.perm}:remove']" @click="handleDelete()">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" v-hasPermi="['${t.perm}:export']" @click="handleExport">导出</el-button>
      </el-col>
${keywordExtras(t, 'toolbar')}${cleanBatchExtras(t, 'toolbar')}      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="${tPath}List" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
${pcTableHtml(t)}
      <el-table-column label="创建时间" align="center" prop="createTime" width="180" />
      <el-table-column label="操作" align="center" width="160" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" v-hasPermi="['${t.perm}:edit']" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="danger" icon="Delete" v-hasPermi="['${t.perm}:remove']" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog :title="title" v-model="open" width="${dts.length ? '1000' : '700'}px" append-to-body>
      <el-form ref="${tPath}Ref" :model="form" :rules="rules" label-width="110px">
${pcFormItems(t)}
${keywordExtras(t, 'form')}      </el-form>
${dts.map(pcDetailHtml).join('\n')}
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
${keywordExtras(t, 'dialog')}${cleanBatchExtras(t, 'dialog')}  </div>
</template>

<script setup name="${E}" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance } from 'vue';
import type { ${E}Form, ${E}Query, ${E}VO } from '@/api/yuqing/${tPath}/types';
import { list${E}, get${E}, del${E}, add${E}, update${E} } from '@/api/yuqing/${tPath}/index';
${pcForeignImports(t)}
${keywordExtras(t, 'import')}${cleanBatchExtras(t, 'import')}import { useDict } from '@/utils/dict';

const { proxy } = getCurrentInstance() as any;
const { ${dicts.join(', ') || ''} } = toRefs<any>(useDict(${dicts.map(d => `'${d}'`).join(', ')}));
${pcForeignRefs(t)}
const ${tPath}List = ref<${E}VO[]>([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const ${tPath}Ref = ref();
const queryRef = ref();

const data = reactive({
  form: {} as ${E}Form,
  queryParams: {
    pageNum: 1,
    pageSize: 10
  } as ${E}Query
});
const { queryParams, form } = toRefs(data);

const rules = {
${pFields(t).filter(f => f.required).map(f => `  ${f.name}: [{ required: true, message: '${f.comment}不能为空', trigger: '${f.javaType === 'Integer' || f.dict ? 'change' : 'blur'}' }]`).join(',\n')}
};
${pcForeignLoader(t)}
${detailAdders}
/** 查询${t.title}列表 */
async function getList() {
  loading.value = true;
  try {
    const res = await list${E}(queryParams.value);
    ${tPath}List.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } finally {
    loading.value = false;
  }
}

function cancel() {
  open.value = false;
  reset();
}

function reset() {
  form.value = { ${t.pk}: undefined${resetDetails ? ', ' + resetDetails : ''} } as ${E}Form;
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as ${E}Query;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: ${E}VO[]) {
  ids.value = selection.map(item => item.${t.pk}!) as Array<string | number>;
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

function handleAdd() {
  reset();
  open.value = true;
  title.value = '新增${t.title}';
}

async function handleUpdate(row?: ${E}VO) {
  reset();
  const _id = row?.${t.pk} ?? ids.value[0];
  const res = await get${E}(_id);
  form.value = res.data as any;
${detailGuard}
  open.value = true;
  title.value = '修改${t.title}';
}

/** 提交表单 */
async function submitForm() {
  await ${tPath}Ref.value?.validate();
${detailValidators}
  if (form.value.${t.pk} != null) {
    await update${E}(form.value);
    proxy?.$modal.msgSuccess('修改成功');
  } else {
    await add${E}(form.value);
    proxy?.$modal.msgSuccess('新增成功');
  }
  open.value = false;
  getList();
}

async function handleDelete(row?: ${E}VO) {
  const _ids = row?.${t.pk} ?? ids.value;
  await proxy?.$modal.confirm('是否确认删除${t.title}编号为"' + _ids + '"的数据项？');
  await del${E}(_ids);
  proxy?.$modal.msgSuccess('删除成功');
  getList();
}

/** 导出 */
function handleExport() {
  proxy?.download('${t.basePath}/export', { ...queryParams.value }, \`${t.title}_\${new Date().getTime()}.xlsx\`);
}

${keywordExtras(t, 'tail')}${cleanBatchExtras(t, 'tail')}getList();
${pcForeignBootstrap(t)}</script>
`;
}

/* ============================================================
 * 12. H5 API（RuoYi-App-Plus / unibest）
 * ============================================================ */
function genH5Api(t) {
  const E = t.entity;
  const bp = t.basePath;
  const writes = isDoris(t) ? '' : `
/**
 * 新增${t.title}
 */
export function add${E}(data) {
  return request({
    url: '${bp}',
    method: 'post',
    data
  })
}

/**
 * 修改${t.title}
 */
export function update${E}(data) {
  return request({
    url: '${bp}',
    method: 'put',
    data
  })
}

/**
 * 删除${t.title}
 */
export function del${E}(${t.pk}) {
  return request({
    url: '${bp}/' + ${t.pk},
    method: 'delete'
  })
}
`;
  const roNote = isDoris(t)
    ? `// ⚠ ${t.title}位于 Apache Doris（PRD §5.5），业务侧只读；\n// 写入由采集/研判 Worker 经 Stream Load 完成，此处不提供写接口。\n`
    : '';
  return `${roNote}import request from '@/utils/request'

/**
 * 查询${t.title}列表
 */
export function list${E}(query) {
  return request({
    url: '${bp}/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询${t.title}详细
 */
export function get${E}(${t.pk}) {
  return request({
    url: '${bp}/' + ${t.pk},
    method: 'get'
  })
}
${writes}
/**
 * ${t.title}下拉选项
 */
export function optionselect${E}(params) {
  return request({
    url: '${bp}/optionselect',
    method: 'get',
    params
  })
}
`;
}

/* ============================================================
 * 13. 设计期自检
 * ============================================================ */
/**
 * 实体里声明了 xxxName 虚拟字段时，对应外键必须配 refName，
 * 否则生成的 ServiceImpl 不会回填名称，前端「所属XX」列恒为空白。
 * 手写 Service（svcHandwritten）与被 @DS 的 Doris 表由人工在 Ext Service 回填，不在此约束内。
 */
function assertRefNamesDeclared() {
  const problems = [];
  for (const t of ALL_TABLES) {
    if (t.svcHandwritten) continue;
    const declared = new Set(pFields(t).filter(f => f.refName).map(f => f.refName));
    for (const v of (t.virtual || [])) {
      if (!v.virtual || !/Name$/.test(v.name)) continue;
      if (!declared.has(v.name)) {
        problems.push(`${t.entity}.${v.name}（表 ${t.table} 的外键缺 refName: '${v.name}'）`);
      }
    }
  }
  if (problems.length) {
    throw new Error(`[gen-refname] 以下关联名称字段未声明 refName，列表会一直空白:\n  - ${problems.join('\n  - ')}`);
  }
}

/* ============================================================
 * 14. 主流程
 * ============================================================ */
function parseSpec() {
  if (!fs.existsSync(SPEC)) return [];
  const content = fs.readFileSync(SPEC, 'utf-8');
  return content.split('\n')
    .map(l => l.match(/^##\s+(.+?)(?:\s*\|.*)?$/))
    .filter(Boolean)
    .map(m => ({ title: m[1].trim() }));
}

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf-8');
}

function main() {
  const features = parseSpec();
  const out = [];

  // 设计期自检：先拦住「实体声明了 xxxName 却没配 refName」这类必然导致列表空白的问题
  assertRefNamesDeclared();

  const mysqlTables = [...TABLES, ...TABLES_2];
  const dorisTables = [...TABLES_DORIS];

  // --- Java ---
  for (const t of ALL_TABLES) {
    writeFile(path.join(JAVA_BASE, 'domain', `${t.entity}.java`), genDomain(t));
    writeFile(path.join(JAVA_BASE, 'mapper', `${t.entity}Mapper.java`), genMapper(t));
    writeFile(path.join(JAVA_BASE, 'service', `I${t.entity}Service.java`), genService(t));
    writeFile(path.join(JAVA_BASE, 'service', 'impl', `${t.entity}ServiceImpl.java`), genServiceImpl(t));
    if (t.ctrl && !isDoris(t)) {
      writeFile(path.join(JAVA_BASE, 'controller', `${t.entity}Controller.java`), genController(t));
    }
    const tag = isDoris(t) ? '(Doris 只读)' : (t.ctrl ? '(含 Controller)' : '(Controller 手写)');
    out.push(`  ✓ Java ${t.entity.padEnd(24)} ${tag}`);
  }

  // --- SQL ---
  const schemaSql = [
    '-- ============================================================',
    '-- 全自动化舆情监测研判报送平台 建表脚本（RuoYi-Vue-Plus v6 / MySQL 8）',
    '-- 来源: PRD §5.2 数据字典',
    `-- 表数: ${mysqlTables.length}（MySQL）；另有 ${dorisTables.length} 张 Doris 事实表见 yq_doris_schema.sql`,
    '-- 执行顺序: 本脚本 -> yq_dict.sql -> yq_menu.sql',
    '-- ⚠ 本脚本含 DROP TABLE，重跑会清空业务数据（幂等但破坏性）',
    '-- ============================================================',
    'SET NAMES utf8mb4;',
    'SET FOREIGN_KEY_CHECKS = 0;',
    '',
    ...mysqlTables.map(genSql),
    'SET FOREIGN_KEY_CHECKS = 1;',
  ].join('\n');

  const dorisSql = [
    '-- ============================================================',
    '-- 全自动化舆情监测研判报送平台 Doris 建表脚本（Apache Doris 2.1/3.0）',
    '-- 来源: PRD §5.5 Doris 建表约定与写入链路',
    '-- 执行前请确认已接入 Doris 集群，并在 MySQL 客户端连接 FE 9030 端口执行',
    '-- ⚠ 本脚本含 DROP TABLE',
    '-- ============================================================',
    'CREATE DATABASE IF NOT EXISTS yq_dwd;',
    '',
    ...dorisTables.map(genDorisSql),
  ].join('\n');

  writeFile(path.join(OUT, 'sql', 'yq_schema.sql'), schemaSql);
  writeFile(path.join(OUT, 'sql', 'yq_doris_schema.sql'), dorisSql);
  writeFile(path.join(OUT, 'sql', 'yq_dict.sql'), genDictSql());
  writeFile(path.join(OUT, 'sql', 'yq_menu.sql'), genMenuSql());
  writeFile(path.join(OUT, 'config', 'yq_datasource.yml'), genDatasourceYml());
  const menuCount = menuNodes().length;
  out.push(`  ✓ SQL  yq_schema.sql(${mysqlTables.length} 表) / yq_doris_schema.sql(${dorisTables.length} 表) / yq_dict.sql(${DICTS.length} 类) / yq_menu.sql(${menuCount} 行)（yq_doris_mysql_fallback.sql 由 gen-yuqing-collect.mjs 产出）`);
  out.push('  ✓ CFG  config/yq_datasource.yml');

  // --- PC 前端 ---
  for (const t of ALL_TABLES) {
    writeFile(path.join(OUT, 'pc', 'api', 'yuqing', t.key, 'types.ts'), genPcApiTypes(t));
    writeFile(path.join(OUT, 'pc', 'api', 'yuqing', t.key, 'index.ts'), genPcApiIndex(t));
    if (t.pcPage) {
      writeFile(path.join(OUT, 'pc', 'views', 'yuqing', t.key, 'index.vue'), genPcView(t));
    }
  }
  const pcPages = ALL_TABLES.filter(t => t.pcPage).length;
  out.push(`  ✓ PC   api/yuqing/*(${ALL_TABLES.length} 模块) + views/yuqing/*(${pcPages} 个完整页面)`);

  // --- H5 API ---
  for (const t of ALL_TABLES) {
    writeFile(path.join(OUT, 'h5', 'api', 'yuqing', `${t.key}.js`), genH5Api(t));
  }
  out.push(`  ✓ H5   api/yuqing/*.js（${ALL_TABLES.length} 个模块）`);

  console.log(`\n🔨 舆情监测平台代码生成器（RuoYi-Vue-Plus v6 三端）`);
  console.log(`   spec 功能点: ${features.length} 个   |   数据表: ${ALL_TABLES.length} 张（MySQL ${mysqlTables.length} + Doris ${dorisTables.length}）`);
  console.log(`   输出目录: ${OUT}\n`);
  console.log(out.join('\n'));
  console.log(`\n✅ 完成`);
  console.log(`   Java 包名: ${PACKAGE}`);
  console.log(`   目标后端: RuoYi-Vue-Plus-v6.0.0/ruoyi-admin/src/main/java/${PACKAGE.replace(/\./g, '/')}/`);
  console.log(`   目标 PC : plus-ui-v6.0.0-Vue/src/api/yuqing/ + src/views/yuqing/`);
  console.log(`   目标 H5 : RuoYi-App-Plus/src/api/yuqing/`);
  console.log(`\n⚠ 待手写（ctrl:false / pcPage:false 的模块，见交付说明的「遗留清单」）:`);
  console.log(`   采集调度、净化去重、智能研判、多维分析、预警处置、推送发送、`);
  console.log(`   报告生成与渲染、知识库入库与模型迭代、运行监控，以及 9 个企业微信 H5 页面`);
}

main();
