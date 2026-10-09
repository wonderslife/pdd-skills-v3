import request from '@/utils/request';
import type { AxiosPromise } from '@/utils/api-types';
import type { PageResult } from '@/api/types';
import type {
  ClusterViewVO,
  LedgerDetailVO,
  LedgerExportForm,
  LedgerExportLogVO,
  LedgerExportResultVO,
  LedgerPageVO,
  LedgerQueryParams,
  LedgerSearchResultVO
} from './types';

/**
 * 台账组合筛选分页（验收标准 1、2、8、9）
 *
 * 返回体不是标准 PageResult —— 响应里还带 hints（无结果时的放宽建议）、
 * scopeDesc（当前可见范围说明）、scopeEmpty（是否因权限为空），
 * 这些必须与本次查询条件一起回来，否则前端要再发一次请求去问「为什么是空的」。
 */
export const pageLedger = (query?: LedgerQueryParams): AxiosPromise<LedgerPageVO> => {
  return request({
    url: '/yuqing/opinion/list',
    method: 'get',
    params: query
  });
};

/** 舆情详情（验收标准 3） */
export const getLedgerDetail = (opinionId: string | number): AxiosPromise<LedgerDetailVO> => {
  return request({
    url: '/yuqing/opinion/' + opinionId,
    method: 'get'
  });
};

/**
 * 全文检索（验收标准 7）
 *
 * scope: title / content / both；limit 缺省由服务端配置决定。
 */
export const searchLedger = (keyword: string, scope?: string, limit?: number): AxiosPromise<LedgerSearchResultVO> => {
  return request({
    url: '/yuqing/opinion/search',
    method: 'get',
    params: { keyword, scope, limit }
  });
};

/**
 * 导出（验收标准 5、6）
 *
 * 返回体 mode = sync 时直接打开 fileUrl；mode = async 时拿 exportId
 * 轮询 getLedgerExportStatus，完成后同样从 fileUrl 下载。
 */
export const exportLedger = (data: LedgerExportForm): AxiosPromise<LedgerExportResultVO> => {
  return request({
    url: '/yuqing/opinion/export',
    method: 'post',
    data
  });
};

/** 异步导出任务状态（验收标准 6） */
export const getLedgerExportStatus = (exportId: string | number): AxiosPromise<LedgerExportResultVO> => {
  return request({
    url: '/yuqing/opinion/export/' + exportId,
    method: 'get'
  });
};

/** 导出审计记录（验收标准 10） */
export const pageLedgerExportLog = (query?: {
  pageNum?: number;
  pageSize?: number;
  exportScope?: string;
}): AxiosPromise<PageResult<LedgerExportLogVO>> => {
  return request({
    url: '/yuqing/opinion/exportLog/list',
    method: 'get',
    params: query
  });
};

/** 事件聚合视图：事件概要 + 传播时间轴 + 关联舆情（验收标准 4） */
export const getLedgerCluster = (
  clusterId: string | number,
  params?: { nodeLimit?: number; pageNum?: number; pageSize?: number }
): AxiosPromise<ClusterViewVO> => {
  return request({
    url: '/yuqing/cluster/' + clusterId,
    method: 'get',
    params
  });
};

/** 平台字典取值：采集来源等由 dict 提供，这里只在需要时统一导出 */
export const LEDGER_EXPORTABLE_HINT =
  '列顺序由服务端目录固定；未勾选时不传 columns，等同于导出全部可导出字段。';
