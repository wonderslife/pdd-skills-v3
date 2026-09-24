import request from '@/utils/request'

/**
 * 查询降噪规则列表
 */
export function listYqNoiseRule(query) {
  return request({
    url: '/yuqing/noiseRule/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询降噪规则详细
 */
export function getYqNoiseRule(ruleId) {
  return request({
    url: '/yuqing/noiseRule/' + ruleId,
    method: 'get'
  })
}

/**
 * 新增降噪规则
 */
export function addYqNoiseRule(data) {
  return request({
    url: '/yuqing/noiseRule',
    method: 'post',
    data
  })
}

/**
 * 修改降噪规则
 */
export function updateYqNoiseRule(data) {
  return request({
    url: '/yuqing/noiseRule',
    method: 'put',
    data
  })
}

/**
 * 删除降噪规则
 */
export function delYqNoiseRule(ruleId) {
  return request({
    url: '/yuqing/noiseRule/' + ruleId,
    method: 'delete'
  })
}

/**
 * 降噪规则下拉选项
 */
export function optionselectYqNoiseRule(params) {
  return request({
    url: '/yuqing/noiseRule/optionselect',
    method: 'get',
    params
  })
}
