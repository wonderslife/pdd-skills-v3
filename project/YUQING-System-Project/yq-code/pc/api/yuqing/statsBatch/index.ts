import type { YqStatsBatchForm, YqStatsBatchQuery, YqStatsBatchVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询聚合批次列表
 */
export const listYqStatsBatch = (query?: YqStatsBatchQuery): AxiosPromise<PageResult<YqStatsBatchVO>> => {
  return request({
    url: '/yuqing/statsBatch/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询聚合批次详细
 */
export const getYqStatsBatch = (batchId: string | number): AxiosPromise<YqStatsBatchVO> => {
  return request({
    url: '/yuqing/statsBatch/' + batchId,
    method: 'get'
  });
};

/**
 * 新增聚合批次
 */
export const addYqStatsBatch = (data: YqStatsBatchForm): AxiosPromise => {
  return request({
    url: '/yuqing/statsBatch',
    method: 'post',
    data
  });
};

/**
 * 修改聚合批次
 */
export const updateYqStatsBatch = (data: YqStatsBatchForm): AxiosPromise => {
  return request({
    url: '/yuqing/statsBatch',
    method: 'put',
    data
  });
};

/**
 * 删除聚合批次
 */
export const delYqStatsBatch = (batchId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/statsBatch/' + batchId,
    method: 'delete'
  });
};

/**
 * 聚合批次下拉选项
 */
export const optionselectYqStatsBatch = (params?: any): AxiosPromise<YqStatsBatchVO[]> => {
  return request({
    url: '/yuqing/statsBatch/optionselect',
    method: 'get',
    params
  });
};
