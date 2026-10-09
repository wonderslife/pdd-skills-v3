/**
 * 聚合批次 查询
 */
export interface YqStatsBatchQuery extends PageQuery {
  /** 批次号 */
  batchNo?: string;
  /** 聚合起始统计日 */
  beginDate?: string;
  /** 聚合截止统计日 */
  endDate?: string;
  /** 触发方式 */
  triggerType?: string;
  /** 执行状态 */
  status?: string;
  /** 读取明细条数 */
  sourceCount?: number;
  /** 写入 daily 行数 */
  dailyRows?: number;
  /** 写入 dim 行数 */
  dimRows?: number;
  /** 写入 hot 行数 */
  hotRows?: number;
  /** 耗时（毫秒） */
  costMs?: string;
  /** 数据截止时间（本次覆盖到的最新发布时间） */
  dataUntil?: string;
  /** 非致命提示（如命中读取上限被截断） */
  notice?: string;
  /** 结构化分析结论（JSON） */
  conclusionJson?: string;
  /** 失败原因 */
  failReason?: string;
}

/**
 * 聚合批次 表单
 */
export interface YqStatsBatchForm {
  /** 主键 */
  batchId?: string;
  /** 批次号 */
  batchNo?: string;
  /** 聚合起始统计日 */
  beginDate?: string;
  /** 聚合截止统计日 */
  endDate?: string;
  /** 触发方式 */
  triggerType?: string;
  /** 执行状态 */
  status?: string;
  /** 读取明细条数 */
  sourceCount?: number;
  /** 写入 daily 行数 */
  dailyRows?: number;
  /** 写入 dim 行数 */
  dimRows?: number;
  /** 写入 hot 行数 */
  hotRows?: number;
  /** 耗时（毫秒） */
  costMs?: string;
  /** 数据截止时间（本次覆盖到的最新发布时间） */
  dataUntil?: string;
  /** 非致命提示（如命中读取上限被截断） */
  notice?: string;
  /** 结构化分析结论（JSON） */
  conclusionJson?: string;
  /** 失败原因 */
  failReason?: string;

}

/**
 * 聚合批次 视图
 */
export interface YqStatsBatchVO {
  /** 主键 */
  batchId?: string;
  /** 批次号 */
  batchNo?: string;
  /** 聚合起始统计日 */
  beginDate?: string;
  /** 聚合截止统计日 */
  endDate?: string;
  /** 触发方式 */
  triggerType?: string;
  /** 执行状态 */
  status?: string;
  /** 读取明细条数 */
  sourceCount?: number;
  /** 写入 daily 行数 */
  dailyRows?: number;
  /** 写入 dim 行数 */
  dimRows?: number;
  /** 写入 hot 行数 */
  hotRows?: number;
  /** 耗时（毫秒） */
  costMs?: string;
  /** 数据截止时间（本次覆盖到的最新发布时间） */
  dataUntil?: string;
  /** 非致命提示（如命中读取上限被截断） */
  notice?: string;
  /** 结构化分析结论（JSON） */
  conclusionJson?: string;
  /** 失败原因 */
  failReason?: string;
  /** 创建时间 */
  createTime?: string;

}
