import request from '@/utils/request'

// 查询PresaleDeposit列表
export function listPresaleDeposit(query) {
  return request({
    url: '/presale/deposit/list',
    method: 'get',
    params: query
  })
}

// 查询PresaleDeposit详细
export function getPresaleDeposit(id) {
  return request({
    url: '/presale/deposit/' + id,
    method: 'get'
  })
}

// 新增PresaleDeposit
export function addPresaleDeposit(data) {
  return request({
    url: '/presale/deposit',
    method: 'post',
    data: data
  })
}

// 修改PresaleDeposit
export function updatePresaleDeposit(data) {
  return request({
    url: '/presale/deposit',
    method: 'put',
    data: data
  })
}

// 删除PresaleDeposit
export function delPresaleDeposit(ids) {
  return request({
    url: '/presale/deposit/' + ids,
    method: 'delete'
  })
}
