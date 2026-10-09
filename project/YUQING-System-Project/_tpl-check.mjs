/**
 * F-007 模板自检器（临时工具，交付前删除）
 * 用法: node _tpl-check.mjs gen-yuqing-analysis-tpl5.mjs
 *
 * 检查项：
 *   1. 源码层：模板串内是否存在「未转义插值」${（会被 JS 提前求值 → ReferenceError）
 *   2. 源码层：是否存在裸反引号（破坏模板串分界）
 *   3. 产物层：是否存在真实 CR/TAB（说明 \\r \\t 被提前解析）
 *   4. 产物层：Java 文件里的 \\n \\t \\r 转义序列（本项目铁律：Java 不用）
 *   5. 重复产物路径
 */
import fs from 'fs';

const file = process.argv[2];
if (!file) { console.error('usage: node _tpl-check.mjs <tpl.mjs>'); process.exit(1); }

const src = fs.readFileSync(file, 'utf8');
const mod = await import('./' + file);
const key = Object.keys(mod).find((k) => Array.isArray(mod[k]));
const FILES = mod[key];

let bad = 0;

/* ---------- 1. 源码层：未转义 ${ ---------- */
/* 允许 \${（转义，产出字面量）；不允许裸 ${ */
const badInterp = [];
src.split('\n').forEach((line, i) => {
  const t = line.trim();
  /* 跳过生成器自身的注释行：文档里提到 ${ 是正常的（说明约定），不是插值 */
  if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*') || t.startsWith('#')) return;
  for (let p = line.indexOf('${'); p >= 0; p = line.indexOf('${', p + 1)) {
    if (line[p - 1] !== '\\') { badInterp.push((i + 1) + ': ' + t.slice(0, 100)); break; }
  }
});
if (badInterp.length) {
  console.log('  ✗ 源码含未转义插值 ${ ：');
  badInterp.forEach((x) => console.log('      ' + x));
  bad++;
}

/* ---------- 2. 源码层：裸反引号 ---------- */
/* 模板串用反引号定界，因此源码里成对出现是正常的；这里只找「奇数个反引号的行」这类明显异常。
 * 真正要防的是「Java/Vue 内容里想输出反引号却写成裸反引号」——那会直接让 node --check 失败，
 * 所以这一项交给 node --check 兜底，这里只做数量统计提示。 */
const btCount = (src.match(/`/g) || []).length;
if (btCount % 2 !== 0) {
  console.log('  ✗ 反引号数量为奇数（' + btCount + '），模板串可能未闭合');
  bad++;
}

/* ---------- 3/4/5. 产物层 ---------- */
console.log('导出名: ' + key + '   文件数: ' + FILES.length);
const seen = new Map();
for (const f of FILES) {
  const rel = f.rel;
  const c = f.content;
  if (typeof c !== 'string' || !c.length) { console.log('  ✗ 空内容 ' + rel); bad++; continue; }
  if (seen.has(rel)) { console.log('  ✗ 重复路径 ' + rel); bad++; }
  seen.set(rel, 1);
  const ctrl = [...c].filter((ch) => ch === '\u000d' || ch === '\u0009').length;
  if (ctrl) { console.log('  ✗ 真实 CR/TAB ' + ctrl + ' 处: ' + rel); bad++; }
  if (rel.endsWith('.java')) {
    const esc = (c.match(/\\[ntr]/g) || []).length;
    if (esc) { console.log('  ! Java 含转义序列 ' + esc + ' 处: ' + rel); }
  }
  if (!/^(java\/|pc\/|h5\/|sql\/|config\/|test\/)/.test(rel)
    && !/^[\w-]+\//.test(rel)) {
    console.log('  ! 路径前缀可疑: ' + rel);
  }
}
const bytes = FILES.reduce((s, f) => s + Buffer.byteLength(f.content, 'utf8'), 0);
console.log('大小: ' + (bytes / 1024).toFixed(1) + ' KB   问题数: ' + bad);
process.exit(bad ? 1 : 0);
