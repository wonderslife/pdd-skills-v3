import type { YqWecomCommandForm, YqWecomCommandQuery, YqWecomCommandVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询企业微信指令列表
 */
export const listYqWecomCommand = (query?: YqWecomCommandQuery): AxiosPromise<PageResult<YqWecomCommandVO>> => {
  return request({
    url: '/yuqing/wecomCommand/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询企业微信指令详细
 */
export const getYqWecomCommand = (commandId: string | number): AxiosPromise<YqWecomCommandVO> => {
  return request({
    url: '/yuqing/wecomCommand/' + commandId,
    method: 'get'
  });
};

/**
 * 新增企业微信指令
 */
export const addYqWecomCommand = (data: YqWecomCommandForm): AxiosPromise => {
  return request({
    url: '/yuqing/wecomCommand',
    method: 'post',
    data
  });
};

/**
 * 修改企业微信指令
 */
export const updateYqWecomCommand = (data: YqWecomCommandForm): AxiosPromise => {
  return request({
    url: '/yuqing/wecomCommand',
    method: 'put',
    data
  });
};

/**
 * 删除企业微信指令
 */
export const delYqWecomCommand = (commandId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/wecomCommand/' + commandId,
    method: 'delete'
  });
};

/**
 * 企业微信指令下拉选项
 */
export const optionselectYqWecomCommand = (params?: any): AxiosPromise<YqWecomCommandVO[]> => {
  return request({
    url: '/yuqing/wecomCommand/optionselect',
    method: 'get',
    params
  });
};
