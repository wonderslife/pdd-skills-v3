import request from '@/utils/request'

/**
 * 查询关键词分组列表
 */
export function listYqKeywordGroup(query) {
  return request({
    url: '/yuqing/keywordGroup/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询关键词分组详细
 */
export function getYqKeywordGroup(groupId) {
  return request({
    url: '/yuqing/keywordGroup/' + groupId,
    method: 'get'
  })
}

/**
 * 新增关键词分组
 */
export function addYqKeywordGroup(data) {
  return request({
    url: '/yuqing/keywordGroup',
    method: 'post',
    data
  })
}

/**
 * 修改关键词分组
 */
export function updateYqKeywordGroup(data) {
  return request({
    url: '/yuqing/keywordGroup',
    method: 'put',
    data
  })
}

/**
 * 删除关键词分组
 */
export function delYqKeywordGroup(groupId) {
  return request({
    url: '/yuqing/keywordGroup/' + groupId,
    method: 'delete'
  })
}

/**
 * 关键词分组下拉选项
 */
export function optionselectYqKeywordGroup(params) {
  return request({
    url: '/yuqing/keywordGroup/optionselect',
    method: 'get',
    params
  })
}
