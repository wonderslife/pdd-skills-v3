import type { YqTrainSampleForm, YqTrainSampleQuery, YqTrainSampleVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询训练样本列表
 */
export const listYqTrainSample = (query?: YqTrainSampleQuery): AxiosPromise<PageResult<YqTrainSampleVO>> => {
  return request({
    url: '/yuqing/trainSample/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询训练样本详细
 */
export const getYqTrainSample = (sampleId: string | number): AxiosPromise<YqTrainSampleVO> => {
  return request({
    url: '/yuqing/trainSample/' + sampleId,
    method: 'get'
  });
};

/**
 * 新增训练样本
 */
export const addYqTrainSample = (data: YqTrainSampleForm): AxiosPromise => {
  return request({
    url: '/yuqing/trainSample',
    method: 'post',
    data
  });
};

/**
 * 修改训练样本
 */
export const updateYqTrainSample = (data: YqTrainSampleForm): AxiosPromise => {
  return request({
    url: '/yuqing/trainSample',
    method: 'put',
    data
  });
};

/**
 * 删除训练样本
 */
export const delYqTrainSample = (sampleId: string | number | Array<string | number>): AxiosPromise => {
  return request({
    url: '/yuqing/trainSample/' + sampleId,
    method: 'delete'
  });
};

/**
 * 训练样本下拉选项
 */
export const optionselectYqTrainSample = (params?: any): AxiosPromise<YqTrainSampleVO[]> => {
  return request({
    url: '/yuqing/trainSample/optionselect',
    method: 'get',
    params
  });
};
