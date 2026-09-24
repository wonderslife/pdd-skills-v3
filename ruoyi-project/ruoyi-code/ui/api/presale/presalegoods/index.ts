import type { PresaleGoodsForm, PresaleGoodsQuery, PresaleGoodsVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询PresaleGoods列表
 * @param query
 * @returns
 */
export const listPresaleGoods = (query?: PresaleGoodsQuery): AxiosPromise<PageResult<PresaleGoodsVO>> => {
  return request({
    url: '/presale/goods/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询PresaleGoods详细
 * @param id
 */
export const getPresaleGoods = (id: string | number): AxiosPromise<PresaleGoodsVO> => {
  return request({
    url: '/presale/goods/' + id,
    method: 'get'
  });
};

/**
 * 新增PresaleGoods
 * @param data
 */
export const addPresaleGoods = (data: PresaleGoodsForm): AxiosPromise => {
  return request({
    url: '/presale/goods',
    method: 'post',
    data
  });
};

/**
 * 修改PresaleGoods
 * @param data
 */
export const updatePresaleGoods = (data: PresaleGoodsForm): AxiosPromise => {
  return request({
    url: '/presale/goods',
    method: 'put',
    data
  });
};

/**
 * 删除PresaleGoods
 * @param ids
 */
export const delPresaleGoods = (ids: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/presale/goods/' + ids,
    method: 'delete'
  });
};
