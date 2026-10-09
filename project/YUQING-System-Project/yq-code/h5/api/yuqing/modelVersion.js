import request from '@/utils/request'

/**
 * 查询模型版本列表
 */
export function listYqModelVersion(query) {
  return request({
    url: '/yuqing/modelVersion/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询模型版本详细
 */
export function getYqModelVersion(modelVersionId) {
  return request({
    url: '/yuqing/modelVersion/' + modelVersionId,
    method: 'get'
  })
}

/**
 * 新增模型版本
 */
export function addYqModelVersion(data) {
  return request({
    url: '/yuqing/modelVersion',
    method: 'post',
    data
  })
}

/**
 * 修改模型版本
 */
export function updateYqModelVersion(data) {
  return request({
    url: '/yuqing/modelVersion',
    method: 'put',
    data
  })
}

/**
 * 删除模型版本
 */
export function delYqModelVersion(modelVersionId) {
  return request({
    url: '/yuqing/modelVersion/' + modelVersionId,
    method: 'delete'
  })
}

/**
 * 模型版本下拉选项
 */
export function optionselectYqModelVersion(params) {
  return request({
    url: '/yuqing/modelVersion/optionselect',
    method: 'get',
    params
  })
}
