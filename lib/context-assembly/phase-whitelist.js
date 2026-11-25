// lib/context-assembly/phase-whitelist.js - 阶段感知装配白名单（FP-TOKO-011 / doc 05 §3.1.2、§6-T3）
//
// 职责（FP-TOKO-011 §3.1 处理流程）：
//   1. CAG 发起装配（带 phase）→ 2. 探测器结果解析工程类型（只读消费 detector 7 值枚举）→
//   3. 查白名单矩阵（§2.1 强制表）→ 4. 过滤可装配集合 → 5. 交给 FP-TOKO-005 稳定化审计（由
//   FP-TOKO-003 assemble 主流程内嵌 auditOrder 承接）→ 6. 输出收敛后的装配计划。
//
// 红线：
//   - R1：IMPL 期 expert 池从 18 收敛到 3–4（命中栈限定；§2.1 STACK_EXPERT_MAP 映射）；
//   - R2：白名单只约束注入顺序与默认深度，不改变触发词语义——本模块为纯配置（零 fs 写操作、
//     输出深冻结），技能触发判定仍由 SKILL.md front matter 与宿主决策，Tier 0 全量索引始终常驻；
//   - R3：白名单装配必须通过前缀稳定化审计——getWhitelist 输出直接投喂 assemble({whitelist})，
//     审计由 FP-TOKO-003 主流程内嵌 auditOrder 强制执行（违规即抛错退回）；
//   - R4：T3 全量接入后产出各阶段装配规模对比报告（buildAssemblyScaleReport，doc 05 §6-T3 验收；
//     M3 综合压缩口径衔接：整体 token 压缩比由 FP-TOKO-014 核算消费）。

import { PHASES } from '../token/budget-manager.js'; // 只读消费 5 阶段枚举（与 FP-002/003 同口径）
import { buildTierManifest } from '../streaming/tier-metadata.js';
import { assemble } from './index.js'; // FP-003 装配入口（内嵌 FP-005 auditOrder）；index 不反向依赖本模块，无循环

/** §2.2 project_type 枚举（detector.js JSDoc 7 值，3.4.0 既有能力，只读消费） */
export const PROJECT_TYPES = Object.freeze([
  'spring-boot', 'ruoyi', 'vue3', 'android-kotlin', 'android-compose', 'mixed', 'unknown'
]);

/**
 * §2.1 栈映射：detector type → IMPL 期可装配 expert 清单（R1：命中哪栈才装哪栈）
 *
 * 映射口径（源自 §2.1 impl 行）：
 *   - ruoyi → expert-ruoyi 系（4 个，B2 收敛目标 3–4）；
 *   - spring-boot → 通用核心工程角色（无专属栈 expert）；
 *   - vue3 → expert-vue3 + 通用工程角色；
 *   - android-kotlin / android-compose → expert-kotlin / expert-jetpack 系（T4：Android 链路受益）；
 *   - mixed → 双栈并集（detector mixed = Java 后端 + Android，取并集保全功能，R2）；
 *   - unknown → STACK_UNRESOLVED 降级（仅 core 类，无 expert）。
 */
export const STACK_EXPERT_MAP = Object.freeze({
  'spring-boot': Object.freeze(['software-engineer', 'software-architect', 'system-architect']),
  'ruoyi': Object.freeze(['expert-ruoyi', 'expert-ruoyi-permission', 'expert-activiti', 'expert-mysql']),
  'vue3': Object.freeze(['expert-vue3', 'software-engineer']),
  'android-kotlin': Object.freeze(['expert-kotlin', 'expert-android', 'expert-android-test']),
  'android-compose': Object.freeze(['expert-jetpack', 'expert-kotlin', 'expert-android', 'expert-android-test']),
  'mixed': Object.freeze([
    'software-engineer', 'software-architect', 'system-architect',
    'expert-kotlin', 'expert-jetpack', 'expert-android', 'expert-android-test'
  ]),
  'unknown': Object.freeze([])
});

/** verify 阶段栈对应测试 expert（§2.1 verify 行：pdd-verify-feature + 对应测试 expert） */
const STACK_TEST_EXPERTS = Object.freeze({
  'android-kotlin': Object.freeze(['expert-android-test']),
  'android-compose': Object.freeze(['expert-android-test'])
});

/** R1 目标区间（B2：IMPL 期 expert 池 18 → 3–4） */
export const IMPL_EXPERT_POOL_TARGET = Object.freeze({ min: 3, max: 4 });

/**
 * §2.1 PHASES × 技能类别白名单矩阵（静态配置，随包发布）
 *
 * 字段说明：
 *   - include_categories：整目录纳入（§1.2，实际目录名 core/entropy/expert/openspec/pr）；
 *   - include_skills：显式纳入技能（§2.1"默认可装配"列到实际 53 技能树的映射）；
 *   - exclude_categories / exclude_skills：§2.1"明确排除"列（impl 行为动态排除：未命中栈 expert）。
 *
 * 映射注记（§2.1 行 → 实际技能树）：
 *   - analysis"core 拆解类 + BA" → pdd-main/pdd-ba/pdd-extract-features/pdd-generate-spec（PRD→FP 拆解链）；
 *   - design"架构专家" → software-architect/system-architect（expert 目录内通用架构角色）；
 *   - review"bug 模式" → expert-bug-fixer；
 *   - verify"对应测试 expert" → testcase-agent/testcase-modeler（通用）+ 栈测试 expert（STACK_TEST_EXPERTS）。
 */
export const PHASE_WHITELIST_MATRIX = Object.freeze({
  analysis: Object.freeze({
    include_categories: Object.freeze([]),
    include_skills: Object.freeze(['pdd-main', 'pdd-ba', 'pdd-extract-features', 'pdd-generate-spec']),
    exclude_categories: Object.freeze(['pr', 'expert']),
    exclude_skills: Object.freeze([])
  }),
  design: Object.freeze({
    include_categories: Object.freeze([]),
    include_skills: Object.freeze(['pdd-design-spec', 'software-architect', 'system-architect']),
    exclude_categories: Object.freeze([]),
    exclude_skills: Object.freeze(['testcase-agent', 'testcase-modeler']) // §2.1：排除 testcase 类
  }),
  impl: Object.freeze({
    include_categories: Object.freeze([]),
    include_skills: Object.freeze(['pdd-implement-feature']), // + 栈 expert（STACK_EXPERT_MAP 运行时解析）
    exclude_categories: Object.freeze([]),
    exclude_skills: Object.freeze([]) // 动态：全量 expert − 命中栈 expert（§2.1"命中哪栈才装哪栈"）
  }),
  review: Object.freeze({
    include_categories: Object.freeze([]),
    include_skills: Object.freeze(['pdd-code-reviewer', 'expert-bug-fixer']),
    exclude_categories: Object.freeze([]),
    exclude_skills: Object.freeze(['pdd-ba', 'pdd-generate-spec', 'pdd-design-spec']) // §2.1：排除 BA/spec 类
  }),
  verify: Object.freeze({
    include_categories: Object.freeze([]),
    include_skills: Object.freeze(['pdd-verify-feature', 'testcase-agent', 'testcase-modeler']),
    exclude_categories: Object.freeze([]),
    exclude_skills: Object.freeze(['pdd-design-spec']) // §2.1：排除设计类
  })
});

/** @private 全量技能清单（name → category），进程内缓存 */
let skillCatalogCache = null;

/** @private */
function getSkillCatalog(skillsRoot) {
  if (!skillCatalogCache) {
    const manifest = buildTierManifest({ skillsRoot });
    skillCatalogCache = new Map(manifest.skills.map(s => [s.name, s.category]));
  }
  return skillCatalogCache;
}

/** @private 冻结输出配置（R2：纯配置零副作用） */
function freezeConfig(config) {
  Object.freeze(config);
  Object.freeze(config.include_categories);
  Object.freeze(config.include_skills);
  Object.freeze(config.exclude_categories);
  Object.freeze(config.exclude_skills);
  Object.freeze(config.skills);
  return config;
}

/** @private STACK_UNRESOLVED WARN（§1.3：IMPL 期降级仅 core，WARN 记录） */
function warnStackUnresolved(projectType) {
  console.warn(`[STACK_UNRESOLVED] 探测器无法判定工程类型（${JSON.stringify(projectType)}），IMPL 期白名单降级为"仅 core 类"（FP-TOKO-011 §1.3）`);
}

/**
 * 阶段白名单查询（§1.1）
 *
 * @param {'analysis'|'design'|'impl'|'review'|'verify'} phase - 5 阶段枚举
 * @param {string} projectType - detector 实际输出（PROJECT_TYPES 7 值；非法值按 unknown 归一）
 * @param {{skillsRoot?:string}} [opts] - 技能树根目录（与 FP-TOKO-003 assemble 同口径）
 * @returns {Object} §1.2 白名单配置（深冻结）
 *   { phase, project_type, include_categories, include_skills, exclude_categories, exclude_skills,
 *     skills, source, degraded?, notice?, expert_pool? }
 *   - skills：解析后的具体技能名清单，可直接投喂 assemble({whitelist: config.skills})（I1 注入点）；
 *   - degraded/notice：仅 impl+unknown 时出现（STACK_UNRESOLVED 降级，§1.3）；
 *   - expert_pool：仅 impl 时出现 {before, after}（R1 收敛证据）。
 * @throws {Error} PHASE_UNKNOWN
 */
export function getWhitelist(phase, projectType, opts = {}) {
  if (!Object.values(PHASES).includes(phase)) {
    throw new Error(`PHASE_UNKNOWN: phase 必须为 ${Object.values(PHASES).join('/')}，得到 ${JSON.stringify(phase)}`);
  }
  const normalizedType = PROJECT_TYPES.includes(projectType) ? projectType : 'unknown';
  const catalog = getSkillCatalog(opts.skillsRoot);
  const row = PHASE_WHITELIST_MATRIX[phase];
  const expertPool = [...catalog.entries()].filter(([, cat]) => cat === 'expert').map(([name]) => name);

  let stackExperts = [];
  let degraded = false;
  let notice;

  if (phase === 'impl') {
    if (normalizedType === 'unknown') {
      // §1.3：STACK_UNRESOLVED → IMPL 期降级为"仅 core 类"，WARN 记录
      degraded = true;
      notice = 'STACK_UNRESOLVED';
      warnStackUnresolved(projectType);
    } else {
      stackExperts = [...STACK_EXPERT_MAP[normalizedType]];
    }
  }
  if (phase === 'verify' && normalizedType !== 'unknown') {
    stackExperts = [...(STACK_TEST_EXPERTS[normalizedType] || [])];
  }

  // 解析可装配集合：include_categories 整目录 + include_skills + 栈 expert − 排除
  // §1.3：STACK_UNRESOLVED 降级时 include_categories 归一为 ['core']（IMPL 期仅 core 类）
  const includeCategories = degraded ? ['core'] : row.include_categories;
  const included = new Set();
  for (const category of includeCategories) {
    for (const [name, cat] of catalog.entries()) {
      if (cat === category) included.add(name);
    }
  }
  const includeSkills = [...row.include_skills, ...stackExperts];
  for (const name of includeSkills) {
    if (!catalog.has(name)) {
      throw new Error(`WHITELIST_STALE: 矩阵技能 ${name} 不存在于 53 技能清单（矩阵与技能树失配，请复标）`);
    }
    included.add(name);
  }
  // 排除：整目录 + 显式技能 + impl 动态排除（未命中栈 expert）
  const excludedCategories = new Set(row.exclude_categories);
  const excludeSkills = new Set(row.exclude_skills);
  if (phase === 'impl') {
    for (const name of expertPool) {
      if (!stackExperts.includes(name)) excludeSkills.add(name); // §2.1：全量 expert（命中哪栈才装哪栈）
    }
  }
  for (const name of [...included]) {
    if (excludedCategories.has(catalog.get(name)) || excludeSkills.has(name)) included.delete(name);
  }

  const config = {
    phase,
    project_type: normalizedType,
    include_categories: [...includeCategories], // 降级时如实反映 ['core']（§1.3）
    include_skills: includeSkills,
    exclude_categories: [...row.exclude_categories],
    exclude_skills: [...excludeSkills],
    skills: [...included].sort(),
    source: 'detector'
  };
  if (degraded) {
    config.degraded = true;
    config.notice = notice;
  }
  if (phase === 'impl') {
    config.expert_pool = {
      before: expertPool.length, // R1：收敛前全量 expert 池（18）
      after: normalizedType === 'unknown' ? 0 : stackExperts.length
    };
  }
  return freezeConfig(config);
}

/**
 * 各阶段装配规模对比报告（R4 / T5 / doc 05 §6-T3 验收产出；FP-TOKO-014 M1/M3 核算消费）
 *
 * 口径：
 *   - before：未过滤场景——全部候选技能作为 triggeredSkills 直接装配（白名单不生效）；
 *   - after：白名单场景——同一 triggeredSkills 经 getWhitelist(phase, projectType).skills 过滤装配；
 *   - 两组装配分别使用独立会话（FP-TOKO-003 R2 会话内 Tier 1 不可逆并集，互不污染）；
 *   - before/after 均经 FP-TOKO-003 assemble 主流程（内嵌 FP-TOKO-005 auditOrder，R3 天然满足）。
 *
 * @param {{sessionId:string, projectType:string, family:string, skillsRoot?:string,
 *          candidates?:string[]}} opts
 *   - candidates 缺省 = 全量 53 技能（未过滤=T3 全量接入前的现状基线）
 * @returns {Object} { generated_at, project_type, per_phase:[{phase, before:{skills,tokens_est},
 *   after:{skills,tokens_est,reduction_ratio}}], expert_pool:{before,after}, overall:{before_tokens,
 *   after_tokens, reduction_ratio}, m3_note }
 */
export function buildAssemblyScaleReport(opts = {}) {
  const { sessionId, projectType, family, skillsRoot, candidates } = opts;
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('REPORT_SESSION_REQUIRED: sessionId 必须为非空字符串');
  }
  if (typeof family !== 'string' || family.length === 0) {
    throw new Error('REPORT_FAMILY_REQUIRED: family 必须为非空字符串');
  }
  // 装配入口 assemble（静态导入；FP-003 R2 会话内 Tier 1 不可逆并集，报告用独立会话隔离）

  const catalog = getSkillCatalog(skillsRoot);
  const allSkills = [...catalog.keys()];
  const triggerCandidates = Array.isArray(candidates) && candidates.length > 0 ? candidates : allSkills;
  const expertPoolBefore = [...catalog.values()].filter(cat => cat === 'expert').length;

  const perPhase = [];
  let beforeTokens = 0;
  let afterTokens = 0;
  let expertPoolAfter = 0;

  for (const phase of Object.values(PHASES)) {
    const whitelistConfig = getWhitelist(phase, projectType, { skillsRoot });
    if (phase === 'impl') expertPoolAfter = whitelistConfig.expert_pool.after;

    const runAssembly = (mode, whitelist) => assemble({
      phase,
      sessionId: `${sessionId}-${mode}-${phase}`, // 会话隔离（R2 不可逆并集互不污染）
      family,
      triggeredSkills: triggerCandidates,
      ...(whitelist ? { whitelist } : {}),
      ...(skillsRoot ? { skillsRoot } : {})
    });

    const before = runAssembly('before', null);
    const after = runAssembly('after', whitelistConfig.skills);

    const beforeCount = before.plan.tiers.t1.skills.length;
    const afterCount = after.plan.tiers.t1.skills.length;
    const beforeEst = before.manifest.tiers.t1.tokens_estimate;
    const afterEst = after.manifest.tiers.t1.tokens_estimate;
    beforeTokens += beforeEst;
    afterTokens += afterEst;

    perPhase.push({
      phase,
      whitelist_source: whitelistConfig.source,
      ...(whitelistConfig.degraded ? { degraded: true, notice: whitelistConfig.notice } : {}),
      before: { skills: beforeCount, tokens_est: beforeEst },
      after: {
        skills: afterCount,
        tokens_est: afterEst,
        reduction_ratio: beforeEst > 0 ? Number(((beforeEst - afterEst) / beforeEst).toFixed(4)) : 0
      }
    });
  }

  return {
    generated_at: new Date().toISOString(),
    project_type: PROJECT_TYPES.includes(projectType) ? projectType : 'unknown',
    per_phase: perPhase,
    expert_pool: { before: expertPoolBefore, after: expertPoolAfter }, // R1：18 → 3–4（B2）
    overall: {
      before_tokens: beforeTokens,
      after_tokens: afterTokens,
      reduction_ratio: beforeTokens > 0 ? Number(((beforeTokens - afterTokens) / beforeTokens).toFixed(4)) : 0
    },
    m3_note: 'M3 综合压缩口径：overall.reduction_ratio 为五阶段 Tier 1 白名单过滤 token 压缩比（doc 05 §6 综合压缩目标 ≥40% 的装配侧分量）；全量口径（含 Tier 0 常驻与实测偏差）由 FP-TOKO-014 核算'
  };
}
