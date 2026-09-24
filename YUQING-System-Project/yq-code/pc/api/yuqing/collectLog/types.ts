/**
 * 采集日志 查询
 */
export interface YqCollectLogQuery extends PageQuery {
  /** 任务ID */
  taskId?: string;
  /** 渠道ID */
  channelId?: string;
  /** 采集批次号 */
  batchNo?: string;
  /** 采集来源 */
  collectSource?: string;
  /** 采集策略 */
  strategy?: string;
  /** 抓取条数 */
  fetchedCount?: number;
  /** 入库条数 */
  insertedCount?: number;
  /** 去重剔除条数 */
  dupCount?: number;
  /** 降噪剔除条数 */
  rejectedCount?: number;
  /** 失败条数 */
  failedCount?: number;
  /** 耗时（毫秒） */
  costMs?: number;
  /** 执行结果 */
  resultStatus?: string;
  /** 失败原因 */
  failReason?: string;
  /** 记录时间 */
  createTime?: string;
}

/**
 * 采集日志 表单
 */
export interface YqCollectLogForm {
  /** 主键 */
  logId?: string;
  /** 任务ID */
  taskId?: string;
  /** 渠道ID */
  channelId?: string;
  /** 采集批次号 */
  batchNo?: string;
  /** 采集来源 */
  collectSource?: string;
  /** 采集策略 */
  strategy?: string;
  /** 抓取条数 */
  fetchedCount?: number;
  /** 入库条数 */
  insertedCount?: number;
  /** 去重剔除条数 */
  dupCount?: number;
  /** 降噪剔除条数 */
  rejectedCount?: number;
  /** 失败条数 */
  failedCount?: number;
  /** 耗时（毫秒） */
  costMs?: number;
  /** 执行结果 */
  resultStatus?: string;
  /** 失败原因 */
  failReason?: string;
  /** 记录时间 */
  createTime?: string;
  /** 任务名称 */
  taskName?: string;
  /** 渠道名称 */
  channelName?: string;
}

/**
 * 采集日志 视图
 */
export interface YqCollectLogVO {
  /** 主键 */
  logId?: string;
  /** 任务ID */
  taskId?: string;
  /** 渠道ID */
  channelId?: string;
  /** 采集批次号 */
  batchNo?: string;
  /** 采集来源 */
  collectSource?: string;
  /** 采集策略 */
  strategy?: string;
  /** 抓取条数 */
  fetchedCount?: number;
  /** 入库条数 */
  insertedCount?: number;
  /** 去重剔除条数 */
  dupCount?: number;
  /** 降噪剔除条数 */
  rejectedCount?: number;
  /** 失败条数 */
  failedCount?: number;
  /** 耗时（毫秒） */
  costMs?: number;
  /** 执行结果 */
  resultStatus?: string;
  /** 失败原因 */
  failReason?: string;
  /** 记录时间 */
  createTime?: string;
  /** 任务名称 */
  taskName?: any;
  /** 渠道名称 */
  channelName?: any;
}
