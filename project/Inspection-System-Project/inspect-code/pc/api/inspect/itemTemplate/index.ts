import type { InspectItemTemplateForm, InspectItemTemplateQuery, InspectItemTemplateVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询巡检项模板列表
 */
export const listInspectItemTemplate = (query?: InspectItemTemplateQuery): AxiosPromise<PageResult<InspectItemTemplateVO>> => {
  return request({
    url: '/inspect/itemTemplate/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询巡检项模板详细
 */
export const getInspectItemTemplate = (templateId: string | number): AxiosPromise<InspectItemTemplateVO> => {
  return request({
    url: '/inspect/itemTemplate/' + templateId,
    method: 'get'
  });
};

/**
 * 新增巡检项模板
 */
export const addInspectItemTemplate = (data: InspectItemTemplateForm): AxiosPromise => {
  return request({
    url: '/inspect/itemTemplate',
    method: 'post',
    data
  });
};

/**
 * 修改巡检项模板
 */
export const updateInspectItemTemplate = (data: InspectItemTemplateForm): AxiosPromise => {
  return request({
    url: '/inspect/itemTemplate',
    method: 'put',
    data
  });
};

/**
 * 删除巡检项模板
 */
export const delInspectItemTemplate = (templateId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/inspect/itemTemplate/' + templateId,
    method: 'delete'
  });
};

/**
 * 巡检项模板下拉选项
 */
export const optionselectInspectItemTemplate = (params?: any): AxiosPromise<InspectItemTemplateVO[]> => {
  return request({
    url: '/inspect/itemTemplate/optionselect',
    method: 'get',
    params
  });
};
