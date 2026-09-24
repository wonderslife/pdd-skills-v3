import request from '@/utils/request'

/**
 * 查询推送记录列表
 */
export function listYqPushRecord(query) {
  return request({
    url: '/yuqing/pushRecord/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询推送记录详细
 */
export function getYqPushRecord(recordId) {
  return request({
    url: '/yuqing/pushRecord/' + recordId,
    method: 'get'
  })
}

/**
 * 新增推送记录
 */
export function addYqPushRecord(data) {
  return request({
    url: '/yuqing/pushRecord',
    method: 'post',
    data
  })
}

/**
 * 修改推送记录
 */
export function updateYqPushRecord(data) {
  return request({
    url: '/yuqing/pushRecord',
    method: 'put',
    data
  })
}

/**
 * 删除推送记录
 */
export function delYqPushRecord(recordId) {
  return request({
    url: '/yuqing/pushRecord/' + recordId,
    method: 'delete'
  })
}

/**
 * 推送记录下拉选项
 */
export function optionselectYqPushRecord(params) {
  return request({
    url: '/yuqing/pushRecord/optionselect',
    method: 'get',
    params
  })
}
