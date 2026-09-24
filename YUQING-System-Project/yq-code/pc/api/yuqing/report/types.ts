/**
 * 舆情报告 类型定义（F-014）
 *
 * ⚠ 本文件不得 import PageQuery —— 它是全局接口，import 即 TS2305 + TS2339。
 */
export interface YqReportVO {
  reportId?: string | number;
  reportName?: string;
  reportType?: string;
  reportDate?: string;
  templateId?: string | number;
  templateName?: string;
  triggerType?: string;
  content?: string;
  fileUrl?: string;
  fileFormat?: string;
  version?: number;
  status?: string;
  submitStatus?: string;
  submitBy?: string | number;
  submitByName?: string;
  submitTime?: string;
  failReason?: string;
  opinionCount?: number;
  createTime?: string;
}

export interface YqReportForm {
  reportId?: string | number;
  reportName?: string;
  reportType?: string;
  reportDate?: string;
  templateId?: string | number;
  triggerType?: string;
  content?: string;
  fileUrl?: string;
  fileFormat?: string;
  version?: number;
  status?: string;
  failReason?: string;
}

export interface YqReportQuery {
  pageNum?: number;
  pageSize?: number;
  reportName?: string;
  reportType?: string;
  reportDate?: string;
  status?: string;
  submitStatus?: string;
}

/** 生成请求 */
export interface ReportGenerateForm {
  reportType: string;
  reportDate: string;
  templateId?: string | number;
  reportName?: string;
  overwrite?: boolean;
  pushAfter?: boolean;
}

/** 生成结果 */
export interface ReportGenerateResult {
  reportId?: string | number;
  reportName?: string;
  status?: string;
  version?: number;
  fileUrl?: string;
  fileFormat?: string;
  failReason?: string;
  opinionCount?: number;
  contentLength?: number;
  generatedAt?: string;
  notices?: string[];
}

/** 报告纳入的舆情条目 */
export interface ReportOpinionRow {
  opinionId?: string | number;
  title?: string;
  channelName?: string;
  sentiAttr?: string;
  riskLevel?: string;
  heatScore?: number;
  readCount?: number;
  shareCount?: number;
  commentCount?: number;
  opinionUrl?: string;
  publishTime?: string;
}

/** 条目增删请求 */
export interface ReportOpinionForm {
  reportId: string | number;
  addOpinionIds?: Array<string | number>;
  removeOpinionIds?: Array<string | number>;
  remark?: string;
}
