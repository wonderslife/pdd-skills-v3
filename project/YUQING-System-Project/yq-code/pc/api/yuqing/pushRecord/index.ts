import type { YqPushRecordForm, YqPushRecordQuery, YqPushRecordVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询推送记录列表
 */
export const listYqPushRecord = (query?: YqPushRecordQuery): AxiosPromise<PageResult<YqPushRecordVO>> => {
  return request({
    url: '/yuqing/pushRecord/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询推送记录详细
 */
export const getYqPushRecord = (recordId: string | number): AxiosPromise<YqPushRecordVO> => {
  return request({
    url: '/yuqing/pushRecord/' + recordId,
    method: 'get'
  });
};

/**
 * 新增推送记录
 */
export const addYqPushRecord = (data: YqPushRecordForm): AxiosPromise => {
  return request({
    url: '/yuqing/pushRecord',
    method: 'post',
    data
  });
};

/**
 * 修改推送记录
 */
export const updateYqPushRecord = (data: YqPushRecordForm): AxiosPromise => {
  return request({
    url: '/yuqing/pushRecord',
    method: 'put',
    data
  });
};

/**
 * 删除推送记录
 */
export const delYqPushRecord = (recordId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/pushRecord/' + recordId,
    method: 'delete'
  });
};

/**
 * 推送记录下拉选项
 */
export const optionselectYqPushRecord = (params?: any): AxiosPromise<YqPushRecordVO[]> => {
  return request({
    url: '/yuqing/pushRecord/optionselect',
    method: 'get',
    params
  });
};
