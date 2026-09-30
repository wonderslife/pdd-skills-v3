import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { log, findProjectRoot, loadConfig } from '../../lib/utils/logger.js';
import { GateEngine } from './gate-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_ROOT = path.join(__dirname, '..', '..', 'config');

const LINTER_REGISTRY = {
  code: {
    name: 'Code Linter',
    description: '代码质量检查 (Checkstyle/PMD/ESLint/Ruff)',
    runners: ['checkstyle', 'pmd', 'eslint', 'ruff']
  },
  prd: {
    name: 'PRD Linter',
    description: 'PRD文档规范检查',
    runners: ['prd']
  },
  sql: {
    name: 'SQL Linter',
    description: 'SQL脚本规范检查 (SQLFluff)',
    runners: ['sql']
  },
  activiti: {
    name: 'Activiti Linter',
    description: 'BPMN流程文件规范检查',
    runners: ['activiti']
  }
};

export default async function runLinters(options = {}) {
  const startTime = Date.now();

  // Handle type parameter - can be string or array
  let types = options.type || 'code';
  if (typeof types === 'string') {
    // Handle 'all' type - run all linters
    if (types === 'all') {
      types = Object.keys(LINTER_REGISTRY);
    } else {
      types = types.split(',').map(t => t.trim()).filter(t => t);
    }
  }

  const incremental = options.incremental || false;
  const outputFormat = options.output || 'text';

  // JSON 模式下 stdout 必须是纯 JSON，否则 `pdd linter -o json | jq` 会因前置的
  // 横幅/日志行解析失败（CI 里会当成工具报错）。诊断信息一律改走 stderr。
  const jsonMode = outputFormat === 'json';
  const diag = (msg, isLog = false) => {
    if (jsonMode) console.error(msg);
    else if (isLog) log('info', msg);
    else console.log(msg);
  };

  
  // Handle file parameter - can be string or array, convert to array for linterOptions
  let fileOptions = null;
  if (options.file) {
    fileOptions = Array.isArray(options.file) ? options.file : [options.file];
  }
  const linterOptions = {
    files: fileOptions,
    includeAll: options.includeAll || false
  };

  if (!jsonMode) console.log(chalk.blue.bold('\n🔍 PDD Linter - 代码与文档质量检查\n'));

  const projectRoot = await findProjectRoot(process.cwd());
  diag(`项目根目录: ${projectRoot}`, true);
  const config = await loadConfig(projectRoot);

  if (!config.linter.enabled) {
    diag(chalk.yellow('⚠️  Linter未启用，请检查 .pdd/config.yaml'));
    return;
  }

  const results = [];

  for (const type of types) {
    const linterDef = LINTER_REGISTRY[type];
    if (!linterDef) {
      diag(chalk.yellow(`未知Linter类型: ${type}, 跳过`));
      continue;
    }

    if (!jsonMode) {
      console.log(chalk.cyan(`\n━━━ ${linterDef.name} ━━━`));
      console.log(chalk.gray(`  ${linterDef.description}\n`));
    }

    for (const runner of linterDef.runners) {
      try {
        const result = await executeLinter(runner, projectRoot, config, incremental, linterOptions);
        results.push(result);
        printResult(result, outputFormat);
      } catch (e) {
        results.push({
          runner,
          type,
          success: false,
          error: e.message,
          duration: 0
        });
        log('error', `${runner} 执行失败`, e.message);
      }
    }
  }

  await generateSummary(results, startTime, outputFormat, types);

  return results;
}

async function executeLinter(runner, projectRoot, config, incremental, linterOptions) {
  const start = Date.now();

  switch (runner) {
    case 'checkstyle':
      return runCheckstyle(projectRoot, incremental);
    case 'pmd':
      return runPMD(projectRoot, incremental);
    case 'eslint':
      return runESLint(projectRoot, incremental);
    case 'ruff':
      return runRuff(projectRoot, incremental);
    case 'prd':
      return runPRDLinter(projectRoot, linterOptions);
    case 'sql':
      return runSQLLinter(projectRoot);
    case 'activiti':
      return runActivitiLinter(projectRoot);
    default:
      throw new Error(`未知linter runner: ${runner}`);
  }
}

/**
 * 判断异常是否意味着「命令压根没能执行」（工具未安装 / 找不到可执行文件 / 找不到 jar），
 * 而不是「命令跑了并报告了问题」。
 *
 * 二者都会让 success=false，但语义完全不同：前者是检查缺失（应标记 skipped，
 * 让门控判为「未真正执行」），后者是检查结果（应如实计入评分）。若不区分，
 * 要么把成功的检查说成没跑，要么把没跑说成通过。
 */
function couldNotStart(e) {
  const status = e && e.status;
  // 126/127 = shell 找不到或无法执行命令；9009 = Windows cmd 的「不是内部或外部命令」
  if (status === 126 || status === 127 || status === 9009) return true;

  const text = [e && e.message, e && e.stderr, e && e.stdout].filter(Boolean).join('\n');
  return /ENOENT|not recognized as an internal|command not found|Unable to access jarfile|No such file or directory/i.test(text);
}

function skippedResult(runner, e, startTime, hint) {
  const detail = String((e && (e.stderr || e.message)) || '').trim().split('\n')[0].slice(0, 120);
  return {
    runner,
    success: false,
    skipped: true,
    error: `${hint}${detail ? '：' + detail : ''}`,
    issueCount: 0,
    errorCount: 0,
    warningCount: 0,
    issues: [],
    duration: Date.now() - startTime
  };
}

function runCheckstyle(projectRoot, incremental) {
  const configPath = path.join(CONFIG_ROOT, 'checkstyle.xml');
  if (!fs.existsSync(configPath)) {
    return { runner: 'checkstyle', success: false, skipped: true, error: '配置文件不存在', duration: 0 };
  }

  let cmd = 'java -jar checkstyle-' + getVersion('checkstyle') + '-all.jar -c "' + configPath + '"';
  if (incremental) cmd += ' -r "$(git diff --name-only --diff-filter=ACMR | grep .java$)"';

  const start = Date.now();
  try {
    const output = execSync(cmd, { cwd: projectRoot, encoding: 'utf-8', timeout: 60000 });
    return parseLinterOutput('checkstyle', output, start);
  } catch (e) {
    if (couldNotStart(e)) return skippedResult('checkstyle', e, start, '检查工具未就绪（需自带 checkstyle jar 且 java 可用）');
    return parseLinterOutput('checkstyle', e.stdout || e.stderr || '', start, e.status !== 0);
  }
}

function runPMD(projectRoot, incremental) {
  const configPath = path.join(CONFIG_ROOT, 'pmd.xml');
  if (!fs.existsSync(configPath)) {
    return { runner: 'pmd', success: false, skipped: true, error: '配置文件不存在', duration: 0 };
  }

  const start = Date.now();
  try {
    const output = execSync(
      `run.sh pmd -d . -rulesets "${configPath}" -f json -language java`,
      { cwd: projectRoot, encoding: 'utf-8', timeout: 120000 }
    );
    return parseLinterOutput('pmd', output, start);
  } catch (e) {
    if (couldNotStart(e)) return skippedResult('pmd', e, start, '检查工具未就绪（需 pmd 的 run.sh 在 PATH 中）');
    return parseLinterOutput('pmd', e.stdout || '', start, e.status !== 0);
  }
}

function runESLint(projectRoot, incremental) {
  const configPath = path.join(CONFIG_ROOT, 'eslint.config.js');

  let cmd = `npx eslint --config "${configPath}" "**/*.{js,jsx,vue,ts,tsx}"`;
  if (incremental) cmd += ' $(git diff --name-only --diff-filter=ACMR | grep -E "\\.(js|jsx|vue|ts|tsx)$")';

  const start = Date.now();
  try {
    const output = execSync(cmd, { cwd: projectRoot, encoding: 'utf-8', timeout: 60000 });
    return parseLinterOutput('eslint', output, start);
  } catch (e) {
    if (couldNotStart(e)) return skippedResult('eslint', e, start, '检查工具未就绪（需可用的 npx/eslint）');
    return parseLinterOutput('eslint', e.stdout || '', start, e.status !== 0);
  }
}

function runRuff(projectRoot, incremental) {
  const configPath = path.join(CONFIG_ROOT, 'ruff.toml');

  let cmd = `ruff check --config "${configPath}" .`;
  if (incremental) cmd += ' $(git diff --name-only --diff-filter=ACMR | grep "\\.py$")';

  const start = Date.now();
  try {
    const output = execSync(cmd, { cwd: projectRoot, encoding: 'utf-8', timeout: 60000 });
    return parseLinterOutput('ruff', output, start);
  } catch (e) {
    if (couldNotStart(e)) return skippedResult('ruff', e, start, '检查工具未就绪（需 ruff 在 PATH 中）');
    return parseLinterOutput('ruff', e.stdout || '', start, e.status !== 0);
  }
}

async function runPRDLinter(projectRoot, linterOptions) {
  const { runPRDChecks } = await import('./prd-linter.js');
  return runPRDChecks(projectRoot, linterOptions);
}

async function runSQLLinter(projectRoot) {
  const { runSQLChecks } = await import('./sql-linter.js');
  return runSQLChecks(projectRoot);
}

async function runActivitiLinter(projectRoot) {
  const { runActivitiChecks } = await import('./activiti-linter.js');
  return runActivitiChecks(projectRoot);
}

function parseLinterOutput(runner, rawOutput, startTime, hasErrors = false) {
  const issues = [];
  const lines = rawOutput.split('\n').filter(l => l.trim());

  for (const line of lines) {
    if (line.includes('[ERROR]') || line.includes('[WARN]')) {
      issues.push({
        severity: line.includes('[ERROR]') ? 'error' : 'warning',
        message: line.replace(/^\[.*?\]\s*/, '').trim()
      });
    }
  }

  return {
    runner,
    success: !hasErrors && issues.filter(i => i.severity === 'error').length === 0,
    issueCount: issues.length,
    errorCount: issues.filter(i => i.severity === 'error').length,
    warningCount: issues.filter(i => i.severity === 'warning').length,
    issues: issues.slice(0, 50),
    duration: Date.now() - startTime
  };
}

function printResult(result, format) {
  if (format === 'json') return;

  const icon = result.success ? chalk.green('✓') : chalk.red('✗');
  const timeStr = `${result.duration}ms`;

  console.log(`  ${icon} ${chalk.white(result.runner)} (${timeStr})`);

  if (result.issueCount > 0) {
    console.log(`     ${chalk.yellow(`${result.errorCount} errors, ${result.warningCount} warnings`)}`);

    for (const issue of (result.issues || []).slice(0, 20)) {
      const color = issue.severity === 'error' ? chalk.red : issue.severity === 'warn' ? chalk.yellow : chalk.gray;
      const severityIcon = issue.severity === 'error' ? 'ERR' : issue.severity === 'warn' ? 'WRN' : 'INF';

      let line = `     ${color(`[${severityIcon}]`)} ${issue.ruleName || issue.ruleId || ''}`;

      if (issue.file) {
        line += chalk.gray(`  ${issue.file}`);
      }
      if (issue.line && issue.line > 0) {
        line += chalk.cyan(`:${issue.line}`);
      }

      console.log(line);

      if (issue.context) {
        console.log(chalk.dim(`         >> ${issue.context}`));
      }

      console.log(chalk.dim(`         ${issue.message}`));
    }

    if (result.issueCount > 20) {
      console.log(`     ... ${result.issueCount - 20} more issues`);
    }
  } else {
    console.log(chalk.gray('     无问题发现'));
  }
}

/**
 * 评分卡标题所用的检查对象名。原先无论检查什么都固定印「PRD质量评分卡」，
 * 跑 `-t sql` / `-t code` 时会误导阅读者。
 */
function scorecardLabel(types = []) {
  const LABELS = { prd: 'PRD 质量', sql: 'SQL 质量', activiti: 'BPMN 质量', code: '代码质量' };
  if (types.length === 1) return LABELS[types[0]] || '质量';
  return '综合质量';
}

async function generateSummary(results, startTime, format, types = []) {
  const totalDuration = Date.now() - startTime;
  const totalErrors = results.reduce((s, r) => s + (r.errorCount || 0), 0);
  const totalWarnings = results.reduce((s, r) => s + (r.warningCount || 0), 0);
  const allPassed = results.every(r => r.success);

  const gateEngine = new GateEngine({ strict: false });
  const gateResult = gateEngine.evaluate(results);

  if (format === 'json') {
    console.log(JSON.stringify({ summary: { totalErrors, totalWarnings, allPassed, duration: totalDuration, gateResult }, results }, null, 2));
    return;
  }

  console.log(chalk.bold('\n━━━ 检查摘要 ━━━'));
  console.log(allPassed ? chalk.green('  ✅ 所有检查通过') : chalk.red(`  ❌ 发现 ${totalErrors} 个错误`));
  console.log(chalk.gray(`  ⏱ 总耗时: ${totalDuration}ms`));

  // 「不适用」与「通过」不是一回事：项目里根本没有可检查对象时要点明，
  // 否则 100/100 ✅ 很容易被读成「检查过且干净」。
  const notApplicable = results.filter(r => r.applicable === false);
  if (notApplicable.length > 0) {
    console.log(chalk.gray(`  ℹ 不适用: ${notApplicable.map(r => r.runner).join(', ')}（无可检查对象，未计入判定）`));
  }

  // 未执行的检查项单独列出：存在 Blocker 时门控只报 Blocker，
  // 若不在此处点明，「有检查没跑」这件事会被完全掩盖。
  const notExecuted = results.filter(r => r.skipped === true);
  if (notExecuted.length > 0) {
    console.log(chalk.yellow(`  ⚠️ 未执行: ${notExecuted.map(r => `${r.runner}${r.error ? `（${r.error}）` : ''}`).join('；')}`));
  }

  // 「被豁免」同样是「有命中被拦下」，必须显式计数。
  // 若只把它当成没发生过，豁免白名单就会变成静默少报的出口 ——
  // 与「路径打错得 100/100 ✅」属于同一类假绿灯。
  const totalSuppressed = results.reduce((s, r) => s + ((r.suppressions && r.suppressions.length) || 0), 0);
  if (totalSuppressed > 0) {
    const byRunner = results
      .filter(r => r.suppressions && r.suppressions.length > 0)
      .map(r => `${r.runner} ${r.suppressions.length} 处`);
    console.log(chalk.gray(`  ℹ 已豁免: ${byRunner.join('，')}（命中规则豁免白名单，未计入问题，明细见报告）`));
  }

  // 规则配置本身有问题时（正则写错等）单独提示，否则「规则没跑」会被读成「规则通过」
  const configWarnings = [...new Set(results.flatMap(r => r.configWarnings || []))];
  if (configWarnings.length > 0) {
    console.log(chalk.yellow(`  ⚠️ 规则配置告警: ${configWarnings.length} 条（规则未完整执行，见报告）`));
  }

  if (gateResult) {
    console.log(gateEngine.generateScorecard(gateResult, scorecardLabel(types)));
    console.log(gateResult.message);
  }

  const reportDir = path.join(await findProjectRoot(process.cwd()), '.pdd', 'cache', 'reports');
  await fs.ensureDir(reportDir);
  const reportPath = path.join(reportDir, `linter-report-${Date.now()}.md`);
  await generateMarkdownReport(reportPath, results, totalErrors, totalWarnings, totalDuration);
  console.log(chalk.gray(`  📄 报告已保存: ${reportPath}`));
}

async function generateMarkdownReport(reportPath, results, errors, warnings, duration) {
  const lines = [
    '# PDD Linter 报告',
    '',
    `- 生成时间: ${new Date().toISOString()}`,
    `- 总错误数: ${errors}`,
    `- 总警告数: ${warnings}`,
    `- 耗时: ${duration}ms`,
    ''
  ];

  for (const r of results) {
    lines.push(`## ${r.runner}`, '');
    if (r.issues && r.issues.length > 0) {
      for (const issue of r.issues) {
        const severity = (issue.severity || 'info').toUpperCase();
        let issueLine = `- [${severity}] ${issue.ruleName || issue.ruleId || 'unknown'}`;
        if (issue.file) issueLine += `  (${issue.file}`;
        if (issue.line && issue.line > 0) issueLine += `:${issue.line}`;
        if (issue.file) issueLine += `)`;
        lines.push(issueLine);
        if (issue.context) lines.push(`  > ${issue.context}`);
        lines.push(`  ${issue.message}`);
      }
    } else {
      lines.push('- No issues');
    }
    lines.push('');
  }

  // 豁免明细与配置告警落到报告里备查。
  // 只打印在终端的话，归档的报告会显示「0 问题」，读报告的人无从知道
  // 有几处命中是被白名单主动拦下的。
  const suppressions = results.flatMap(r => (r.suppressions || []).map(s => ({ ...s, runner: r.runner })));
  if (suppressions.length > 0) {
    lines.push('## 已豁免命中 / Suppressed by exclude_patterns', '');
    lines.push(`共 ${suppressions.length} 处命中被规则豁免白名单挡下，未计入问题数：`, '');
    for (const s of suppressions) {
      lines.push(`- ${s.ruleId}  (${s.file}:${s.line})  命中「${s.matchedText}」，被 /${s.excludedBy}/ 豁免`);
      if (s.context) lines.push(`  > ${s.context}`);
    }
    lines.push('');
  }

  const configWarnings = [...new Set(results.flatMap(r => r.configWarnings || []))];
  if (configWarnings.length > 0) {
    lines.push('## 规则配置告警 / Rule Config Warnings', '');
    lines.push('以下规则因自身配置问题未能完整执行，其「通过」结论不可信：', '');
    for (const w of configWarnings) lines.push(`- ${w}`);
    lines.push('');
  }

  await fs.writeFile(reportPath, lines.join('\n'), 'utf-8');
}

function getVersion(tool) {
  const versions = { checkstyle: '10.12.0', pmd: '6.55.0' };
  return versions[tool] || 'latest';
}
