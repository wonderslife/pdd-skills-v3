// ⚠ 研判结果位于 Apache Doris（PRD §5.5），业务侧只读；
// 写入由采集/研判 Worker 经 Stream Load 完成，此处不提供写接口。
import request from '@/utils/request'

/**
 * 查询研判结果列表
 */
export function listYqOpinionAnalysis(query) {
  return request({
    url: '/yuqing/opinionAnalysis/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询研判结果详细
 */
export function getYqOpinionAnalysis(analysisId) {
  return request({
    url: '/yuqing/opinionAnalysis/' + analysisId,
    method: 'get'
  })
}

/**
 * 研判结果下拉选项
 */
export function optionselectYqOpinionAnalysis(params) {
  return request({
    url: '/yuqing/opinionAnalysis/optionselect',
    method: 'get',
    params
  })
}
