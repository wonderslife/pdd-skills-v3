/**
 * 预警记录 查询
 */
export interface YqAlertQuery extends PageQuery {
  /** 触发规则ID */
  ruleId?: string;
  /** 关联舆情ID */
  opinionId?: string;
  /** 关联事件聚合ID */
  clusterId?: string;
  /** 预警标题 */
  alertTitle?: string;
  /** 触发场景 */
  triggerScene?: string;
  /** 预警级别 */
  alertLevel?: string;
  /** 触发值描述 */
  triggerValue?: string;
  /** 事件聚合指纹（同指纹冷却期内不重复预警） */
  fingerprint?: string;
  /** 触发时间 */
  triggerTime?: string;
  /** 处置状态 */
  status?: string;
  /** 处置说明 */
  processRemark?: string;
  /** 处置人用户ID */
  processBy?: string;
  /** 处置时间 */
  processTime?: string;
  /** 推送结果 */
  pushResult?: string;
}

/**
 * 预警记录 表单
 */
export interface YqAlertForm {
  /** 主键 */
  alertId?: string;
  /** 触发规则ID */
  ruleId?: string;
  /** 关联舆情ID */
  opinionId?: string;
  /** 关联事件聚合ID */
  clusterId?: string;
  /** 预警标题 */
  alertTitle?: string;
  /** 触发场景 */
  triggerScene?: string;
  /** 预警级别 */
  alertLevel?: string;
  /** 触发值描述 */
  triggerValue?: string;
  /** 事件聚合指纹（同指纹冷却期内不重复预警） */
  fingerprint?: string;
  /** 触发时间 */
  triggerTime?: string;
  /** 处置状态 */
  status?: string;
  /** 处置说明 */
  processRemark?: string;
  /** 处置人用户ID */
  processBy?: string;
  /** 处置时间 */
  processTime?: string;
  /** 推送结果 */
  pushResult?: string;
  /** 触发规则名称 */
  ruleName?: string;
  /** 舆情标题 */
  opinionTitle?: string;
  /** 事件标题 */
  clusterTitle?: string;
  /** 处置人 */
  processByName?: string;
  /** 来源渠道 */
  channelName?: string;
  /** 发布时间 */
  publishTime?: string;
}

/**
 * 预警记录 视图
 */
export interface YqAlertVO {
  /** 主键 */
  alertId?: string;
  /** 触发规则ID */
  ruleId?: string;
  /** 关联舆情ID */
  opinionId?: string;
  /** 关联事件聚合ID */
  clusterId?: string;
  /** 预警标题 */
  alertTitle?: string;
  /** 触发场景 */
  triggerScene?: string;
  /** 预警级别 */
  alertLevel?: string;
  /** 触发值描述 */
  triggerValue?: string;
  /** 事件聚合指纹（同指纹冷却期内不重复预警） */
  fingerprint?: string;
  /** 触发时间 */
  triggerTime?: string;
  /** 处置状态 */
  status?: string;
  /** 处置说明 */
  processRemark?: string;
  /** 处置人用户ID */
  processBy?: string;
  /** 处置时间 */
  processTime?: string;
  /** 推送结果 */
  pushResult?: string;
  /** 创建时间 */
  createTime?: string;
  /** 触发规则名称 */
  ruleName?: any;
  /** 舆情标题 */
  opinionTitle?: any;
  /** 事件标题 */
  clusterTitle?: any;
  /** 处置人 */
  processByName?: any;
  /** 来源渠道 */
  channelName?: any;
  /** 发布时间 */
  publishTime?: any;
}
