// ⚠ 舆情明细位于 Apache Doris（PRD §5.5），业务侧只读；
// 写入由采集/研判 Worker 经 Stream Load 完成，此处不提供写接口。
import request from '@/utils/request'

/**
 * 查询舆情明细列表
 */
export function listYqOpinion(query) {
  return request({
    url: '/yuqing/opinion/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询舆情明细详细
 */
export function getYqOpinion(opinionId) {
  return request({
    url: '/yuqing/opinion/' + opinionId,
    method: 'get'
  })
}

/**
 * 舆情明细下拉选项
 */
export function optionselectYqOpinion(params) {
  return request({
    url: '/yuqing/opinion/optionselect',
    method: 'get',
    params
  })
}
