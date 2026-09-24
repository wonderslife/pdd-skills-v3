/**
 * 智能研判 类型定义（F-007）
 *
 * ⚠ 本文件不得 import PageQuery —— 它是全局接口，import 即 TS2305 + TS2339。
 * ⚠ 所有字段可选：AnalysisRowVO / ClusterCardVO 都会作为 el-table 的行类型，
 *   Element Plus 的 el-table 不是泛型组件，插槽 scope.row 固定为
 *   Record<PropertyKey, any>，字段必需会在 handle(scope.row) 传参处报 TS2345。
 *   迷惑点：属性访问 scope.row.topic 不报错，只有函数传参才报错。
 */
import type { LedgerDetailVO } from '@/api/yuqing/ledger/types';

/**
 * 研判台账行（对应后端 AnalysisRow）
 *
 * 分两段：前段是舆情侧（来源、热度、聚类），后段是结论侧（主题、情感、
 * 风险、置信度、模型版本）。结论侧在「未研判」的行上是空的 ——
 * 前端必须容忍空白，不能拿它当必有值去算。
 */
export interface AnalysisRowVO {
  /* ---- 舆情侧 ---- */
  opinionId?: string | number;
  taskId?: string | number;
  taskName?: string;
  channelId?: string | number;
  channelName?: string;
  title?: string;
  /** 正文摘要（服务端已截断到 120 字，纯文本） */
  contentBrief?: string;
  opinionUrl?: string;
  publishTime?: string;
  author?: string;
  heatScore?: number;
  clusterId?: string | number;
  clusterTitle?: string;
  alertFlag?: string;

  /* ---- 流程侧 ---- */
  /** pending / processing / completed / failed */
  analyzeStatus?: string;
  analyzeTime?: string;

  /* ---- 结论侧 ---- */
  topic?: string;
  sentiAttr?: string;
  riskLevel?: string;
  opinionLevel?: string;
  spreadLevel?: string;
  confidence?: number;
  modelVersion?: string;
  promptVersion?: string;
  /** 该舆情第几次研判（人工修正会追加版本） */
  analyzeVersion?: number;
  /** 1 = 已被人工修正 */
  correctedFlag?: string;
  failReason?: string;
  /** 结论侧标签集合（model 与 manual 混合，仅用于列表展示） */
  tags?: string[];
}

/**
 * 研判台账分页结果（对应后端 AnalysisPage）
 *
 * 不复用 PageResult：响应里还带 statusCount（各状态条数，用来渲染
 * 「待研判 12 / 处理中 3」这类统计条）与 hints（无结果时的放宽建议）、
 * scopeDesc（当前可见范围说明）、scopeEmpty（是否因权限为空）。
 */
export interface AnalysisPageVO {
  rows?: AnalysisRowVO[];
  total?: number;
  /** key: pending / processing / completed / failed，value: 条数 */
  statusCount?: Record<string, number>;
  scopeDesc?: string;
  scopeEmpty?: boolean;
  hints?: string[];
}

/** 批量研判的失败明细（对应后端 AnalysisBatchResult.Failure） */
export interface AnalysisFailureVO {
  opinionId?: string | number;
  title?: string;
  reason?: string;
  attempt?: number;
  /** 是否还值得重试（超过上限或配置类错误时为 false） */
  retryable?: boolean;
}

/** 批量研判结果（对应后端 AnalysisBatchResult） */
export interface AnalysisBatchResultVO {
  batchNo?: string;
  /** manual / job */
  trigger?: string;
  total?: number;
  claimed?: number;
  processed?: number;
  succeeded?: number;
  failed?: number;
  skipped?: number;
  llmUsed?: number;
  ruleUsed?: number;
  clusterCreated?: number;
  clusterJoined?: number;
  tagged?: number;
  /** 是否因条数上限提前结束 */
  truncated?: boolean;
  /** 本批之后仍待处理的条数 */
  remaining?: number;
  scopeDesc?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  failures?: AnalysisFailureVO[];
}

/**
 * 事件聚合卡片（对应后端 ClusterCard）
 *
 * stageCount 的 key 是大写的 FIRST / SPREAD / PEAK / FALL，
 * 与 yq_spread_level 字典不是一回事（那是千/万/十万/viral 的量级），
 * 前端要用本地的 STAGE_LABELS 映射，不要走 useDict。
 */
export interface ClusterCardVO {
  clusterId?: string | number;
  clusterTitle?: string;
  clusterTopic?: string;
  /** 事件下全部舆情条数（不受当前用户数据范围限制） */
  opinionCount?: number;
  /** 当前用户可见的条数；小于 opinionCount 说明存在范围外内容 */
  visibleCount?: number;
  firstTime?: string;
  lastTime?: string;
  peakHeat?: number;
  riskLevel?: string;
  stageCount?: Record<string, number>;
  /** 「首发 1 / 扩散 3 / 峰值 1 / 回落 2」 */
  spreadSummary?: string;
  topOpinions?: AnalysisRowVO[];
}

/**
 * 研判详情（对应后端 AnalysisDetailView）
 *
 * opinion 直接复用 F-016 的 LedgerDetailVO —— 详情页的舆情原文、来源、
 * 热度、互动趋势、预警与推送记录都由那一份渲染，本模块只在其上叠加
 * 「研判视角」的字段。重复定义一遍会立刻产生两份需要同步维护的类型。
 */
export interface AnalysisDetailViewVO {
  opinion?: LedgerDetailVO;
  /** 隐性/变体表述命中说明（人类可读，非结构化） */
  variantHits?: string[];
  modelTagNames?: string[];
  manualTagNames?: string[];
  correctedByName?: string;
  /** llm / rule / manual；无法判定时为 null */
  conclusionSource?: string;
}

/**
 * 人工修正表单（对应后端 AnalysisCorrectBo）
 *
 * ⚠ tags 的语义是「覆盖」，且 null 与 [] 差别很大：
 *   null / undefined = 本次不改标签；[] = 清空全部人工标签。
 *   表单里用空数组表示「用户把标签全删了」，要改标签必须显式给数组。
 */
export interface AnalysisCorrectForm {
  opinionId?: string | number;
  sentiAttr?: string;
  riskLevel?: string;
  opinionLevel?: string;
  tags?: string[];
  remark?: string;
  /** 是否登记为待标注训练样本（默认登记） */
  createSample?: boolean;
}

/**
 * 研判中心查询参数（对应后端 AnalysisQuery）
 *
 * 与 GET /yuqing/analysis/list 的参数名一一对应；
 * 时间用 String 传，由服务端 LedgerTimeParser 容错解析（非法值忽略而非 400）。
 */
export interface AnalysisQueryParams {
  pageNum?: number;
  pageSize?: number;
  collectBeginTime?: string;
  collectEndTime?: string;
  taskId?: string | number;
  channelId?: string | number;
  clusterId?: string | number;
  sentiAttr?: string;
  riskLevel?: string;
  opinionLevel?: string;
  spreadLevel?: string;
  tagIds?: Array<string | number>;
  analyzeStatus?: string;
  /** 1 / 0 */
  correctedFlag?: string;
  alertFlag?: string;
  /** 只看失败项（后端会把它与 analyzeStatus=failed 合并判断） */
  onlyFailed?: boolean;
  keyword?: string;
  /** title（默认）/ content / both */
  keywordScope?: string;
  orderBy?: string;
  orderDesc?: boolean;
}

/** 模型版本（对应后端 modelVersions 返回的 Map 结构，键值均由服务端给定） */
export interface ModelVersionVO {
  modelVersionId?: string | number;
  versionName?: string;
  modelType?: string;
  provider?: string;
  sampleCount?: number;
  trainTime?: string;
  evalAccuracy?: number;
  isActive?: string;
  rollbackFrom?: string | number;
  remark?: string;
}
