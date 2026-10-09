import request from '@/utils/request'

/**
 * 查询知识库案例列表
 */
export function listYqKnowledge(query) {
  return request({
    url: '/yuqing/knowledge/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询知识库案例详细
 */
export function getYqKnowledge(knowledgeId) {
  return request({
    url: '/yuqing/knowledge/' + knowledgeId,
    method: 'get'
  })
}

/**
 * 新增知识库案例
 */
export function addYqKnowledge(data) {
  return request({
    url: '/yuqing/knowledge',
    method: 'post',
    data
  })
}

/**
 * 修改知识库案例
 */
export function updateYqKnowledge(data) {
  return request({
    url: '/yuqing/knowledge',
    method: 'put',
    data
  })
}

/**
 * 删除知识库案例
 */
export function delYqKnowledge(knowledgeId) {
  return request({
    url: '/yuqing/knowledge/' + knowledgeId,
    method: 'delete'
  })
}

/**
 * 知识库案例下拉选项
 */
export function optionselectYqKnowledge(params) {
  return request({
    url: '/yuqing/knowledge/optionselect',
    method: 'get',
    params
  })
}
