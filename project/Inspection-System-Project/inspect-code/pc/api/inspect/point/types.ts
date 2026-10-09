/**
 * 点位 查询
 */
export interface InspectPointQuery extends PageQuery {
  /** 点位名称 */
  pointName?: string;
  /** 点位编码 */
  pointCode?: string;
  /** 所属机房ID */
  roomId?: string | number;
  /** 所属区域ID */
  areaId?: string | number;
  /** 巡检周期类型 */
  cycleType?: string;
  /** 点位状态 */
  status?: string;
}

/**
 * 点位巡检项
 */
export interface InspectPointItemVO {
  /** 巡检项ID */
  itemId?: string | number;
  /** 所属点位ID */
  pointId?: string | number;
  /** 巡检项名称 */
  itemName?: string;
  /** 巡检项类型 radio/number/text */
  itemType?: string;
  /** 判定标准 */
  standard?: string;
  /** 是否必填（0否 1是） */
  required?: string;
  /** 显示顺序 */
  orderNum?: number;
  /** 来源模板ID */
  templateId?: string | number;
  /** 备注 */
  remark?: string;
}

/**
 * 点位 表单
 */
export interface InspectPointForm {
  /** 主键 */
  pointId?: string | number;
  /** 所属机房ID */
  roomId?: string | number;
  /** 所属区域ID */
  areaId?: string | number;
  /** 点位名称 */
  pointName?: string;
  /** 点位编码 */
  pointCode?: string;
  /** 位置描述 */
  location?: string;
  /** 巡检周期类型 daily/weekly/monthly/custom */
  cycleType?: string;
  /** 自定义间隔天数 */
  cycleValue?: number;
  /** GPS校验（0关 1开） */
  gpsEnabled?: string;
  /** 点位状态 */
  status?: string;
  /** 备注 */
  remark?: string;
  /** 巡检项清单 */
  itemList?: InspectPointItemVO[];
}

/**
 * 点位 视图
 */
export interface InspectPointVO {
  /** 主键 */
  pointId?: string | number;
  /** 所属机房ID */
  roomId?: string | number;
  /** 所属区域ID */
  areaId?: string | number;
  /** 点位名称 */
  pointName?: string;
  /** 点位编码 */
  pointCode?: string;
  /** 位置描述 */
  location?: string;
  /** 巡检周期类型 */
  cycleType?: string;
  /** 自定义间隔天数 */
  cycleValue?: number;
  /** GPS校验 */
  gpsEnabled?: string;
  /** 上次巡检时间 */
  lastInspectTime?: string;
  /** 点位状态 */
  status?: string;
  /** 备注 */
  remark?: string;
  /** 创建时间 */
  createTime?: string;
  /** 机房名称 */
  roomName?: string;
  /** 区域名称 */
  areaName?: string;
  /** 巡检项清单 */
  itemList?: InspectPointItemVO[];
}

/**
 * Excel 导入逐行校验结果（对应后端 PointImportRowVo）
 */
export interface PointImportRowVO {
  /** Excel 行号（从 1 开始，含表头偏移） */
  rowNum?: number;
  /** 是否通过校验 */
  success?: boolean;
  /** 校验失败原因，多行以 ; 连接 */
  errorMsg?: string;
  /** 解析出的行数据 */
  row?: InspectPointForm;
}
