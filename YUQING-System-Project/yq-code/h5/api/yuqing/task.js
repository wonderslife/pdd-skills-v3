import request from '@/utils/request'

/**
 * 查询监测任务列表
 */
export function listYqTask(query) {
  return request({
    url: '/yuqing/task/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询监测任务详细
 */
export function getYqTask(taskId) {
  return request({
    url: '/yuqing/task/' + taskId,
    method: 'get'
  })
}

/**
 * 新增监测任务
 */
export function addYqTask(data) {
  return request({
    url: '/yuqing/task',
    method: 'post',
    data
  })
}

/**
 * 修改监测任务
 */
export function updateYqTask(data) {
  return request({
    url: '/yuqing/task',
    method: 'put',
    data
  })
}

/**
 * 删除监测任务
 */
export function delYqTask(taskId) {
  return request({
    url: '/yuqing/task/' + taskId,
    method: 'delete'
  })
}

/**
 * 监测任务下拉选项
 */
export function optionselectYqTask(params) {
  return request({
    url: '/yuqing/task/optionselect',
    method: 'get',
    params
  })
}
