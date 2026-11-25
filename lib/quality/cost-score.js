// lib/quality/cost-score.js - 质量评分 cost 子项（FP-TOKO-013 / doc 05 §3.4、§6-T3）
//
// 职责（FP-TOKO-013 §1.1/§1.2）：
//   消费 FP-TOKO-002 消耗记录 → 综合 token ROI 与缓存命中率加权 → 输出 cost 子项分（0–100）。
//   - 纯计算模块：无 fs 写操作、无平台侧门控行为（R2：cost 只降总分不拦截交付）；
//   - 无有效数据返回 null（COST_DATA_MISSING 由调用方记 null + WARN，不影响其余维度评分）；
//   - 权重上限 0.10 强制（R3），clamp 逻辑在本模块单一来源提供。

import { PHASES } from '../token/budget-manager.js'; // 只读消费 5 阶段枚举（与 FP-002 同口径）
import { PHASE_ALLOCATION_RATIOS, DEFAULT_TOTAL_BUDGET } from '../token/estimation-track.js'; // 只读消费阶段预算口径

/** R3：cost 子项默认权重 = 权重上限（0.10，五维合计 1.0 → 开启后 1.1 自归一） */
export const DEFAULT_COST_WEIGHT = 0.10;
export const COST_WEIGHT_LIMIT = 0.10;

/** §1.2：综合 token ROI + 缓存命中率加权——命中率缺权重（命中率缺失时退化为纯 token 效率） */
export const CACHE_HIT_WEIGHT = 0.30;

/** 预算利用率高效区间上界（≤80% 不扣分；既有 budget-manager 预警阈值 0.8 同口径） */
export const BUDGET_EFFICIENCY_CEILING = 0.80;

/** 超出高效区间的线性扣分斜率（u=1.0 → 50 分；u≥1.2 → 0 分） */
export const UTILIZATION_PENALTY_RATE = 250;

/**
 * R3：cost 权重 clamp（≤0.10 强制；非法/缺省回退默认值）
 * @param {*} weight
 * @returns {{weight:number, clamped:boolean}}
 */
export function clampCostWeight(weight) {
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
    return { weight: DEFAULT_COST_WEIGHT, clamped: false };
  }
  if (weight > COST_WEIGHT_LIMIT) {
    return { weight: COST_WEIGHT_LIMIT, clamped: true };
  }
  return { weight, clamped: false };
}

/** @private 单阶段效率分：u ≤ 80% 满分；超出部分线性扣分 */
function phaseEfficiency(utilization) {
  if (utilization <= BUDGET_EFFICIENCY_CEILING) return 100;
  return Math.max(0, 100 - (utilization - BUDGET_EFFICIENCY_CEILING) * UTILIZATION_PENALTY_RATE);
}

/**
 * cost 子项计算（FP-TOKO-013 §1.2）
 *
 * @param {Array<Object>} records - FP-TOKO-002 消耗记录（§2.1 consumption-record，至少含
 *   session_id/phase/tokens_est/source/content_type/family/ts；source=measured 时以 tokens_measured 为主值）
 * @param {{cacheHitRatio?:number, totalBudget?:number}} [opts]
 *   - cacheHitRatio：FP-TOKO-005 观测缓存命中率 ∈[0,1]（可选；缺失时综合分退化为纯 token 效率）
 *   - totalBudget：会话总预算（缺省 DEFAULT_TOTAL_BUDGET=100000，与 FP-002 口径一致）
 * @returns {null|{score:number, breakdown:Object}} 无有效数据返回 null；否则 {score ∈[0,100], breakdown}
 * @throws {Error} COST_RECORD_MALFORMED（记录结构非法时）
 */
export function computeCostScore(records, opts = {}) {
  if (!Array.isArray(records) || records.length === 0) {
    return null; // COST_DATA_MISSING 语义由调用方承接（记 null + WARN）
  }

  // 按阶段聚合主值 token（R1 同口径：measured 优先，否则 estimated）
  const perPhaseTokens = {};
  for (const record of records) {
    if (!record || typeof record !== 'object') {
      throw new Error('COST_RECORD_MALFORMED: 消耗记录必须为对象');
    }
    if (!Object.values(PHASES).includes(record.phase)) {
      throw new Error(`COST_RECORD_MALFORMED: record.phase 非法（${JSON.stringify(record.phase)}）`);
    }
    const primary = record.source === 'measured'
      ? record.tokens_measured
      : record.tokens_est;
    if (typeof primary !== 'number' || !Number.isFinite(primary) || primary < 0) {
      throw new Error(`COST_RECORD_MALFORMED: record token 主值非法（source=${record.source}）`);
    }
    perPhaseTokens[record.phase] = (perPhaseTokens[record.phase] || 0) + primary;
  }

  const totalBudget = typeof opts.totalBudget === 'number' && opts.totalBudget > 0
    ? opts.totalBudget
    : DEFAULT_TOTAL_BUDGET;

  // 各阶段预算利用率与效率分（预算 = FP-002 阶段分配比例 × 总预算）
  const perPhase = {};
  let tokenEfficiencySum = 0;
  let observedWeightSum = 0;
  let tokensTotal = 0;
  for (const phase of Object.values(PHASES)) {
    const phaseBudget = (PHASE_ALLOCATION_RATIOS[phase] || 0) * totalBudget;
    if (phaseBudget <= 0 || perPhaseTokens[phase] === undefined) continue;
    const utilization = perPhaseTokens[phase] / phaseBudget;
    const efficiency = phaseEfficiency(utilization);
    const phaseWeight = PHASE_ALLOCATION_RATIOS[phase]; // FP-002 比例（合计 1.0，天然归一权重）
    tokenEfficiencySum += efficiency * phaseWeight;
    observedWeightSum += phaseWeight;
    tokensTotal += perPhaseTokens[phase];
    perPhase[phase] = {
      tokens: perPhaseTokens[phase],
      budget: phaseBudget,
      utilization: Number(utilization.toFixed(4)),
      efficiency: Number(efficiency.toFixed(2))
    };
  }

  if (observedWeightSum === 0) {
    return null; // 记录存在但无可核算阶段（防御性，正常输入不可达）
  }
  const tokenEfficiency = tokenEfficiencySum / observedWeightSum;

  // 缓存命中率加权（缺失退化纯 token 效率）
  let cacheScore = null;
  let finalScore = tokenEfficiency;
  if (typeof opts.cacheHitRatio === 'number' && opts.cacheHitRatio >= 0 && opts.cacheHitRatio <= 1) {
    cacheScore = opts.cacheHitRatio * 100;
    finalScore = (1 - CACHE_HIT_WEIGHT) * tokenEfficiency + CACHE_HIT_WEIGHT * cacheScore;
  }

  return {
    score: Math.round(finalScore * 100) / 100,
    breakdown: {
      tokens_total: tokensTotal,
      total_budget: totalBudget,
      per_phase: perPhase,
      token_efficiency: Number(tokenEfficiency.toFixed(2)),
      cache_hit_ratio: opts.cacheHitRatio ?? null,
      cache_score: cacheScore === null ? null : Number(cacheScore.toFixed(2)),
      cache_weight: cacheScore === null ? 0 : CACHE_HIT_WEIGHT,
      formula: cacheScore === null
        ? 'score = token_efficiency（阶段预算利用率效率分，FP-002 阶段权重归一）'
        : 'score = 0.7×token_efficiency + 0.3×(cache_hit_ratio×100)'
    }
  };
}
