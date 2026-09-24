import request from '@/utils/request'

/**
 * 查询净化批次列表
 */
export function listYqCleanBatch(query) {
  return request({
    url: '/yuqing/cleanBatch/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询净化批次详细
 */
export function getYqCleanBatch(batchId) {
  return request({
    url: '/yuqing/cleanBatch/' + batchId,
    method: 'get'
  })
}

/**
 * 新增净化批次
 */
export function addYqCleanBatch(data) {
  return request({
    url: '/yuqing/cleanBatch',
    method: 'post',
    data
  })
}

/**
 * 修改净化批次
 */
export function updateYqCleanBatch(data) {
  return request({
    url: '/yuqing/cleanBatch',
    method: 'put',
    data
  })
}

/**
 * 删除净化批次
 */
export function delYqCleanBatch(batchId) {
  return request({
    url: '/yuqing/cleanBatch/' + batchId,
    method: 'delete'
  })
}

/**
 * 净化批次下拉选项
 */
export function optionselectYqCleanBatch(params) {
  return request({
    url: '/yuqing/cleanBatch/optionselect',
    method: 'get',
    params
  })
}
