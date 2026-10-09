-- ============================================================
-- Doris 事实表的 MySQL 兼容建表（仅用于本地无 Doris 环境联调）
-- 用途: 当 yuqing.collect.sink.mode=jdbc 时，把 dynamic-datasource 的 doris 数据源
--       指向 MySQL，用本脚本在同名库中建出等价表结构，先跑通全链路。
-- ⚠ 生产环境必须用 yq_doris_schema.sql 在 Apache Doris 中建表（Unique Key + Merge-on-Write
--   才能带来去重与高吞吐写入能力，MySQL 版仅作结构等价替代）。
-- 对应产物: 9 张 Doris 事实表（含 F-009 的 yq_stats_dim / yq_stats_hot）
-- 执行顺序: 在 yq_schema.sql 之后执行
-- ============================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS yq_opinion;
CREATE TABLE yq_opinion (
  collect_date     DATE          NOT NULL COMMENT '分区列=采集日期',
  url_hash         CHAR(64)      NOT NULL COMMENT '链接 SHA-256（唯一去重主键载体）',
  opinion_id       BIGINT        NOT NULL COMMENT '舆情ID',
  task_id          BIGINT        DEFAULT NULL COMMENT '所属任务ID',
  channel_id       BIGINT        NOT NULL COMMENT '来源渠道ID',
  title            VARCHAR(500)  NOT NULL COMMENT '舆情标题',
  content          MEDIUMTEXT    DEFAULT NULL COMMENT '原文内容',
  opinion_url      VARCHAR(1000) NOT NULL COMMENT '原文链接',
  publish_time     DATETIME      DEFAULT NULL COMMENT '发布时间',
  author           VARCHAR(200)  DEFAULT NULL COMMENT '发布作者/主体',
  like_count       BIGINT        DEFAULT NULL COMMENT '点赞量',
  comment_count    BIGINT        DEFAULT NULL COMMENT '评论量',
  share_count      BIGINT        DEFAULT NULL COMMENT '转发量',
  read_count       BIGINT        DEFAULT NULL COMMENT '阅读量',
  region           VARCHAR(100)  DEFAULT NULL COMMENT '发布地域',
  device_info      VARCHAR(200)  DEFAULT NULL COMMENT '设备信息',
  topic_tags       VARCHAR(500)  DEFAULT NULL COMMENT '话题标签（逗号分隔）',
  heat_score       INT           DEFAULT NULL COMMENT '综合热度分值',
  senti_attr       VARCHAR(20)   DEFAULT NULL COMMENT '舆情属性',
  opinion_level    VARCHAR(20)   DEFAULT NULL COMMENT '舆情分级',
  risk_level       VARCHAR(20)   DEFAULT NULL COMMENT '风险等级',
  spread_level     VARCHAR(20)   DEFAULT NULL COMMENT '传播量级',
  cluster_id       BIGINT        DEFAULT NULL COMMENT '事件聚合ID',
  collect_source   VARCHAR(20)   NOT NULL COMMENT '采集来源',
  collect_time     DATETIME      NOT NULL COMMENT '采集时间',
  batch_no         VARCHAR(50)   DEFAULT NULL COMMENT '采集批次号',
  clean_status     VARCHAR(20)   NOT NULL COMMENT '清洗状态',
  noise_reason     VARCHAR(200)  DEFAULT NULL COMMENT '降噪剔除原因',
  dup_channel_ids  VARCHAR(500)  DEFAULT NULL COMMENT '重复渠道ID（逗号分隔，F-006 验收标准 8）',
  clean_time       DATETIME      DEFAULT NULL COMMENT '净化时间（F-006）',
  analyze_status   VARCHAR(20)   NOT NULL COMMENT '研判状态',
  alert_flag       CHAR(1)       DEFAULT '0' COMMENT '是否已预警（0否 1是）',
  push_flag        CHAR(1)       DEFAULT '0' COMMENT '是否已推送（0否 1是）',
  del_flag         CHAR(1)       DEFAULT '0' COMMENT '删除标志（0存在 2删除）',
  PRIMARY KEY (collect_date, url_hash),
  KEY idx_yq_opinion_task (task_id),
  KEY idx_yq_opinion_channel (channel_id),
  KEY idx_yq_opinion_publish (publish_time),
  KEY idx_yq_opinion_clean (clean_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='舆情明细（Doris yq_opinion 的 MySQL 兼容镜像）';

DROP TABLE IF EXISTS yq_collect_log;
CREATE TABLE yq_collect_log (
  log_id          BIGINT        NOT NULL COMMENT '主键',
  task_id         BIGINT        DEFAULT NULL COMMENT '任务ID',
  channel_id      BIGINT        DEFAULT NULL COMMENT '渠道ID',
  batch_no        VARCHAR(50)   NOT NULL COMMENT '采集批次号',
  collect_source  VARCHAR(20)   NOT NULL COMMENT '采集来源',
  strategy        VARCHAR(20)   DEFAULT NULL COMMENT '采集策略',
  fetched_count   INT           DEFAULT NULL COMMENT '抓取条数',
  inserted_count  INT           DEFAULT NULL COMMENT '入库条数',
  dup_count       INT           DEFAULT NULL COMMENT '去重剔除条数',
  rejected_count  INT           DEFAULT NULL COMMENT '降噪剔除条数',
  failed_count    INT           DEFAULT NULL COMMENT '失败条数',
  cost_ms         INT           DEFAULT NULL COMMENT '耗时（毫秒）',
  result_status   VARCHAR(20)   NOT NULL COMMENT '执行结果',
  fail_reason     VARCHAR(1000) DEFAULT NULL COMMENT '失败原因',
  create_time     DATETIME      DEFAULT NULL COMMENT '记录时间',
  PRIMARY KEY (log_id),
  KEY idx_yq_log_task (task_id),
  KEY idx_yq_log_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采集日志（Doris yq_collect_log 的 MySQL 兼容镜像）';

DROP TABLE IF EXISTS yq_opinion_analysis;
CREATE TABLE yq_opinion_analysis (
  analysis_id     BIGINT        NOT NULL COMMENT '研判结果ID',
  opinion_id      BIGINT        NOT NULL COMMENT '舆情ID',
  topic           VARCHAR(200)  DEFAULT NULL COMMENT '主题识别结果',
  summary         VARCHAR(1000) DEFAULT NULL COMMENT '核心内容提炼',
  senti_attr      VARCHAR(20)   DEFAULT NULL COMMENT '情感倾向判定',
  risk_attr       VARCHAR(200)  DEFAULT NULL COMMENT '风险属性判定',
  risk_level      VARCHAR(20)   DEFAULT NULL COMMENT '风险等级',
  opinion_level   VARCHAR(20)   DEFAULT NULL COMMENT '舆情分级',
  tags            VARCHAR(500)  DEFAULT NULL COMMENT '模型输出标签（逗号分隔）',
  match_evidence  VARCHAR(1000) DEFAULT NULL COMMENT '隐性/变体命中依据',
  suggestion      VARCHAR(1000) DEFAULT NULL COMMENT '处置建议',
  confidence      DECIMAL(5,2)  DEFAULT NULL COMMENT '置信度（%）',
  model_version   VARCHAR(50)   DEFAULT NULL COMMENT '模型版本',
  prompt_version  VARCHAR(50)   DEFAULT NULL COMMENT '提示词版本',
  analyze_version INT           DEFAULT NULL COMMENT '研判版本号',
  corrected_flag  CHAR(1)       DEFAULT '0' COMMENT '是否人工修正（0否 1是）',
  corrected_by    BIGINT        DEFAULT NULL COMMENT '修正人用户ID',
  corrected_time  DATETIME      DEFAULT NULL COMMENT '修正时间',
  analyze_time    DATETIME      DEFAULT NULL COMMENT '研判时间',
  fail_reason     VARCHAR(1000) DEFAULT NULL COMMENT '失败原因',
  PRIMARY KEY (analysis_id),
  KEY idx_yq_analysis_opinion (opinion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='研判结果（Doris 兼容镜像）';

DROP TABLE IF EXISTS yq_opinion_tag;
CREATE TABLE yq_opinion_tag (
  id          BIGINT       NOT NULL COMMENT '主键',
  opinion_id  BIGINT       NOT NULL COMMENT '舆情ID',
  tag_id      BIGINT       NOT NULL COMMENT '标签ID',
  tag_source  VARCHAR(20)  NOT NULL COMMENT '标签来源',
  PRIMARY KEY (id),
  KEY idx_yq_optag_opinion (opinion_id),
  KEY idx_yq_optag_tag (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='舆情标签关联（Doris 兼容镜像）';

DROP TABLE IF EXISTS yq_opinion_cluster;
CREATE TABLE yq_opinion_cluster (
  cluster_id       BIGINT        NOT NULL COMMENT '聚合ID,主键',
  cluster_title    VARCHAR(200)  NOT NULL COMMENT '事件标题',
  cluster_topic    VARCHAR(200)  DEFAULT NULL COMMENT '事件主题',
  opinion_count    INT           DEFAULT NULL COMMENT '关联舆情条数',
  first_time       DATETIME      DEFAULT NULL COMMENT '首次出现时间',
  last_time        DATETIME      DEFAULT NULL COMMENT '最近出现时间',
  spread_path      VARCHAR(2000) DEFAULT NULL COMMENT '传播脉络（时间轴 JSON）',
  peak_heat        INT           DEFAULT NULL COMMENT '峰值热度',
  risk_level       VARCHAR(20)   DEFAULT NULL COMMENT '事件风险等级',
  create_time      DATETIME      DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (cluster_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='事件聚合（Doris 兼容镜像）';

DROP TABLE IF EXISTS yq_opinion_metric;
CREATE TABLE yq_opinion_metric (
  metric_id     BIGINT        NOT NULL COMMENT '指标ID,主键',
  opinion_id    BIGINT        DEFAULT NULL COMMENT '舆情ID',
  snapshot_date DATE          DEFAULT NULL COMMENT '快照日期',
  like_count    BIGINT        DEFAULT NULL COMMENT '点赞量',
  comment_count BIGINT        DEFAULT NULL COMMENT '评论量',
  share_count   BIGINT        DEFAULT NULL COMMENT '转发量',
  read_count    BIGINT        DEFAULT NULL COMMENT '阅读量',
  heat_score    INT           DEFAULT NULL COMMENT '热度分值',
  create_time   DATETIME      DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (metric_id),
  KEY idx_yq_metric_opinion (opinion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='互动快照（Doris 兼容镜像）';

DROP TABLE IF EXISTS yq_stats_daily;
CREATE TABLE yq_stats_daily (
  stats_date     DATE         NOT NULL COMMENT '统计日期',
  task_id        BIGINT       NOT NULL DEFAULT 0 COMMENT '任务ID（0=未归属）',
  channel_id     BIGINT       NOT NULL DEFAULT 0 COMMENT '渠道ID（0=未归属）',
  stats_id       BIGINT       NOT NULL COMMENT '统计ID',
  total_count    INT          DEFAULT NULL COMMENT '舆情总量',
  positive_count INT          DEFAULT NULL COMMENT '正面条数',
  neutral_count  INT          DEFAULT NULL COMMENT '中性条数',
  negative_count INT          DEFAULT NULL COMMENT '负面条数',
  dup_count      INT          DEFAULT NULL COMMENT '去重剔除条数',
  rejected_count INT          DEFAULT NULL COMMENT '降噪剔除条数',
  alert_count    INT          DEFAULT NULL COMMENT '预警条数',
  push_count     INT          DEFAULT NULL COMMENT '推送条数',
  report_count   INT          DEFAULT NULL COMMENT '报告生成数',
  read_sum       BIGINT       DEFAULT NULL COMMENT '阅读量合计',
  comment_sum    BIGINT       DEFAULT NULL COMMENT '评论量合计',
  share_sum      BIGINT       DEFAULT NULL COMMENT '转发量合计',
  like_sum       BIGINT       DEFAULT NULL COMMENT '点赞量合计',
  negative_rate  DECIMAL(5,2) DEFAULT NULL COMMENT '负面占比（%）',
  create_time    DATETIME     DEFAULT NULL COMMENT '聚合时间',
  PRIMARY KEY (stats_date, task_id, channel_id),
  KEY idx_yq_stats_daily_date (stats_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='统计预聚合（Doris yq_stats_daily 的 MySQL 兼容镜像，F-009）';

DROP TABLE IF EXISTS yq_stats_dim;
CREATE TABLE yq_stats_dim (
  stats_date     DATE         NOT NULL COMMENT '统计日期',
  dim_type       VARCHAR(20)  NOT NULL COMMENT '维度类型',
  dim_key        VARCHAR(96)  NOT NULL COMMENT '维度取值（ID 或文本）',
  time_grain     VARCHAR(10)  NOT NULL COMMENT '时间粒度',
  task_id        BIGINT       NOT NULL DEFAULT 0 COMMENT '任务ID（0=未归属）',
  channel_id     BIGINT       NOT NULL DEFAULT 0 COMMENT '渠道ID（0=未归属）',
  dim_id         BIGINT       NOT NULL COMMENT '主键',
  dim_label      VARCHAR(200) DEFAULT NULL COMMENT '维度展示名',
  opinion_count  INT          DEFAULT NULL COMMENT '舆情条数',
  positive_count INT          DEFAULT NULL COMMENT '正面条数',
  neutral_count  INT          DEFAULT NULL COMMENT '中性条数',
  negative_count INT          DEFAULT NULL COMMENT '负面条数',
  high_risk_count INT         DEFAULT NULL COMMENT '高风险条数',
  read_sum       BIGINT       DEFAULT NULL COMMENT '阅读量合计',
  comment_sum    BIGINT       DEFAULT NULL COMMENT '评论量合计',
  share_sum      BIGINT       DEFAULT NULL COMMENT '转发量合计',
  like_sum       BIGINT       DEFAULT NULL COMMENT '点赞量合计',
  heat_sum       BIGINT       DEFAULT NULL COMMENT '热度分值合计',
  negative_rate  DECIMAL(5,2) DEFAULT NULL COMMENT '负面占比（%）',
  create_time    DATETIME     DEFAULT NULL COMMENT '聚合时间',
  PRIMARY KEY (stats_date, dim_type, dim_key, time_grain, task_id, channel_id),
  KEY idx_yq_stats_dim_lookup (stats_date, dim_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='维度分布（Doris yq_stats_dim 的 MySQL 兼容镜像，F-009）';

DROP TABLE IF EXISTS yq_stats_hot;
CREATE TABLE yq_stats_hot (
  stats_date     DATE          NOT NULL COMMENT '统计日期',
  rank_by        VARCHAR(20)   NOT NULL COMMENT '排序口径',
  rank_no        INT           NOT NULL COMMENT '名次',
  hot_id         BIGINT        NOT NULL COMMENT '主键',
  opinion_id     BIGINT        DEFAULT NULL COMMENT '舆情ID',
  task_id        BIGINT        NOT NULL DEFAULT 0 COMMENT '任务ID（0=未归属）',
  channel_id     BIGINT        NOT NULL DEFAULT 0 COMMENT '渠道ID（0=未归属）',
  title          VARCHAR(500)  DEFAULT NULL COMMENT '舆情标题',
  channel_name   VARCHAR(50)   DEFAULT NULL COMMENT '渠道名称',
  opinion_url    VARCHAR(1000) DEFAULT NULL COMMENT '原文链接',
  publish_time   DATETIME      DEFAULT NULL COMMENT '发布时间',
  senti_attr     VARCHAR(20)   DEFAULT NULL COMMENT '舆情属性',
  risk_level     VARCHAR(20)   DEFAULT NULL COMMENT '风险等级',
  read_count     BIGINT        DEFAULT NULL COMMENT '阅读量',
  comment_count  BIGINT        DEFAULT NULL COMMENT '评论量',
  share_count    BIGINT        DEFAULT NULL COMMENT '转发量',
  like_count     BIGINT        DEFAULT NULL COMMENT '点赞量',
  heat_score     INT           DEFAULT NULL COMMENT '综合热度分值',
  create_time    DATETIME      DEFAULT NULL COMMENT '聚合时间',
  PRIMARY KEY (stats_date, rank_by, rank_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='热点排行（Doris yq_stats_hot 的 MySQL 兼容镜像，F-009）';

SET FOREIGN_KEY_CHECKS = 1;
