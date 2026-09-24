// ⚠ 维度分布位于 Apache Doris（PRD §5.5），业务侧只读；
// 写入由采集/研判 Worker 经 Stream Load 完成，此处不提供写接口。
import request from '@/utils/request'

/**
 * 查询维度分布列表
 */
export function listYqStatsDim(query) {
  return request({
    url: '/yuqing/statsDim/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询维度分布详细
 */
export function getYqStatsDim(dimId) {
  return request({
    url: '/yuqing/statsDim/' + dimId,
    method: 'get'
  })
}

/**
 * 维度分布下拉选项
 */
export function optionselectYqStatsDim(params) {
  return request({
    url: '/yuqing/statsDim/optionselect',
    method: 'get',
    params
  })
}
