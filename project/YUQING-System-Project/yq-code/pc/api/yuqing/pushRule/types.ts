/**
 * 推送规则 查询
 */
export interface YqPushRuleQuery extends PageQuery {
  /** 规则名称 */
  ruleName?: string;
  /** 推送场景（逗号分隔） */
  pushScenes?: string;
  /** 推送级别 */
  pushLevel?: string;
  /** 定时批量 cron */
  scheduleCron?: string;
  /** 推送模板ID */
  pushTemplateId?: string;
  /** 目标类型 */
  targetType?: string;
  /** 目标ID（逗号分隔） */
  targetIds?: string;
  /** 免打扰开始时间 HH:mm */
  quietStart?: string;
  /** 免打扰结束时间 HH:mm */
  quietEnd?: string;
  /** 失败重试上限 */
  maxRetry?: number;
  /** 状态（0正常 1停用） */
  status?: string;
}

/**
 * 推送规则 表单
 */
export interface YqPushRuleForm {
  /** 主键 */
  ruleId?: string;
  /** 规则名称 */
  ruleName?: string;
  /** 推送场景（逗号分隔） */
  pushScenes?: string;
  /** 推送级别 */
  pushLevel?: string;
  /** 定时批量 cron */
  scheduleCron?: string;
  /** 推送模板ID */
  pushTemplateId?: string;
  /** 目标类型 */
  targetType?: string;
  /** 目标ID（逗号分隔） */
  targetIds?: string;
  /** 免打扰开始时间 HH:mm */
  quietStart?: string;
  /** 免打扰结束时间 HH:mm */
  quietEnd?: string;
  /** 失败重试上限 */
  maxRetry?: number;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 推送模板名称 */
  templateName?: string;
}

/**
 * 推送规则 视图
 */
export interface YqPushRuleVO {
  /** 主键 */
  ruleId?: string;
  /** 规则名称 */
  ruleName?: string;
  /** 推送场景（逗号分隔） */
  pushScenes?: string;
  /** 推送级别 */
  pushLevel?: string;
  /** 定时批量 cron */
  scheduleCron?: string;
  /** 推送模板ID */
  pushTemplateId?: string;
  /** 目标类型 */
  targetType?: string;
  /** 目标ID（逗号分隔） */
  targetIds?: string;
  /** 免打扰开始时间 HH:mm */
  quietStart?: string;
  /** 免打扰结束时间 HH:mm */
  quietEnd?: string;
  /** 失败重试上限 */
  maxRetry?: number;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 创建时间 */
  createTime?: string;
  /** 推送模板名称 */
  templateName?: any;
}
