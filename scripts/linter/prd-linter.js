import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import yaml from 'yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_PATH = path.join(__dirname, '..', '..', 'config', 'prd-rules.yaml');

export async function runPRDChecks(projectRoot) {
  const start = Date.now();

  const rulesContent = fs.existsSync(RULES_PATH)
    ? fs.readFileSync(RULES_PATH, 'utf-8')
    : '';
  const rules = rulesContent ? yaml.parse(rulesContent) : getDefaultRules();

  const prdFiles = findPRDFiles(projectRoot);

  if (prdFiles.length === 0) {
    return {
      runner: 'prd-linter',
      success: true,
      issueCount: 0,
      errorCount: 0,
      warningCount: 0,
      issues: [],
      message: '未找到PRD文件',
      duration: Date.now() - start
    };
  }

  const allIssues = [];

  for (const filePath of prdFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileIssues = checkFile(filePath, content, rules);
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

function checkFile(filePath, content, rules) {
  const issues = [];
  const lines = content.split('\n');

  for (const [category, categoryRules] of Object.entries(rules.rules || {})) {
    if (!categoryRules.enabled) continue;

    for (const rule of (categoryRules.checks || [])) {
      const match = applyRule(rule, content, lines);
      if (!match.passed) {
        issues.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity || 'info',
          message: rule.message,
          file: filePath,
          line: match.line || 0,
          category
        });
      }
    }
  }

  return issues;
}

function applyRule(rule, content, lines) {
  if (rule.pattern) {
    try {
      const regex = new RegExp(rule.pattern, 'i');
      const match = content.match(regex);

      if (match) {
        const lineNum = content.substring(0, match.index).split('\n').length;

        if (rule.exclude_patterns) {
          for (const excl of rule.exclude_patterns) {
            if (new RegExp(excl, 'i').test(match[0])) {
              return { passed: true };
            }
          }
        }

        return { passed: true, line: lineNum };
      }

      return { passed: false, line: 0 };
    } catch {
      return { passed: true };
    }
  }

  if (rule.max_depth) {
    let maxDepth = 0;
    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s/);
      if (headerMatch) {
        maxDepth = Math.max(maxDepth, headerMatch[1].length);
      }
    }
    return { passed: maxDepth <= rule.max_depth };
  }

  return { passed: true };
}

function getDefaultRules() {
  return {
    rules: {
      structure: {
        enabled: true,
        checks: [
          { id: 'prd-has-title', name: 'PRD必须有标题', pattern: '^#+\\s+.+', severity: 'error', message: 'PRD文档缺少标题' },
          { id: 'prd-has-version', name: 'PRD必须包含版本信息', pattern: '(?i)(version|版本|v\\d+\\.\\d+)', severity: 'error', message: 'PRD文档缺少版本号' },
          { id: 'prd-has-goals', name: 'PRD必须包含目标', pattern: '(?i)(目标|goal)', severity: 'error', message: 'PRD文档缺少目标定义' }
        ]
      },
      content: { enabled: true, checks: [] },
      format: { enabled: true, checks: [] },
      consistency: { enabled: true, checks: [] }
    }
  };
}
