/**
 * 机房 查询
 */
export interface InspectRoomQuery extends PageQuery {
  /** 机房名称 */
  roomName?: string;
  /** 机房编码 */
  roomCode?: string;
  /** 机房地址 */
  address?: string;
  /** 负责人姓名 */
  managerName?: string;
  /** 负责人电话 */
  managerPhone?: string;
  /** 状态 */
  status?: string;
  /** 备注 */
  remark?: string;
}

/**
 * 机房 表单
 */
export interface InspectRoomForm {
  /** 主键 */
  roomId?: string;
  /** 机房名称 */
  roomName?: string;
  /** 机房编码 */
  roomCode?: string;
  /** 机房地址 */
  address?: string;
  /** 负责人姓名 */
  managerName?: string;
  /** 负责人电话 */
  managerPhone?: string;
  /** 状态 */
  status?: string;
  /** 备注 */
  remark?: string;

}

/**
 * 机房 视图
 */
export interface InspectRoomVO {
  /** 主键 */
  roomId?: string;
  /** 机房名称 */
  roomName?: string;
  /** 机房编码 */
  roomCode?: string;
  /** 机房地址 */
  address?: string;
  /** 负责人姓名 */
  managerName?: string;
  /** 负责人电话 */
  managerPhone?: string;
  /** 状态 */
  status?: string;
  /** 备注 */
  remark?: string;
  /** 创建时间 */
  createTime?: string;

}
