// ⚠ 舆情标签关联位于 Apache Doris，业务侧只读；写入由采集/研判 Worker 经 Stream Load 完成。
import type { YqOpinionTagForm, YqOpinionTagQuery, YqOpinionTagVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询舆情标签关联列表
 */
export const listYqOpinionTag = (query?: YqOpinionTagQuery): AxiosPromise<PageResult<YqOpinionTagVO>> => {
  return request({
    url: '/yuqing/opinionTag/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询舆情标签关联详细
 */
export const getYqOpinionTag = (id: string | number): AxiosPromise<YqOpinionTagVO> => {
  return request({
    url: '/yuqing/opinionTag/' + id,
    method: 'get'
  });
};

/**
 * 舆情标签关联下拉选项
 */
export const optionselectYqOpinionTag = (params?: any): AxiosPromise<YqOpinionTagVO[]> => {
  return request({
    url: '/yuqing/opinionTag/optionselect',
    method: 'get',
    params
  });
};
