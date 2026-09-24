import request from '@/utils/request'

/**
 * 查询标签列表
 */
export function listYqTag(query) {
  return request({
    url: '/yuqing/tag/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询标签详细
 */
export function getYqTag(tagId) {
  return request({
    url: '/yuqing/tag/' + tagId,
    method: 'get'
  })
}

/**
 * 新增标签
 */
export function addYqTag(data) {
  return request({
    url: '/yuqing/tag',
    method: 'post',
    data
  })
}

/**
 * 修改标签
 */
export function updateYqTag(data) {
  return request({
    url: '/yuqing/tag',
    method: 'put',
    data
  })
}

/**
 * 删除标签
 */
export function delYqTag(tagId) {
  return request({
    url: '/yuqing/tag/' + tagId,
    method: 'delete'
  })
}

/**
 * 标签下拉选项
 */
export function optionselectYqTag(params) {
  return request({
    url: '/yuqing/tag/optionselect',
    method: 'get',
    params
  })
}
