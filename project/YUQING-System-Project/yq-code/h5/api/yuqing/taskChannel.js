import request from '@/utils/request'

/**
 * 查询任务渠道关联列表
 */
export function listYqTaskChannel(query) {
  return request({
    url: '/yuqing/taskChannel/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询任务渠道关联详细
 */
export function getYqTaskChannel(id) {
  return request({
    url: '/yuqing/taskChannel/' + id,
    method: 'get'
  })
}

/**
 * 新增任务渠道关联
 */
export function addYqTaskChannel(data) {
  return request({
    url: '/yuqing/taskChannel',
    method: 'post',
    data
  })
}

/**
 * 修改任务渠道关联
 */
export function updateYqTaskChannel(data) {
  return request({
    url: '/yuqing/taskChannel',
    method: 'put',
    data
  })
}

/**
 * 删除任务渠道关联
 */
export function delYqTaskChannel(id) {
  return request({
    url: '/yuqing/taskChannel/' + id,
    method: 'delete'
  })
}

/**
 * 任务渠道关联下拉选项
 */
export function optionselectYqTaskChannel(params) {
  return request({
    url: '/yuqing/taskChannel/optionselect',
    method: 'get',
    params
  })
}
