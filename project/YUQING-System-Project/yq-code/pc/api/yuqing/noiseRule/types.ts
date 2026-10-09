/**
 * 降噪规则 查询
 */
export interface YqNoiseRuleQuery extends PageQuery {
  /** 规则名称 */
  ruleName?: string;
  /** 规则类型 */
  ruleType?: string;
  /** 降噪类别 */
  noiseCategory?: string;
  /** 匹配方式 */
  matchType?: string;
  /** 匹配内容 */
  matchValue?: string;
  /** 执行优先级 */
  priority?: number;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 备注 */
  remark?: string;
}

/**
 * 降噪规则 表单
 */
export interface YqNoiseRuleForm {
  /** 主键 */
  ruleId?: string;
  /** 规则名称 */
  ruleName?: string;
  /** 规则类型 */
  ruleType?: string;
  /** 降噪类别 */
  noiseCategory?: string;
  /** 匹配方式 */
  matchType?: string;
  /** 匹配内容 */
  matchValue?: string;
  /** 执行优先级 */
  priority?: number;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 备注 */
  remark?: string;

}

/**
 * 降噪规则 视图
 */
export interface YqNoiseRuleVO {
  /** 主键 */
  ruleId?: string;
  /** 规则名称 */
  ruleName?: string;
  /** 规则类型 */
  ruleType?: string;
  /** 降噪类别 */
  noiseCategory?: string;
  /** 匹配方式 */
  matchType?: string;
  /** 匹配内容 */
  matchValue?: string;
  /** 执行优先级 */
  priority?: number;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 备注 */
  remark?: string;
  /** 创建时间 */
  createTime?: string;

}
