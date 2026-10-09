// ⚠ 维度分布位于 Apache Doris，业务侧只读；写入由采集/研判 Worker 经 Stream Load 完成。
import type { YqStatsDimForm, YqStatsDimQuery, YqStatsDimVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询维度分布列表
 */
export const listYqStatsDim = (query?: YqStatsDimQuery): AxiosPromise<PageResult<YqStatsDimVO>> => {
  return request({
    url: '/yuqing/statsDim/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询维度分布详细
 */
export const getYqStatsDim = (dimId: string | number): AxiosPromise<YqStatsDimVO> => {
  return request({
    url: '/yuqing/statsDim/' + dimId,
    method: 'get'
  });
};

/**
 * 维度分布下拉选项
 */
export const optionselectYqStatsDim = (params?: any): AxiosPromise<YqStatsDimVO[]> => {
  return request({
    url: '/yuqing/statsDim/optionselect',
    method: 'get',
    params
  });
};
