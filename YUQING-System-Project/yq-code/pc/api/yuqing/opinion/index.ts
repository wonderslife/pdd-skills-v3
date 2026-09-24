// ⚠ 舆情明细位于 Apache Doris，业务侧只读；写入由采集/研判 Worker 经 Stream Load 完成。
import type { YqOpinionForm, YqOpinionQuery, YqOpinionVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询舆情明细列表
 */
export const listYqOpinion = (query?: YqOpinionQuery): AxiosPromise<PageResult<YqOpinionVO>> => {
  return request({
    url: '/yuqing/opinion/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询舆情明细详细
 */
export const getYqOpinion = (opinionId: string | number): AxiosPromise<YqOpinionVO> => {
  return request({
    url: '/yuqing/opinion/' + opinionId,
    method: 'get'
  });
};

/**
 * 舆情明细下拉选项
 */
export const optionselectYqOpinion = (params?: any): AxiosPromise<YqOpinionVO[]> => {
  return request({
    url: '/yuqing/opinion/optionselect',
    method: 'get',
    params
  });
};
