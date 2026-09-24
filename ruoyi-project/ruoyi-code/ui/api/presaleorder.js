import request from '@/utils/request'

// 查询PresaleOrder列表
export function listPresaleOrder(query) {
  return request({
    url: '/presale/order/list',
    method: 'get',
    params: query
  })
}

// 查询PresaleOrder详细
export function getPresaleOrder(id) {
  return request({
    url: '/presale/order/' + id,
    method: 'get'
  })
}

// 新增PresaleOrder
export function addPresaleOrder(data) {
  return request({
    url: '/presale/order',
    method: 'post',
    data: data
  })
}

// 修改PresaleOrder
export function updatePresaleOrder(data) {
  return request({
    url: '/presale/order',
    method: 'put',
    data: data
  })
}

// 删除PresaleOrder
export function delPresaleOrder(ids) {
  return request({
    url: '/presale/order/' + ids,
    method: 'delete'
  })
}
