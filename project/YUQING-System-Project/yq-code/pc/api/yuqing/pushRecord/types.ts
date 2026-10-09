/**
 * 推送记录 查询
 */
export interface YqPushRecordQuery extends PageQuery {
  /** 推送规则ID */
  ruleId?: string;
  /** 推送场景 */
  pushScene?: string;
  /** 推送级别 */
  pushLevel?: string;
  /** 推送内容快照 */
  contentSnapshot?: string;
  /** 实际接收人（逗号分隔） */
  targetIds?: string;
  /** 关联舆情ID（逗号分隔） */
  opinionIds?: string;
  /** 关联报告ID */
  reportId?: string;
  /** 发送状态 */
  sendStatus?: string;
  /** 已重试次数 */
  retryCount?: number;
  /** 失败原因 */
  failReason?: string;
  /** 发送时间 */
  sendTime?: string;
}

/**
 * 推送记录 表单
 */
export interface YqPushRecordForm {
  /** 主键 */
  recordId?: string;
  /** 推送规则ID */
  ruleId?: string;
  /** 推送场景 */
  pushScene?: string;
  /** 推送级别 */
  pushLevel?: string;
  /** 推送内容快照 */
  contentSnapshot?: string;
  /** 实际接收人（逗号分隔） */
  targetIds?: string;
  /** 关联舆情ID（逗号分隔） */
  opinionIds?: string;
  /** 关联报告ID */
  reportId?: string;
  /** 发送状态 */
  sendStatus?: string;
  /** 已重试次数 */
  retryCount?: number;
  /** 失败原因 */
  failReason?: string;
  /** 发送时间 */
  sendTime?: string;
  /** 推送规则名称 */
  ruleName?: string;
}

/**
 * 推送记录 视图
 */
export interface YqPushRecordVO {
  /** 主键 */
  recordId?: string;
  /** 推送规则ID */
  ruleId?: string;
  /** 推送场景 */
  pushScene?: string;
  /** 推送级别 */
  pushLevel?: string;
  /** 推送内容快照 */
  contentSnapshot?: string;
  /** 实际接收人（逗号分隔） */
  targetIds?: string;
  /** 关联舆情ID（逗号分隔） */
  opinionIds?: string;
  /** 关联报告ID */
  reportId?: string;
  /** 发送状态 */
  sendStatus?: string;
  /** 已重试次数 */
  retryCount?: number;
  /** 失败原因 */
  failReason?: string;
  /** 发送时间 */
  sendTime?: string;
  /** 创建时间 */
  createTime?: string;
  /** 推送规则名称 */
  ruleName?: any;
}
