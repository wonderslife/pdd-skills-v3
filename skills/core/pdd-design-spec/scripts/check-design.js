#!/usr/bin/env node
/**
 * DESIGN.md 结构校验器
 *
 * 用法:
 *   node scripts/check-design.js <DESIGN.md 路径>
 *   node scripts/check-design.js ../project/xxx/DESIGN.md --json
 *
 * 检查项:
 *   1. front matter 存在且 YAML 合法
 *   2. 必需顶层键齐全 (colors/typography/spacing/rounded/components)
 *   3. 组件无裸 hex
 *   4. token 引用全部有效
 *   5. 状态色数量合理
 *   6. 状态色冲突（色相 × 明度 双重判定）
 *   7. 状态色白底对比度
 *
 * 退出码: 0 通过 / 1 有 CRITICAL 问题 / 2 只有 WARN
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 依赖解析：优先用框架自带 yaml，回退到最小解析器 ──
let YAML = null;
try { YAML = (await import('yaml')).default; } catch { /* fallback */ }

const REQUIRED_KEYS = ['colors', 'typography', 'spacing', 'rounded', 'components'];
const S_MIN = 0.20;   // 低于此饱和度视为灰阶，跳过色相比较
const HUE_MIN = 25;   // 色相距离阈值（度）
const L_MIN = 18;     // 明度差阈值（L* 单位）
const MIN_CONTRAST = 3.0;

const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const file = args.find(a => !a.startsWith('--')) || 'ui/DESIGN.md';

const report = { file, critical: [], warn: [], info: [], ok: [] };
const crit = m => report.critical.push(m);
const warn = m => report.warn.push(m);
const info = m => report.info.push(m);
const ok = m => report.ok.push(m);

// ── 读文件 ──
if (!fs.existsSync(file)) {
  console.error(`文件不存在: ${file}`);
  process.exit(1);
}
const src = fs.readFileSync(file, 'utf8');

// ── 1. front matter ──
const fmMatch = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
if (!fmMatch) {
  console.error('CRITICAL: 缺少 front matter（文件必须以 --- 开头）');
  process.exit(1);
}
let tokens;
try {
  tokens = YAML ? YAML.parse(fmMatch[1]) : miniParse(fmMatch[1]);
  if (!YAML) warn('未找到 yaml 依赖，已降级使用内置解析器（建议 npm i yaml）');
  ok('front matter YAML 合法');
} catch (e) {
  crit(`front matter YAML 非法: ${e.message}`);
  emit(); process.exit(1);
}

// ── 2. 必需键 ──
const missing = REQUIRED_KEYS.filter(k => !tokens[k]);
if (missing.length) crit(`缺少必需顶层键: ${missing.join(', ')}`);
else ok('必需顶层键齐全');

// ── 颜色工具 ──
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const isHex = v => typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v);
const lin = c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function hsl(h) {
  const [r, g, b] = rgb(h);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let hue = 0;
  if (d) {
    hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return { hue, s: mx === 0 ? 0 : d / mx };
}

function lightness(h) {
  const [r, g, b] = rgb(h).map(lin);
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}

function contrast(a, b) {
  const Y = h => { const [r, g, bl] = rgb(h).map(lin);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const [hi, lo] = [Y(a), Y(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

// ── 3 & 4. 裸 hex 与引用完整性 ──
const NS = ['colors', 'typography', 'spacing', 'rounded'];
let refCount = 0, bareCount = 0, brokenCount = 0;

for (const [cname, def] of Object.entries(tokens.components || {})) {
  if (!def || typeof def !== 'object') continue;
  for (const [k, v] of Object.entries(def)) {
    if (typeof v !== 'string') continue;
    if (isHex(v)) {
      crit(`裸 hex: components.${cname}.${k} = ${v}（应改为 {colors.x} 引用）`);
      bareCount++;
    }
    for (const m of v.matchAll(/\{(colors|typography|spacing|rounded)\.([\w.-]+)\}/g)) {
      refCount++;
      if (!tokens[m[1]] || !(m[2] in tokens[m[1]])) {
        crit(`引用失效: components.${cname}.${k} → ${m[0]}`);
        brokenCount++;
      }
    }
  }
}
if (!bareCount) ok(`组件无裸 hex（${Object.keys(tokens.components || {}).length} 个组件）`);
if (!brokenCount) ok(`token 引用有效（${refCount} 处）`);

// ── 5 & 6. 状态色 ──
const stateKeys = Object.keys(tokens.colors || {}).filter(k => k.startsWith('state-'));
if (stateKeys.length === 0) {
  warn('未定义任何 state-* 状态色（后台项目通常必需）');
} else {
  info(`状态色 ${stateKeys.length} 个: ${stateKeys.join(', ')}`);
  if (stateKeys.length > 9) {
    info(`状态色 ${stateKeys.length} 个 > 9，需靠"色族 + 明度 + 图标"细分（见下）`);
  }

  const families = new Map();
  const cmp = (aName, a, bName, b) => {
    if (!isHex(a) || !isHex(b)) return;
    const A = hsl(a), B = hsl(b);
    if (A.s < S_MIN || B.s < S_MIN) return;           // 灰阶豁免
    let dh = Math.abs(A.hue - B.hue); if (dh > 180) dh = 360 - dh;
    const dl = Math.abs(lightness(a) - lightness(b));
    if (dh < HUE_MIN && dl < L_MIN) {
      crit(`状态色冲突: ${aName}(${a}) vs ${bName}(${b}) 色相差 ${dh.toFixed(0)}°、明度差 ${dl.toFixed(0)}（需 ≥${L_MIN}）`);
    } else if (dh < HUE_MIN) {
      info(`同族可接受: ${aName} vs ${bName} 色相差 ${dh.toFixed(0)}°、明度差 ${dl.toFixed(0)}`);
      families.set(`${aName}+${bName}`, true);
    }
  };

  if (tokens.colors.primary) {
    stateKeys.forEach(s => cmp('primary', tokens.colors.primary, s, tokens.colors[s]));
  }
  for (let i = 0; i < stateKeys.length; i++)
    for (let j = i + 1; j < stateKeys.length; j++)
      cmp(stateKeys[i], tokens.colors[stateKeys[i]], stateKeys[j], tokens.colors[stateKeys[j]]);

  // ── 7. 对比度（仅当状态色被用作文字时才关键）──
  // 推荐做法：状态色只作圆点/色块，文字用中性深灰 —— 此时本项无意义
  const lowContrast = [];
  for (const s of stateKeys) {
    const c = tokens.colors[s];
    if (!isHex(c)) continue;
    const cr = contrast(c, '#FFFFFF');
    if (cr < MIN_CONTRAST) lowContrast.push(`${s}(${c}) ${cr.toFixed(2)}:1`);
  }
  if (lowContrast.length) {
    const asText = /状态色.{0,6}(文字|text)/.test(src) || /color:\s*var\(--state-/.test(src);
    const msg = `以下状态色在白底对比度 < ${MIN_CONTRAST}:1：${lowContrast.join('、')}`;
    if (asText) warn(msg + '（检测到状态色被用作文字，必须加深）');
    else info(msg + '（仅作圆点/色块，可接受）');
  }
  ok(`状态色检查完成（${families.size} 组同族）`);
}

// ── 8. 双编码检查（正文是否声明了图标）──
const iconHints = ['图标', '◔', '◑', '↩', '↻', '⚠', '双编码'];
if (iconHints.some(h => src.includes(h))) ok('状态双编码已声明（图标/形状）');
else warn('正文未发现状态图标声明，状态可能仅靠颜色编码');

// ── 输出 ──
emit();
process.exit(report.critical.length ? 1 : report.warn.length ? 2 : 0);

function emit() {
  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const line = '─'.repeat(56);
  console.log(`\nDESIGN.md 校验  ${file}`);
  console.log(line);
  if (report.critical.length) {
    console.log('\n[CRITICAL]');
    report.critical.forEach(m => console.log('  x ' + m));
  }
  if (report.warn.length) {
    console.log('\n[WARN]');
    report.warn.forEach(m => console.log('  ! ' + m));
  }
  if (report.info.length) {
    console.log('\n[INFO]');
    report.info.forEach(m => console.log('  - ' + m));
  }
  console.log(line);
  console.log(`通过 ${report.ok.length} | 严重 ${report.critical.length} | 警告 ${report.warn.length}`);
  console.log(report.critical.length ? '结果: 不通过\n' : report.warn.length ? '结果: 通过（有警告）\n' : '结果: 通过\n');
}

// ── 无 yaml 依赖时的最小解析器（仅支持本模板用到的子集）──
// 注意：必须正确剥离行尾注释，否则 "#86909C  # 灰族" 会让 isHex 判定失败，
//       导致所有颜色检查被静默跳过（比报错更危险）。
function cleanVal(raw) {
  let v = raw.trim();
  if (v.startsWith('"') || v.startsWith("'")) {
    const q = v[0];
    const end = v.indexOf(q, 1);
    if (end > 0) return v.slice(1, end);
  }
  const hash = v.indexOf(' #');
  if (hash > 0) v = v.slice(0, hash);
  return v.trim();
}

function miniParse(text) {
  const root = {};
  const stack = [{ obj: root, indent: -1 }];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.search(/\S/);
    const line = raw.trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const cur = stack[stack.length - 1].obj;
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (!m) continue;
    const [, key, val] = m;
    if (val.trim() === '') {
      cur[key] = {};
      stack.push({ obj: cur[key], indent });
    } else {
      cur[key] = cleanVal(val);
    }
  }
  return root;
}
