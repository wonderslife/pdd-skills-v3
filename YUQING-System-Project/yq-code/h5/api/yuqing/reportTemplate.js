import request from '@/utils/request'

/**
 * 查询报告模板列表
 */
export function listYqReportTemplate(query) {
  return request({
    url: '/yuqing/reportTemplate/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询报告模板详细
 */
export function getYqReportTemplate(templateId) {
  return request({
    url: '/yuqing/reportTemplate/' + templateId,
    method: 'get'
  })
}

/**
 * 新增报告模板
 */
export function addYqReportTemplate(data) {
  return request({
    url: '/yuqing/reportTemplate',
    method: 'post',
    data
  })
}

/**
 * 修改报告模板
 */
export function updateYqReportTemplate(data) {
  return request({
    url: '/yuqing/reportTemplate',
    method: 'put',
    data
  })
}

/**
 * 删除报告模板
 */
export function delYqReportTemplate(templateId) {
  return request({
    url: '/yuqing/reportTemplate/' + templateId,
    method: 'delete'
  })
}

/**
 * 报告模板下拉选项
 */
export function optionselectYqReportTemplate(params) {
  return request({
    url: '/yuqing/reportTemplate/optionselect',
    method: 'get',
    params
  })
}
