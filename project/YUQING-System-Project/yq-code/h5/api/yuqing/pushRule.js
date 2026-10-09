import request from '@/utils/request'

/**
 * 查询推送规则列表
 */
export function listYqPushRule(query) {
  return request({
    url: '/yuqing/pushRule/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询推送规则详细
 */
export function getYqPushRule(ruleId) {
  return request({
    url: '/yuqing/pushRule/' + ruleId,
    method: 'get'
  })
}

/**
 * 新增推送规则
 */
export function addYqPushRule(data) {
  return request({
    url: '/yuqing/pushRule',
    method: 'post',
    data
  })
}

/**
 * 修改推送规则
 */
export function updateYqPushRule(data) {
  return request({
    url: '/yuqing/pushRule',
    method: 'put',
    data
  })
}

/**
 * 删除推送规则
 */
export function delYqPushRule(ruleId) {
  return request({
    url: '/yuqing/pushRule/' + ruleId,
    method: 'delete'
  })
}

/**
 * 推送规则下拉选项
 */
export function optionselectYqPushRule(params) {
  return request({
    url: '/yuqing/pushRule/optionselect',
    method: 'get',
    params
  })
}
