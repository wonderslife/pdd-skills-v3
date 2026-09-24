import type { YqTaskKeywordForm, YqTaskKeywordQuery, YqTaskKeywordVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询任务关键词关联列表
 */
export const listYqTaskKeyword = (query?: YqTaskKeywordQuery): AxiosPromise<PageResult<YqTaskKeywordVO>> => {
  return request({
    url: '/yuqing/taskKeyword/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询任务关键词关联详细
 */
export const getYqTaskKeyword = (id: string | number): AxiosPromise<YqTaskKeywordVO> => {
  return request({
    url: '/yuqing/taskKeyword/' + id,
    method: 'get'
  });
};

/**
 * 新增任务关键词关联
 */
export const addYqTaskKeyword = (data: YqTaskKeywordForm): AxiosPromise => {
  return request({
    url: '/yuqing/taskKeyword',
    method: 'post',
    data
  });
};

/**
 * 修改任务关键词关联
 */
export const updateYqTaskKeyword = (data: YqTaskKeywordForm): AxiosPromise => {
  return request({
    url: '/yuqing/taskKeyword',
    method: 'put',
    data
  });
};

/**
 * 删除任务关键词关联
 */
export const delYqTaskKeyword = (id: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/taskKeyword/' + id,
    method: 'delete'
  });
};

/**
 * 任务关键词关联下拉选项
 */
export const optionselectYqTaskKeyword = (params?: any): AxiosPromise<YqTaskKeywordVO[]> => {
  return request({
    url: '/yuqing/taskKeyword/optionselect',
    method: 'get',
    params
  });
};
