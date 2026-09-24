/**
 * 舆情标签关联 查询
 */
export interface YqOpinionTagQuery extends PageQuery {
  /** 舆情ID */
  opinionId?: string;
  /** 标签ID */
  tagId?: string;
  /** 标签来源 */
  tagSource?: string;
}

/**
 * 舆情标签关联 表单
 */
export interface YqOpinionTagForm {
  /** 主键 */
  id?: string;
  /** 舆情ID */
  opinionId?: string;
  /** 标签ID */
  tagId?: string;
  /** 标签来源 */
  tagSource?: string;
  /** 标签名称 */
  tagName?: string;
}

/**
 * 舆情标签关联 视图
 */
export interface YqOpinionTagVO {
  /** 主键 */
  id?: string;
  /** 舆情ID */
  opinionId?: string;
  /** 标签ID */
  tagId?: string;
  /** 标签来源 */
  tagSource?: string;
  /** 创建时间 */
  createTime?: string;
  /** 标签名称 */
  tagName?: any;
}
