/**
 * 关键词 查询
 */
export interface YqKeywordQuery extends PageQuery {
  /** 所属分组ID */
  groupId?: string;
  /** 关键词文本 */
  keywordText?: string;
  /** 关键词类型 */
  keywordType?: string;
  /** 关键词分类 */
  keywordCategory?: string;
  /** 组合表达式（type=combo 必填） */
  comboExpression?: string;
  /** 被引用次数 */
  refCount?: number;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 备注 */
  remark?: string;
}

/**
 * 关键词 表单
 */
export interface YqKeywordForm {
  /** 主键 */
  keywordId?: string;
  /** 所属分组ID */
  groupId?: string;
  /** 关键词文本 */
  keywordText?: string;
  /** 关键词类型 */
  keywordType?: string;
  /** 关键词分类 */
  keywordCategory?: string;
  /** 组合表达式（type=combo 必填） */
  comboExpression?: string;
  /** 被引用次数 */
  refCount?: number;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 备注 */
  remark?: string;
  /** 分组名称 */
  groupName?: string;
}

/**
 * 关键词 视图
 */
export interface YqKeywordVO {
  /** 主键 */
  keywordId?: string;
  /** 所属分组ID */
  groupId?: string;
  /** 关键词文本 */
  keywordText?: string;
  /** 关键词类型 */
  keywordType?: string;
  /** 关键词分类 */
  keywordCategory?: string;
  /** 组合表达式（type=combo 必填） */
  comboExpression?: string;
  /** 被引用次数 */
  refCount?: number;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 备注 */
  remark?: string;
  /** 创建时间 */
  createTime?: string;
  /** 分组名称 */
  groupName?: any;
}
