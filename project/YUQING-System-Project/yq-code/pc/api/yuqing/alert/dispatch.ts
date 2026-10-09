import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 预警扫描请求
 */
export interface AlertScanRequest {
  taskId?: string | number;
  windowMinutes?: number;
  dryRun?: boolean;
  pushAfterCreate?: boolean;
}

/**
 * 预警扫描结果
 */
export interface AlertScanStats {
  windowMinutes?: number;
  dryRun?: boolean;
  ruleCount?: number;
  scanned?: number;
  suppressed?: number;
  decisionCount?: number;
  created?: number;
  alertIds?: Array<string | number>;
  message?: string;
  details?: string[];
}

/**
 * 预警处置提交
 */
export interface AlertProcessForm {
  alertId: string | number;
  status: string;
  processRemark?: string;
}

/**
 * 手动触发预警扫描（落库）
 */
export const scanAlert = (data?: AlertScanRequest): AxiosPromise<AlertScanStats> => {
  return request({
    url: '/yuqing/alert/scan',
    method: 'post',
    data: data || {}
  });
};

/**
 * 预览预警命中（不落库）
 */
export const previewAlert = (data?: AlertScanRequest): AxiosPromise<AlertScanStats> => {
  return request({
    url: '/yuqing/alert/preview',
    method: 'post',
    data: data || {}
  });
};

/**
 * 处置预警（已处置/已忽略必须填说明，服务端会强校验）
 */
export const processAlert = (data: AlertProcessForm): AxiosPromise => {
  return request({
    url: '/yuqing/alert/process',
    method: 'post',
    data
  });
};

/**
 * 未处置计数（列表红标与台账提示用）
 */
export const alertPendingCount = (): AxiosPromise<Record<string, any>> => {
  return request({
    url: '/yuqing/alert/pendingCount',
    method: 'get'
  });
};

/**
 * 按时间与级别统计
 */
export const alertStatistics = (params?: { beginDate?: string; endDate?: string }): AxiosPromise<Record<string, any>> => {
  return request({
    url: '/yuqing/alert/statistics',
    method: 'get',
    params
  });
};

/**
 * 手动把指定预警推送到企业微信
 */
export const pushAlerts = (alertIds: Array<string | number>): AxiosPromise<Record<string, any>> => {
  return request({
    url: '/yuqing/alert/push',
    method: 'post',
    data: alertIds
  });
};
