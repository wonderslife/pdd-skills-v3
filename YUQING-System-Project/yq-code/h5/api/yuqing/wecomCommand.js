import request from '@/utils/request'

/**
 * 查询企业微信指令列表
 */
export function listYqWecomCommand(query) {
  return request({
    url: '/yuqing/wecomCommand/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询企业微信指令详细
 */
export function getYqWecomCommand(commandId) {
  return request({
    url: '/yuqing/wecomCommand/' + commandId,
    method: 'get'
  })
}

/**
 * 新增企业微信指令
 */
export function addYqWecomCommand(data) {
  return request({
    url: '/yuqing/wecomCommand',
    method: 'post',
    data
  })
}

/**
 * 修改企业微信指令
 */
export function updateYqWecomCommand(data) {
  return request({
    url: '/yuqing/wecomCommand',
    method: 'put',
    data
  })
}

/**
 * 删除企业微信指令
 */
export function delYqWecomCommand(commandId) {
  return request({
    url: '/yuqing/wecomCommand/' + commandId,
    method: 'delete'
  })
}

/**
 * 企业微信指令下拉选项
 */
export function optionselectYqWecomCommand(params) {
  return request({
    url: '/yuqing/wecomCommand/optionselect',
    method: 'get',
    params
  })
}
