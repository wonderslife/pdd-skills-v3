import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { log, findProjectRoot, loadConfig } from '../../lib/utils/logger.js';

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
  
  // Handle file parameter - can be string or array, convert to array for linterOptions
  let fileOptions = null;
  if (options.file) {
    fileOptions = Array.isArray(options.file) ? options.file : [options.file];
  }
  const linterOptions = {
    files: fileOptions,
    includeAll: options.includeAll || false
  };

  console.log(chalk.blue.bold('\n🔍 PDD Linter - 代码与文档质量检查\n'));

  const projectRoot = await findProjectRoot(process.cwd());
  log('info', `项目根目录: ${projectRoot}`);
  const config = await loadConfig(projectRoot);

  if (!config.linter.enabled) {
    console.log(chalk.yellow('⚠️  Linter未启用，请检查 .pdd/config.yaml'));
    return;
  }

  const results = [];

  for (const type of types) {
    const linterDef = LINTER_REGISTRY[type];
    if (!linterDef) {
      log('warn', `未知Linter类型: ${type}, 跳过`);
      continue;
    }

    console.log(chalk.cyan(`\n━━━ ${linterDef.name} ━━━`));
    console.log(chalk.gray(`  ${linterDef.description}\n`));

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

  await generateSummary(results, startTime, outputFormat);

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

function runCheckstyle(projectRoot, incremental) {
  const configPath = path.join(CONFIG_ROOT, 'checkstyle.xml');
  if (!fs.existsSync(configPath)) {
    return { runner: 'checkstyle', success: false, error: '配置文件不存在', duration: 0 };
  }

  let cmd = 'java -jar checkstyle-' + getVersion('checkstyle') + '-all.jar -c "' + configPath + '"';
  if (incremental) cmd += ' -r "$(git diff --name-only --diff-filter=ACMR | grep .java$)"';

  try {
    const output = execSync(cmd, { cwd: projectRoot, encoding: 'utf-8', timeout: 60000 });
    return parseLinterOutput('checkstyle', output, Date.now());
  } catch (e) {
    return parseLinterOutput('checkstyle', e.stdout || e.stderr || '', Date.now(), e.status !== 0);
  }
}

function runPMD(projectRoot, incremental) {
  const configPath = path.join(CONFIG_ROOT, 'pmd.xml');
  if (!fs.existsSync(configPath)) {
    return { runner: 'pmd', success: false, error: '配置文件不存在', duration: 0 };
  }

  try {
    const output = execSync(
      `run.sh pmd -d . -rulesets "${configPath}" -f json -language java`,
      { cwd: projectRoot, encoding: 'utf-8', timeout: 120000 }
    );
    return parseLinterOutput('pmd', output, Date.now());
  } catch (e) {
    return parseLinterOutput('pmd', e.stdout || '', Date.now(), e.status !== 0);
  }
}

function runESLint(projectRoot, incremental) {
  const configPath = path.join(CONFIG_ROOT, 'eslint.config.js');

  let cmd = `npx eslint --config "${configPath}" "**/*.{js,jsx,vue,ts,tsx}"`;
  if (incremental) cmd += ' $(git diff --name-only --diff-filter=ACMR | grep -E "\\.(js|jsx|vue|ts|tsx)$")';

  try {
    const output = execSync(cmd, { cwd: projectRoot, encoding: 'utf-8', timeout: 60000 });
    return parseLinterOutput('eslint', output, Date.now());
  } catch (e) {
    return parseLinterOutput('eslint', e.stdout || '', Date.now(), e.status !== 0);
  }
}

function runRuff(projectRoot, incremental) {
  const configPath = path.join(CONFIG_ROOT, 'ruff.toml');

  let cmd = `ruff check --config "${configPath}" .`;
  if (incremental) cmd += ' $(git diff --name-only --diff-filter=ACMR | grep "\\.py$")';

  try {
    const output = execSync(cmd, { cwd: projectRoot, encoding: 'utf-8', timeout: 60000 });
    return parseLinterOutput('ruff', output, Date.now());
  } catch (e) {
    return parseLinterOutput('ruff', e.stdout || '', Date.now(), e.status !== 0);
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

async function generateSummary(results, startTime, format) {
  const totalDuration = Date.now() - startTime;
  const totalErrors = results.reduce((s, r) => s + (r.errorCount || 0), 0);
  const totalWarnings = results.reduce((s, r) => s + (r.warningCount || 0), 0);
  const allPassed = results.every(r => r.success);

  if (format === 'json') {
    console.log(JSON.stringify({ summary: { totalErrors, totalWarnings, allPassed, duration: totalDuration }, results }, null, 2));
    return;
  }

  console.log(chalk.bold('\n━━━ 检查摘要 ━━━'));
  console.log(allPassed ? chalk.green('  ✅ 所有检查通过') : chalk.red(`  ❌ 发现 ${totalErrors} 个错误`));
  console.log(chalk.gray(`  ⏱ 总耗时: ${totalDuration}ms`));

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

  await fs.writeFile(reportPath, lines.join('\n'), 'utf-8');
}

function getVersion(tool) {
  const versions = { checkstyle: '10.12.0', pmd: '6.55.0' };
  return versions[tool] || 'latest';
}
