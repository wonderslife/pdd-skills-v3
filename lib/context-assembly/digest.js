// lib/context-assembly/digest.js - 工件摘要化 Digest Profile（FP-TOKO-004 / doc 05 §3.1.3、路线图 T1）
//
// 职责（FP-TOKO-004 §3.1 处理流程）：
//   1. 工具调用返回结构化报告 → 2. 匹配 Digest Profile → 3. 按 keep_fields 提取 →
//   4. 超 ceiling 则降级 pointer → 5. 输出注入体（进 CAG Tier 3，FP-TOKO-003 artifacts 入参）→
//   6. 全程记录估算值（经 FP-TOKO-001 profile 系数）。
//
// 业务规则：
//   - R1：截断只按条目/行等结构边界（数组 top-N / 整行匹配），禁止字符级硬截断（防破坏 JSON/YAML 致模型误读）；
//   - R2：摘要必须保留"取全文指令"，是否取回由模型决定（fetch_instruction）；
//   - R3：单报告注入 ≤800 tokens（token_ceiling，对照现状 2,000+）；
//   - R4：无 profile 的工件类型一律 pointer 降级，不做自由发挥摘要。
//
// 降级路径（§3.3 状态转换，均为返回值降级 + notice 标注，不抛错——与 FP-TOKO-002 ESTIMATE_WITHOUT_PROFILE 同风格）：
//   - PROFILE_MISSING：artifactType 无对应 profile → pointer；
//   - CEILING_BREACH：摘要后仍超 token_ceiling → pointer（禁止字符级硬截断）；
//   - DIGEST_EMPTY：keep_fields 全部落空（形状不符）→ pointer（不做自由发挥）。

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { segmentContent, estimateTokensFromSegments } from '../streaming/segment.js';
import { loadProfile } from '../streaming/profiles/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = path.join(__dirname, 'digest-profiles');

/** budget.tighten 事件下 max_items 收紧值（FP-TOKO-008 事件注入，T4） */
export const TIGHTEN_MAX_ITEMS = 5;

/** digest 自身估算默认家族（签名无 family 入参，openai 为 FP-TOKO-001 基线家族；可经 opts.family 覆盖） */
export const DEFAULT_FAMILY = 'openai';

/** profile 文件缓存（进程内） */
const profileCache = new Map();

/**
 * 读取 Digest Profile（§1.2 Schema；不存在返回 null）
 * @private
 */
function readProfileFile(profileId) {
  if (profileCache.has(profileId)) return profileCache.get(profileId);
  const file = path.join(PROFILES_DIR, `${profileId}.json`);
  if (!fs.existsSync(file)) return null;
  let profile;
  try {
    profile = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    console.warn(`[PROFILE_INVALID] digest-profiles/${profileId}.json 解析失败: ${err.message}`);
    return null;
  }
  profileCache.set(profileId, profile);
  return profile;
}

/**
 * 列出已注册 Digest Profile（FP-TOKO-004 §1.1）
 * @returns {Array<{profile_id:string, artifact_type:string, keep_fields:string[], max_items:number, token_ceiling:number, degraded_output:string}>}
 */
export function listProfiles() {
  const profiles = [];
  for (const entry of fs.readdirSync(PROFILES_DIR).filter(f => f.endsWith('.json')).sort()) {
    const profile = readProfileFile(path.basename(entry, '.json'));
    if (profile) {
      profiles.push({
        profile_id: profile.profile_id,
        artifact_type: profile.artifact_type,
        keep_fields: profile.keep_fields,
        max_items: profile.max_items,
        token_ceiling: profile.token_ceiling,
        degraded_output: profile.degraded_output
      });
    }
  }
  return profiles;
}

/**
 * 按点分路径提取嵌套值
 * @private
 */
function resolvePath(obj, dottedPath) {
  let cur = obj;
  for (const key of dottedPath.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = cur[key];
  }
  return cur;
}

/**
 * 结构化提取（对象工件）：keep_fields 三种形式
 *   - "a.b.c"      → 提取嵌套值（结构边界完整，R1）
 *   - "a.b.top_n"  → 提取数组 a.b 前 max_items 项（条目级截断，R1）
 *   - "lines:..."  → 文本型工件形式，对对象工件跳过
 * @private
 */
function extractFromObject(parsed, profile, maxItems) {
  const items = [];
  for (const entry of profile.keep_fields) {
    if (typeof entry !== 'string' || entry.length === 0) continue;
    if (entry.startsWith('lines:')) continue; // 文本形式仅适用于 raw 文本工件
    const isTopN = entry.endsWith('.top_n');
    const fieldPath = isTopN ? entry.slice(0, -'.top_n'.length) : entry;
    const value = resolvePath(parsed, fieldPath);
    if (value === undefined) continue;
    if (isTopN && Array.isArray(value)) {
      items.push({ field: fieldPath, value: value.slice(0, maxItems) });
    } else {
      items.push({ field: fieldPath, value });
    }
  }
  return items;
}

/**
 * 文本提取（raw 文本工件）：lines:<token> 整行匹配（大小写不敏感），R1 结构边界 = 完整行
 * @private
 */
function extractFromText(rawText, profile, maxItems) {
  const items = [];
  const lines = rawText.split('\n');
  for (const entry of profile.keep_fields) {
    if (typeof entry !== 'string' || !entry.startsWith('lines:')) continue;
    const token = entry.slice('lines:'.length).toLowerCase();
    const matched = lines.filter(line => line.toLowerCase().includes(token)).slice(0, maxItems);
    if (matched.length > 0) {
      items.push({ field: entry, value: matched });
    }
  }
  return items;
}

/**
 * 取全文指令（R2：摘要必须保留"取全文指令"，是否取回由模型决定；注入体与字段共用同一字符串）
 * @private
 */
function fetchInstruction(artifactRef) {
  return `完整内容未注入。请通过工具读取 ${artifactRef} 获取全文后再分析（是否取回由模型决定）。`;
}

/**
 * 渲染注入体文本（估算口径 = 实际注入内容）
 * @private
 */
function renderDigestText(items, artifactRef) {
  const lines = items.map(item =>
    typeof item.value === 'string' ? `[${item.field}] ${item.value}` : `[${item.field}]\n${JSON.stringify(item.value, null, 2)}`
  );
  lines.push(`[以上为 ${artifactRef} 的结构化摘要（digest），完整内容未注入。]`);
  lines.push(`取全文：${fetchInstruction(artifactRef)}`);
  return lines.join('\n');
}

/**
 * pointer 降级注入体（§1.4：路径 + 一句话说明 + 取用指令；R4 不做内容自由发挥）
 * @private
 */
function pointerResult(artifactRef, notice, description, family) {
  const items = [`${artifactRef} —— ${description}`];
  const text = [
    items[0],
    `取全文：完整内容未注入（digest_kind=pointer）。请通过工具读取 ${artifactRef} 获取全文后再分析（是否取回由模型决定）。`
  ].join('\n');
  const tokensProfile = loadProfile(family);
  return {
    artifact_ref: artifactRef,
    digest_kind: 'pointer',
    items,
    tokens_estimate: estimateTokensFromSegments(segmentContent(text), tokensProfile),
    fetch_instruction: `完整内容未注入。请通过工具读取 ${artifactRef} 获取全文后再分析（是否取回由模型决定）。`,
    injection_text: text,
    notice
  };
}

/**
 * 解析工件为对象（JSON → YAML → null）
 * @private
 */
function parseArtifact(artifact) {
  if (typeof artifact !== 'string') return artifact;
  try {
    const parsed = JSON.parse(artifact);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    try {
      const parsed = YAML.parse(artifact);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
}

/**
 * 工件摘要化入口（FP-TOKO-004 §1.1）
 *
 * @param {Object|string} artifact - 结构化报告（对象 / JSON 字符串 / YAML 字符串 / raw 文本）
 * @param {string} profileId - Digest Profile 标识（§1.3 首期：contract-report / health-report / route-table）
 * @param {Object} [opts]
 * @param {string} [opts.artifactRef] - 工件路径/标识（缺省时取 artifact.artifact_ref / artifact.path / artifact.report_path）
 * @param {boolean} [opts.tighten] - budget.tighten 事件注入（FP-TOKO-008）：max_items 收紧为 5（T4）
 * @param {number} [opts.maxItems] - 显式条目上限（优先于 tighten / profile.max_items）
 * @param {string} [opts.family] - 估算家族（默认 openai）
 * @returns {{artifact_ref:string, digest_kind:'digest'|'pointer', items:Array, tokens_estimate:number,
 *            fetch_instruction:string, injection_text:string, notice?:string}}
 * @throws {Error} DIGEST_INPUT_INVALID / ARTIFACT_REF_REQUIRED
 */
export function digest(artifact, profileId, opts = {}) {
  if (artifact === null || artifact === undefined) {
    throw new Error('DIGEST_INPUT_INVALID: artifact 必填（对象或文本）');
  }
  if (typeof profileId !== 'string' || profileId.length === 0) {
    throw new Error('DIGEST_INPUT_INVALID: profileId 必须为非空字符串');
  }
  if (typeof opts !== 'object' || Array.isArray(opts)) {
    throw new Error('DIGEST_INPUT_INVALID: opts 必须为对象');
  }

  const artifactRef =
    opts.artifactRef ||
    (artifact && typeof artifact === 'object' && !Array.isArray(artifact)
      ? artifact.artifact_ref || artifact.path || artifact.report_path
      : null);
  if (typeof artifactRef !== 'string' || artifactRef.length === 0) {
    throw new Error('ARTIFACT_REF_REQUIRED: artifact_ref 必填（opts.artifactRef 或 artifact.artifact_ref/path/report_path）');
  }

  const family = typeof opts.family === 'string' && opts.family ? opts.family : DEFAULT_FAMILY;
  const tokensProfile = loadProfile(family);

  // PROFILE_MISSING → pointer 降级（R4：不做自由发挥摘要）
  const profile = readProfileFile(profileId);
  if (!profile) {
    return pointerResult(artifactRef, 'PROFILE_MISSING', `工件类型 ${profileId} 未登记 Digest Profile，仅注入指针`, family);
  }

  const maxItems = typeof opts.maxItems === 'number' && opts.maxItems > 0
    ? Math.floor(opts.maxItems)
    : (opts.tighten ? TIGHTEN_MAX_ITEMS : profile.max_items);

  const parsed = parseArtifact(artifact);
  const items = parsed === null
    ? extractFromText(typeof artifact === 'string' ? artifact : JSON.stringify(artifact), profile, maxItems)
    : extractFromObject(parsed, profile, maxItems);

  // keep_fields 全部落空（形状不符）→ pointer（不做自由发挥，R4 精神）
  if (items.length === 0) {
    return pointerResult(artifactRef, 'DIGEST_EMPTY', `工件与 ${profileId} Profile 保留字段不匹配，仅注入指针`, family);
  }

  const injectionText = renderDigestText(items, artifactRef);
  const tokensEstimate = estimateTokensFromSegments(segmentContent(injectionText), tokensProfile);

  // CEILING_BREACH → pointer 降级（R1：禁止字符级硬截断）
  if (tokensEstimate > profile.token_ceiling) {
    return pointerResult(
      artifactRef,
      'CEILING_BREACH',
      `${profile.artifact_type}摘要估算 ${tokensEstimate} tokens 超出上限 ${profile.token_ceiling}，仅注入指针`,
      family
    );
  }

  return {
    artifact_ref: artifactRef,
    digest_kind: 'digest',
    items,
    tokens_estimate: tokensEstimate,
    fetch_instruction: fetchInstruction(artifactRef),
    injection_text: injectionText
  };
}

export default { TIGHTEN_MAX_ITEMS, DEFAULT_FAMILY, digest, listProfiles };
