import type { YqModelVersionForm, YqModelVersionQuery, YqModelVersionVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询模型版本列表
 */
export const listYqModelVersion = (query?: YqModelVersionQuery): AxiosPromise<PageResult<YqModelVersionVO>> => {
  return request({
    url: '/yuqing/modelVersion/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询模型版本详细
 */
export const getYqModelVersion = (modelVersionId: string | number): AxiosPromise<YqModelVersionVO> => {
  return request({
    url: '/yuqing/modelVersion/' + modelVersionId,
    method: 'get'
  });
};

/**
 * 新增模型版本
 */
export const addYqModelVersion = (data: YqModelVersionForm): AxiosPromise => {
  return request({
    url: '/yuqing/modelVersion',
    method: 'post',
    data
  });
};

/**
 * 修改模型版本
 */
export const updateYqModelVersion = (data: YqModelVersionForm): AxiosPromise => {
  return request({
    url: '/yuqing/modelVersion',
    method: 'put',
    data
  });
};

/**
 * 删除模型版本
 */
export const delYqModelVersion = (modelVersionId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/modelVersion/' + modelVersionId,
    method: 'delete'
  });
};

/**
 * 模型版本下拉选项
 */
export const optionselectYqModelVersion = (params?: any): AxiosPromise<YqModelVersionVO[]> => {
  return request({
    url: '/yuqing/modelVersion/optionselect',
    method: 'get',
    params
  });
};
