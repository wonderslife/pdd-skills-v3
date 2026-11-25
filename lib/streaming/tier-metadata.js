// lib/streaming/tier-metadata.js - 技能 Tier 元数据解析（FP-TOKO-009 / doc 05 §3.2、路线图 T1）
//
// 职责（FP-TOKO-009 §3.1 处理流程）：
//   1. 扫描 53 技能 → 2. 读取显式 tier（front matter 优先）→ 3. 缺省按 §2.1 推导 →
//   4. 回填 tokens_char（SKILL.md 字符数自测回填，无需手工维护）→ 5. 输出 tier 清单供 CAG（FP-TOKO-003）消费。
//
// 兼容性红线（§1.2 / R1 / R3）：
//   - tier / tokens_char 全部可选：技能不携带新字段时，既有消费方（lib/list.js、MCP、CLI）行为与 3.4.x 完全等价；
//   - 本模块只读：不写 _meta.json、不改写 front matter 任何键（T4 现有键零污染）；
//   - 触发词与 description 不因本 FP 变化（仅透传读取）。

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SKILLS_ROOT = path.join(__dirname, '..', '..', 'skills');

/** 缺省推导映射表（§2.1：core/expert/pr/openspec→1 正文层，entropy→2 参考层） */
export const TIER_DERIVATION_MAP = {
  core: 1,
  expert: 1,
  pr: 1,
  openspec: 1,
  entropy: 2
};

/** 未登记目录类别的保守缺省（参考层，防止预算膨胀；WARN 记录） */
export const UNKNOWN_CATEGORY_TIER = 2;

/** tier 语义（§2.2）：0=索引层描述（自动派生，无需标注）；1=正文；2=参考；3=工件 */
export const INDEX_TIER = 0;
export const BODY_TIER = 1;
export const REFERENCE_TIER = 2;
export const ARTIFACT_TIER = 3;

export const VALID_TIERS = [0, 1, 2, 3];

/**
 * tier 合法性校验（TIER_INVALID 判定核心）
 * @param {*} value
 * @returns {boolean}
 */
export function isValidTier(value) {
  return typeof value === 'number' && Number.isInteger(value) && VALID_TIERS.includes(value);
}

/**
 * 解析 SKILL.md YAML front matter（不抛异常：解析失败视为无显式标注，回退推导）
 * @param {string} content - SKILL.md 全文
 * @returns {Object|null} front matter 对象（无 front matter / 解析失败返回 null）
 */
export function parseFrontMatter(content) {
  if (typeof content !== 'string') return null;
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  try {
    const parsed = YAML.parse(match[1]);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    console.warn(`[FRONT_MATTER_INVALID] front matter 解析失败，回退缺省推导: ${err.message}`);
    return null;
  }
}

/**
 * 读取 _meta.json（不存在/解析失败返回 null）
 * @private
 */
function readMeta(skillDir) {
  const metaPath = path.join(skillDir, '_meta.json');
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  } catch (err) {
    console.warn(`[META_INVALID] _meta.json 解析失败，忽略: ${err.message}`);
    return null;
  }
}

/**
 * 递归收集技能 references/ 下的 .md 文件（§2.1：任意技能的 references/ → tier 2 参考层）
 * @private
 */
function collectReferences(skillDir) {
  const refsDir = path.join(skillDir, 'references');
  const files = [];
  if (!fs.existsSync(refsDir)) return files;
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push({
          file: path.relative(skillDir, full).replace(/\\/g, '/'),
          tier: REFERENCE_TIER,
          tokens_char: fs.readFileSync(full, 'utf-8').length
        });
      }
    }
  };
  walk(refsDir);
  return files;
}

/**
 * 解析单技能 tier（FP-TOKO-009 §1.1 / §3.3 状态转换）
 *
 * 优先级与冲突裁决：
 * - 显式标注生效：front matter.tier 优先，_meta.json.tier 次之；
 * - META_CONFLICT：两者均合法且不一致 → front matter 胜出 + WARN；
 * - TIER_INVALID：显式值 ∉ {0,1,2,3} → WARN 并跳过该来源，继续下一来源/推导；
 * - 缺省：按 TIER_DERIVATION_MAP 由目录类别推导（未知类别 → 参考层 2，保守）。
 *
 * @param {string} skillDir - 技能目录
 * @param {string} category - 目录类别（core/expert/pr/openspec/entropy）
 * @returns {{tier:number, tier_source:'front-matter'|'_meta.json'|'derived', warnings:Array<{code:string,detail:string}>}}
 */
export function resolveTier(skillDir, category) {
  const warnings = [];
  const derived = TIER_DERIVATION_MAP[category] ?? UNKNOWN_CATEGORY_TIER;
  if (TIER_DERIVATION_MAP[category] === undefined) {
    warnings.push({
      code: 'TIER_CATEGORY_UNKNOWN',
      detail: `未登记目录类别 ${category}，按保守缺省 tier=${UNKNOWN_CATEGORY_TIER} 推导`
    });
  }

  // 显式候选（优先级序）：front matter > _meta.json
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  const frontMatter = fs.existsSync(skillMdPath)
    ? parseFrontMatter(fs.readFileSync(skillMdPath, 'utf-8'))
    : null;
  const meta = readMeta(skillDir);

  const candidates = [];
  if (frontMatter && frontMatter.tier !== undefined) {
    candidates.push({ source: 'front-matter', value: frontMatter.tier });
  }
  if (meta && meta.tier !== undefined) {
    candidates.push({ source: '_meta.json', value: meta.tier });
  }

  const valid = [];
  for (const candidate of candidates) {
    if (isValidTier(candidate.value)) {
      valid.push(candidate);
    } else {
      warnings.push({
        code: 'TIER_INVALID',
        detail: `${path.basename(skillDir)}: ${candidate.source}.tier=${JSON.stringify(candidate.value)} ∉ {0,1,2,3}，回退推导值`
      });
    }
  }

  if (valid.length >= 2 && valid[0].value !== valid[1].value) {
    warnings.push({
      code: 'META_CONFLICT',
      detail: `${path.basename(skillDir)}: front matter.tier=${valid[0].value} 与 _meta.json.tier=${valid[1].value} 不一致，以 front matter 为准`
    });
  }

  if (valid.length > 0) {
    return { tier: valid[0].value, tier_source: valid[0].source, warnings };
  }
  return { tier: derived, tier_source: 'derived', warnings };
}

/**
 * 构建 tier 清单（FP-TOKO-009 §3.1 输出，FP-TOKO-003/FP-TOKO-011 消费）
 *
 * @param {Object} [options]
 * @param {string} [options.skillsRoot] - 技能根目录（默认 <pkg>/skills）
 * @returns {Object} tier 清单（只读扫描，不写任何文件）
 */
export function buildTierManifest(options = {}) {
  const skillsRoot = options.skillsRoot || DEFAULT_SKILLS_ROOT;
  const skills = [];
  const warnings = [];

  let categories;
  try {
    categories = fs.readdirSync(skillsRoot, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch (err) {
    throw new Error(`SKILLS_ROOT_INVALID: 无法读取技能根目录 ${skillsRoot}: ${err.message}`);
  }

  for (const category of categories.sort()) {
    const catPath = path.join(skillsRoot, category);
    for (const entry of fs.readdirSync(catPath, { withFileTypes: true }).filter(e => e.isDirectory())) {
      const skillDir = path.join(catPath, entry.name);
      const skillMdPath = path.join(skillDir, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) continue; // 无 SKILL.md 的目录不是技能，跳过

      const { tier, tier_source, warnings: tierWarnings } = resolveTier(skillDir, category);
      warnings.push(...tierWarnings);

      const content = fs.readFileSync(skillMdPath, 'utf-8');
      const frontMatter = parseFrontMatter(content);
      const meta = readMeta(skillDir);
      const description = (frontMatter && typeof frontMatter.description === 'string'
        ? frontMatter.description
        : (meta && meta.description) || '');

      skills.push({
        name: entry.name,
        category,
        tier,
        tier_source,
        // T5：SKILL.md 字符数自测回填（启动时自动计算，无需手工维护）
        tokens_char: content.length,
        description,
        // FP-TOKO-003 Tier 0 索引层需要触发词（additive 字段；无 front matter triggers 时为空数组）
        triggers: Array.isArray(frontMatter && frontMatter.triggers)
          ? frontMatter.triggers.filter(t => typeof t === 'string')
          : [],
        references: collectReferences(skillDir)
      });
    }
  }

  const tierDistribution = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const skill of skills) {
    tierDistribution[skill.tier] += 1;
  }

  return {
    generated_at: new Date().toISOString(),
    skills_root: skillsRoot,
    total: skills.length,
    tier_distribution: tierDistribution,
    warnings,
    skills
  };
}

export default {
  TIER_DERIVATION_MAP,
  UNKNOWN_CATEGORY_TIER,
  INDEX_TIER,
  BODY_TIER,
  REFERENCE_TIER,
  ARTIFACT_TIER,
  VALID_TIERS,
  isValidTier,
  parseFrontMatter,
  resolveTier,
  buildTierManifest
};
