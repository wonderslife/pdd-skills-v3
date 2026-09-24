import type { YqLedgerExportLogForm, YqLedgerExportLogQuery, YqLedgerExportLogVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询台账导出记录列表
 */
export const listYqLedgerExportLog = (query?: YqLedgerExportLogQuery): AxiosPromise<PageResult<YqLedgerExportLogVO>> => {
  return request({
    url: '/yuqing/ledgerExportLog/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询台账导出记录详细
 */
export const getYqLedgerExportLog = (exportId: string | number): AxiosPromise<YqLedgerExportLogVO> => {
  return request({
    url: '/yuqing/ledgerExportLog/' + exportId,
    method: 'get'
  });
};

/**
 * 新增台账导出记录
 */
export const addYqLedgerExportLog = (data: YqLedgerExportLogForm): AxiosPromise => {
  return request({
    url: '/yuqing/ledgerExportLog',
    method: 'post',
    data
  });
};

/**
 * 修改台账导出记录
 */
export const updateYqLedgerExportLog = (data: YqLedgerExportLogForm): AxiosPromise => {
  return request({
    url: '/yuqing/ledgerExportLog',
    method: 'put',
    data
  });
};

/**
 * 删除台账导出记录
 */
export const delYqLedgerExportLog = (exportId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/ledgerExportLog/' + exportId,
    method: 'delete'
  });
};

/**
 * 台账导出记录下拉选项
 */
export const optionselectYqLedgerExportLog = (params?: any): AxiosPromise<YqLedgerExportLogVO[]> => {
  return request({
    url: '/yuqing/ledgerExportLog/optionselect',
    method: 'get',
    params
  });
};
