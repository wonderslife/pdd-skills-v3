/**
 * 互动数据快照 查询
 */
export interface YqOpinionMetricQuery extends PageQuery {
  /** 舆情ID */
  opinionId?: string;
  /** 快照日期 */
  snapshotDate?: string;
  /** 点赞量 */
  likeCount?: string;
  /** 评论量 */
  commentCount?: string;
  /** 转发量 */
  shareCount?: string;
  /** 阅读量 */
  readCount?: string;
  /** 热度分值 */
  heatScore?: number;
  /** 采集时间 */
  createTime?: string;
}

/**
 * 互动数据快照 表单
 */
export interface YqOpinionMetricForm {
  /** 主键 */
  metricId?: string;
  /** 舆情ID */
  opinionId?: string;
  /** 快照日期 */
  snapshotDate?: string;
  /** 点赞量 */
  likeCount?: string;
  /** 评论量 */
  commentCount?: string;
  /** 转发量 */
  shareCount?: string;
  /** 阅读量 */
  readCount?: string;
  /** 热度分值 */
  heatScore?: number;
  /** 采集时间 */
  createTime?: string;

}

/**
 * 互动数据快照 视图
 */
export interface YqOpinionMetricVO {
  /** 主键 */
  metricId?: string;
  /** 舆情ID */
  opinionId?: string;
  /** 快照日期 */
  snapshotDate?: string;
  /** 点赞量 */
  likeCount?: string;
  /** 评论量 */
  commentCount?: string;
  /** 转发量 */
  shareCount?: string;
  /** 阅读量 */
  readCount?: string;
  /** 热度分值 */
  heatScore?: number;
  /** 采集时间 */
  createTime?: string;

}
