-- ============================================================
-- 全自动化舆情监测研判报送平台 建表脚本（RuoYi-Vue-Plus v6 / MySQL 8）
-- 来源: PRD §5.2 数据字典
-- 表数: 25（MySQL）；另有 9 张 Doris 事实表见 yq_doris_schema.sql
-- 执行顺序: 本脚本 -> yq_dict.sql -> yq_menu.sql
-- ⚠ 本脚本含 DROP TABLE，重跑会清空业务数据（幂等但破坏性）
-- ============================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 监测任务表 yq_task
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS yq_task;
CREATE TABLE yq_task (
  task_id              BIGINT         NOT NULL COMMENT '任务ID,主键',
  task_name            VARCHAR(100)   NOT NULL COMMENT '任务名称',
  task_type            VARCHAR(20)    NOT NULL DEFAULT 'normal' COMMENT '任务类型',
  task_source          VARCHAR(20)    NOT NULL DEFAULT 'pc' COMMENT '任务来源',
  collect_strategy     VARCHAR(20)    NOT NULL DEFAULT 'polling' COMMENT '采集策略',
  collect_interval     INT            NOT NULL DEFAULT '1800' COMMENT '采集间隔（秒）',
  level_rule_id        BIGINT         DEFAULT NULL COMMENT '分级规则ID',
  alert_rule_id        BIGINT         DEFAULT NULL COMMENT '预警规则ID',
  push_rule_id         BIGINT         DEFAULT NULL COMMENT '推送规则ID',
  start_time           DATETIME       NOT NULL COMMENT '任务生效起始',
  end_time             DATETIME       DEFAULT NULL COMMENT '任务结束时间（常态化为空）',
  last_schedule_time   DATETIME       DEFAULT NULL COMMENT '最近一次调度时间',
  status               CHAR(1)        DEFAULT '0' COMMENT '状态（0正常 1停用）',
  del_flag             CHAR(1)        DEFAULT '0' COMMENT '删除标志（0存在 2删除）',
  remark               VARCHAR(500)   DEFAULT NULL COMMENT '备注',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (task_id),
  UNIQUE KEY uk_yq_task_name (task_name),
  KEY idx_yq_task_status (status, start_time),
  KEY idx_yq_task_rule (level_rule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='监测任务';

-- ============================================================
-- 关键词分组表 yq_keyword_group
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS yq_keyword_group;
CREATE TABLE yq_keyword_group (
  group_id             BIGINT         NOT NULL COMMENT '分组ID,主键',
  group_name           VARCHAR(50)    NOT NULL COMMENT '分组名称',
  del_flag             CHAR(1)        DEFAULT '0' COMMENT '删除标志（0存在 2删除）',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (group_id),
  UNIQUE KEY uk_yq_kwgroup_name (group_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='关键词分组';

-- ============================================================
-- 关键词表 yq_keyword
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS yq_keyword;
CREATE TABLE yq_keyword (
  keyword_id           BIGINT         NOT NULL COMMENT '关键词ID,主键',
  group_id             BIGINT         NOT NULL COMMENT '所属分组ID',
  keyword_text         VARCHAR(100)   NOT NULL COMMENT '关键词文本',
  keyword_type         VARCHAR(20)    NOT NULL DEFAULT 'fuzzy' COMMENT '关键词类型',
  keyword_category     VARCHAR(20)    NOT NULL DEFAULT 'core' COMMENT '关键词分类',
  combo_expression     VARCHAR(500)   DEFAULT NULL COMMENT '组合表达式（type=combo 必填）',
  ref_count            INT            DEFAULT '0' COMMENT '被引用次数',
  status               CHAR(1)        DEFAULT '0' COMMENT '状态（0正常 1停用）',
  del_flag             CHAR(1)        DEFAULT '0' COMMENT '删除标志（0存在 2删除）',
  remark               VARCHAR(200)   DEFAULT NULL COMMENT '备注',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (keyword_id),
  KEY idx_yq_kw_group (group_id),
  KEY idx_yq_kw_text (keyword_text),
  KEY idx_yq_kw_cat (keyword_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='关键词';

-- ============================================================
-- 任务关键词关联表 yq_task_keyword
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   无逻辑删除
-- ============================================================
DROP TABLE IF EXISTS yq_task_keyword;
CREATE TABLE yq_task_keyword (
  id                   BIGINT         NOT NULL COMMENT '主键',
  task_id              BIGINT         NOT NULL COMMENT '任务ID',
  keyword_id           BIGINT         NOT NULL COMMENT '关键词ID',
  match_strategy       VARCHAR(20)    DEFAULT NULL COMMENT '任务级匹配策略（覆盖全局）',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_yq_tk_task (task_id),
  KEY idx_yq_tk_kw (keyword_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务关键词关联';

-- ============================================================
-- 任务渠道关联表 yq_task_channel
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   无逻辑删除
-- ============================================================
DROP TABLE IF EXISTS yq_task_channel;
CREATE TABLE yq_task_channel (
  id                   BIGINT         NOT NULL COMMENT '主键',
  task_id              BIGINT         NOT NULL COMMENT '任务ID',
  channel_id           BIGINT         NOT NULL COMMENT '渠道ID',
  override_interval    INT            DEFAULT NULL COMMENT '任务级频率覆盖（秒）',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_yq_tc_task (task_id),
  KEY idx_yq_tc_channel (channel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务渠道关联';

-- ============================================================
-- 采集渠道表 yq_channel
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS yq_channel;
CREATE TABLE yq_channel (
  channel_id           BIGINT         NOT NULL COMMENT '渠道ID,主键',
  channel_name         VARCHAR(50)    NOT NULL COMMENT '渠道名称',
  channel_category     VARCHAR(20)    NOT NULL DEFAULT 'news' COMMENT '渠道类别',
  channel_domain       VARCHAR(200)   DEFAULT NULL COMMENT '域名或平台标识',
  adapter_class        VARCHAR(100)   DEFAULT NULL COMMENT '站点适配器标识（YAML 配置键）',
  collector_id         BIGINT         DEFAULT NULL COMMENT '绑定采集器ID',
  interval_override    INT            DEFAULT '0' COMMENT '渠道级频率覆盖（秒）',
  request_interval     INT            DEFAULT '3000' COMMENT '请求间隔（毫秒）',
  concurrency_limit    INT            DEFAULT '2' COMMENT '并发上限',
  proxy_group_id       BIGINT         DEFAULT NULL COMMENT '代理池分组ID',
  ua_pool_id           BIGINT         DEFAULT NULL COMMENT 'UA 池ID',
  fail_rate_threshold  INT            DEFAULT '30' COMMENT '失败率告警阈值（%）',
  last_collect_time    DATETIME       DEFAULT NULL COMMENT '最近采集时间',
  status               CHAR(1)        DEFAULT '0' COMMENT '状态（0正常 1停用）',
  del_flag             CHAR(1)        DEFAULT '0' COMMENT '删除标志（0存在 2删除）',
  remark               VARCHAR(500)   DEFAULT NULL COMMENT '备注',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (channel_id),
  UNIQUE KEY uk_yq_channel_name (channel_name),
  KEY idx_yq_channel_cat (channel_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采集渠道';

-- ============================================================
-- 降噪规则表 yq_noise_rule
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   无逻辑删除
-- ============================================================
DROP TABLE IF EXISTS yq_noise_rule;
CREATE TABLE yq_noise_rule (
  rule_id              BIGINT         NOT NULL COMMENT '规则ID,主键',
  rule_name            VARCHAR(50)    NOT NULL COMMENT '规则名称',
  rule_type            VARCHAR(20)    NOT NULL DEFAULT 'system' COMMENT '规则类型',
  noise_category       VARCHAR(30)    NOT NULL DEFAULT 'advertisement' COMMENT '降噪类别',
  match_type           VARCHAR(20)    NOT NULL DEFAULT 'keyword' COMMENT '匹配方式',
  match_value          VARCHAR(500)   NOT NULL COMMENT '匹配内容',
  priority             INT            DEFAULT '10' COMMENT '执行优先级',
  status               CHAR(1)        DEFAULT '0' COMMENT '状态（0正常 1停用）',
  remark               VARCHAR(500)   DEFAULT NULL COMMENT '备注',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (rule_id),
  UNIQUE KEY uk_yq_noise_name (rule_name),
  KEY idx_yq_noise_cat (noise_category, priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='降噪规则';

-- ============================================================
-- 研判分级规则表 yq_level_rule
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   无逻辑删除
-- ============================================================
DROP TABLE IF EXISTS yq_level_rule;
CREATE TABLE yq_level_rule (
  rule_id              BIGINT         NOT NULL COMMENT '规则ID,主键',
  rule_name            VARCHAR(50)    NOT NULL COMMENT '规则名称',
  is_default           CHAR(1)        DEFAULT '1' COMMENT '是否默认规则（0是 1否）',
  score_metric         VARCHAR(30)    NOT NULL DEFAULT 'heat_score' COMMENT '评分依据',
  level_ranges         JSON           NOT NULL COMMENT '四档分级区间定义',
  risk_mapping         JSON           NOT NULL COMMENT '三级风险等级判定条件',
  senti_threshold      DECIMAL(5,2)   DEFAULT '0.30' COMMENT '负面情感占比判定阈值',
  status               CHAR(1)        DEFAULT '0' COMMENT '状态（0正常 1停用）',
  remark               VARCHAR(500)   DEFAULT NULL COMMENT '备注',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (rule_id),
  UNIQUE KEY uk_yq_level_name (rule_name),
  KEY idx_yq_level_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='研判分级规则';

-- ============================================================
-- 标签表 yq_tag
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS yq_tag;
CREATE TABLE yq_tag (
  tag_id               BIGINT         NOT NULL COMMENT '标签ID,主键',
  tag_name             VARCHAR(50)    NOT NULL COMMENT '标签名称',
  parent_id            BIGINT         DEFAULT NULL COMMENT '父标签ID（顶级为0）',
  order_num            INT            DEFAULT NULL COMMENT '显示顺序',
  status               CHAR(1)        DEFAULT '0' COMMENT '状态（0正常 1停用）',
  del_flag             CHAR(1)        DEFAULT '0' COMMENT '删除标志（0存在 2删除）',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (tag_id),
  UNIQUE KEY uk_yq_tag_name (tag_name),
  KEY idx_yq_tag_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签';

-- ============================================================
-- 预警规则表 yq_alert_rule
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   无逻辑删除
-- ============================================================
DROP TABLE IF EXISTS yq_alert_rule;
CREATE TABLE yq_alert_rule (
  rule_id              BIGINT         NOT NULL COMMENT '规则ID,主键',
  rule_name            VARCHAR(50)    NOT NULL COMMENT '规则名称',
  trigger_scenes       VARCHAR(200)   DEFAULT 'new_negative,high_risk' COMMENT '触发场景（逗号分隔）',
  window_minutes       INT            NOT NULL DEFAULT '10' COMMENT '统计时间窗口（分钟）',
  count_threshold      INT            DEFAULT NULL COMMENT '条数阈值',
  heat_threshold       INT            DEFAULT NULL COMMENT '热度阈值',
  risk_level_threshold VARCHAR(20)    DEFAULT 'moderate' COMMENT '最低触发风险等级',
  spread_threshold     VARCHAR(20)    DEFAULT 'medium' COMMENT '最低触发传播量级',
  burst_ratio          DECIMAL(5,2)   DEFAULT '3.00' COMMENT '突发增量倍数阈值',
  min_burst_count      INT            DEFAULT '5' COMMENT '突发增量最小条数（防小样本虚高）',
  cooldown_minutes     INT            DEFAULT '360' COMMENT '同一事件聚合冷却期（分钟）',
  topic_tags           VARCHAR(500)   DEFAULT NULL COMMENT '重点专项标签（逗号分隔）',
  alert_level          VARCHAR(20)    NOT NULL DEFAULT 'warning' COMMENT '预警级别',
  push_level           VARCHAR(20)    NOT NULL DEFAULT 'immediate' COMMENT '推送级别',
  notify_user_ids      VARCHAR(1000)  DEFAULT NULL COMMENT '通知人用户ID（逗号分隔）',
  status               CHAR(1)        DEFAULT '0' COMMENT '状态（0正常 1停用）',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (rule_id),
  UNIQUE KEY uk_yq_alertrule_name (rule_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警规则';

-- ============================================================
-- 预警记录表 yq_alert
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   无逻辑删除
-- ============================================================
DROP TABLE IF EXISTS yq_alert;
CREATE TABLE yq_alert (
  alert_id             BIGINT         NOT NULL COMMENT '预警ID,主键',
  rule_id              BIGINT         DEFAULT NULL COMMENT '触发规则ID',
  opinion_id           BIGINT         DEFAULT NULL COMMENT '关联舆情ID',
  cluster_id           BIGINT         DEFAULT NULL COMMENT '关联事件聚合ID',
  alert_title          VARCHAR(300)   NOT NULL COMMENT '预警标题',
  trigger_scene        VARCHAR(30)    NOT NULL DEFAULT 'new_negative' COMMENT '触发场景',
  alert_level          VARCHAR(20)    NOT NULL DEFAULT 'warning' COMMENT '预警级别',
  trigger_value        VARCHAR(200)   DEFAULT NULL COMMENT '触发值描述',
  fingerprint          VARCHAR(64)    DEFAULT NULL COMMENT '事件聚合指纹（同指纹冷却期内不重复预警）',
  trigger_time         DATETIME       NOT NULL COMMENT '触发时间',
  status               VARCHAR(20)    NOT NULL DEFAULT 'pending' COMMENT '处置状态',
  process_remark       VARCHAR(500)   DEFAULT NULL COMMENT '处置说明',
  process_by           BIGINT         DEFAULT NULL COMMENT '处置人用户ID',
  process_time         DATETIME       DEFAULT NULL COMMENT '处置时间',
  push_result          VARCHAR(20)    DEFAULT NULL COMMENT '推送结果',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (alert_id),
  KEY idx_yq_alert_status (status, trigger_time),
  KEY idx_yq_alert_opinion (opinion_id),
  KEY idx_yq_alert_cluster (cluster_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警记录';

-- ============================================================
-- 推送规则表 yq_push_rule
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   无逻辑删除
-- ============================================================
DROP TABLE IF EXISTS yq_push_rule;
CREATE TABLE yq_push_rule (
  rule_id              BIGINT         NOT NULL COMMENT '规则ID,主键',
  rule_name            VARCHAR(50)    NOT NULL COMMENT '规则名称',
  push_scenes          VARCHAR(200)   NOT NULL COMMENT '推送场景（逗号分隔）',
  push_level           VARCHAR(20)    NOT NULL DEFAULT 'immediate' COMMENT '推送级别',
  schedule_cron        VARCHAR(50)    DEFAULT NULL COMMENT '定时批量 cron',
  push_template_id     BIGINT         DEFAULT NULL COMMENT '推送模板ID',
  target_type          VARCHAR(20)    NOT NULL DEFAULT 'user' COMMENT '目标类型',
  target_ids           VARCHAR(1000)  NOT NULL COMMENT '目标ID（逗号分隔）',
  quiet_start          VARCHAR(5)     DEFAULT '22:00' COMMENT '免打扰开始时间 HH:mm',
  quiet_end            VARCHAR(5)     DEFAULT '08:00' COMMENT '免打扰结束时间 HH:mm',
  max_retry            INT            DEFAULT '3' COMMENT '失败重试上限',
  status               CHAR(1)        DEFAULT '0' COMMENT '状态（0正常 1停用）',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (rule_id),
  UNIQUE KEY uk_yq_pushrule_name (rule_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='推送规则';

-- ============================================================
-- 推送模板表 yq_push_template
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   无逻辑删除
-- ============================================================
DROP TABLE IF EXISTS yq_push_template;
CREATE TABLE yq_push_template (
  template_id          BIGINT         NOT NULL COMMENT '模板ID,主键',
  template_name        VARCHAR(50)    NOT NULL COMMENT '模板名称',
  content_type         VARCHAR(20)    NOT NULL DEFAULT 'summary' COMMENT '内容形式',
  body_template        TEXT           NOT NULL COMMENT '模板正文（含占位符）',
  field_list           VARCHAR(1000)  NOT NULL COMMENT '模板包含字段清单',
  status               CHAR(1)        DEFAULT '0' COMMENT '状态（0正常 1停用）',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (template_id),
  UNIQUE KEY uk_yq_pushtpl_name (template_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='推送模板';

-- ============================================================
-- 推送记录表 yq_push_record
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   无逻辑删除
-- ============================================================
DROP TABLE IF EXISTS yq_push_record;
CREATE TABLE yq_push_record (
  record_id            BIGINT         NOT NULL COMMENT '记录ID,主键',
  rule_id              BIGINT         DEFAULT NULL COMMENT '推送规则ID',
  push_scene           VARCHAR(30)    NOT NULL DEFAULT 'new_opinion' COMMENT '推送场景',
  push_level           VARCHAR(20)    NOT NULL DEFAULT 'immediate' COMMENT '推送级别',
  content_snapshot     TEXT           NOT NULL COMMENT '推送内容快照',
  target_ids           VARCHAR(1000)  DEFAULT NULL COMMENT '实际接收人（逗号分隔）',
  opinion_ids          VARCHAR(1000)  DEFAULT NULL COMMENT '关联舆情ID（逗号分隔）',
  report_id            BIGINT         DEFAULT NULL COMMENT '关联报告ID',
  send_status          VARCHAR(20)    NOT NULL DEFAULT 'pending' COMMENT '发送状态',
  retry_count          INT            DEFAULT '0' COMMENT '已重试次数',
  fail_reason          VARCHAR(500)   DEFAULT NULL COMMENT '失败原因',
  send_time            DATETIME       DEFAULT NULL COMMENT '发送时间',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (record_id),
  KEY idx_yq_pushrec_status (send_status, create_time),
  KEY idx_yq_pushrec_scene (push_scene)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='推送记录';

-- ============================================================
-- 企业微信指令表 yq_wecom_command
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   无逻辑删除
-- ============================================================
DROP TABLE IF EXISTS yq_wecom_command;
CREATE TABLE yq_wecom_command (
  command_id           BIGINT         NOT NULL COMMENT '主键',
  user_id              BIGINT         NOT NULL COMMENT '发起人用户ID',
  wecom_user_id        VARCHAR(100)   NOT NULL COMMENT '企业微信成员ID',
  command_text         VARCHAR(500)   NOT NULL COMMENT '指令原文',
  command_type         VARCHAR(50)    DEFAULT NULL COMMENT '识别出的指令类型',
  parsed_params        VARCHAR(1000)  DEFAULT NULL COMMENT '解析出的参数（JSON）',
  ref_task_id          BIGINT         DEFAULT NULL COMMENT '关联任务ID',
  ref_report_id        BIGINT         DEFAULT NULL COMMENT '关联报告ID',
  exec_status          VARCHAR(20)    NOT NULL DEFAULT 'pending' COMMENT '执行状态',
  exec_result          VARCHAR(1000)  DEFAULT NULL COMMENT '执行结果摘要',
  exec_time            DATETIME       DEFAULT NULL COMMENT '执行时间',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (command_id),
  KEY idx_yq_cmd_status (exec_status, create_time),
  KEY idx_yq_cmd_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业微信指令';

-- ============================================================
-- 报告模板表 yq_report_template
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS yq_report_template;
CREATE TABLE yq_report_template (
  template_id          BIGINT         NOT NULL COMMENT '模板ID,主键',
  template_name        VARCHAR(50)    NOT NULL COMMENT '模板名称',
  report_type          VARCHAR(20)    NOT NULL DEFAULT 'daily' COMMENT '报告类型',
  is_default           CHAR(1)        DEFAULT '0' COMMENT '是否同类型默认（0否 1是）',
  cover_fields         VARCHAR(1000)  DEFAULT NULL COMMENT '封面字段（JSON）',
  font_family          VARCHAR(50)    DEFAULT '仿宋_GB2312' COMMENT '正文字体',
  heading_number_rule  VARCHAR(20)    DEFAULT 'chinese' COMMENT '标题编号规则',
  status               CHAR(1)        DEFAULT '0' COMMENT '状态（0正常 1停用）',
  del_flag             CHAR(1)        DEFAULT '0' COMMENT '删除标志（0存在 2删除）',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (template_id),
  UNIQUE KEY uk_yq_rpttpl_name (template_name),
  KEY idx_yq_rpttpl_type (report_type, is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报告模板';

-- ============================================================
-- 报告模板章节表 yq_report_section
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   无逻辑删除
-- ============================================================
DROP TABLE IF EXISTS yq_report_section;
CREATE TABLE yq_report_section (
  section_id           BIGINT         NOT NULL COMMENT '主键',
  template_id          BIGINT         NOT NULL COMMENT '所属模板ID',
  section_code         VARCHAR(50)    NOT NULL COMMENT '章节编码',
  section_name         VARCHAR(100)   NOT NULL COMMENT '章节标题',
  order_num            INT            DEFAULT NULL COMMENT '排序',
  required             CHAR(1)        DEFAULT '1' COMMENT '是否必含（0否 1是）',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (section_id),
  KEY idx_yq_rptsec_tpl (template_id, order_num)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报告模板章节';

-- ============================================================
-- 舆情报告表 yq_report
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS yq_report;
CREATE TABLE yq_report (
  report_id            BIGINT         NOT NULL COMMENT '报告ID,主键',
  report_name          VARCHAR(200)   NOT NULL COMMENT '报告名称',
  report_type          VARCHAR(20)    NOT NULL DEFAULT 'daily' COMMENT '报告类型',
  report_date          DATE           NOT NULL COMMENT '报告归属日期',
  template_id          BIGINT         DEFAULT NULL COMMENT '使用模板ID',
  trigger_type         VARCHAR(20)    NOT NULL DEFAULT 'manual' COMMENT '生成方式',
  content              TEXT           DEFAULT NULL COMMENT '报告正文（渲染后）',
  file_url             VARCHAR(500)   DEFAULT NULL COMMENT '报告文件URL（MinIO）',
  file_format          VARCHAR(20)    DEFAULT NULL COMMENT '文件格式',
  version              INT            DEFAULT '1' COMMENT '版本号',
  status               VARCHAR(20)    NOT NULL DEFAULT 'generating' COMMENT '状态',
  submit_status        VARCHAR(20)    DEFAULT 'unsubmitted' COMMENT '提交状态',
  submit_by            BIGINT         DEFAULT NULL COMMENT '提交人用户ID',
  submit_time          DATETIME       DEFAULT NULL COMMENT '提交时间',
  fail_reason          VARCHAR(1000)  DEFAULT NULL COMMENT '生成失败原因',
  del_flag             CHAR(1)        DEFAULT '0' COMMENT '删除标志（0存在 2删除）',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (report_id),
  KEY idx_yq_report_type (report_type, report_date),
  KEY idx_yq_report_status (status),
  KEY idx_yq_report_submit (submit_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='舆情报告';

-- ============================================================
-- 报告舆情关联表 yq_report_opinion
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   无逻辑删除
-- ============================================================
DROP TABLE IF EXISTS yq_report_opinion;
CREATE TABLE yq_report_opinion (
  id                   BIGINT         NOT NULL COMMENT '主键',
  report_id            BIGINT         NOT NULL COMMENT '报告ID',
  opinion_id           BIGINT         NOT NULL COMMENT '舆情ID',
  include_source       VARCHAR(20)    NOT NULL DEFAULT 'auto' COMMENT '纳入方式',
  operate_by           BIGINT         DEFAULT NULL COMMENT '增删操作人',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_yq_rptop_report (report_id),
  KEY idx_yq_rptop_opinion (opinion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报告舆情关联';

-- ============================================================
-- 知识库案例表 yq_knowledge
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS yq_knowledge;
CREATE TABLE yq_knowledge (
  knowledge_id         BIGINT         NOT NULL COMMENT '案例ID,主键',
  opinion_id           BIGINT         DEFAULT NULL COMMENT '来源舆情ID',
  case_type            VARCHAR(30)    NOT NULL DEFAULT 'negative_risk' COMMENT '案例类型',
  case_title           VARCHAR(300)   NOT NULL COMMENT '案例标题',
  origin_data          TEXT           DEFAULT NULL COMMENT '原始数据快照（JSON）',
  opinion_url          VARCHAR(1000)  DEFAULT NULL COMMENT '舆情链接',
  analyze_result       TEXT           DEFAULT NULL COMMENT '研判结果快照',
  level_tags           VARCHAR(200)   DEFAULT NULL COMMENT '分级标签',
  process_record       VARCHAR(1000)  DEFAULT NULL COMMENT '处置记录',
  manual_correction    VARCHAR(1000)  DEFAULT NULL COMMENT '人工修正标注',
  scene_category       VARCHAR(50)    DEFAULT NULL COMMENT '场景分类',
  risk_feature         VARCHAR(500)   DEFAULT NULL COMMENT '风险特征',
  keyword_feature      VARCHAR(500)   DEFAULT NULL COMMENT '关键词特征',
  status               CHAR(1)        DEFAULT '0' COMMENT '状态（0有效 1已淘汰）',
  del_flag             CHAR(1)        DEFAULT '0' COMMENT '删除标志（0存在 2删除）',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (knowledge_id),
  KEY idx_yq_know_type (case_type, status),
  KEY idx_yq_know_scene (scene_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识库案例';

-- ============================================================
-- 训练样本表 yq_train_sample
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   不继承 BaseEntity（表内无完整审计列）;
--                   无逻辑删除
-- ============================================================
DROP TABLE IF EXISTS yq_train_sample;
CREATE TABLE yq_train_sample (
  sample_id            BIGINT         NOT NULL COMMENT '样本ID,主键',
  knowledge_id         BIGINT         DEFAULT NULL COMMENT '来源案例ID',
  model_version_id     BIGINT         DEFAULT NULL COMMENT '使用的模型版本ID',
  sample_status        VARCHAR(20)    NOT NULL DEFAULT 'pending' COMMENT '样本状态',
  label_content        VARCHAR(1000)  DEFAULT NULL COMMENT '标注内容（JSON）',
  labeled_by           BIGINT         DEFAULT NULL COMMENT '标注人',
  labeled_time         DATETIME       DEFAULT NULL COMMENT '标注时间',
  PRIMARY KEY (sample_id),
  KEY idx_yq_sample_status (sample_status),
  KEY idx_yq_sample_model (model_version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='训练样本';

-- ============================================================
-- 模型版本表 yq_model_version
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   不继承 BaseEntity（表内无完整审计列）;
--                   无逻辑删除
-- ============================================================
DROP TABLE IF EXISTS yq_model_version;
CREATE TABLE yq_model_version (
  model_version_id     BIGINT         NOT NULL COMMENT '主键',
  version_name         VARCHAR(50)    NOT NULL COMMENT '版本名称',
  model_type           VARCHAR(20)    NOT NULL DEFAULT 'base' COMMENT '类型',
  provider             VARCHAR(50)    DEFAULT 'deepseek' COMMENT '提供方',
  sample_count         INT            DEFAULT NULL COMMENT '训练样本量',
  train_time           DATETIME       DEFAULT NULL COMMENT '训练时间',
  eval_accuracy        DECIMAL(5,2)   DEFAULT NULL COMMENT '评测准确率（%）',
  is_active            CHAR(1)        DEFAULT '0' COMMENT '是否启用（0否 1是）',
  rollback_from        BIGINT         DEFAULT NULL COMMENT '从哪个版本回滚而来',
  remark               VARCHAR(500)   DEFAULT NULL COMMENT '备注/回滚原因',
  PRIMARY KEY (model_version_id),
  UNIQUE KEY uk_yq_modelver_name (version_name),
  KEY idx_yq_modelver_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模型版本';

-- ============================================================
-- 净化批次表 yq_clean_batch
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   无逻辑删除
-- ============================================================
DROP TABLE IF EXISTS yq_clean_batch;
CREATE TABLE yq_clean_batch (
  batch_id             BIGINT         NOT NULL COMMENT '批次ID,主键',
  batch_name           VARCHAR(100)   NOT NULL COMMENT '批次名称',
  batch_type           VARCHAR(20)    NOT NULL DEFAULT 'condition_replay' COMMENT '重跑类型',
  scope_task_id        BIGINT         DEFAULT NULL COMMENT '范围-任务ID',
  scope_channel_id     BIGINT         DEFAULT NULL COMMENT '范围-渠道ID',
  scope_start_date     DATE           DEFAULT NULL COMMENT '范围-起始采集日',
  scope_end_date       DATE           DEFAULT NULL COMMENT '范围-截止采集日',
  total_count          INT            DEFAULT '0' COMMENT '扫描条数',
  cleaned_count        INT            DEFAULT '0' COMMENT '净化保留条数',
  rejected_count       INT            DEFAULT '0' COMMENT '降噪剔除条数',
  dup_count            INT            DEFAULT '0' COMMENT '链接去重条数',
  dup_channel_count    INT            DEFAULT '0' COMMENT '跨渠道重复条数',
  noise_spam           INT            DEFAULT '0' COMMENT '垃圾内容剔除量',
  noise_advertisement  INT            DEFAULT '0' COMMENT '广告营销剔除量',
  noise_flooding       INT            DEFAULT '0' COMMENT '灌水评论剔除量',
  noise_meaningless    INT            DEFAULT '0' COMMENT '无意义短句剔除量',
  noise_bot            INT            DEFAULT '0' COMMENT '机器人内容剔除量',
  noise_blank          INT            DEFAULT '0' COMMENT '空白内容剔除量',
  noise_violation      INT            DEFAULT '0' COMMENT '违规屏蔽剔除量',
  preview_only         CHAR(1)        DEFAULT '0' COMMENT '仅预览未落库（0否 1是）',
  status               VARCHAR(20)    NOT NULL DEFAULT 'running' COMMENT '执行状态',
  fail_reason          VARCHAR(1000)  DEFAULT NULL COMMENT '失败原因',
  cost_ms              INT            DEFAULT NULL COMMENT '耗时（毫秒）',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='净化批次';

-- ============================================================
-- 聚合批次表 yq_stats_batch
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   无逻辑删除
-- ============================================================
DROP TABLE IF EXISTS yq_stats_batch;
CREATE TABLE yq_stats_batch (
  batch_id             BIGINT         NOT NULL COMMENT '批次ID,主键',
  batch_no             VARCHAR(50)    NOT NULL COMMENT '批次号',
  begin_date           DATE           NOT NULL COMMENT '聚合起始统计日',
  end_date             DATE           NOT NULL COMMENT '聚合截止统计日',
  trigger_type         VARCHAR(20)    NOT NULL DEFAULT 'auto' COMMENT '触发方式',
  status               VARCHAR(20)    NOT NULL DEFAULT 'running' COMMENT '执行状态',
  source_count         INT            DEFAULT '0' COMMENT '读取明细条数',
  daily_rows           INT            DEFAULT '0' COMMENT '写入 daily 行数',
  dim_rows             INT            DEFAULT '0' COMMENT '写入 dim 行数',
  hot_rows             INT            DEFAULT '0' COMMENT '写入 hot 行数',
  cost_ms              BIGINT         DEFAULT NULL COMMENT '耗时（毫秒）',
  data_until           DATETIME       DEFAULT NULL COMMENT '数据截止时间（本次覆盖到的最新发布时间）',
  notice               VARCHAR(500)   DEFAULT NULL COMMENT '非致命提示（如命中读取上限被截断）',
  conclusion_json      TEXT           DEFAULT NULL COMMENT '结构化分析结论（JSON）',
  fail_reason          VARCHAR(1000)  DEFAULT NULL COMMENT '失败原因',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聚合批次';

-- ============================================================
-- 台账导出记录表 yq_ledger_export_log
-- 来源: PRD §5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增);
--                   继承 BaseEntity，含 create_dept/create_by/create_time/update_by/update_time;
--                   无逻辑删除
-- ============================================================
DROP TABLE IF EXISTS yq_ledger_export_log;
CREATE TABLE yq_ledger_export_log (
  export_id            BIGINT         NOT NULL COMMENT '导出记录ID,主键',
  export_scope         VARCHAR(20)    NOT NULL DEFAULT 'ledger' COMMENT '导出范围（台账/事件聚合）',
  query_summary        VARCHAR(1000)  DEFAULT NULL COMMENT '筛选条件可读摘要',
  query_json           TEXT           DEFAULT NULL COMMENT '筛选条件快照（JSON）',
  columns_json         TEXT           DEFAULT NULL COMMENT '导出字段清单（JSON 数组）',
  row_count            INT            DEFAULT '0' COMMENT '导出条数',
  column_count         INT            DEFAULT '0' COMMENT '导出字段数',
  export_mode          VARCHAR(20)    NOT NULL DEFAULT 'sync' COMMENT '导出方式（sync同步 / async异步）',
  status               VARCHAR(20)    NOT NULL DEFAULT 'pending' COMMENT '任务状态（pending/running/success/failed）',
  file_name            VARCHAR(300)   DEFAULT NULL COMMENT '导出文件名',
  file_url             VARCHAR(1000)  DEFAULT NULL COMMENT '下载地址（异步任务完成后回填）',
  finish_time          DATETIME       DEFAULT NULL COMMENT '完成时间',
  fail_reason          VARCHAR(1000)  DEFAULT NULL COMMENT '失败原因',
  oper_ip              VARCHAR(64)    DEFAULT NULL COMMENT '操作来源IP',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (export_id),
  KEY idx_yq_lexp_owner (create_by, create_time),
  KEY idx_yq_lexp_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='台账导出记录';

SET FOREIGN_KEY_CHECKS = 1;