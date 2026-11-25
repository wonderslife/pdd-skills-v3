// tests/toko/phase-whitelist.test.js - FP-TOKO-011 phase-aware-assembly 契约测试
//
// 验收覆盖：B1 五阶段白名单齐备 / B2 IMPL 收敛达标（ruoyi 18→3–4）/ B3 触发语义不变（纯配置零写入）/
// T1 栈限定互斥 / T2 STACK_UNRESOLVED 降级 / T3 稳定化联动（FP-005 审计）/ T4 Android 链路受益 /
// T5 全量对比报告 / I1 CAG 注入点 / I2 M3 核算口径衔接。

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PROJECT_TYPES,
  STACK_EXPERT_MAP,
  PHASE_WHITELIST_MATRIX,
  IMPL_EXPERT_POOL_TARGET,
  getWhitelist,
  buildAssemblyScaleReport
} from '../../lib/context-assembly/phase-whitelist.js';
import { assemble } from '../../lib/context-assembly/index.js';
import { buildTierManifest } from '../../lib/streaming/tier-metadata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALL_PHASES = ['analysis', 'design', 'impl', 'review', 'verify'];
const manifest = buildTierManifest({});
const allSkillNames = manifest.skills.map(s => s.name);
const expertDirSkills = manifest.skills.filter(s => s.category === 'expert').map(s => s.name);
const coreDirSkills = manifest.skills.filter(s => s.category === 'core').map(s => s.name);

describe('FP-TOKO-011 phase-aware-assembly', () => {
  // ==================== B1 五阶段白名单齐备 ====================

  describe('B1 PHASES × 类别矩阵（§2.1）', () => {
    test('矩阵覆盖 5 阶段且每阶段含 include 与排除列', () => {
      assert.deepEqual(Object.keys(PHASE_WHITELIST_MATRIX).sort(), ALL_PHASES);
      for (const phase of ALL_PHASES) {
        const row = PHASE_WHITELIST_MATRIX[phase];
        const hasInclude = row.include_categories.length + row.include_skills.length > 0;
        const hasExclude = row.exclude_categories.length + row.exclude_skills.length > 0 || phase === 'impl';
        assert.ok(hasInclude, `${phase} 缺 include 列`);
        assert.ok(hasExclude, `${phase} 缺排除列`);
      }
    });

    test('PROJECT_TYPES 为 detector 7 值枚举（§2.2，只读消费）', () => {
      assert.deepEqual([...PROJECT_TYPES], [
        'spring-boot', 'ruoyi', 'vue3', 'android-kotlin', 'android-compose', 'mixed', 'unknown'
      ]);
    });

    test('各阶段白名单解析结果均 ⊆ 53 技能清单（随包矩阵不失配）', () => {
      for (const phase of ALL_PHASES) {
        for (const projectType of PROJECT_TYPES) {
          const config = getWhitelist(phase, projectType);
          for (const name of config.skills) {
            assert.ok(allSkillNames.includes(name), `${phase}/${projectType} 白名单含未知技能 ${name}`);
          }
          assert.ok(config.skills.length > 0, `${phase}/${projectType} 白名单为空`);
        }
      }
    });
  });

  // ==================== B2 IMPL 收敛达标（R1） ====================

  describe('B2 IMPL expert 池收敛（R1：18 → 3–4）', () => {
    test('ruoyi 工程：expert 池 18 → 4（expert-ruoyi 系）', () => {
      const config = getWhitelist('impl', 'ruoyi');
      assert.equal(config.expert_pool.before, expertDirSkills.length); // 18
      assert.equal(config.expert_pool.after, 4);
      assert.ok(config.expert_pool.after >= IMPL_EXPERT_POOL_TARGET.min);
      assert.ok(config.expert_pool.after <= IMPL_EXPERT_POOL_TARGET.max);
      const expertsInWhitelist = config.skills.filter(n => expertDirSkills.includes(n));
      assert.deepEqual(expertsInWhitelist.sort(), ['expert-activiti', 'expert-mysql', 'expert-ruoyi', 'expert-ruoyi-permission']);
      assert.ok(config.skills.includes('pdd-implement-feature'));
    });

    test('动态排除列 = 全量 expert − 命中栈 expert（§2.1：命中哪栈才装哪栈）', () => {
      const config = getWhitelist('impl', 'ruoyi');
      const excludedExperts = config.exclude_skills.filter(n => expertDirSkills.includes(n));
      assert.equal(excludedExperts.length, expertDirSkills.length - 4);
      assert.ok(excludedExperts.includes('expert-security'));
      assert.ok(excludedExperts.includes('expert-vue3'));
      assert.ok(excludedExperts.includes('expert-kotlin'));
      // 排除技能与保留技能零交集
      for (const name of config.skills) {
        assert.equal(excludedExperts.includes(name), false);
      }
    });
  });

  // ==================== B3 触发语义不变（R2） ====================

  describe('B3/R2 触发语义不变（白名单为纯配置）', () => {
    test('白名单输出深冻结（零副作用，不可被调用方改写）', () => {
      const config = getWhitelist('impl', 'ruoyi');
      assert.equal(Object.isFrozen(config), true);
      assert.equal(Object.isFrozen(config.skills), true);
      assert.equal(Object.isFrozen(config.include_skills), true);
      assert.equal(Object.isFrozen(config.exclude_skills), true);
    });

    test('模块零 fs 写操作（R2：不触碰技能树，触发判定归 SKILL.md 与宿主）', () => {
      const source = readFileSync(path.join(__dirname, '../../lib/context-assembly/phase-whitelist.js'), 'utf-8');
      assert.doesNotMatch(source, /writeFileSync|appendFileSync|rmSync|mkdirSync|unlinkSync/);
    });

    test('白名单不缩减 Tier 0 常驻索引（53 技能索引始终全量）', () => {
      const config = getWhitelist('impl', 'ruoyi');
      const { plan } = assemble({
        phase: 'impl',
        sessionId: 'b3-tier0-intact',
        family: 'openai',
        triggeredSkills: ['pdd-implement-feature'],
        whitelist: config.skills
      });
      assert.equal(plan.tiers.t0.index.length, 53); // 触发层全量常驻（R2/Tier 0）
    });
  });

  // ==================== T1 栈限定互斥 ====================

  describe('T1 栈限定（android 工程不装配 ruoyi expert，反之亦然）', () => {
    test('android-kotlin ∩ ruoyi 栈 expert = ∅（双向）', () => {
      const android = STACK_EXPERT_MAP['android-kotlin'];
      const ruoyi = STACK_EXPERT_MAP['ruoyi'];
      for (const name of android) assert.equal(ruoyi.includes(name), false);
      for (const name of ruoyi) assert.equal(android.includes(name), false);
    });

    test('android 工程白名单不含任何 ruoyi expert；ruoyi 工程不含 android expert', () => {
      const androidCfg = getWhitelist('impl', 'android-kotlin');
      const ruoyiCfg = getWhitelist('impl', 'ruoyi');
      for (const name of androidCfg.skills) {
        assert.equal(['expert-ruoyi', 'expert-ruoyi-permission', 'expert-activiti', 'expert-mysql'].includes(name), false);
      }
      for (const name of ruoyiCfg.skills) {
        assert.equal(['expert-kotlin', 'expert-jetpack', 'expert-android', 'expert-android-test'].includes(name), false);
      }
    });

    test('mixed = 双栈并集（spring-boot ∪ android 系，§2.1）', () => {
      const mixed = getWhitelist('impl', 'mixed');
      const springBoot = STACK_EXPERT_MAP['spring-boot'];
      const androidCompose = STACK_EXPERT_MAP['android-compose'];
      for (const name of springBoot) assert.ok(mixed.skills.includes(name), `mixed 缺通用角色 ${name}`);
      for (const name of androidCompose) assert.ok(mixed.skills.includes(name), `mixed 缺 android 栈 ${name}`);
      assert.equal(mixed.expert_pool.after, springBoot.length + androidCompose.length);
    });
  });

  // ==================== T2 STACK_UNRESOLVED 降级 ====================

  describe('T2 未识别栈降级（§1.3）', () => {
    test('impl+unknown → 降级仅 core 类 + WARN + notice=STACK_UNRESOLVED', (t) => {
      const warnSpy = t.mock.method(console, 'warn', () => {});
      const config = getWhitelist('impl', 'unknown');
      assert.equal(config.degraded, true);
      assert.equal(config.notice, 'STACK_UNRESOLVED');
      assert.equal(config.project_type, 'unknown');
      // 降级白名单 = 仅 core 目录技能（无 expert）
      assert.deepEqual(config.skills.slice().sort(), coreDirSkills.slice().sort());
      for (const name of config.skills) {
        assert.equal(expertDirSkills.includes(name), false);
      }
      assert.equal(config.expert_pool.after, 0);
      assert.ok(warnSpy.mock.calls.some(c => c.arguments[0].includes('STACK_UNRESOLVED')));
    });

    test('非法 projectType 按 unknown 归一（impl 走 STACK_UNRESOLVED 降级）', (t) => {
      const warnSpy = t.mock.method(console, 'warn', () => {});
      const config = getWhitelist('impl', 'mystery-stack');
      assert.equal(config.project_type, 'unknown');
      assert.equal(config.degraded, true);
      assert.ok(warnSpy.mock.calls.length > 0);
    });

    test('PHASE_UNKNOWN：非法 phase 拒绝并返回 5 枚举', () => {
      assert.throws(() => getWhitelist('no-such-phase', 'ruoyi'), (err) => {
        assert.match(err.message, /PHASE_UNKNOWN/);
        for (const phase of ALL_PHASES) assert.ok(err.message.includes(phase));
        return true;
      });
    });

    test('非 impl 阶段 unknown 栈不降级（栈无关白名单照常输出）', () => {
      const config = getWhitelist('analysis', 'unknown');
      assert.equal(config.degraded, undefined);
      assert.ok(config.skills.includes('pdd-ba'));
      const verifyCfg = getWhitelist('verify', 'unknown');
      assert.equal(verifyCfg.skills.includes('expert-android-test'), false); // 栈测试 expert 仅 android
      assert.ok(verifyCfg.skills.includes('testcase-agent')); // 通用测试 expert 保留
    });
  });

  // ==================== T3 稳定化联动（FP-005 审计） ====================

  describe('T3/I1 白名单装配经 FP-TOKO-003 主流程（内嵌 FP-005 auditOrder）', () => {
    test('白名单注入点生效：白名单内注入、白名单外跳过，装配通过稳定化审计', () => {
      const config = getWhitelist('impl', 'ruoyi');
      const { plan, manifest: quote } = assemble({
        phase: 'impl',
        sessionId: 't3-cag-injection',
        family: 'openai',
        triggeredSkills: ['pdd-implement-feature', 'expert-ruoyi', 'expert-security'], // security 不在白名单
        whitelist: config.skills
      });
      const injected = plan.tiers.t1.skills.map(s => s.name);
      assert.ok(injected.includes('pdd-implement-feature'));
      assert.ok(injected.includes('expert-ruoyi')); // 命中栈保留
      assert.equal(injected.includes('expert-security'), false); // 未命中栈不注入（不报错，装配继续）
      // 审计通过 = assemble 未抛 AUDIT_* 且 manifest 有效下发
      assert.equal(quote.manifest_version, '1.0');
      assert.ok(quote.tiers.t1.skills.length >= injected.length);
    });
  });

  // ==================== T4 Android 链路受益 ====================

  describe('T4 Android 链路（expert-kotlin/expert-jetpack 正确保留）', () => {
    test('android-kotlin 保留 expert-kotlin/expert-android/expert-android-test', () => {
      const config = getWhitelist('impl', 'android-kotlin');
      for (const name of ['expert-kotlin', 'expert-android', 'expert-android-test', 'pdd-implement-feature']) {
        assert.ok(config.skills.includes(name), `android-kotlin 白名单缺 ${name}`);
      }
      assert.equal(config.skills.includes('expert-jetpack'), false); // compose 专属不进 kotlin 栈
    });

    test('android-compose 保留 expert-jetpack + kotlin 系', () => {
      const config = getWhitelist('impl', 'android-compose');
      for (const name of ['expert-jetpack', 'expert-kotlin', 'expert-android', 'expert-android-test']) {
        assert.ok(config.skills.includes(name), `android-compose 白名单缺 ${name}`);
      }
      assert.equal(config.expert_pool.after, 4); // R1 区间内
    });

    test('Android 工程白名单装配可实际注入（端到端）', () => {
      const config = getWhitelist('impl', 'android-compose');
      const { plan } = assemble({
        phase: 'impl',
        sessionId: 't4-android-e2e',
        family: 'openai',
        triggeredSkills: ['expert-jetpack', 'expert-ruoyi'], // ruoyi 非 android 栈
        whitelist: config.skills
      });
      const injected = plan.tiers.t1.skills.map(s => s.name);
      assert.ok(injected.includes('expert-jetpack'));
      assert.equal(injected.includes('expert-ruoyi'), false);
    });
  });

  // ==================== T5/I2 全量对比报告（R4） ====================

  describe('T5/I2 装配规模对比报告（R4 / doc 05 §6-T3）', () => {
    const report = buildAssemblyScaleReport({
      sessionId: 't5-scale-report',
      projectType: 'ruoyi',
      family: 'openai'
    });

    test('报告覆盖 5 阶段，after ≤ before（白名单只收不涨）', () => {
      assert.equal(report.per_phase.length, 5);
      assert.deepEqual(report.per_phase.map(p => p.phase), ALL_PHASES);
      for (const row of report.per_phase) {
        assert.ok(row.after.skills <= row.before.skills, `${row.phase} 白名单后装配数不增`);
        assert.ok(row.after.tokens_est <= row.before.tokens_est, `${row.phase} 白名单后 token 不增`);
        assert.ok(typeof row.after.reduction_ratio === 'number' && row.after.reduction_ratio >= 0);
      }
    });

    test('B2 量化证据：expert_pool 18 → 4（ruoyi）', () => {
      assert.equal(report.expert_pool.before, 18);
      assert.equal(report.expert_pool.after, 4);
    });

    test('I2：整体压缩比可核算（M3 口径衔接，>0 且 ≤1）', () => {
      assert.equal(typeof report.overall.reduction_ratio, 'number');
      assert.ok(Number.isFinite(report.overall.reduction_ratio));
      assert.ok(report.overall.reduction_ratio > 0, '白名单应产生正向压缩');
      assert.ok(report.overall.reduction_ratio <= 1);
      assert.ok(report.overall.after_tokens < report.overall.before_tokens);
      assert.match(report.m3_note, /M3/);
      assert.match(report.m3_note, /FP-TOKO-014/);
    });

    test('unknown 栈报告：impl 行带降级标注且压缩最大（18→0 expert）', () => {
      const degradedReport = buildAssemblyScaleReport({
        sessionId: 't5-scale-degraded',
        projectType: 'unknown',
        family: 'openai'
      });
      const implRow = degradedReport.per_phase.find(p => p.phase === 'impl');
      assert.equal(implRow.degraded, true);
      assert.equal(implRow.notice, 'STACK_UNRESOLVED');
      assert.ok(implRow.after.skills < implRow.before.skills);
    });
  });
});
