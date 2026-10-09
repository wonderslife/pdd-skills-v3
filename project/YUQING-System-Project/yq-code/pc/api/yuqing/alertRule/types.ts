/**
 * 预警规则 查询
 */
export interface YqAlertRuleQuery extends PageQuery {
  /** 规则名称 */
  ruleName?: string;
  /** 触发场景（逗号分隔） */
  triggerScenes?: string;
  /** 统计时间窗口（分钟） */
  windowMinutes?: number;
  /** 条数阈值 */
  countThreshold?: number;
  /** 热度阈值 */
  heatThreshold?: number;
  /** 最低触发风险等级 */
  riskLevelThreshold?: string;
  /** 最低触发传播量级 */
  spreadThreshold?: string;
  /** 突发增量倍数阈值 */
  burstRatio?: number;
  /** 突发增量最小条数（防小样本虚高） */
  minBurstCount?: number;
  /** 同一事件聚合冷却期（分钟） */
  cooldownMinutes?: number;
  /** 重点专项标签（逗号分隔） */
  topicTags?: string;
  /** 预警级别 */
  alertLevel?: string;
  /** 推送级别 */
  pushLevel?: string;
  /** 通知人用户ID（逗号分隔） */
  notifyUserIds?: string;
  /** 状态（0正常 1停用） */
  status?: string;
}

/**
 * 预警规则 表单
 */
export interface YqAlertRuleForm {
  /** 主键 */
  ruleId?: string;
  /** 规则名称 */
  ruleName?: string;
  /** 触发场景（逗号分隔） */
  triggerScenes?: string;
  /** 统计时间窗口（分钟） */
  windowMinutes?: number;
  /** 条数阈值 */
  countThreshold?: number;
  /** 热度阈值 */
  heatThreshold?: number;
  /** 最低触发风险等级 */
  riskLevelThreshold?: string;
  /** 最低触发传播量级 */
  spreadThreshold?: string;
  /** 突发增量倍数阈值 */
  burstRatio?: number;
  /** 突发增量最小条数（防小样本虚高） */
  minBurstCount?: number;
  /** 同一事件聚合冷却期（分钟） */
  cooldownMinutes?: number;
  /** 重点专项标签（逗号分隔） */
  topicTags?: string;
  /** 预警级别 */
  alertLevel?: string;
  /** 推送级别 */
  pushLevel?: string;
  /** 通知人用户ID（逗号分隔） */
  notifyUserIds?: string;
  /** 状态（0正常 1停用） */
  status?: string;

}

/**
 * 预警规则 视图
 */
export interface YqAlertRuleVO {
  /** 主键 */
  ruleId?: string;
  /** 规则名称 */
  ruleName?: string;
  /** 触发场景（逗号分隔） */
  triggerScenes?: string;
  /** 统计时间窗口（分钟） */
  windowMinutes?: number;
  /** 条数阈值 */
  countThreshold?: number;
  /** 热度阈值 */
  heatThreshold?: number;
  /** 最低触发风险等级 */
  riskLevelThreshold?: string;
  /** 最低触发传播量级 */
  spreadThreshold?: string;
  /** 突发增量倍数阈值 */
  burstRatio?: number;
  /** 突发增量最小条数（防小样本虚高） */
  minBurstCount?: number;
  /** 同一事件聚合冷却期（分钟） */
  cooldownMinutes?: number;
  /** 重点专项标签（逗号分隔） */
  topicTags?: string;
  /** 预警级别 */
  alertLevel?: string;
  /** 推送级别 */
  pushLevel?: string;
  /** 通知人用户ID（逗号分隔） */
  notifyUserIds?: string;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 创建时间 */
  createTime?: string;

}
