import request from '@/utils/request'

/**
 * 手动触发预警扫描（落库）
 */
export function scanAlert(data) {
  return request({
    url: '/yuqing/alert/scan',
    method: 'post',
    data: data || {}
  })
}

/**
 * 预览预警命中（不落库）
 */
export function previewAlert(data) {
  return request({
    url: '/yuqing/alert/preview',
    method: 'post',
    data: data || {}
  })
}

/**
 * 处置预警（已处置/已忽略必须填说明，服务端强校验）
 */
export function processAlert(data) {
  return request({
    url: '/yuqing/alert/process',
    method: 'post',
    data
  })
}

/**
 * 未处置计数
 */
export function alertPendingCount() {
  return request({
    url: '/yuqing/alert/pendingCount',
    method: 'get'
  })
}
