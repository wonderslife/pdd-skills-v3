// ⚠ 舆情标签关联位于 Apache Doris（PRD §5.5），业务侧只读；
// 写入由采集/研判 Worker 经 Stream Load 完成，此处不提供写接口。
import request from '@/utils/request'

/**
 * 查询舆情标签关联列表
 */
export function listYqOpinionTag(query) {
  return request({
    url: '/yuqing/opinionTag/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询舆情标签关联详细
 */
export function getYqOpinionTag(id) {
  return request({
    url: '/yuqing/opinionTag/' + id,
    method: 'get'
  })
}

/**
 * 舆情标签关联下拉选项
 */
export function optionselectYqOpinionTag(params) {
  return request({
    url: '/yuqing/opinionTag/optionselect',
    method: 'get',
    params
  })
}
