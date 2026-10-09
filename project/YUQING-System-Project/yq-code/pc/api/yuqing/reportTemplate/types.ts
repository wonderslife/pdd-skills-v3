/**
 * 报告模板 查询
 */
export interface YqReportTemplateQuery extends PageQuery {
  /** 模板名称 */
  templateName?: string;
  /** 报告类型 */
  reportType?: string;
  /** 是否同类型默认（0否 1是） */
  isDefault?: string;
  /** 封面字段（JSON） */
  coverFields?: string;
  /** 正文字体 */
  fontFamily?: string;
  /** 标题编号规则 */
  headingNumberRule?: string;
  /** 状态（0正常 1停用） */
  status?: string;
}

/**
 * 报告模板 表单
 */
export interface YqReportTemplateForm {
  /** 主键 */
  templateId?: string;
  /** 模板名称 */
  templateName?: string;
  /** 报告类型 */
  reportType?: string;
  /** 是否同类型默认（0否 1是） */
  isDefault?: string;
  /** 封面字段（JSON） */
  coverFields?: string;
  /** 正文字体 */
  fontFamily?: string;
  /** 标题编号规则 */
  headingNumberRule?: string;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 模板章节 */
  sectionList?: any[];
}

/**
 * 报告模板 视图
 */
export interface YqReportTemplateVO {
  /** 主键 */
  templateId?: string;
  /** 模板名称 */
  templateName?: string;
  /** 报告类型 */
  reportType?: string;
  /** 是否同类型默认（0否 1是） */
  isDefault?: string;
  /** 封面字段（JSON） */
  coverFields?: string;
  /** 正文字体 */
  fontFamily?: string;
  /** 标题编号规则 */
  headingNumberRule?: string;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 创建时间 */
  createTime?: string;
  /** 模板章节 */
  sectionList?: any;
}
