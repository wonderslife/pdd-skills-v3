import request from '@/utils/request'

/**
 * 扫码解析：二维码内容（URL 或密文）-> 点位详情
 * 后端会校验点位状态、归属与本周期是否已巡检
 * @param {string} content 二维码内容或手动输入的点位编码
 */
export function resolveInspectScan(content) {
  return request({
    url: '/inspect/scan/resolve',
    method: 'post',
    data: { content },
  })
}
