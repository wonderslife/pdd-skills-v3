import type { YqNoiseRuleForm, YqNoiseRuleQuery, YqNoiseRuleVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询降噪规则列表
 */
export const listYqNoiseRule = (query?: YqNoiseRuleQuery): AxiosPromise<PageResult<YqNoiseRuleVO>> => {
  return request({
    url: '/yuqing/noiseRule/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询降噪规则详细
 */
export const getYqNoiseRule = (ruleId: string | number): AxiosPromise<YqNoiseRuleVO> => {
  return request({
    url: '/yuqing/noiseRule/' + ruleId,
    method: 'get'
  });
};

/**
 * 新增降噪规则
 */
export const addYqNoiseRule = (data: YqNoiseRuleForm): AxiosPromise => {
  return request({
    url: '/yuqing/noiseRule',
    method: 'post',
    data
  });
};

/**
 * 修改降噪规则
 */
export const updateYqNoiseRule = (data: YqNoiseRuleForm): AxiosPromise => {
  return request({
    url: '/yuqing/noiseRule',
    method: 'put',
    data
  });
};

/**
 * 删除降噪规则
 */
export const delYqNoiseRule = (ruleId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/noiseRule/' + ruleId,
    method: 'delete'
  });
};

/**
 * 降噪规则下拉选项
 */
export const optionselectYqNoiseRule = (params?: any): AxiosPromise<YqNoiseRuleVO[]> => {
  return request({
    url: '/yuqing/noiseRule/optionselect',
    method: 'get',
    params
  });
};
