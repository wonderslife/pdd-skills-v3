import request from '@/utils/request'

/**
 * 查询任务关键词关联列表
 */
export function listYqTaskKeyword(query) {
  return request({
    url: '/yuqing/taskKeyword/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询任务关键词关联详细
 */
export function getYqTaskKeyword(id) {
  return request({
    url: '/yuqing/taskKeyword/' + id,
    method: 'get'
  })
}

/**
 * 新增任务关键词关联
 */
export function addYqTaskKeyword(data) {
  return request({
    url: '/yuqing/taskKeyword',
    method: 'post',
    data
  })
}

/**
 * 修改任务关键词关联
 */
export function updateYqTaskKeyword(data) {
  return request({
    url: '/yuqing/taskKeyword',
    method: 'put',
    data
  })
}

/**
 * 删除任务关键词关联
 */
export function delYqTaskKeyword(id) {
  return request({
    url: '/yuqing/taskKeyword/' + id,
    method: 'delete'
  })
}

/**
 * 任务关键词关联下拉选项
 */
export function optionselectYqTaskKeyword(params) {
  return request({
    url: '/yuqing/taskKeyword/optionselect',
    method: 'get',
    params
  })
}
