import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import yaml from 'yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_PATH = path.join(__dirname, '..', '..', 'config', 'prd-rules.yaml');

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
    return {
      runner: 'prd-linter',
      success: true,
      issueCount: 0,
      errorCount: 0,
      warningCount: 0,
      issues: [],
      message: t('noFiles'),
      duration: Date.now() - start
    };
  }

  const allIssues = [];

  for (const filePath of prdFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const fileIssues = checkFile(filePath, content, lines, rules, projectRoot);
    allIssues.push(...fileIssues);
  }

  return {
    runner: 'prd-linter',
    success: allIssues.filter(i => i.severity === 'error').length === 0,
    issueCount: allIssues.length,
    errorCount: allIssues.filter(i => i.severity === 'error').length,
    warningCount: allIssues.filter(i => i.severity === 'warn').length,
    issues: allIssues.slice(0, 100),
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
  const relativePath = path.relative(projectRoot, filePath);

  for (const [category, categoryRules] of Object.entries(rules.rules || {})) {
    if (!categoryRules.enabled) continue;

    for (const rule of (categoryRules.checks || [])) {
      const ruleType = determineRuleType(rule);
      const results = applyRule(rule, ruleType, content, lines);

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

  return issues;
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

function applyRule(rule, ruleType, content, lines) {
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
      return [{
        passed: false,
        line: deepestLine,
        context: lines[deepestLine - 1].trim()
      }];
    }
    return [{ passed: true }];
  }

  if (!rule.pattern) return [{ passed: true }];

  try {
    const regex = new RegExp(rule.pattern, rule.id === 'prd-code-blocks' ? 'g' : 'gi');
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
      let match;
      const seen = new Set();

      while ((match = regex.exec(content)) !== null) {
        if (seen.has(match.index)) break;
        seen.add(match.index);

        const lineNum = content.substring(0, match.index).split('\n').length;
        const matchedText = match[0].trim();
        const lineContent = lines[lineNum - 1] ? lines[lineNum - 1].trim() : matchedText;

        if (rule.exclude_patterns) {
          let excluded = false;
          for (const excl of rule.exclude_patterns) {
            if (new RegExp(excl, 'i').test(matchedText)) {
              excluded = true;
              break;
            }
          }
          if (excluded) continue;
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

    return results;
  } catch {
    return [{ passed: true }];
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
