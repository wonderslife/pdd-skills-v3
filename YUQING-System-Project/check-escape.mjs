#!/usr/bin/env node
/**
 * 三层转义体检器（生成器 → 产物）
 *
 * 为什么需要它：本项目产物要过「JS 模板字符串 → 生成器模块 → 产物文件 → 编译器」四层，
 * 反斜杠每过一层就少一个。人眼核对已连续出现多次误判（把对的看成错的、把错的看成对的）。
 *
 * 本脚本做**机器判定**，规则如下：
 *   1. Java 产物里出现**裸控制字符**（除 \r\n 行分隔外的 U+0000-U+001F）
 *      → 一定是模板里少了反斜杠，编译必炸。**致命**。
 *   2. Java 产物的字符串字面量里出现未转义的双引号配对失衡 → 编译必炸。**致命**。
 *      （识别字符字面量 '"' / '\'' / '\\'，不误报）
 *   3. **生成器源文件**（gen-*.mjs / *-tpl*.mjs）里出现裸反引号或 ${ → 破坏模板。**致命**。
 *      注意：产物 pc/**、h5/** 里的反引号是合法的 JS 模板字符串，**不检查**。
 *
 * 用法：node check-escape.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'yq-code');

/** 只体检我们自己生成的产物目录 */
const SCAN_DIRS = [
  'java/org/dromara/yuqing',
  'test/java/org/dromara/yuqing',
  'pc',
  'h5',
];

let fatal = 0;
let checked = 0;
const problems = [];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.includes('.bak-')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** 规则 1：裸控制字符（Java 源里出现即编译错误） */
function checkControlChars(file, text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let c = 0; c < line.length; c++) {
      const code = line.charCodeAt(c);
      // 允许 TAB(9)，其余 0-31 在 Java 单行里都是非法
      if (code < 32 && code !== 9) {
        problems.push({
          level: 'FATAL',
          file,
          line: i + 1,
          col: c + 1,
          msg: `裸控制字符 U+${code.toString(16).toUpperCase().padStart(4, '0')}，模板里少了一层反斜杠`,
          snippet: line.slice(Math.max(0, c - 30), c + 30),
        });
        fatal++;
        return;
      }
    }
  }
}

/** 规则 2：Java 字符串字面量配对（粗粒度但有效） */
function checkQuotes(file, text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    // 跳过注释行与注解行
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    let inStr = false;
    let escaped = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      // ---- 字符字面量：'\"' / '\'' / '\\' 等，整段吃掉，不当字符串引号 ----
      if (ch === "'") {
        // 形如 '<char>' 或 '\<char>' 或 '\uXXXX'
        let j = c + 1;
        if (line[j] === '\\') j += 2;
        else j += 1;
        if (line[j] === "'") { c = j; continue; }
        // 不是合法字符字面量（可能 JS 单引号用在了 Java 产物里），跳过
        continue;
      }
      if (ch === '"') {
        // 三连引号（文本块）单独处理
        if (line.slice(c, c + 3) === '"""') { c += 2; continue; }
        inStr = !inStr;
      }
    }
    if (inStr) {
      // 可能是跨行文本块，排除含 """ 的行
      if (!line.includes('"""')) {
        problems.push({
          level: 'FATAL',
          file,
          line: i + 1,
          col: line.length,
          msg: '字符串字面量未闭合（本行引号数为奇数）',
          snippet: trimmed.slice(0, 90),
        });
        fatal++;
      }
    }
  }
}

/**
 * 规则 3：**生成器源文件**里的裸反引号与 ${。
 * 只看生成器（.mjs），不看产物 —— 产物 pc/**、h5/** 里的反引号是合法 JS 模板字符串。
 */
function checkJsTemplates(file, text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('`')) {
      problems.push({
        level: 'FATAL',
        file,
        line: i + 1,
        col: line.indexOf('`') + 1,
        msg: '生成器里出现裸反引号（会破坏模板串，产物应改用字符串拼接或单引号）',
        snippet: line.trim().slice(0, 90),
      });
      fatal++;
    }
    const idx = line.indexOf('${');
    if (idx >= 0) {
      problems.push({
        level: 'FATAL',
        file,
        line: i + 1,
        col: idx + 1,
        msg: '生成器里出现 ${ 插值（会破坏模板串）',
        snippet: line.trim().slice(0, 90),
      });
      fatal++;
    }
  }
}

/* ---------------------------------------------------------------- 主流程 */

for (const d of SCAN_DIRS) {
  const base = path.join(OUT, d);
  for (const f of walk(base)) {
    const rel = path.relative(OUT, f).replace(/\\/g, '/');
    const text = fs.readFileSync(f, 'utf8');
    checked++;
    if (rel.endsWith('.java')) {
      checkControlChars(rel, text);
      checkQuotes(rel, text);
    }
    // 产物 pc/**、h5/** 里的反引号/`${` 是合法 JS 模板字符串，**不再检查**（规则 3 只针对生成器源文件）
  }
}

/* 规则 3 的实际作用域：本项目自有的 yuqing 生成器源文件
 * （PDD 框架自带的 gen-spec.mjs / pdd-stage.mjs 等不属于我们维护，跳过） */
const GEN_DIR = path.resolve(ROOT, '..'); // YUQING-System-Project
const genFiles = fs
  .readdirSync(GEN_DIR, { withFileTypes: true })
  .filter((e) => e.isFile() && /^gen-yuqing.*\.mjs$/.test(e.name))
  .map((e) => path.join(GEN_DIR, e.name));
for (const f of genFiles) {
  const rel = path.basename(f);
  const text = fs.readFileSync(f, 'utf8');
  checked++;
  checkJsTemplates('gen:' + rel, text);
}

console.log('');
console.log('⊕ 三层转义体检');
console.log('   扫描文件: ' + checked);
console.log('');
if (problems.length === 0) {
  console.log('   ✓ 全部通过，未发现编译级转义缺陷');
} else {
  const byFile = new Map();
  for (const p of problems) {
    if (!byFile.has(p.file)) byFile.set(p.file, []);
    byFile.get(p.file).push(p);
  }
  for (const [file, list] of byFile) {
    console.log('   ✗ ' + file);
    for (const p of list.slice(0, 6)) {
      console.log('       L' + p.line + ':' + p.col + '  ' + p.msg);
      if (p.snippet) console.log('         │ ' + p.snippet);
    }
    if (list.length > 6) console.log('       ... 另有 ' + (list.length - 6) + ' 处');
  }
}
console.log('');
console.log('   致命 ' + fatal + ' 处 / 共 ' + problems.length + ' 处');
console.log('');
process.exit(fatal > 0 ? 1 : 0);
