import type { YqReportOpinionForm, YqReportOpinionQuery, YqReportOpinionVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询报告舆情关联列表
 */
export const listYqReportOpinion = (query?: YqReportOpinionQuery): AxiosPromise<PageResult<YqReportOpinionVO>> => {
  return request({
    url: '/yuqing/reportOpinion/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询报告舆情关联详细
 */
export const getYqReportOpinion = (id: string | number): AxiosPromise<YqReportOpinionVO> => {
  return request({
    url: '/yuqing/reportOpinion/' + id,
    method: 'get'
  });
};

/**
 * 新增报告舆情关联
 */
export const addYqReportOpinion = (data: YqReportOpinionForm): AxiosPromise => {
  return request({
    url: '/yuqing/reportOpinion',
    method: 'post',
    data
  });
};

/**
 * 修改报告舆情关联
 */
export const updateYqReportOpinion = (data: YqReportOpinionForm): AxiosPromise => {
  return request({
    url: '/yuqing/reportOpinion',
    method: 'put',
    data
  });
};

/**
 * 删除报告舆情关联
 */
export const delYqReportOpinion = (id: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/reportOpinion/' + id,
    method: 'delete'
  });
};

/**
 * 报告舆情关联下拉选项
 */
export const optionselectYqReportOpinion = (params?: any): AxiosPromise<YqReportOpinionVO[]> => {
  return request({
    url: '/yuqing/reportOpinion/optionselect',
    method: 'get',
    params
  });
};
