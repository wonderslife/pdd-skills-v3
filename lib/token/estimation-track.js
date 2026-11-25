// lib/token/estimation-track.js - 预算估算轨（FP-TOKO-002 / doc 05 §3.3.1、路线图 T0）
//
// 职责（FP-TOKO-002 §3.1 处理流程）：
//   1. 内容进入 → 2. 按 profile 分段估算（R1：禁字符直报，一切估算经 FP-TOKO-001 系数）→
//   3. 写入 consumption-record（source=estimated）→ 4. 阶段内累计并与阶段预算比较 →
//   5. 实测回填覆盖同记录（source=measured，R1：不并存双主值）→
//   6. 输出阶段分布与估算/实测偏差报告（R3：偏差 >10% 建议复标）。
//
// 红线（§1.2 / R2）：
//   - lib/token/budget-manager.js 类签名零改动，本模块为外部记账模块（只读消费 PHASES 枚举）；
//   - 沿用既有 DEFAULT_ALLOCATION（20/15/40/15/10）与预警阈值（0.8/0.95）——
//     budget-manager 未导出 DEFAULT_ALLOCATION，故以镜像常量复刻，数值由单测 I3 审计锚定；
//   - R4：记录为会话内存态（Map），不落盘持久化，跨会话统计为后续独立能力。

import crypto from 'crypto';
import { loadProfile, FALLBACK_PROFILE_ID } from '../streaming/profiles/index.js';
import { segmentContent, measureSegment, estimateTokensFromSegments } from '../streaming/segment.js';
// 只读消费：phase 枚举与 budget-manager PHASES 值严格一致（T2），不修改其任何导出
import { PHASES } from './budget-manager.js';

/** 阶段分配比例镜像（= budget-manager 私有 DEFAULT_ALLOCATION，I3 数值审计锚点：20/15/40/15/10） */
export const PHASE_ALLOCATION_RATIOS = {
  [PHASES.ANALYSIS]: 0.20,
  [PHASES.DESIGN]: 0.15,
  [PHASES.IMPLEMENTATION]: 0.40,
  [PHASES.REVIEW]: 0.15,
  [PHASES.VERIFICATION]: 0.10
};

/** 默认总预算（= budget-manager 构造默认值） */
export const DEFAULT_TOTAL_BUDGET = 100000;

/** 预警/阻断阈值（= budget-manager 构造默认值 warningThreshold/criticalThreshold） */
export const WARNING_THRESHOLD = 0.8;
export const CRITICAL_THRESHOLD = 0.95;

/** R3：估算/实测偏差超过此比例触发 profile 复标建议（对接 FP-TOKO-001 PROFILE_STALE） */
export const DEVIATION_RECALIBRATION_THRESHOLD = 0.10;

/** content_type 枚举（§2.1） */
export const CONTENT_TYPES = ['zh', 'en', 'code', 'mixed'];

/** source 枚举（§2.2：实测优先，估算兜底） */
export const SOURCES = ['estimated', 'measured'];

/** RFC3339 时间戳格式校验（§2.1 ts 必填） */
const RFC3339_RE = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

/** 会话内存态存储（R4：不落盘）——sessionId → consumption-record[] */
const sessions = new Map();

// ==================== 估算轨入口 ====================

/**
 * 估算轨入口（FP-TOKO-002 §1.1）：经 FP-TOKO-001 profile 系数计算
 *
 * 行为约定：
 * - contentType = zh/en/code：对应分量口径计量（与 segmentContent 同口径）；
 * - contentType = mixed：全文 zh/en/code 分段后套系数求和；
 * - family 无 profile（ESTIMATE_WITHOUT_PROFILE）→ 经 loadProfile 降级 openai 并在结果标注
 *   fallback / tokenizer_profile = "openai(fallback)"，记录写入时保留标注（T4）；
 * - PROFILE_STALE → 透传 stale 标注（报告中标注，不阻断）。
 *
 * @param {string} content - 原始内容
 * @param {'zh'|'en'|'code'|'mixed'} contentType - 内容类型
 * @param {string} family - tokenizer family
 * @returns {{tokens_est:number, content_type:string, family_requested:string,
 *            profile_used:string, fallback:boolean, tokenizer_profile?:string,
 *            stale?:boolean, segments:{zh:number,en:number,code:number}}}
 * @throws {Error} ESTIMATE_INVALID_CONTENT / ESTIMATE_INVALID_CONTENT_TYPE / ESTIMATE_INVALID_FAMILY
 */
export function estimateTokens(content, contentType, family) {
  if (typeof content !== 'string') {
    throw new Error(`ESTIMATE_INVALID_CONTENT: content 必须为字符串，得到 ${typeof content}`);
  }
  if (!CONTENT_TYPES.includes(contentType)) {
    throw new Error(`ESTIMATE_INVALID_CONTENT_TYPE: contentType 必须为 ${CONTENT_TYPES.join('/')}，得到 ${contentType}`);
  }
  if (typeof family !== 'string' || family.length === 0) {
    throw new Error(`ESTIMATE_INVALID_FAMILY: family 必须为非空字符串，得到 ${typeof family}`);
  }

  const profile = loadProfile(family);
  const segments = contentType === 'mixed' ? segmentContent(content) : measureSegment(content, contentType);
  const tokens_est = estimateTokensFromSegments(segments, profile);
  const fallback = profile.tokenizer_profile === FALLBACK_PROFILE_ID;

  return {
    tokens_est,
    content_type: contentType,
    family_requested: family,
    profile_used: profile.family,
    fallback,
    ...(fallback ? { tokenizer_profile: FALLBACK_PROFILE_ID, notice: 'ESTIMATE_WITHOUT_PROFILE' } : {}),
    ...(profile.stale ? { stale: true } : {}),
    segments
  };
}

// ==================== 消耗记录 ====================

/**
 * 校验 consumption-record（§2.1 Schema；T1 8 字段齐备、枚举合法）
 * @private
 * @param {*} record
 * @returns {string[]} 错误列表（空数组 = 合法）
 */
function validateRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return ['record 必须为对象'];
  }
  if (typeof record.session_id !== 'string' || record.session_id.length === 0) {
    errors.push('session_id 必须为非空字符串');
  }
  if (!Object.values(PHASES).includes(record.phase)) {
    errors.push(`phase 必须为 ${Object.values(PHASES).join('/')}，得到 ${record.phase}`);
  }
  if (typeof record.tokens_est !== 'number' || !Number.isFinite(record.tokens_est) || record.tokens_est < 0) {
    errors.push(`tokens_est 必须为非负有限数字，得到 ${record.tokens_est}`);
  }
  if (!SOURCES.includes(record.source)) {
    errors.push(`source 必须为 ${SOURCES.join('/')}，得到 ${record.source}`);
  }
  if (!CONTENT_TYPES.includes(record.content_type)) {
    errors.push(`content_type 必须为 ${CONTENT_TYPES.join('/')}，得到 ${record.content_type}`);
  }
  if (typeof record.family !== 'string' || record.family.length === 0) {
    errors.push('family 必须为非空字符串');
  }
  if (typeof record.ts !== 'string' || !RFC3339_RE.test(record.ts) || Number.isNaN(Date.parse(record.ts))) {
    errors.push(`ts 必须为 RFC3339 时间字符串，得到 ${record.ts}`);
  }
  // tokens_measured / artifact_ref 可选
  if (record.tokens_measured !== undefined) {
    if (typeof record.tokens_measured !== 'number' || !Number.isFinite(record.tokens_measured) || record.tokens_measured < 0) {
      errors.push(`tokens_measured 必须为非负有限数字，得到 ${record.tokens_measured}`);
    }
  }
  if (record.artifact_ref !== undefined && (typeof record.artifact_ref !== 'string' || record.artifact_ref.length === 0)) {
    errors.push('artifact_ref 必须为非空字符串');
  }
  // R1 状态机（§3.3）：estimated 记录不得携带实测主值；measured 记录必须携带实测主值
  if (record.source === 'estimated' && record.tokens_measured !== undefined) {
    errors.push('R1: source=estimated 的记录不得携带 tokens_measured（实测须经 backfillMeasured 覆盖回填）');
  }
  if (record.source === 'measured' && record.tokens_measured === undefined) {
    errors.push('R1: source=measured 的记录必须携带 tokens_measured（主值）');
  }
  return errors;
}

/**
 * 写入消耗记录（FP-TOKO-002 §1.1：估算轨先行，实测轨由 FP-TOKO-008 回填）
 *
 * - 必填字段缺失/枚举非法 → RECORD_MALFORMED，拒绝写入并 WARN；
 * - 分配 record_id（实测回填按此定位同记录，R1）；
 * - 会话内存态（R4），不落盘。
 *
 * @param {Object} record - §2.1 consumption-record
 * @returns {Object} 存储后的记录（含 record_id）
 * @throws {Error} RECORD_MALFORMED（err.code / err.reasons）
 */
export function recordConsumption(record) {
  const errors = validateRecord(record);
  if (errors.length > 0) {
    console.warn(`[RECORD_MALFORMED] 拒绝写入消耗记录: ${errors.join('; ')}`);
    const err = new Error(`RECORD_MALFORMED: ${errors.join('; ')}`);
    err.code = 'RECORD_MALFORMED';
    err.reasons = errors;
    throw err;
  }

  // 显式占位可选键位（§2.1 Schema 自描述：estimated 记录 tokens_measured 为 undefined）
  const stored = {
    ...record,
    tokens_measured: record.tokens_measured,
    artifact_ref: record.artifact_ref,
    record_id: crypto.randomUUID()
  };
  let list = sessions.get(record.session_id);
  if (!list) {
    list = [];
    sessions.set(record.session_id, list);
  }
  list.push(stored);
  return stored;
}

/**
 * 实测回填（FP-TOKO-006 usage 事件 / FP-TOKO-008 实测轨写入入口）
 *
 * R1：同一记录实测覆盖估算（source: estimated → measured），不并存双主值；
 * tokens_est 保留用于偏差核算（R3），但主值以 source=measured 为准。
 *
 * @param {string} sessionId
 * @param {string} recordId - recordConsumption 返回的 record_id
 * @param {number} tokensMeasured - 供应商 usage 实测 token 数
 * @param {string} [measuredAt] - 回填时间（RFC3339，默认当前时间）
 * @returns {Object} 更新后的记录
 * @throws {Error} RECORD_NOT_FOUND / RECORD_MALFORMED（tokensMeasured 非法时）
 */
export function backfillMeasured(sessionId, recordId, tokensMeasured, measuredAt) {
  if (typeof tokensMeasured !== 'number' || !Number.isFinite(tokensMeasured) || tokensMeasured < 0) {
    const err = new Error(`RECORD_MALFORMED: tokens_measured 必须为非负有限数字，得到 ${tokensMeasured}`);
    err.code = 'RECORD_MALFORMED';
    throw err;
  }
  const record = findRecord(sessionId, recordId);
  if (!record) {
    throw new Error(`RECORD_NOT_FOUND: session=${sessionId} 中不存在记录 ${recordId}`);
  }
  record.tokens_measured = tokensMeasured;
  record.source = 'measured';
  record.measured_at = measuredAt || new Date().toISOString();
  return record;
}

/**
 * 按主值取记录 token 数（R1：source=measured 取实测，否则取估算）
 * @private
 */
function primaryTokens(record) {
  return record.source === 'measured' ? record.tokens_measured : record.tokens_est;
}

/**
 * 定位单条记录
 * @private
 */
function findRecord(sessionId, recordId) {
  const list = sessions.get(sessionId);
  if (!list) return null;
  return list.find(r => r.record_id === recordId) || null;
}

// ==================== 分布与偏差报告 ====================

/**
 * 单阶段状态（镜像 budget-manager _getPhaseStatus 语义，口径一致）
 * @private
 */
function phaseStatus(usagePercent) {
  if (usagePercent >= 1) return 'exceeded';
  if (usagePercent >= 0.9) return 'critical';
  if (usagePercent >= 0.75) return 'warning';
  if (usagePercent > 0) return 'active';
  return 'idle';
}

/**
 * 输出 5 阶段消耗分布与偏差报告（FP-TOKO-002 §1.1 / §3.1 步骤 4、6）
 *
 * - 阶段预算 = totalBudget × PHASE_ALLOCATION_RATIOS（沿用 DEFAULT_ALLOCATION 20/15/40/15/10，I3）；
 * - 主值口径：source=measured 记录取实测，estimated 记录取估算（R1 单主值）；
 * - R3：按 family 核算估算/实测偏差，>10% 输出复标建议（对接 PROFILE_STALE）；
 * - §3.3：无 usage 回填时保持 estimated 并在报告标注。
 *
 * @param {string} sessionId
 * @param {Object} [options]
 * @param {number} [options.totalBudget=DEFAULT_TOTAL_BUDGET] - 总预算（阶段预算按比例折算）
 * @returns {Object} 阶段分布报告
 */
export function getPhaseDistribution(sessionId, options = {}) {
  const records = sessions.get(sessionId) || [];
  const totalBudget = typeof options.totalBudget === 'number' && options.totalBudget > 0
    ? options.totalBudget
    : DEFAULT_TOTAL_BUDGET;

  const phases = {};
  for (const phase of Object.values(PHASES)) {
    const phaseRecords = records.filter(r => r.phase === phase);
    const tokensEst = phaseRecords.reduce((s, r) => s + r.tokens_est, 0);
    const tokensMeasured = phaseRecords.reduce((s, r) => s + (r.tokens_measured || 0), 0);
    const primary = phaseRecords.reduce((s, r) => s + primaryTokens(r), 0);
    const budget = Math.floor(totalBudget * PHASE_ALLOCATION_RATIOS[phase]);
    const usagePercent = budget > 0 ? primary / budget : 0;
    phases[phase] = {
      budget,
      records: phaseRecords.length,
      tokens_est: tokensEst,
      tokens_measured: tokensMeasured,
      primary_tokens: primary,
      usage_percent: Math.round(usagePercent * 10000) / 100,
      status: phaseStatus(usagePercent)
    };
  }

  const totals = {
    records: records.length,
    measured_records: records.filter(r => r.source === 'measured').length,
    tokens_est: records.reduce((s, r) => s + r.tokens_est, 0),
    tokens_measured: records.reduce((s, r) => s + (r.tokens_measured || 0), 0),
    primary_tokens: records.reduce((s, r) => s + primaryTokens(r), 0)
  };

  // R3：按 family 核算估算/实测偏差（仅对已有实测回填的记录）
  const byFamily = new Map();
  for (const r of records) {
    if (r.source !== 'measured') continue;
    let agg = byFamily.get(r.family);
    if (!agg) {
      agg = { est: 0, measured: 0 };
      byFamily.set(r.family, agg);
    }
    agg.est += r.tokens_est;
    agg.measured += r.tokens_measured;
  }
  const suggestions = [];
  for (const [family, agg] of byFamily) {
    const deviationPct = agg.measured > 0 ? Math.abs(agg.est - agg.measured) / agg.measured : null;
    if (deviationPct !== null && deviationPct > DEVIATION_RECALIBRATION_THRESHOLD) {
      suggestions.push({
        family,
        deviation_pct: Math.round(deviationPct * 10000) / 100,
        action: `运行 node scripts/token-calibrate.js --family ${family} 复标（对接 FP-TOKO-001 PROFILE_STALE 流程）`
      });
    }
  }

  const measuredTotal = byFamily.size > 0
    ? [...byFamily.values()].reduce((s, a) => s + a.measured, 0)
    : 0;
  const estCoveredTotal = byFamily.size > 0
    ? [...byFamily.values()].reduce((s, a) => s + a.est, 0)
    : 0;

  const deviation = {
    threshold_pct: DEVIATION_RECALIBRATION_THRESHOLD * 100,
    covered_records: [...byFamily.values()].length > 0
      ? records.filter(r => r.source === 'measured').length
      : 0,
    est_sum: estCoveredTotal,
    measured_sum: measuredTotal,
    deviation_pct: measuredTotal > 0
      ? Math.round((Math.abs(estCoveredTotal - measuredTotal) / measuredTotal) * 10000) / 100
      : null,
    recalibration_suggested: suggestions.length > 0,
    suggestions
  };

  // §3.3：无 usage 回填 → 保持 estimated 并标注
  const estimatedOnlyNote = totals.measured_records === 0 && totals.records > 0
    ? '本会话无实测回填记录，全部为估算值（source=estimated）；收到 usage 事件后由 FP-TOKO-008 覆盖回填'
    : null;

  return {
    session_id: sessionId,
    phases,
    totals,
    deviation,
    allocation_ratios: PHASE_ALLOCATION_RATIOS,
    thresholds: { warning: WARNING_THRESHOLD, critical: CRITICAL_THRESHOLD },
    estimated_only_note: estimatedOnlyNote
  };
}

// ==================== 会话数据访问（FP-TOKO-003 manifest.budget_state 数据源，I1） ====================

/**
 * 读取会话全部记录（返回浅拷贝数组，防外部误改内部状态）
 * @param {string} sessionId
 * @returns {Array<Object>}
 */
export function getSessionRecords(sessionId) {
  const list = sessions.get(sessionId) || [];
  return list.map(r => ({ ...r }));
}

/**
 * 读取单条记录
 * @param {string} sessionId
 * @param {string} recordId
 * @returns {Object|null} 记录拷贝
 */
export function getRecord(sessionId, recordId) {
  const record = findRecord(sessionId, recordId);
  return record ? { ...record } : null;
}

/**
 * 清空会话内存态（会话结束/测试隔离用；R4：无落盘，清空即彻底销毁）
 * @param {string} sessionId
 */
export function clearSession(sessionId) {
  sessions.delete(sessionId);
}

export default {
  PHASE_ALLOCATION_RATIOS,
  DEFAULT_TOTAL_BUDGET,
  WARNING_THRESHOLD,
  CRITICAL_THRESHOLD,
  DEVIATION_RECALIBRATION_THRESHOLD,
  CONTENT_TYPES,
  SOURCES,
  estimateTokens,
  recordConsumption,
  backfillMeasured,
  getPhaseDistribution,
  getSessionRecords,
  getRecord,
  clearSession
};
