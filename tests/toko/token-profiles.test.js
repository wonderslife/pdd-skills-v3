// tests/toko/token-profiles.test.js - FP-TOKO-001 tokenizer-profiles 单元测试
// 覆盖验收项：B1（8 家族全量+Schema）、B3（未登记家族降级）、T2（哈希锁定）、T3（混合分段求和）
// 运行：node --test tests/toko/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  FAMILIES,
  FALLBACK_PROFILE_ID,
  RECALIBRATION_INTERVAL_DAYS,
  loadProfile,
  computeContentHash,
  verifyProfile,
  isProfileStale,
  stableStringify
} from '../../lib/streaming/profiles/index.js';

import {
  segmentContent,
  estimateTokensFromSegments,
  calibrateFamily,
  buildDraftProfile,
  LOCK_ERROR_THRESHOLD
} from '../../scripts/token-calibrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = path.join(__dirname, '..', '..', 'lib', 'streaming', 'profiles');

// ==================== B1: 8 家族 profile 全量产出 ====================

test('B1/R5: 8 家族 profile 文件齐全且字段满足 Schema（文件名=family 枚举）', () => {
  assert.equal(FAMILIES.length, 8);
  for (const family of FAMILIES) {
    const file = path.join(PROFILES_DIR, `${family}.json`);
    assert.ok(fs.existsSync(file), `缺少 profile 文件: ${file}`);

    const profile = JSON.parse(fs.readFileSync(file, 'utf-8'));
    // §1.2 Schema 必备字段
    assert.equal(profile.family, family, `family 字段必须与文件名一致（R5）: ${family}`);
    assert.ok(profile.ratios, `${family}: 缺 ratios`);
    assert.equal(typeof profile.ratios.zh_chars_per_token, 'number', `${family}: ratios.zh_chars_per_token`);
    assert.equal(typeof profile.ratios.en_words_per_token, 'number', `${family}: ratios.en_words_per_token`);
    assert.equal(typeof profile.ratios.code_lines_per_token, 'number', `${family}: ratios.code_lines_per_token`);
    assert.equal(typeof profile.usage_semantics, 'string', `${family}: 缺 usage_semantics`);
    assert.equal(typeof profile.reasoning_channel, 'string', `${family}: 缺 reasoning_channel`);
    assert.ok(profile.prefix_cache, `${family}: 缺 prefix_cache`);
    assert.equal(typeof profile.prefix_cache.billing, 'number', `${family}: prefix_cache.billing`);
    assert.equal(typeof profile.prefix_cache.min_tokens, 'number', `${family}: prefix_cache.min_tokens`);
    assert.equal(typeof profile.context_window, 'number', `${family}: 缺 context_window`);
    assert.equal(typeof profile.stream_protocol, 'string', `${family}: 缺 stream_protocol`);
    assert.ok(!Number.isNaN(Date.parse(profile.calibrated_at)), `${family}: calibrated_at 非RFC3339`);
    // R5: 禁用 qwen3 等模型型号名
    assert.match(file, new RegExp(`${family}\\.json$`), `${family}: 文件名必须为 {{family}}.json`);
  }
});

test('T2: 每份 profile 的 content_hash 可重算比对（哈希锁定）', () => {
  for (const family of FAMILIES) {
    const profile = JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, `${family}.json`), 'utf-8'));
    assert.ok(profile.content_hash, `${family}: 缺 content_hash`);
    assert.match(profile.content_hash, /^sha256:[0-9a-f]{64}$/, `${family}: content_hash 格式`);
    assert.ok(verifyProfile(profile), `${family}: content_hash 重算不一致`);
    // 篡改任一字段后校验必须失败
    const tampered = { ...profile, context_window: profile.context_window + 1 };
    assert.equal(verifyProfile(tampered), false, `${family}: 篡改后哈希校验应失败`);
  }
});

test('stableStringify: 键排序稳定，重排键序后哈希不变', () => {
  const a = { b: 1, a: { d: 2, c: 3 } };
  const b = { a: { c: 3, d: 2 }, b: 1 };
  assert.equal(stableStringify(a), stableStringify(b));
});

// ==================== B3: 未登记家族降级 ====================

test('B3/R5: loadProfile("ernie") 降级 openai profile 并标记 openai(fallback)', () => {
  const profile = loadProfile('ernie');
  assert.equal(profile.family, 'openai', '降级后 family 必须为 openai');
  assert.equal(profile.tokenizer_profile, FALLBACK_PROFILE_ID, '降级标识固定为 openai(fallback)');
  // 基线 ratios 来自 openai profile
  const openai = JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, 'openai.json'), 'utf-8'));
  assert.deepEqual(profile.ratios, openai.ratios);
  // minimax / xai 同样走降级（FP-TOKO-010 前置）
  for (const unknownFamily of ['minimax', 'xai', 'unknown-family']) {
    assert.equal(loadProfile(unknownFamily).tokenizer_profile, FALLBACK_PROFILE_ID);
  }
});

test('B3: 已登记家族返回自身 profile，不携带降级标记', () => {
  const qwen = loadProfile('qwen');
  assert.equal(qwen.family, 'qwen');
  assert.equal(qwen.tokenizer_profile, undefined, '已登记家族不得携带 fallback 标记');
  // 基线未超期：不得误标 stale
  assert.equal(qwen.stale, undefined);
  // 深拷贝：改写返回值不影响缓存
  qwen.ratios.zh_chars_per_token = 99;
  assert.equal(loadProfile('qwen').ratios.zh_chars_per_token, 0.62);
});

test('PROFILE_STALE: 超过季度复标周期判定 stale', () => {
  const now = Date.now();
  const fresh = { calibrated_at: new Date(now - 30 * 86400000).toISOString() };
  const stale = { calibrated_at: new Date(now - (RECALIBRATION_INTERVAL_DAYS + 1) * 86400000).toISOString() };
  const invalid = { calibrated_at: 'not-a-date' };
  assert.equal(isProfileStale(fresh, now), false);
  assert.equal(isProfileStale(stale, now), true);
  assert.equal(isProfileStale(invalid, now), true, '非法 calibrated_at 视为 stale');
});

// ==================== T3/T4: 混合分段与估算 ====================

test('T3: 中英混合分段计数（zh/en/code 独立统计）', () => {
  const text = [
    '# 标题：功能说明',
    '',
    'This is an English intro line with a few words.',
    '',
    '```js',
    'const a = 1;',
    'const b = 2;',
    '```',
    ''
  ].join('\n');
  const seg = segmentContent(text);
  // zh：标题功能说明 = 6 个 CJK 字符（全角冒号不计）
  assert.equal(seg.zh, 6, `zh 计数错误: ${seg.zh}`);
  // en：#/This/is/an/English/intro/line/with/a/few/words. = 11 词（空白切词口径）
  assert.equal(seg.en, 11, `en 计数错误: ${seg.en}`);
  // code：fenced block 内 2 个非空行
  assert.equal(seg.code, 2, `code 计数错误: ${seg.code}`);
});

test('T3/R2: 混合语料估算 = zh/en/code 分段套系数求和（经 profile，R1）', () => {
  const profile = loadProfile('qwen');
  const seg = { zh: 6, en: 11, code: 2 };
  const r = profile.ratios;
  const expectedRaw = 6 / r.zh_chars_per_token + 11 / r.en_words_per_token + 2 / r.code_lines_per_token;
  assert.equal(estimateTokensFromSegments(seg, profile), Math.ceil(expectedRaw));
  // 混合样本核算：6/0.62 + 11/0.75 + 2/9.5 = 24.55 → 25
  assert.equal(estimateTokensFromSegments(seg, profile), 25);
  // T4 解耦：同字符数不同内容类型，估算不同（禁止字符直报）
  const zhOnly = estimateTokensFromSegments({ zh: 100, en: 0, code: 0 }, profile);
  const codeOnly = estimateTokensFromSegments({ zh: 0, en: 0, code: 100 }, profile);
  assert.notEqual(zhOnly, codeOnly);
});

test('R3: 校准误差 >5% 的家族 verdict=reject（不得锁定发布）', () => {
  const tmpCorpus = fs.mkdtempSync('/tmp/toko-cal-');
  fs.writeFileSync(path.join(tmpCorpus, 'SKILL.md'), '# 示例技能\n示例正文内容。\n', 'utf-8');
  try {
    const samples = [
      { skill_name: 'SKILL', segment_type: 'zh', char_count: 1000, measured_tokens: 1613, family: 'qwen' },
      { skill_name: 'SKILL', segment_type: 'zh', char_count: 2000, measured_tokens: 3226, family: 'qwen' },
      { skill_name: 'SKILL', segment_type: 'en', char_count: 1000, measured_tokens: 1333, family: 'qwen' },
      { skill_name: 'SKILL', segment_type: 'en', char_count: 2000, measured_tokens: 2667, family: 'qwen' },
      // code 误差 10%：est=ceil(100/9.5)=11 vs measured 10
      { skill_name: 'SKILL', segment_type: 'code', char_count: 100, measured_tokens: 10, family: 'qwen' },
      { skill_name: 'SKILL', segment_type: 'code', char_count: 200, measured_tokens: 20, family: 'qwen' }
    ];
    const report = calibrateFamily('qwen', tmpCorpus, samples);
    assert.equal(report.samples_used, 6);
    assert.ok(report.max_error_pct > LOCK_ERROR_THRESHOLD, `应检出超阈值误差: ${report.max_error_pct}`);
    assert.equal(report.verdict, 'reject');
    // 回归拟合产出 ratios 草案
    assert.ok(report.fitted_ratios.zh_chars_per_token, 'zh 拟合系数应产出');
    const draft = buildDraftProfile(report);
    assert.ok(verifyProfile(draft), '草案 content_hash 必须锁定可校验（R4）');
    assert.deepEqual(draft.ratios, report.fitted_ratios, '草案应应用拟合 ratios');
  } finally {
    fs.rmSync(tmpCorpus, { recursive: true, force: true });
  }
});

test('§3.3: 无实测样本时 verdict=pass-with-uncertainty 并标注不确定度', () => {
  const tmpCorpus = fs.mkdtempSync('/tmp/toko-cal2-');
  fs.writeFileSync(path.join(tmpCorpus, 'SKILL.md'), '# 示例\n内容。\n', 'utf-8');
  try {
    const report = calibrateFamily('glm', tmpCorpus, []);
    assert.equal(report.samples_used, 0);
    assert.equal(report.max_error_pct, null);
    assert.equal(report.verdict, 'pass-with-uncertainty');
    assert.ok(report.uncertainty_note, '必须标注不确定度');
    assert.ok(report.recalibration_due, 'T5: 必须输出季度复标调度时间');
  } finally {
    fs.rmSync(tmpCorpus, { recursive: true, force: true });
  }
});
