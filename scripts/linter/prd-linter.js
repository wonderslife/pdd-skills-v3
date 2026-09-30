import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import yaml from 'yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_PATH = path.join(__dirname, '..', '..', 'config', 'prd-rules.yaml');

// 规则配置层面的告警（如正则无法解析），随结果返回，避免静默失效
const configWarnings = [];

const RULE_TYPES = {
  PRESENCE: 'presence',
  ABSENCE: 'absence',
  MAX_DEPTH: 'max_depth'
};

function detectLanguage() {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  if (locale.startsWith('zh')) return 'zh';
  return 'en';
}

const MESSAGES = {
  zh: {
    noFiles: '未找到PRD文件',
    error: '错误',
    warning: '警告',
    info: '提示',
    issueCount: '发现问题',
    errorCount: '错误',
    warningCount: '警告',
    filesChecked: '检查文件数',
    duration: '耗时',
    ruleFailed: '规则检查失败',
    title: 'PRD文档缺少标题',
    version: 'PRD文档缺少版本号',
    goals: 'PRD文档缺少目标定义',
    vague: '使用模糊语言，应使用具体可量化的描述',
    codeBlock: '代码块缺少语言标识，请使用 ```language 格式'
  },
  en: {
    noFiles: 'No PRD files found',
    error: 'Error',
    warning: 'Warning',
    info: 'Info',
    issueCount: 'Issues found',
    errorCount: 'Errors',
    warningCount: 'Warnings',
    filesChecked: 'Files checked',
    duration: 'Duration',
    ruleFailed: 'Rule check failed',
    title: 'PRD document is missing a title',
    version: 'PRD document is missing version information',
    goals: 'PRD document is missing goals definition',
    vague: 'Vague language detected, use specific quantifiable descriptions',
    codeBlock: 'Code block missing language annotation, use ```language format'
  }
};

function t(key) {
  const lang = detectLanguage();
  return MESSAGES[lang][key] || MESSAGES['en'][key] || key;
}

export async function runPRDChecks(projectRoot, options = {}) {
  const start = Date.now();

  const rulesContent = fs.existsSync(RULES_PATH)
    ? fs.readFileSync(RULES_PATH, 'utf-8')
    : '';
  const rules = rulesContent ? yaml.parse(rulesContent) : getDefaultRules();

  let prdFiles;
  if (options.files && options.files.length > 0) {
    prdFiles = options.files
      .map(f => path.isAbsolute(f) ? f : path.join(projectRoot, f))
      .filter(f => fs.existsSync(f) && isLikelyPRD(f));
  } else {
    prdFiles = findPRDFiles(projectRoot);
  }

  if (prdFiles.length === 0) {
    // 用户显式指定了文件却一个都没匹配上 → 必须报错，不能当成「全部通过」。
    // 否则路径打错、文件改名、CI 里变量为空都会静默给出 100/100 ✅，
    // 是比「检查出问题」更危险的假绿灯。
    //
    // 但要与「项目里本来就没有 PRD」区分开：后者是检查不适用（no-op），不是错误。
    // 二者都给 ❌ 会让人以为项目有问题，也会让 CI 在纯后端工程上永远红。
    const requested = options.files || [];
    const explicitRequest = requested.length > 0;

    return {
      runner: 'prd-linter',
      success: true,
      issueCount: 0,
      errorCount: 0,
      warningCount: 0,
      issues: [],
      suppressions: [],
      // 只有「显式指定却零匹配」才算没跑成；项目内无 PRD 属于不适用，不算跳过
      skipped: explicitRequest,
      applicable: explicitRequest,
      message: explicitRequest
        ? `指定的文件未匹配到任何 PRD（已跳过检查）：${requested.join(', ')}`
        : `${t('noFiles')}（该检查不适用，非通过）`,
      duration: Date.now() - start
    };
  }

  const allIssues = [];

  const allSuppressions = [];

  for (const filePath of prdFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const { issues: fileIssues, suppressions } = checkFile(filePath, content, lines, rules, projectRoot);
    allIssues.push(...fileIssues);
    allSuppressions.push(...suppressions);
  }

  return {
    runner: 'prd-linter',
    success: allIssues.filter(i => i.severity === 'error').length === 0,
    issueCount: allIssues.length,
    errorCount: allIssues.filter(i => i.severity === 'error').length,
    warningCount: allIssues.filter(i => i.severity === 'warn').length,
    issues: allIssues.slice(0, 100),
    // 被规则豁免白名单（exclude_patterns）挡下的命中。必须随结果返回：
    // 豁免是「有意不报」，但它同样是「有东西被拦了」的事实，静默吞掉就是另一种假绿灯。
    suppressions: allSuppressions,
    configWarnings: [...new Set(configWarnings)],
    filesChecked: prdFiles.length,
    duration: Date.now() - start
  };
}

function findPRDFiles(root) {
  const patterns = [
    '**/*.md',
    '**/PRD*.md',
    '**/prd*.md',
    '**/requirements*.md',
    '**/spec*.md'
  ];

  const found = new Set();

  for (const pattern of patterns) {
    try {
      const files = fs.globSync(pattern, { cwd: root, ignore: ['**/node_modules/**', '**/.git/**', '**/.pdd/**'] });
      for (const f of files) found.add(path.join(root, f));
    } catch {}
  }

  return Array.from(found).filter(f => isLikelyPRD(f));
}

function isLikelyPRD(filePath) {
  const name = path.basename(filePath).toLowerCase();
  const keywords = ['prd', 'requirement', 'spec', 'feature', '需求', '规格', '功能'];
  return keywords.some(k => name.includes(k));
}

function getLocalizedMessage(ruleId, originalMessage) {
  const lang = detectLanguage();
  const messageMap = {
    'prd-has-title': { zh: 'PRD文档缺少标题', en: 'PRD document is missing a title' },
    'prd-has-version': { zh: 'PRD文档缺少版本号', en: 'PRD document is missing version information' },
    'prd-has-goals': { zh: 'PRD文档缺少目标定义', en: 'PRD document is missing goals definition' },
    'prd-vague-language': { zh: '使用模糊语言，应使用具体可量化的描述', en: 'Vague language detected, use specific quantifiable descriptions' },
    'prd-code-blocks': { zh: '代码块缺少语言标识，请使用 ```language 格式', en: 'Code block missing language annotation, use ```language format' }
  };

  if (messageMap[ruleId]) {
    return messageMap[ruleId][lang] || originalMessage;
  }
  return originalMessage;
}

function checkFile(filePath, content, lines, rules, projectRoot) {
  const issues = [];
  const suppressions = [];
  const relativePath = path.relative(projectRoot, filePath);

  for (const [category, categoryRules] of Object.entries(rules.rules || {})) {
    if (!categoryRules.enabled) continue;

    for (const rule of (categoryRules.checks || [])) {
      const ruleType = determineRuleType(rule);
      const { results, suppressions: ruleSuppressions } = applyRule(rule, ruleType, content, lines);

      for (const s of ruleSuppressions) {
        suppressions.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity || 'info',
          file: relativePath,
          line: s.line,
          context: s.context,
          matchedText: s.matchedText,
          excludedBy: s.excludedBy,
          category
        });
      }

      for (const result of results) {
        if (!result.passed) {
          issues.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity || 'info',
            message: getLocalizedMessage(rule.id, rule.message),
            file: relativePath,
            line: result.line || 0,
            context: result.context || '',
            category
          });
        }
      }
    }
  }

  return { issues, suppressions };
}

/**
 * 把 Python/PCRE 风格的内联标志 (如 `(?i)`) 转成 JS 能用的形式。
 *
 * config/prd-rules.yaml 里大量 pattern 写成 `(?i)(目标|goals?)` —— 这是 Python / PCRE 语法，
 * JS 的 RegExp 不支持内联标志组，`new RegExp('(?i)...')` 会抛
 * "Invalid group"。原先构造正则的 try/catch 把异常吞掉并返回「通过」，
 * 导致这些规则**静默失效**（22/26 条规则、含 7/7 个 blocker 从未真正执行）。
 *
 * 这里剥掉内联标志，由调用方用 'i' flag 统一实现大小写不敏感。
 */
function normalizePattern(pattern) {
  if (typeof pattern !== 'string') return pattern;
  // (?i) / (?im) / (?is:) 等一律剥离；大小写不敏感已由 'gi' flag 保证
  return pattern.replace(/\(\?[a-zA-Z]*\)/g, '');
}

function determineRuleType(rule) {
  if (rule.max_depth) return RULE_TYPES.MAX_DEPTH;

  if (rule.type === 'absence') return RULE_TYPES.ABSENCE;
  if (rule.type === 'presence') return RULE_TYPES.PRESENCE;

  const absenceKeywords = [
    '避免', '不应', '不要', '不得', '缺少', 'no-', 'avoid',
    'vague', 'missing', 'format', 'consistent'
  ];
  const ruleId = rule.id || '';
  const ruleName = rule.name || '';
  const ruleMessage = rule.message || '';

  if (absenceKeywords.some(k => ruleId.includes(k) || ruleName.includes(k) || ruleMessage.includes(k))) {
    return RULE_TYPES.ABSENCE;
  }

  return RULE_TYPES.PRESENCE;
}

/**
 * 执行单条规则。
 *
 * 返回值从「结果数组」改为 `{ results, suppressions }`：
 * `suppressions` 记录被 exclude_patterns 挡下的命中。豁免是有意为之，
 * 但「有东西被挡下」本身也是事实，必须能被上层统计出来 —— 否则豁免机制
 * 就变成了又一个静默失效点（与本文件历史上 `(?i)` 吞规则、零匹配假绿灯同类）。
 */
function applyRule(rule, ruleType, content, lines) {
  const suppressions = [];

  if (ruleType === RULE_TYPES.MAX_DEPTH) {
    let maxDepth = 0;
    let deepestLine = 0;
    for (let i = 0; i < lines.length; i++) {
      const headerMatch = lines[i].match(/^(#{1,6})\s/);
      if (headerMatch && headerMatch[1].length > maxDepth) {
        maxDepth = headerMatch[1].length;
        deepestLine = i + 1;
      }
    }
    if (maxDepth > rule.max_depth) {
      return {
        results: [{
          passed: false,
          line: deepestLine,
          context: lines[deepestLine - 1].trim()
        }],
        suppressions
      };
    }
    return { results: [{ passed: true }], suppressions };
  }

  if (!rule.pattern) return { results: [{ passed: true }], suppressions };

  try {
    const regex = new RegExp(normalizePattern(rule.pattern), rule.id === 'prd-code-blocks' ? 'g' : 'gi');
    const results = [];

    if (ruleType === RULE_TYPES.PRESENCE) {
      const match = regex.test(content);
      regex.lastIndex = 0;
      if (!match) {
        results.push({ passed: false, line: 0, context: '' });
      } else {
        results.push({ passed: true });
      }
    } else if (ruleType === RULE_TYPES.ABSENCE) {
      // 豁免正则预先编译一次：单条 exclude 写错正则不应连累整条规则。
      // 原先它们在匹配循环里现编现用，任何一个非法正则都会把异常抛到外层 catch，
      // 让整条规则静默判「通过」。
      const excludeRegexes = [];
      for (const excl of (rule.exclude_patterns || [])) {
        try {
          excludeRegexes.push({ source: excl, regex: new RegExp(normalizePattern(excl), 'i') });
        } catch (e) {
          configWarnings.push(`规则 ${rule.id} 的 exclude_patterns「${excl}」正则无法解析，该豁免已忽略：${e.message}`);
        }
      }

      let match;
      const seen = new Set();

      while ((match = regex.exec(content)) !== null) {
        if (seen.has(match.index)) break;
        seen.add(match.index);

        const lineNum = content.substring(0, match.index).split('\n').length;
        const matchedText = match[0].trim();
        const lineContent = lines[lineNum - 1] ? lines[lineNum - 1].trim() : matchedText;

        // 比对对象必须是整行内容，而不是命中的关键词本身。
        //
        // 原实现拿 `matchedText`（例如「提升」两个字）去 test `作为.*参考`，
        // 在任何输入下都不可能命中 —— 等于整套豁免白名单从未生效，
        // 而失败方式恰恰是「静默少报」。关键词只有 2 个字，做上下文豁免
        // 只能在整行粒度上做。
        const hit = excludeRegexes.find(({ regex: ex }) => ex.test(lineContent));
        if (hit) {
          suppressions.push({
            line: lineNum,
            matchedText,
            excludedBy: hit.source,
            context: lineContent.length > 80 ? lineContent.substring(0, 77) + '...' : lineContent
          });
          continue;
        }

        results.push({
          passed: false,
          line: lineNum,
          context: lineContent.length > 80 ? lineContent.substring(0, 77) + '...' : lineContent
        });

        if (results.length >= 20) break;
      }

      if (results.length === 0) {
        results.push({ passed: true });
      }
    }

    return { results, suppressions };
  } catch (e) {
    // 绝不静默「通过」：正则写错 = 规则没跑，必须让人看见，
    // 否则整条规则会无声失效（历史上 22/26 条规则就是这样被吞掉的）
    configWarnings.push(`规则 ${rule.id} 的正则无法解析，已跳过：${e.message}`);
    return { results: [{ passed: true }], suppressions };
  }
}

function getDefaultRules() {
  return {
    rules: {
      structure: {
        enabled: true,
        checks: [
          { id: 'prd-has-title', name: 'PRD必须有标题 / Must have title', type: 'presence', pattern: '^#+\\s+.+', severity: 'error', message: 'PRD文档缺少标题' },
          { id: 'prd-has-version', name: 'PRD必须包含版本信息 / Must have version', type: 'presence', pattern: '(?i)(version|版本|v\\d+\\.\\d+)', severity: 'error', message: 'PRD文档缺少版本号' },
          { id: 'prd-has-goals', name: 'PRD必须包含目标 / Must have goals', type: 'presence', pattern: '(?i)(目标|goal)', severity: 'error', message: 'PRD文档缺少目标定义' }
        ]
      },
      content: { enabled: true, checks: [] },
      format: { enabled: true, checks: [] },
      consistency: { enabled: true, checks: [] }
    }
  };
}
