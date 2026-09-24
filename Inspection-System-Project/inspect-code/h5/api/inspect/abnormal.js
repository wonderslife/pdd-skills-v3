import request from '@/utils/request'

/**
 * 查询异常项列表
 */
export function listInspectAbnormal(query) {
  return request({
    url: '/inspect/abnormal/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询异常项详细
 */
export function getInspectAbnormal(abnormalId) {
  return request({
    url: '/inspect/abnormal/' + abnormalId,
    method: 'get'
  })
}

/**
 * 新增异常项
 */
export function addInspectAbnormal(data) {
  return request({
    url: '/inspect/abnormal',
    method: 'post',
    data
  })
}

/**
 * 修改异常项
 */
export function updateInspectAbnormal(data) {
  return request({
    url: '/inspect/abnormal',
    method: 'put',
    data
  })
}

/**
 * 删除异常项
 */
export function delInspectAbnormal(abnormalId) {
  return request({
    url: '/inspect/abnormal/' + abnormalId,
    method: 'delete'
  })
}

/**
 * 异常项下拉选项
 */
export function optionselectInspectAbnormal(params) {
  return request({
    url: '/inspect/abnormal/optionselect',
    method: 'get',
    params
  })
}
