import type { YqPushRuleForm, YqPushRuleQuery, YqPushRuleVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询推送规则列表
 */
export const listYqPushRule = (query?: YqPushRuleQuery): AxiosPromise<PageResult<YqPushRuleVO>> => {
  return request({
    url: '/yuqing/pushRule/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询推送规则详细
 */
export const getYqPushRule = (ruleId: string | number): AxiosPromise<YqPushRuleVO> => {
  return request({
    url: '/yuqing/pushRule/' + ruleId,
    method: 'get'
  });
};

/**
 * 新增推送规则
 */
export const addYqPushRule = (data: YqPushRuleForm): AxiosPromise => {
  return request({
    url: '/yuqing/pushRule',
    method: 'post',
    data
  });
};

/**
 * 修改推送规则
 */
export const updateYqPushRule = (data: YqPushRuleForm): AxiosPromise => {
  return request({
    url: '/yuqing/pushRule',
    method: 'put',
    data
  });
};

/**
 * 删除推送规则
 */
export const delYqPushRule = (ruleId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/pushRule/' + ruleId,
    method: 'delete'
  });
};

/**
 * 推送规则下拉选项
 */
export const optionselectYqPushRule = (params?: any): AxiosPromise<YqPushRuleVO[]> => {
  return request({
    url: '/yuqing/pushRule/optionselect',
    method: 'get',
    params
  });
};
