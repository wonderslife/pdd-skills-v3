/**
 * Custom Linter 自定义代码检查插件
 *
 * 在 pre-verify 钩子阶段执行自定义规则检查：
 * - 禁止使用 console.log（生产环境泄露风险）
 * - 禁止使用 var 声明（应使用 const/let）
 * - 禁止使用 == 比较（应使用 ===）
 * - 检测函数长度是否超过阈值
 * - 检测文件行数是否超过阈值
 *
 * 同时注册自定义格式化器，支持多种输出格式。
 *
 * @module custom-linter
 * @author PDD Team
 * @version 1.0.0
 */

import { PluginBase } from '../plugin-sdk.js';

// ==================== 规则严重级别 ====================

/** @enum {string} 规则违反的严重级别 */
const Severity = {
  ERROR: 'error',   // 阻断性错误，必须修复
  WARN: 'warn',     // 警告，建议修复
  INFO: 'info',     // 信息提示，可选修复
};

// ==================== 内置规则定义 ====================

/**
 * 预定义的 Lint 规则集合
 * 每条规则包含：id, name, description, severity, check 函数
 */
const BUILTIN_RULES = {
  'no-console-log': {
    id: 'no-console-log',
    name: '禁止 console.log',
    description: '检测并阻止 console.log 调用，避免敏感信息泄露到生产环境',
    severity: Severity.WARN,
    /** @param {string} content */
    check(content) {
      const issues = [];
      const lines = content.split('\n');
      // 匹配 console.log / console.warn / console.error (排除注释中的)
      const regex = /^\s*(?!.*\/\/.*)console\.(log|warn|info|debug)\(/gm;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        issues.push({
          line: lineNum,
          column: match[0].indexOf('console') + 1,
          message: `不应使用 ${match[1]} 输出到控制台`,
          ruleId: this.id,
          severity: this.severity,
        });
      }
      return issues;
    },
  },

  'no-var-declaration': {
    id: 'no-var-declaration',
    name: '禁止 var 声明',
    description: '使用 var 声明变量存在作用域问题，应使用 const 或 let 替代',
    severity: Severity.ERROR,
    /** @param {string} content */
    check(content) {
      const issues = [];
      const lines = content.split('\n');
      // 匹配 var 声明（排除注释和字符串）
      const regex = /^(?!\s*\/\/).*\bvar\s+\w+\s*[=;]/gm;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        issues.push({
          line: lineNum,
          column: match[0].indexOf('var') + 1,
          message: '不应使用 var，请改用 const 或 let',
          ruleId: this.id,
          severity: this.severity,
        });
      }
      return issues;
    },
  },

  'no-equals-equals': {
    id: 'no-equals-equals',
    name: '禁止 == 比较',
    description: '== 存在类型隐式转换问题，应使用 === 进行严格比较',
    severity: Severity.ERROR,
    /** @param {string} content */
    check(content) {
      const issues = [];
      const lines = content.split('\n');
      // 排除 !== 和 ===
      const regex = /(?<!=)=(?!=)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        // 确保不是 !== 或 === 的一部分
        const before = content[match.index - 1] || '';
        const after = content[match.index + 2] || '';
        if (before !== '=' && after !== '=') {
          const lineNum = content.substring(0, match.index).split('\n').length;
          issues.push({
            line: lineNum,
            column: match.index - content.lastIndexOf('\n', match.index),
            message: '应使用 === 代替 == 进行严格比较',
            ruleId: this.id,
            severity: this.severity,
          });
        }
      }
      return issues;
    },
  },

  'max-lines-per-function': {
    id: 'max-lines-per-function',
    name: '函数最大行数限制',
    description: '单个函数过长会增加理解和维护难度，建议拆分为更小的函数',
    severity: Severity.WARN,
    options: { maxLines: 50 },
    /** @param {string} content */
    check(content) {
      const issues = [];
      const maxLines = this.options?.maxLines || 50;

      // 简单检测：通过花括号匹配估算函数体长度
      const funcRegex = /(function\s+\w+|=>\s*\{|\w+\s*\([^)]*\)\s*\{)/g;
      let match;
      while ((match = funcRegex.exec(content)) !== null) {
        const startLine = content.substring(0, match.index).split('\n').length;

        // 找匹配的闭合括号
        let braceCount = 0;
        let endPos = match.index;
        let inFunc = false;

        for (let i = match.index; i < content.length; i++) {
          if (content[i] === '{') {
            braceCount++;
            inFunc = true;
          } else if (content[i] === '}') {
            braceCount--;
            if (inFunc && braceCount === 0) {
              endPos = i;
              break;
            }
          }
        }

        const endLine = content.substring(0, endPos).split('\n').length;
        const funcLength = endLine - startLine + 1;

        if (funcLength > maxLines) {
          issues.push({
            line: startLine,
            column: 1,
            message: `函数长度为 ${funcLength} 行，超过限制 (${maxLines} 行)，建议拆分`,
            ruleId: this.id,
            severity: this.severity,
            meta: { actualLength: funcLength, maxLength: maxLines },
          });
        }
      }
      return issues;
    },
  },

  'max-file-length': {
    id: 'max-file-length',
    name: '文件最大行数限制',
    description: '单个文件过长时建议拆分为多个模块',
    severity: Severity.INFO,
    options: { maxLines: 300 },
    /** @param {string} content */
    check(content) {
      const issues = [];
      const lines = content.split('\n');
      const maxLines = this.options?.maxLines || 300;

      if (lines.length > maxLines) {
        issues.push({
          line: 1,
          column: 1,
          message: `文件总行数为 ${lines.length} 行，超过建议值 (${maxLines} 行)，考虑模块化拆分`,
          ruleId: this.id,
          severity: this.severity,
          meta: { actualLength: lines.length, maxLength: maxLines },
        });
      }
      return issues;
    },
  },
};

/**
 * Custom Linter 插件类
 *
 * @class CustomLinterPlugin
 * @extends PluginBase
 */
export default class CustomLinterPlugin extends PluginBase {
  constructor() {
    super({
      name: 'custom-linter',
      version: '1.0.0',
      description: '自定义 Linter 规则扩展 - 在 pre-verify 阶段执行自定义代码检查',
      author: 'PDD Team',
      license: 'MIT',
      keywords: ['linter', 'lint', 'quality', 'rules'],
      pddVersionRange: '>=1.0.0',
    });

    /** @type {Map<string, Object>} 已加载的规则集 */
    this._rules = new Map();

    /** @type {Object} 配置选项 */
    this._options = {
      maxLinesPerFunction: 50,
      maxFileLength: 300,
      enabledRules: ['no-console-log', 'no-var-declaration', 'no-equals-equals'],
    };
  }

  /**
   * 插件激活时调用
   * 注册钩子和格式化器
   *
   * @param {import('../plugin-sdk.js').PluginContext} context - 插件上下文
   */
  async onActivate(context) {
    context.logger.info('Custom Linter 插件正在激活...');

    // 加载内置规则
    for (const [ruleId, rule] of Object.entries(BUILTIN_RULES)) {
      this._rules.set(ruleId, rule);
    }

    // 从配置中读取选项
    const configMaxFunc = context.getConfig('maxLinesPerFunction');
    if (configMaxFunc) this._options.maxLinesPerFunction = configMaxFunc;

    const configFileLen = context.getConfig('maxFileLength');
    if (configFileLen) this._options.maxFileLength = configFileLen;

    const configRules = context.getConfig('enabledRules');
    if (Array.isArray(configRules)) this._options.enabledRules = configRules;

    // 注册 pre-verify 钩子：在验证前执行 Lint 检查
    this.registerHook('pre-verify', async (input) => {
      context.logger.info('[custom-linter] 开始执行 pre-verify Lint 检查...');

      const result = await this.lint(input.content || input.source || '');

      // 如果有 error 级别的问题，返回失败状态
      const hasErrors = result.issues.some(i => i.severity === Severity.ERROR);

      context.logger.info(
        `[custom-linter] 检查完成 - 发现 ${result.issueCounts.error} 个错误, ` +
        `${result.issueCounts.warn} 个警告, ${result.issueCounts.info} 个提示`
      );

      return {
        ...input,
        lintResult: result,
        passed: !hasErrors,
      };
    }, 10); // 高优先级，尽早运行

    // 注册 table 格式化器
    this.registerFormatter('table', (data) => {
      if (!data.lintResult) return JSON.stringify(data, null, 2);
      return this._formatAsTable(data.lintResult);
    });

    // 注册 json 格式化器
    this.registerFormatter('json', (data) => {
      return JSON.stringify(data, null, 2);
    });

    // 注册 markdown 格式化器
    this.registerFormatter('markdown', (data) => {
      if (!data.lintResult) return '```json\n' + JSON.stringify(data, null, 2) + '\n```';
      return this._formatAsMarkdown(data.lintResult);
    });

    context.logger.info(
      `Custom Linter 插件激活成功！已加载 ${this._rules.size} 条规则, ` +
      `启用 ${this._options.enabledRules.length} 条`
    );
  }

  /**
   * 执行 Lint 检查
   * 对输入内容应用所有启用的规则
   *
   * @param {string} content - 待检查的代码内容
   * @returns {Object} 检查结果
   */
  async lint(content) {
    const startTime = Date.now();
    const allIssues = [];

    for (const ruleId of this._options.enabledRules) {
      const rule = this._rules.get(ruleId);
      if (!rule) continue;

      try {
        const issues = rule.check(content);
        allIssues.push(...issues);
      } catch (err) {
        allIssues.push({
          line: 0,
          column: 0,
          message: `规则 "${ruleId}" 执行出错: ${err.message}`,
          ruleId: 'system-error',
          severity: Severity.ERROR,
        });
      }
    }

    // 按行号排序
    allIssues.sort((a, b) => a.line - b.line || a.column - b.column);

    // 统计各级别数量
    const issueCounts = {
      error: allIssues.filter(i => i.severity === Severity.ERROR).length,
      warn: allIssues.filter(i => i.severity === Severity.WARN).length,
      info: allIssues.filter(i => i.severity === Severity.INFO).length,
      total: allIssues.length,
    };

    return {
      pluginName: this.name,
      version: this.version,
      issues: allIssues,
      issueCounts,
      rulesApplied: [...this._options.enabledRules],
      durationMs: Date.now() - startTime,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * 将结果格式化为 ASCII 表格
   * @param {Object} result - Lint 结果
   * @returns {string} 格式化的表格文本
   * @private
   */
  _formatAsTable(result) {
    const header = '  Line │ Col │ Severity │ Rule                  │ Message';
    const separator = '──────┼─────┼──────────┼───────────────────────┼──────────────────────────';
    const lines = [header, separator];

    for (const issue of result.issues) {
      const line = String(issue.line).padEnd(6);
      const col = String(issue.column ?? '-').padStart(3);
      const sev = issue.severity.padEnd(8);
      const rule = (issue.ruleId || '').padEnd(21);
      const msg = issue.message || '';
      lines.push(`  ${line}│ ${col} │ ${sev}│ ${rule}│ ${msg}`);
    }

    lines.push('');
    lines.push(`  Total: ${result.issueCounts.total} issues (` +
      `${result.issueCounts.error} errors, ` +
      `${result.issueCounts.warn} warnings, ` +
      `${result.issueCounts.info} info)`);

    return lines.join('\n');
  }

  /**
   * 将结果格式化为 Markdown 文本
   * @param {Object} result - Lint 结果
   * @returns {string} Markdown 格式文本
   * @private
   */
  _formatAsMarkdown(result) {
    const lines = [
      `# Lint Report - ${result.pluginName} v${result.version}`,
      '',
      '**Summary:**',
      `- Errors: **${result.issueCounts.error}**`,
      `- Warnings: **${result.issueCounts.warn}**`,
      `- Info: **${result.issueCounts.info}**`,
      `- Total: **${result.issueCounts.total}**`,
      `- Duration: **${result.durationMs}ms**`,

      '',
      '| Line | Col | Severity | Rule | Message |',
      '|------|-----|----------|------|---------|',
    ];

    for (const issue of result.issues) {
      lines.push(
        `| ${issue.line} | ${issue.column ?? '-'} | ${issue.severity} | ${issue.ruleId || '-'} | ${issue.message || '-'} |`
      );
    }

    return lines.join('\n');
  }

  /**
   * 动态添加自定义规则
   * 允许用户在运行时扩展规则集
   *
   * @param {Object} rule - 规则定义对象
   * @param {string} rule.id - 规则唯一标识
   * @param {string} rule.name - 规则名称
   * @param {string} rule.description - 规则描述
   * @param {string} rule.severity - 默认严重级别
   * @param {Function} rule.check - 检查函数 (content) => Issue[]
   */
  addRule(rule) {
    if (!rule.id || !rule.check || typeof rule.check !== 'function') {
      throw new Error('无效的规则定义：必须包含 id 和 check 函数');
    }

    this._rules.set(rule.id, {
      id: rule.id,
      name: rule.name || rule.id,
      description: rule.description || '',
      severity: rule.severity || Severity.WARN,
      check: rule.check,
      options: rule.options || {},
    });

    // 自动将新规则加入启用列表
    if (!this._options.enabledRules.includes(rule.id)) {
      this._options.enabledRules.push(rule.id);
    }
  }

  /**
   * 移除指定规则
   * @param {string} ruleId - 规则 ID
   * @returns {boolean} 是否成功移除
   */
  removeRule(ruleId) {
    const removed = this._rules.delete(ruleId);
    if (removed) {
      this._options.enabledRules = this._options.enabledRules.filter(r => r !== ruleId);
    }
    return removed;
  }

  /**
   * 获取所有可用规则列表
   * @returns {Object[]} 规则信息数组
   */
  listRules() {
    return Array.from(this._rules.values()).map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      severity: r.severity,
      enabled: this._options.enabledRules.includes(r.id),
    }));
  }

  /**
   * 插件停用时调用
   * @param {import('../plugin-sdk.js').PluginContext} context - 插件上下文
   */
  async onDeactivate(context) {
    context.logger.info('Custom Linter 插件正在停用...');
  }
}
