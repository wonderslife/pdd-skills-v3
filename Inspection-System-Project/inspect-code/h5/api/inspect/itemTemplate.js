import request from '@/utils/request'

/**
 * 查询巡检项模板列表
 */
export function listInspectItemTemplate(query) {
  return request({
    url: '/inspect/itemTemplate/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询巡检项模板详细
 */
export function getInspectItemTemplate(templateId) {
  return request({
    url: '/inspect/itemTemplate/' + templateId,
    method: 'get'
  })
}

/**
 * 新增巡检项模板
 */
export function addInspectItemTemplate(data) {
  return request({
    url: '/inspect/itemTemplate',
    method: 'post',
    data
  })
}

/**
 * 修改巡检项模板
 */
export function updateInspectItemTemplate(data) {
  return request({
    url: '/inspect/itemTemplate',
    method: 'put',
    data
  })
}

/**
 * 删除巡检项模板
 */
export function delInspectItemTemplate(templateId) {
  return request({
    url: '/inspect/itemTemplate/' + templateId,
    method: 'delete'
  })
}

/**
 * 巡检项模板下拉选项
 */
export function optionselectInspectItemTemplate(params) {
  return request({
    url: '/inspect/itemTemplate/optionselect',
    method: 'get',
    params
  })
}
