#!/usr/bin/env node
// scripts/token-calibrate.js - Tokenizer Profile 采样标定脚本（FP-TOKO-001 / doc 05 §3.4.1、路线图 T0）
//
// 职责（FP-TOKO-001 §3.1 处理流程）：
//   1. 收集技能语料（SKILL.md + references/）→ 2. 按 zh/en/code 分段 →
//   3. 套 profile 系数估算 → 4. 有实测样本时回归拟合 ratios →
//   5. 生成 profile 草案 + content_hash 锁定（--seal）→ 6. 校准误差验收（R3：≤5% 才可锁定）→
//   7. 季度复标调度（recalibration_due）。
//
// 边界（§3.3）：无供应商 tokenizer API 时以静态系数为准，误差验收放宽并在报告中标注不确定度；
// 运行时零网络依赖（I3），实测通道仅标定期通过 --samples 离线注入。
//
// 用法：
//   node scripts/token-calibrate.js [--corpus <dir>] [--family <family|all>]
//                                   [--samples <file.json>] [--out <dir>] [--report <file>]
//                                   [--seal]
//
//   --corpus   语料根目录（默认 skills/）
//   --family   家族标识或 all（默认 all）
//   --samples  标定样本集 JSON（§2.1：[{skill_name, segment_type, char_count, measured_tokens}]）
//   --out      草案/seal 输出目录（--seal 未指定时默认 lib/streaming/profiles）
//   --report   标定报告输出路径（JSON；未指定时打印 stdout）
//   --seal     锁定模式：重算 content_hash 写回（误差 >5% 且有实测样本时拒绝锁定，R3）

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  FAMILIES,
  loadProfile,
  computeContentHash,
  verifyProfile,
  isProfileStale,
  RECALIBRATION_INTERVAL_DAYS
} from '../lib/streaming/profiles/index.js';
// 分段与估算原语抽取至 lib/streaming/segment.js（FP-TOKO-002）：
// 标定脚本与运行时估算轨共用同一实现，保证系数口径不漂移（T5 溯源一致性）
import { segmentContent, estimateTokensFromSegments } from '../lib/streaming/segment.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CORPUS = path.join(__dirname, '..', 'skills');
const DEFAULT_PROFILES_DIR = path.join(__dirname, '..', 'lib', 'streaming', 'profiles');

/** 校准误差锁定阈值（R3：>5% 不得锁定发布） */
export const LOCK_ERROR_THRESHOLD = 0.05;

/** 拟合所需最少样本数（每 segment_type） */
const FIT_MIN_SAMPLES = 2;

// ==================== 分段与估算 ====================

// segmentContent / estimateTokensFromSegments 移至 lib/streaming/segment.js（FP-TOKO-002），
// 此处 re-export 保持既有导入路径（tests/toko/token-profiles.test.js）行为零差异。
export { segmentContent, estimateTokensFromSegments };

// ==================== 语料收集 ====================

/**
 * 收集技能语料文件：SKILL.md + references/ 下 .md（FP-TOKO-001 §3.1 步骤 1）
 * @param {string} root - 语料根目录
 * @returns {Array<{skill_name: string, file: string}>}
 */
export function collectCorpusFiles(root) {
  const files = [];
  const walk = (dir, inReferences) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, inReferences || entry.name === 'references');
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        if (entry.name === 'SKILL.md' || inReferences) {
          files.push({
            skill_name: path.relative(root, full).replace(/\.md$/, '').replace(/\\/g, '/'),
            file: full
          });
        }
      }
    }
  };
  walk(root, false);
  return files;
}

// ==================== 标定与回归拟合 ====================

/**
 * 单样本误差核算（§2.1 样本集：char_count 按 segment_type 套系数 vs measured_tokens）
 * @param {{skill_name:string, segment_type:'zh'|'en'|'code', char_count:number, measured_tokens:number}} sample
 * @param {Object} profile
 * @returns {{estimated:number, measured:number, error_pct:number}}
 */
export function evaluateSampleError(sample, profile) {
  const ratioKey = {
    zh: 'zh_chars_per_token',
    en: 'en_words_per_token',
    code: 'code_lines_per_token'
  }[sample.segment_type];
  if (!ratioKey) {
    throw new Error(`RECORD_MALFORMED: segment_type 必须为 zh/en/code，得到 ${sample.segment_type}`);
  }
  const estimated = Math.ceil(sample.char_count / profile.ratios[ratioKey]);
  const errorPct = sample.measured_tokens > 0
    ? Math.abs(estimated - sample.measured_tokens) / sample.measured_tokens
    : NaN;
  return { estimated, measured: sample.measured_tokens, error_pct: errorPct };
}

/**
 * 回归拟合单段系数（最小二乘过原点：min Σ(char/r − measured)² ⇒ r = Σchar² / Σ(char·measured)）
 * 样本不足时返回 null（保持基线系数并标注不确定度）
 * @param {Array<{char_count:number, measured_tokens:number}>} samples
 * @returns {number|null}
 */
function fitRatio(samples) {
  if (!samples || samples.length < FIT_MIN_SAMPLES) return null;
  let sumSq = 0;
  let sumCross = 0;
  for (const s of samples) {
    sumSq += s.char_count * s.char_count;
    sumCross += s.char_count * s.measured_tokens;
  }
  if (sumCross <= 0) return null;
  return sumSq / sumCross;
}

/**
 * 对单家族执行标定：语料估算 + 样本误差表 + ratios 拟合 + 复标调度
 * @param {string} family
 * @param {string} corpusDir
 * @param {Array} samples - §2.1 样本集（可空；空则标注不确定度，§3.3）
 * @param {Object} [profileOverride] - 草案 profile（拟合后），默认读当前 profile
 * @returns {Object} 标定报告
 */
export function calibrateFamily(family, corpusDir, samples = []) {
  const current = loadProfile(family);
  const familySamples = samples.filter(s => !s.family || s.family === family);

  // 语料估算（套当前 profile 系数）
  const corpus = collectCorpusFiles(corpusDir);
  const perSkill = corpus.map(({ skill_name, file }) => {
    const seg = segmentContent(fs.readFileSync(file, 'utf-8'));
    return {
      skill_name,
      segments: seg,
      tokens_est: estimateTokensFromSegments(seg, current)
    };
  });
  const totals = perSkill.reduce(
    (acc, row) => {
      acc.zh += row.segments.zh;
      acc.en += row.segments.en;
      acc.code += row.segments.code;
      acc.tokens_est += row.tokens_est;
      return acc;
    },
    { zh: 0, en: 0, code: 0, tokens_est: 0 }
  );

  // 误差表（有实测样本时）
  const errorTable = familySamples.map(sample => ({
    skill_name: sample.skill_name,
    segment_type: sample.segment_type,
    char_count: sample.char_count,
    measured_tokens: sample.measured_tokens,
    ...evaluateSampleError(sample, current)
  }));
  const validErrors = errorTable.filter(row => !Number.isNaN(row.error_pct));
  const maxError = validErrors.length
    ? Math.max(...validErrors.map(row => row.error_pct))
    : null;

  // ratios 回归拟合（每 segment_type 样本数 ≥2 时生效）
  const fittedRatios = {};
  for (const [segType, ratioKey] of Object.entries({
    zh: 'zh_chars_per_token',
    en: 'en_words_per_token',
    code: 'code_lines_per_token'
  })) {
    const segSamples = familySamples.filter(s => s.segment_type === segType);
    const fitted = fitRatio(segSamples);
    if (fitted !== null) {
      fittedRatios[ratioKey] = Math.round(fitted * 10000) / 10000;
    }
  }

  const calibratedAt = current.calibrated_at;
  const calibratedMs = Date.parse(calibratedAt);
  const recalibrationDue = Number.isNaN(calibratedMs)
    ? null
    : new Date(calibratedMs + RECALIBRATION_INTERVAL_DAYS * 86400000).toISOString();

  // R3 判定：有实测样本时误差 >5% 拒绝锁定；无样本时放宽并标注不确定度（§3.3）
  const verdict = maxError === null
    ? 'pass-with-uncertainty'
    : (maxError <= LOCK_ERROR_THRESHOLD ? 'pass' : 'reject');

  return {
    family,
    profile_file: `${family}.json`,
    calibrated_at: calibratedAt,
    stale: isProfileStale(current),
    recalibration_due: recalibrationDue,
    corpus_root: corpusDir,
    corpus_files: corpus.length,
    totals,
    per_skill: perSkill,
    samples_used: familySamples.length,
    error_table: errorTable,
    max_error_pct: maxError,
    fitted_ratios: fittedRatios,
    lock_threshold_pct: LOCK_ERROR_THRESHOLD,
    verdict,
    uncertainty_note: maxError === null
      ? '未提供实测样本：以静态系数为准，误差验收放宽并记录（FP-TOKO-001 §3.3 不确定度标注）'
      : null
  };
}

// ==================== 草案生成与 seal 锁定 ====================

/**
 * 生成 profile 草案：应用拟合 ratios（如有）+ 刷新 calibrated_at + 重算 content_hash（R4）
 * @param {Object} report - calibrateFamily 报告
 * @returns {Object} 新 profile 草案（含 content_hash）
 */
export function buildDraftProfile(report) {
  const current = loadProfile(report.family);
  const draft = {
    ...current,
    ratios: { ...current.ratios, ...report.fitted_ratios }
  };
  draft.calibrated_at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  delete draft.stale;
  delete draft.tokenizer_profile;
  draft.content_hash = computeContentHash(draft);
  return draft;
}

/**
 * seal 锁定：为目录下 profile 文件重算并写回 content_hash（R3 误差守卫）
 * @param {string[]} families
 * @param {string} outDir
 * @param {Object<string, Object>} reportsByFamily - calibrateFamily 报告（key = family，用于 R3 守卫）
 * @returns {{sealed: string[], skipped: Array<{family:string, reason:string}>}}
 */
export function sealProfiles(families, outDir, reportsByFamily = {}) {
  const sealed = [];
  const skipped = [];

  for (const family of families) {
    const report = reportsByFamily[family];
    if (report && report.verdict === 'reject') {
      skipped.push({
        family,
        reason: `校准误差 ${(report.max_error_pct * 100).toFixed(2)}% > ${LOCK_ERROR_THRESHOLD * 100}%，R3 禁止锁定发布`
      });
      continue;
    }

    const file = path.join(outDir, `${family}.json`);
    if (!fs.existsSync(file)) {
      skipped.push({ family, reason: `文件不存在: ${file}` });
      continue;
    }

    const profile = JSON.parse(fs.readFileSync(file, 'utf-8'));
    profile.content_hash = computeContentHash(profile);
    fs.writeFileSync(file, JSON.stringify(profile, null, 2) + '\n', 'utf-8');

    if (!verifyProfile(JSON.parse(fs.readFileSync(file, 'utf-8')))) {
      throw new Error(`SEAL_FAILED: ${family}.json 哈希回读校验失败`);
    }
    sealed.push(`${family}.json`);
  }

  return { sealed, skipped };
}

// ==================== CLI ====================

function parseArgs(argv) {
  const args = { family: 'all', seal: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--corpus': args.corpus = argv[++i]; break;
      case '--family': args.family = argv[++i]; break;
      case '--samples': args.samples = argv[++i]; break;
      case '--out': args.out = argv[++i]; break;
      case '--report': args.report = argv[++i]; break;
      case '--seal': args.seal = true; break;
      default:
        throw new Error(`未知参数: ${argv[i]}`);
    }
  }
  return args;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const corpusDir = path.resolve(args.corpus || DEFAULT_CORPUS);
  const outDir = path.resolve(args.out || DEFAULT_PROFILES_DIR);

  if (!fs.existsSync(corpusDir)) {
    throw new Error(`语料目录不存在: ${corpusDir}`);
  }

  const families = args.family === 'all' ? FAMILIES : [args.family];
  for (const family of families) {
    if (!FAMILIES.includes(family)) {
      throw new Error(`PROFILE_NOT_FOUND: ${family} 未登记（8 家族枚举：${FAMILIES.join('/')}）`);
    }
  }

  let samples = [];
  if (args.samples) {
    samples = JSON.parse(fs.readFileSync(path.resolve(args.samples), 'utf-8'));
    if (!Array.isArray(samples)) {
      throw new Error('RECORD_MALFORMED: 样本集必须为 JSON 数组（§2.1）');
    }
  }

  const reports = {};
  for (const family of families) {
    reports[family] = calibrateFamily(family, corpusDir, samples);
  }

  let sealResult = null;
  if (args.seal) {
    if (outDir === DEFAULT_PROFILES_DIR && !args.out) {
      // seal 默认作用于静态表目录；草案先行时显式传 --out
      sealResult = sealProfiles(families, DEFAULT_PROFILES_DIR, reports);
    } else {
      fs.ensureDirSync(outDir);
      // 写入草案再锁定（草案生成 → 哈希锁定，§3.1 步骤 5）
      for (const family of families) {
        if (reports[family].verdict === 'reject') continue;
        const draft = buildDraftProfile(reports[family]);
        fs.writeFileSync(
          path.join(outDir, `${family}.json`),
          JSON.stringify(draft, null, 2) + '\n',
          'utf-8'
        );
      }
      sealResult = sealProfiles(families, outDir, reports);
    }
  }

  const output = {
    tool: 'token-calibrate',
    generated_at: new Date().toISOString(),
    corpus_dir: corpusDir,
    families,
    seal: sealResult,
    reports: Object.values(reports).map(r => ({
      family: r.family,
      corpus_files: r.corpus_files,
      totals: r.totals,
      samples_used: r.samples_used,
      max_error_pct: r.max_error_pct,
      fitted_ratios: r.fitted_ratios,
      verdict: r.verdict,
      stale: r.stale,
      recalibration_due: r.recalibration_due,
      uncertainty_note: r.uncertainty_note
    }))
  };

  const json = JSON.stringify(output, null, 2);
  if (args.report) {
    fs.ensureDirSync(path.dirname(path.resolve(args.report)));
    fs.writeFileSync(path.resolve(args.report), json + '\n', 'utf-8');
    console.log(`标定报告已写入: ${path.resolve(args.report)}`);
  } else {
    console.log(json);
  }

  if (sealResult) {
    console.log(`已锁定: ${sealResult.sealed.join(', ') || '（无）'}`);
    for (const skip of sealResult.skipped) {
      console.warn(`跳过 ${skip.family}: ${skip.reason}`);
    }
    const rejected = sealResult.skipped.filter(s => s.reason.includes('R3'));
    if (rejected.length > 0) {
      throw new Error(`R3: ${rejected.length} 个家族误差超 ${LOCK_ERROR_THRESHOLD * 100}% 被拒绝锁定`);
    }
  }

  return output;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch(err => {
    console.error(`token-calibrate: ${err.message}`);
    process.exit(1);
  });
}

export default { segmentContent, estimateTokensFromSegments, collectCorpusFiles, evaluateSampleError, calibrateFamily, buildDraftProfile, sealProfiles, main };
