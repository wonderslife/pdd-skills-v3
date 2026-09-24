import request from '@/utils/request'

// 查询PresaleGoods列表
export function listPresaleGoods(query) {
  return request({
    url: '/presale/goods/list',
    method: 'get',
    params: query
  })
}

// 查询PresaleGoods详细
export function getPresaleGoods(id) {
  return request({
    url: '/presale/goods/' + id,
    method: 'get'
  })
}

// 新增PresaleGoods
export function addPresaleGoods(data) {
  return request({
    url: '/presale/goods',
    method: 'post',
    data: data
  })
}

// 修改PresaleGoods
export function updatePresaleGoods(data) {
  return request({
    url: '/presale/goods',
    method: 'put',
    data: data
  })
}

// 删除PresaleGoods
export function delPresaleGoods(ids) {
  return request({
    url: '/presale/goods/' + ids,
    method: 'delete'
  })
}
