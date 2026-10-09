// ⚠ 互动数据快照位于 Apache Doris，业务侧只读；写入由采集/研判 Worker 经 Stream Load 完成。
import type { YqOpinionMetricForm, YqOpinionMetricQuery, YqOpinionMetricVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询互动数据快照列表
 */
export const listYqOpinionMetric = (query?: YqOpinionMetricQuery): AxiosPromise<PageResult<YqOpinionMetricVO>> => {
  return request({
    url: '/yuqing/opinionMetric/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询互动数据快照详细
 */
export const getYqOpinionMetric = (metricId: string | number): AxiosPromise<YqOpinionMetricVO> => {
  return request({
    url: '/yuqing/opinionMetric/' + metricId,
    method: 'get'
  });
};

/**
 * 互动数据快照下拉选项
 */
export const optionselectYqOpinionMetric = (params?: any): AxiosPromise<YqOpinionMetricVO[]> => {
  return request({
    url: '/yuqing/opinionMetric/optionselect',
    method: 'get',
    params
  });
};
