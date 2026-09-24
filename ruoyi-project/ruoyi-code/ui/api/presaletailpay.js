import request from '@/utils/request'

// 查询PresaleTailPay列表
export function listPresaleTailPay(query) {
  return request({
    url: '/presale/tail/pay/list',
    method: 'get',
    params: query
  })
}

// 查询PresaleTailPay详细
export function getPresaleTailPay(id) {
  return request({
    url: '/presale/tail/pay/' + id,
    method: 'get'
  })
}

// 新增PresaleTailPay
export function addPresaleTailPay(data) {
  return request({
    url: '/presale/tail/pay',
    method: 'post',
    data: data
  })
}

// 修改PresaleTailPay
export function updatePresaleTailPay(data) {
  return request({
    url: '/presale/tail/pay',
    method: 'put',
    data: data
  })
}

// 删除PresaleTailPay
export function delPresaleTailPay(ids) {
  return request({
    url: '/presale/tail/pay/' + ids,
    method: 'delete'
  })
}
