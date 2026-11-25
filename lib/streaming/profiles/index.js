// lib/streaming/profiles/index.js - Tokenizer Profile 加载器（FP-TOKO-001）
// T0 基线标定：8 家族静态 profile 表，随 npm 包发布；运行时零网络依赖（I3）
// 未登记家族降级 openai profile 并标记 tokenizer_profile: "openai(fallback)"（R5）
// PROFILE_STALE：calibrated_at 超过季度复标周期 → WARN 记录，继续使用，报告中标注（§1.3）

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = __dirname;

/**
 * 3.5.0 首期 8 家族（ernie/minimax/xai 未登记，走 FP-TOKO-010 降级链）
 * 文件名与标识统一为 {family}.json，禁用 qwen3 等模型型号名（R5）
 */
export const FAMILIES = ['openai', 'anthropic', 'gemini', 'deepseek', 'qwen', 'glm', 'kimi', 'doubao'];

/** 未登记家族的固定降级标识（R5，禁止其他写法） */
export const FALLBACK_PROFILE_ID = 'openai(fallback)';

/** 季度复标周期（天） */
export const RECALIBRATION_INTERVAL_DAYS = 92;

/** profile 文件缓存（进程内，避免重复磁盘读取） */
const cache = new Map();

/**
 * 稳定序列化：递归键排序，保证 content_hash 可重算比对（T2）
 * @param {*} value - 任意可 JSON 化的值
 * @returns {string}
 */
export function stableStringify(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

/**
 * 计算 profile 内容哈希（剔除 content_hash 字段后 sha256，前缀格式 sha256:<hex>）
 * @param {Object} profile - profile 对象
 * @returns {string} "sha256:<hex>"
 */
export function computeContentHash(profile) {
  const rest = { ...profile };
  delete rest.content_hash;
  const hex = crypto.createHash('sha256').update(stableStringify(rest)).digest('hex');
  return `sha256:${hex}`;
}

/**
 * 校验 profile 完整性：重算哈希并与 content_hash 比对
 * @param {Object} profile - profile 对象
 * @returns {boolean}
 */
export function verifyProfile(profile) {
  if (!profile || typeof profile !== 'object') return false;
  return profile.content_hash === computeContentHash(profile);
}

/**
 * 判断 profile 是否超过季度复标周期（PROFILE_STALE 判定核心，独立导出便于测试）
 * @param {Object} profile - profile 对象（含 calibrated_at RFC3339）
 * @param {number} [now] - 当前时间戳（默认 Date.now()）
 * @returns {boolean}
 */
export function isProfileStale(profile, now = Date.now()) {
  const calibratedAt = Date.parse(profile && profile.calibrated_at);
  if (Number.isNaN(calibratedAt)) return true;
  return (now - calibratedAt) / 86400000 > RECALIBRATION_INTERVAL_DAYS;
}

/**
 * 从磁盘读取指定家族的 profile 原始对象（带进程内缓存）
 * @private
 * @param {string} family
 * @returns {Object|null}
 */
function readProfile(family) {
  if (cache.has(family)) return cache.get(family);
  const file = path.join(PROFILES_DIR, `${family}.json`);
  if (!fs.existsSync(file)) return null;
  let profile;
  try {
    profile = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    console.warn(`[PROFILE_INVALID] ${family}.json 解析失败: ${err.message}`);
    return null;
  }
  cache.set(family, profile);
  return profile;
}

/**
 * 加载家族 profile（FP-TOKO-001 §1.1 模块导出）
 *
 * 行为约定：
 * - 已登记家族 → 返回该家族 profile 深拷贝；
 * - 未登记家族（PROFILE_NOT_FOUND）→ 返回 openai profile 并标记 tokenizer_profile: "openai(fallback)"；
 * - PROFILE_STALE → 附加 stale: true 并 WARN 记录，继续使用（报告中标注）。
 *
 * @param {string} family - 家族标识（FAMILIES 枚举或任意字符串）
 * @returns {Object} profile 深拷贝（调用方可安全改写）
 * @throws {Error} openai 基线文件缺失（安装包损坏，PROFILE_MISSING）
 */
export function loadProfile(family) {
  let profile = readProfile(family);
  let isFallback = false;

  if (!profile || !FAMILIES.includes(profile.family)) {
    profile = readProfile('openai');
    isFallback = true;
  }

  if (!profile) {
    throw new Error('PROFILE_MISSING: lib/streaming/profiles/openai.json 缺失，安装包可能损坏');
  }

  // 深拷贝（两层足够：ratios / prefix_cache 为全部嵌套结构）
  const result = {
    ...profile,
    ratios: { ...profile.ratios },
    prefix_cache: { ...profile.prefix_cache }
  };

  if (isFallback) {
    result.tokenizer_profile = FALLBACK_PROFILE_ID;
  }

  if (isProfileStale(result)) {
    result.stale = true;
    console.warn(
      `[PROFILE_STALE] ${family} profile 标定于 ${result.calibrated_at}，` +
      `超过季度复标周期（${RECALIBRATION_INTERVAL_DAYS} 天），继续使用，报告中标注`
    );
  }

  return result;
}

export default { FAMILIES, FALLBACK_PROFILE_ID, RECALIBRATION_INTERVAL_DAYS, stableStringify, computeContentHash, verifyProfile, isProfileStale, loadProfile };
