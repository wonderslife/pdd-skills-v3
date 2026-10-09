import type { InspectAreaForm, InspectAreaQuery, InspectAreaVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询区域列表
 */
export const listInspectArea = (query?: InspectAreaQuery): AxiosPromise<PageResult<InspectAreaVO>> => {
  return request({
    url: '/inspect/area/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询区域详细
 */
export const getInspectArea = (areaId: string | number): AxiosPromise<InspectAreaVO> => {
  return request({
    url: '/inspect/area/' + areaId,
    method: 'get'
  });
};

/**
 * 新增区域
 */
export const addInspectArea = (data: InspectAreaForm): AxiosPromise => {
  return request({
    url: '/inspect/area',
    method: 'post',
    data
  });
};

/**
 * 修改区域
 */
export const updateInspectArea = (data: InspectAreaForm): AxiosPromise => {
  return request({
    url: '/inspect/area',
    method: 'put',
    data
  });
};

/**
 * 删除区域
 */
export const delInspectArea = (areaId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/inspect/area/' + areaId,
    method: 'delete'
  });
};

/**
 * 区域下拉选项
 */
export const optionselectInspectArea = (params?: any): AxiosPromise<InspectAreaVO[]> => {
  return request({
    url: '/inspect/area/optionselect',
    method: 'get',
    params
  });
};
