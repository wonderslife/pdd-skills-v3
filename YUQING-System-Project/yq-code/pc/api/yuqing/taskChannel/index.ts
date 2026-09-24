import type { YqTaskChannelForm, YqTaskChannelQuery, YqTaskChannelVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询任务渠道关联列表
 */
export const listYqTaskChannel = (query?: YqTaskChannelQuery): AxiosPromise<PageResult<YqTaskChannelVO>> => {
  return request({
    url: '/yuqing/taskChannel/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询任务渠道关联详细
 */
export const getYqTaskChannel = (id: string | number): AxiosPromise<YqTaskChannelVO> => {
  return request({
    url: '/yuqing/taskChannel/' + id,
    method: 'get'
  });
};

/**
 * 新增任务渠道关联
 */
export const addYqTaskChannel = (data: YqTaskChannelForm): AxiosPromise => {
  return request({
    url: '/yuqing/taskChannel',
    method: 'post',
    data
  });
};

/**
 * 修改任务渠道关联
 */
export const updateYqTaskChannel = (data: YqTaskChannelForm): AxiosPromise => {
  return request({
    url: '/yuqing/taskChannel',
    method: 'put',
    data
  });
};

/**
 * 删除任务渠道关联
 */
export const delYqTaskChannel = (id: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/taskChannel/' + id,
    method: 'delete'
  });
};

/**
 * 任务渠道关联下拉选项
 */
export const optionselectYqTaskChannel = (params?: any): AxiosPromise<YqTaskChannelVO[]> => {
  return request({
    url: '/yuqing/taskChannel/optionselect',
    method: 'get',
    params
  });
};
