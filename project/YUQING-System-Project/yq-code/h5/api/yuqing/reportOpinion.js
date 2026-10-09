import request from '@/utils/request'

/**
 * 查询报告舆情关联列表
 */
export function listYqReportOpinion(query) {
  return request({
    url: '/yuqing/reportOpinion/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询报告舆情关联详细
 */
export function getYqReportOpinion(id) {
  return request({
    url: '/yuqing/reportOpinion/' + id,
    method: 'get'
  })
}

/**
 * 新增报告舆情关联
 */
export function addYqReportOpinion(data) {
  return request({
    url: '/yuqing/reportOpinion',
    method: 'post',
    data
  })
}

/**
 * 修改报告舆情关联
 */
export function updateYqReportOpinion(data) {
  return request({
    url: '/yuqing/reportOpinion',
    method: 'put',
    data
  })
}

/**
 * 删除报告舆情关联
 */
export function delYqReportOpinion(id) {
  return request({
    url: '/yuqing/reportOpinion/' + id,
    method: 'delete'
  })
}

/**
 * 报告舆情关联下拉选项
 */
export function optionselectYqReportOpinion(params) {
  return request({
    url: '/yuqing/reportOpinion/optionselect',
    method: 'get',
    params
  })
}
