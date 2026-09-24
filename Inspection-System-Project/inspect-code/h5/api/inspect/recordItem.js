import request from '@/utils/request'

/**
 * 查询巡检项结果列表
 */
export function listInspectRecordItem(query) {
  return request({
    url: '/inspect/recordItem/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询巡检项结果详细
 */
export function getInspectRecordItem(recordItemId) {
  return request({
    url: '/inspect/recordItem/' + recordItemId,
    method: 'get'
  })
}

/**
 * 新增巡检项结果
 */
export function addInspectRecordItem(data) {
  return request({
    url: '/inspect/recordItem',
    method: 'post',
    data
  })
}

/**
 * 修改巡检项结果
 */
export function updateInspectRecordItem(data) {
  return request({
    url: '/inspect/recordItem',
    method: 'put',
    data
  })
}

/**
 * 删除巡检项结果
 */
export function delInspectRecordItem(recordItemId) {
  return request({
    url: '/inspect/recordItem/' + recordItemId,
    method: 'delete'
  })
}

/**
 * 巡检项结果下拉选项
 */
export function optionselectInspectRecordItem(params) {
  return request({
    url: '/inspect/recordItem/optionselect',
    method: 'get',
    params
  })
}
