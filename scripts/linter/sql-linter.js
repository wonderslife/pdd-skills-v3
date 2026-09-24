import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', '..', 'config', 'sqlfluff.cfg');

export async function runSQLChecks(projectRoot) {
  const start = Date.now();

  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      runner: 'sql-linter',
      success: false,
      error: 'SQLFluff配置文件不存在',
      duration: Date.now() - start
    };
  }

  const sqlFiles = findSQLFiles(projectRoot);

  if (sqlFiles.length === 0) {
    return {
      runner: 'sql-linter',
      success: true,
      issueCount: 0,
      errorCount: 0,
      warningCount: 0,
      issues: [],
      message: '未找到SQL文件',
      duration: Date.now() - start
    };
  }

  try {
    const fileList = sqlFiles.map(f => `"${f}"`).join(' ');
    const cmd = `sqlfluff lint --config "${CONFIG_PATH}" ${fileList} --format json`;
    const output = execSync(cmd, { cwd: projectRoot, encoding: 'utf-8', timeout: 120000 });

    return parseSQLFluffOutput(output, start, sqlFiles.length);
  } catch (e) {
    const stdout = e.stdout || '';
    const stderr = e.stderr || '';

    if (stdout.startsWith('{') || stdout.startsWith('[')) {
      return parseSQLFluffOutput(stdout, start, sqlFiles.length);
    }

    const fallbackOutput = runFallbackChecks(sqlFiles, projectRoot);
    return {
      runner: 'sql-linter',
      success: fallbackOutput.errors === 0,
      issueCount: fallbackOutput.warnings + fallbackOutput.errors,
      errorCount: fallbackOutput.errors,
      warningCount: fallbackOutput.warnings,
      issues: fallbackOutput.issues,
      filesChecked: sqlFiles.length,
      duration: Date.now() - start
    };
  }
}

function findSQLFiles(root) {
  const exts = ['.sql', '.hql', '.q'];
  const found = [];

  for (const ext of exts) {
    try {
      const files = fs.globSync(`**/*${ext}`, {
        cwd: root,
        ignore: ['**/node_modules/**', '**/.git/**', '**/.pdd/**', '**/vendor/**', '**/migrations/__pycache__/**']
      });
      for (const f of files) found.push(path.join(root, f));
    } catch {}
  }

  return [...new Set(found)];
}

function parseSQLFluffOutput(rawOutput, startTime, fileCount) {
  try {
    const data = JSON.parse(rawOutput);
    const violations = Array.isArray(data) ? data : (data.violations || []);
    const issues = violations.map(v => ({
      ruleId: v.rule || v.code || 'unknown',
      severity: v.level === 'VIOLATION' ? 'error' : 'warn',
      message: v.description || v.message || '',
      file: v.path || v.file_path || '',
      line: v.line_no || v.line || 0,
      col: v.line_pos || v.col || 0
    }));

    return {
      runner: 'sql-linter',
      success: issues.filter(i => i.severity === 'error').length === 0,
      issueCount: issues.length,
      errorCount: issues.filter(i => i.severity === 'error').length,
      warningCount: issues.filter(i => i.severity === 'warn').length,
      issues: issues.slice(0, 100),
      filesChecked: fileCount,
      duration: Date.now() - startTime
    };
  } catch {
    return {
      runner: 'sql-linter',
      success: false,
      error: '无法解析SQLFluff输出',
      duration: Date.now() - startTime
    };
  }
}

function runFallbackChecks(sqlFiles, root) {
  const issues = [];
  let errors = 0;
  let warnings = 0;

  const dangerousPatterns = [
    { pattern: /\bSELECT\s+\*\s+FROM/i, severity: 'warn', rule: 'no-select-star', message: '避免使用 SELECT *，明确指定所需列' },
    { pattern: /\bDROP\s+(TABLE|DATABASE)\b/i, severity: 'error', rule: 'dangerous-drop', message: '检测到危险操作 DROP，请确认是否必要' },
    { pattern: /\bDELETE\s+FROM\b(?!\s+WHERE)/i, severity: 'error', rule: 'delete-without-where', message: 'DELETE语句缺少WHERE条件' },
    { pattern: /\bUPDATE\b.*\bSET\b(?!(.*WHERE|\s*$))/is, severity: 'error', rule: 'update-without-where', message: 'UPDATE语句缺少WHERE条件' },
    { pattern: /--\s*TODO|FIXME|HACK|XXX/i, severity: 'info', rule: 'todo-comments', message: 'SQL中存在待办注释' },
    { pattern: /\bINSERT\s+INTO\b.*VALUES\s*\([^)]*\)\s*;\s*$/im, severity: 'warn', rule: 'explicit-columns', message: 'INSERT语句建议显式指定列名' },
    { pattern: /\b(?:UNION\s+ALL)\b/i, severity: 'info', rule: 'union-all-check', message: '使用 UNION ALL 时确认是否需要去重' },
    { pattern: /;\s*$/m, severity: 'info', rule: 'trailing-semicolon', message: '建议每条SQL语句以分号结尾' }
  ];

  for (const filePath of sqlFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      for (const check of dangerousPatterns) {
        if (check.pattern.test(line)) {
          if (check.severity === 'error') errors++;
          else if (check.severity === 'warn') warnings++;

          issues.push({
            ruleId: check.rule,
            severity: check.severity,
            message: check.message,
            file: filePath,
            line: idx + 1
          });
        }
      }
    }

    if (content.length > 5000) {
      warnings++;
      issues.push({
        ruleId: 'long-file',
        severity: 'warn',
        message: `SQL文件过大(${Math.round(content.length / 1024)}KB)，建议拆分`,
        file: filePath,
        line: 0
      });
    }
  }

  return { errors, warnings, issues: issues.slice(0, 100) };
}
