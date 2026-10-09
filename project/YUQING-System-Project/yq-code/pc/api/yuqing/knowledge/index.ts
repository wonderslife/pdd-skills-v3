import type { YqKnowledgeForm, YqKnowledgeQuery, YqKnowledgeVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询知识库案例列表
 */
export const listYqKnowledge = (query?: YqKnowledgeQuery): AxiosPromise<PageResult<YqKnowledgeVO>> => {
  return request({
    url: '/yuqing/knowledge/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询知识库案例详细
 */
export const getYqKnowledge = (knowledgeId: string | number): AxiosPromise<YqKnowledgeVO> => {
  return request({
    url: '/yuqing/knowledge/' + knowledgeId,
    method: 'get'
  });
};

/**
 * 新增知识库案例
 */
export const addYqKnowledge = (data: YqKnowledgeForm): AxiosPromise => {
  return request({
    url: '/yuqing/knowledge',
    method: 'post',
    data
  });
};

/**
 * 修改知识库案例
 */
export const updateYqKnowledge = (data: YqKnowledgeForm): AxiosPromise => {
  return request({
    url: '/yuqing/knowledge',
    method: 'put',
    data
  });
};

/**
 * 删除知识库案例
 */
export const delYqKnowledge = (knowledgeId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/knowledge/' + knowledgeId,
    method: 'delete'
  });
};

/**
 * 知识库案例下拉选项
 */
export const optionselectYqKnowledge = (params?: any): AxiosPromise<YqKnowledgeVO[]> => {
  return request({
    url: '/yuqing/knowledge/optionselect',
    method: 'get',
    params
  });
};
