/**
 * 维度分布 查询
 */
export interface YqStatsDimQuery extends PageQuery {
  /** 统计日期 */
  statsDate?: string;
  /** 维度类型 */
  dimType?: string;
  /** 维度取值（ID 或文本） */
  dimKey?: string;
  /** 时间粒度 */
  timeGrain?: string;
  /** 任务ID（0=未归属） */
  taskId?: string;
  /** 渠道ID（0=未归属） */
  channelId?: string;
  /** 维度展示名 */
  dimLabel?: string;
  /** 舆情条数 */
  opinionCount?: number;
  /** 正面条数 */
  positiveCount?: number;
  /** 中性条数 */
  neutralCount?: number;
  /** 负面条数 */
  negativeCount?: number;
  /** 高风险条数 */
  highRiskCount?: number;
  /** 阅读量合计 */
  readSum?: string;
  /** 评论量合计 */
  commentSum?: string;
  /** 转发量合计 */
  shareSum?: string;
  /** 点赞量合计 */
  likeSum?: string;
  /** 热度分值合计 */
  heatSum?: string;
  /** 负面占比（%） */
  negativeRate?: number;
  /** 聚合时间 */
  createTime?: string;
}

/**
 * 维度分布 表单
 */
export interface YqStatsDimForm {
  /** 主键 */
  dimId?: string;
  /** 统计日期 */
  statsDate?: string;
  /** 维度类型 */
  dimType?: string;
  /** 维度取值（ID 或文本） */
  dimKey?: string;
  /** 时间粒度 */
  timeGrain?: string;
  /** 任务ID（0=未归属） */
  taskId?: string;
  /** 渠道ID（0=未归属） */
  channelId?: string;
  /** 维度展示名 */
  dimLabel?: string;
  /** 舆情条数 */
  opinionCount?: number;
  /** 正面条数 */
  positiveCount?: number;
  /** 中性条数 */
  neutralCount?: number;
  /** 负面条数 */
  negativeCount?: number;
  /** 高风险条数 */
  highRiskCount?: number;
  /** 阅读量合计 */
  readSum?: string;
  /** 评论量合计 */
  commentSum?: string;
  /** 转发量合计 */
  shareSum?: string;
  /** 点赞量合计 */
  likeSum?: string;
  /** 热度分值合计 */
  heatSum?: string;
  /** 负面占比（%） */
  negativeRate?: number;
  /** 聚合时间 */
  createTime?: string;

}

/**
 * 维度分布 视图
 */
export interface YqStatsDimVO {
  /** 主键 */
  dimId?: string;
  /** 统计日期 */
  statsDate?: string;
  /** 维度类型 */
  dimType?: string;
  /** 维度取值（ID 或文本） */
  dimKey?: string;
  /** 时间粒度 */
  timeGrain?: string;
  /** 任务ID（0=未归属） */
  taskId?: string;
  /** 渠道ID（0=未归属） */
  channelId?: string;
  /** 维度展示名 */
  dimLabel?: string;
  /** 舆情条数 */
  opinionCount?: number;
  /** 正面条数 */
  positiveCount?: number;
  /** 中性条数 */
  neutralCount?: number;
  /** 负面条数 */
  negativeCount?: number;
  /** 高风险条数 */
  highRiskCount?: number;
  /** 阅读量合计 */
  readSum?: string;
  /** 评论量合计 */
  commentSum?: string;
  /** 转发量合计 */
  shareSum?: string;
  /** 点赞量合计 */
  likeSum?: string;
  /** 热度分值合计 */
  heatSum?: string;
  /** 负面占比（%） */
  negativeRate?: number;
  /** 聚合时间 */
  createTime?: string;

}
