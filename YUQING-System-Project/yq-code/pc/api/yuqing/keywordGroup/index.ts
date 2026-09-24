import type { YqKeywordGroupForm, YqKeywordGroupQuery, YqKeywordGroupVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询关键词分组列表
 */
export const listYqKeywordGroup = (query?: YqKeywordGroupQuery): AxiosPromise<PageResult<YqKeywordGroupVO>> => {
  return request({
    url: '/yuqing/keywordGroup/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询关键词分组详细
 */
export const getYqKeywordGroup = (groupId: string | number): AxiosPromise<YqKeywordGroupVO> => {
  return request({
    url: '/yuqing/keywordGroup/' + groupId,
    method: 'get'
  });
};

/**
 * 新增关键词分组
 */
export const addYqKeywordGroup = (data: YqKeywordGroupForm): AxiosPromise => {
  return request({
    url: '/yuqing/keywordGroup',
    method: 'post',
    data
  });
};

/**
 * 修改关键词分组
 */
export const updateYqKeywordGroup = (data: YqKeywordGroupForm): AxiosPromise => {
  return request({
    url: '/yuqing/keywordGroup',
    method: 'put',
    data
  });
};

/**
 * 删除关键词分组
 */
export const delYqKeywordGroup = (groupId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/keywordGroup/' + groupId,
    method: 'delete'
  });
};

/**
 * 关键词分组下拉选项
 */
export const optionselectYqKeywordGroup = (params?: any): AxiosPromise<YqKeywordGroupVO[]> => {
  return request({
    url: '/yuqing/keywordGroup/optionselect',
    method: 'get',
    params
  });
};
