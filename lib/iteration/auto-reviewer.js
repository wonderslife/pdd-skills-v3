// lib/iteration/auto-reviewer.js - 自动审查模块
// 集成代码审查逻辑，自动化执行多维度代码质量检测
// 支持静态分析、规范检查、安全扫描、性能评估

import chalk from 'chalk';
import crypto from 'crypto';

/**
 * 问题类别枚举
 */
export const IssueCategory = {
  SYNTAX: 'syntax',           // 语法错误
  LOGIC: 'logic',             // 逻辑错误
  SECURITY: 'security',       // 安全问题
  PERFORMANCE: 'performance', // 性能问题
  STYLE: 'style',             // 代码风格
  SPEC_VIOLATION: 'spec_violation', // 规格违反
  BEST_PRACTICE: 'best_practice'    // 最佳实践
};

/**
 * 问题严重级别（与controller.js保持一致）
 */
export const Severity = {
  CRITICAL: 'critical',   // 阻塞性问题，必须修复
  MAJOR: 'major',         // 重要问题，强烈建议修复
  MINOR: 'minor',         // 次要问题，建议修复
  INFO: 'info'            // 信息性提示
};

/**
 * 单个审查发现的问题
 */
class Issue {
  /**
   * @param {Object} params
   * @param {string} params.id - 唯一标识
   * @param {string} params.category - 问题类别
   * @param {string} params.severity - 严重级别
   * @param {string} params.message - 问题描述
   * @param {number} [params.line] - 所在行号
   * @param {number} [params.column] - 所在列号
   * @param {string} [params.codeSnippet] - 相关代码片段
   * @param {string} [params.rule] - 规则名称
   * @param {string} [params.suggestion] - 修复建议
   * @param {boolean} [params.fixable] - 是否可自动修复
   */
  constructor(params) {
    this.id = params.id || crypto.randomUUID();
    this.category = params.category;
    this.severity = params.severity;
    this.message = params.message;
    this.line = params.line || null;
    this.column = params.column || null;
    this.codeSnippet = params.codeSnippet || null;
    this.rule = params.rule || null;
    this.suggestion = params.suggestion || null;
    this.fixable = params.fixable !== undefined ? params.fixable : true;
    this.timestamp = Date.now();
  }

  toJSON() {
    return {
      id: this.id,
      category: this.category,
      severity: this.severity,
      message: this.message,
      line: this.line,
      column: this.column,
      codeSnippet: this.codeSnippet,
      rule: this.rule,
      suggestion: this.suggestion,
      fixable: this.fixable
    };
  }
}

/**
 * 审查结果
 */
class ReviewResult {
  constructor() {
    this.issues = [];
    this.metrics = {};
    this.codeHash = null;
    this.reviewTime = 0;
    this.passed = false;
  }

  addIssue(issue) {
    this.issues.push(issue);
  }

  setMetrics(metrics) {
    this.metrics = metrics;
  }

  getSummary() {
    const bySeverity = {};
    for (const sev of Object.values(Severity)) {
      bySeverity[sev] = this.issues.filter(i => i.severity === sev).length;
    }
    const byCategory = {};
    for (const cat of Object.values(IssueCategory)) {
      byCategory[cat] = this.issues.filter(i => i.category === cat).length;
    }
    return {
      totalIssues: this.issues.length,
      bySeverity,
      byCategory,
      passed: this.issues.filter(i => i.severity === Severity.CRITICAL).length === 0,
      criticalCount: bySeverity[Severity.CRITICAL] || 0,
      majorCount: bySeverity[Severity.MAJOR] || 0
    };
  }
}

/**
 * AutoReviewer - 自动代码审查器
 *
 * 审查维度:
 *   1. 静态分析 - 语法、结构、复杂度
 *   2. 安全扫描 - 注入、XSS、敏感信息泄露
 *   3. 性能检测 - 循环、内存泄漏风险
 *   4. 规范检查 - 命名、格式、注释
 *   5. 规格验证 - 与开发规格的一致性
 *
 * 设计原则:
 *   - 不执行代码，只做静态分析
 *   - 可配置规则集和阈值
 *   - 输出结构化的问题报告
 *   - 支持增量审查（基于hash）
 */
export class AutoReviewer {
  /**
   * @param {Object} config - 配置选项
   * @param {boolean} config.enableSecurityScan - 启用安全扫描 (默认true)
   * @param {boolean} config.enablePerformanceCheck - 启用性能检查 (默认true)
   * @param {boolean} config.enableStyleCheck - 启用风格检查 (默认true)
   * @param {number} config.maxComplexity - 最大圈复杂度阈值 (默认15)
   * @param {number} config.maxLineLength - 最大行长度 (默认120)
   * @param {number} config.maxFunctionLength - 函数最大行数 (默认50)
   * @param {Array<string>} config.disabledRules - 禁用的规则列表
   * @param {Object} config.customRules - 自定义规则
   */
  constructor(config = {}) {
    this.config = {
      enableSecurityScan: config.enableSecurityScan !== false,
      enablePerformanceCheck: config.enablePerformanceCheck !== false,
      enableStyleCheck: config.enableStyleCheck !== false,
      maxComplexity: config.maxComplexity || 15,
      maxLineLength: config.maxLineLength || 120,
      maxFunctionLength: config.maxFunctionLength || 50,
      disabledRules: new Set(config.disabledRules || []),
      customRules: config.customRules || {}
    };

    // 规则注册表
    this.rules = this._initRules();

    // 统计信息
    this.stats = {
      totalReviews: 0,
      totalIssuesFound: 0,
      avgReviewTime: 0
    };
  }

  /**
   * 执行代码审查
   *
   * @param {string} code - 待审查的代码
   * @param {Object} spec - 开发规格/验收标准 (可选)
   * @returns {Promise<ReviewResult>} 审查结果
   */
  async review(code, spec = {}) {
    const startTime = Date.now();
    const result = new ReviewResult();

    console.log(chalk.blue('  🔍 AutoReviewer 开始审查...'));

    try {
      // 计算代码哈希（用于增量审查）
      result.codeHash = this._computeHash(code);

      // 执行各维度审查
      await this._runAllChecks(code, spec, result);

      // 计算代码指标
      result.setMetrics(this._analyzeMetrics(code));

      // 判断是否通过
      const summary = result.getSummary();
      result.passed = summary.criticalCount === 0;

      // 更新统计
      result.reviewTime = Date.now() - startTime;
      this._updateStats(result);

      console.log(`  ✅ 审查完成: 发现 ${summary.totalIssues} 个问题 (${summary.criticalCount} 严重, ${summary.majorCount} 重要)`);

      return result;

    } catch (error) {
      console.error(chalk.red(`  ❌ 审查过程出错: ${error.message}`));
      result.addIssue(new Issue({
        category: IssueCategory.SYNTAX,
        severity: Severity.CRITICAL,
        message: `审查引擎异常: ${error.message}`,
        fixable: false
      }));
      return result;
    }
  }

  /**
   * 执行所有检查项
   * @private
   */
  async _runAllChecks(code, spec, result) {
    const lines = code.split('\n');

    // 1. 基础语法/结构检查
    this._checkBasicStructure(code, lines, result);

    // 2. 复杂度分析
    this._checkComplexity(code, lines, result);

    // 3. 安全扫描
    if (this.config.enableSecurityScan) {
      this._checkSecurity(code, lines, result);
    }

    // 4. 性能检查
    if (this.config.enablePerformanceCheck) {
      this._checkPerformance(code, lines, result);
    }

    // 5. 代码风格检查
    if (this.config.enableStyleCheck) {
      this._checkStyle(code, lines, result);
    }

    // 6. 规格一致性检查
    if (spec && Object.keys(spec).length > 0) {
      this._checkSpecCompliance(code, spec, result);
    }

    // 7. 自定义规则检查
    this._checkCustomRules(code, lines, result);
  }

  // ==================== 检查规则实现 ====================

  /**
   * 基础结构检查
   * @private
   */
  _checkBasicStructure(code, lines, result) {
    // 检查空文件
    if (!code.trim()) {
      result.addIssue(new Issue({
        category: IssueCategory.SYNTAX,
        severity: Severity.CRITICAL,
        message: '文件为空或仅包含空白字符',
        rule: 'no-empty-file',
        fixable: false
      }));
      return;
    }

    // 检查过长的单行代码
    lines.forEach((line, idx) => {
      if (line.length > this.config.maxLineLength) {
        result.addIssue(new Issue({
          category: IssueCategory.STYLE,
          severity: Severity.MINOR,
          message: `行过长 (${line.length}/${this.config.maxLineLength}字符)`,
          line: idx + 1,
          column: this.config.maxLineLength + 1,
          codeSnippet: line.substring(0, 100) + '...',
          rule: 'max-line-length',
          suggestion: `将此行拆分为多行，每行不超过${this.config.maxLineLength}字符`
        }));
      }
    });

    // 检查文件总行数
    if (lines.length > 1000) {
      result.addIssue(new Issue({
        category: IssueCategory.BEST_PRACTICE,
        severity: Severity.INFO,
        message: `文件较大 (${lines.length}行)，建议考虑拆分`,
        rule: 'file-length',
        suggestion: '将大文件拆分为多个模块'
      }));
    }

    // 检查是否有console.log残留（生产代码应移除）
    const consoleLogPattern = /console\.(log|debug|info)\s*\(/g;
    let match;
    while ((match = consoleLogPattern.exec(code)) !== null) {
      const lineNum = this._getLineNumber(code, match.index);
      result.addIssue(new Issue({
        category: IssueCategory.BEST_PRACTICE,
        severity: Severity.MINOR,
        message: '发现console.log/debug语句，建议在生产环境移除',
        line: lineNum,
        codeSnippet: code.substring(match.index, match.index + 50),
        rule: 'no-console-log',
        suggestion: '使用日志框架替代或在构建时移除debug语句'
      }));
    }
  }

  /**
   * 复杂度分析
   * @private
   */
  _checkComplexity(code, lines, result) {
    // 检测嵌套层级过深
    const deepNestPattern = /^(\s{2,})/gm;
    let maxIndent = 0;
    let match;
    while ((match = deepNestPattern.exec(code)) !== null) {
      const indent = match[1].length;
      if (indent > maxIndent) maxIndent = indent;
    }

    // 估算最大嵌套深度（假设2空格缩进）
    const estimatedDepth = Math.floor(maxIndent / 2);
    if (estimatedDepth > 5) {
      result.addIssue(new Issue({
        category: IssueCategory.LOGIC,
        severity: Severity.MAJOR,
        message: `代码嵌套层级过深 (约${estimatedDepth}层)，建议重构以降低复杂度`,
        rule: 'max-nesting-depth',
        suggestion: '使用早返回(early return)、提取方法、策略模式等方式降低嵌套'
      }));
    }

    // 检测函数长度
    const functionPattern = /(async\s+)?function\s+\w+|=>\s*\{|^\s*(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\(/gm;
    let funcMatch;
    const functions = [];

    while ((funcMatch = functionPattern.exec(code)) !== null) {
      functions.push({ start: funcMatch.index, name: funcMatch[0].trim() });
    }

    // 简单估算函数范围（不精确但有效）
    for (let i = 0; i < functions.length; i++) {
      const func = functions[i];
      const nextFuncStart = functions[i + 1]?.start || code.length;
      const funcCode = code.substring(func.start, nextFuncStart);
      const funcLines = funcCode.split('\n').length;

      if (funcLines > this.config.maxFunctionLength) {
        const lineNum = this._getLineNumber(code, func.start);
        result.addIssue(new Issue({
          category: IssueCategory.LOGIC,
          severity: Severity.MAJOR,
          message: `函数/块过长 (${funcLines}行/${this.config.maxFunctionLength}行)`,
          line: lineNum,
          rule: 'max-function-length',
          suggestion: `将长函数拆分为多个职责单一的小函数（建议不超过${this.config.maxFunctionLength}行）`
        }));
      }
    }

    // 检测重复代码（简单模式：重复3次以上的相同行）
    const lineFrequency = {};
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.length > 10) { // 忽略短行
        lineFrequency[trimmed] = (lineFrequency[trimmed] || 0) + 1;
      }
    });

    for (const [lineText, count] of Object.entries(lineFrequency)) {
      if (count >= 3) {
        result.addIssue(new Issue({
          category: IssueCategory.BEST_PRACTICE,
          severity: Severity.MINOR,
          message: `发现重复代码片段 (出现${count}次)`,
          codeSnippet: lineText.substring(0, 80),
          rule: 'no-duplicated-code',
          suggestion: '将重复代码提取为共享函数或常量'
        }));
        break; // 只报告一次
      }
    }
  }

  /**
   * 安全扫描
   * @private
   */
  _checkSecurity(code, lines, result) {
    // SQL注入风险
    const sqlPatterns = [
      { pattern: /\$\{.*\}\s*(?:INTO|FROM|WHERE|SELECT|INSERT|UPDATE|DELETE)/i, name: 'sql-injection-template' },
      { pattern: /(?:query|execute)\s*\(\s*["'].*\+.*["']/i, name: 'sql-injection-concat' },
      { pattern: /(?:query|execute)\s*\(\s*[^,]+,\s*\[/i, name: 'sql-injection-array' }
    ];

    for (const { pattern, name } of sqlPatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const lineNum = this._getLineNumber(code, match.index);
        result.addIssue(new Issue({
          category: IssueCategory.SECURITY,
          severity: Severity.CRITICAL,
          message: `潜在的SQL注入风险 (${name})`,
          line: lineNum,
          codeSnippet: code.substring(match.index, match.index + 60),
          rule: name,
          suggestion: '使用参数化查询(prepared statement)替代字符串拼接'
        }));
      }
    }

    // XSS风险
    const xssPatterns = [
      { pattern: /innerHTML\s*=\s*(?!['"])/, name: 'xss-innerHTML' },
      { pattern: /document\.write\s*\(/, name: 'xss-document-write' },
      { pattern: /\.html\s*\([^)]*\+/, name: 'xss-jquery-html-concat' }
    ];

    for (const { pattern, name } of xssPatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const lineNum = this._getLineNumber(code, match.index);
        result.addIssue(new Issue({
          category: IssueCategory.SECURITY,
          severity: Severity.MAJOR,
          message: `潜在的XSS跨站脚本攻击风险 (${name})`,
          line: lineNum,
          codeSnippet: code.substring(match.index, match.index + 50),
          rule: name,
          suggestion: '使用textContent或DOMPurify等安全库处理用户输入'
        }));
      }
    }

    // 敏感信息硬编码
    const sensitivePatterns = [
      { pattern: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']+["']/i, name: 'hardcoded-password' },
      { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["'][^"']+["']/i, name: 'hardcoded-api-key' },
      { pattern: /(?:secret|token)\s*[:=]\s*["'][^"']+["']/i, name: 'hardcoded-secret' },
      { pattern: /(?:mongodb|mysql|postgres|redis):\/\/[^\/\s]+:[^@]+@/i, name: 'hardcoded-connection-string' }
    ];

    for (const { pattern, name } of sensitivePatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const lineNum = this._getLineNumber(code, match.index);
        result.addIssue(new Issue({
          category: IssueCategory.SECURITY,
          severity: Severity.CRITICAL,
          message: `敏感信息硬编码: ${name}`,
          line: lineNum,
          codeSnippet: code.substring(match.index, Math.min(match.index + 70, code.length)),
          rule: name,
          suggestion: '使用环境变量或密钥管理服务存储敏感信息'
        }));
      }
    }

    // eval()使用
    const evalPattern = /\beval\s*\(/g;
    let evalMatch;
    while ((evalMatch = evalPattern.exec(code)) !== null) {
      const lineNum = this._getLineNumber(code, evalMatch.index);
      result.addIssue(new Issue({
        category: IssueCategory.SECURITY,
        severity: Severity.CRITICAL,
        message: '使用了eval()，存在代码注入风险',
        line: lineNum,
        codeSnippet: code.substring(evalMatch.index, evalMatch.index + 30),
        rule: 'no-eval',
        suggestion: '避免使用eval()，改用JSON.parse()或其他安全的替代方案'
      }));
    }
  }

  /**
   * 性能检查
   * @private
   */
  _checkPerformance(code, lines, result) {
    // 同步循环中的耗时操作
    const syncHeavyPattern = /for\s*\([^)]*\)\s*\{[\s\S]{0,200}(?:readFileSync|writeFileSync|execSync)/g;
    let match;
    while ((match = syncHeavyPattern.exec(code)) !== null) {
      const lineNum = this._getLineNumber(code, match.index);
      result.addIssue(new Issue({
        category: IssueCategory.PERFORMANCE,
        severity: Severity.MAJOR,
        message: '在循环中使用同步I/O操作可能导致性能瓶颈',
        line: lineNum,
        rule: 'no-sync-in-loop',
        suggestion: '使用异步版本(readFile/writeFile)或将I/O操作移到循环外部'
      }));
    }

    // 大数组操作警告
    const largeArrayPattern = /\.(?:map|filter|reduce|forEach|sort)\s*\((?!\s*(?:e?\s*=>|function))/g;
    while ((match = largeArrayPattern.exec(code)) !== null) {
      // 简单启发式：如果上下文提到大数据
      const context = code.substring(Math.max(0, match.index - 100), match.index + 50);
      if (/large|big|huge|batch|all\s*\w+|every/i.test(context)) {
        const lineNum = this._getLineNumber(code, match.index);
        result.addIssue(new Issue({
          category: IssueCategory.PERFORMANCE,
          severity: Severity.MINOR,
          message: '对可能的大数组进行链式操作，注意性能影响',
          line: lineNum,
          rule: 'large-array-chain',
          suggestion: '考虑使用for循环或流式处理替代链式调用'
        }));
      }
    }

    // 内存泄漏风险：事件监听器未清理
    const eventListenerPattern = /addEventListener\s*\(/g;
    let listenerCount = 0;
    while ((match = eventListenerPattern.exec(code)) !== null) {
      listenerCount++;
    }

    const removeListenerPattern = /removeEventListener\s*\(/g;
    let removeCount = 0;
    while ((match = removeListenerPattern.exec(code)) !== null) {
      removeCount++;
    }

    if (listenerCount > removeCount && listenerCount > 3) {
      result.addIssue(new Issue({
        category: IssueCategory.PERFORMANCE,
        severity: Severity.MAJOR,
        message: `潜在内存泄漏: ${listenerCount}个addEventListener但只有${removeCount}个removeEventListener`,
        rule: 'event-listener-leak',
        suggestion: '确保在组件卸载时清理所有事件监听器'
      }));
    }

    // N+1查询模式检测（简单启发式）
    const queryInLoopPattern = /(?:find|query|select|get|fetch)\s*\([^)]*\)[^;]*;/g;
    let queryMatches = [];
    while ((match = queryInLoopPattern.exec(code)) !== null) {
      queryMatches.push({ index: match.index, text: match[0] });
    }

    if (queryMatches.length >= 3) {
      // 检查是否在相近位置（可能在同一循环内）
      const positions = queryMatches.map(m => m.index);
      const avgGap = positions.slice(1).reduce((sum, p, i) => sum + (p - positions[i]), 0) / (positions.length - 1);
      if (avgGap < 500) { // 相对集中
        const lineNum = this._getLineNumber(code, queryMatches[0].index);
        result.addIssue(new Issue({
          category: IssueCategory.PERFORMANCE,
          severity: Severity.MAJOR,
          message: `可能的N+1查询问题: 在小范围内发现${queryMatches.length}次数据库查询`,
          line: lineNum,
          rule: 'n-plus-one-query',
          suggestion: '使用批量查询(eager loading)或JOIN替代循环中的单独查询'
        }));
      }
    }
  }

  /**
   * 代码风格检查
   * @private
   */
  _checkStyle(code, lines, result) {
    // 检查缺少分号的语句（JavaScript特定）
    const noSemicolonPattern = /^\s*(?:let|const|var|return|throw)\s+[^;=]*$/gm;
    let match;
    while ((match = noSemicolonPattern.exec(code)) !== null) {
      const nextChar = code.charAt(match.index + match[0].length);
      if (nextChar !== '\n' && nextChar !== ';' && nextChar !== '}') continue;

      const lineNum = this._getLineNumber(code, match.index);
      result.addIssue(new Issue({
        category: IssueCategory.STYLE,
        severity: Severity.INFO,
        message: '语句末尾缺少分号（如使用分号风格）',
        line: lineNum,
        codeSnippet: match[0].trim(),
        rule: 'semi-style',
        suggestion: '确保团队代码风格一致（统一使用或不使用分号）'
      }));
    }

    // 检查TODO/FIXME/HACK注释
    const todoPattern = /\/\/\s*(TODO|FIXME|HACK|XXX|BUG):?\s*.*/gi;
    while ((match = todoPattern.exec(code)) !== null) {
      const lineNum = this._getLineNumber(code, match.index);
      const type = match[1].toUpperCase();
      const severity = type === 'FIXME' || type === 'BUG' ? Severity.MAJOR :
                       type === 'HACK' || type === 'XXX' ? Severity.MAJOR : Severity.MINOR;

      result.addIssue(new Issue({
        category: IssueCategory.BEST_PRACTICE,
        severity: severity,
        message: `代码标记: ${match[0].trim()}`,
        line: lineNum,
        rule: `marked-as-${type.toLowerCase()}`,
        suggestion: `${type === 'TODO' ? '跟踪并完成待办事项' : type === 'FIXME' ? '尽快修复已知问题' : '重构或清理hack代码'}`
      }));
    }

    // 检查未使用的import（简单启发式）
    const importPattern = /^import\s+.+?\s+from\s+['"][^'"]+['"]/gm;
    const imports = [];
    while ((match = importPattern.exec(code)) !== null) {
      imports.push({
        full: match[0],
        names: match[0].match(/\{([^}]+)\}|(\w+)/)?.[1] || match[0].match(/\bimport\s+(\w+)/)?.[1]
      });
    }

    // 简单检查：如果import了很多但代码很短，可能有未使用的导入
    if (imports.length > 5 && lines.length < 30) {
      result.addIssue(new Issue({
        category: IssueCategory.STYLE,
        severity: Severity.INFO,
        message: `导入了${imports.length}个模块但文件较短(${lines.length}行)，可能存在未使用的导入`,
        rule: 'unused-imports',
        suggestion: '检查并移除未使用的import语句'
      }));
    }

    // 检查魔法数字
    const magicNumberPattern = /(?<![$\w])(?:\d{2,}|0[xX][\da-fA-F]{4,})(?![\d.a-fA-F])/g;
    const excludedContext = /(?:version|port|status|code|type|level|index|count|size|length|max|min|limit|offset|page|timeout|retry|delay|buffer|capacity|=|\(|\[|,|\s)(?:\d{2,})/;
    let magicMatch;
    let magicCount = 0;
    while ((magicMatch = magicNumberPattern.exec(code)) !== null) {
      const contextBefore = code.substring(Math.max(0, magicMatch.index - 20), magicMatch.index);
      if (!excludedContext.test(contextBefore)) {
        magicCount++;
        if (magicCount <= 3) {
          const lineNum = this._getLineNumber(code, magicMatch.index);
          result.addIssue(new Issue({
            category: IssueCategory.BEST_PRACTICE,
            severity: Severity.MINOR,
            message: `魔法数字: ${magicMatch[0]} (建议提取为命名常量)`,
            line: lineNum,
            codeSnippet: code.substring(magicMatch.index - 10, magicMatch.index + 20),
            rule: 'no-magic-numbers',
            suggestion: `将数字 ${magicMatch[0]} 提取为有意义的命名常量`
          }));
        }
      }
    }
  }

  /**
   * 规格一致性检查
   * @private
   */
  _checkSpecCompliance(code, spec, result) {
    // 检查必需的函数是否存在
    if (spec.requiredFunctions && Array.isArray(spec.requiredFunctions)) {
      for (const funcName of spec.requiredFunctions) {
        const funcPattern = new RegExp(`(?:function\\s+${funcName}|${funcName}\\s*[=(]|export\\s+(?:async\\s+)?function\\s+${funcName})`);
        if (!funcPattern.test(code)) {
          result.addIssue(new Issue({
            category: IssueCategory.SPEC_VIOLATION,
            severity: Severity.CRITICAL,
            message: `缺少必需的函数: ${funcName}`,
            rule: 'required-function-missing',
            suggestion: `按照规格要求实现 ${funcName} 函数`
          }));
        }
      }
    }

    // 检查必需的导出
    if (spec.exports && Array.isArray(spec.exports)) {
      for (const exportName of spec.exports) {
        const exportPattern = new RegExp(`export\\s+(?:const|let|var|function|class|default)\\s+${exportName}`);
        if (!exportPattern.test(code)) {
          result.addIssue(new Issue({
            category: IssueCategory.SPEC_VIOLATION,
            severity: Severity.MAJOR,
            message: `缺少必需的导出: ${exportName}`,
            rule: 'required-export-missing',
            suggestion: `添加 export 关键字导出 ${exportName}`
          }));
        }
      }
    }

    // 检查禁止使用的API
    if (spec.forbiddenAPIs && Array.isArray(spec.forbiddenAPIs)) {
      for (const api of spec.forbiddenAPIs) {
        const apiPattern = new RegExp(`\\b${api.replace('.', '\\.')}\\b`);
        if (apiPattern.test(code)) {
          const apiIndex = code.search(apiPattern);
          const lineNum = this._getLineNumber(code, apiIndex);
          result.addIssue(new Issue({
            category: IssueCategory.SPEC_VIOLATION,
            severity: Severity.MAJOR,
            message: `使用了禁止的API: ${api}`,
            line: lineNum,
            rule: 'forbidden-api-used',
            suggestion: `替换 ${api} 为允许的替代方案`
          }));
        }
      }
    }

    // 检查代码覆盖要求
    if (spec.minLines && lines = code.split('\n').length < spec.minLines) {
      result.addIssue(new Issue({
        category: IssueCategory.SPEC_VIOLATION,
        severity: Severity.MAJOR,
        message: `代码行数不足: 当前${lines.length}行，要求至少${spec.minLines}行`,
        rule: 'min-lines-not-met',
        suggestion: `完善实现以满足最低${spec.minLines}行的要求`
      }));
    }
  }

  /**
   * 自定义规则检查
   * @private
   */
  _checkCustomRules(code, lines, result) {
    const customRules = this.config.customRules;
    if (!customRules || typeof customRules !== 'object') return;

    for (const [ruleName, ruleConfig] of Object.entries(customRules)) {
      if (this.config.disabledRules.has(ruleName)) continue;

      try {
        const { pattern, severity, message, category } = ruleConfig;

        if (typeof pattern === 'string') {
          const regex = new RegExp(pattern, 'g');
          let match;
          while ((match = regex.exec(code)) !== null) {
            const lineNum = this._getLineNumber(code, match.index);
            result.addIssue(new Issue({
              category: category || IssueCategory.BEST_PRACTICE,
              severity: severity || Severity.MINOR,
              message: message || `自定义规则[${ruleName}]触发`,
              line: lineNum,
              codeSnippet: code.substring(match.index, match.index + 50),
              rule: `custom:${ruleName}`,
              suggestion: ruleConfig.suggestion || `参考规则 ${ruleName} 的说明进行调整`
            }));
          }
        } else if (typeof pattern === 'function') {
          // 支持自定义检查函数
          const customIssues = await pattern(code, lines, spec);
          if (Array.isArray(customIssues)) {
            for (const issueData of customIssues) {
              result.addIssue(new Issue({
                ...issueData,
                rule: `custom:${ruleName}`
              }));
            }
          }
        }
      } catch (err) {
        console.error(chalk.yellow(`  ⚠️ 自定义规则[${ruleName}]执行失败: ${err.message}`));
      }
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 分析代码指标
   * @private
   */
  _analyzeMetrics(code) {
    const lines = code.split('\n');
    const nonEmptyLines = lines.filter(l => l.trim().length > 0);
    const commentLines = lines.filter(l => /^\s*(\/\/|#|\/\*|\*|<!--)/.test(l.trim()));

    return {
      totalLines: lines.length,
      nonEmptyLines: nonEmptyLines.length,
      commentLines: commentLines.length,
      blankLines: lines.length - nonEmptyLines.length - commentLines.length,

      // 复杂度估算（简化版圈复杂度）
      complexity: this._estimateComplexity(code),

      // 代码密度
      density: nonEmptyLines.length / Math.max(lines.length, 1),

      // 字符统计
      totalChars: code.length,
      avgLineLength: lines.reduce((sum, l) => sum + l.length, 0) / Math.max(lines.length, 1)
    };
  }

  /**
   * 估算圈复杂度（简化版）
   * @private
   */
  _estimateComplexity(code) {
    // 基于控制流关键字的数量估算
    const keywords = ['if', 'else', 'for', 'while', 'case', 'catch', '&&', '\\|\\|', '\\?'];
    let complexity = 1; // 基础复杂度

    for (const kw of keywords) {
      const matches = code.match(new RegExp(`\\b${kw}\\b`, 'g'));
      complexity += (matches?.length || 0);
    }

    return complexity;
  }

  /**
   * 计算代码哈希值
   * @private
   */
  _computeHash(code) {
    return crypto.createHash('md5').update(code).digest('hex').substring(0, 12);
  }

  /**
   * 获取字符位置对应的行号
   * @private
   */
  _getLineNumber(code, position) {
    const lines = code.substring(0, position).split('\n');
    return lines.length;
  }

  /**
   * 初始化内置规则集
   * @private
   */
  _initRules() {
    return {
      'no-empty-file': { enabled: true, category: IssueCategory.SYNTAX, severity: Severity.CRITICAL },
      'max-line-length': { enabled: true, category: IssueCategory.STYLE, severity: Severity.MINOR },
      'max-nesting-depth': { enabled: true, category: IssueCategory.LOGIC, severity: Severity.MAJOR },
      'max-function-length': { enabled: true, category: IssueCategory.LOGIC, severity: Severity.MAJOR },
      'no-duplicated-code': { enabled: true, category: IssueCategory.BEST_PRACTICE, severity: Severity.MINOR },
      'sql-injection': { enabled: true, category: IssueCategory.SECURITY, severity: Severity.CRITICAL },
      'xss-risk': { enabled: true, category: IssueCategory.SECURITY, severity: Severity.MAJOR },
      'hardcoded-secret': { enabled: true, category: IssueCategory.SECURITY, severity: Severity.CRITICAL },
      'no-eval': { enabled: true, category: IssueCategory.SECURITY, severity: Severity.CRITICAL },
      'no-sync-in-loop': { enabled: true, category: IssueCategory.PERFORMANCE, severity: Severity.MAJOR },
      'n-plus-one-query': { enabled: true, category: IssueCategory.PERFORMANCE, severity: Severity.MAJOR },
      'event-listener-leak': { enabled: true, category: IssueCategory.PERFORMANCE, severity: Severity.MAJOR },
      'no-console-log': { enabled: true, category: IssueCategory.BEST_PRACTICE, severity: Severity.MINOR },
      'no-magic-numbers': { enabled: true, category: IssueCategory.BEST_PRACTICE, severity: Severity.MINOR },
      'todo-fixme-hack': { enabled: true, category: IssueCategory.BEST_PRACTICE, severity: Severity.MINOR },
      'unused-imports': { enabled: true, category: IssueCategory.STYLE, severity: Severity.INFO },
      'required-function': { enabled: true, category: IssueCategory.SPEC_VIOLATION, severity: Severity.CRITICAL },
      'forbidden-api': { enabled: true, category: IssueCategory.SPEC_VIOLATION, severity: Severity.MAJOR }
    };
  }

  /**
   * 更新运行统计
   * @private
   */
  _updateStats(result) {
    this.stats.totalReviews++;
    this.stats.totalIssuesFound += result.issues.length;
    this.stats.avgReviewTime =
      ((this.stats.avgReviewTime * (this.stats.totalReviews - 1)) + result.reviewTime) /
      this.stats.totalReviews;
  }

  /**
   * 获取审查统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalReviews: 0,
      totalIssuesFound: 0,
      avgReviewTime: 0
    };
  }

  /**
   * 配置规则启用/禁用
   * @param {string} ruleName - 规则名称
   * @param {boolean} enabled - 是否启用
   */
  toggleRule(ruleName, enabled) {
    if (enabled) {
      this.config.disabledRules.delete(ruleName);
    } else {
      this.config.disabledRules.add(ruleName);
    }
  }

  /**
   * 添加自定义规则
   * @param {string} name - 规则名称
   * @param {Object} config - 规则配置 { pattern, severity, message, category, suggestion }
   */
  addCustomRule(name, config) {
    this.config.customRules[name] = config;
  }
}

/**
 * 默认导出
 */
export default AutoReviewer;
