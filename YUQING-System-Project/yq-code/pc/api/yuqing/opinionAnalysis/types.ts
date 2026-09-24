/**
 * 研判结果 查询
 */
export interface YqOpinionAnalysisQuery extends PageQuery {
  /** 舆情ID */
  opinionId?: string;
  /** 主题识别结果 */
  topic?: string;
  /** 核心内容提炼 */
  summary?: string;
  /** 情感倾向判定 */
  sentiAttr?: string;
  /** 风险属性判定 */
  riskAttr?: string;
  /** 风险等级 */
  riskLevel?: string;
  /** 舆情分级 */
  opinionLevel?: string;
  /** 模型输出标签（逗号分隔） */
  tags?: string;
  /** 隐性/变体命中依据 */
  matchEvidence?: string;
  /** 处置建议 */
  suggestion?: string;
  /** 置信度（%） */
  confidence?: number;
  /** 模型版本 */
  modelVersion?: string;
  /** 提示词版本 */
  promptVersion?: string;
  /** 研判版本号 */
  analyzeVersion?: number;
  /** 是否人工修正（0否 1是） */
  correctedFlag?: string;
  /** 修正人用户ID */
  correctedBy?: string;
  /** 修正时间 */
  correctedTime?: string;
  /** 研判时间 */
  analyzeTime?: string;
  /** 失败原因 */
  failReason?: string;
}

/**
 * 研判结果 表单
 */
export interface YqOpinionAnalysisForm {
  /** 主键 */
  analysisId?: string;
  /** 舆情ID */
  opinionId?: string;
  /** 主题识别结果 */
  topic?: string;
  /** 核心内容提炼 */
  summary?: string;
  /** 情感倾向判定 */
  sentiAttr?: string;
  /** 风险属性判定 */
  riskAttr?: string;
  /** 风险等级 */
  riskLevel?: string;
  /** 舆情分级 */
  opinionLevel?: string;
  /** 模型输出标签（逗号分隔） */
  tags?: string;
  /** 隐性/变体命中依据 */
  matchEvidence?: string;
  /** 处置建议 */
  suggestion?: string;
  /** 置信度（%） */
  confidence?: number;
  /** 模型版本 */
  modelVersion?: string;
  /** 提示词版本 */
  promptVersion?: string;
  /** 研判版本号 */
  analyzeVersion?: number;
  /** 是否人工修正（0否 1是） */
  correctedFlag?: string;
  /** 修正人用户ID */
  correctedBy?: string;
  /** 修正时间 */
  correctedTime?: string;
  /** 研判时间 */
  analyzeTime?: string;
  /** 失败原因 */
  failReason?: string;

}

/**
 * 研判结果 视图
 */
export interface YqOpinionAnalysisVO {
  /** 主键 */
  analysisId?: string;
  /** 舆情ID */
  opinionId?: string;
  /** 主题识别结果 */
  topic?: string;
  /** 核心内容提炼 */
  summary?: string;
  /** 情感倾向判定 */
  sentiAttr?: string;
  /** 风险属性判定 */
  riskAttr?: string;
  /** 风险等级 */
  riskLevel?: string;
  /** 舆情分级 */
  opinionLevel?: string;
  /** 模型输出标签（逗号分隔） */
  tags?: string;
  /** 隐性/变体命中依据 */
  matchEvidence?: string;
  /** 处置建议 */
  suggestion?: string;
  /** 置信度（%） */
  confidence?: number;
  /** 模型版本 */
  modelVersion?: string;
  /** 提示词版本 */
  promptVersion?: string;
  /** 研判版本号 */
  analyzeVersion?: number;
  /** 是否人工修正（0否 1是） */
  correctedFlag?: string;
  /** 修正人用户ID */
  correctedBy?: string;
  /** 修正时间 */
  correctedTime?: string;
  /** 研判时间 */
  analyzeTime?: string;
  /** 失败原因 */
  failReason?: string;
  /** 创建时间 */
  createTime?: string;

}
