import type { StatsPointRankVO, StatsQuery, StatsTrendVO } from './types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 时间趋势（按日/周/月）
 */
export const getStatsTrend = (query?: StatsQuery): AxiosPromise<StatsTrendVO[]> => {
  return request({
    url: '/inspect/stats/trend',
    method: 'get',
    params: query
  });
};

/**
 * 点位维度排名
 */
export const getStatsPointRank = (query?: StatsQuery): AxiosPromise<StatsPointRankVO[]> => {
  return request({
    url: '/inspect/stats/pointRank',
    method: 'get',
    params: query
  });
};

/**
 * 未处理异常数（首页弹窗用）
 */
export const getAbnormalCount = (roomId?: string | number): AxiosPromise<number> => {
  return request({
    url: '/inspect/stats/abnormalCount',
    method: 'get',
    params: { roomId }
  });
};
