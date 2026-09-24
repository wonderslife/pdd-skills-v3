import request from '@/utils/request'

/**
 * 查询舆情报告列表
 */
export function listYqReport(query) {
  return request({
    url: '/yuqing/report/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询舆情报告详细
 */
export function getYqReport(reportId) {
  return request({
    url: '/yuqing/report/' + reportId,
    method: 'get'
  })
}

/**
 * 新增舆情报告
 */
export function addYqReport(data) {
  return request({
    url: '/yuqing/report',
    method: 'post',
    data
  })
}

/**
 * 修改舆情报告
 */
export function updateYqReport(data) {
  return request({
    url: '/yuqing/report',
    method: 'put',
    data
  })
}

/**
 * 删除舆情报告
 */
export function delYqReport(reportId) {
  return request({
    url: '/yuqing/report/' + reportId,
    method: 'delete'
  })
}

/**
 * 舆情报告下拉选项
 */
export function optionselectYqReport(params) {
  return request({
    url: '/yuqing/report/optionselect',
    method: 'get',
    params
  })
}
