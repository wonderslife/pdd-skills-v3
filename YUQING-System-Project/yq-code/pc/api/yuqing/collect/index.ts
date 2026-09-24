// ⚠ F-004 采集调度本身无对外 REST 接口（见 dev-specs/F-004-collect.md）；
// 这里封装的是运维必需的 3 个能力（概览 / 单元预览 / 手动触发），
// 权限复用 F-018 运行监控的 yuqing:monitor:list 与 yuqing:monitor:run。
import type { CollectOverview, CollectUnit, CollectResult, DispatchSummary } from './types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 采集运行概览（累计/当日采集、去重、失败、各任务最近执行状态）
 */
export const getCollectOverview = (): AxiosPromise<CollectOverview> => {
  return request({
    url: '/yuqing/collect/overview',
    method: 'get'
  });
};

/**
 * 预览可下发的采集单元（含跳过原因，便于排查「为什么不采」）
 */
export const listCollectUnits = (taskId?: string | number): AxiosPromise<CollectUnit[]> => {
  return request({
    url: '/yuqing/collect/units',
    method: 'get',
    params: { taskId }
  });
};

/**
 * 手动触发采集调度（taskId 为空则调度全部启用任务）
 */
export const dispatchCollect = (taskId?: string | number): AxiosPromise<DispatchSummary> => {
  return request({
    url: '/yuqing/collect/dispatch',
    method: 'post',
    params: { taskId }
  });
};

/**
 * 立即采集指定任务 × 渠道
 */
export const collectOnce = (taskId: string | number, channelId: string | number): AxiosPromise<CollectResult> => {
  return request({
    url: '/yuqing/collect/dispatch/' + taskId + '/' + channelId,
    method: 'post'
  });
};

/**
 * 采集频率校验：返回不满足渠道限流下限的配置项
 */
export const checkCollectSchedule = (taskId: string | number): AxiosPromise<string[]> => {
  return request({
    url: '/yuqing/collect/schedule-check/' + taskId,
    method: 'get'
  });
};
