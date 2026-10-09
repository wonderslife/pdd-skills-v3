import request from '@/utils/request'

/**
 * 查询台账导出记录列表
 */
export function listYqLedgerExportLog(query) {
  return request({
    url: '/yuqing/ledgerExportLog/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询台账导出记录详细
 */
export function getYqLedgerExportLog(exportId) {
  return request({
    url: '/yuqing/ledgerExportLog/' + exportId,
    method: 'get'
  })
}

/**
 * 新增台账导出记录
 */
export function addYqLedgerExportLog(data) {
  return request({
    url: '/yuqing/ledgerExportLog',
    method: 'post',
    data
  })
}

/**
 * 修改台账导出记录
 */
export function updateYqLedgerExportLog(data) {
  return request({
    url: '/yuqing/ledgerExportLog',
    method: 'put',
    data
  })
}

/**
 * 删除台账导出记录
 */
export function delYqLedgerExportLog(exportId) {
  return request({
    url: '/yuqing/ledgerExportLog/' + exportId,
    method: 'delete'
  })
}

/**
 * 台账导出记录下拉选项
 */
export function optionselectYqLedgerExportLog(params) {
  return request({
    url: '/yuqing/ledgerExportLog/optionselect',
    method: 'get',
    params
  })
}
