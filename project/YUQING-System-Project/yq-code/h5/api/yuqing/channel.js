import request from '@/utils/request'

/**
 * 查询采集渠道列表
 */
export function listYqChannel(query) {
  return request({
    url: '/yuqing/channel/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询采集渠道详细
 */
export function getYqChannel(channelId) {
  return request({
    url: '/yuqing/channel/' + channelId,
    method: 'get'
  })
}

/**
 * 新增采集渠道
 */
export function addYqChannel(data) {
  return request({
    url: '/yuqing/channel',
    method: 'post',
    data
  })
}

/**
 * 修改采集渠道
 */
export function updateYqChannel(data) {
  return request({
    url: '/yuqing/channel',
    method: 'put',
    data
  })
}

/**
 * 删除采集渠道
 */
export function delYqChannel(channelId) {
  return request({
    url: '/yuqing/channel/' + channelId,
    method: 'delete'
  })
}

/**
 * 采集渠道下拉选项
 */
export function optionselectYqChannel(params) {
  return request({
    url: '/yuqing/channel/optionselect',
    method: 'get',
    params
  })
}
