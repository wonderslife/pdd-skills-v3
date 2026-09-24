import type { PresaleDepositForm, PresaleDepositQuery, PresaleDepositVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询PresaleDeposit列表
 * @param query
 * @returns
 */
export const listPresaleDeposit = (query?: PresaleDepositQuery): AxiosPromise<PageResult<PresaleDepositVO>> => {
  return request({
    url: '/presale/deposit/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询PresaleDeposit详细
 * @param id
 */
export const getPresaleDeposit = (id: string | number): AxiosPromise<PresaleDepositVO> => {
  return request({
    url: '/presale/deposit/' + id,
    method: 'get'
  });
};

/**
 * 新增PresaleDeposit
 * @param data
 */
export const addPresaleDeposit = (data: PresaleDepositForm): AxiosPromise => {
  return request({
    url: '/presale/deposit',
    method: 'post',
    data
  });
};

/**
 * 修改PresaleDeposit
 * @param data
 */
export const updatePresaleDeposit = (data: PresaleDepositForm): AxiosPromise => {
  return request({
    url: '/presale/deposit',
    method: 'put',
    data
  });
};

/**
 * 删除PresaleDeposit
 * @param ids
 */
export const delPresaleDeposit = (ids: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/presale/deposit/' + ids,
    method: 'delete'
  });
};
