import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 净化重跑范围（F-006 验收标准 9）
 */
export interface CleanBatchScope {
  /** 批次名称；为空时服务端自动生成 */
  batchName?: string;
  /** 重跑类型：incremental / condition_replay / full_replay */
  batchType?: string;
  /** 范围-任务ID；为空表示不限任务 */
  scopeTaskId?: number | string | null;
  /** 范围-渠道ID；为空表示不限渠道 */
  scopeChannelId?: number | string | null;
  /** 范围-起始采集日（YYYY-MM-DD） */
  scopeStartDate?: string;
  /** 范围-截止采集日（YYYY-MM-DD） */
  scopeEndDate?: string;
  /** true = 只预览不落库 */
  previewOnly?: boolean;
}

/**
 * 一次净化批次的统计结果
 */
export interface CleanBatchStats {
  /** 批次ID（执行模式才有值） */
  batchId?: number | string | null;
  batchName?: string;
  /** 扫描条数 */
  totalCount: number;
  /** 净化保留条数 */
  cleanedCount: number;
  /** 降噪剔除条数 */
  rejectedCount: number;
  /** 链接去重条数 */
  dupCount: number;
  /** 跨渠道重复条数 */
  dupChannelCount: number;
  /** 按七类降噪类别的剔除量 */
  byCategory: Record<string, number>;
  /** 是否只预览未落库 */
  previewOnly: boolean;
  /** 耗时（毫秒） */
  costMs: number;
  /** 失败原因 */
  failReason?: string;
}

/**
 * 预览影响条数（不落库）
 */
export const previewCleanReplay = (data: CleanBatchScope): AxiosPromise<CleanBatchStats> => {
  return request({
    url: '/yuqing/clean/preview',
    method: 'post',
    data
  });
};

/**
 * 执行重跑（落库并留批次记录）
 */
export const executeCleanReplay = (data: CleanBatchScope): AxiosPromise<CleanBatchStats> => {
  return request({
    url: '/yuqing/clean/execute',
    method: 'post',
    data
  });
};

/**
 * 强制刷新降噪规则缓存（后台改完规则点一下，不等缓存过期）
 */
export const refreshNoiseRules = (): AxiosPromise<void> => {
  return request({
    url: '/yuqing/clean/rules/refresh',
    method: 'post'
  });
};

/**
 * 规则试跑：用样本文本验证新规则会不会误杀
 */
export const tryNoiseRules = (title: string, content: string): AxiosPromise<boolean> => {
  return request({
    url: '/yuqing/clean/rules/try',
    method: 'post',
    params: { title, content }
  });
};
