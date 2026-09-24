// ⚠ 互动数据快照位于 Apache Doris（PRD §5.5），业务侧只读；
// 写入由采集/研判 Worker 经 Stream Load 完成，此处不提供写接口。
import request from '@/utils/request'

/**
 * 查询互动数据快照列表
 */
export function listYqOpinionMetric(query) {
  return request({
    url: '/yuqing/opinionMetric/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询互动数据快照详细
 */
export function getYqOpinionMetric(metricId) {
  return request({
    url: '/yuqing/opinionMetric/' + metricId,
    method: 'get'
  })
}

/**
 * 互动数据快照下拉选项
 */
export function optionselectYqOpinionMetric(params) {
  return request({
    url: '/yuqing/opinionMetric/optionselect',
    method: 'get',
    params
  })
}
