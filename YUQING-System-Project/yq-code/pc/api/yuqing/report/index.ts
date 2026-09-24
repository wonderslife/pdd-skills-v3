import request from '@/utils/request';
import type { AxiosPromise } from '@/utils/api-types';
import type { PageResult } from '@/api/types';
import type {
  ReportGenerateForm,
  ReportGenerateResult,
  ReportOpinionForm,
  ReportOpinionRow,
  YqReportForm,
  YqReportQuery,
  YqReportVO
} from './types';

/** 查询舆情报告列表 */
export const listYqReport = (query?: YqReportQuery): AxiosPromise<PageResult<YqReportVO>> => {
  return request({
    url: '/yuqing/report/list',
    method: 'get',
    params: query
  });
};

/** 查询舆情报告下拉选项 */
export const optionselectYqReport = (query?: YqReportQuery): AxiosPromise<YqReportVO[]> => {
  return request({
    url: '/yuqing/report/optionselect',
    method: 'get',
    params: query
  });
};

/** 获取舆情报告详情 */
export const getYqReport = (reportId: string | number): AxiosPromise<YqReportVO> => {
  return request({
    url: '/yuqing/report/' + reportId,
    method: 'get'
  });
};

/** 新增舆情报告 */
export const addYqReport = (data: YqReportForm): AxiosPromise<void> => {
  return request({
    url: '/yuqing/report',
    method: 'post',
    data
  });
};

/** 修改舆情报告 */
export const updateYqReport = (data: YqReportForm): AxiosPromise<void> => {
  return request({
    url: '/yuqing/report',
    method: 'put',
    data
  });
};

/** 删除舆情报告 */
export const delYqReport = (reportId: string | number | Array<string | number>): AxiosPromise<void> => {
  return request({
    url: '/yuqing/report/' + reportId,
    method: 'delete'
  });
};

/** 生成报告（验收标准 1 / 2 / 10） */
export const generateYqReport = (data: ReportGenerateForm): AxiosPromise<ReportGenerateResult> => {
  return request({
    url: '/yuqing/report/generate',
    method: 'post',
    data
  });
};

/** 重新生成（验收标准 7） */
export const regenerateYqReport = (
  reportId: string | number,
  keepVersions = true
): AxiosPromise<ReportGenerateResult> => {
  return request({
    url: '/yuqing/report/regenerate/' + reportId,
    method: 'post',
    params: { keepVersions }
  });
};

/** 查询报告纳入的舆情条目（验收标准 3） */
export const listReportOpinions = (reportId: string | number): AxiosPromise<ReportOpinionRow[]> => {
  return request({
    url: '/yuqing/report/opinions/' + reportId,
    method: 'get'
  });
};

/** 增删报告舆情条目（验收标准 3） */
export const adjustReportOpinions = (data: ReportOpinionForm): AxiosPromise<void> => {
  return request({
    url: '/yuqing/report/opinions',
    method: 'put',
    data
  });
};

/** 提交报告（验收标准 11） */
export const submitYqReport = (
  reportId: string | number,
  submitTarget?: string
): AxiosPromise<void> => {
  return request({
    url: '/yuqing/report/submit/' + reportId,
    method: 'post',
    params: { submitTarget }
  });
};

/** 推送报告到企业微信（验收标准 6） */
export const pushYqReport = (reportId: string | number): AxiosPromise<any> => {
  return request({
    url: '/yuqing/report/push/' + reportId,
    method: 'post'
  });
};

/** 导出报告文件下载链接（验收标准 5） */
export const exportReportUrl = (reportId: string | number, format = 'docx'): string => {
  return import.meta.env.VITE_APP_BASE_API + '/yuqing/report/export/' + reportId + '?format=' + format;
};
