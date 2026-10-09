import request from '@/utils/request';
import type { AxiosPromise } from '@/utils/api-types';
import type { PageResult } from '@/api/types';
import type {
  AnalysisBatchResultVO,
  AnalysisCorrectForm,
  AnalysisDetailViewVO,
  AnalysisPageVO,
  AnalysisQueryParams,
  ClusterCardVO,
  ModelVersionVO
} from './types';

/**
 * 研判台账分页（验收标准 5、7、8）
 *
 * 返回体不是标准 PageResult —— 还带 statusCount / hints / scopeDesc /
 * scopeEmpty。这些必须与本次查询条件一起回来，否则前端要再发一次请求
 * 去问「为什么是空的」，而且拿不到各状态条数就画不出统计条。
 */
export const pageAnalysis = (query?: AnalysisQueryParams): AxiosPromise<AnalysisPageVO> => {
  return request({
    url: '/yuqing/analysis/list',
    method: 'get',
    params: query
  });
};

/**
 * 单条研判详情（验收标准 7、8、11）
 *
 * 一次请求带回舆情原文 + 结论 + 变体命中 + 标签来源 + 修正留痕 + 历史版本，
 * 详情页不需要再补第二个请求。
 */
export const getAnalysisDetail = (opinionId: string | number): AxiosPromise<AnalysisDetailViewVO> => {
  return request({
    url: '/yuqing/analysis/' + opinionId,
    method: 'get'
  });
};

/** 事件聚合列表（验收标准 4、10） */
export const pageCluster = (query?: {
  keyword?: string;
  pageNum?: number;
  pageSize?: number;
}): AxiosPromise<PageResult<ClusterCardVO>> => {
  return request({
    url: '/yuqing/analysis/cluster/list',
    method: 'get',
    params: query
  });
};

/**
 * 批量研判（验收标准 1、6、10）
 *
 * data 可空 = 按当前筛选条件的待研判队列跑一批。
 * 注意：筛选条件里带 completed 会被服务端兜底成 pending，
 * 这是刻意的防误操作 —— 免得一次点击把历史数据全部重跑。
 *
 * @param limit 本批条数上限，空则用服务端配置 batch-size
 */
export const batchAnalyze = (data?: AnalysisQueryParams, limit?: number): AxiosPromise<AnalysisBatchResultVO> => {
  return request({
    url: '/yuqing/analysis/batch',
    method: 'post',
    params: { limit },
    data
  });
};

/** 单条重研判（验收标准 6、7）；force 默认 true，即人工点击就是要重算 */
export const analyzeOne = (opinionId: string | number, force?: boolean): AxiosPromise<AnalysisBatchResultVO> => {
  return request({
    url: '/yuqing/analysis/one/' + opinionId,
    method: 'post',
    params: { force: force === undefined ? true : force }
  });
};

/** 重试失败项（验收标准 6）：只跑未超过重试上限的失败记录 */
export const retryAnalysis = (data?: AnalysisQueryParams, limit?: number): AxiosPromise<AnalysisBatchResultVO> => {
  return request({
    url: '/yuqing/analysis/retry',
    method: 'post',
    params: { limit },
    data
  });
};

/**
 * 释放卡住的 processing。
 *
 * 存在的原因：主表没有认领时间列，服务端做不了按时间的自动回收，
 * 只能由研判员筛出卡住的行后手动释放。
 */
export const releaseProcessing = (opinionIds: Array<string | number>): AxiosPromise<number> => {
  return request({
    url: '/yuqing/analysis/release',
    method: 'post',
    data: opinionIds
  });
};

/** 人工修正结论（验收标准 8、9）：修正后自动登记待标注训练样本 */
export const correctAnalysis = (data: AnalysisCorrectForm): AxiosPromise<AnalysisDetailViewVO> => {
  return request({
    url: '/yuqing/analysis/correct',
    method: 'post',
    data
  });
};

/** 模型版本列表（验收标准 11） */
export const listModelVersion = (): AxiosPromise<ModelVersionVO[]> => {
  return request({
    url: '/yuqing/analysis/model/list',
    method: 'get'
  });
};

/** 模型版本回滚（验收标准 11）：回滚原因写入目标版本备注 */
export const rollbackModelVersion = (targetId: string | number, remark?: string): AxiosPromise<number> => {
  return request({
    url: '/yuqing/analysis/model/rollback',
    method: 'post',
    params: { targetId, remark }
  });
};
