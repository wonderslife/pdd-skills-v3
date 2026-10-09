-- ============================================================
-- 机房巡检系统 建表脚本（RuoYi-Vue-Plus v6 / MySQL 8）
-- 来源: my-feature.prd 5.2 数据字典
-- 执行顺序: 本脚本 -> insp_dict.sql -> insp_menu.sql
-- 注意: 逻辑删除为 del_flag（0存在 2删除），需与 v6 的
--       mybatis-plus.global-config.db-config 保持一致
-- ============================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 机房表 insp_room
-- 来源: PRD 5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增),
--                   BaseEntity 审计字段, del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS insp_room;
CREATE TABLE insp_room (
  room_id              BIGINT         NOT NULL COMMENT '机房ID,主键',
  room_name            VARCHAR(50)    NOT NULL COMMENT '机房名称',
  room_code            VARCHAR(30)    NOT NULL COMMENT '机房编码',
  address              VARCHAR(200)   NOT NULL COMMENT '机房地址',
  manager_name         VARCHAR(50)    NOT NULL COMMENT '负责人姓名',
  manager_phone        VARCHAR(11)    NOT NULL COMMENT '负责人电话',
  status               CHAR(1)        DEFAULT '0' COMMENT '状态',
  remark               VARCHAR(500)   DEFAULT NULL COMMENT '备注',
  del_flag             CHAR(1)        DEFAULT '0' COMMENT '删除标志（0存在 2删除）',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (room_id),
  UNIQUE KEY uk_room_code (room_code),
  UNIQUE KEY uk_room_name (room_name),
  KEY idx_room_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='机房';

-- ============================================================
-- 区域表 insp_area
-- 来源: PRD 5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增),
--                   BaseEntity 审计字段, del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS insp_area;
CREATE TABLE insp_area (
  area_id              BIGINT         NOT NULL COMMENT '区域ID,主键',
  room_id              BIGINT         NOT NULL COMMENT '所属机房ID',
  parent_id            BIGINT         DEFAULT NULL COMMENT '父区域ID（顶级为0）',
  area_name            VARCHAR(50)    NOT NULL COMMENT '区域名称',
  order_num            INT            DEFAULT NULL COMMENT '显示顺序',
  status               CHAR(1)        DEFAULT '0' COMMENT '状态',
  remark               VARCHAR(500)   DEFAULT NULL COMMENT '备注',
  del_flag             CHAR(1)        DEFAULT '0' COMMENT '删除标志（0存在 2删除）',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (area_id),
  KEY idx_area_room (room_id),
  KEY idx_area_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='区域';

-- ============================================================
-- 点位表 insp_point
-- 来源: PRD 5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增),
--                   BaseEntity 审计字段, del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS insp_point;
CREATE TABLE insp_point (
  point_id             BIGINT         NOT NULL COMMENT '点位ID,主键',
  room_id              BIGINT         NOT NULL COMMENT '所属机房ID',
  area_id              BIGINT         DEFAULT NULL COMMENT '所属区域ID',
  point_name           VARCHAR(100)   NOT NULL COMMENT '点位名称',
  point_code           VARCHAR(50)    NOT NULL COMMENT '点位编码',
  location             VARCHAR(200)   DEFAULT NULL COMMENT '位置描述',
  cycle_type           VARCHAR(20)    NOT NULL COMMENT '巡检周期类型',
  cycle_value          INT            DEFAULT NULL COMMENT '自定义间隔天数',
  gps_enabled          CHAR(1)        DEFAULT NULL COMMENT 'GPS校验（0关 1开）',
  last_inspect_time    DATETIME       DEFAULT NULL COMMENT '上次巡检时间',
  status               VARCHAR(20)    DEFAULT 'active' COMMENT '点位状态',
  remark               VARCHAR(500)   DEFAULT NULL COMMENT '备注',
  del_flag             CHAR(1)        DEFAULT '0' COMMENT '删除标志（0存在 2删除）',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (point_id),
  UNIQUE KEY uk_point_code (point_code),
  KEY idx_point_room (room_id, point_name),
  KEY idx_point_status (status),
  KEY idx_point_area (area_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='点位';

-- ============================================================
-- 点位巡检项表 insp_point_item
-- 来源: PRD 5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增),
--                   BaseEntity 审计字段, del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS insp_point_item;
CREATE TABLE insp_point_item (
  item_id              BIGINT         NOT NULL COMMENT '点位巡检项ID,主键',
  point_id             BIGINT         NOT NULL COMMENT '所属点位ID',
  item_name            VARCHAR(100)   NOT NULL COMMENT '巡检项名称',
  item_type            VARCHAR(20)    NOT NULL COMMENT '巡检项类型',
  standard             VARCHAR(200)   DEFAULT NULL COMMENT '判定标准',
  required             CHAR(1)        DEFAULT '1' COMMENT '是否必填（0否 1是）',
  order_num            INT            DEFAULT NULL COMMENT '显示顺序',
  template_id          BIGINT         DEFAULT NULL COMMENT '来源模板ID',
  remark               VARCHAR(500)   DEFAULT NULL COMMENT '备注',
  del_flag             CHAR(1)        DEFAULT '0' COMMENT '删除标志（0存在 2删除）',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (item_id),
  KEY idx_item_point (point_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='点位巡检项';

-- ============================================================
-- 巡检项模板表 insp_item_template
-- 来源: PRD 5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增),
--                   BaseEntity 审计字段, del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS insp_item_template;
CREATE TABLE insp_item_template (
  template_id          BIGINT         NOT NULL COMMENT '巡检项模板ID,主键',
  template_name        VARCHAR(50)    NOT NULL COMMENT '模板名称',
  description          VARCHAR(200)   DEFAULT NULL COMMENT '模板说明',
  remark               VARCHAR(500)   DEFAULT NULL COMMENT '备注',
  del_flag             CHAR(1)        DEFAULT '0' COMMENT '删除标志（0存在 2删除）',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (template_id),
  UNIQUE KEY uk_template_name (template_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='巡检项模板';

-- ============================================================
-- 模板明细表 insp_item_template_detail
-- 来源: PRD 5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增),
--                   BaseEntity 审计字段, del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS insp_item_template_detail;
CREATE TABLE insp_item_template_detail (
  detail_id            BIGINT         NOT NULL COMMENT '模板明细ID,主键',
  template_id          BIGINT         NOT NULL COMMENT '所属模板ID',
  item_name            VARCHAR(100)   NOT NULL COMMENT '巡检项名称',
  item_type            VARCHAR(20)    NOT NULL COMMENT '巡检项类型',
  standard             VARCHAR(200)   DEFAULT NULL COMMENT '判定标准',
  required             CHAR(1)        DEFAULT '1' COMMENT '是否必填（0否 1是）',
  order_num            INT            DEFAULT NULL COMMENT '显示顺序',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (detail_id),
  KEY idx_detail_template (template_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模板明细';

-- ============================================================
-- 巡检记录表 insp_record
-- 来源: PRD 5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增),
--                   BaseEntity 审计字段, del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS insp_record;
CREATE TABLE insp_record (
  record_id            BIGINT         NOT NULL COMMENT '巡检记录ID,主键',
  point_id             BIGINT         NOT NULL COMMENT '点位ID',
  room_id              BIGINT         NOT NULL COMMENT '机房ID',
  inspector_id         BIGINT         NOT NULL COMMENT '巡检员用户ID',
  inspect_time         DATETIME       NOT NULL COMMENT '巡检时间',
  duration             INT            DEFAULT NULL COMMENT '耗时（秒）',
  result               VARCHAR(20)    NOT NULL COMMENT '巡检结果',
  abnormal_count       INT            DEFAULT NULL COMMENT '异常项数量',
  source               VARCHAR(20)    NOT NULL COMMENT '数据来源',
  remark               VARCHAR(500)   DEFAULT NULL COMMENT '整体备注',
  admin_remark         VARCHAR(500)   DEFAULT NULL COMMENT '管理员追加备注',
  del_flag             CHAR(1)        DEFAULT '0' COMMENT '删除标志（审计要求：不可删）',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (record_id),
  KEY idx_record_point (point_id, inspect_time),
  KEY idx_record_room (room_id, inspect_time),
  KEY idx_record_inspector (inspector_id, inspect_time),
  KEY idx_record_result (result)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='巡检记录';

-- ============================================================
-- 巡检项结果表 insp_record_item
-- 来源: PRD 5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增),
--                   BaseEntity 审计字段, del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS insp_record_item;
CREATE TABLE insp_record_item (
  record_item_id       BIGINT         NOT NULL COMMENT '巡检项结果ID,主键',
  record_id            BIGINT         NOT NULL COMMENT '所属记录ID',
  item_id              BIGINT         NOT NULL COMMENT '关联点位巡检项ID',
  item_name            VARCHAR(100)   NOT NULL COMMENT '巡检项名称（快照）',
  result               VARCHAR(20)    NOT NULL COMMENT '判定结果',
  value                VARCHAR(50)    DEFAULT NULL COMMENT '填写数值',
  description          VARCHAR(500)   DEFAULT NULL COMMENT '异常说明',
  order_num            INT            DEFAULT NULL COMMENT '显示顺序',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (record_item_id),
  KEY idx_ritem_record (record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='巡检项结果';

-- ============================================================
-- 巡检照片表 insp_photo
-- 来源: PRD 5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增),
--                   BaseEntity 审计字段, del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS insp_photo;
CREATE TABLE insp_photo (
  photo_id             BIGINT         NOT NULL COMMENT '巡检照片ID,主键',
  record_id            BIGINT         NOT NULL COMMENT '所属记录ID',
  record_item_id       BIGINT         DEFAULT NULL COMMENT '关联巡检项结果ID',
  original_url         VARCHAR(500)   NOT NULL COMMENT '原图URL（MinIO）',
  original_size        BIGINT         DEFAULT NULL COMMENT '原图字节数',
  compressed_url       VARCHAR(500)   NOT NULL COMMENT '压缩图URL（MinIO）',
  compressed_size      BIGINT         DEFAULT NULL COMMENT '压缩图字节数',
  file_name            VARCHAR(200)   DEFAULT NULL COMMENT '原始文件名',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (photo_id),
  KEY idx_photo_record (record_id),
  KEY idx_photo_item (record_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='巡检照片';

-- ============================================================
-- 异常项表 insp_abnormal
-- 来源: PRD 5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增),
--                   BaseEntity 审计字段, del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS insp_abnormal;
CREATE TABLE insp_abnormal (
  abnormal_id          BIGINT         NOT NULL COMMENT '异常项ID,主键',
  record_id            BIGINT         NOT NULL COMMENT '所属记录ID',
  record_item_id       BIGINT         NOT NULL COMMENT '关联巡检项结果ID',
  point_id             BIGINT         NOT NULL COMMENT '点位ID',
  room_id              BIGINT         NOT NULL COMMENT '机房ID',
  status               VARCHAR(20)    NOT NULL DEFAULT 'pending' COMMENT '处理状态',
  process_remark       VARCHAR(500)   DEFAULT NULL COMMENT '处理说明',
  process_by           BIGINT         DEFAULT NULL COMMENT '处理人用户ID',
  process_time         DATETIME       DEFAULT NULL COMMENT '处理时间',
  create_dept      BIGINT         DEFAULT NULL COMMENT '创建部门',
  create_by        BIGINT         DEFAULT NULL COMMENT '创建者',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  update_by        BIGINT         DEFAULT NULL COMMENT '更新者',
  update_time      DATETIME       DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (abnormal_id),
  KEY idx_abn_status (status, create_time),
  KEY idx_abn_room (room_id),
  KEY idx_abn_point (point_id),
  KEY idx_abn_record (record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='异常项';

-- ============================================================
-- 统计预聚合表 insp_stats_daily
-- 来源: PRD 5.2 数据字典
-- RuoYi-Vue-Plus v6: 主键使用雪花ID(MyBatis-Plus ASSIGN_ID, 非自增),
--                   BaseEntity 审计字段, del_flag 逻辑删除(0存在 2删除)
-- ============================================================
DROP TABLE IF EXISTS insp_stats_daily;
CREATE TABLE insp_stats_daily (
  stats_id             BIGINT         NOT NULL COMMENT '统计预聚合ID,主键',
  stats_date           DATE           NOT NULL COMMENT '统计日期',
  room_id              BIGINT         NOT NULL COMMENT '机房ID',
  point_id             BIGINT         DEFAULT NULL COMMENT '点位ID',
  inspect_count        INT            DEFAULT NULL COMMENT '巡检次数',
  abnormal_count       INT            DEFAULT NULL COMMENT '异常次数',
  overdue_count        INT            DEFAULT NULL COMMENT '逾期数',
  abnormal_rate        DECIMAL(5,2)   DEFAULT NULL COMMENT '异常率(%)',
  create_time      DATETIME       DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (stats_id),
  UNIQUE KEY uk_stats (stats_date, room_id, point_id),
  KEY idx_stats_date (stats_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='统计预聚合';

SET FOREIGN_KEY_CHECKS = 1;