/**
 * 任务关键词关联 查询
 */
export interface YqTaskKeywordQuery extends PageQuery {
  /** 任务ID */
  taskId?: string;
  /** 关键词ID */
  keywordId?: string;
  /** 任务级匹配策略（覆盖全局） */
  matchStrategy?: string;
}

/**
 * 任务关键词关联 表单
 */
export interface YqTaskKeywordForm {
  /** 主键 */
  id?: string;
  /** 任务ID */
  taskId?: string;
  /** 关键词ID */
  keywordId?: string;
  /** 任务级匹配策略（覆盖全局） */
  matchStrategy?: string;
  /** 关键词文本 */
  keywordText?: string;
}

/**
 * 任务关键词关联 视图
 */
export interface YqTaskKeywordVO {
  /** 主键 */
  id?: string;
  /** 任务ID */
  taskId?: string;
  /** 关键词ID */
  keywordId?: string;
  /** 任务级匹配策略（覆盖全局） */
  matchStrategy?: string;
  /** 创建时间 */
  createTime?: string;
  /** 关键词文本 */
  keywordText?: any;
}
