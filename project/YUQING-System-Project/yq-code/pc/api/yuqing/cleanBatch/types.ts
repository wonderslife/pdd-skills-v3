/**
 * 净化批次 查询
 */
export interface YqCleanBatchQuery extends PageQuery {
  /** 批次名称 */
  batchName?: string;
  /** 重跑类型 */
  batchType?: string;
  /** 范围-任务ID */
  scopeTaskId?: string;
  /** 范围-渠道ID */
  scopeChannelId?: string;
  /** 范围-起始采集日 */
  scopeStartDate?: string;
  /** 范围-截止采集日 */
  scopeEndDate?: string;
  /** 扫描条数 */
  totalCount?: number;
  /** 净化保留条数 */
  cleanedCount?: number;
  /** 降噪剔除条数 */
  rejectedCount?: number;
  /** 链接去重条数 */
  dupCount?: number;
  /** 跨渠道重复条数 */
  dupChannelCount?: number;
  /** 垃圾内容剔除量 */
  noiseSpam?: number;
  /** 广告营销剔除量 */
  noiseAdvertisement?: number;
  /** 灌水评论剔除量 */
  noiseFlooding?: number;
  /** 无意义短句剔除量 */
  noiseMeaningless?: number;
  /** 机器人内容剔除量 */
  noiseBot?: number;
  /** 空白内容剔除量 */
  noiseBlank?: number;
  /** 违规屏蔽剔除量 */
  noiseViolation?: number;
  /** 仅预览未落库（0否 1是） */
  previewOnly?: string;
  /** 执行状态 */
  status?: string;
  /** 失败原因 */
  failReason?: string;
  /** 耗时（毫秒） */
  costMs?: number;
}

/**
 * 净化批次 表单
 */
export interface YqCleanBatchForm {
  /** 主键 */
  batchId?: string;
  /** 批次名称 */
  batchName?: string;
  /** 重跑类型 */
  batchType?: string;
  /** 范围-任务ID */
  scopeTaskId?: string;
  /** 范围-渠道ID */
  scopeChannelId?: string;
  /** 范围-起始采集日 */
  scopeStartDate?: string;
  /** 范围-截止采集日 */
  scopeEndDate?: string;
  /** 扫描条数 */
  totalCount?: number;
  /** 净化保留条数 */
  cleanedCount?: number;
  /** 降噪剔除条数 */
  rejectedCount?: number;
  /** 链接去重条数 */
  dupCount?: number;
  /** 跨渠道重复条数 */
  dupChannelCount?: number;
  /** 垃圾内容剔除量 */
  noiseSpam?: number;
  /** 广告营销剔除量 */
  noiseAdvertisement?: number;
  /** 灌水评论剔除量 */
  noiseFlooding?: number;
  /** 无意义短句剔除量 */
  noiseMeaningless?: number;
  /** 机器人内容剔除量 */
  noiseBot?: number;
  /** 空白内容剔除量 */
  noiseBlank?: number;
  /** 违规屏蔽剔除量 */
  noiseViolation?: number;
  /** 仅预览未落库（0否 1是） */
  previewOnly?: string;
  /** 执行状态 */
  status?: string;
  /** 失败原因 */
  failReason?: string;
  /** 耗时（毫秒） */
  costMs?: number;
  /** 任务名称 */
  taskName?: string;
  /** 渠道名称 */
  channelName?: string;
  /** 去重率（%） */
  dupRate?: string;
  /** 降噪率（%） */
  rejectRate?: string;
}

/**
 * 净化批次 视图
 */
export interface YqCleanBatchVO {
  /** 主键 */
  batchId?: string;
  /** 批次名称 */
  batchName?: string;
  /** 重跑类型 */
  batchType?: string;
  /** 范围-任务ID */
  scopeTaskId?: string;
  /** 范围-渠道ID */
  scopeChannelId?: string;
  /** 范围-起始采集日 */
  scopeStartDate?: string;
  /** 范围-截止采集日 */
  scopeEndDate?: string;
  /** 扫描条数 */
  totalCount?: number;
  /** 净化保留条数 */
  cleanedCount?: number;
  /** 降噪剔除条数 */
  rejectedCount?: number;
  /** 链接去重条数 */
  dupCount?: number;
  /** 跨渠道重复条数 */
  dupChannelCount?: number;
  /** 垃圾内容剔除量 */
  noiseSpam?: number;
  /** 广告营销剔除量 */
  noiseAdvertisement?: number;
  /** 灌水评论剔除量 */
  noiseFlooding?: number;
  /** 无意义短句剔除量 */
  noiseMeaningless?: number;
  /** 机器人内容剔除量 */
  noiseBot?: number;
  /** 空白内容剔除量 */
  noiseBlank?: number;
  /** 违规屏蔽剔除量 */
  noiseViolation?: number;
  /** 仅预览未落库（0否 1是） */
  previewOnly?: string;
  /** 执行状态 */
  status?: string;
  /** 失败原因 */
  failReason?: string;
  /** 耗时（毫秒） */
  costMs?: number;
  /** 创建时间 */
  createTime?: string;
  /** 任务名称 */
  taskName?: any;
  /** 渠道名称 */
  channelName?: any;
  /** 去重率（%） */
  dupRate?: any;
  /** 降噪率（%） */
  rejectRate?: any;
}
