/**
 * 企业微信指令 查询
 */
export interface YqWecomCommandQuery extends PageQuery {
  /** 发起人用户ID */
  userId?: string;
  /** 企业微信成员ID */
  wecomUserId?: string;
  /** 指令原文 */
  commandText?: string;
  /** 识别出的指令类型 */
  commandType?: string;
  /** 解析出的参数（JSON） */
  parsedParams?: string;
  /** 关联任务ID */
  refTaskId?: string;
  /** 关联报告ID */
  refReportId?: string;
  /** 执行状态 */
  execStatus?: string;
  /** 执行结果摘要 */
  execResult?: string;
  /** 执行时间 */
  execTime?: string;
}

/**
 * 企业微信指令 表单
 */
export interface YqWecomCommandForm {
  /** 主键 */
  commandId?: string;
  /** 发起人用户ID */
  userId?: string;
  /** 企业微信成员ID */
  wecomUserId?: string;
  /** 指令原文 */
  commandText?: string;
  /** 识别出的指令类型 */
  commandType?: string;
  /** 解析出的参数（JSON） */
  parsedParams?: string;
  /** 关联任务ID */
  refTaskId?: string;
  /** 关联报告ID */
  refReportId?: string;
  /** 执行状态 */
  execStatus?: string;
  /** 执行结果摘要 */
  execResult?: string;
  /** 执行时间 */
  execTime?: string;

}

/**
 * 企业微信指令 视图
 */
export interface YqWecomCommandVO {
  /** 主键 */
  commandId?: string;
  /** 发起人用户ID */
  userId?: string;
  /** 企业微信成员ID */
  wecomUserId?: string;
  /** 指令原文 */
  commandText?: string;
  /** 识别出的指令类型 */
  commandType?: string;
  /** 解析出的参数（JSON） */
  parsedParams?: string;
  /** 关联任务ID */
  refTaskId?: string;
  /** 关联报告ID */
  refReportId?: string;
  /** 执行状态 */
  execStatus?: string;
  /** 执行结果摘要 */
  execResult?: string;
  /** 执行时间 */
  execTime?: string;
  /** 创建时间 */
  createTime?: string;

}
