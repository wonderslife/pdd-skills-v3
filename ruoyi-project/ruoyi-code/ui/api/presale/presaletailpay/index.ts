import type { PresaleTailPayForm, PresaleTailPayQuery, PresaleTailPayVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询PresaleTailPay列表
 * @param query
 * @returns
 */
export const listPresaleTailPay = (query?: PresaleTailPayQuery): AxiosPromise<PageResult<PresaleTailPayVO>> => {
  return request({
    url: '/presale/tail/pay/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询PresaleTailPay详细
 * @param id
 */
export const getPresaleTailPay = (id: string | number): AxiosPromise<PresaleTailPayVO> => {
  return request({
    url: '/presale/tail/pay/' + id,
    method: 'get'
  });
};

/**
 * 新增PresaleTailPay
 * @param data
 */
export const addPresaleTailPay = (data: PresaleTailPayForm): AxiosPromise => {
  return request({
    url: '/presale/tail/pay',
    method: 'post',
    data
  });
};

/**
 * 修改PresaleTailPay
 * @param data
 */
export const updatePresaleTailPay = (data: PresaleTailPayForm): AxiosPromise => {
  return request({
    url: '/presale/tail/pay',
    method: 'put',
    data
  });
};

/**
 * 删除PresaleTailPay
 * @param ids
 */
export const delPresaleTailPay = (ids: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/presale/tail/pay/' + ids,
    method: 'delete'
  });
};
