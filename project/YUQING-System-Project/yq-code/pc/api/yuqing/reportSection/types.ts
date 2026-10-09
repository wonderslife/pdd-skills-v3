/**
 * 报告模板章节 查询
 */
export interface YqReportSectionQuery extends PageQuery {
  /** 所属模板ID */
  templateId?: string;
  /** 章节编码 */
  sectionCode?: string;
  /** 章节标题 */
  sectionName?: string;
  /** 排序 */
  orderNum?: number;
  /** 是否必含（0否 1是） */
  required?: string;
}

/**
 * 报告模板章节 表单
 */
export interface YqReportSectionForm {
  /** 主键 */
  sectionId?: string;
  /** 所属模板ID */
  templateId?: string;
  /** 章节编码 */
  sectionCode?: string;
  /** 章节标题 */
  sectionName?: string;
  /** 排序 */
  orderNum?: number;
  /** 是否必含（0否 1是） */
  required?: string;

}

/**
 * 报告模板章节 视图
 */
export interface YqReportSectionVO {
  /** 主键 */
  sectionId?: string;
  /** 所属模板ID */
  templateId?: string;
  /** 章节编码 */
  sectionCode?: string;
  /** 章节标题 */
  sectionName?: string;
  /** 排序 */
  orderNum?: number;
  /** 是否必含（0否 1是） */
  required?: string;
  /** 创建时间 */
  createTime?: string;

}
