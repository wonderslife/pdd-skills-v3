/**
 * 巡检记录查询
 */
export interface InspectRecordQuery extends PageQuery {
  /** 点位ID */
  pointId?: string | number;
  /** 机房ID */
  roomId?: string | number;
  /** 巡检员用户ID */
  inspectorId?: string | number;
  /** 巡检结果 */
  result?: string;
  /** 数据来源 h5_scan / pc_supplement */
  source?: string;
  /** 扩展参数：{ beginTime, endTime } 巡检时间区间 */
  params?: Record<string, any>;
}

/**
 * 巡检记录 视图
 */
export interface InspectRecordVO {
  /** 主键 */
  recordId?: string | number;
  /** 点位ID */
  pointId?: string | number;
  /** 机房ID */
  roomId?: string | number;
  /** 巡检员用户ID */
  inspectorId?: string | number;
  /** 巡检时间 */
  inspectTime?: string;
  /** 耗时（秒） */
  duration?: number;
  /** 巡检结果 */
  result?: string;
  /** 异常项数量 */
  abnormalCount?: number;
  /** 数据来源 */
  source?: string;
  /** 整体备注 */
  remark?: string;
  /** 管理员追加备注 */
  adminRemark?: string;
  /** 点位名称 */
  pointName?: string;
  /** 机房名称 */
  roomName?: string;
  /** 巡检员名称 */
  inspectorName?: string;
  /** 巡检项结果 */
  itemResults?: InspectRecordItemVO[];
  /** 巡检照片 */
  photos?: InspectPhotoVO[];
}

/**
 * 巡检项结果
 */
export interface InspectRecordItemVO {
  recordItemId?: string | number;
  recordId?: string | number;
  itemId?: string | number;
  itemName?: string;
  result?: string;
  value?: string;
  description?: string;
  orderNum?: number;
  photoUrls?: string[];
}

/**
 * 巡检照片
 */
export interface InspectPhotoVO {
  photoId?: string | number;
  recordId?: string | number;
  recordItemId?: string | number;
  originalUrl?: string;
  compressedUrl?: string;
  fileName?: string;
}

/**
 * 巡检记录提交（H5 现场提交 / PC 逾期补录共用）
 */
export interface InspectRecordSubmitForm {
  /** 点位ID */
  pointId: string | number;
  /** 耗时（秒） */
  duration?: number;
  /** 整体备注 */
  remark?: string;
  /** 巡检时间（仅 PC 补录可指定，yyyy-MM-dd HH:mm:ss） */
  inspectTime?: string;
  /** 被补录的巡检员ID（仅 PC 补录） */
  inspectorId?: string | number;
  /** 补录原因（仅 PC 补录必填） */
  supplementReason?: string;
  /** 巡检项结果 */
  itemResults?: Array<{
    itemId?: string | number;
    itemName?: string;
    result?: string;
    value?: string;
    description?: string;
    orderNum?: number;
    photos?: Array<{
      originalUrl?: string;
      originalSize?: number;
      compressedUrl?: string;
      compressedSize?: number;
      fileName?: string;
    }>;
  }>;
}
