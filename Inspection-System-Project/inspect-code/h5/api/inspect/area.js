import request from '@/utils/request'

/**
 * 查询区域列表
 */
export function listInspectArea(query) {
  return request({
    url: '/inspect/area/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询区域详细
 */
export function getInspectArea(areaId) {
  return request({
    url: '/inspect/area/' + areaId,
    method: 'get'
  })
}

/**
 * 新增区域
 */
export function addInspectArea(data) {
  return request({
    url: '/inspect/area',
    method: 'post',
    data
  })
}

/**
 * 修改区域
 */
export function updateInspectArea(data) {
  return request({
    url: '/inspect/area',
    method: 'put',
    data
  })
}

/**
 * 删除区域
 */
export function delInspectArea(areaId) {
  return request({
    url: '/inspect/area/' + areaId,
    method: 'delete'
  })
}

/**
 * 区域下拉选项
 */
export function optionselectInspectArea(params) {
  return request({
    url: '/inspect/area/optionselect',
    method: 'get',
    params
  })
}
