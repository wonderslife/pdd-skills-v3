import type { YqReportTemplateForm, YqReportTemplateQuery, YqReportTemplateVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询报告模板列表
 */
export const listYqReportTemplate = (query?: YqReportTemplateQuery): AxiosPromise<PageResult<YqReportTemplateVO>> => {
  return request({
    url: '/yuqing/reportTemplate/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询报告模板详细
 */
export const getYqReportTemplate = (templateId: string | number): AxiosPromise<YqReportTemplateVO> => {
  return request({
    url: '/yuqing/reportTemplate/' + templateId,
    method: 'get'
  });
};

/**
 * 新增报告模板
 */
export const addYqReportTemplate = (data: YqReportTemplateForm): AxiosPromise => {
  return request({
    url: '/yuqing/reportTemplate',
    method: 'post',
    data
  });
};

/**
 * 修改报告模板
 */
export const updateYqReportTemplate = (data: YqReportTemplateForm): AxiosPromise => {
  return request({
    url: '/yuqing/reportTemplate',
    method: 'put',
    data
  });
};

/**
 * 删除报告模板
 */
export const delYqReportTemplate = (templateId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/reportTemplate/' + templateId,
    method: 'delete'
  });
};

/**
 * 报告模板下拉选项
 */
export const optionselectYqReportTemplate = (params?: any): AxiosPromise<YqReportTemplateVO[]> => {
  return request({
    url: '/yuqing/reportTemplate/optionselect',
    method: 'get',
    params
  });
};
