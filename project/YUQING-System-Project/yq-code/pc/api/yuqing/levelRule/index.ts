import type { YqLevelRuleForm, YqLevelRuleQuery, YqLevelRuleVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询研判分级规则列表
 */
export const listYqLevelRule = (query?: YqLevelRuleQuery): AxiosPromise<PageResult<YqLevelRuleVO>> => {
  return request({
    url: '/yuqing/levelRule/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询研判分级规则详细
 */
export const getYqLevelRule = (ruleId: string | number): AxiosPromise<YqLevelRuleVO> => {
  return request({
    url: '/yuqing/levelRule/' + ruleId,
    method: 'get'
  });
};

/**
 * 新增研判分级规则
 */
export const addYqLevelRule = (data: YqLevelRuleForm): AxiosPromise => {
  return request({
    url: '/yuqing/levelRule',
    method: 'post',
    data
  });
};

/**
 * 修改研判分级规则
 */
export const updateYqLevelRule = (data: YqLevelRuleForm): AxiosPromise => {
  return request({
    url: '/yuqing/levelRule',
    method: 'put',
    data
  });
};

/**
 * 删除研判分级规则
 */
export const delYqLevelRule = (ruleId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/levelRule/' + ruleId,
    method: 'delete'
  });
};

/**
 * 研判分级规则下拉选项
 */
export const optionselectYqLevelRule = (params?: any): AxiosPromise<YqLevelRuleVO[]> => {
  return request({
    url: '/yuqing/levelRule/optionselect',
    method: 'get',
    params
  });
};
