// ⚠ 统计预聚合位于 Apache Doris（PRD §5.5），业务侧只读；
// 写入由采集/研判 Worker 经 Stream Load 完成，此处不提供写接口。
import request from '@/utils/request'

/**
 * 查询统计预聚合列表
 */
export function listYqStatsDaily(query) {
  return request({
    url: '/yuqing/statsDaily/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询统计预聚合详细
 */
export function getYqStatsDaily(statsId) {
  return request({
    url: '/yuqing/statsDaily/' + statsId,
    method: 'get'
  })
}

/**
 * 统计预聚合下拉选项
 */
export function optionselectYqStatsDaily(params) {
  return request({
    url: '/yuqing/statsDaily/optionselect',
    method: 'get',
    params
  })
}
