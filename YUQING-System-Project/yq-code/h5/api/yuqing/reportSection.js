import request from '@/utils/request'

/**
 * 查询报告模板章节列表
 */
export function listYqReportSection(query) {
  return request({
    url: '/yuqing/reportSection/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询报告模板章节详细
 */
export function getYqReportSection(sectionId) {
  return request({
    url: '/yuqing/reportSection/' + sectionId,
    method: 'get'
  })
}

/**
 * 新增报告模板章节
 */
export function addYqReportSection(data) {
  return request({
    url: '/yuqing/reportSection',
    method: 'post',
    data
  })
}

/**
 * 修改报告模板章节
 */
export function updateYqReportSection(data) {
  return request({
    url: '/yuqing/reportSection',
    method: 'put',
    data
  })
}

/**
 * 删除报告模板章节
 */
export function delYqReportSection(sectionId) {
  return request({
    url: '/yuqing/reportSection/' + sectionId,
    method: 'delete'
  })
}

/**
 * 报告模板章节下拉选项
 */
export function optionselectYqReportSection(params) {
  return request({
    url: '/yuqing/reportSection/optionselect',
    method: 'get',
    params
  })
}
