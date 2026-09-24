/**
 * 多维分析看板 · 类型定义（F-009）
 *
 * 注意：不要从这里导出 PageQuery —— 它是 src/types/global.d.ts 里的全局环境接口，
 * 一旦被 import 就会变成模块作用域，全项目的 PageQuery 使用者会集体报 TS2305。
 */

/** 看板查询条件（与后端 AggregateScope 字段一一对应） */
export interface AnalyticsQuery {
  dateFrom?: string;
  dateTo?: string;
  taskId?: string | number;
  channelId?: string | number;
  sentiAttr?: string;
  riskLevel?: string;
  opinionLevel?: string;
  spreadLevel?: string;
  /** 趋势粒度 hour / day / week */
  grain?: string;
  /** 热点排序口径 read / share / comment / heat */
  rankBy?: string;
}

/** 维度条目：分布卡片的一行，也是趋势曲线的一个点 */
export interface DimItem {
  dimType?: string;
  dimKey?: string;
  dimLabel?: string;
  opinionCount?: number;
  positiveCount?: number;
  neutralCount?: number;
  negativeCount?: number;
  highRiskCount?: number;
  readSum?: number;
  commentSum?: number;
  shareSum?: number;
  likeSum?: number;
  heatSum?: number;
  negativeRate?: number;
  share?: number;
}

/** 总量卡 */
export interface TotalsView {
  totalCount?: number;
  positiveCount?: number;
  neutralCount?: number;
  negativeCount?: number;
  highRiskCount?: number;
  positiveRate?: number;
  neutralRate?: number;
  negativeRate?: number;
  readSum?: number;
  commentSum?: number;
  shareSum?: number;
  likeSum?: number;
  interactionSum?: number;
  avgHeatScore?: number;
  dupCount?: number;
  rejectedCount?: number;
  alertCount?: number;
  pushCount?: number;
  reportCount?: number;
}

/** 热点排行条目 */
export interface HotItem {
  rankNo?: number;
  opinionId?: string | number;
  taskId?: string | number;
  channelId?: string | number;
  title?: string;
  channelName?: string;
  opinionUrl?: string;
  publishTime?: string;
  sentiAttr?: string;
  riskLevel?: string;
  readCount?: number;
  commentCount?: number;
  shareCount?: number;
  likeCount?: number;
  heatScore?: number;
}

/** 核心舆情事件 */
export interface CoreEvent {
  clusterId?: string | number;
  title?: string;
  opinionUrl?: string;
  opinionId?: string | number;
  opinionCount?: number;
  negativeCount?: number;
  negativeRate?: number;
  heatSum?: number;
  firstTime?: string;
  lastTime?: string;
  channels?: string[];
}

/** 传播路径的一站 */
export interface PropagationStage {
  seq?: number;
  channelName?: string;
  firstTime?: string;
  lastTime?: string;
  opinionCount?: number;
  countShare?: number;
  gapMinutes?: number;
}

/** 舆论焦点 */
export interface FocusPoint {
  kind?: string;
  key?: string;
  label?: string;
  opinionCount?: number;
  share?: number;
  negativeRate?: number;
  heatSum?: number;
}

/** 潜在风险点 */
export interface RiskPoint {
  level?: string;
  type?: string;
  detail?: string;
  value?: number;
  threshold?: number;
  target?: string;
}

/** 结构化分析结论 */
export interface AnalysisConclusion {
  clusterBased?: boolean;
  coreEvents?: CoreEvent[];
  propagation?: PropagationStage[];
  focusPoints?: FocusPoint[];
  riskPoints?: RiskPoint[];
  narrative?: string[];
  firstTime?: string;
  lastTime?: string;
  durationHours?: number;
  speedPerHour?: number;
  peakBucket?: string;
  peakCount?: number;
  generatedAt?: string;
}

/** 批次元信息 */
export interface BatchMeta {
  batchNo?: string;
  beginDate?: string;
  endDate?: string;
  dataUntil?: string;
  aggregatedAt?: string;
  degraded?: boolean;
  failReason?: string;
  conclusionJson?: string;
  available?: boolean;
}

/** 看板视图 */
export interface DashboardView {
  scope?: AnalyticsQuery;
  grain?: string;
  rankBy?: string;
  trendBase?: string;
  totals?: TotalsView;
  platform?: DimItem[];
  region?: DimItem[];
  topic?: DimItem[];
  senti?: DimItem[];
  risk?: DimItem[];
  level?: DimItem[];
  spread?: DimItem[];
  trend?: DimItem[];
  hot?: HotItem[];
  conclusion?: AnalysisConclusion;
  /** 结论来源 batch / derived / none */
  conclusionMode?: string;
  batch?: BatchMeta;
  notices?: string[];
  dateFrom?: string;
  dateTo?: string;
}

/** 下钻明细行 */
export interface DrilldownRow {
  opinionId?: string | number;
  title?: string;
  channelName?: string;
  publishTime?: string;
  sentiAttr?: string;
  riskLevel?: string;
  region?: string;
  topicTags?: string;
  readCount?: number;
  commentCount?: number;
  shareCount?: number;
  likeCount?: number;
  opinionUrl?: string;
}

/** 下钻结果 */
export interface DrilldownResult {
  dimType?: string;
  dimKey?: string;
  dimLabel?: string;
  conditionText?: string;
  total?: number;
  pageNum?: number;
  pageSize?: number;
  rows?: DrilldownRow[];
}

/** 下钻请求参数 */
export interface DrilldownParams extends AnalyticsQuery {
  dimType: string;
  dimKey?: string;
  dimLabel?: string;
  opinionId?: string | number;
  pageNum?: number;
  pageSize?: number;
}

/** 重算请求 */
export interface AggregateRequest {
  dateFrom?: string;
  dateTo?: string;
  taskId?: string | number;
  channelId?: string | number;
  triggerType?: string;
  purge?: boolean;
}

/** 重算执行摘要 */
export interface AggregateSummary {
  batchNo?: string;
  status?: string;
  scopeText?: string;
  sourceCount?: number;
  dailyRows?: number;
  dimRows?: number;
  hotRows?: number;
  costMs?: number;
  dataUntil?: string;
  conclusionMode?: string;
  notices?: string[];
  failReason?: string;
}

/** 聚合批次台账行 */
export interface StatsBatchVO {
  batchId?: string | number;
  batchNo?: string;
  beginDate?: string;
  endDate?: string;
  triggerType?: string;
  status?: string;
  sourceCount?: number;
  dailyRows?: number;
  dimRows?: number;
  hotRows?: number;
  costMs?: number;
  dataUntil?: string;
  notice?: string;
  failReason?: string;
  createTime?: string;
}

/** 报告章节交接包（用于「带入报告」预览） */
export interface ReportSection {
  sectionCode?: string;
  title?: string;
  markdown?: string;
  metrics?: Record<string, any>;
  scopeText?: string;
  dataUntil?: string;
  sourceBatch?: string;
  generatedAt?: string;
}
