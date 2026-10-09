import type {
  AggregateRequest,
  AggregateSummary,
  AnalyticsQuery,
  DashboardView,
  DrilldownParams,
  DrilldownResult,
  ReportSection,
  StatsBatchVO
} from './types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 看板数据（F-009 验收标准 1 / 2 / 3 / 4）
 */
export const getDashboard = (query?: AnalyticsQuery): AxiosPromise<DashboardView> => {
  return request({
    url: '/yuqing/analytics/dashboard',
    method: 'get',
    params: query
  });
};

/**
 * 下钻明细（F-009 验收标准 6）
 */
export const getDrilldown = (params: DrilldownParams): AxiosPromise<DrilldownResult> => {
  return request({
    url: '/yuqing/analytics/drilldown',
    method: 'get',
    params
  });
};

/**
 * 报告章节交接包（F-009 验收标准 7）
 */
export const getReportSection = (query?: AnalyticsQuery): AxiosPromise<ReportSection> => {
  return request({
    url: '/yuqing/analytics/handoff',
    method: 'get',
    params: query
  });
};

/**
 * 手动重算 / 补算历史（F-009 验收标准 8 / 9）
 */
export const aggregateStats = (data: AggregateRequest): AxiosPromise<AggregateSummary> => {
  return request({
    url: '/yuqing/analytics/aggregate',
    method: 'post',
    data
  });
};

/**
 * 聚合批次台账
 */
export const listBatches = (limit?: number): AxiosPromise<StatsBatchVO[]> => {
  return request({
    url: '/yuqing/analytics/batches',
    method: 'get',
    params: { limit: limit }
  });
};
