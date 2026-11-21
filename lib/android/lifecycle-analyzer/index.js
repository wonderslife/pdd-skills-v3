/**
 * Lifecycle Analyzer - Android 生命周期组件扫描与安全审查
 *
 * scanRoutes(rootDir) → 页面/路由清单（对齐 controller-scanner 输出契约）
 * audit(rootDir)      → 生命周期安全审查（GlobalScope / 裸 launch / 泄漏 / 重组风险）
 *
 * 见 docs/plans/04-kotlin-android-capability-enhancement.md §4.2.2。
 */

import path from 'path';
import { parseProject } from '../kotlin-parser/index.js';

const ROUTE_ANNOTATION = /@Route\s*\(\s*path\s*=\s*"([^"]+)"/;
const NAV_COMPOSABLE_RE = /^\s*(?:@\w+\s+)*(?:public|private|internal)?\s*(?:suspend\s+)?fun\s+(\w+)\s*\(/gm;

/**
 * 扫描页面/路由入口
 *
 * 返回结构与 lib/dependency-chain/controller-scanner.js 对齐：
 * route 对应后端契约扫描里的 endpoint path，上层 dependency-chain 无需感知语言差异。
 *
 * @param {string} rootDir 工程根目录
 * @param {{root?: string}} options Android 子目录（mixed 工程）
 */
export async function scanRoutes(rootDir, options = {}) {
  const parsed = await parseProject(rootDir, options);
  const routes = [];

  for (const file of parsed) {
    const src = file;
    for (const cls of src.classes) {
      const isActivity = /Activity$/.test(cls.name) || cls.superTypes.some(t => /Activity/.test(t));
      const isFragment = /Fragment$/.test(cls.name) || cls.superTypes.some(t => /Fragment/.test(t));
      if (!isActivity && !isFragment) continue;
      routes.push({
        route: cls.name,
        componentType: isActivity ? 'activity' : 'fragment',
        file: path.relative(process.cwd(), src.path),
        line: cls.line,
        lifecycleOwner: true
      });
    }
  }
  return routes;
}

/**
 * 生命周期安全审查
 *
 * 规则集（对应验收 §6.1 预埋 8 类反模式）：
 *  - GLOBAL_SCOPE         GlobalScope.launch / GlobalScope.async         ERROR
 *  - BARE_LAUNCH          Activity/Fragment 内非 lifecycle 作用域 launch  WARNING
 *  - LEAK_RISK            companion object 持有 Context / Handler 未清理  ERROR
 *  - RECOMPOSITION_RISK   @Composable 内 mutableStateOf 未用 remember     WARNING
 *  - RAW_COLLECT          collect 未配合 repeatOnLifecycle                WARNING
 *
 * @param {string} rootDir
 * @param {{root?: string}} options
 */
export async function audit(rootDir, options = {}) {
  const parsed = await parseProject(rootDir, options);
  const findings = [];

  for (const file of parsed) {
    let src;
    try {
      const { default: fs } = await import('fs-extra');
      src = (await fs.readFile(file.path, 'utf-8')).toString();
    } catch {
      continue;
    }
    const noComments = src
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
      .replace(/\/\/.*$/gm, m => ' '.repeat(m.length));
    const lineAt = (idx) => noComments.slice(0, idx).split('\n').length;
    const rel = path.relative(process.cwd(), file.path);

    for (const m of noComments.matchAll(/GlobalScope\s*\.\s*(launch|async)\b/g)) {
      findings.push({
        file: rel, line: lineAt(m.index), rule: 'GLOBAL_SCOPE', severity: 'error',
        message: `使用了 GlobalScope.${m[1]} —— 请改为 viewModelScope/lifecycleScope 等结构化作用域`
      });
    }

    // 裸 launch：Activity/Fragment 类体内出现非作用域前缀 launch
    for (const cls of file.classes) {
      if (!/(Activity|Fragment)$/.test(cls.name) && !cls.superTypes.some(t => /Activity|Fragment/.test(t))) continue;
      const body = noComments.slice(noComments.indexOf('class ' + cls.name));
      const scopeEnd = body.indexOf('\nclass ');
      const clsBody = scopeEnd > 0 ? body.slice(0, scopeEnd) : body;
      for (const m of clsBody.matchAll(/(?<![\w.])launch\s*[\s({]/g)) {
        const line = lineAt(noComments.length - clsBody.length + m.index);
        findings.push({
          file: rel, line, rule: 'BARE_LAUNCH', severity: 'warning',
          message: `${cls.name} 内存在裸 launch —— 请改用 lifecycleScope.launch / viewModelScope.launch`
        });
      }
    }

    for (const m of noComments.matchAll(/companion\s+object[\s\S]{0,200}?(val|var)\s+(\w+)\s*[:=][^=]*Context/g)) {
      findings.push({
        file: rel, line: lineAt(m.index), rule: 'LEAK_RISK', severity: 'error',
        message: `companion object 持有 Context（${m[2]}）—— 静态引用将泄漏 Activity/Service，请改用 applicationContext 或弱引用`
      });
    }

    // Composable 内未 remember 的 mutableStateOf
    for (const fn of file.functions) {
      if (!fn.isComposable) continue;
      const fnStart = noComments.indexOf(`fun ${fn.name}`);
      if (fnStart === -1) continue;
      const bodyStart = noComments.indexOf('{', fnStart);
      let depth = 0, end = bodyStart;
      for (let i = bodyStart; i < noComments.length && i - bodyStart < 20000; i++) {
        if (noComments[i] === '{') depth++;
        else if (noComments[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      const body = noComments.slice(bodyStart, end);
      for (const m of body.matchAll(/(?<!remember\s*[{(\s]\s*)\bmutableStateOf\s*\(/g)) {
        // 已被 remember 包裹则跳过（向前看 24 字符）
        const before = body.slice(Math.max(0, m.index - 24), m.index);
        if (/remember\s*[{(\s]*$/.test(before)) continue;
        findings.push({
          file: rel, line: lineAt(fnStart) + body.slice(0, m.index).split('\n').length - 1,
          rule: 'RECOMPOSITION_RISK', severity: 'warning',
          message: `Composable ${fn.name} 内 mutableStateOf 未用 remember 包裹 —— 每次重组都会创建新状态`
        });
      }
    }

    // collect 未配合 repeatOnLifecycle
    for (const call of file.calls) {
      if (call.name !== 'collect' && call.name !== 'collectLatest') continue;
      if (/repeatOnLifecycle|viewLifecycleOwner\.lifecycleScope|flowWithLifecycle/.test(noComments)) continue;
      findings.push({
        file: rel, line: call.line, rule: 'RAW_COLLECT', severity: 'warning',
        message: `Flow ${call.name} 未配合 repeatOnLifecycle/flowWithLifecycle —— 界面不可见时仍会收集`
      });
    }
  }

  return findings.sort((a, b) => {
    const order = { error: 0, warning: 1 };
    return (order[a.severity] ?? 2) - (order[b.severity] ?? 2) || a.file.localeCompare(b.file);
  });
}

export default { scanRoutes, audit };
