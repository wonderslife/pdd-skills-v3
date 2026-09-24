import request from '@/utils/request'

/**
 * 查询点位列表
 */
export function listInspectPoint(query) {
  return request({
    url: '/inspect/point/list',
    method: 'get',
    params: query,
  })
}

/**
 * 查询点位详情（含巡检项清单）
 */
export function getInspectPoint(pointId) {
  return request({
    url: `/inspect/point/${pointId}`,
    method: 'get',
  })
}

/**
 * 点位下拉选项
 */
export function optionselectInspectPoint(query) {
  return request({
    url: '/inspect/point/optionselect',
    method: 'get',
    params: query,
  })
}

/**
 * 本人所属机房的点位列表（手动输码兜底数据源）
 */
export function myInspectPointList() {
  return request({
    url: '/inspect/record/myPointList',
    method: 'get',
  })
}
