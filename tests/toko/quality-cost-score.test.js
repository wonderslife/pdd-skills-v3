// tests/toko/quality-cost-score.test.js - FP-TOKO-013 quality-cost-score 契约测试
//
// 验收覆盖：B1 开关默认 false / B2 关闭时输出逐字节一致（R1）/ B3 既有五维评分行为不变 /
// T1 scorer 公开签名零变化 / T2 cost 分数 0-100 与公式一致 / T3 默认权重 0.1 且上限强制（R3）/
// T4 COST_DATA_MISSING null + WARN 不影响其余维度 / I1 4 级门控不受影响。

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import QualityScorer, { GRADES } from '../../lib/quality/scorer.js';
import {
  computeCostScore,
  clampCostWeight,
  DEFAULT_COST_WEIGHT,
  COST_WEIGHT_LIMIT,
  CACHE_HIT_WEIGHT,
  BUDGET_EFFICIENCY_CEILING,
  UTILIZATION_PENALTY_RATE
} from '../../lib/quality/cost-score.js';
import { DEFAULT_TOTAL_BUDGET, PHASE_ALLOCATION_RATIOS } from '../../lib/token/estimation-track.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @private 构造 FP-002 消耗记录 */
function rec(phase, tokens, source = 'estimated', extra = {}) {
  return {
    session_id: 'qcs-test',
    phase,
    tokens_est: source === 'measured' ? tokens : tokens,
    source,
    content_type: 'zh',
    family: 'openai',
    ts: '2026-11-25T00:00:00Z',
    ...(source === 'measured' ? { tokens_measured: tokens } : {}),
    ...extra
  };
}

const IMPL_BUDGET = PHASE_ALLOCATION_RATIOS.impl * DEFAULT_TOTAL_BUDGET; // 40000

describe('FP-TOKO-013 quality-cost-score', () => {
  const fixtureDir = path.join('/tmp', 'qcs-fixture');
  const fixtureFile = path.join(fixtureDir, 'sample.js');

  beforeEach(() => {
    mkdirSync(fixtureDir, { recursive: true });
    writeFileSync(fixtureFile, [
      'export function add(a, b) {',
      '  if (typeof a !== "number" || typeof b !== "number") {',
      '    throw new Error("invalid input");',
      '  }',
      '  return a + b;',
      '}',
      ''
    ].join('\n'), 'utf-8');
  });

  // ==================== R3 权重 clamp ====================

  describe('T3/R3 cost 权重（默认 0.1，上限强制）', () => {
    test('DEFAULT_COST_WEIGHT = COST_WEIGHT_LIMIT = 0.10（默认即上限）', () => {
      assert.equal(DEFAULT_COST_WEIGHT, 0.10);
      assert.equal(COST_WEIGHT_LIMIT, 0.10);
    });

    test('clampCostWeight：缺省/非法回退默认；超限强制 clamp 并标记', () => {
      assert.deepEqual(clampCostWeight(undefined), { weight: 0.10, clamped: false });
      assert.deepEqual(clampCostWeight(-1), { weight: 0.10, clamped: false });
      assert.deepEqual(clampCostWeight('0.2'), { weight: 0.10, clamped: false });
      assert.deepEqual(clampCostWeight(0.05), { weight: 0.05, clamped: false });
      const clamped = clampCostWeight(0.5);
      assert.equal(clamped.weight, 0.10);
      assert.equal(clamped.clamped, true);
    });

    test('构造器权重 clamp：weight 0.5 → 实际 0.1 + weightClamped 标记', () => {
      const scorer = new QualityScorer({ cost: { enabled: true, weight: 0.5, records: [] } });
      assert.equal(scorer.costConfig.weight, 0.10);
      assert.equal(scorer.costConfig.weightClamped, true);
      assert.equal(scorer.dimensions.cost.weight, 0.10);
    });
  });

  // ==================== B1/B2/T1 scorer 集成 ====================

  describe('B1/B2/T1 开关默认关闭（R1：输出与既有行为一致）', () => {
    test('B1：默认构造无 cost 维度，costConfig.enabled=false', () => {
      const scorer = new QualityScorer();
      assert.equal(scorer.costConfig.enabled, false);
      assert.equal(scorer.dimensions.cost, undefined);
      assert.equal(Object.keys(scorer.dimensions).length, 5);
    });

    test('B2：默认构造与显式关闭输出逐字节一致，且无 cost 键（R1）', async () => {
      const scorerDefault = new QualityScorer();
      const scorerOff = new QualityScorer({ cost: { enabled: false } });
      const r1 = await scorerDefault.scoreFile(fixtureFile);
      const r2 = await scorerOff.scoreFile(fixtureFile);
      // scoredAt 为运行时时间戳，剥离后逐字节比较（R1）
      const strip = (r) => { const c = { ...r }; delete c.scoredAt; return c; };
      assert.equal(JSON.stringify(strip(r1)), JSON.stringify(strip(r2)));
      assert.equal(JSON.stringify(r1).includes('"cost"'), false);
      assert.equal(r1.dimensions.cost, undefined);
      assert.ok(r1.success);
    });

    test('T1：scorer 公开签名零变化（方法面与 GRADES 不变）', () => {
      const proto = QualityScorer.prototype;
      const expected = ['scoreFile', 'scoreDirectory', 'scoreDimension', 'getWeightedScore', 'getGrade', 'getRecommendations', 'registerRule', 'exportJSON'];
      for (const name of expected) {
        assert.equal(typeof proto[name], 'function', `缺少公开方法 ${name}`);
      }
      // GRADES 结构不变（I1 门控口径）
      assert.deepEqual(Object.keys(GRADES), ['S', 'A', 'B', 'C', 'D', 'F']);
      assert.equal(GRADES.S.minScore, 95);
      assert.equal(GRADES.A.minScore, 85);
      assert.equal(GRADES.B.minScore, 70);
      assert.equal(GRADES.C.minScore, 55);
      assert.equal(GRADES.D.minScore, 40);
    });

    test('B3：既有五维规则全部就绪（31 条内置规则）', () => {
      const scorer = new QualityScorer();
      assert.deepEqual(Object.keys(scorer.rules), ['readability', 'maintainability', 'robustness', 'performance', 'security']);
      const total = Object.values(scorer.rules).reduce((n, r) => n + r.length, 0);
      assert.ok(total >= 30, `内置规则数异常: ${total}`);
    });
  });

  // ==================== T2 enabled 路径 ====================

  describe('T2/B3 开启路径（cost 子项参与评分）', () => {
    test('enabled+records：cost 为第 6 维，分数 ∈[0,100]，weightedScore 六维加权', async () => {
      const scorer = new QualityScorer({
        cost: {
          enabled: true,
          records: [rec('impl', 30000)], // u = 30000/40000 = 0.75 ≤ 0.8 → token 效率 100
          cacheHitRatio: 0.9
        }
      });
      const result = await scorer.scoreFile(fixtureFile);
      assert.equal(result.success, true);
      const cost = result.dimensions.cost;
      assert.ok(cost, '开启后应含 cost 维度');
      assert.equal(cost.label, '成本效率');
      assert.equal(cost.weight, 0.10);
      assert.equal(typeof cost.score, 'number');
      assert.ok(cost.score >= 0 && cost.score <= 100);
      assert.ok(cost.breakdown);
      assert.equal(cost.rulesChecked, 0); // 数据驱动维度，无代码规则
      // 六维加权核算（权重合计 1.1 自归一）
      const weights = { readability: 0.20, maintainability: 0.20, robustness: 0.25, performance: 0.15, security: 0.20, cost: 0.10 };
      let sum = 0;
      for (const [dim, w] of Object.entries(weights)) {
        sum += result.dimensions[dim].score * w;
      }
      assert.equal(result.weightedScore, Math.round((sum / 1.1) * 100) / 100);
    });

    test('公式核算：cache 0.9 时 score = 0.7×100 + 0.3×90 = 97', () => {
      const result = computeCostScore([rec('impl', 30000)], { cacheHitRatio: 0.9 });
      assert.equal(result.score, 97); // 0.7×100 + 0.3×90
      assert.equal(result.breakdown.cache_weight, CACHE_HIT_WEIGHT);
      assert.match(result.breakdown.formula, /0\.7/);
    });
  });

  // ==================== T4 COST_DATA_MISSING ====================

  describe('T4 cost 无数据（null + WARN，不影响其余维度）', () => {
    test('enabled+无 records：cost.score=null + notice + WARN；五维加权分不受影响', async (t) => {
      const warnSpy = t.mock.method(console, 'warn', () => {});
      const scorerWithCost = new QualityScorer({ cost: { enabled: true, records: null } });
      const scorerPlain = new QualityScorer();
      const withCost = await scorerWithCost.scoreFile(fixtureFile);
      const plain = await scorerPlain.scoreFile(fixtureFile);
      assert.equal(withCost.dimensions.cost.score, null);
      assert.equal(withCost.dimensions.cost.notice, 'COST_DATA_MISSING');
      assert.ok(warnSpy.mock.calls.some(c => c.arguments[0].includes('COST_DATA_MISSING')));
      // 其余五维评分与加权分完全一致（null 不计权重）
      assert.equal(withCost.weightedScore, plain.weightedScore);
      for (const dim of ['readability', 'maintainability', 'robustness', 'performance', 'security']) {
        assert.equal(withCost.dimensions[dim].score, plain.dimensions[dim].score);
      }
    });
  });

  // ==================== R2 非门控（cost 不产生建议） ====================

  describe('R2/B3 cost 只降总分不拦截（不生成改进建议）', () => {
    test('cost 低分不进 recommendations；其他低分维度照常生成', async () => {
      const scorer = new QualityScorer({
        cost: { enabled: true, records: [rec('impl', 80000)], cacheHitRatio: 0 } // u=2.0 → cost 0.3×0=极低
      });
      const result = await scorer.scoreFile(fixtureFile);
      assert.ok(result.dimensions.cost.score < 70);
      assert.equal(result.recommendations.some(r => r.dimension === 'cost'), false);
      // fixture 代码质量高：五维分数均 ≥70，无其他建议
      for (const dim of Object.keys(result.dimensions)) {
        if (dim !== 'cost') assert.ok(result.dimensions[dim].score >= 70);
      }
    });
  });

  // ==================== computeCostScore 单元 ====================

  describe('computeCostScore 单元（§1.2 输入 FP-002 记录）', () => {
    beforeEach(() => {});

    test('空/非数组输入 → null（COST_DATA_MISSING 语义）', () => {
      assert.equal(computeCostScore([]), null);
      assert.equal(computeCostScore(null), null);
      assert.equal(computeCostScore('not-array'), null);
    });

    test('预算利用率效率分边界：u=0.8 满分；u=1.0 → 50；u≥1.2 → 0', () => {
      assert.equal(computeCostScore([rec('impl', IMPL_BUDGET * 0.8)]).score, 100);
      assert.equal(computeCostScore([rec('impl', IMPL_BUDGET * 1.0)]).score, 50); // 100-0.2×250
      assert.equal(computeCostScore([rec('impl', IMPL_BUDGET * 1.2)]).score, 0);
      assert.equal(BUDGET_EFFICIENCY_CEILING, 0.80);
      assert.equal(UTILIZATION_PENALTY_RATE, 250);
    });

    test('超预算单调递减：消耗越多分数越低（ROI 语义）', () => {
      const low = computeCostScore([rec('impl', IMPL_BUDGET * 0.9)]).score;
      const mid = computeCostScore([rec('impl', IMPL_BUDGET * 1.0)]).score;
      const high = computeCostScore([rec('impl', IMPL_BUDGET * 1.1)]).score;
      assert.ok(low > mid && mid > high);
    });

    test('measured 主值优先（R1 与 FP-002 同口径）', () => {
      const m = computeCostScore([rec('impl', 40000, 'measured')]);
      assert.equal(m.breakdown.per_phase.impl.tokens, 40000); // tokens_measured 主值
      assert.equal(m.score, 50); // u = 40000/40000 = 1.0 → 效率 100-0.2×250 = 50
      const under = computeCostScore([rec('impl', 30000, 'measured')]);
      assert.equal(under.breakdown.per_phase.impl.tokens, 30000); // measured 主值（非 tokens_est）
      assert.equal(under.score, 100);
    });

    test('多阶段加权：analysis(0.2)+impl(0.4) 按 FP-002 比例归一', () => {
      // analysis 预算 = 20000，消耗 16000 → u=0.8 → eff 100；impl 预算 40000，消耗 44000 → u=1.1 → eff 25
      const result = computeCostScore([rec('analysis', 16000), rec('impl', 44000)]);
      const expected = (100 * 0.2 + 25 * 0.4) / 0.6;
      assert.equal(result.score, Math.round(expected * 100) / 100);
      assert.ok(result.breakdown.per_phase.analysis);
      assert.ok(result.breakdown.per_phase.impl);
    });

    test('cacheHitRatio 缺失 → 纯 token 效率（cache_weight=0）', () => {
      const result = computeCostScore([rec('impl', 30000)]);
      assert.equal(result.breakdown.cache_hit_ratio, null);
      assert.equal(result.breakdown.cache_weight, 0);
      assert.equal(result.breakdown.token_efficiency, 100);
      assert.equal(result.score, 100);
    });

    test('totalBudget 覆盖生效（FP-008 口径传入）', () => {
      const result = computeCostScore([rec('impl', 3000)], { totalBudget: 10000 });
      assert.equal(result.breakdown.total_budget, 10000);
      // impl 预算 = 0.4×10000 = 4000 → u=0.75 → 100 分
      assert.equal(result.score, 100);
    });

    test('COST_RECORD_MALFORMED：phase 非法 / token 主值非法 / 非对象记录', () => {
      assert.throws(() => computeCostScore([{ ...rec('impl', 100), phase: 'bogus' }]), /COST_RECORD_MALFORMED/);
      assert.throws(() => computeCostScore([{ ...rec('impl', 'nan') }]), /COST_RECORD_MALFORMED/);
      assert.throws(() => computeCostScore([null]), /COST_RECORD_MALFORMED/);
      // measured 记录缺 tokens_measured 主值 → 非法
      assert.throws(() => computeCostScore([{ ...rec('impl', 100, 'measured'), tokens_measured: undefined }]), /COST_RECORD_MALFORMED/);
    });
  });

  // ==================== I1 门控不受影响 ====================

  describe('I1 质量门控不受影响（getGrade 边界）', () => {
    test('getGrade 边界值与 3.4.x 一致（开启/关闭两形态同分同评级）', () => {
      const scorer = new QualityScorer();
      assert.equal(scorer.getGrade(95), 'S');
      assert.equal(scorer.getGrade(94.99), 'A');
      assert.equal(scorer.getGrade(85), 'A');
      assert.equal(scorer.getGrade(70), 'B');
      assert.equal(scorer.getGrade(55), 'C');
      assert.equal(scorer.getGrade(40), 'D');
      assert.equal(scorer.getGrade(0), 'F');
      // cost 开启且无数据：null 不影响门控判定
      const scorerCost = new QualityScorer({ cost: { enabled: true, records: null } });
      assert.equal(scorerCost.getGrade(85), 'A');
    });
  });
});
