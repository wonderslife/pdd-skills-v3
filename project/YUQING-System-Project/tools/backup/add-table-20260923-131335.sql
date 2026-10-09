-- 纯增量建表归档（DbAddTable 产出，不含 DROP）
-- 源: yq-code\sql\yq_schema.sql
-- 时间: 20260923-131335

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
  PRIMARY KEY (export_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='台账导出记录';

