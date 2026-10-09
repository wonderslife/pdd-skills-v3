// ⚠ 统计预聚合位于 Apache Doris，业务侧只读；写入由采集/研判 Worker 经 Stream Load 完成。
import type { YqStatsDailyForm, YqStatsDailyQuery, YqStatsDailyVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询统计预聚合列表
 */
export const listYqStatsDaily = (query?: YqStatsDailyQuery): AxiosPromise<PageResult<YqStatsDailyVO>> => {
  return request({
    url: '/yuqing/statsDaily/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询统计预聚合详细
 */
export const getYqStatsDaily = (statsId: string | number): AxiosPromise<YqStatsDailyVO> => {
  return request({
    url: '/yuqing/statsDaily/' + statsId,
    method: 'get'
  });
};

/**
 * 统计预聚合下拉选项
 */
export const optionselectYqStatsDaily = (params?: any): AxiosPromise<YqStatsDailyVO[]> => {
  return request({
    url: '/yuqing/statsDaily/optionselect',
    method: 'get',
    params
  });
};
