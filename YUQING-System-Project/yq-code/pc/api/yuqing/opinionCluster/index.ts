// ⚠ 事件聚合位于 Apache Doris，业务侧只读；写入由采集/研判 Worker 经 Stream Load 完成。
import type { YqOpinionClusterForm, YqOpinionClusterQuery, YqOpinionClusterVO } from './types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 查询事件聚合列表
 */
export const listYqOpinionCluster = (query?: YqOpinionClusterQuery): AxiosPromise<PageResult<YqOpinionClusterVO>> => {
  return request({
    url: '/yuqing/opinionCluster/list',
    method: 'get',
    params: query
  });
};

/**
 * 查询事件聚合详细
 */
export const getYqOpinionCluster = (clusterId: string | number): AxiosPromise<YqOpinionClusterVO> => {
  return request({
    url: '/yuqing/opinionCluster/' + clusterId,
    method: 'get'
  });
};

/**
 * 事件聚合下拉选项
 */
export const optionselectYqOpinionCluster = (params?: any): AxiosPromise<YqOpinionClusterVO[]> => {
  return request({
    url: '/yuqing/opinionCluster/optionselect',
    method: 'get',
    params
  });
};
