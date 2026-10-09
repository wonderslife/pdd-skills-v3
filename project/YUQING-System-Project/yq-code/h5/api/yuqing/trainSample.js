import request from '@/utils/request'

/**
 * 查询训练样本列表
 */
export function listYqTrainSample(query) {
  return request({
    url: '/yuqing/trainSample/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询训练样本详细
 */
export function getYqTrainSample(sampleId) {
  return request({
    url: '/yuqing/trainSample/' + sampleId,
    method: 'get'
  })
}

/**
 * 新增训练样本
 */
export function addYqTrainSample(data) {
  return request({
    url: '/yuqing/trainSample',
    method: 'post',
    data
  })
}

/**
 * 修改训练样本
 */
export function updateYqTrainSample(data) {
  return request({
    url: '/yuqing/trainSample',
    method: 'put',
    data
  })
}

/**
 * 删除训练样本
 */
export function delYqTrainSample(sampleId) {
  return request({
    url: '/yuqing/trainSample/' + sampleId,
    method: 'delete'
  })
}

/**
 * 训练样本下拉选项
 */
export function optionselectYqTrainSample(params) {
  return request({
    url: '/yuqing/trainSample/optionselect',
    method: 'get',
    params
  })
}
