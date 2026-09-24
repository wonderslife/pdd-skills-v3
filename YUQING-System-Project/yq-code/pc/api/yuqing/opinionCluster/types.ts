/**
 * 事件聚合 查询
 */
export interface YqOpinionClusterQuery extends PageQuery {
  /** 事件标题 */
  clusterTitle?: string;
  /** 事件主题 */
  clusterTopic?: string;
  /** 关联舆情条数 */
  opinionCount?: number;
  /** 首次出现时间 */
  firstTime?: string;
  /** 最近出现时间 */
  lastTime?: string;
  /** 传播脉络（时间轴 JSON） */
  spreadPath?: string;
  /** 峰值热度 */
  peakHeat?: number;
  /** 事件风险等级 */
  riskLevel?: string;
  /** 创建时间 */
  createTime?: string;
}

/**
 * 事件聚合 表单
 */
export interface YqOpinionClusterForm {
  /** 主键 */
  clusterId?: string;
  /** 事件标题 */
  clusterTitle?: string;
  /** 事件主题 */
  clusterTopic?: string;
  /** 关联舆情条数 */
  opinionCount?: number;
  /** 首次出现时间 */
  firstTime?: string;
  /** 最近出现时间 */
  lastTime?: string;
  /** 传播脉络（时间轴 JSON） */
  spreadPath?: string;
  /** 峰值热度 */
  peakHeat?: number;
  /** 事件风险等级 */
  riskLevel?: string;
  /** 创建时间 */
  createTime?: string;

}

/**
 * 事件聚合 视图
 */
export interface YqOpinionClusterVO {
  /** 主键 */
  clusterId?: string;
  /** 事件标题 */
  clusterTitle?: string;
  /** 事件主题 */
  clusterTopic?: string;
  /** 关联舆情条数 */
  opinionCount?: number;
  /** 首次出现时间 */
  firstTime?: string;
  /** 最近出现时间 */
  lastTime?: string;
  /** 传播脉络（时间轴 JSON） */
  spreadPath?: string;
  /** 峰值热度 */
  peakHeat?: number;
  /** 事件风险等级 */
  riskLevel?: string;
  /** 创建时间 */
  createTime?: string;

}
