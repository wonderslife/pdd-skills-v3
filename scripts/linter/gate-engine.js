import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadGateConfig() {
  const configPath = path.resolve(__dirname, '../../config/gate-config.yaml');
  if (!fs.existsSync(configPath)) {
    return getDefaultConfig();
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return parseSimpleYaml(raw);
  } catch (e) {
    console.warn(chalk.yellow(`⚠️  无法读取门控配置文件 ${configPath}，使用默认配置`));
    return getDefaultConfig();
  }
}

function parseSimpleYaml(raw) {
  const config = {
    gate_levels: [],
    severity_mapping: {},
    blocker_rule_ids: [],
    blocker_fix_suggestions: {},
    score_weights: {},
    grade_thresholds: {}
  };

  let currentSection = null;
  let currentItem = null;

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const sectionMatch = trimmed.match(/^([a-z_]+):$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      currentItem = null;
      continue;
    }

    const listItemMatch = trimmed.match(/^- (.+)$/);
    if (listItemMatch && currentSection === 'blocker_rule_ids') {
      config.blocker_rule_ids.push(listItemMatch[1].trim().replace(/['"]/g, ''));
      continue;
    }

    if (listItemMatch && currentSection === 'gate_levels') {
      currentItem = {};
      config.gate_levels.push(currentItem);
      continue;
    }

    const kvMatch = trimmed.match(/^([a-z_]+):\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      let val = kvMatch[2].trim().replace(/^["']|["']$/g, '');

      if (currentSection === 'severity_mapping') {
        config.severity_mapping[key] = val;
      } else if (currentSection === 'blocker_fix_suggestions') {
        config.blocker_fix_suggestions[key] = val.replace(/^["']|["']$/g, '');
      } else if (currentSection === 'score_weights') {
        config.score_weights[key] = isNaN(Number(val)) ? val : Number(val);
      } else if (currentSection === 'grade_thresholds') {
        config.grade_thresholds[key] = Number(val);
      } else if (currentItem && currentSection === 'gate_levels') {
        currentItem[key] = isNaN(Number(val)) ? val : Number(val);
      }
    }
  }

  return config;
}

function getDefaultConfig() {
  return {
    gate_levels: [
      { id: 'blocker', exit_code: 1, message: '🚫 BLOCKER: 流程被阻断，必须修复后才能继续' },
      { id: 'critical', exit_code: 1, message: '🔴 CRITICAL: 严重问题，必须修复' },
      { id: 'warning', exit_code: 0, message: '🟡 WARNING: 建议修复，非阻塞' },
      { id: 'info', exit_code: 0, message: '🔵 INFO: 可选优化' }
    ],
    severity_mapping: { error: 'critical', warn: 'warning', info: 'info' },
    blocker_rule_ids: [
      'uiux-no-uuid-input', 'dm-enum-convention', 'dm-permission-matrix',
      'uiux-form-mapping-exists', 'uiux-options-api-listed',
      'api-options-endpoint', 'prd-has-out-of-scope'
    ],
    blocker_fix_suggestions: {
      'uiux-no-uuid-input': '外键字段使用Select组件而非手动输入',
      'dm-enum-convention': '在PRD中添加枚举编码约定章节',
      'dm-permission-matrix': '在PRD中添加角色×状态×操作权限矩阵',
      'uiux-form-mapping-exists': '在PRD中添加表单字段组件映射表',
      'uiux-options-api-listed': '在PRD中列出所有Options API数据源',
      'api-options-endpoint': '在PRD接口设计中声明/options端点',
      'prd-has-out-of-scope': '在PRD中明确声明超出范围的功能'
    },
    score_weights: {
      blocker_base: 0, critical_max_issues_for_nonzero: 5,
      critical_floor_score: 20, base_score: 100,
      critical_penalty: 15, warning_penalty: 5, info_penalty: 1
    },
    grade_thresholds: { A: 90, B: 80, C: 70, D: 60, F: 0 }
  };
}

const GATE_CONFIG = loadGateConfig();

const GATE_LEVELS = {};
for (const level of GATE_CONFIG.gate_levels) {
  GATE_LEVELS[level.id.toUpperCase()] = level.id;
}

const GATE_ACTIONS = {};
for (const level of GATE_CONFIG.gate_levels) {
  GATE_ACTIONS[level.id] = {
    exitCode: level.exit_code,
    message: level.message
  };
}

const SEVERITY_TO_GATE = GATE_CONFIG.severity_mapping;
const BLOCKER_RULE_IDS = GATE_CONFIG.blocker_rule_ids;

export class GateEngine {
  constructor(options = {}) {
    this.strict = options.strict || false;
    this.failOnWarning = options.failOnWarning || false;
    this.blockerRuleIds = new Set(BLOCKER_RULE_IDS);
    this.fixSuggestions = GATE_CONFIG.blocker_fix_suggestions;
    this.weights = GATE_CONFIG.score_weights;
    this.grades = GATE_CONFIG.grade_thresholds;
  }

  evaluate(linterResults) {
    const allIssues = [];
    for (const result of linterResults) {
      if (result.issues) {
        allIssues.push(...result.issues);
      }
    }

    const classified = this.classifyIssues(allIssues);
    const score = this.calculateScore(classified);
    const gateResult = this.determineGate(classified, score);

    return {
      ...gateResult,
      score,
      classified,
      totalIssues: allIssues.length,
      blockerCount: classified.blocker.length,
      criticalCount: classified.critical.length,
      warningCount: classified.warning.length,
      infoCount: classified.info.length
    };
  }

  classifyIssues(issues) {
    const classified = { blocker: [], critical: [], warning: [], info: [] };
    for (const issue of issues) {
      const gateLevel = this.determineGateLevel(issue);
      classified[gateLevel].push({ ...issue, gateLevel });
    }
    return classified;
  }

  determineGateLevel(issue) {
    if (this.blockerRuleIds.has(issue.ruleId)) {
      return GATE_LEVELS.BLOCKER;
    }
    const severity = issue.severity || 'info';
    return SEVERITY_TO_GATE[severity] || GATE_LEVELS.INFO;
  }

  calculateScore(classified) {
    const w = this.weights;
    if (classified.blocker.length > 0) return w.blocker_base;
    if (classified.critical.length > w.critical_max_issues_for_nonzero) {
      return Math.max(0, w.critical_floor_score);
    }
    let score = w.base_score;
    score -= classified.critical.length * w.critical_penalty;
    score -= classified.warning.length * w.warning_penalty;
    score -= classified.info.length * w.info_penalty;
    return Math.max(0, Math.min(100, score));
  }

  determineGate(classified, score) {
    if (classified.blocker.length > 0) {
      return {
        passed: false,
        gate: GATE_LEVELS.BLOCKER,
        action: GATE_ACTIONS.blocker,
        message: this.formatBlockerMessage(classified.blocker)
      };
    }
    if (classified.critical.length > 0) {
      return {
        passed: !this.strict,
        gate: GATE_LEVELS.CRITICAL,
        action: GATE_ACTIONS.critical,
        message: this.formatCriticalMessage(classified.critical)
      };
    }
    if (classified.warning.length > 0 && this.failOnWarning) {
      return {
        passed: false,
        gate: GATE_LEVELS.WARNING,
        action: GATE_ACTIONS.warning,
        message: this.formatWarningMessage(classified.warning)
      };
    }
    return {
      passed: true,
      gate: score >= 80 ? GATE_LEVELS.INFO : GATE_LEVELS.WARNING,
      action: GATE_ACTIONS.info,
      message: score >= 80
        ? chalk.green('✅ PRD质量评分通过，可以进入开发阶段')
        : chalk.yellow(`⚠️ PRD质量评分 ${score}/100，建议改进后再开发`)
    };
  }

  formatBlockerMessage(blockers) {
    const lines = [chalk.red.bold('\n🚫 BLOCKER - 流程被阻断！以下问题必须修复：\n')];
    for (const b of blockers) {
      lines.push(chalk.red(`  ❌ [${b.ruleId}] ${b.message}`));
      if (b.file) lines.push(chalk.gray(`     文件: ${b.file}${b.line ? `:${b.line}` : ''}`));
    }
    lines.push('');
    lines.push(chalk.yellow('  修复建议:'));
    for (const b of blockers) {
      const suggestion = this.fixSuggestions[b.ruleId];
      if (suggestion) {
        lines.push(chalk.yellow(`  - ${b.ruleId}: ${suggestion}`));
      }
    }
    return lines.join('\n');
  }

  formatCriticalMessage(criticals) {
    const lines = [chalk.red.bold(`\n🔴 CRITICAL - 发现 ${criticals.length} 个严重问题：\n`)];
    for (const c of criticals.slice(0, 10)) {
      lines.push(chalk.red(`  ❌ [${c.ruleId}] ${c.message}`));
    }
    if (criticals.length > 10) {
      lines.push(chalk.gray(`  ... 还有 ${criticals.length - 10} 个问题`));
    }
    return lines.join('\n');
  }

  formatWarningMessage(warnings) {
    const lines = [chalk.yellow.bold(`\n🟡 WARNING - 发现 ${warnings.length} 个警告：\n`)];
    for (const w of warnings.slice(0, 5)) {
      lines.push(chalk.yellow(`  ⚠️ [${w.ruleId}] ${w.message}`));
    }
    if (warnings.length > 5) {
      lines.push(chalk.gray(`  ... 还有 ${warnings.length - 5} 个警告`));
    }
    return lines.join('\n');
  }

  generateScorecard(gateResult) {
    const { score, classified, totalIssues } = gateResult;
    const g = this.grades;
    const grade = score >= g.A ? 'A' : score >= g.B ? 'B' : score >= g.C ? 'C' : score >= g.D ? 'D' : 'F';
    const gradeColor = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;

    const lines = [
      chalk.bold('\n━━━ PRD质量评分卡 ━━━\n'),
      `  ${gradeColor.bold(`评分: ${score}/100  等级: ${grade}`)}`,
      '',
      `  🚫 Blocker:  ${classified.blocker.length}`,
      `  🔴 Critical: ${classified.critical.length}`,
      `  🟡 Warning:  ${classified.warning.length}`,
      `  🔵 Info:     ${classified.info.length}`,
      `  📊 总问题数: ${totalIssues}`,
      '',
      `  ${gateResult.passed ? chalk.green('✅ 通过门禁') : chalk.red('❌ 未通过门禁')}`,
      ''
    ];

    return lines.join('\n');
  }
}

export { GATE_LEVELS, BLOCKER_RULE_IDS, GATE_CONFIG };
