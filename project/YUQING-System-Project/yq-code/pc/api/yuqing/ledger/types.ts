/**
 * 舆情台账 类型定义（F-016）
 *
 * ⚠ 本文件不得 import PageQuery —— 它是全局接口，import 即 TS2305 + TS2339。
 * ⚠ 所有字段可选：本文件里的接口全部会作为 el-table 的行类型，
 *   Element Plus 的 el-table 不是泛型组件，插槽 scope.row 固定为
 *   Record<PropertyKey, any>，字段必需会在 handle(scope.row) 传参处报 TS2345。
 */

/** 台账列表行（对应后端 LedgerRow） */
export interface LedgerRowVO {
  opinionId?: string | number;
  title?: string;
  channelName?: string;
  taskName?: string;
  publishTime?: string;
  author?: string;
  sentiAttr?: string;
  riskLevel?: string;
  opinionLevel?: string;
  heatScore?: number;
  collectSource?: string;
  collectTime?: string;
  analyzeStatus?: string;
  cleanStatus?: string;
  region?: string;
  clusterTitle?: string;
  opinionUrl?: string;
  alertFlag?: string;
  pushFlag?: string;
  clusterId?: string | number;
  /** 检索命中的高亮片段（服务端已转义，可直接 v-html） */
  fragments?: string[];
}

/** 台账分页结果（对应后端 LedgerPage；不使用 PageResult，因为要带 hints/scopeDesc） */
export interface LedgerPageVO {
  rows?: LedgerRowVO[];
  total?: number;
  hints?: string[];
  scopeDesc?: string;
  activeConditions?: number;
  scopeEmpty?: boolean;
}

/** 互动数据快照点 */
export interface LedgerMetricPoint {
  snapshotDate?: string;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  readCount?: number;
  heatScore?: number;
}

/** 研判结论（含历史版本） */
export interface LedgerAnalysisVO {
  analysisId?: string | number;
  topic?: string;
  summary?: string;
  sentiAttr?: string;
  riskAttr?: string;
  riskLevel?: string;
  opinionLevel?: string;
  tags?: string;
  matchEvidence?: string;
  suggestion?: string;
  confidence?: number;
  modelVersion?: string;
  promptVersion?: string;
  analyzeVersion?: number;
  correctedFlag?: string;
  correctedBy?: string | number;
  correctedTime?: string;
  analyzeTime?: string;
  failReason?: string;
}

/** 预警记录 */
export interface LedgerAlertVO {
  alertId?: string | number;
  alertTitle?: string;
  triggerScene?: string;
  alertLevel?: string;
  triggerValue?: string;
  triggerTime?: string;
  status?: string;
  processRemark?: string;
  processBy?: string | number;
  processByName?: string;
  processTime?: string;
  pushResult?: string;
  ruleName?: string;
}

/** 推送记录 */
export interface LedgerPushVO {
  recordId?: string | number;
  ruleName?: string;
  pushScene?: string;
  pushLevel?: string;
  sendStatus?: string;
  targetIds?: string;
  retryCount?: number;
  failReason?: string;
  sendTime?: string;
  contentDigest?: string;
}

/** 舆情详情（对应后端 LedgerDetail） */
export interface LedgerDetailVO {
  opinionId?: string | number;
  title?: string;
  content?: string;
  opinionUrl?: string;
  urlHash?: string;
  author?: string;
  publishTime?: string;
  region?: string;
  deviceInfo?: string;
  topicTags?: string;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  readCount?: number;
  heatScore?: number;
  metricTrend?: LedgerMetricPoint[];
  taskId?: string | number;
  taskName?: string;
  channelId?: string | number;
  channelName?: string;
  collectSource?: string;
  collectTime?: string;
  batchNo?: string;
  dupChannelIds?: string;
  cleanStatus?: string;
  noiseReason?: string;
  cleanTime?: string;
  analyzeStatus?: string;
  alertFlag?: string;
  pushFlag?: string;
  sentiAttr?: string;
  riskLevel?: string;
  opinionLevel?: string;
  spreadLevel?: string;
  tagNames?: string[];
  analysis?: LedgerAnalysisVO;
  analysisHistory?: LedgerAnalysisVO[];
  alerts?: LedgerAlertVO[];
  pushes?: LedgerPushVO[];
  /* ---- 事件聚合块（与后端 LedgerDetail 的「事件聚合块」一一对应） ---- */
  /** 事件聚合ID */
  clusterId?: string | number;
  /** 事件聚合标题 */
  clusterTitle?: string;
}

/** 全文检索命中 */
export interface LedgerSearchHit {
  opinionId?: string | number;
  title?: string;
  channelName?: string;
  publishTime?: string;
  sentiAttr?: string;
  riskLevel?: string;
  hitField?: string;
  hitCount?: number;
  fragments?: string[];
  score?: number;
  opinionUrl?: string;
}

/** 全文检索结果 */
export interface LedgerSearchResultVO {
  hits?: LedgerSearchHit[];
  total?: number;
  keyword?: string;
  keywordScope?: string;
  /** inverted-index（Doris 倒排）/ like-scan（镜像库兜底），前端据此标注口径 */
  matchMode?: string;
  hints?: string[];
}

/** 传播时间轴节点 */
export interface LedgerTimelineNode {
  opinionId?: string | number;
  time?: string;
  timeBasis?: string;
  title?: string;
  channelName?: string;
  author?: string;
  sentiAttr?: string;
  riskLevel?: string;
  heatScore?: number;
  opinionUrl?: string;
  /** first / spread / peak / fall */
  stage?: string;
  offsetMinutes?: number;
}

/** 事件聚合视图 */
export interface ClusterViewVO {
  clusterId?: string | number;
  clusterTitle?: string;
  clusterTopic?: string;
  opinionCount?: number;
  firstTime?: string;
  lastTime?: string;
  peakHeat?: number;
  riskLevel?: string;
  stageCount?: Record<string, number>;
  timeline?: LedgerTimelineNode[];
  opinions?: LedgerRowVO[];
  timelineTruncated?: boolean;
}

/** 台账查询参数（与后端 LedgerQuery 一一对应） */
export interface LedgerQueryParams {
  pageNum?: number;
  pageSize?: number;
  collectBeginTime?: string;
  collectEndTime?: string;
  publishBeginTime?: string;
  publishEndTime?: string;
  taskId?: string | number;
  channelId?: string | number;
  sentiAttr?: string;
  riskLevel?: string;
  opinionLevel?: string;
  spreadLevel?: string;
  collectSource?: string;
  cleanStatus?: string;
  analyzeStatus?: string;
  alertFlag?: string;
  tagIds?: Array<string | number>;
  keyword?: string;
  keywordScope?: string;
  clusterId?: string | number;
  orderBy?: string;
  orderDesc?: boolean;
}

/** 导出请求 */
export interface LedgerExportForm {
  query: LedgerQueryParams;
  /** 导出字段（空 = 全部），取值来自接口返回的列目录 */
  columns?: string[];
  /** 是否强制异步 */
  async?: boolean;
  /** 只导前 N 条 */
  rowLimit?: number;
  fileNamePrefix?: string;
  /** ledger / cluster */
  exportScope?: string;
}

/** 导出结果 / 异步任务状态 */
export interface LedgerExportResultVO {
  exportId?: string | number;
  /** sync / async */
  mode?: string;
  /** pending / running / success / failed */
  status?: string;
  rowCount?: number;
  columnCount?: number;
  fileName?: string;
  fileUrl?: string;
  finishTime?: string;
  failReason?: string;
  message?: string;
  syncLimit?: number;
  scopeDesc?: string;
}

/** 导出审计记录 */
export interface LedgerExportLogVO {
  exportId?: string | number;
  exportScope?: string;
  querySummary?: string;
  rowCount?: number;
  columnCount?: number;
  exportMode?: string;
  status?: string;
  fileName?: string;
  fileUrl?: string;
  finishTime?: string;
  failReason?: string;
  operIp?: string;
  createBy?: string | number;
  createTime?: string;
}
