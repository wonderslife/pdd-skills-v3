// ⚠ 采集日志位于 Apache Doris（PRD §5.5），业务侧只读；
// 写入由采集/研判 Worker 经 Stream Load 完成，此处不提供写接口。
import request from '@/utils/request'

/**
 * 查询采集日志列表
 */
export function listYqCollectLog(query) {
  return request({
    url: '/yuqing/collectLog/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询采集日志详细
 */
export function getYqCollectLog(logId) {
  return request({
    url: '/yuqing/collectLog/' + logId,
    method: 'get'
  })
}

/**
 * 采集日志下拉选项
 */
export function optionselectYqCollectLog(params) {
  return request({
    url: '/yuqing/collectLog/optionselect',
    method: 'get',
    params
  })
}
