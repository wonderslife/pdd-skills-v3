import request from '@/utils/request'

/**
 * 查询预警记录列表
 */
export function listYqAlert(query) {
  return request({
    url: '/yuqing/alert/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询预警记录详细
 */
export function getYqAlert(alertId) {
  return request({
    url: '/yuqing/alert/' + alertId,
    method: 'get'
  })
}

/**
 * 新增预警记录
 */
export function addYqAlert(data) {
  return request({
    url: '/yuqing/alert',
    method: 'post',
    data
  })
}

/**
 * 修改预警记录
 */
export function updateYqAlert(data) {
  return request({
    url: '/yuqing/alert',
    method: 'put',
    data
  })
}

/**
 * 删除预警记录
 */
export function delYqAlert(alertId) {
  return request({
    url: '/yuqing/alert/' + alertId,
    method: 'delete'
  })
}

/**
 * 预警记录下拉选项
 */
export function optionselectYqAlert(params) {
  return request({
    url: '/yuqing/alert/optionselect',
    method: 'get',
    params
  })
}
