// lib/context-assembly/compaction-templates.js - 多轮会话上下文压实模板（FP-TOKO-012 / doc 05 §3.3.3、§6-T3）
//
// 职责（FP-TOKO-012 §3.1 处理流程）：
//   1. 会话轮次与历史占用监测（shouldCompact：turn≥4 且 ratio>50%，ratio 消费 FP-TOKO-008 阶段预算）→
//   2. 满足触发条件输出 compaction.suggested 建议事件（经 FP-TOKO-006 通道，由宿主 Agent 决策执行）→
//   3. 宿主决策记录（recordCompactionDecision：接受→compacted；拒绝→不再建议，R3）→
//   4. 压实后重跑 FP-TOKO-005 前缀稳定化审计（宿主重跑 assemble 主流程即天然满足，R4）→
//   5. 记录效果（recordCompactionEffect：第 4 轮起历史占用 -30% 目标核算，T4/FP-014 M3 消费）。
//
// 红线：
//   - R1：平台只定义模板与触发建议，不自动改写历史——执行权在宿主（本模块零 fs 写操作、零历史数据变更）；
//   - R2：保留要素（decisions/contracts/acceptance_criteria）不得进入 discard 清单（validateTemplate 强制）；
//   - R3：每会话最多输出一次压实建议（被拒绝后不再重复）；
//   - R4：压实后装配计划必须重新通过前缀稳定化审计（宿主以压实后产物重跑 FP-TOKO-003 assemble）。

import { PHASES } from '../token/budget-manager.js'; // 只读消费 5 阶段枚举（与 FP-002/003/011 同口径）
import { getLadderState } from '../token/budget-closure.js'; // I1：ratio 数据源 = FP-008 阶段预算状态
import { normalizeEvent, validateEvent } from '../streaming/pse-events.js'; // compaction.suggested 经 FP-006 通道

/** 触发条件（§1.1：第 4 轮起且历史占用 > 阶段预算 50%；T1 边界口径 turn≥4、ratio 严格大于 0.5） */
export const COMPACTION_TRIGGER = Object.freeze({ min_turn: 4, min_history_ratio: 0.50 });

/** 效果目标（§3.1 步骤 5 / T4：压实后历史占用较压实前 -30%） */
export const COMPACTION_REDUCTION_TARGET = 0.30;

/** §2.2 keep 要素枚举（B3：前三项为受保护保留要素，R2） */
export const KEEP_ELEMENTS = Object.freeze(['decisions', 'contracts', 'acceptance_criteria', 'open_questions']);

/** §2.2 discard 要素枚举 */
export const DISCARD_ELEMENTS = Object.freeze([
  'intermediate_exploration',
  'failed_attempts_fulltext',
  'superseded_artifacts'
]);

/** R2/B3 受保护保留要素（永不出现在 discard） */
export const PROTECTED_KEEP_ELEMENTS = Object.freeze(['decisions', 'contracts', 'acceptance_criteria']);

/** §1.2 压实模板库（随包发布；taskType 无模板时回退 pdd-default，§1.3 TEMPLATE_MISSING） */
export const TEMPLATES = Object.freeze({
  'pdd-default': Object.freeze({
    template_id: 'pdd-default',
    keep: KEEP_ELEMENTS.slice(),
    discard: DISCARD_ELEMENTS.slice(),
    ratio_target: 0.5 // 压实后历史占用目标 ≤ 原占用的 50%
  })
});

/** DEFAULT_TEMPLATE_ID（§1.3 回退目标） */
export const DEFAULT_TEMPLATE_ID = 'pdd-default';

/**
 * 模板校验（R2/B3：保留要素不得进入 discard；§1.2 Schema 结构守卫）
 * @param {*} template
 * @returns {{valid:boolean, errors:string[]}}
 */
export function validateTemplate(template) {
  const errors = [];
  if (!template || typeof template !== 'object' || Array.isArray(template)) {
    return { valid: false, errors: ['template 必须为对象'] };
  }
  if (typeof template.template_id !== 'string' || template.template_id.length === 0) {
    errors.push('template_id 必须为非空字符串');
  }
  if (!Array.isArray(template.keep) || template.keep.length === 0) {
    errors.push('keep 必须为非空数组');
  }
  if (!Array.isArray(template.discard)) {
    errors.push('discard 必须为数组');
  }
  if (typeof template.ratio_target !== 'number' || !Number.isFinite(template.ratio_target) || template.ratio_target <= 0 || template.ratio_target >= 1) {
    errors.push('ratio_target 必须为 (0,1) 区间数字');
  }
  if (Array.isArray(template.keep) && Array.isArray(template.discard)) {
    for (const el of template.discard) {
      if (template.keep.includes(el)) errors.push(`R2: 要素 ${el} 同时出现在 keep 与 discard`);
      if (PROTECTED_KEEP_ELEMENTS.includes(el)) errors.push(`R2/B3: 受保护保留要素 ${el} 不得进入 discard`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// 模块加载时自检模板库（R2 强制表不可被静默违反）
for (const template of Object.values(TEMPLATES)) {
  const check = validateTemplate(template);
  if (!check.valid) {
    throw new Error(`TEMPLATE_INVALID: 内置模板 ${template.template_id} 不合法: ${check.errors.join('; ')}`);
  }
}

/**
 * 压实模板查询（§1.1；§1.3 TEMPLATE_MISSING → 回退 pdd-default）
 *
 * @param {string} taskType - 任务类型（无对应模板时回退 pdd-default）
 * @returns {Object} 模板（精确命中时原样返回；回退时附 fallback_used/notice/requested_task_type）
 */
export function getTemplate(taskType) {
  const exact = TEMPLATES[taskType];
  if (exact) {
    return { ...exact, matched: true };
  }
  // §1.3：TEMPLATE_MISSING 回退 pdd-default（降级路径不抛错惯例）
  return {
    ...TEMPLATES[DEFAULT_TEMPLATE_ID],
    matched: false,
    fallback_used: true,
    notice: 'TEMPLATE_MISSING',
    requested_task_type: taskType
  };
}

/**
 * 模板 Schema 视图（剥除查询元数据字段，仅保留 §1.2 四字段）
 * @private
 */
function templateSchemaView(template) {
  return {
    template_id: template.template_id,
    keep: [...template.keep],
    discard: [...template.discard],
    ratio_target: template.ratio_target
  };
}

// ==================== 会话压实状态机（§3.3） ====================
// monitoring →（turn≥4 且 ratio>50%）suggested → 宿主接受 → compacted；
// 宿主拒绝 → monitoring（rejected=true，不再建议，R3）。

/** sessionId → 压实状态（进程内存态，R4 同口径不落盘） */
const compactionStates = new Map();

/** @private */
function getState(sessionId) {
  return compactionStates.get(sessionId) ?? null;
}

/** @private */
function snapshot(sessionId) {
  const state = getState(sessionId);
  if (!state) return null;
  return {
    session_id: sessionId,
    status: state.status,
    rejected: state.rejected ?? false,
    ...(state.suggestion ? { suggestion: structuredClone(state.suggestion) } : {}),
    ...(state.effect ? { effect: { ...state.effect } } : {})
  };
}

/** @private 构建建议 + PSE 事件（ratio 来源：显式覆盖优先，缺省消费 FP-008，I1） */
function suggestCompaction(sessionId, phase, turnIndex, explicitRatio) {
  const historyRatio = explicitRatio !== undefined
    ? explicitRatio
    : (getLadderState(sessionId, phase)?.phase_ratio ?? 0); // I1：消费 FP-008 阶段预算状态
  if (turnIndex < COMPACTION_TRIGGER.min_turn) return null;
  if (!(historyRatio > COMPACTION_TRIGGER.min_history_ratio)) return null; // 严格大于（T1 边界）

  const template = templateSchemaView(getTemplate(DEFAULT_TEMPLATE_ID));
  const suggestion = {
    session_id: sessionId,
    turn_index: turnIndex,
    history_ratio: historyRatio,
    template_id: template.template_id,
    keep: template.keep,
    discard: template.discard
  };
  const event = normalizeEvent({ event: 'compaction.suggested', data: { ...suggestion } });
  if (!event || !validateEvent(event).valid) {
    throw new Error('COMPACT_EVENT_MALFORMED: 压实建议事件未通过 FP-TOKO-006 Schema 校验');
  }
  return { suggestion, event };
}

/**
 * 压实建议判定（§1.1；§3.3 状态机）
 *
 * @param {{sessionId:string, phase:string, turnIndex:number, historyRatio?:number}} session
 *   - historyRatio 可选显式覆盖（缺省读 FP-008 getLadderState().phase_ratio，I1 数据流）
 * @returns {null|{suggestion:Object, event:Object}} null=不建议；否则建议 §2.1 + PSE 事件
 * @throws {Error} COMPACT_SESSION_REQUIRED / COMPACT_INVALID_PHASE / COMPACT_TURN_INVALID
 */
export function shouldCompact(session = {}) {
  const { sessionId, phase, turnIndex, historyRatio } = session;
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('COMPACT_SESSION_REQUIRED: sessionId 必须为非空字符串');
  }
  if (!Object.values(PHASES).includes(phase)) {
    throw new Error(`COMPACT_INVALID_PHASE: phase 必须为 ${Object.values(PHASES).join('/')}，得到 ${JSON.stringify(phase)}`);
  }
  if (!Number.isInteger(turnIndex) || turnIndex < 0) {
    throw new Error(`COMPACT_TURN_INVALID: turnIndex 必须为非负整数，得到 ${JSON.stringify(turnIndex)}`);
  }

  const state = getState(sessionId);
  if (state && (state.status === 'suggested' || state.status === 'compacted' || state.rejected)) {
    return null; // R3：每会话最多一次建议（已建议待决策 / 已压实 / 已拒绝均不再建议）
  }

  // 显式覆盖优先（测试与宿主自带预算口径场景），缺省消费 FP-008（I1）
  if (historyRatio !== undefined) {
    if (typeof historyRatio !== 'number' || !Number.isFinite(historyRatio) || historyRatio < 0) {
      throw new Error(`COMPACT_RATIO_INVALID: historyRatio 必须为非负有限数字，得到 ${JSON.stringify(historyRatio)}`);
    }
  }
  const triggered = suggestCompaction(sessionId, phase, turnIndex, historyRatio);
  if (!triggered) return null;

  compactionStates.set(sessionId, {
    status: 'suggested',
    suggestion: triggered.suggestion,
    ts: new Date().toISOString()
  });
  return triggered;
}

/**
 * 宿主决策记录（§1.3 COMPACT_REJECTED / §3.3 状态转换）
 *
 * @param {string} sessionId
 * @param {boolean} accepted - true=接受（→compacted）；false=拒绝（→monitoring 不再建议，R3）
 * @returns {Object} 决策后状态快照
 * @throws {Error} COMPACT_NO_PENDING_SUGGESTION
 */
export function recordCompactionDecision(sessionId, accepted) {
  const state = getState(sessionId);
  if (!state || state.status !== 'suggested') {
    throw new Error(`COMPACT_NO_PENDING_SUGGESTION: 会话 ${JSON.stringify(sessionId)} 当前无待决策压实建议`);
  }
  if (accepted) {
    state.status = 'compacted'; // §3.3：宿主接受 → compacted
  } else {
    state.status = 'monitoring';
    state.rejected = true; // §1.3 COMPACT_REJECTED：记录决策，本会话不再重复建议（R3）
  }
  state.decided_at = new Date().toISOString();
  return snapshot(sessionId);
}

/**
 * 压实效果记录（§3.1 步骤 5 / T4 效果核算；FP-014 M3 长会话 ≥55% 核算消费）
 * @param {string} sessionId
 * @param {{before_tokens:number, after_tokens:number}} effect - 压实前后历史占用（同口径 token 数）
 * @returns {{reduction_ratio:number, target_met:boolean, target:number}}
 * @throws {Error} COMPACT_NO_SUGGESTION / COMPACT_EFFECT_INVALID
 */
export function recordCompactionEffect(sessionId, effect) {
  const state = getState(sessionId);
  if (!state || !state.suggestion) {
    throw new Error(`COMPACT_NO_SUGGESTION: 会话 ${JSON.stringify(sessionId)} 未产生过压实建议，无效果可记`);
  }
  if (!effect || typeof effect.before_tokens !== 'number' || !(effect.before_tokens > 0) ||
      typeof effect.after_tokens !== 'number' || !(effect.after_tokens >= 0)) {
    throw new Error(`COMPACT_EFFECT_INVALID: effect 必须为 {before_tokens>0, after_tokens>=0}，得到 ${JSON.stringify(effect)}`);
  }
  const reductionRatio = Number(((effect.before_tokens - effect.after_tokens) / effect.before_tokens).toFixed(4));
  const result = {
    reduction_ratio: reductionRatio,
    target_met: reductionRatio >= COMPACTION_REDUCTION_TARGET,
    target: COMPACTION_REDUCTION_TARGET
  };
  state.effect = { ...effect, ...result, recorded_at: new Date().toISOString() };
  return result;
}

/**
 * 压实状态查询（审计/回放用）
 * @param {string} sessionId
 * @returns {Object|null} {session_id, status, rejected, suggestion?, effect?}
 */
export function getCompactionState(sessionId) {
  return snapshot(sessionId);
}

/**
 * 重置压实状态（测试/会话隔离用）
 * @param {string} [sessionId] - 缺省重置全部
 */
export function resetCompactionState(sessionId) {
  if (sessionId === undefined) {
    compactionStates.clear();
    return;
  }
  compactionStates.delete(sessionId);
}
