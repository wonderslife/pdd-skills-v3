// lib/context-assembly/index.js - CAG 上下文装配网关（FP-TOKO-003 / doc 05 §3.1.1、§3.1.5、路线图 T1）
//
// 职责（FP-TOKO-003 §3.1 处理流程）：
//   1. 接收装配请求（phase/session/family）→ 2. Tier 0 全量索引装配 → 3. 触发命中的技能按需装 Tier 1 →
//   4. 步骤声明需要时装 Tier 2 → 5. 工具产物装 Tier 3 → 6. 生成 manifest（含 budget_state，数据源 FP-TOKO-002）→
//   7. 交付宿主装配计划。
//
// 四层装配模型（§2.1）：Tier 0 索引层（name+精简 description+触发词，常驻）/ Tier 1 核心层（SKILL.md 正文，触发按需）/
// Tier 2 参考层（references/*.md，懒注入）/ Tier 3 工件层（运行时产物，摘要注入可替换）。
//
// 红线：
//   - R1：默认只装 Tier 0；Tier 1/2/3 必须有显式触发依据（triggeredSkills / tier2References / artifacts 入参）；
//   - R2：技能一旦装配，会话内不回溯移除（Tier 1/2 不可逆并集；Tier 3 仅被新产物替换）；
//   - R4：既有模块零改动，只读消费 FP-TOKO-001（profile）/ FP-TOKO-002（budget_state）/ FP-TOKO-009（tier 元数据）；
//   - R5：触发词语义不变——本模块约束注入顺序与默认深度，不改变触发判定；
//   - R6：Tier 0 规模阈值 7,100 为 doc 03 48 技能基线口径推算值；53 技能实测 ~6.2k（见单测 B2），复标结果回写本阈值。

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadProfile, FAMILIES, FALLBACK_PROFILE_ID } from '../streaming/profiles/index.js';
import { segmentContent, estimateTokensFromSegments } from '../streaming/segment.js';
import { buildTierManifest } from '../streaming/tier-metadata.js';
import { getPhaseDistribution } from '../token/estimation-track.js';
import { PHASES } from '../token/budget-manager.js';
import { auditOrder } from './prefix-stability.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SKILLS_ROOT = path.join(__dirname, '..', '..', 'skills');

/** manifest 语义化版本（§2.2：新增事件不升 major，语义变更必须升 major 并双发 6 个月） */
export const MANIFEST_VERSION = '1.0';

/** Tier 0 规模阈值（R6：doc 05 §3.1.5 口径；53 技能复标后回写） */
export const TIER0_TOKEN_LIMIT = 7100;

/** doc 03 §3.1 Layer 0 精简规范：description ≤200 字符 */
export const TIER0_DESCRIPTION_MAX_CHARS = 200;

/** 会话内存态（R2 不可逆追加）：sessionId → { tier1: Map, tier2: Map, tier3: Map } */
const sessions = new Map();

/** 最近一次装配报价单（MCP resource pdd://context/manifest 数据源，T5） */
let latestManifest = null;

// ==================== 索引层渲染 ====================

/**
 * doc 03 §3.1 Layer 0 精简：description 截断至 ≤200 字符
 * @private
 * @param {string} description
 * @returns {string}
 */
function condenseDescription(description) {
  if (typeof description !== 'string') return '';
  return description.length <= TIER0_DESCRIPTION_MAX_CHARS ? description : description.slice(0, TIER0_DESCRIPTION_MAX_CHARS);
}

/**
 * 剥离 SKILL.md front matter，返回正文（Tier 1 载荷：正文不含索引层已有的元数据）
 * @private
 */
function stripFrontMatter(content) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

/**
 * 渲染 Tier 0 单技能索引行（name + 精简 description + 触发词）
 * @private
 */
function renderTier0Line(skill) {
  const desc = condenseDescription(skill.description);
  const triggers = (skill.triggers || []).join(', ');
  return triggers ? `${skill.name}: ${desc} | 触发: ${triggers}` : `${skill.name}: ${desc}`;
}

/**
 * 解析 Tier 2 引用格式：{skill}/{references/...}
 * @private
 */
function parseTier2Ref(ref) {
  if (typeof ref !== 'string' || ref.length === 0) {
    throw new Error(`REF_MALFORMED: tier2 引用必须为 "{skill}/{references/...}" 格式，得到 ${JSON.stringify(ref)}`);
  }
  const slashIdx = ref.indexOf('/');
  if (slashIdx <= 0) {
    throw new Error(`REF_MALFORMED: tier2 引用必须为 "{skill}/{references/...}" 格式，得到 ${ref}`);
  }
  return { skillName: ref.slice(0, slashIdx), relPath: ref.slice(slashIdx + 1) };
}

/** @private */
function getSessionState(sessionId) {
  let state = sessions.get(sessionId);
  if (!state) {
    state = { tier1: new Map(), tier2: new Map(), tier3: new Map() };
    sessions.set(sessionId, state);
  }
  return state;
}

/** @private */
function estimateText(text, family) {
  return estimateTokensFromSegments(segmentContent(text), loadProfile(family));
}

// ==================== 装配入口 ====================

/**
 * CAG 装配入口（FP-TOKO-003 §1.1）
 *
 * request 字段：
 * - phase {string} 必填，5 阶段枚举（PHASE_UNKNOWN 拒绝）；
 * - sessionId {string} 必填，会话内装配状态按此聚合（R2）；
 * - family {string} 必填，tokenizer family（FP-TOKO-001，未登记降级 openai(fallback)）；
 * - tierLimits {Object} 可选，{t0?,t1?,t2?,t3?} 单 Tier 估算上限；t0 缺省 TIER0_TOKEN_LIMIT，
 *   传 null 显式关闭该 Tier 上限；超限抛 TIER_OVERFLOW（摘要化降级由 FP-TOKO-004 提供，当前拒绝并返回原因）；
 * - triggeredSkills {string[]} 可选，触发词命中的技能名（R1：Tier 1 显式触发依据）；
 * - tier2References {string[]} 可选，"{skill}/{references/...}" 引用（R1：步骤显式声明）；
 * - artifacts {Array<{ref, content}>} 可选，工具产物摘要（FP-TOKO-004 产出；新产物替换旧产物）；
 * - whitelist {string[]|null} 可选，阶段白名单（FP-TOKO-011 注入点：仅白名单内技能可注入 Tier 1）；
 * - skillsRoot {string} 可选，技能树根目录（宿主嵌入自有技能树时覆盖，默认包内 skills/）。
 *
 * @param {Object} request
 * @returns {{plan:Object, manifest:Object}} 装配计划（含载荷）+ 装配报价单（§1.2 Schema）
 * @throws {Error} PHASE_UNKNOWN / TIER_OVERFLOW / MANIFEST_MALFORMED / SKILL_NOT_FOUND /
 *                REF_MALFORMED / REF_NOT_FOUND / SESSION_ID_REQUIRED / FAMILY_REQUIRED
 */
export function assemble(request = {}) {
  const {
    phase,
    sessionId,
    family,
    tierLimits = {},
    triggeredSkills = [],
    tier2References = [],
    artifacts = [],
    whitelist = null,
    skillsRoot = DEFAULT_SKILLS_ROOT
  } = request;

  // 1. 入参校验
  if (!Object.values(PHASES).includes(phase)) {
    throw new Error(`PHASE_UNKNOWN: phase 必须为 ${Object.values(PHASES).join('/')}，得到 ${phase}`);
  }
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('SESSION_ID_REQUIRED: sessionId 必须为非空字符串');
  }
  if (typeof family !== 'string' || family.length === 0) {
    throw new Error('FAMILY_REQUIRED: family 必须为非空字符串');
  }

  const profile = loadProfile(family);
  const tokenizerProfile = profile.tokenizer_profile || profile.family;

  // 2. Tier 0 全量索引（R1：默认只装 Tier 0；来源 FP-TOKO-009 元数据；skillsRoot 支持宿主嵌入自有技能树）
  const tierManifest = buildTierManifest({ skillsRoot });
  const skillByName = new Map(tierManifest.skills.map(s => [s.name, s]));
  const t0Index = tierManifest.skills.map(skill => ({
    name: skill.name,
    category: skill.category,
    text: renderTier0Line(skill)
  }));

  // 3. Tier 1 按需装配（R1 显式触发依据 + R2 不可逆并集 + FP-TOKO-011 白名单注入点）
  const state = getSessionState(sessionId);
  for (const name of triggeredSkills) {
    const skill = skillByName.get(name);
    if (!skill) {
      throw new Error(`SKILL_NOT_FOUND: 触发技能 ${name} 不存在于 53 技能清单`);
    }
    if (Array.isArray(whitelist) && !whitelist.includes(name)) {
      continue; // FP-TOKO-011：白名单外技能不注入（不报错，装配继续）
    }
    if (!state.tier1.has(name)) {
      const skillMdPath = path.join(skillsRoot, skill.category, name, 'SKILL.md');
      state.tier1.set(name, { name, content: stripFrontMatter(fs.readFileSync(skillMdPath, 'utf-8')) });
    }
  }

  // 4. Tier 2 懒注入（R1 步骤显式声明 + R2 不可逆并集）
  for (const ref of tier2References) {
    if (!state.tier2.has(ref)) {
      const { skillName, relPath } = parseTier2Ref(ref);
      const skill = skillByName.get(skillName);
      if (!skill) {
        throw new Error(`SKILL_NOT_FOUND: tier2 引用技能 ${skillName} 不存在`);
      }
      if (!relPath.startsWith('references/')) {
        throw new Error(`REF_MALFORMED: tier2 引用必须位于 references/ 下，得到 ${ref}`);
      }
      const filePath = path.join(skillsRoot, skill.category, skillName, relPath);
      if (!fs.existsSync(filePath)) {
        throw new Error(`REF_NOT_FOUND: 引用文件不存在 ${ref}`);
      }
      state.tier2.set(ref, { ref, content: fs.readFileSync(filePath, 'utf-8') });
    }
  }

  // 5. Tier 3 工件注入（§3.3：可被新产物替换）
  if (Array.isArray(artifacts) && artifacts.length > 0) {
    state.tier3 = new Map();
    for (const artifact of artifacts) {
      if (!artifact || typeof artifact.ref !== 'string' || artifact.ref.length === 0) {
        throw new Error('REF_MALFORMED: artifacts[].ref 必须为非空字符串（如 "contract-report#digest"）');
      }
      state.tier3.set(artifact.ref, { ref: artifact.ref, content: typeof artifact.content === 'string' ? artifact.content : '' });
    }
  }

  const plan = {
    phase,
    session_id: sessionId,
    family,
    tokenizer_profile: tokenizerProfile,
    tiers: {
      t0: { index: t0Index },
      t1: { skills: [...state.tier1.values()] },
      t2: { references: [...state.tier2.values()] },
      t3: { artifacts: [...state.tier3.values()] }
    },
    budget_state: buildBudgetState(sessionId, phase),
    generated_at: new Date().toISOString()
  };

  // 6. 生成报价单并校验（MANIFEST_MALFORMED：缺陷不得下发宿主）
  const manifest = buildManifest(plan);
  const check = validateManifest(manifest);
  if (!check.valid) {
    throw new Error(`MANIFEST_MALFORMED: 生成的 manifest 不合 Schema，不下发宿主: ${check.errors.join('; ')}`);
  }

  // 单 Tier 超限检查（TIER_OVERFLOW，对接 FP-TOKO-004 摘要化降级）
  const limits = {
    t0: tierLimits.t0 === undefined ? TIER0_TOKEN_LIMIT : tierLimits.t0,
    t1: tierLimits.t1,
    t2: tierLimits.t2,
    t3: tierLimits.t3
  };
  for (const tierKey of ['t0', 't1', 't2', 't3']) {
    const limit = limits[tierKey];
    if (typeof limit === 'number' && manifest.tiers[tierKey].tokens_estimate > limit) {
      throw new Error(
        `TIER_OVERFLOW: Tier ${tierKey} 估算 ${manifest.tiers[tierKey].tokens_estimate} 超限 ${limit}；` +
        '摘要化降级将由 FP-TOKO-004 提供，当前拒绝装配并返回原因'
      );
    }
  }

  // FP-TOKO-005 I1：前缀稳定化审计嵌入主流程（§3.3 违规必退回——CRITICAL/HIGH 均阻断下发）。
  // 形态 A 顺序由构造序保证（t0→t1→t2→t3），此处审计做 R1 易变内容扫描与区块哈希。
  const audit = auditOrder(plan);
  if (!audit.passed) {
    const first = audit.violations[0];
    throw new Error(
      `${first.code}: 装配计划未通过前缀稳定化审计，退回重排（§3.3）: ` +
      audit.violations.map(v => `${v.severity}/${v.code}${v.block ? '@' + v.block : ''} ${v.detail}`).join('; ')
    );
  }

  latestManifest = manifest;
  return { plan, manifest };
}

/**
 * budget_state（I1：数据源 = FP-TOKO-002 getPhaseDistribution）
 * @private
 */
function buildBudgetState(sessionId, phase) {
  const dist = getPhaseDistribution(sessionId);
  const phaseEntry = dist.phases[phase];
  const remaining = Math.max(0, phaseEntry.budget - phaseEntry.primary_tokens);
  return {
    phase_share: phaseEntry.budget,
    consumed: phaseEntry.primary_tokens,
    remaining
  };
}

// ==================== 报价单 ====================

/**
 * 生成装配报价单（FP-TOKO-003 §1.1 / §1.2 Schema，机器可读）
 * 估算口径：载荷文本经 FP-TOKO-001 profile 分段系数（segment.js 单一实现源）。
 *
 * @param {Object} plan - assemble 产出的装配计划
 * @returns {Object} manifest（§1.2）
 */
export function buildManifest(plan) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('MANIFEST_MALFORMED: plan 必须为对象');
  }
  const tiers = plan.tiers || {};
  const t0 = tiers.t0 || { index: [] };
  const t1 = tiers.t1 || { skills: [] };
  const t2 = tiers.t2 || { references: [] };
  const t3 = tiers.t3 || { artifacts: [] };

  const tokensEstimate = {
    t0: estimateText(t0.index.map(item => item.text).join('\n'), plan.family),
    t1: estimateText(t1.skills.map(s => s.content).join('\n'), plan.family),
    t2: estimateText(t2.references.map(r => r.content).join('\n'), plan.family),
    t3: estimateText(t3.artifacts.map(a => a.content).join('\n'), plan.family)
  };

  const manifest = {
    manifest_version: MANIFEST_VERSION,
    phase: plan.phase,
    tiers: {
      t0: { skills: t0.index.length, tokens_estimate: tokensEstimate.t0 },
      t1: { skills: t1.skills.map(s => s.name), tokens_estimate: tokensEstimate.t1 },
      t2: { references: t2.references.map(r => r.ref), tokens_estimate: tokensEstimate.t2 },
      t3: { artifacts: t3.artifacts.map(a => a.ref), tokens_estimate: tokensEstimate.t3 }
    },
    tokenizer_profile: plan.tokenizer_profile,
    total_estimate:
      tokensEstimate.t0 + tokensEstimate.t1 + tokensEstimate.t2 + tokensEstimate.t3,
    budget_state: plan.budget_state
  };
  return manifest;
}

/**
 * manifest Schema 校验（§1.2；MANIFEST_MALFORMED 判定核心，辅助导出供 FP-008 复用）
 * @param {Object} manifest
 * @returns {{valid:boolean, errors:string[]}}
 */
export function validateManifest(manifest) {
  const errors = [];
  const push = (msg) => errors.push(msg);
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['manifest 必须为对象'] };
  }
  if (manifest.manifest_version !== MANIFEST_VERSION) {
    push(`manifest_version 必须为 "${MANIFEST_VERSION}"`);
  }
  if (!Object.values(PHASES).includes(manifest.phase)) {
    push(`phase 非法: ${manifest.phase}`);
  }
  const tiers = manifest.tiers || {};
  for (const key of ['t0', 't1', 't2', 't3']) {
    if (!tiers[key] || typeof tiers[key] !== 'object') {
      push(`tiers.${key} 缺失`);
    }
  }
  if (tiers.t0 && !isNum(tiers.t0.skills)) push('tiers.t0.skills 必须为非负数字（技能总数）');
  if (tiers.t1 && !Array.isArray(tiers.t1.skills)) push('tiers.t1.skills 必须为数组（技能名清单）');
  if (tiers.t2 && !Array.isArray(tiers.t2.references)) push('tiers.t2.references 必须为数组');
  if (tiers.t3 && !Array.isArray(tiers.t3.artifacts)) push('tiers.t3.artifacts 必须为数组');
  for (const key of ['t0', 't1', 't2', 't3']) {
    if (tiers[key] && !isNum(tiers[key].tokens_estimate)) push(`tiers.${key}.tokens_estimate 必须为非负数字`);
  }
  if (typeof manifest.tokenizer_profile !== 'string' || manifest.tokenizer_profile.length === 0) {
    push('tokenizer_profile 缺失');
  } else if (!FAMILIES.includes(manifest.tokenizer_profile) && manifest.tokenizer_profile !== FALLBACK_PROFILE_ID) {
    push(`tokenizer_profile 不在取值域（FAMILIES 或 ${FALLBACK_PROFILE_ID}）: ${manifest.tokenizer_profile}`);
  }
  if (!isNum(manifest.total_estimate)) {
    push('total_estimate 必须为非负数字');
  } else {
    const sum = ['t0', 't1', 't2', 't3'].reduce((s, k) => s + (tiers[k] ? tiers[k].tokens_estimate || 0 : 0), 0);
    if (manifest.total_estimate !== sum) push(`total_estimate(${manifest.total_estimate}) 必须等于四层估算之和(${sum})`);
  }
  const bs = manifest.budget_state || {};
  for (const key of ['phase_share', 'consumed', 'remaining']) {
    if (!isNum(bs[key])) push(`budget_state.${key} 必须为非负数字`);
  }
  return { valid: errors.length === 0, errors };
}

// ==================== 会话与 MCP resource ====================

/**
 * 最近一次装配报价单（MCP resource pdd://context/manifest 数据源；无装配时返回 null）
 * @returns {Object|null}
 */
export function getLatestManifest() {
  return latestManifest;
}

/**
 * 清空会话装配状态（会话结束/测试隔离用；R4 同源约定：内存态不落盘）
 * @param {string} sessionId
 */
export function clearSession(sessionId) {
  sessions.delete(sessionId);
}

export default {
  MANIFEST_VERSION,
  TIER0_TOKEN_LIMIT,
  TIER0_DESCRIPTION_MAX_CHARS,
  assemble,
  buildManifest,
  validateManifest,
  getLatestManifest,
  clearSession
};
