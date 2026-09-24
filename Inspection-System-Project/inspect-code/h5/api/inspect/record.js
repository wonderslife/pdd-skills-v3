import request from '@/utils/request'

/**
 * 本人巡检记录（H5「我的记录」）
 */
export function listMyInspectRecord(query) {
  return request({
    url: '/inspect/record/my',
    method: 'get',
    params: query,
  })
}

/**
 * 巡检记录详情（含巡检项结果与照片 URL）
 */
export function getInspectRecord(recordId) {
  return request({
    url: `/inspect/record/${recordId}`,
    method: 'get',
  })
}

/**
 * 提交巡检记录（H5 现场扫码提交）
 * @param {object} data { pointId, duration, remark, itemResults: [{ itemId, itemName, result, value, description, orderNum, photos: [{originalUrl, originalSize, compressedUrl, compressedSize, fileName}] }] }
 */
export function submitInspectRecord(data) {
  return request({
    url: '/inspect/record/submit',
    method: 'post',
    data,
  })
}
