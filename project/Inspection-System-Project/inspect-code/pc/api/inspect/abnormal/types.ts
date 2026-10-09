/**
 * 异常项查询
 */
export interface InspectAbnormalQuery extends PageQuery {
  /** 点位ID */
  pointId?: string | number;
  /** 机房ID */
  roomId?: string | number;
  /** 处理状态 pending / processed */
  status?: string;
  /** 记录ID */
  recordId?: string | number;
  /** 扩展参数：{ beginTime, endTime } 生成时间区间 */
  params?: Record<string, any>;
}

/**
 * 异常项 视图
 */
export interface InspectAbnormalVO {
  /** 主键 */
  abnormalId?: string | number;
  /** 所属记录ID */
  recordId?: string | number;
  /** 关联巡检项结果ID */
  recordItemId?: string | number;
  /** 点位ID */
  pointId?: string | number;
  /** 机房ID */
  roomId?: string | number;
  /** 处理状态 */
  status?: string;
  /** 处理说明 */
  processRemark?: string;
  /** 处理人用户ID */
  processBy?: string | number;
  /** 处理时间 */
  processTime?: string;
  /** 点位名称 */
  pointName?: string;
  /** 机房名称 */
  roomName?: string;
  /** 巡检项名称 */
  itemName?: string;
  /** 巡检时间 */
  inspectTime?: string;
  /** 异常说明 */
  description?: string;
  /** 现场照片URL */
  photoUrls?: string[];
}
