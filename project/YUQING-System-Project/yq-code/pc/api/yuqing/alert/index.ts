import type { YqAlertForm, YqAlertQuery, YqAlertVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询预警记录列表
 */
export const listYqAlert = (query?: YqAlertQuery): AxiosPromise<PageResult<YqAlertVO>> => {
  return request({
    url: '/yuqing/alert/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询预警记录详细
 */
export const getYqAlert = (alertId: string | number): AxiosPromise<YqAlertVO> => {
  return request({
    url: '/yuqing/alert/' + alertId,
    method: 'get'
  });
};

/**
 * 新增预警记录
 */
export const addYqAlert = (data: YqAlertForm): AxiosPromise => {
  return request({
    url: '/yuqing/alert',
    method: 'post',
    data
  });
};

/**
 * 修改预警记录
 */
export const updateYqAlert = (data: YqAlertForm): AxiosPromise => {
  return request({
    url: '/yuqing/alert',
    method: 'put',
    data
  });
};

/**
 * 删除预警记录
 */
export const delYqAlert = (alertId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/alert/' + alertId,
    method: 'delete'
  });
};

/**
 * 预警记录下拉选项
 */
export const optionselectYqAlert = (params?: any): AxiosPromise<YqAlertVO[]> => {
  return request({
    url: '/yuqing/alert/optionselect',
    method: 'get',
    params
  });
};
