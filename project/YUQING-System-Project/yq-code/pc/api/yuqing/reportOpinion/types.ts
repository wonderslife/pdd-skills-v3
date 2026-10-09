/**
 * 报告舆情关联 查询
 */
export interface YqReportOpinionQuery extends PageQuery {
  /** 报告ID */
  reportId?: string;
  /** 舆情ID */
  opinionId?: string;
  /** 纳入方式 */
  includeSource?: string;
  /** 增删操作人 */
  operateBy?: string;
}

/**
 * 报告舆情关联 表单
 */
export interface YqReportOpinionForm {
  /** 主键 */
  id?: string;
  /** 报告ID */
  reportId?: string;
  /** 舆情ID */
  opinionId?: string;
  /** 纳入方式 */
  includeSource?: string;
  /** 增删操作人 */
  operateBy?: string;

}

/**
 * 报告舆情关联 视图
 */
export interface YqReportOpinionVO {
  /** 主键 */
  id?: string;
  /** 报告ID */
  reportId?: string;
  /** 舆情ID */
  opinionId?: string;
  /** 纳入方式 */
  includeSource?: string;
  /** 增删操作人 */
  operateBy?: string;
  /** 创建时间 */
  createTime?: string;

}
