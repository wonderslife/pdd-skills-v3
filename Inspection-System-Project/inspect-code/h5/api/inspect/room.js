import request from '@/utils/request'

/**
 * 查询机房列表
 */
export function listInspectRoom(query) {
  return request({
    url: '/inspect/room/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询机房详细
 */
export function getInspectRoom(roomId) {
  return request({
    url: '/inspect/room/' + roomId,
    method: 'get'
  })
}

/**
 * 新增机房
 */
export function addInspectRoom(data) {
  return request({
    url: '/inspect/room',
    method: 'post',
    data
  })
}

/**
 * 修改机房
 */
export function updateInspectRoom(data) {
  return request({
    url: '/inspect/room',
    method: 'put',
    data
  })
}

/**
 * 删除机房
 */
export function delInspectRoom(roomId) {
  return request({
    url: '/inspect/room/' + roomId,
    method: 'delete'
  })
}

/**
 * 机房下拉选项
 */
export function optionselectInspectRoom(params) {
  return request({
    url: '/inspect/room/optionselect',
    method: 'get',
    params
  })
}
