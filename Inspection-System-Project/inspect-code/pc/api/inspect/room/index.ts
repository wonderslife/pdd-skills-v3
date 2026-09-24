import type { InspectRoomForm, InspectRoomQuery, InspectRoomVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询机房列表
 */
export const listInspectRoom = (query?: InspectRoomQuery): AxiosPromise<PageResult<InspectRoomVO>> => {
  return request({
    url: '/inspect/room/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询机房详细
 */
export const getInspectRoom = (roomId: string | number): AxiosPromise<InspectRoomVO> => {
  return request({
    url: '/inspect/room/' + roomId,
    method: 'get'
  });
};

/**
 * 新增机房
 */
export const addInspectRoom = (data: InspectRoomForm): AxiosPromise => {
  return request({
    url: '/inspect/room',
    method: 'post',
    data
  });
};

/**
 * 修改机房
 */
export const updateInspectRoom = (data: InspectRoomForm): AxiosPromise => {
  return request({
    url: '/inspect/room',
    method: 'put',
    data
  });
};

/**
 * 删除机房
 */
export const delInspectRoom = (roomId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/inspect/room/' + roomId,
    method: 'delete'
  });
};

/**
 * 机房下拉选项
 */
export const optionselectInspectRoom = (params?: any): AxiosPromise<InspectRoomVO[]> => {
  return request({
    url: '/inspect/room/optionselect',
    method: 'get',
    params
  });
};
