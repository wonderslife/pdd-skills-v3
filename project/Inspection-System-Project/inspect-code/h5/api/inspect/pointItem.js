import request from '@/utils/request'

/**
 * 查询点位巡检项列表
 */
export function listInspectPointItem(query) {
  return request({
    url: '/inspect/pointItem/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询点位巡检项详细
 */
export function getInspectPointItem(itemId) {
  return request({
    url: '/inspect/pointItem/' + itemId,
    method: 'get'
  })
}

/**
 * 新增点位巡检项
 */
export function addInspectPointItem(data) {
  return request({
    url: '/inspect/pointItem',
    method: 'post',
    data
  })
}

/**
 * 修改点位巡检项
 */
export function updateInspectPointItem(data) {
  return request({
    url: '/inspect/pointItem',
    method: 'put',
    data
  })
}

/**
 * 删除点位巡检项
 */
export function delInspectPointItem(itemId) {
  return request({
    url: '/inspect/pointItem/' + itemId,
    method: 'delete'
  })
}

/**
 * 点位巡检项下拉选项
 */
export function optionselectInspectPointItem(params) {
  return request({
    url: '/inspect/pointItem/optionselect',
    method: 'get',
    params
  })
}
