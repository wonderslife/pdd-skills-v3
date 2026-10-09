import type { YqPushTemplateForm, YqPushTemplateQuery, YqPushTemplateVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询推送模板列表
 */
export const listYqPushTemplate = (query?: YqPushTemplateQuery): AxiosPromise<PageResult<YqPushTemplateVO>> => {
  return request({
    url: '/yuqing/pushTemplate/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询推送模板详细
 */
export const getYqPushTemplate = (templateId: string | number): AxiosPromise<YqPushTemplateVO> => {
  return request({
    url: '/yuqing/pushTemplate/' + templateId,
    method: 'get'
  });
};

/**
 * 新增推送模板
 */
export const addYqPushTemplate = (data: YqPushTemplateForm): AxiosPromise => {
  return request({
    url: '/yuqing/pushTemplate',
    method: 'post',
    data
  });
};

/**
 * 修改推送模板
 */
export const updateYqPushTemplate = (data: YqPushTemplateForm): AxiosPromise => {
  return request({
    url: '/yuqing/pushTemplate',
    method: 'put',
    data
  });
};

/**
 * 删除推送模板
 */
export const delYqPushTemplate = (templateId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/pushTemplate/' + templateId,
    method: 'delete'
  });
};

/**
 * 推送模板下拉选项
 */
export const optionselectYqPushTemplate = (params?: any): AxiosPromise<YqPushTemplateVO[]> => {
  return request({
    url: '/yuqing/pushTemplate/optionselect',
    method: 'get',
    params
  });
};
