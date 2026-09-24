/**
 * 研判分级规则 查询
 */
export interface YqLevelRuleQuery extends PageQuery {
  /** 规则名称 */
  ruleName?: string;
  /** 是否默认规则（0是 1否） */
  isDefault?: string;
  /** 评分依据 */
  scoreMetric?: string;
  /** 四档分级区间定义 */
  levelRanges?: string;
  /** 三级风险等级判定条件 */
  riskMapping?: string;
  /** 负面情感占比判定阈值 */
  sentiThreshold?: number;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 备注 */
  remark?: string;
}

/**
 * 研判分级规则 表单
 */
export interface YqLevelRuleForm {
  /** 主键 */
  ruleId?: string;
  /** 规则名称 */
  ruleName?: string;
  /** 是否默认规则（0是 1否） */
  isDefault?: string;
  /** 评分依据 */
  scoreMetric?: string;
  /** 四档分级区间定义 */
  levelRanges?: string;
  /** 三级风险等级判定条件 */
  riskMapping?: string;
  /** 负面情感占比判定阈值 */
  sentiThreshold?: number;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 备注 */
  remark?: string;

}

/**
 * 研判分级规则 视图
 */
export interface YqLevelRuleVO {
  /** 主键 */
  ruleId?: string;
  /** 规则名称 */
  ruleName?: string;
  /** 是否默认规则（0是 1否） */
  isDefault?: string;
  /** 评分依据 */
  scoreMetric?: string;
  /** 四档分级区间定义 */
  levelRanges?: string;
  /** 三级风险等级判定条件 */
  riskMapping?: string;
  /** 负面情感占比判定阈值 */
  sentiThreshold?: number;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 备注 */
  remark?: string;
  /** 创建时间 */
  createTime?: string;

}
