import request from '@/utils/request'

/**
 * 查询聚合批次列表
 */
export function listYqStatsBatch(query) {
  return request({
    url: '/yuqing/statsBatch/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询聚合批次详细
 */
export function getYqStatsBatch(batchId) {
  return request({
    url: '/yuqing/statsBatch/' + batchId,
    method: 'get'
  })
}

/**
 * 新增聚合批次
 */
export function addYqStatsBatch(data) {
  return request({
    url: '/yuqing/statsBatch',
    method: 'post',
    data
  })
}

/**
 * 修改聚合批次
 */
export function updateYqStatsBatch(data) {
  return request({
    url: '/yuqing/statsBatch',
    method: 'put',
    data
  })
}

/**
 * 删除聚合批次
 */
export function delYqStatsBatch(batchId) {
  return request({
    url: '/yuqing/statsBatch/' + batchId,
    method: 'delete'
  })
}

/**
 * 聚合批次下拉选项
 */
export function optionselectYqStatsBatch(params) {
  return request({
    url: '/yuqing/statsBatch/optionselect',
    method: 'get',
    params
  })
}
