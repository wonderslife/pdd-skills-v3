import type { YqChannelForm, YqChannelQuery, YqChannelVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询采集渠道列表
 */
export const listYqChannel = (query?: YqChannelQuery): AxiosPromise<PageResult<YqChannelVO>> => {
  return request({
    url: '/yuqing/channel/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询采集渠道详细
 */
export const getYqChannel = (channelId: string | number): AxiosPromise<YqChannelVO> => {
  return request({
    url: '/yuqing/channel/' + channelId,
    method: 'get'
  });
};

/**
 * 新增采集渠道
 */
export const addYqChannel = (data: YqChannelForm): AxiosPromise => {
  return request({
    url: '/yuqing/channel',
    method: 'post',
    data
  });
};

/**
 * 修改采集渠道
 */
export const updateYqChannel = (data: YqChannelForm): AxiosPromise => {
  return request({
    url: '/yuqing/channel',
    method: 'put',
    data
  });
};

/**
 * 删除采集渠道
 */
export const delYqChannel = (channelId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/channel/' + channelId,
    method: 'delete'
  });
};

/**
 * 采集渠道下拉选项
 */
export const optionselectYqChannel = (params?: any): AxiosPromise<YqChannelVO[]> => {
  return request({
    url: '/yuqing/channel/optionselect',
    method: 'get',
    params
  });
};
