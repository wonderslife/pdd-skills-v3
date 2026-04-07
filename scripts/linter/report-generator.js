import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

export class ReportGenerator {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.reportDir = path.join(projectRoot, '.pdd', 'cache', 'reports');
  }

  async generate(linterResults = [], options = {}) {
    await fs.ensureDir(this.reportDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const format = options.format || 'markdown';

    switch (format) {
      case 'json':
        return await this.generateJSONReport(linterResults, timestamp);
      case 'html':
        return await this.generateHTMLReport(linterResults, timestamp);
      case 'markdown':
      default:
        return await this.generateMarkdownReport(linterResults, timestamp);
    }
  }

  async generateMarkdownReport(results, timestamp) {
    const summary = this.buildSummary(results);
    const lines = [
      '# PDD Linter 检查报告',
      '',
      `> 生成时间: ${new Date().toLocaleString('zh-CN')}`,
      `> 项目: ${path.basename(this.projectRoot)}`,
      '',
      '## 执行摘要',
      '',
      `| 指标 | 数值 |`,
      `|------|------|`,
      `| 总检查项 | ${summary.totalRunners} |`,
      `| 通过 | ${chalk.green(summary.passed.toString())} |`,
      `| 失败 | ${chalk.red(summary.failed.toString())} |`,
      `| 总问题数 | ${summary.totalIssues} |`,
      `| 错误 | ${chalk.red(summary.totalErrors.toString())} |`,
      `| 警告 | ${chalk.yellow(summary.totalWarnings.toString())} |`,
      `| 总耗时 | ${summary.totalDuration}ms |`,
      ''
    ];

    if (summary.failed > 0) {
      lines.push('> ⚠️ **存在未通过检查项，请查看详情**', '');
    } else {
      lines.push('> ✅ **所有检查通过**', '');
    }

    lines.push('## 详细结果', '');

    for (const result of results) {
      lines.push(`### ${result.runner}`, '');
      lines.push(`- 状态: ${result.success ? '✅ 通过' : '❌ 失败'}`);
      lines.push(`- 耗时: ${result.duration || 0}ms`);

      if (result.issueCount !== undefined) {
        lines.push(`- 问题数: ${result.issueCount} (${result.errorCount || 0} 错误, ${result.warningCount || 0} 警告)`);
      }

      if (result.filesChecked) {
        lines.push(`- 检查文件数: ${result.filesChecked}`);
      }

      if (result.message && result.issueCount === 0) {
        lines.push(`- 备注: ${result.message}`);
      }

      if (result.issues && result.issues.length > 0) {
        lines.push('', '**问题列表:**', '');
        lines.push('| 严重度 | 规则 | 描述 | 文件 | 行号 |');
        lines.push('|--------|------|------|------|------|');

        for (const issue of result.issues.slice(0, 50)) {
          const sevIcon = issue.severity === 'error' ? '🔴' : issue.severity === 'warn' ? '🟡' : '🔵';
          const file = issue.file ? path.basename(issue.file) : '-';
          lines.push(`${sevIcon} | ${issue.ruleId || '-'} | ${issue.message || '-'} | ${file} | ${issue.line || '-'}`);
        }
      }

      lines.push('');
    }

    lines.push('---', '', `_由 PDD-Skills v1.0 自动生成_`);

    const reportPath = path.join(this.reportDir, `linter-${timestamp}.md`);
    await fs.writeFile(reportPath, lines.join('\n'), 'utf-8');
    console.log(chalk.gray(`  📄 Markdown报告: ${reportPath}`));

    return { path: reportPath, format: 'markdown', summary };
  }

  async generateJSONReport(results, timestamp) {
    const summary = this.buildSummary(results);
    const report = {
      generated_at: new Date().toISOString(),
      project: path.basename(this.projectRoot),
      version: '1.0.0',
      summary,
      results
    };

    const reportPath = path.join(this.reportDir, `linter-${timestamp}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(chalk.gray(`  📄 JSON报告: ${reportPath}`));

    return { path: reportPath, format: 'json', summary };
  }

  async generateHTMLReport(results, timestamp) {
    const summary = this.buildSummary(results);
    const issuesHtml = results.flatMap(r => (r.issues || []).map(i => ({
      ...i,
      runner: r.runner
    })));

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PDD Linter 报告 - ${path.basename(this.projectRoot)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;color:#333;padding:20px}
.header{background:#fff;border-radius:8px;padding:24px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.header h1{font-size:24px;color:#1a73e8;margin-bottom:8px}
.meta{color:#666;font-size:14px}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:20px}
.card{background:#fff;border-radius:8px;padding:20px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.card .value{font-size:32px;font-weight:bold}
.card .label{color:#666;font-size:14px;margin-top:4px}
.pass .value{color:#34a853}.fail .value{color:#ea4335}.warn .value{#f9ab00}
.section{background:#fff;border-radius:8px;padding:24px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.section h2{font-size:18px;margin-bottom:16px;color:#333;border-bottom:1px solid #eee;padding-bottom:8px}
table{width:100%;border-collapse:collapse}
th{text-align:left;background:#f8f9fa;padding:10px;font-weight:600;font-size:13px;color:#555}
td{padding:10px;border-bottom:1px solid #eee;font-size:13px}
tr:hover{background:#f8f9fa}
.severity-error{color:#ea4335;font-weight:600}.severity-warn{color:#f9ab00}.severity-info{color:#4285f4}
</style>
</head>
<body>
<div class="header">
<h1>🔍 PDD Linter 检查报告</h1>
<div class="meta">项目: ${path.basename(this.projectRoot)} | 生成时间: ${new Date().toLocaleString('zh-CN')}</div>
</div>
<div class="summary">
<div class="card ${summary.failed === 0 ? 'pass' : 'fail'}"><div class="value">${summary.totalRunners}</div><div class="label">总检查项</div></div>
<div class="card pass"><div class="value">${summary.passed}</div><div class="label">通过</div></div>
<div class="card fail"><div class="value">${summary.failed}</div><div class="label">失败</div></div>
<div class="card warn"><div class="value">${summary.totalIssues}</div><div class="label">总问题</div></div>
<div class="card"><div class="value">${summary.totalDuration}ms</div><div class="label">耗时</div></div>
</div>
${results.map(r => `
<div class="section">
<h2>${r.success ? '✅' : '❌'} ${r.runner}</h2>
<table>
<tr><th>指标</th><th>数值</th></tr>
<tr><td>状态</td><td>${r.success ? '通过' : '失败'}</td></tr>
<tr><td>耗时</td><td>${r.duration || 0}ms</td></tr>
<tr><td>错误</td><td>${r.errorCount || 0}</td></tr>
<tr><td>警告</td><td>${r.warningCount || 0}</td></tr>
${r.filesChecked ? `<tr><td>文件数</td><td>${r.filesChecked}</td></tr>` : ''}
</table>
${(r.issues || []).length > 0 ? `
<table style="margin-top:12px">
<tr><th>严重度</th><th>规则</th><th>描述</th><th>文件</th><th>行号</th></tr>
${r.issues.slice(0, 30).map(i => `
<tr><td class="severity-${i.severity}">${i.severity.toUpperCase()}</td><td>${i.ruleId || '-'}</td><td>${(i.message || '').replace(/</g,'&lt;')}</td><td>${i.file ? path.basename(i.file) : '-'}</td><td>${i.line || '-'}</td></tr>`).join('')}
</table>` : ''}
</div>`).join('')}
</body>
</html>`;

    const reportPath = path.join(this.reportDir, `linter-${timestamp}.html`);
    await fs.writeFile(reportPath, html, 'utf-8');
    console.log(chalk.gray(`  📄 HTML报告: ${reportPath}`));

    return { path: reportPath, format: 'html', summary };
  }

  buildSummary(results) {
    let totalRunners = results.length;
    let passed = results.filter(r => r.success).length;
    let failed = totalRunners - passed;
    let totalIssues = 0;
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalDuration = 0;

    for (const r of results) {
      totalIssues += r.issueCount || 0;
      totalErrors += r.errorCount || 0;
      totalWarnings += r.warningCount || 0;
      totalDuration += r.duration || 0;
    }

    return { totalRunners, passed, failed, totalIssues, totalErrors, totalWarnings, totalDuration };
  }
}
