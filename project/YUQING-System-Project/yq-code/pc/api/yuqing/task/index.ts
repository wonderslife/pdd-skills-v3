import type { YqTaskForm, YqTaskQuery, YqTaskVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询监测任务列表
 */
export const listYqTask = (query?: YqTaskQuery): AxiosPromise<PageResult<YqTaskVO>> => {
  return request({
    url: '/yuqing/task/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询监测任务详细
 */
export const getYqTask = (taskId: string | number): AxiosPromise<YqTaskVO> => {
  return request({
    url: '/yuqing/task/' + taskId,
    method: 'get'
  });
};

/**
 * 新增监测任务
 */
export const addYqTask = (data: YqTaskForm): AxiosPromise => {
  return request({
    url: '/yuqing/task',
    method: 'post',
    data
  });
};

/**
 * 修改监测任务
 */
export const updateYqTask = (data: YqTaskForm): AxiosPromise => {
  return request({
    url: '/yuqing/task',
    method: 'put',
    data
  });
};

/**
 * 删除监测任务
 */
export const delYqTask = (taskId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/task/' + taskId,
    method: 'delete'
  });
};

/**
 * 监测任务下拉选项
 */
export const optionselectYqTask = (params?: any): AxiosPromise<YqTaskVO[]> => {
  return request({
    url: '/yuqing/task/optionselect',
    method: 'get',
    params
  });
};
