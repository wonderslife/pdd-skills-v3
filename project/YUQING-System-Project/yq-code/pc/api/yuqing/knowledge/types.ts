/**
 * 知识库案例 查询
 */
export interface YqKnowledgeQuery extends PageQuery {
  /** 来源舆情ID */
  opinionId?: string;
  /** 案例类型 */
  caseType?: string;
  /** 案例标题 */
  caseTitle?: string;
  /** 原始数据快照（JSON） */
  originData?: string;
  /** 舆情链接 */
  opinionUrl?: string;
  /** 研判结果快照 */
  analyzeResult?: string;
  /** 分级标签 */
  levelTags?: string;
  /** 处置记录 */
  processRecord?: string;
  /** 人工修正标注 */
  manualCorrection?: string;
  /** 场景分类 */
  sceneCategory?: string;
  /** 风险特征 */
  riskFeature?: string;
  /** 关键词特征 */
  keywordFeature?: string;
  /** 状态（0有效 1已淘汰） */
  status?: string;
}

/**
 * 知识库案例 表单
 */
export interface YqKnowledgeForm {
  /** 主键 */
  knowledgeId?: string;
  /** 来源舆情ID */
  opinionId?: string;
  /** 案例类型 */
  caseType?: string;
  /** 案例标题 */
  caseTitle?: string;
  /** 原始数据快照（JSON） */
  originData?: string;
  /** 舆情链接 */
  opinionUrl?: string;
  /** 研判结果快照 */
  analyzeResult?: string;
  /** 分级标签 */
  levelTags?: string;
  /** 处置记录 */
  processRecord?: string;
  /** 人工修正标注 */
  manualCorrection?: string;
  /** 场景分类 */
  sceneCategory?: string;
  /** 风险特征 */
  riskFeature?: string;
  /** 关键词特征 */
  keywordFeature?: string;
  /** 状态（0有效 1已淘汰） */
  status?: string;

}

/**
 * 知识库案例 视图
 */
export interface YqKnowledgeVO {
  /** 主键 */
  knowledgeId?: string;
  /** 来源舆情ID */
  opinionId?: string;
  /** 案例类型 */
  caseType?: string;
  /** 案例标题 */
  caseTitle?: string;
  /** 原始数据快照（JSON） */
  originData?: string;
  /** 舆情链接 */
  opinionUrl?: string;
  /** 研判结果快照 */
  analyzeResult?: string;
  /** 分级标签 */
  levelTags?: string;
  /** 处置记录 */
  processRecord?: string;
  /** 人工修正标注 */
  manualCorrection?: string;
  /** 场景分类 */
  sceneCategory?: string;
  /** 风险特征 */
  riskFeature?: string;
  /** 关键词特征 */
  keywordFeature?: string;
  /** 状态（0有效 1已淘汰） */
  status?: string;
  /** 创建时间 */
  createTime?: string;

}
