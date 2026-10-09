// ⚠ 热点排行位于 Apache Doris（PRD §5.5），业务侧只读；
// 写入由采集/研判 Worker 经 Stream Load 完成，此处不提供写接口。
import request from '@/utils/request'

/**
 * 查询热点排行列表
 */
export function listYqStatsHot(query) {
  return request({
    url: '/yuqing/statsHot/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询热点排行详细
 */
export function getYqStatsHot(hotId) {
  return request({
    url: '/yuqing/statsHot/' + hotId,
    method: 'get'
  })
}

/**
 * 热点排行下拉选项
 */
export function optionselectYqStatsHot(params) {
  return request({
    url: '/yuqing/statsHot/optionselect',
    method: 'get',
    params
  })
}
