/**
 * 舆情监测平台 H5 端字典映射
 *
 * 取值与 sys_dict_data 中的 yq_* 字典项严格一致（见 script/sql/yuqing/yq_dict.sql）。
 * 移动端不加载全部字典，只映射移动端会展示的枚举，减小包体。
 */

/** 任务类型 yq_task_type */
export const TASK_TYPE_MAP = {
  normal: '常态化',
  temporary: '临时',
  special: '专项',
}

/** 任务来源 yq_task_source */
export const TASK_SOURCE_MAP = {
  pc: 'PC后台',
  wecom: '企业微信',
}

/** 采集策略 yq_collect_strategy */
export const COLLECT_STRATEGY_MAP = {
  polling: '定时轮询',
  incremental: '增量抓取',
  realtime: '实时监听',
}

/** 舆情属性 yq_senti_attr */
export const SENTI_ATTR_MAP = {
  positive: '正面',
  neutral: '中性',
  negative: '负面',
}

/** 舆情分级 yq_opinion_level */
export const OPINION_LEVEL_MAP = {
  normal: '一般',
  attention: '关注',
  warning: '预警',
  urgent: '紧急',
}

/** 风险等级 yq_risk_level */
export const RISK_LEVEL_MAP = {
  general: '一般',
  moderate: '较重',
  severe: '严重',
}

/** 传播量级 yq_spread_level */
export const SPREAD_LEVEL_MAP = {
  low: '低',
  medium: '中',
  high: '高',
  viral: '爆',
}

/** 研判状态 yq_analyze_status */
export const ANALYZE_STATUS_MAP = {
  pending: '待研判',
  processing: '研判中',
  completed: '已完成',
  failed: '已失败',
}

/** 清洗状态 yq_clean_status */
export const CLEAN_STATUS_MAP = {
  raw: '原始',
  cleaned: '已净化',
  rejected: '已剔除',
}

/** 预警级别 yq_alert_level */
export const ALERT_LEVEL_MAP = {
  info: '提示',
  attention: '关注',
  warning: '预警',
  urgent: '紧急',
}

/** 预警处置状态 yq_alert_status */
export const ALERT_STATUS_MAP = {
  pending: '未处置',
  processing: '处置中',
  handled: '已处置',
  ignored: '已忽略',
}

/** 触发场景 yq_alert_scene */
export const ALERT_SCENE_MAP = {
  new_negative: '新增负面',
  high_risk: '高风险',
  burst_increment: '突发增量',
  special_topic: '重点专项',
}

/** 推送级别 yq_push_level */
export const PUSH_LEVEL_MAP = {
  immediate: '即时',
  scheduled: '定时批量',
}

/** 推送场景 yq_push_scene */
export const PUSH_SCENE_MAP = {
  new_opinion: '新增舆情',
  high_risk: '高风险舆情',
  batch_completed: '批量研判完成',
  report_ready: '报告生成完成',
}

/** 报告类型 yq_report_type */
export const REPORT_TYPE_MAP = {
  flash: '快报',
  daily: '日报',
  monthly: '月报',
  special: '专项',
}

/** 报告状态 yq_report_status */
export const REPORT_STATUS_MAP = {
  generating: '生成中',
  generated: '已生成',
  published: '已提交',
  failed: '生成失败',
}

/** 报告提交状态 yq_report_submit_status */
export const SUBMIT_STATUS_MAP = {
  unsubmitted: '未提交',
  submitted: '已提交',
}

/** 指令类型 yq_command_type */
export const COMMAND_TYPE_MAP = {
  gen_report: '生成报告',
  create_task: '发布任务',
  query_opinion: '查询舆情',
  set_rule: '调整规则',
}

/** 指令执行状态 yq_exec_status */
export const EXEC_STATUS_MAP = {
  pending: '待执行',
  success: '成功',
  failed: '失败',
}

/** 枚举值转中文标签，未命中回退原值 */
export function labelOf(map, value) {
  if (value == null || value === '') return '-'
  return (map && map[value]) || value
}

/** 多值（逗号分隔）转中文，如 "immediate,scheduled" */
export function labelsOf(map, value) {
  if (value == null || value === '') return '-'
  return String(value)
    .split(',')
    .filter(Boolean)
    .map((v) => labelOf(map, v))
    .join('、')
}

/**
 * 语义色 —— 供标签样式绑定
 * danger(红) / warning(橙) / success(绿) / info(灰)
 */
export function sentiClass(v) {
  if (v === 'negative') return 'danger'
  if (v === 'positive') return 'success'
  return 'info'
}

export function levelClass(v) {
  if (v === 'urgent') return 'danger'
  if (v === 'warning') return 'warning'
  if (v === 'attention') return 'info'
  return 'success'
}

export function riskClass(v) {
  if (v === 'severe') return 'danger'
  if (v === 'moderate') return 'warning'
  return 'success'
}

export function alertStatusClass(v) {
  if (v === 'pending') return 'danger'
  if (v === 'processing') return 'warning'
  if (v === 'handled') return 'success'
  return 'info'
}

export function reportStatusClass(v) {
  if (v === 'failed') return 'danger'
  if (v === 'generating') return 'warning'
  if (v === 'generated') return 'info'
  if (v === 'published') return 'success'
  return 'info'
}

/** 任务状态（0正常 1停用），非字典表字段 */
export function taskStatusLabel(v) {
  return v === '1' || v === 1 ? '停用' : '正常'
}
