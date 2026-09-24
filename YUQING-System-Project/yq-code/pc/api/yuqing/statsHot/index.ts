// ⚠ 热点排行位于 Apache Doris，业务侧只读；写入由采集/研判 Worker 经 Stream Load 完成。
import type { YqStatsHotForm, YqStatsHotQuery, YqStatsHotVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询热点排行列表
 */
export const listYqStatsHot = (query?: YqStatsHotQuery): AxiosPromise<PageResult<YqStatsHotVO>> => {
  return request({
    url: '/yuqing/statsHot/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询热点排行详细
 */
export const getYqStatsHot = (hotId: string | number): AxiosPromise<YqStatsHotVO> => {
  return request({
    url: '/yuqing/statsHot/' + hotId,
    method: 'get'
  });
};

/**
 * 热点排行下拉选项
 */
export const optionselectYqStatsHot = (params?: any): AxiosPromise<YqStatsHotVO[]> => {
  return request({
    url: '/yuqing/statsHot/optionselect',
    method: 'get',
    params
  });
};
