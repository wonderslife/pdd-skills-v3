/**
 * 训练样本 查询
 */
export interface YqTrainSampleQuery extends PageQuery {
  /** 来源案例ID */
  knowledgeId?: string;
  /** 使用的模型版本ID */
  modelVersionId?: string;
  /** 样本状态 */
  sampleStatus?: string;
  /** 标注内容（JSON） */
  labelContent?: string;
  /** 标注人 */
  labeledBy?: string;
  /** 标注时间 */
  labeledTime?: string;
}

/**
 * 训练样本 表单
 */
export interface YqTrainSampleForm {
  /** 主键 */
  sampleId?: string;
  /** 来源案例ID */
  knowledgeId?: string;
  /** 使用的模型版本ID */
  modelVersionId?: string;
  /** 样本状态 */
  sampleStatus?: string;
  /** 标注内容（JSON） */
  labelContent?: string;
  /** 标注人 */
  labeledBy?: string;
  /** 标注时间 */
  labeledTime?: string;
  /** 来源案例标题 */
  caseTitle?: string;
  /** 模型版本 */
  versionName?: string;
}

/**
 * 训练样本 视图
 */
export interface YqTrainSampleVO {
  /** 主键 */
  sampleId?: string;
  /** 来源案例ID */
  knowledgeId?: string;
  /** 使用的模型版本ID */
  modelVersionId?: string;
  /** 样本状态 */
  sampleStatus?: string;
  /** 标注内容（JSON） */
  labelContent?: string;
  /** 标注人 */
  labeledBy?: string;
  /** 标注时间 */
  labeledTime?: string;
  /** 创建时间 */
  createTime?: string;
  /** 来源案例标题 */
  caseTitle?: any;
  /** 模型版本 */
  versionName?: any;
}
