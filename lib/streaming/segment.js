// lib/streaming/segment.js - 内容分段与估算原语（FP-TOKO-002 抽取自 scripts/token-calibrate.js）
//
// 单一实现源：标定脚本（FP-TOKO-001）与运行时估算轨（FP-TOKO-002）共用同一分段口径，
// 保证标定系数与运行时估算不漂移（checklist T5：所有 tokens_est 可溯源至 FP-TOKO-001 系数）。
// 分段规则与 scripts/token-calibrate.js 原 segmentContent 逐字一致（行为零差异）。

/** CJK 汉字（含扩展 A 区）——zh 分段计数口径 */
const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

/** CJK 标点与全角符号——作分隔符，不计入 zh 也不计为词 */
const FULLWIDTH_RE = /[\u3000-\u303f\uff00-\uffef]/g;

/**
 * CJK 字符计数（zh 分段口径）
 * @param {string} text
 * @returns {number}
 */
export function countCJKChars(text) {
  return (text.match(CJK_RE) || []).length;
}

/**
 * 拉丁词计数（en 分段口径：与 token-analyzer.js 同口径，空白切词；
 * CJK 字符与全角符号替换为空白作分隔符）
 * @param {string} text
 * @returns {number}
 */
export function countLatinWords(text) {
  return text
    .replace(CJK_RE, ' ')
    .replace(FULLWIDTH_RE, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0).length;
}

/**
 * 代码行计数（code 分段口径：非空行数）
 * @param {string} text
 * @returns {number}
 */
export function countCodeLines(text) {
  return text.split('\n').filter(line => line.trim().length > 0).length;
}

/**
 * 混合内容分段统计（R2：混合内容按 zh/en/code 分段；R1：禁止字符直报，一切估算必须过 profile）
 * 分段规则：fenced code block 记为 code（按非空行数）；其余文本按 CJK 字符 / 空白切词计 en。
 * @param {string} text - 原始文本
 * @returns {{zh: number, en: number, code: number}}
 */
export function segmentContent(text) {
  const segments = { zh: 0, en: 0, code: 0 };
  if (!text) return segments;

  // 1. 摘出 fenced code blocks（含未闭合块尾部）
  const blocks = [];
  const rest = text.replace(/```[^\n]*\n?([\s\S]*?)```/g, (_, code) => {
    blocks.push(code);
    return '\n';
  });
  const tailMatch = rest.match(/```[^\n]*\n?([\s\S]*)$/);
  if (tailMatch) {
    blocks.push(tailMatch[1]);
  }

  // 2. code 分段按非空行计数
  for (const block of blocks) {
    segments.code += countCodeLines(block);
  }

  // 3. 剩余文本：CJK 字符计数 + 拉丁词计数
  //    CJK 标点（。、「」等）与全角符号不计入 zh 字符，也不计为词，作分隔符处理
  segments.zh = countCJKChars(rest);
  segments.en = countLatinWords(rest);

  return segments;
}

/**
 * 单一内容类型计量（FP-TOKO-002 估算轨：contentType 直接声明为 zh/en/code 时免全文分段）
 * 与 segmentContent 对应分量使用完全相同的计数口径。
 * @param {string} text - 原始文本
 * @param {'zh'|'en'|'code'} contentType - 单一内容类型（mixed 请走 segmentContent）
 * @returns {{zh: number, en: number, code: number}}
 */
export function measureSegment(text, contentType) {
  if (contentType === 'zh') return { zh: countCJKChars(text), en: 0, code: 0 };
  if (contentType === 'en') return { zh: 0, en: countLatinWords(text), code: 0 };
  if (contentType === 'code') return { zh: 0, en: 0, code: countCodeLines(text) };
  // mixed 或未知类型交由调用方校验后走 segmentContent
  return segmentContent(text);
}

/**
 * 分段套系数估算 token（R1：一切估算必须过 profile，禁止字符直报）
 * tokens = zh/r.zh + en/r.en + code/r.code，最终向上取整
 * @param {{zh:number,en:number,code:number}} segments - 分段统计
 * @param {Object} profile - FP-TOKO-001 profile
 * @returns {number}
 */
export function estimateTokensFromSegments(segments, profile) {
  const r = profile.ratios;
  const raw =
    (segments.zh || 0) / r.zh_chars_per_token +
    (segments.en || 0) / r.en_words_per_token +
    (segments.code || 0) / r.code_lines_per_token;
  return Math.ceil(raw);
}

export default { segmentContent, measureSegment, estimateTokensFromSegments, countCJKChars, countLatinWords, countCodeLines };
