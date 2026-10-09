/**
 * 统计预聚合 查询
 */
export interface YqStatsDailyQuery extends PageQuery {
  /** 统计日期 */
  statsDate?: string;
  /** 任务ID */
  taskId?: string;
  /** 渠道ID */
  channelId?: string;
  /** 舆情总量 */
  totalCount?: number;
  /** 正面条数 */
  positiveCount?: number;
  /** 中性条数 */
  neutralCount?: number;
  /** 负面条数 */
  negativeCount?: number;
  /** 去重剔除条数 */
  dupCount?: number;
  /** 降噪剔除条数 */
  rejectedCount?: number;
  /** 预警条数 */
  alertCount?: number;
  /** 推送条数 */
  pushCount?: number;
  /** 报告生成数 */
  reportCount?: number;
  /** 阅读量合计 */
  readSum?: string;
  /** 评论量合计 */
  commentSum?: string;
  /** 转发量合计 */
  shareSum?: string;
  /** 点赞量合计 */
  likeSum?: string;
  /** 负面占比（%） */
  negativeRate?: number;
  /** 聚合时间 */
  createTime?: string;
}

/**
 * 统计预聚合 表单
 */
export interface YqStatsDailyForm {
  /** 主键 */
  statsId?: string;
  /** 统计日期 */
  statsDate?: string;
  /** 任务ID */
  taskId?: string;
  /** 渠道ID */
  channelId?: string;
  /** 舆情总量 */
  totalCount?: number;
  /** 正面条数 */
  positiveCount?: number;
  /** 中性条数 */
  neutralCount?: number;
  /** 负面条数 */
  negativeCount?: number;
  /** 去重剔除条数 */
  dupCount?: number;
  /** 降噪剔除条数 */
  rejectedCount?: number;
  /** 预警条数 */
  alertCount?: number;
  /** 推送条数 */
  pushCount?: number;
  /** 报告生成数 */
  reportCount?: number;
  /** 阅读量合计 */
  readSum?: string;
  /** 评论量合计 */
  commentSum?: string;
  /** 转发量合计 */
  shareSum?: string;
  /** 点赞量合计 */
  likeSum?: string;
  /** 负面占比（%） */
  negativeRate?: number;
  /** 聚合时间 */
  createTime?: string;
  /** 任务名称 */
  taskName?: string;
  /** 渠道名称 */
  channelName?: string;
}

/**
 * 统计预聚合 视图
 */
export interface YqStatsDailyVO {
  /** 主键 */
  statsId?: string;
  /** 统计日期 */
  statsDate?: string;
  /** 任务ID */
  taskId?: string;
  /** 渠道ID */
  channelId?: string;
  /** 舆情总量 */
  totalCount?: number;
  /** 正面条数 */
  positiveCount?: number;
  /** 中性条数 */
  neutralCount?: number;
  /** 负面条数 */
  negativeCount?: number;
  /** 去重剔除条数 */
  dupCount?: number;
  /** 降噪剔除条数 */
  rejectedCount?: number;
  /** 预警条数 */
  alertCount?: number;
  /** 推送条数 */
  pushCount?: number;
  /** 报告生成数 */
  reportCount?: number;
  /** 阅读量合计 */
  readSum?: string;
  /** 评论量合计 */
  commentSum?: string;
  /** 转发量合计 */
  shareSum?: string;
  /** 点赞量合计 */
  likeSum?: string;
  /** 负面占比（%） */
  negativeRate?: number;
  /** 聚合时间 */
  createTime?: string;
  /** 任务名称 */
  taskName?: any;
  /** 渠道名称 */
  channelName?: any;
}
