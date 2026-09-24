import type { YqReportSectionForm, YqReportSectionQuery, YqReportSectionVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询报告模板章节列表
 */
export const listYqReportSection = (query?: YqReportSectionQuery): AxiosPromise<PageResult<YqReportSectionVO>> => {
  return request({
    url: '/yuqing/reportSection/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询报告模板章节详细
 */
export const getYqReportSection = (sectionId: string | number): AxiosPromise<YqReportSectionVO> => {
  return request({
    url: '/yuqing/reportSection/' + sectionId,
    method: 'get'
  });
};

/**
 * 新增报告模板章节
 */
export const addYqReportSection = (data: YqReportSectionForm): AxiosPromise => {
  return request({
    url: '/yuqing/reportSection',
    method: 'post',
    data
  });
};

/**
 * 修改报告模板章节
 */
export const updateYqReportSection = (data: YqReportSectionForm): AxiosPromise => {
  return request({
    url: '/yuqing/reportSection',
    method: 'put',
    data
  });
};

/**
 * 删除报告模板章节
 */
export const delYqReportSection = (sectionId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/reportSection/' + sectionId,
    method: 'delete'
  });
};

/**
 * 报告模板章节下拉选项
 */
export const optionselectYqReportSection = (params?: any): AxiosPromise<YqReportSectionVO[]> => {
  return request({
    url: '/yuqing/reportSection/optionselect',
    method: 'get',
    params
  });
};
