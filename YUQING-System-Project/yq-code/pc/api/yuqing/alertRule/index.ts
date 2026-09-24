import type { YqAlertRuleForm, YqAlertRuleQuery, YqAlertRuleVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询预警规则列表
 */
export const listYqAlertRule = (query?: YqAlertRuleQuery): AxiosPromise<PageResult<YqAlertRuleVO>> => {
  return request({
    url: '/yuqing/alertRule/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询预警规则详细
 */
export const getYqAlertRule = (ruleId: string | number): AxiosPromise<YqAlertRuleVO> => {
  return request({
    url: '/yuqing/alertRule/' + ruleId,
    method: 'get'
  });
};

/**
 * 新增预警规则
 */
export const addYqAlertRule = (data: YqAlertRuleForm): AxiosPromise => {
  return request({
    url: '/yuqing/alertRule',
    method: 'post',
    data
  });
};

/**
 * 修改预警规则
 */
export const updateYqAlertRule = (data: YqAlertRuleForm): AxiosPromise => {
  return request({
    url: '/yuqing/alertRule',
    method: 'put',
    data
  });
};

/**
 * 删除预警规则
 */
export const delYqAlertRule = (ruleId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/alertRule/' + ruleId,
    method: 'delete'
  });
};

/**
 * 预警规则下拉选项
 */
export const optionselectYqAlertRule = (params?: any): AxiosPromise<YqAlertRuleVO[]> => {
  return request({
    url: '/yuqing/alertRule/optionselect',
    method: 'get',
    params
  });
};
