import request from '@/utils/request'

/**
 * 查询预警规则列表
 */
export function listYqAlertRule(query) {
  return request({
    url: '/yuqing/alertRule/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询预警规则详细
 */
export function getYqAlertRule(ruleId) {
  return request({
    url: '/yuqing/alertRule/' + ruleId,
    method: 'get'
  })
}

/**
 * 新增预警规则
 */
export function addYqAlertRule(data) {
  return request({
    url: '/yuqing/alertRule',
    method: 'post',
    data
  })
}

/**
 * 修改预警规则
 */
export function updateYqAlertRule(data) {
  return request({
    url: '/yuqing/alertRule',
    method: 'put',
    data
  })
}

/**
 * 删除预警规则
 */
export function delYqAlertRule(ruleId) {
  return request({
    url: '/yuqing/alertRule/' + ruleId,
    method: 'delete'
  })
}

/**
 * 预警规则下拉选项
 */
export function optionselectYqAlertRule(params) {
  return request({
    url: '/yuqing/alertRule/optionselect',
    method: 'get',
    params
  })
}
