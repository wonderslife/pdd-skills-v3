/**
 * 台账导出记录 查询
 */
export interface YqLedgerExportLogQuery extends PageQuery {
  /** 导出范围（台账/事件聚合） */
  exportScope?: string;
  /** 筛选条件可读摘要 */
  querySummary?: string;
  /** 筛选条件快照（JSON） */
  queryJson?: string;
  /** 导出字段清单（JSON 数组） */
  columnsJson?: string;
  /** 导出条数 */
  rowCount?: number;
  /** 导出字段数 */
  columnCount?: number;
  /** 导出方式（sync同步 / async异步） */
  exportMode?: string;
  /** 任务状态（pending/running/success/failed） */
  status?: string;
  /** 导出文件名 */
  fileName?: string;
  /** 下载地址（异步任务完成后回填） */
  fileUrl?: string;
  /** 完成时间 */
  finishTime?: string;
  /** 失败原因 */
  failReason?: string;
  /** 操作来源IP */
  operIp?: string;
}

/**
 * 台账导出记录 表单
 */
export interface YqLedgerExportLogForm {
  /** 主键 */
  exportId?: string;
  /** 导出范围（台账/事件聚合） */
  exportScope?: string;
  /** 筛选条件可读摘要 */
  querySummary?: string;
  /** 筛选条件快照（JSON） */
  queryJson?: string;
  /** 导出字段清单（JSON 数组） */
  columnsJson?: string;
  /** 导出条数 */
  rowCount?: number;
  /** 导出字段数 */
  columnCount?: number;
  /** 导出方式（sync同步 / async异步） */
  exportMode?: string;
  /** 任务状态（pending/running/success/failed） */
  status?: string;
  /** 导出文件名 */
  fileName?: string;
  /** 下载地址（异步任务完成后回填） */
  fileUrl?: string;
  /** 完成时间 */
  finishTime?: string;
  /** 失败原因 */
  failReason?: string;
  /** 操作来源IP */
  operIp?: string;

}

/**
 * 台账导出记录 视图
 */
export interface YqLedgerExportLogVO {
  /** 主键 */
  exportId?: string;
  /** 导出范围（台账/事件聚合） */
  exportScope?: string;
  /** 筛选条件可读摘要 */
  querySummary?: string;
  /** 筛选条件快照（JSON） */
  queryJson?: string;
  /** 导出字段清单（JSON 数组） */
  columnsJson?: string;
  /** 导出条数 */
  rowCount?: number;
  /** 导出字段数 */
  columnCount?: number;
  /** 导出方式（sync同步 / async异步） */
  exportMode?: string;
  /** 任务状态（pending/running/success/failed） */
  status?: string;
  /** 导出文件名 */
  fileName?: string;
  /** 下载地址（异步任务完成后回填） */
  fileUrl?: string;
  /** 完成时间 */
  finishTime?: string;
  /** 失败原因 */
  failReason?: string;
  /** 操作来源IP */
  operIp?: string;
  /** 创建时间 */
  createTime?: string;

}
