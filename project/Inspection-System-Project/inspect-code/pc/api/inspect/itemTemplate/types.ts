/**
 * 巡检项模板 查询
 */
export interface InspectItemTemplateQuery extends PageQuery {
  /** 模板名称 */
  templateName?: string;
  /** 模板说明 */
  description?: string;
  /** 备注 */
  remark?: string;
}

/**
 * 巡检项模板 表单
 */
export interface InspectItemTemplateForm {
  /** 主键 */
  templateId?: string;
  /** 模板名称 */
  templateName?: string;
  /** 模板说明 */
  description?: string;
  /** 备注 */
  remark?: string;
  /** 模板明细 */
  detailList?: any[];
}

/**
 * 巡检项模板 视图
 */
export interface InspectItemTemplateVO {
  /** 主键 */
  templateId?: string;
  /** 模板名称 */
  templateName?: string;
  /** 模板说明 */
  description?: string;
  /** 备注 */
  remark?: string;
  /** 创建时间 */
  createTime?: string;
  /** 模板明细 */
  detailList?: any;
}
