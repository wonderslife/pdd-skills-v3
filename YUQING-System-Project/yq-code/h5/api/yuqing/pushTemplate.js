import request from '@/utils/request'

/**
 * 查询推送模板列表
 */
export function listYqPushTemplate(query) {
  return request({
    url: '/yuqing/pushTemplate/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询推送模板详细
 */
export function getYqPushTemplate(templateId) {
  return request({
    url: '/yuqing/pushTemplate/' + templateId,
    method: 'get'
  })
}

/**
 * 新增推送模板
 */
export function addYqPushTemplate(data) {
  return request({
    url: '/yuqing/pushTemplate',
    method: 'post',
    data
  })
}

/**
 * 修改推送模板
 */
export function updateYqPushTemplate(data) {
  return request({
    url: '/yuqing/pushTemplate',
    method: 'put',
    data
  })
}

/**
 * 删除推送模板
 */
export function delYqPushTemplate(templateId) {
  return request({
    url: '/yuqing/pushTemplate/' + templateId,
    method: 'delete'
  })
}

/**
 * 推送模板下拉选项
 */
export function optionselectYqPushTemplate(params) {
  return request({
    url: '/yuqing/pushTemplate/optionselect',
    method: 'get',
    params
  })
}
