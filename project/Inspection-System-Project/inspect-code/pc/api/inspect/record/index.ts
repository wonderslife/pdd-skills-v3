import type { InspectRecordQuery, InspectRecordSubmitForm, InspectRecordVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 巡检记录列表（多维筛选）
 */
export const listInspectRecord = (query?: InspectRecordQuery): AxiosPromise<PageResult<InspectRecordVO>> => {
  return request({
    url: '/inspect/record/list',
    method: 'get',
    params: query
  });
};

/**
 * 巡检记录详情（含巡检项结果与照片 URL）
 */
export const getInspectRecord = (recordId: string | number): AxiosPromise<InspectRecordVO> => {
  return request({
    url: '/inspect/record/' + recordId,
    method: 'get'
  });
};

/**
 * PC 逾期补录（巡检时间可选）
 */
export const supplementInspectRecord = (data: InspectRecordSubmitForm): AxiosPromise<string | number> => {
  return request({
    url: '/inspect/record/supplement',
    method: 'post',
    data
  });
};

/**
 * 追加管理员备注（已提交记录不可修改）
 */
export const remarkInspectRecord = (recordId: string | number, adminRemark: string): AxiosPromise => {
  return request({
    url: `/inspect/record/${recordId}/remark`,
    method: 'put',
    data: { adminRemark }
  });
};

/**
 * 上传单张巡检照片
 * <p>
 * PC 端不强制压缩，只传 original；后端在缺少 compressed 时会自动用原图 URL 兜底，
 * 保证「异常项必须至少有 1 张照片」的校验在 PC 端同样成立。
 */
export const uploadInspectPhoto = (file: File): AxiosPromise<Record<string, any>> => {
  const fd = new FormData();
  fd.append('original', file);
  return request({
    url: '/inspect/photo/upload',
    method: 'post',
    headers: { 'Content-Type': 'multipart/form-data' },
    data: fd
  });
};

/**
 * 导出巡检记录
 */
export const exportInspectRecord = (query?: InspectRecordQuery): AxiosPromise<any> => {
  return request({
    url: '/inspect/record/export',
    method: 'post',
    params: query
  });
};
