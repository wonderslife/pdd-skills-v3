import type { PresaleOrderForm, PresaleOrderQuery, PresaleOrderVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询PresaleOrder列表
 * @param query
 * @returns
 */
export const listPresaleOrder = (query?: PresaleOrderQuery): AxiosPromise<PageResult<PresaleOrderVO>> => {
  return request({
    url: '/presale/order/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询PresaleOrder详细
 * @param id
 */
export const getPresaleOrder = (id: string | number): AxiosPromise<PresaleOrderVO> => {
  return request({
    url: '/presale/order/' + id,
    method: 'get'
  });
};

/**
 * 新增PresaleOrder
 * @param data
 */
export const addPresaleOrder = (data: PresaleOrderForm): AxiosPromise => {
  return request({
    url: '/presale/order',
    method: 'post',
    data
  });
};

/**
 * 修改PresaleOrder
 * @param data
 */
export const updatePresaleOrder = (data: PresaleOrderForm): AxiosPromise => {
  return request({
    url: '/presale/order',
    method: 'put',
    data
  });
};

/**
 * 删除PresaleOrder
 * @param ids
 */
export const delPresaleOrder = (ids: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/presale/order/' + ids,
    method: 'delete'
  });
};
