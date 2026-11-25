// lib/token/budget-closure.js - 预算流式闭环：usage 回填 + 三级软熔断（FP-TOKO-008 / doc 05 §3.3.2）
//
// 职责（FP-TOKO-008 §3.1 处理流程）：
//   1. 每次实测/估算计数更新（onUsageEvent / recordEstimate）→ 2. 计算阶段占比 →
//   3. 跨越 70/85/100% 阈值沿触发对应 budget.* 事件一次 → 4. usage 事件回填 FP-TOKO-002
//   消耗记录（估算记录单主值覆盖）→ 5. usage 缺失时估算轨兜底（USAGE_MISSING notice，不阻断）→
//   6. 梯级状态可查询（getLadderState）。
//
// 红线：
//   - R1：平台只发建议事件，不擅自中断生成——执行权在宿主 Agent（事件 message 均为建议口径）；
//   - R2：梯级单调不减（none → warning → tighten → stop_suggested），回退视为异常保持最高梯级；
//   - R3：阈值固定 70/85/100%，不做动态调整（可配置化为后续独立能力）；
//   - R4：budget-manager 类签名零改动——仅只读消费 PHASES 枚举，阶段预算比例沿用 FP-TOKO-002
//     PHASE_ALLOCATION_RATIOS（镜像锚定 20/15/40/15/10）；
//   - budget.* 事件经 normalizeEvent 构建保证满足 FP-TOKO-006 Schema（I1）；FP-012 可经
//     getBudgetEvents 消费（I2 挂接点）。

import { PHASES } from './budget-manager.js';
import {
  recordConsumption,
  backfillMeasured,
  getSessionRecords,
  PHASE_ALLOCATION_RATIOS,
  DEFAULT_TOTAL_BUDGET
} from './estimation-track.js';
import { validateEvent, normalizeEvent } from '../streaming/pse-events.js';
import { TIGHTEN_MAX_ITEMS } from '../context-assembly/digest.js';

/** §1.1 三级梯级阈值（R3：固定，不动态调整） */
export const BUDGET_LADDER_THRESHOLDS = Object.freeze({
  warning: 0.70,
  tighten: 0.85,
  stop_suggested: 1.0
});

/** §2.2 梯级枚举（单调不减） */
export const LADDER_LEVELS = Object.freeze(['none', 'warning', 'tighten', 'stop_suggested']);

/** 梯级序（内部：单调性判定） */
const LEVEL_RANK = Object.freeze({ none: 0, warning: 1, tighten: 2, stop_suggested: 3 });

/** tighten 事件注入的 Digest 条目上限（= FP-TOKO-004 TIGHTEN_MAX_ITEMS，T4 联动口径单一来源） */
export { TIGHTEN_MAX_ITEMS };

/** 熔断梯级状态（key = `${sessionId}::${phase}`） */
const ladderStates = new Map();

/** @private */
function stateKey(sessionId, phase) {
  return `${sessionId}::${phase}`;
}

/** @private RFC3339 现在 */
function nowIso() {
  return new Date().toISOString();
}

/** @private 记录主值（R1 单主值：measured 取实测，estimated 取估算） */
function primaryTokens(record) {
  return record.source === 'measured' ? record.tokens_measured : record.tokens_est;
}

/** @private 校验 phase ∈ 5 阶段（与 FP-TOKO-002 同口径） */
function assertPhase(phase) {
  if (!Object.values(PHASES).includes(phase)) {
    throw new Error(`USAGE_EVENT_INVALID: phase 必须为 ${Object.values(PHASES).join('/')}，得到 ${JSON.stringify(phase)}`);
  }
}

/** @private 定位会话+阶段内最新一条 estimated 记录（用于实测单主值覆盖） */
function findLatestEstimatedRecord(sessionId, phase) {
  const records = getSessionRecords(sessionId).filter(r => r.phase === phase);
  for (let i = records.length - 1; i >= 0; i -= 1) {
    if (records[i].source === 'estimated') return records[i];
  }
  return null;
}

/**
 * 计算阶段消耗占比（§3.1 步骤 2）
 *
 * 阶段预算 = totalBudget × PHASE_ALLOCATION_RATIOS[phase]（沿用 20/15/40/15/10，R4）；
 * 消耗 = 该阶段全部记录主值之和（measured 记录取实测，estimated 取估算）。
 *
 * @private
 */
function computePhaseRatio(sessionId, phase, totalBudget) {
  const phaseBudget = PHASE_ALLOCATION_RATIOS[phase] * totalBudget;
  const consumed = getSessionRecords(sessionId)
    .filter(r => r.phase === phase)
    .reduce((sum, r) => sum + primaryTokens(r), 0);
  return { phaseBudget, consumed, phase_ratio: phaseBudget > 0 ? consumed / phaseBudget : 0 };
}

/** @private 按占比判定目标梯级（R3 固定阈值） */
function targetLevelOf(phaseRatio) {
  if (phaseRatio >= BUDGET_LADDER_THRESHOLDS.stop_suggested) return 'stop_suggested';
  if (phaseRatio >= BUDGET_LADDER_THRESHOLDS.tighten) return 'tighten';
  if (phaseRatio >= BUDGET_LADDER_THRESHOLDS.warning) return 'warning';
  return 'none';
}

/** @private 构建单条 budget.* PSE 事件（经 normalizeEvent 保证 FP-006 Schema，I1） */
function buildBudgetEvent(level, sessionId, phase, phaseRatio) {
  const base = {
    session_id: sessionId,
    phase,
    level,
    phase_ratio: Number(phaseRatio.toFixed(6)),
    threshold: BUDGET_LADDER_THRESHOLDS[level]
  };
  const payloads = {
    warning: {
      ...base,
      action: 'cost_hint',
      message: '成本提示：阶段预算消耗已达 70%（仅提示，不改变任务）'
    },
    tighten: {
      ...base,
      action: 'tighten_digest',
      digest_max_items: TIGHTEN_MAX_ITEMS,
      skip_tier2: true,
      message: '建议跳过 Tier 2 装配并收紧摘要（Digest max_items=5）；是否执行由宿主 Agent 决定'
    },
    stop_suggested: {
      ...base,
      action: 'stop_suggested',
      partial_result_hint: true,
      message: '建议终止本轮生成，产出已有部分结果 + 未完成清单；执行权在宿主 Agent'
    }
  };
  const normalized = normalizeEvent({ event: `budget.${level}`, data: payloads[level] });
  if (!normalized) {
    throw new Error(`BUDGET_EVENT_MALFORMED: budget.${level} 事件未通过 FP-006 Schema 校验`);
  }
  return normalized;
}

/**
 * 梯级推进评估（§3.3 状态转换；R2 单调不减）
 *
 * - 目标梯级高于当前：逐级推进，每级跨越沿触发事件一次（跳级时逐级补发）；
 * - 目标梯级低于当前（如实测回填值低于估算）：LADDER_REGRESSION——WARN 并保持最高已达梯级，
 *   phase_ratio 仍更新为当前事实值；
 * - totalBudget 仅在状态首次建立时采纳，此后以存储值为准（同一会话口径一致）。
 *
 * @private
 * @returns {{state:Object, events:Object[], regression:boolean}}
 */
function evaluateLadder(sessionId, phase, opts = {}) {
  const key = stateKey(sessionId, phase);
  const stored = ladderStates.get(key);
  const totalBudget = stored?.total_budget
    ?? (typeof opts.totalBudget === 'number' && opts.totalBudget > 0 ? opts.totalBudget : DEFAULT_TOTAL_BUDGET);

  const { phase_ratio } = computePhaseRatio(sessionId, phase, totalBudget);
  const target = targetLevelOf(phase_ratio);

  const state = stored ?? {
    session_id: sessionId,
    phase,
    level: 'none',
    phase_ratio: 0,
    ts: nowIso(),
    total_budget: totalBudget,
    events: []
  };

  const events = [];
  let regression = false;
  const currentRank = LEVEL_RANK[state.level];
  const targetRank = LEVEL_RANK[target];

  if (targetRank > currentRank) {
    // 逐级推进（跳级时逐级跨越沿各触发一次）
    for (let rank = currentRank + 1; rank <= targetRank; rank += 1) {
      const level = LADDER_LEVELS[rank];
      const event = buildBudgetEvent(level, sessionId, phase, phase_ratio);
      events.push(event);
      state.events.push(event);
    }
    state.level = target;
  } else if (targetRank < currentRank && currentRank > 0) {
    // LADDER_REGRESSION：占比回落（如实测覆盖估算后变小）——保持最高已达梯级（R2）
    regression = true;
    console.warn(`[LADDER_REGRESSION] ${sessionId}/${phase} 阶段占比回落至 ${phase_ratio.toFixed(4)}（目标 ${target}），梯级保持 ${state.level}（R2 单调不减）`);
  }

  state.phase_ratio = phase_ratio;
  state.ts = nowIso();
  ladderStates.set(key, state);

  return {
    state: snapshotState(state),
    events,
    regression
  };
}

/** @private 对外快照（§2.1 字段面） */
function snapshotState(state) {
  return {
    session_id: state.session_id,
    phase: state.phase,
    level: state.level,
    phase_ratio: state.phase_ratio,
    ts: state.ts
  };
}

// ==================== 计数更新入口 ====================

/**
 * usage 事件订阅入口（§1.2：消费 FP-TOKO-006 usage 事件 → 写入 FP-TOKO-002 消耗记录）
 *
 * 回填策略（B3，FP-TOKO-002 R1 单主值）：
 *   - source=measured 事件 → 优先回填该会话+阶段最新一条 estimated 记录（单主值覆盖，
 *     tokens_est 保留用于偏差核算）；无 estimated 记录时新建 measured 记录；
 *   - source=estimated 事件 → 新建 estimated 记录（估算轨兜底事件）。
 *
 * tokens_est 对 measured 记录取同值（usage 事件无独立估算值，偏差恒 0，与 FP-006 I1 口径一致）。
 * 写入后推进熔断梯级评估。
 *
 * @param {Object} pseUsage - FP-TOKO-006 usage 事件（validateEvent 校验通过）
 * @param {{sessionId:string, phase:string, family?:string, content_type?:'zh'|'en'|'code'|'mixed',
 *          totalBudget?:number}} ctx - 会话与阶段上下文（family/content_type 缺省 mixed + fallback 家族）
 * @returns {{record:Object, state:Object, events:Object[], regression:boolean}}
 * @throws {Error} USAGE_EVENT_INVALID（事件非法 / ctx 缺失 / phase 非法）；
 *                 RECORD_MALFORMED / RECORD_NOT_FOUND（FP-TOKO-002 透传）
 */
export function onUsageEvent(pseUsage, ctx = {}) {
  const check = validateEvent(pseUsage);
  if (!check.valid) {
    throw new Error(`USAGE_EVENT_INVALID: 非 FP-006 合法事件 — ${check.errors.join('; ')}`);
  }
  if (pseUsage.event !== 'usage') {
    throw new Error(`USAGE_EVENT_INVALID: 期望 usage 事件，得到 ${pseUsage.event}`);
  }
  if (typeof ctx.sessionId !== 'string' || ctx.sessionId.length === 0) {
    throw new Error('USAGE_EVENT_INVALID: ctx.sessionId 必须为非空字符串');
  }
  assertPhase(ctx.phase);

  const outputTokens = pseUsage.data.output_tokens;
  const ts = typeof pseUsage.ts === 'string' ? pseUsage.ts : nowIso();
  const family = typeof ctx.family === 'string' && ctx.family.length > 0 ? ctx.family : 'openai(fallback)';
  const contentType = ['zh', 'en', 'code', 'mixed'].includes(ctx.content_type) ? ctx.content_type : 'mixed';

  let record;
  if (pseUsage.data.source === 'measured') {
    const estimated = findLatestEstimatedRecord(ctx.sessionId, ctx.phase);
    if (estimated) {
      // B3：实测覆盖估算（单主值，tokens_est 保留偏差核算）
      record = backfillMeasured(ctx.sessionId, estimated.record_id, outputTokens, ts);
    } else {
      record = recordConsumption({
        session_id: ctx.sessionId,
        phase: ctx.phase,
        tokens_est: outputTokens,
        tokens_measured: outputTokens,
        source: 'measured',
        content_type: contentType,
        family,
        ts
      });
    }
  } else {
    // 估算兜底事件（source=estimated）→ 估算轨记录（R1：不携带实测主值）
    record = recordConsumption({
      session_id: ctx.sessionId,
      phase: ctx.phase,
      tokens_est: outputTokens,
      source: 'estimated',
      content_type: contentType,
      family,
      ts
    });
  }

  const evaluation = evaluateLadder(ctx.sessionId, ctx.phase, { totalBudget: ctx.totalBudget });
  return { record, ...evaluation };
}

/**
 * 估算轨计数接入（§3.1 步骤 1：估算计数更新 → 推进梯级）
 *
 * 估算轨先行（FP-TOKO-002）：估算记录落账后即参与占比计算；后续实测到达时经
 * onUsageEvent 单主值覆盖同记录。
 *
 * @param {string} sessionId
 * @param {string} phase
 * @param {number} tokensEst - 估算 token 数（FP-TOKO-002 estimateTokens 输出）
 * @param {{family?:string, content_type?:string, ts?:string, artifact_ref?:string,
 *          totalBudget?:number}} [opts]
 * @returns {{record:Object, state:Object, events:Object[], regression:boolean}}
 * @throws {Error} RECORD_MALFORMED（FP-TOKO-002 透传）/ USAGE_EVENT_INVALID（phase 非法）
 */
export function recordEstimate(sessionId, phase, tokensEst, opts = {}) {
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('USAGE_EVENT_INVALID: sessionId 必须为非空字符串');
  }
  assertPhase(phase);
  const record = recordConsumption({
    session_id: sessionId,
    phase,
    tokens_est: tokensEst,
    source: 'estimated',
    content_type: ['zh', 'en', 'code', 'mixed'].includes(opts.content_type) ? opts.content_type : 'mixed',
    family: typeof opts.family === 'string' && opts.family.length > 0 ? opts.family : 'openai(fallback)',
    ts: typeof opts.ts === 'string' ? opts.ts : nowIso(),
    ...(opts.artifact_ref !== undefined ? { artifact_ref: opts.artifact_ref } : {})
  });
  const evaluation = evaluateLadder(sessionId, phase, { totalBudget: opts.totalBudget });
  return { record, ...evaluation };
}

// ==================== 查询与闭环 ====================

/**
 * 查询当前熔断梯级状态（§1.2 / §2.1）
 * @param {string} sessionId
 * @param {string} phase
 * @returns {{session_id:string, phase:string, level:string, phase_ratio:number, ts:string}|null}
 *          从未评估过时返回 null
 */
export function getLadderState(sessionId, phase) {
  const state = ladderStates.get(stateKey(sessionId, phase));
  return state ? snapshotState(state) : null;
}

/**
 * tighten 是否激活（level ≥ tighten）——供调用方联动 FP-TOKO-004 digest({tighten:true})
 * 与 FP-TOKO-003 装配（跳过 Tier 2：调用方不传 tier2References，T4）
 * @param {string} sessionId
 * @param {string} phase
 * @returns {boolean}
 */
export function isTightenActive(sessionId, phase) {
  const state = ladderStates.get(stateKey(sessionId, phase));
  return !!state && LEVEL_RANK[state.level] >= LEVEL_RANK.tighten;
}

/**
 * 已下发 budget.* 事件清单（FP-012 消费挂接点，I2）
 * @param {string} sessionId
 * @param {string} phase
 * @returns {Object[]} PSE 事件深拷贝数组
 */
export function getBudgetEvents(sessionId, phase) {
  const state = ladderStates.get(stateKey(sessionId, phase));
  return state ? structuredClone(state.events) : [];
}

/**
 * 流尾预算闭环（§3.1 步骤 5：usage 缺失时估算轨兜底，T3；I3 记账误差核算）
 *
 * - 流内无 usage 事件 → 不抛错，返回 notice=USAGE_MISSING + source=estimated
 *   （估算轨记录已参与占比，manifest 标注 source=estimated）；
 * - 流内含 usage → source=measured；done 事件携带 usage_total.output_tokens 时核算
 *   会话级记账误差 usage_deviation = |账单总量 − 已记账总量| / 账单总量（I3，≤5% 为达标）。
 *
 * @param {string} sessionId
 * @param {string} phase
 * @param {Object[]} pseEvents - FP-TOKO-006 PSE 事件流（normalizeStream/buildEventStream 产物）
 * @param {{totalBudget?:number}} [opts]
 * @returns {{usage_missing:boolean, notice?:string, source:'measured'|'estimated',
 *            state:Object, events:Object[], usage_deviation?:number}}
 */
export function finalizeBudgetStream(sessionId, phase, pseEvents, opts = {}) {
  assertPhase(phase);
  if (!Array.isArray(pseEvents)) {
    throw new Error(`USAGE_EVENT_INVALID: pseEvents 必须为数组，得到 ${typeof pseEvents}`);
  }

  const usageEvents = pseEvents.filter(e => e && e.event === 'usage');
  const evaluation = evaluateLadder(sessionId, phase, { totalBudget: opts.totalBudget });

  if (usageEvents.length === 0) {
    // T3：估算轨接管，不阻断
    return {
      usage_missing: true,
      notice: 'USAGE_MISSING',
      source: 'estimated',
      state: evaluation.state,
      events: evaluation.events
    };
  }

  // I3：与 done.usage_total（供应商账单口径）核对记账误差
  const doneEvent = pseEvents.find(e => e.event === 'done');
  const billed = doneEvent?.data?.usage_total?.output_tokens;
  let usage_deviation;
  if (typeof billed === 'number' && billed > 0) {
    const recorded = getSessionRecords(sessionId)
      .filter(r => r.phase === phase && r.source === 'measured')
      .reduce((sum, r) => sum + (r.tokens_measured ?? 0), 0);
    usage_deviation = Math.abs(billed - recorded) / billed;
  }

  return {
    usage_missing: false,
    source: 'measured',
    state: evaluation.state,
    events: evaluation.events,
    ...(usage_deviation !== undefined ? { usage_deviation } : {})
  };
}

/**
 * 重置熔断梯级状态（测试/会话隔离用；FP-TOKO-002 消耗记录不受影响，需时另行 clearSession）
 * @param {string} [sessionId] - 缺省重置全部
 */
export function resetBudgetCycle(sessionId) {
  if (sessionId === undefined) {
    ladderStates.clear();
    return;
  }
  for (const key of [...ladderStates.keys()]) {
    if (key.startsWith(`${sessionId}::`)) ladderStates.delete(key);
  }
}

export default {
  BUDGET_LADDER_THRESHOLDS,
  LADDER_LEVELS,
  TIGHTEN_MAX_ITEMS,
  onUsageEvent,
  recordEstimate,
  getLadderState,
  isTightenActive,
  getBudgetEvents,
  finalizeBudgetStream,
  resetBudgetCycle
};
