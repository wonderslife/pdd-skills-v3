import type { YqKeywordForm, YqKeywordQuery, YqKeywordVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询关键词列表
 */
export const listYqKeyword = (query?: YqKeywordQuery): AxiosPromise<PageResult<YqKeywordVO>> => {
  return request({
    url: '/yuqing/keyword/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询关键词详细
 */
export const getYqKeyword = (keywordId: string | number): AxiosPromise<YqKeywordVO> => {
  return request({
    url: '/yuqing/keyword/' + keywordId,
    method: 'get'
  });
};

/**
 * 新增关键词
 */
export const addYqKeyword = (data: YqKeywordForm): AxiosPromise => {
  return request({
    url: '/yuqing/keyword',
    method: 'post',
    data
  });
};

/**
 * 修改关键词
 */
export const updateYqKeyword = (data: YqKeywordForm): AxiosPromise => {
  return request({
    url: '/yuqing/keyword',
    method: 'put',
    data
  });
};

/**
 * 删除关键词
 */
export const delYqKeyword = (keywordId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/keyword/' + keywordId,
    method: 'delete'
  });
};

/**
 * 关键词下拉选项
 */
export const optionselectYqKeyword = (params?: any): AxiosPromise<YqKeywordVO[]> => {
  return request({
    url: '/yuqing/keyword/optionselect',
    method: 'get',
    params
  });
};
