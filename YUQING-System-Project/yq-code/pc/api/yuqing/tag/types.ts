/**
 * 标签 查询
 */
export interface YqTagQuery extends PageQuery {
  /** 标签名称 */
  tagName?: string;
  /** 父标签ID（顶级为0） */
  parentId?: string;
  /** 显示顺序 */
  orderNum?: number;
  /** 状态（0正常 1停用） */
  status?: string;
}

/**
 * 标签 表单
 */
export interface YqTagForm {
  /** 主键 */
  tagId?: string;
  /** 标签名称 */
  tagName?: string;
  /** 父标签ID（顶级为0） */
  parentId?: string;
  /** 显示顺序 */
  orderNum?: number;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 父标签名称 */
  parentName?: string;
}

/**
 * 标签 视图
 */
export interface YqTagVO {
  /** 主键 */
  tagId?: string;
  /** 标签名称 */
  tagName?: string;
  /** 父标签ID（顶级为0） */
  parentId?: string;
  /** 显示顺序 */
  orderNum?: number;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 创建时间 */
  createTime?: string;
  /** 父标签名称 */
  parentName?: any;
}
