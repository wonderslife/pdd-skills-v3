import type { YqCleanBatchForm, YqCleanBatchQuery, YqCleanBatchVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询净化批次列表
 */
export const listYqCleanBatch = (query?: YqCleanBatchQuery): AxiosPromise<PageResult<YqCleanBatchVO>> => {
  return request({
    url: '/yuqing/cleanBatch/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询净化批次详细
 */
export const getYqCleanBatch = (batchId: string | number): AxiosPromise<YqCleanBatchVO> => {
  return request({
    url: '/yuqing/cleanBatch/' + batchId,
    method: 'get'
  });
};

/**
 * 新增净化批次
 */
export const addYqCleanBatch = (data: YqCleanBatchForm): AxiosPromise => {
  return request({
    url: '/yuqing/cleanBatch',
    method: 'post',
    data
  });
};

/**
 * 修改净化批次
 */
export const updateYqCleanBatch = (data: YqCleanBatchForm): AxiosPromise => {
  return request({
    url: '/yuqing/cleanBatch',
    method: 'put',
    data
  });
};

/**
 * 删除净化批次
 */
export const delYqCleanBatch = (batchId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/cleanBatch/' + batchId,
    method: 'delete'
  });
};

/**
 * 净化批次下拉选项
 */
export const optionselectYqCleanBatch = (params?: any): AxiosPromise<YqCleanBatchVO[]> => {
  return request({
    url: '/yuqing/cleanBatch/optionselect',
    method: 'get',
    params
  });
};
