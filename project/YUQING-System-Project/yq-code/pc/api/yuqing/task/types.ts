/**
 * 监测任务 查询
 */
export interface YqTaskQuery extends PageQuery {
  /** 任务名称 */
  taskName?: string;
  /** 任务类型 */
  taskType?: string;
  /** 任务来源 */
  taskSource?: string;
  /** 采集策略 */
  collectStrategy?: string;
  /** 采集间隔（秒） */
  collectInterval?: number;
  /** 分级规则ID */
  levelRuleId?: string;
  /** 预警规则ID */
  alertRuleId?: string;
  /** 推送规则ID */
  pushRuleId?: string;
  /** 任务生效起始 */
  startTime?: string;
  /** 任务结束时间（常态化为空） */
  endTime?: string;
  /** 最近一次调度时间 */
  lastScheduleTime?: string;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 备注 */
  remark?: string;
}

/**
 * 监测任务 表单
 */
export interface YqTaskForm {
  /** 主键 */
  taskId?: string;
  /** 任务名称 */
  taskName?: string;
  /** 任务类型 */
  taskType?: string;
  /** 任务来源 */
  taskSource?: string;
  /** 采集策略 */
  collectStrategy?: string;
  /** 采集间隔（秒） */
  collectInterval?: number;
  /** 分级规则ID */
  levelRuleId?: string;
  /** 预警规则ID */
  alertRuleId?: string;
  /** 推送规则ID */
  pushRuleId?: string;
  /** 任务生效起始 */
  startTime?: string;
  /** 任务结束时间（常态化为空） */
  endTime?: string;
  /** 最近一次调度时间 */
  lastScheduleTime?: string;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 备注 */
  remark?: string;
  /** 分级规则名称 */
  levelRuleName?: string;
  /** 预警规则名称 */
  alertRuleName?: string;
  /** 推送规则名称 */
  pushRuleName?: string;
  /** 关键词关联 */
  keywordList?: any[];
  /** 渠道关联 */
  channelList?: any[];
}

/**
 * 监测任务 视图
 */
export interface YqTaskVO {
  /** 主键 */
  taskId?: string;
  /** 任务名称 */
  taskName?: string;
  /** 任务类型 */
  taskType?: string;
  /** 任务来源 */
  taskSource?: string;
  /** 采集策略 */
  collectStrategy?: string;
  /** 采集间隔（秒） */
  collectInterval?: number;
  /** 分级规则ID */
  levelRuleId?: string;
  /** 预警规则ID */
  alertRuleId?: string;
  /** 推送规则ID */
  pushRuleId?: string;
  /** 任务生效起始 */
  startTime?: string;
  /** 任务结束时间（常态化为空） */
  endTime?: string;
  /** 最近一次调度时间 */
  lastScheduleTime?: string;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 备注 */
  remark?: string;
  /** 创建时间 */
  createTime?: string;
  /** 分级规则名称 */
  levelRuleName?: any;
  /** 预警规则名称 */
  alertRuleName?: any;
  /** 推送规则名称 */
  pushRuleName?: any;
  /** 关键词关联 */
  keywordList?: any;
  /** 渠道关联 */
  channelList?: any;
}
