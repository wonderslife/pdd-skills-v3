-- ============================================================
-- 全自动化舆情监测研判报送平台 Doris 建表脚本（Apache Doris 2.1/3.0）
-- 来源: PRD §5.5 Doris 建表约定与写入链路
-- 执行前请确认已接入 Doris 集群，并在 MySQL 客户端连接 FE 9030 端口执行
-- ⚠ 本脚本含 DROP TABLE
-- ============================================================
CREATE DATABASE IF NOT EXISTS yq_dwd;

-- ============================================================
-- 采集日志表 yq_collect_log（Apache Doris）
-- 来源: PRD §5.5 Doris 建表约定与写入链路
-- 模型: 详见 PRD §5.5 表设计通则
-- 写入: 采集/研判 Worker 经 Stream Load 批量导入（label 幂等）；业务侧只读
-- ============================================================
DROP TABLE IF EXISTS yq_collect_log;
CREATE TABLE IF NOT EXISTS yq_collect_log (
    `log_id`          BIGINT         NOT NULL  COMMENT '主键',
    `task_id`         BIGINT         NULL      COMMENT '任务ID',
    `channel_id`      BIGINT         NULL      COMMENT '渠道ID',
    `batch_no`        VARCHAR(50)    NOT NULL  COMMENT '采集批次号',
    `collect_source`  VARCHAR(20)    NOT NULL  COMMENT '采集来源',
    `strategy`        VARCHAR(20)    NULL      COMMENT '采集策略',
    `fetched_count`   INT            NULL      COMMENT '抓取条数',
    `inserted_count`  INT            NULL      COMMENT '入库条数',
    `dup_count`       INT            NULL      COMMENT '去重剔除条数',
    `rejected_count`  INT            NULL      COMMENT '降噪剔除条数',
    `failed_count`    INT            NULL      COMMENT '失败条数',
    `cost_ms`         INT            NULL      COMMENT '耗时（毫秒）',
    `result_status`   VARCHAR(20)    NOT NULL  COMMENT '执行结果',
    `fail_reason`     VARCHAR(1000)  NULL      COMMENT '失败原因',
    `create_time`     DATETIME       NULL      COMMENT '记录时间'
)
ENGINE = OLAP
UNIQUE KEY(`log_id`)
COMMENT '采集日志'

DISTRIBUTED BY HASH(`log_id`) BUCKETS 16
PROPERTIES (
    "replication_num"                    = "3",
    "enable_unique_key_merge_on_write"   = "true"
];

-- ============================================================
-- 舆情明细表 yq_opinion（Apache Doris）
-- 来源: PRD §5.5 Doris 建表约定与写入链路
-- 模型: Unique Key(collect_date, url_hash) + Merge-on-Write，天然承接全流程链接去重
-- 写入: 采集/研判 Worker 经 Stream Load 批量导入（label 幂等）；业务侧只读
-- ============================================================
DROP TABLE IF EXISTS yq_opinion;
CREATE TABLE IF NOT EXISTS yq_opinion (
    `collect_date`    DATE           NOT NULL  COMMENT '分区列=采集日期',
    `url_hash`        CHAR(64)       NOT NULL  COMMENT '链接 SHA-256（唯一去重主键载体）',
    `opinion_id`      BIGINT         NOT NULL  COMMENT '舆情ID,主键',
    `task_id`         BIGINT         NULL      COMMENT '所属任务ID',
    `channel_id`      BIGINT         NOT NULL  COMMENT '来源渠道ID',
    `title`           VARCHAR(500)   NOT NULL  COMMENT '舆情标题',
    `content`         STRING         NULL      COMMENT '原文内容',
    `opinion_url`     VARCHAR(1000)  NOT NULL  COMMENT '原文链接',
    `publish_time`    DATETIME       NULL      COMMENT '发布时间',
    `author`          VARCHAR(200)   NULL      COMMENT '发布作者/主体',
    `like_count`      BIGINT         NULL      COMMENT '点赞量',
    `comment_count`   BIGINT         NULL      COMMENT '评论量',
    `share_count`     BIGINT         NULL      COMMENT '转发量',
    `read_count`      BIGINT         NULL      COMMENT '阅读量',
    `region`          VARCHAR(100)   NULL      COMMENT '发布地域',
    `device_info`     VARCHAR(200)   NULL      COMMENT '设备信息',
    `topic_tags`      VARCHAR(500)   NULL      COMMENT '话题标签（逗号分隔）',
    `heat_score`      INT            NULL      COMMENT '综合热度分值',
    `senti_attr`      VARCHAR(20)    NULL      COMMENT '舆情属性',
    `opinion_level`   VARCHAR(20)    NULL      COMMENT '舆情分级',
    `risk_level`      VARCHAR(20)    NULL      COMMENT '风险等级',
    `spread_level`    VARCHAR(20)    NULL      COMMENT '传播量级',
    `cluster_id`      BIGINT         NULL      COMMENT '事件聚合ID',
    `collect_source`  VARCHAR(20)    NOT NULL  COMMENT '采集来源',
    `collect_time`    DATETIME       NOT NULL  COMMENT '采集时间',
    `batch_no`        VARCHAR(50)    NULL      COMMENT '采集批次号',
    `clean_status`    VARCHAR(20)    NOT NULL  COMMENT '清洗状态',
    `noise_reason`    VARCHAR(200)   NULL      COMMENT '降噪剔除原因',
    `dup_channel_ids` VARCHAR(500)   NULL      COMMENT '重复渠道ID（逗号分隔）',
    `clean_time`      DATETIME       NULL      COMMENT '净化时间',
    `analyze_status`  VARCHAR(20)    NOT NULL  COMMENT '研判状态',
    `alert_flag`      CHAR(1)        NULL      COMMENT '是否已预警（0否 1是）',
    `push_flag`       CHAR(1)        NULL      COMMENT '是否已推送（0否 1是）',
    `del_flag`        CHAR(1)        NULL      COMMENT '删除标志（0存在 2删除）',
    INDEX idx_title (`title`) USING INVERTED PROPERTIES("parser" = "chinese") COMMENT '标题中文倒排',
    INDEX idx_content (`content`) USING INVERTED PROPERTIES("parser" = "chinese") COMMENT '正文中文倒排'
)
ENGINE = OLAP
UNIQUE KEY(`collect_date`, `url_hash`)
COMMENT '舆情明细'

PARTITION BY RANGE(`collect_date`) ()
DISTRIBUTED BY HASH(`url_hash`) BUCKETS 16
PROPERTIES (
    "replication_num"                    = "3",
    "enable_unique_key_merge_on_write"   = "true",
    "dynamic_partition.enable"           = "true",
    "dynamic_partition.time_unit"        = "DAY",
    "dynamic_partition.start"            = "-1095",
    "dynamic_partition.end"              = "3",
    "dynamic_partition.prefix"           = "p",
    "dynamic_partition.replication_num"  = "3"
];

-- ============================================================
-- 研判结果表 yq_opinion_analysis（Apache Doris）
-- 来源: PRD §5.5 Doris 建表约定与写入链路
-- 模型: 详见 PRD §5.5 表设计通则
-- 写入: 采集/研判 Worker 经 Stream Load 批量导入（label 幂等）；业务侧只读
-- ============================================================
DROP TABLE IF EXISTS yq_opinion_analysis;
CREATE TABLE IF NOT EXISTS yq_opinion_analysis (
    `analysis_id`     BIGINT         NOT NULL  COMMENT '主键',
    `opinion_id`      BIGINT         NOT NULL  COMMENT '舆情ID',
    `topic`           VARCHAR(200)   NULL      COMMENT '主题识别结果',
    `summary`         VARCHAR(1000)  NULL      COMMENT '核心内容提炼',
    `senti_attr`      VARCHAR(20)    NULL      COMMENT '情感倾向判定',
    `risk_attr`       VARCHAR(200)   NULL      COMMENT '风险属性判定',
    `risk_level`      VARCHAR(20)    NULL      COMMENT '风险等级',
    `opinion_level`   VARCHAR(20)    NULL      COMMENT '舆情分级',
    `tags`            VARCHAR(500)   NULL      COMMENT '模型输出标签（逗号分隔）',
    `match_evidence`  VARCHAR(1000)  NULL      COMMENT '隐性/变体命中依据',
    `suggestion`      VARCHAR(1000)  NULL      COMMENT '处置建议',
    `confidence`      DECIMAL(5,2)   NULL      COMMENT '置信度（%）',
    `model_version`   VARCHAR(50)    NULL      COMMENT '模型版本',
    `prompt_version`  VARCHAR(50)    NULL      COMMENT '提示词版本',
    `analyze_version` INT            NULL      COMMENT '研判版本号',
    `corrected_flag`  CHAR(1)        NULL      COMMENT '是否人工修正（0否 1是）',
    `corrected_by`    BIGINT         NULL      COMMENT '修正人用户ID',
    `corrected_time`  DATETIME       NULL      COMMENT '修正时间',
    `analyze_time`    DATETIME       NULL      COMMENT '研判时间',
    `fail_reason`     VARCHAR(1000)  NULL      COMMENT '失败原因'
)
ENGINE = OLAP
UNIQUE KEY(`analysis_id`)
COMMENT '研判结果'

DISTRIBUTED BY HASH(`analysis_id`) BUCKETS 16
PROPERTIES (
    "replication_num"                    = "3",
    "enable_unique_key_merge_on_write"   = "true"
];

-- ============================================================
-- 舆情标签关联表 yq_opinion_tag（Apache Doris）
-- 来源: PRD §5.5 Doris 建表约定与写入链路
-- 模型: 详见 PRD §5.5 表设计通则
-- 写入: 采集/研判 Worker 经 Stream Load 批量导入（label 幂等）；业务侧只读
-- ============================================================
DROP TABLE IF EXISTS yq_opinion_tag;
CREATE TABLE IF NOT EXISTS yq_opinion_tag (
    `id`              BIGINT         NOT NULL  COMMENT '主键',
    `opinion_id`      BIGINT         NOT NULL  COMMENT '舆情ID',
    `tag_id`          BIGINT         NOT NULL  COMMENT '标签ID',
    `tag_source`      VARCHAR(20)    NOT NULL  COMMENT '标签来源'
)
ENGINE = OLAP
UNIQUE KEY(`id`)
COMMENT '舆情标签关联'

DISTRIBUTED BY HASH(`id`) BUCKETS 16
PROPERTIES (
    "replication_num"                    = "3",
    "enable_unique_key_merge_on_write"   = "true"
];

-- ============================================================
-- 事件聚合表 yq_opinion_cluster（Apache Doris）
-- 来源: PRD §5.5 Doris 建表约定与写入链路
-- 模型: 详见 PRD §5.5 表设计通则
-- 写入: 采集/研判 Worker 经 Stream Load 批量导入（label 幂等）；业务侧只读
-- ============================================================
DROP TABLE IF EXISTS yq_opinion_cluster;
CREATE TABLE IF NOT EXISTS yq_opinion_cluster (
    `cluster_id`      BIGINT         NOT NULL  COMMENT '聚合ID,主键',
    `cluster_title`   VARCHAR(200)   NOT NULL  COMMENT '事件标题',
    `cluster_topic`   VARCHAR(200)   NULL      COMMENT '事件主题',
    `opinion_count`   INT            NULL      COMMENT '关联舆情条数',
    `first_time`      DATETIME       NULL      COMMENT '首次出现时间',
    `last_time`       DATETIME       NULL      COMMENT '最近出现时间',
    `spread_path`     STRING         NULL      COMMENT '传播脉络（时间轴 JSON）',
    `peak_heat`       INT            NULL      COMMENT '峰值热度',
    `risk_level`      VARCHAR(20)    NULL      COMMENT '事件风险等级',
    `create_time`     DATETIME       NULL      COMMENT '创建时间'
)
ENGINE = OLAP
UNIQUE KEY(`cluster_id`)
COMMENT '事件聚合'

DISTRIBUTED BY HASH(`cluster_id`) BUCKETS 16
PROPERTIES (
    "replication_num"                    = "3",
    "enable_unique_key_merge_on_write"   = "true"
];

-- ============================================================
-- 互动数据快照表 yq_opinion_metric（Apache Doris）
-- 来源: PRD §5.5 Doris 建表约定与写入链路
-- 模型: 详见 PRD §5.5 表设计通则
-- 写入: 采集/研判 Worker 经 Stream Load 批量导入（label 幂等）；业务侧只读
-- ============================================================
DROP TABLE IF EXISTS yq_opinion_metric;
CREATE TABLE IF NOT EXISTS yq_opinion_metric (
    `metric_id`       BIGINT         NOT NULL  COMMENT '主键',
    `opinion_id`      BIGINT         NOT NULL  COMMENT '舆情ID',
    `snapshot_date`   DATE           NOT NULL  COMMENT '快照日期',
    `like_count`      BIGINT         NULL      COMMENT '点赞量',
    `comment_count`   BIGINT         NULL      COMMENT '评论量',
    `share_count`     BIGINT         NULL      COMMENT '转发量',
    `read_count`      BIGINT         NULL      COMMENT '阅读量',
    `heat_score`      INT            NULL      COMMENT '热度分值',
    `create_time`     DATETIME       NULL      COMMENT '采集时间'
)
ENGINE = OLAP
UNIQUE KEY(`metric_id`)
COMMENT '互动数据快照'

DISTRIBUTED BY HASH(`metric_id`) BUCKETS 16
PROPERTIES (
    "replication_num"                    = "3",
    "enable_unique_key_merge_on_write"   = "true"
];

-- ============================================================
-- 统计预聚合表 yq_stats_daily（Apache Doris）
-- 来源: PRD §5.5 Doris 建表约定与写入链路
-- 模型: Unique Key(stats_date, task_id, channel_id) + Merge-on-Write，同键重复写入即覆盖（聚合任务重跑幂等）
-- 写入: 采集/研判 Worker 经 Stream Load 批量导入（label 幂等）；业务侧只读
-- ============================================================
DROP TABLE IF EXISTS yq_stats_daily;
CREATE TABLE IF NOT EXISTS yq_stats_daily (
    `stats_date`      DATE           NOT NULL  COMMENT '统计日期',
    `task_id`         BIGINT         NOT NULL  COMMENT '任务ID',
    `channel_id`      BIGINT         NOT NULL  COMMENT '渠道ID',
    `stats_id`        BIGINT         NOT NULL  COMMENT '主键',
    `total_count`     INT            NULL      COMMENT '舆情总量',
    `positive_count`  INT            NULL      COMMENT '正面条数',
    `neutral_count`   INT            NULL      COMMENT '中性条数',
    `negative_count`  INT            NULL      COMMENT '负面条数',
    `dup_count`       INT            NULL      COMMENT '去重剔除条数',
    `rejected_count`  INT            NULL      COMMENT '降噪剔除条数',
    `alert_count`     INT            NULL      COMMENT '预警条数',
    `push_count`      INT            NULL      COMMENT '推送条数',
    `report_count`    INT            NULL      COMMENT '报告生成数',
    `read_sum`        BIGINT         NULL      COMMENT '阅读量合计',
    `comment_sum`     BIGINT         NULL      COMMENT '评论量合计',
    `share_sum`       BIGINT         NULL      COMMENT '转发量合计',
    `like_sum`        BIGINT         NULL      COMMENT '点赞量合计',
    `negative_rate`   DECIMAL(5,2)   NULL      COMMENT '负面占比（%）',
    `create_time`     DATETIME       NULL      COMMENT '聚合时间'
)
ENGINE = OLAP
UNIQUE KEY(`stats_date`, `task_id`, `channel_id`)
COMMENT '统计预聚合'

DISTRIBUTED BY HASH(`stats_id`) BUCKETS 16
PROPERTIES (
    "replication_num"                    = "3",
    "enable_unique_key_merge_on_write"   = "true"
];

-- ============================================================
-- 维度分布表 yq_stats_dim（Apache Doris）
-- 来源: PRD §5.5 Doris 建表约定与写入链路
-- 模型: Unique Key(stats_date, dim_type, dim_key, time_grain, task_id, channel_id) + Merge-on-Write，同键重复写入即覆盖（聚合任务重跑幂等）
-- 写入: 采集/研判 Worker 经 Stream Load 批量导入（label 幂等）；业务侧只读
-- ============================================================
DROP TABLE IF EXISTS yq_stats_dim;
CREATE TABLE IF NOT EXISTS yq_stats_dim (
    `stats_date`      DATE           NOT NULL  COMMENT '统计日期',
    `dim_type`        VARCHAR(20)    NOT NULL  COMMENT '维度类型',
    `dim_key`         VARCHAR(96)    NOT NULL  COMMENT '维度取值（ID 或文本）',
    `time_grain`      VARCHAR(10)    NOT NULL  COMMENT '时间粒度',
    `task_id`         BIGINT         NOT NULL  COMMENT '任务ID（0=未归属）',
    `channel_id`      BIGINT         NOT NULL  COMMENT '渠道ID（0=未归属）',
    `dim_id`          BIGINT         NOT NULL  COMMENT '主键',
    `dim_label`       VARCHAR(200)   NULL      COMMENT '维度展示名',
    `opinion_count`   INT            NULL      COMMENT '舆情条数',
    `positive_count`  INT            NULL      COMMENT '正面条数',
    `neutral_count`   INT            NULL      COMMENT '中性条数',
    `negative_count`  INT            NULL      COMMENT '负面条数',
    `high_risk_count` INT            NULL      COMMENT '高风险条数',
    `read_sum`        BIGINT         NULL      COMMENT '阅读量合计',
    `comment_sum`     BIGINT         NULL      COMMENT '评论量合计',
    `share_sum`       BIGINT         NULL      COMMENT '转发量合计',
    `like_sum`        BIGINT         NULL      COMMENT '点赞量合计',
    `heat_sum`        BIGINT         NULL      COMMENT '热度分值合计',
    `negative_rate`   DECIMAL(5,2)   NULL      COMMENT '负面占比（%）',
    `create_time`     DATETIME       NULL      COMMENT '聚合时间'
)
ENGINE = OLAP
UNIQUE KEY(`stats_date`, `dim_type`, `dim_key`, `time_grain`, `task_id`, `channel_id`)
COMMENT '维度分布'

DISTRIBUTED BY HASH(`dim_id`) BUCKETS 16
PROPERTIES (
    "replication_num"                    = "3",
    "enable_unique_key_merge_on_write"   = "true"
];

-- ============================================================
-- 热点排行表 yq_stats_hot（Apache Doris）
-- 来源: PRD §5.5 Doris 建表约定与写入链路
-- 模型: Unique Key(stats_date, rank_by, rank_no) + Merge-on-Write，同键重复写入即覆盖（聚合任务重跑幂等）
-- 写入: 采集/研判 Worker 经 Stream Load 批量导入（label 幂等）；业务侧只读
-- ============================================================
DROP TABLE IF EXISTS yq_stats_hot;
CREATE TABLE IF NOT EXISTS yq_stats_hot (
    `stats_date`      DATE           NOT NULL  COMMENT '统计日期',
    `rank_by`         VARCHAR(20)    NOT NULL  COMMENT '排序口径',
    `rank_no`         INT            NOT NULL  COMMENT '名次',
    `hot_id`          BIGINT         NOT NULL  COMMENT '主键',
    `opinion_id`      BIGINT         NULL      COMMENT '舆情ID',
    `task_id`         BIGINT         NULL      COMMENT '任务ID（0=未归属）',
    `channel_id`      BIGINT         NULL      COMMENT '渠道ID（0=未归属）',
    `title`           VARCHAR(500)   NULL      COMMENT '舆情标题',
    `channel_name`    VARCHAR(50)    NULL      COMMENT '渠道名称',
    `opinion_url`     VARCHAR(1000)  NULL      COMMENT '原文链接',
    `publish_time`    DATETIME       NULL      COMMENT '发布时间',
    `senti_attr`      VARCHAR(20)    NULL      COMMENT '舆情属性',
    `risk_level`      VARCHAR(20)    NULL      COMMENT '风险等级',
    `read_count`      BIGINT         NULL      COMMENT '阅读量',
    `comment_count`   BIGINT         NULL      COMMENT '评论量',
    `share_count`     BIGINT         NULL      COMMENT '转发量',
    `like_count`      BIGINT         NULL      COMMENT '点赞量',
    `heat_score`      INT            NULL      COMMENT '综合热度分值',
    `create_time`     DATETIME       NULL      COMMENT '聚合时间'
)
ENGINE = OLAP
UNIQUE KEY(`stats_date`, `rank_by`, `rank_no`)
COMMENT '热点排行'

DISTRIBUTED BY HASH(`hot_id`) BUCKETS 16
PROPERTIES (
    "replication_num"                    = "3",
    "enable_unique_key_merge_on_write"   = "true"
];
