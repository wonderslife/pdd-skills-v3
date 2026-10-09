import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 推送执行统计
 */
export interface PushStats {
  attempted?: number;
  sent?: number;
  failed?: number;
  deferred?: number;
  skipped?: number;
  recordIds?: Array<string | number>;
  details?: string[];
}

/**
 * 重发一条失败记录
 */
export const retryPush = (recordId: string | number): AxiosPromise<PushStats> => {
  return request({
    url: '/yuqing/push/retry/' + recordId,
    method: 'post'
  });
};

/**
 * 刷出免打扰顺延的定时批量
 */
export const flushPush = (): AxiosPromise<number> => {
  return request({
    url: '/yuqing/push/flush',
    method: 'post'
  });
};

/**
 * 推送量与成功率统计
 */
export const pushStatistics = (params?: { beginDate?: string; endDate?: string }): AxiosPromise<Record<string, any>> => {
  return request({
    url: '/yuqing/push/statistics',
    method: 'get',
    params
  });
};
