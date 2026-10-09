/**
 * 区域 查询
 */
export interface InspectAreaQuery extends PageQuery {
  /** 所属机房ID */
  roomId?: string;
  /** 父区域ID（顶级为0） */
  parentId?: string;
  /** 区域名称 */
  areaName?: string;
  /** 显示顺序 */
  orderNum?: number;
  /** 状态 */
  status?: string;
  /** 备注 */
  remark?: string;
}

/**
 * 区域 表单
 */
export interface InspectAreaForm {
  /** 主键 */
  areaId?: string;
  /** 所属机房ID */
  roomId?: string;
  /** 父区域ID（顶级为0） */
  parentId?: string;
  /** 区域名称 */
  areaName?: string;
  /** 显示顺序 */
  orderNum?: number;
  /** 状态 */
  status?: string;
  /** 备注 */
  remark?: string;
  /** 机房名称 */
  roomName?: string;
  /** 父区域名称 */
  parentName?: string;
}

/**
 * 区域 视图
 */
export interface InspectAreaVO {
  /** 主键 */
  areaId?: string;
  /** 所属机房ID */
  roomId?: string;
  /** 父区域ID（顶级为0） */
  parentId?: string;
  /** 区域名称 */
  areaName?: string;
  /** 显示顺序 */
  orderNum?: number;
  /** 状态 */
  status?: string;
  /** 备注 */
  remark?: string;
  /** 创建时间 */
  createTime?: string;
  /** 机房名称 */
  roomName?: any;
  /** 父区域名称 */
  parentName?: any;
}
