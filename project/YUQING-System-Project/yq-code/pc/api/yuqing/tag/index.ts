import type { YqTagForm, YqTagQuery, YqTagVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询标签列表
 */
export const listYqTag = (query?: YqTagQuery): AxiosPromise<PageResult<YqTagVO>> => {
  return request({
    url: '/yuqing/tag/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询标签详细
 */
export const getYqTag = (tagId: string | number): AxiosPromise<YqTagVO> => {
  return request({
    url: '/yuqing/tag/' + tagId,
    method: 'get'
  });
};

/**
 * 新增标签
 */
export const addYqTag = (data: YqTagForm): AxiosPromise => {
  return request({
    url: '/yuqing/tag',
    method: 'post',
    data
  });
};

/**
 * 修改标签
 */
export const updateYqTag = (data: YqTagForm): AxiosPromise => {
  return request({
    url: '/yuqing/tag',
    method: 'put',
    data
  });
};

/**
 * 删除标签
 */
export const delYqTag = (tagId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/tag/' + tagId,
    method: 'delete'
  });
};

/**
 * 标签下拉选项
 */
export const optionselectYqTag = (params?: any): AxiosPromise<YqTagVO[]> => {
  return request({
    url: '/yuqing/tag/optionselect',
    method: 'get',
    params
  });
};
