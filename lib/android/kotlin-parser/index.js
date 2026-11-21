/**
 * Kotlin Parser - Kotlin 源码轻量解析器
 *
 * 不引入完整编译器，基于正则 + 括号匹配的容错解析。
 * 供复杂度统计、导入分析、挂起函数识别、生命周期审查使用。
 * 后续可无缝替换为 tree-sitter-kotlin（parseFile 返回结构保持稳定）。
 */

import fs from 'fs-extra';
import path from 'path';

const SKIP_DIRS = new Set(['build', '.gradle', '.git', 'node_modules', '.idea']);
const COMPLEXITY_KEYWORDS = /\b(if|for|while|when|catch|else\s+if)\b|&&|\|\|/g;

/**
 * 收集工程内所有 .kt 文件
 * @param {string} rootDir
 * @param {{maxFiles?: number}} options
 * @returns {Promise<string[]>}
 */
export async function findKotlinFiles(rootDir, { maxFiles = 2000 } = {}) {
  const files = [];
  async function walk(dir, depth) {
    if (depth > 8 || files.length >= maxFiles) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
      } else if (entry.name.endsWith('.kt') || entry.name.endsWith('.kts')) {
        files.push(full);
        if (files.length >= maxFiles) return;
      }
    }
  }
  await walk(rootDir, 0);
  return files;
}

/** 去注释（保留字符串与行号结构） */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, m => ' '.repeat(m.length));
}

/** 统计圈复杂度 */
function estimateComplexity(body) {
  const matches = body.match(COMPLEXITY_KEYWORDS);
  return 1 + (matches ? matches.length : 0);
}

/**
 * 解析单个 Kotlin 文件
 *
 * @param {string} filePath
 * @returns {{
 *   path: string,
 *   package: string|null,
 *   imports: string[],
 *   lineCount: number,
 *   functions: Array<{name: string, isSuspend: boolean, isComposable: boolean, line: number, complexity: number}>,
 *   classes: Array<{name: string, line: number, kind: string, superTypes: string[]}>,
 *   calls: Array<{name: string, receiver: string|null, line: number}>,
 *   confidence: number
 * }}
 */
export function parseFile(filePath) {
  let src;
  try {
    src = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
  const clean = stripComments(src);
  const lines = clean.split('\n');

  const pkgMatch = clean.match(/^\s*package\s+([\w.]+)/m);
  const imports = [...clean.matchAll(/^\s*import\s+([\w.*]+)/gm)].map(m => m[1]);

  const functions = [];
  const classRe = /^\s*(?:(@\w+(?:\([^)]*\))?\s+)*)(public|private|internal|protected)?\s*(?:(suspend|inline|operator)\s+)*fun\s+(?:<[^>]+>\s+)?(\w+)/gm;
  let fm;
  while ((fm = classRe.exec(clean)) !== null) {
    const isSuspend = /(?:^|\s)suspend\s+fun\s+(\w+)/.test(clean.slice(fm.index, fm.index + 120));
    const decorators = fm[1] || '';
    const isComposable = /@Composable/.test(decorators) ||
      (fm.index > 0 && /@Composable\s*$/.test(clean.slice(Math.max(0, fm.index - 40), fm.index)));
    // 取函数体（括号匹配，最多 300 行）
    const bodyStart = clean.indexOf('{', fm.index);
    let body = '';
    if (bodyStart !== -1 && bodyStart - fm.index < 400) {
      let depth = 0;
      let end = bodyStart;
      for (let i = bodyStart; i < clean.length && i - bodyStart < 20000; i++) {
        if (clean[i] === '{') depth++;
        else if (clean[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      body = clean.slice(bodyStart, end);
    }
    const line = clean.slice(0, fm.index).split('\n').length;
    functions.push({
      name: fm[4],
      isSuspend,
      isComposable,
      line,
      complexity: estimateComplexity(body)
    });
  }

  const classes = [];
  const clsRe = /^\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:public|private|internal|abstract|sealed|open|data|enum)\s+)*(class|object|interface)\s+(\w+)(?:\s*:\s*([^{]+))?/gm;
  let cm;
  while ((cm = clsRe.exec(clean)) !== null) {
    const line = clean.slice(0, cm.index).split('\n').length;
    const superTypes = cm[3]
      ? cm[3].split(',').map(s => s.trim().replace(/\(.*\)$/, '')).filter(Boolean)
      : [];
    const decorators = clean.slice(Math.max(0, cm.index - 80), cm.index);
    const kind = /@Composable/.test(decorators) && cm[1] === 'class' ? 'composable-class' : cm[1];
    classes.push({ name: cm[2], line, kind, superTypes });
  }

  // 调用点：receiver.launch / GlobalScope.launch / mutableStateOf 等
  const calls = [];
  const callRe = /(\w+(?:\.\w+)*)\s*\.\s*(launch|launchWhenCreated|launchWhenStarted|launchWhenResumed|collect|collectLatest|stateIn|shareIn)\s*[\s({]/g;
  let km;
  while ((km = callRe.exec(clean)) !== null) {
    calls.push({
      name: km[2],
      receiver: km[1],
      line: clean.slice(0, km.index).split('\n').length
    });
  }

  return {
    path: filePath,
    package: pkgMatch ? pkgMatch[1] : null,
    imports,
    lineCount: lines.length,
    functions,
    classes,
    calls,
    confidence: 0.8
  };
}

/**
 * 解析整个工程的 Kotlin 源码
 * @param {string} rootDir
 * @param {{root?: string}} options root 限定扫描子目录（如 Android 子工程）
 */
export async function parseProject(rootDir, options = {}) {
  const scanRoot = options.root ? path.join(rootDir, options.root) : rootDir;
  const files = await findKotlinFiles(scanRoot);
  const parsed = [];
  for (const f of files) {
    if (f.endsWith('.kts')) continue; // 构建脚本由 gradle-inspector 处理
    const r = parseFile(f);
    if (r) parsed.push(r);
  }
  return parsed;
}

export default { findKotlinFiles, parseFile, parseProject };
