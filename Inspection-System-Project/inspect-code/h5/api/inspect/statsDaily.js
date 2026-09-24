import request from '@/utils/request'

/**
 * 查询统计预聚合列表
 */
export function listInspectStatsDaily(query) {
  return request({
    url: '/inspect/statsDaily/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询统计预聚合详细
 */
export function getInspectStatsDaily(statsId) {
  return request({
    url: '/inspect/statsDaily/' + statsId,
    method: 'get'
  })
}

/**
 * 新增统计预聚合
 */
export function addInspectStatsDaily(data) {
  return request({
    url: '/inspect/statsDaily',
    method: 'post',
    data
  })
}

/**
 * 修改统计预聚合
 */
export function updateInspectStatsDaily(data) {
  return request({
    url: '/inspect/statsDaily',
    method: 'put',
    data
  })
}

/**
 * 删除统计预聚合
 */
export function delInspectStatsDaily(statsId) {
  return request({
    url: '/inspect/statsDaily/' + statsId,
    method: 'delete'
  })
}

/**
 * 统计预聚合下拉选项
 */
export function optionselectInspectStatsDaily(params) {
  return request({
    url: '/inspect/statsDaily/optionselect',
    method: 'get',
    params
  })
}
