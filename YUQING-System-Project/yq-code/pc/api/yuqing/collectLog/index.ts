// ⚠ 采集日志位于 Apache Doris，业务侧只读；写入由采集/研判 Worker 经 Stream Load 完成。
import type { YqCollectLogForm, YqCollectLogQuery, YqCollectLogVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询采集日志列表
 */
export const listYqCollectLog = (query?: YqCollectLogQuery): AxiosPromise<PageResult<YqCollectLogVO>> => {
  return request({
    url: '/yuqing/collectLog/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询采集日志详细
 */
export const getYqCollectLog = (logId: string | number): AxiosPromise<YqCollectLogVO> => {
  return request({
    url: '/yuqing/collectLog/' + logId,
    method: 'get'
  });
};

/**
 * 采集日志下拉选项
 */
export const optionselectYqCollectLog = (params?: any): AxiosPromise<YqCollectLogVO[]> => {
  return request({
    url: '/yuqing/collectLog/optionselect',
    method: 'get',
    params
  });
};
