import type { InspectPointForm, InspectPointQuery, InspectPointVO, PointImportRowVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询点位列表（分页）
 */
export const listInspectPoint = (query?: InspectPointQuery): AxiosPromise<PageResult<InspectPointVO>> => {
  return request({
    url: '/inspect/point/list',
    method: 'get',
    params: query
  });
};

/**
 * 点位下拉选项
 */
export const optionselectInspectPoint = (params?: any): AxiosPromise<InspectPointVO[]> => {
  return request({
    url: '/inspect/point/optionselect',
    method: 'get',
    params
  });
};

/**
 * 查询点位详情（含巡检项清单）
 */
export const getInspectPoint = (pointId: string | number): AxiosPromise<InspectPointVO> => {
  return request({
    url: '/inspect/point/' + pointId,
    method: 'get'
  });
};

/**
 * 新增点位（含巡检项，后端返回新的点位ID）
 */
export const addInspectPoint = (data: InspectPointForm): AxiosPromise<string | number> => {
  return request({
    url: '/inspect/point',
    method: 'post',
    data
  });
};

/**
 * 修改点位（巡检项全量覆盖）
 */
export const updateInspectPoint = (data: InspectPointForm): AxiosPromise => {
  return request({
    url: '/inspect/point',
    method: 'put',
    data
  });
};

/**
 * 批量软删点位
 */
export const delInspectPoint = (pointId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/inspect/point/' + pointId,
    method: 'delete'
  });
};

/**
 * 下载 Excel 导入模板（返回 blob，交由页面触发下载）
 */
export const importPointTemplate = (): AxiosPromise<any> => {
  return request({
    url: '/inspect/point/importTemplate',
    method: 'get',
    responseType: 'blob'
  });
};

/**
 * 上传 Excel 并逐行校验（不落库）
 */
export const importInspectPointData = (file: File | FormData): AxiosPromise<PointImportRowVO[]> => {
  const data = file instanceof FormData ? file : (() => {
    const fd = new FormData();
    fd.append('file', file);
    return fd;
  })();
  return request({
    url: '/inspect/point/importData',
    method: 'post',
    headers: { 'Content-Type': 'multipart/form-data' },
    data
  });
};

/**
 * 确认导入（仅落库校验通过的行）
 */
export const importInspectPointConfirm = (rows: PointImportRowVO[]): AxiosPromise<number> => {
  return request({
    url: '/inspect/point/importConfirm',
    method: 'post',
    data: rows
  });
};

/**
 * 单点位二维码 PNG（blob）
 */
export const getPointQrcode = (pointId: string | number): AxiosPromise<any> => {
  return request({
    url: `/inspect/point/${pointId}/qrcode`,
    method: 'get',
    responseType: 'blob'
  });
};

/**
 * 批量导出二维码 ZIP（blob）
 */
export const batchExportPointQrcode = (pointIds: Array<string | number>): AxiosPromise<any> => {
  return request({
    url: '/inspect/point/qrcode/batchExport',
    method: 'post',
    responseType: 'blob',
    data: pointIds
  });
};
