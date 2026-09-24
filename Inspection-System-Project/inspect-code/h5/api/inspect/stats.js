import request from '@/utils/request'

/**
 * 未处理异常数（登录后首页弹窗提示）
 */
export function getInspectAbnormalCount(roomId) {
  return request({
    url: '/inspect/stats/abnormalCount',
    method: 'get',
    params: { roomId },
  })
}
