/**
 * 热点排行 查询
 */
export interface YqStatsHotQuery extends PageQuery {
  /** 统计日期 */
  statsDate?: string;
  /** 排序口径 */
  rankBy?: string;
  /** 名次 */
  rankNo?: number;
  /** 舆情ID */
  opinionId?: string;
  /** 任务ID（0=未归属） */
  taskId?: string;
  /** 渠道ID（0=未归属） */
  channelId?: string;
  /** 舆情标题 */
  title?: string;
  /** 渠道名称 */
  channelName?: string;
  /** 原文链接 */
  opinionUrl?: string;
  /** 发布时间 */
  publishTime?: string;
  /** 舆情属性 */
  sentiAttr?: string;
  /** 风险等级 */
  riskLevel?: string;
  /** 阅读量 */
  readCount?: string;
  /** 评论量 */
  commentCount?: string;
  /** 转发量 */
  shareCount?: string;
  /** 点赞量 */
  likeCount?: string;
  /** 综合热度分值 */
  heatScore?: number;
  /** 聚合时间 */
  createTime?: string;
}

/**
 * 热点排行 表单
 */
export interface YqStatsHotForm {
  /** 主键 */
  hotId?: string;
  /** 统计日期 */
  statsDate?: string;
  /** 排序口径 */
  rankBy?: string;
  /** 名次 */
  rankNo?: number;
  /** 舆情ID */
  opinionId?: string;
  /** 任务ID（0=未归属） */
  taskId?: string;
  /** 渠道ID（0=未归属） */
  channelId?: string;
  /** 舆情标题 */
  title?: string;
  /** 渠道名称 */
  channelName?: string;
  /** 原文链接 */
  opinionUrl?: string;
  /** 发布时间 */
  publishTime?: string;
  /** 舆情属性 */
  sentiAttr?: string;
  /** 风险等级 */
  riskLevel?: string;
  /** 阅读量 */
  readCount?: string;
  /** 评论量 */
  commentCount?: string;
  /** 转发量 */
  shareCount?: string;
  /** 点赞量 */
  likeCount?: string;
  /** 综合热度分值 */
  heatScore?: number;
  /** 聚合时间 */
  createTime?: string;

}

/**
 * 热点排行 视图
 */
export interface YqStatsHotVO {
  /** 主键 */
  hotId?: string;
  /** 统计日期 */
  statsDate?: string;
  /** 排序口径 */
  rankBy?: string;
  /** 名次 */
  rankNo?: number;
  /** 舆情ID */
  opinionId?: string;
  /** 任务ID（0=未归属） */
  taskId?: string;
  /** 渠道ID（0=未归属） */
  channelId?: string;
  /** 舆情标题 */
  title?: string;
  /** 渠道名称 */
  channelName?: string;
  /** 原文链接 */
  opinionUrl?: string;
  /** 发布时间 */
  publishTime?: string;
  /** 舆情属性 */
  sentiAttr?: string;
  /** 风险等级 */
  riskLevel?: string;
  /** 阅读量 */
  readCount?: string;
  /** 评论量 */
  commentCount?: string;
  /** 转发量 */
  shareCount?: string;
  /** 点赞量 */
  likeCount?: string;
  /** 综合热度分值 */
  heatScore?: number;
  /** 聚合时间 */
  createTime?: string;

}
