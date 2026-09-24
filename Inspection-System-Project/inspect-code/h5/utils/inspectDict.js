/**
 * 机房巡检系统 - 字典映射
 * <p>
 * H5 端不额外请求字典接口，统一使用本文件的映射（与后端 insp_dict.sql 保持一致）。
 * 修改字典时需同步 insp_dict.sql 与本文件。
 */

/** 巡检周期类型 */
export const CYCLE_TYPE_MAP = {
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
  custom: '自定义间隔',
}

/** 点位状态 */
export const POINT_STATUS_MAP = {
  active: '启用',
  inactive: '停用',
  maintenance: '维护中',
}

/** 点位状态标签色（uview-plus tag 的 type） */
export const POINT_STATUS_TAG = {
  active: 'success',
  inactive: 'info',
  maintenance: 'warning',
}

/** 巡检项判定结果 */
export const ITEM_RESULT_MAP = {
  normal: '正常',
  abnormal: '异常',
  na: '不适用',
}

/** 巡检记录结果 */
export const RECORD_RESULT_MAP = {
  pending: '待巡检',
  in_progress: '巡检中',
  completed_normal: '已完成(正常)',
  completed_abnormal: '已完成(异常)',
  overdue: '已逾期',
}

/** 巡检数据来源 */
export const RECORD_SOURCE_MAP = {
  h5_scan: '扫码巡检',
  pc_supplement: 'PC补录',
}

/** 异常项处理状态 */
export const ABNORMAL_STATUS_MAP = {
  pending: '待处理',
  processed: '已处理',
}

/** 巡检项类型 */
export const ITEM_TYPE_MAP = {
  radio: '单选',
  number: '数值',
  text: '文本',
}

export function labelOf(map, value) {
  if (value === null || value === undefined || value === '') return '-'
  return map[value] || value
}
