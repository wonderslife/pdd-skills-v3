import request from '@/utils/request'

/**
 * 查询模板明细列表
 */
export function listInspectItemTemplateDetail(query) {
  return request({
    url: '/inspect/itemTemplateDetail/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询模板明细详细
 */
export function getInspectItemTemplateDetail(detailId) {
  return request({
    url: '/inspect/itemTemplateDetail/' + detailId,
    method: 'get'
  })
}

/**
 * 新增模板明细
 */
export function addInspectItemTemplateDetail(data) {
  return request({
    url: '/inspect/itemTemplateDetail',
    method: 'post',
    data
  })
}

/**
 * 修改模板明细
 */
export function updateInspectItemTemplateDetail(data) {
  return request({
    url: '/inspect/itemTemplateDetail',
    method: 'put',
    data
  })
}

/**
 * 删除模板明细
 */
export function delInspectItemTemplateDetail(detailId) {
  return request({
    url: '/inspect/itemTemplateDetail/' + detailId,
    method: 'delete'
  })
}

/**
 * 模板明细下拉选项
 */
export function optionselectInspectItemTemplateDetail(params) {
  return request({
    url: '/inspect/itemTemplateDetail/optionselect',
    method: 'get',
    params
  })
}
