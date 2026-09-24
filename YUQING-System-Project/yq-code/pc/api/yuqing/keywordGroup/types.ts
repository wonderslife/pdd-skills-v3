/**
 * 关键词分组 查询
 */
export interface YqKeywordGroupQuery extends PageQuery {
  /** 分组名称 */
  groupName?: string;
}

/**
 * 关键词分组 表单
 */
export interface YqKeywordGroupForm {
  /** 主键 */
  groupId?: string;
  /** 分组名称 */
  groupName?: string;

}

/**
 * 关键词分组 视图
 */
export interface YqKeywordGroupVO {
  /** 主键 */
  groupId?: string;
  /** 分组名称 */
  groupName?: string;
  /** 创建时间 */
  createTime?: string;

}
