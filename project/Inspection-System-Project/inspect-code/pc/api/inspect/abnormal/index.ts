import type { InspectAbnormalQuery, InspectAbnormalVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 异常项列表（按状态筛选）
 */
export const listInspectAbnormal = (query?: InspectAbnormalQuery): AxiosPromise<PageResult<InspectAbnormalVO>> => {
  return request({
    url: '/inspect/abnormal/list',
    method: 'get',
    params: query
  });
};

/**
 * 异常项详情（含关联记录与照片）
 */
export const getInspectAbnormal = (abnormalId: string | number): AxiosPromise<InspectAbnormalVO> => {
  return request({
    url: '/inspect/abnormal/' + abnormalId,
    method: 'get'
  });
};

/**
 * 标记已处理（处理说明必填）
 */
export const processInspectAbnormal = (abnormalId: string | number, processRemark: string): AxiosPromise => {
  return request({
    url: `/inspect/abnormal/${abnormalId}/process`,
    method: 'put',
    data: { processRemark }
  });
};

/**
 * 导出异常项
 */
export const exportInspectAbnormal = (query?: InspectAbnormalQuery): AxiosPromise<any> => {
  return request({
    url: '/inspect/abnormal/export',
    method: 'post',
    params: query
  });
};
