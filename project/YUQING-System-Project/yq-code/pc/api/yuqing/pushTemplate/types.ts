/**
 * 推送模板 查询
 */
export interface YqPushTemplateQuery extends PageQuery {
  /** 模板名称 */
  templateName?: string;
  /** 内容形式 */
  contentType?: string;
  /** 模板正文（含占位符） */
  bodyTemplate?: string;
  /** 模板包含字段清单 */
  fieldList?: string;
  /** 状态（0正常 1停用） */
  status?: string;
}

/**
 * 推送模板 表单
 */
export interface YqPushTemplateForm {
  /** 主键 */
  templateId?: string;
  /** 模板名称 */
  templateName?: string;
  /** 内容形式 */
  contentType?: string;
  /** 模板正文（含占位符） */
  bodyTemplate?: string;
  /** 模板包含字段清单 */
  fieldList?: string;
  /** 状态（0正常 1停用） */
  status?: string;

}

/**
 * 推送模板 视图
 */
export interface YqPushTemplateVO {
  /** 主键 */
  templateId?: string;
  /** 模板名称 */
  templateName?: string;
  /** 内容形式 */
  contentType?: string;
  /** 模板正文（含占位符） */
  bodyTemplate?: string;
  /** 模板包含字段清单 */
  fieldList?: string;
  /** 状态（0正常 1停用） */
  status?: string;
  /** 创建时间 */
  createTime?: string;

}
