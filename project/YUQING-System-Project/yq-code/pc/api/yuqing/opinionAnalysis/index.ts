// ⚠ 研判结果位于 Apache Doris，业务侧只读；写入由采集/研判 Worker 经 Stream Load 完成。
import type { YqOpinionAnalysisForm, YqOpinionAnalysisQuery, YqOpinionAnalysisVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询研判结果列表
 */
export const listYqOpinionAnalysis = (query?: YqOpinionAnalysisQuery): AxiosPromise<PageResult<YqOpinionAnalysisVO>> => {
  return request({
    url: '/yuqing/opinionAnalysis/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询研判结果详细
 */
export const getYqOpinionAnalysis = (analysisId: string | number): AxiosPromise<YqOpinionAnalysisVO> => {
  return request({
    url: '/yuqing/opinionAnalysis/' + analysisId,
    method: 'get'
  });
};

/**
 * 研判结果下拉选项
 */
export const optionselectYqOpinionAnalysis = (params?: any): AxiosPromise<YqOpinionAnalysisVO[]> => {
  return request({
    url: '/yuqing/opinionAnalysis/optionselect',
    method: 'get',
    params
  });
};
