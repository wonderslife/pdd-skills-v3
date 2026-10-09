import request from '@/utils/request'

/**
 * 查询研判分级规则列表
 */
export function listYqLevelRule(query) {
  return request({
    url: '/yuqing/levelRule/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询研判分级规则详细
 */
export function getYqLevelRule(ruleId) {
  return request({
    url: '/yuqing/levelRule/' + ruleId,
    method: 'get'
  })
}

/**
 * 新增研判分级规则
 */
export function addYqLevelRule(data) {
  return request({
    url: '/yuqing/levelRule',
    method: 'post',
    data
  })
}

/**
 * 修改研判分级规则
 */
export function updateYqLevelRule(data) {
  return request({
    url: '/yuqing/levelRule',
    method: 'put',
    data
  })
}

/**
 * 删除研判分级规则
 */
export function delYqLevelRule(ruleId) {
  return request({
    url: '/yuqing/levelRule/' + ruleId,
    method: 'delete'
  })
}

/**
 * 研判分级规则下拉选项
 */
export function optionselectYqLevelRule(params) {
  return request({
    url: '/yuqing/levelRule/optionselect',
    method: 'get',
    params
  })
}
