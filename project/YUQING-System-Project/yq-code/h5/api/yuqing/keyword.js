import request from '@/utils/request'

/**
 * 查询关键词列表
 */
export function listYqKeyword(query) {
  return request({
    url: '/yuqing/keyword/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询关键词详细
 */
export function getYqKeyword(keywordId) {
  return request({
    url: '/yuqing/keyword/' + keywordId,
    method: 'get'
  })
}

/**
 * 新增关键词
 */
export function addYqKeyword(data) {
  return request({
    url: '/yuqing/keyword',
    method: 'post',
    data
  })
}

/**
 * 修改关键词
 */
export function updateYqKeyword(data) {
  return request({
    url: '/yuqing/keyword',
    method: 'put',
    data
  })
}

/**
 * 删除关键词
 */
export function delYqKeyword(keywordId) {
  return request({
    url: '/yuqing/keyword/' + keywordId,
    method: 'delete'
  })
}

/**
 * 关键词下拉选项
 */
export function optionselectYqKeyword(params) {
  return request({
    url: '/yuqing/keyword/optionselect',
    method: 'get',
    params
  })
}
