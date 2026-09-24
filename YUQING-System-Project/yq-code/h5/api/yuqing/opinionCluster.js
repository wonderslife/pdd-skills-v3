// ⚠ 事件聚合位于 Apache Doris（PRD §5.5），业务侧只读；
// 写入由采集/研判 Worker 经 Stream Load 完成，此处不提供写接口。
import request from '@/utils/request'

/**
 * 查询事件聚合列表
 */
export function listYqOpinionCluster(query) {
  return request({
    url: '/yuqing/opinionCluster/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询事件聚合详细
 */
export function getYqOpinionCluster(clusterId) {
  return request({
    url: '/yuqing/opinionCluster/' + clusterId,
    method: 'get'
  })
}

/**
 * 事件聚合下拉选项
 */
export function optionselectYqOpinionCluster(params) {
  return request({
    url: '/yuqing/opinionCluster/optionselect',
    method: 'get',
    params
  })
}
