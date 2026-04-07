// lib/iteration/auto-fixer.js - 自动修复模块
// 根据审查结果生成修复建议和代码patch
// 安全原则: 只生成建议和patch预览，不直接修改源码

import chalk from 'chalk';
import { Severity } from './auto-reviewer.js';

/**
 * 修复类型枚举
 */
export const FixType = {
  REPLACE: 'replace',         // 替换代码片段
  INSERT_BEFORE: 'insert_before', // 在指定位置前插入
  INSERT_AFTER: 'insert_after',   // 在指定位置后插入
  DELETE: 'delete',           // 删除代码行
  REFACTOR: 'refactor',       // 重构建议（需要人工确认）
  CONFIG_CHANGE: 'config_change' // 配置修改建议
};

/**
 * 修复置信度等级
 */
export const ConfidenceLevel = {
  HIGH: 'high',     // 高置信度，可安全自动应用
  MEDIUM: 'medium', // 中等置信度，需要人工审核
  LOW: 'low'        // 低置信度，仅作参考
};

/**
 * 单条修复建议
 */
class FixSuggestion {
  /**
   * @param {Object} params
   * @param {string} params.id - 唯一标识
   * @param {string} params.type - 修复类型 (FixType)
   * @param {string} params.description - 修复描述
   * @param {string} params.issueId - 关联的问题ID
   * @param {number} [params.line] - 目标行号
   * @param {string} [params.originalCode] - 原始代码片段
   * @param {string} [params.fixedCode] - 修复后的代码
   * @param {string} params.confidence - 置信度 (ConfidenceLevel)
   * @param {boolean} params.autoApplicable - 是否可自动应用
   * @param {string} [params.reasoning] - 修复理由
   * @param {string} [params.category] - 修复类别
   * @param {Array<string>} [params.risks] - 潜在风险列表
   */
  constructor(params) {
    this.id = params.id || `fix-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    this.type = params.type;
    this.description = params.description;
    this.issueId = params.issueId;
    this.line = params.line || null;
    this.originalCode = params.originalCode || null;
    this.fixedCode = params.fixedCode || null;
    this.confidence = params.confidence || ConfidenceLevel.MEDIUM;
    this.autoApplicable = params.autoApplicable !== undefined ? params.autoApplicable : false;
    this.reasoning = params.reasoning || '';
    this.category = params.category || 'general';
    this.risks = params.risks || [];
    this.timestamp = Date.now();
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      description: this.description,
      issueId: this.issueId,
      line: this.line,
      originalCode: this.originalCode,
      fixedCode: this.fixedCode,
      confidence: this.confidence,
      autoApplicable: this.autoApplicable,
      reasoning: this.reasoning,
      category: this.category,
      risks: this.risks
    };
  }

  /**
   * 应用此修复到源代码
   * @param {string} source - 源代码
   * @returns {string} 修复后的代码
   */
  apply(source) {
    if (!this.autoApplicable) {
      throw new Error(`修复 ${this.id} 标记为不可自动应用，请手动处理`);
    }

    const lines = source.split('\n');

    switch (this.type) {
      case FixType.REPLACE:
        if (this.line && this.fixedCode !== null) {
          lines[this.line - 1] = this.fixedCode;
        }
        break;

      case FixType.INSERT_BEFORE:
        if (this.line && this.fixedCode !== null) {
          lines.splice(this.line - 1, 0, this.fixedCode);
        }
        break;

      case FixType.INSERT_AFTER:
        if (this.line && this.fixedCode !== null) {
          lines.splice(this.line, 0, this.fixedCode);
        }
        break;

      case FixType.DELETE:
        if (this.line) {
          lines.splice(this.line - 1, 1);
        }
        break;

      default:
        console.warn(chalk.yellow(`不支持的修复类型: ${this.type}`));
        break;
    }

    return lines.join('\n');
  }
}

/**
 * 修复结果
 */
class FixResult {
  constructor() {
    this.suggestions = [];
    this.patchedCode = null;  // 应用了高置信度修复后的代码预览
    this.appliedCount = 0;
    this.skippedCount = 0;
    this.manualReviewRequired = [];
    this.fixTime = 0;
  }

  addSuggestion(suggestion) {
    this.suggestions.push(suggestion);

    if (suggestion.autoApplicable && suggestion.confidence === ConfidenceLevel.HIGH) {
      this.appliedCount++;
    } else {
      this.skippedCount++;
      this.manualReviewRequired.push(suggestion);
    }
  }

  getSummary() {
    return {
      totalSuggestions: this.suggestions.length,
      autoApplied: this.appliedCount,
      manualReview: this.skippedCount,
      byConfidence: {
        high: this.suggestions.filter(s => s.confidence === ConfidenceLevel.HIGH).length,
        medium: this.suggestions.filter(s => s.confidence === ConfidenceLevel.MEDIUM).length,
        low: this.suggestions.filter(s => s.confidence === ConfidenceLevel.LOW).length
      },
      byCategory: this._groupByCategory()
    };
  }

  _groupByCategory() {
    const groups = {};
    for (const s of this.suggestions) {
      groups[s.category] = (groups[s.category] || 0) + 1;
    }
    return groups;
  }
}

/**
 * AutoFixer - 自动修复建议生成器
 *
 * 核心职责:
 *   1. 分析审查结果中的问题
 *   2. 为每个问题生成修复策略
 *   3. 评估修复的可行性和风险
 *   4. 生成代码patch预览（不直接修改源码）
 *
 * 安全原则:
 *   - 所有修复都是"建议"性质，默认不自动应用
 *   - 只有高置信度的简单修复才标记为可自动应用
 *   - 复杂重构类修复始终需要人工确认
 *   - 提供完整的before/after对比供审核
 *
 * 使用场景:
 *   - 与IterationController配合完成多轮迭代
 *   - 作为独立工具为开发者提供修复指导
 *   - 集成到CI/CD流水线作为代码质量门禁
 */
export class AutoFixer {
  /**
   * @param {Object} config - 配置选项
   * @param {boolean} config.autoApplyHighConfidence - 是否自动应用高置信度修复 (默认false)
   * @param {boolean} config.generatePatchedCode - 是否生成patch预览代码 (默认true)
   * @param {number} config.maxFixesPerIssue - 每个问题最大修复建议数 (默认3)
   * @param {Array<string>} config.disabledCategories - 禁用的修复类别
   * @param {Object} config.fixStrategies - 自定义修复策略映射
   */
  constructor(config = {}) {
    this.config = {
      autoApplyHighConfidence: config.autoApplyHighConfidence || false,
      generatePatchedCode: config.generatePatchedCode !== false,
      maxFixesPerIssue: config.maxFixesPerIssue || 3,
      disabledCategories: new Set(config.disabledCategories || []),
      fixStrategies: config.fixStrategies || {}
    };

    // 注册内置修复策略
    this.strategies = this._initStrategies();

    // 统计信息
    this.stats = {
      totalFixSessions: 0,
      totalSuggestionsGenerated: 0,
      avgSuggestionsPerIssue: 0
    };
  }

  /**
   * 根据审查结果生成修复建议
   *
   * @param {string} code - 待修复的原始代码
   * @param {Array<Issue>} issues - 审查发现的问题列表
   * @param {Object} spec - 开发规格 (可选)
   * @returns {FixResult} 修复结果
   */
  generateFixes(code, issues, spec = {}) {
    const startTime = Date.now();
    const result = new FixResult();

    console.log(chalk.blue('  🔧 AutoFixer 开始分析修复方案...'));

    try {
      // 为每个问题生成修复建议
      for (const issue of issues) {
        const fixes = this._generateFixForIssue(code, issue, spec);

        for (const fix of fixes.slice(0, this.config.maxFixesPerIssue)) {
          result.addSuggestion(fix);
        }
      }

      // 如果启用，生成应用了高置信度修复后的代码预览
      if (this.config.generatePatchedCode && result.appliedCount > 0) {
        result.patchedCode = this._applySafeFixes(code, result.suggestions);
      }

      // 更新统计
      result.fixTime = Date.now() - startTime;
      this._updateStats(result);

      const summary = result.getSummary();
      console.log(`  ✅ 修复分析完成: ${summary.totalSuggestions} 条建议 (${summary.autoApplied} 可自动应用, ${summary.manualReview} 需人工审核)`);

      return result;

    } catch (error) {
      console.error(chalk.red(`  ❌ 修复分析出错: ${error.message}`));
      return result;
    }
  }

  /**
   * 为单个问题生成修复建议
   * @private
   */
  _generateFixForIssue(code, issue, spec) {
    const fixes = [];

    // 根据问题类别选择修复策略
    const strategyKey = this._getStrategyKey(issue);
    const strategy = this.strategies[strategyKey];

    if (strategy && typeof strategy.handler === 'function') {
      try {
        const strategyFixes = strategy.handler(code, issue, spec);
        if (Array.isArray(strategyFixes)) {
          fixes.push(...strategyFixes);
        }
      } catch (err) {
        console.error(chalk.yellow(`  ⚠️ 策略[${strategyKey}]执行失败: ${err.message}`));
      }
    }

    // 如果没有找到专用策略，使用通用修复建议
    if (fixes.length === 0) {
      fixes.push(this._generateGenericFix(code, issue));
    }

    return fixes;
  }

  /**
   * 获取策略键名
   * @private
   */
  _getStrategyKey(issue) {
    // 优先使用规则名称
    if (issue.rule && this.strategies[issue.rule]) {
      return issue.rule;
    }
    // 其次使用类别
    if (this.strategies[issue.category]) {
      return issue.category;
    }
    // 再次尝试类别+严重级别组合
    const combined = `${issue.category}_${issue.severity}`;
    if (this.strategies[combined]) {
      return combined;
    }
    return 'default';
  }

  // ==================== 内置修复策略 ====================

  /**
   * SQL注入修复策略
   */
  _fixSqlInjection(code, issue) {
    const lineNum = issue.line;
    const originalLine = this._getLine(code, lineNum);

    if (!originalLine) return [];

    const fixes = [];

    // 生成参数化查询示例
    const fixedExample = originalLine
      .replace(/\$\{.*?\}/g, '?')
      .replace(/["']\s*\+\s*[^"']+/, '?');

    fixes.push(new FixSuggestion({
      type: FixType.REPLACE,
      description: `将SQL字符串拼接替换为参数化查询`,
      issueId: issue.id,
      line: lineNum,
      originalCode: originalLine.trim(),
      fixedCode: fixedExample.trim(),
      confidence: ConfidenceLevel.HIGH,
      autoApplicable: true,
      category: 'security',
      reasoning: '使用参数化查询(prepared statement)可以有效防止SQL注入攻击',
      risks: ['需要确保参数绑定顺序正确']
    }));

    // 备选方案：使用ORM
    fixes.push(new FixSuggestion({
      type: FixType.REFACTOR,
      description: `考虑使用ORM/Query Builder替代原生SQL`,
      issueId: issue.id,
      line: lineNum,
      confidence: ConfidenceLevel.MEDIUM,
      autoApplicable: false,
      category: 'security',
      reasoning: '如Sequelize、TypeORM、Prisma等提供了安全的查询接口',
      risks: ['可能需要较大的架构调整', '需要学习ORM的使用方式']
    }));

    return fixes;
  }

  /**
   * XSS修复策略
   */
  _fixXss(code, issue) {
    const lineNum = issue.line;
    const originalLine = this._getLine(code, lineNum);

    if (!originalLine) return [];

    const fixes = [];

    let fixedCode = originalLine;

    // innerHTML -> textContent
    if (/innerHTML\s*=/.test(originalLine)) {
      fixedCode = originalLine.replace(/innerHTML/g, 'textContent');
    }

    // document.write -> 安全DOM操作
    if (/document\.write\s*\(/.test(originalLine)) {
      fixedCode = '// 已移除document.write，请使用DOM API安全地插入内容';
    }

    if (fixedCode !== originalLine) {
      fixes.push(new FixSuggestion({
        type: FixType.REPLACE,
        description: `替换不安全的DOM操作为安全替代方案`,
        issueId: issue.id,
        line: lineNum,
        originalCode: originalLine.trim(),
        fixedCode: fixedCode.trim(),
        confidence: ConfidenceLevel.HIGH,
        autoApplicable: true,
        category: 'security',
        reasoning: 'textContent不会解析HTML标签，可有效防止XSS攻击',
        risks: ['innerHTML设置的样式属性会丢失']
      }));
    }

    // 建议使用DOMPurify
    fixes.push(new FixSuggestion({
      type: FixType.REFACTOR,
      description: `如需保留HTML格式，使用DOMPurify进行消毒`,
      issueId: issue.id,
      line: lineNum,
      confidence: ConfidenceLevel.MEDIUM,
      autoApplicable: false,
      category: 'security',
      reasoning: 'DOMPurify可以清理HTML中的恶意脚本同时保留合法内容',
      risks: ['需要引入额外依赖', '需确保DOMPurify版本保持更新']
    }));

    return fixes;
  }

  /**
   * 敏感信息硬编码修复策略
   */
  _fixHardcodedSecret(code, issue) {
    const lineNum = issue.line;
    const originalLine = this._getLine(code, lineNum);

    if (!originalLine) return [];

    const fixes = [];

    // 提取变量名的正则
    const varMatch = originalLine.match(/(?:password|passwd|pwd|api[_-]?key|apikey|secret|token)\s*[:=]\s*['"]([^'"]+)['"]/i);
    const varName = varMatch ? varMatch[1].substring(0, 3) + '***' : '***';

    // 生成环境变量引用示例
    const envVarName = (varMatch?.[0]?.match(/[a-zA-Z_]+/)?.[0] || 'SECRET').toUpperCase();
    const fixedCode = originalLine.replace(
      /[:=]\s*['"][^'"]+['"]/,
      `: process.env.${envVarName}`
    );

    fixes.push(new FixSuggestion({
      type: FixType.REPLACE,
      description: `将硬编码的${varName}替换为环境变量引用`,
      issueId: issue.id,
      line: lineNum,
      originalCode: originalLine.trim(),
      fixedCode: fixedCode.trim(),
      confidence: ConfidenceLevel.HIGH,
      autoApplicable: true,
      category: 'security',
      reasoning: '敏感信息不应硬编码在源码中，应通过环境变量或密钥管理服务注入',
      risks: ['需要在部署环境配置相应的环境变量', '确保.env文件不被提交到版本控制']
    }));

    // 建议使用配置管理服务
    fixes.push(new FixSuggestion({
      type: FixType.REFACTOR,
      description: `对于生产环境，考虑使用AWS Secrets Manager / HashiCorp Vault等`,
      issueId: issue.id,
      line: lineNum,
      confidence: ConfidenceLevel.LOW,
      autoApplicable: false,
      category: 'security',
      reasoning: '专业的密钥管理服务提供加密存储、审计日志、自动轮换等功能',
      costs: ['增加基础设施复杂度', '可能有额外费用']
    }));

    return fixes;
  }

  /**
   * eval()修复策略
   */
  _fixEval(code, issue) {
    const lineNum = issue.line;
    const originalLine = this._getLine(code, lineNum);

    if (!originalLine) return [];

    const fixes = [];

    // 尝试判断eval用途并给出具体建议
    const evalContent = originalLine.match(/eval\s*\(\s*(.+?)\s*\)/)?.[1];

    let suggestion = '避免使用eval()';
    let fixedCode = '// 请使用更安全的替代方案';

    if (evalContent) {
      if (/JSON/.test(evalContent)) {
        fixedCode = originalLine.replace(/eval\s*\(\s*/, 'JSON.parse(');
        suggestion = '如果解析JSON，使用JSON.parse()替代eval()';
      } else if (/\[\w+\]/.test(evalContent)) {
        fixedCode = originalLine.replace(/eval\s*\(\s*/, '');
        fixedCode = fixedCode.replace(/\)\s*$/, '');
        suggestion = '如果是动态属性访问，使用obj[prop]语法替代';
      }
    }

    fixes.push(new FixSuggestion({
      type: FixType.REPLACE,
      description: suggestion,
      issueId: issue.id,
      line: lineNum,
      originalCode: originalLine.trim(),
      fixedCode: fixedCode.trim(),
      confidence: ConfidenceLevel.HIGH,
      autoApplicable: true,
      category: 'security',
      reasoning: 'eval()会执行任意JavaScript代码，存在严重的安全风险和性能问题',
      risks: ['需要验证替换后功能是否正常']
    }));

    return fixes;
  }

  /**
   * 性能问题修复策略
   */
  _fixPerformanceIssue(code, issue) {
    const lineNum = issue.line;
    const originalLine = this._getLine(code, lineNum);

    if (!originalLine) return [];

    const fixes = [];

    switch (issue.rule) {
      case 'no-sync-in-loop':
        fixes.push(new FixSuggestion({
          type: FixType.REFACTOR,
          description: `将同步I/O操作改为异步版本或移出循环`,
          issueId: issue.id,
          line: lineNum,
          originalCode: originalLine.trim(),
          fixedCode: originalLine
            .replace(/readFileSync/g, 'readFile')
            .replace(/writeFileSync/g, 'writeFile')
            .replace(/execSync/g, 'exec')
            .trim(),
          confidence: ConfidenceLevel.MEDIUM,
          autoApplicable: false,
          category: 'performance',
          reasoning: '同步I/O会阻塞事件循环，在循环中会导致严重的性能瓶颈',
          risks: ['需要将函数改为async/await模式', '需要正确处理错误回调']
        }));
        break;

      case 'n-plus-one-query':
        fixes.push(new FixSuggestion({
          type: FixType.REFACTOR,
          description: `使用批量查询(eager loading)或JOIN替代循环中的单独查询`,
          issueId: issue.id,
          line: lineNum,
          confidence: ConfidenceLevel.MEDIUM,
          autoApplicable: false,
          category: 'performance',
          reasoning: 'N+1问题是数据库性能问题的常见原因，可通过一次查询获取所有关联数据来解决',
          risks: ['可能增加单次查询的复杂度', '需要注意内存占用']
        }));
        break;

      case 'event-listener-leak':
        fixes.push(new FixSuggestion({
          type: FixType.INSERT_BEFORE,
          description: `在组件卸载时添加事件监听器清理逻辑`,
          issueId: issue.id,
          line: lineNum,
          fixedCode: `
  // 清理事件监听器
  element.removeEventListener('eventType', handler);`,
          confidence: ConfidenceLevel.MEDIUM,
          autoApplicable: false,
          category: 'performance',
          reasoning: '未清理的事件监听器会导致内存泄漏，尤其在SPA应用中',
          risks: ['需要确定正确的清理时机', '需要保存handler的引用']
        }));
        break;

      default:
        fixes.push(this._generateGenericFix(code, issue));
    }

    return fixes;
  }

  /**
   * 代码风格修复策略
   */
  _fixStyleIssue(code, issue) {
    const lineNum = issue.line;
    const originalLine = this._getLine(code, lineNum);

    if (!originalLine) return [];

    const fixes = [];

    switch (issue.rule) {
      case 'max-line-length':
        // 自动拆分长行
        const targetLength = 100;
        if (originalLine.length > targetLength) {
          // 简单拆分策略：在逗号、运算符处断开
          let fixedCode = originalLine;
          const splitPoints = [', ', ' + ', ' && ', ' || ', ' ? '];
          for (const point of splitPoints) {
            const idx = fixedCode.indexOf(point, targetLength);
            if (idx > 0) {
              fixedCode = fixedCode.substring(0, idx + point.length) +
                         '\n' + ' '.repeat(fixedCode.search(/\S/) + 2) +
                         fixedCode.substring(idx + point.length);
              break;
            }
          }

          if (fixedCode !== originalLine) {
            fixes.push(new FixSuggestion({
              type: FixType.REPLACE,
              description: `拆分过长行为多行（目标长度:${targetLength}字符）`,
              issueId: issue.id,
              line: lineNum,
              originalCode: originalLine.trim(),
              fixedCode: fixedCode.trim(),
              confidence: ConfidenceLevel.HIGH,
              autoApplicable: true,
              category: 'style'
            }));
          }
        }
        break;

      case 'no-console-log':
        fixes.push(new FixSuggestion({
          type: FixType.REPLACE,
          description: `将console.log替换为条件性日志输出`,
          issueId: issue.id,
          line: lineNum,
          originalCode: originalLine.trim(),
          fixedCode: originalLine.replace(
            /console\.(log|debug|info)\s*\(/g,
            'logger.debug('
          ).trim(),
          confidence: ConfidenceLevel.HIGH,
          autoApplicable: true,
          category: 'style',
          reasoning: '生产环境应使用结构化日志框架而非console.log',
          risks: ['需要引入logger依赖', '需要配置日志级别']
        }));
        break;

      case 'no-magic-numbers':
        const magicMatch = issue.codeSnippet?.match(/\d+/);
        if (magicMatch) {
          const num = magicMatch[0];
          const constName = this._suggestConstantName(num, issue);
          fixes.push(new FixSuggestion({
            type: FixType.INSERT_BEFORE,
            description: `将魔法数字 ${num} 提取为命名常量 ${constName}`,
            issueId: issue.id,
            line: lineNum,
            fixedCode: `const ${constName} = ${num}; // TODO: 添加有意义的常量描述`,
            confidence: ConfidenceLevel.MEDIUM,
            autoApplicable: false,
            category: 'style'
          }));
        }
        break;

      default:
        fixes.push(this._generateGenericFix(code, issue));
    }

    return fixes;
  }

  /**
   * 复杂度/逻辑问题修复策略
   */
  _fixLogicIssue(code, issue) {
    const fixes = [];

    switch (issue.rule) {
      case 'max-nesting-depth':
        fixes.push(new FixSuggestion({
          type: FixType.REFACTOR,
          description: `使用早返回(early return)模式减少嵌套层级`,
          issueId: issue.id,
          line: issue.line,
          confidence: ConfidenceLevel.MEDIUM,
          autoApplicable: false,
          category: 'logic',
          reasoning: '早返回可以让代码逻辑更清晰，减少认知负担',
          example: `
// Before:
function process(data) {
  if (data) {
    if (data.items) {
      data.items.forEach(item => { ... });
    }
  }
}

// After:
function process(data) {
  if (!data) return;
  if (!data.items) return;
  data.items.forEach(item => { ... });
}`
        }));
        break;

      case 'max-function-length':
        fixes.push(new FixSuggestion({
          type: FixType.REFACTOR,
          description: `将长函数按职责拆分为多个小函数`,
          issueId: issue.id,
          line: issue.line,
          confidence: ConfidenceLevel.MEDIUM,
          autoApplicable: false,
          category: 'logic',
          reasoning: '单一职责原则要求每个函数只做一件事',
          risks: ['需要识别函数内的不同职责边界', '可能需要传递更多参数']
        }));
        break;

      case 'no-duplicated-code':
        fixes.push(new FixSuggestion({
          type: FixType.REFACTOR,
          description: `提取重复代码为共享函数或工具方法`,
          issueId: issue.id,
          line: issue.line,
          confidence: ConfidenceLevel.MEDIUM,
          autoApplicable: false,
          category: 'logic',
          reasoning: 'DRY(Don't Repeat Yourself)原则可以减少维护成本和bug风险'
        }));
        break;

      default:
        fixes.push(this._generateGenericFix(code, issue));
    }

    return fixes;
  }

  /**
   * 规格违反修复策略
   */
  _fixSpecViolation(code, issue) {
    const fixes = [];

    switch (issue.rule) {
      case 'required-function-missing':
        const funcName = issue.message.match(/:\s*(\w+)/)?.[1] || 'requiredFunction';
        fixes.push(new FixSuggestion({
          type: FixType.INSERT_BEFORE,
          description: `添加缺失的必需函数: ${funcName}`,
          issueId: issue.id,
          line: issue.line || 1,
          fixedCode: `
/**
 * ${funcName} - 按规格要求实现
 * TODO: 完善函数实现
 */
export function ${funcName}() {
  // Implementation needed
  throw new Error('Not implemented');
}`,
          confidence: ConfidenceLevel.HIGH,
          autoApplicable: true,
          category: 'spec_compliance'
        }));
        break;

      case 'forbidden-api-used':
        fixes.push(new FixSuggestion({
          type: FixType.REFACTOR,
          description: `替换禁止使用的API为允许的替代方案`,
          issueId: issue.id,
          line: issue.line,
          confidence: ConfidenceLevel.MEDIUM,
          autoApplicable: false,
          category: 'spec_compliance'
        }));
        break;

      default:
        fixes.push(this._generateGenericFix(code, issue));
    }

    return fixes;
  }

  // ==================== 通用修复生成 ====================

  /**
   * 通用修复建议（当没有专用策略时）
   * @private
   */
  _generateGenericFix(code, issue) {
    const lineNum = issue.line;
    const originalLine = lineNum ? this._getLine(code, lineNum) : null;

    return new FixSuggestion({
      type: issue.severity === Severity.CRITICAL ? FixType.REPLACE : FixType.REFACTOR,
      description: issue.suggestion || `修复: ${issue.message}`,
      issueId: issue.id,
      line: lineNum,
      originalCode: originalLine?.trim() || null,
      fixedCode: issue.suggestion ? `// TODO: ${issue.suggestion}` : null,
      confidence: issue.severity === Severity.CRITICAL ? ConfidenceLevel.HIGH :
                issue.severity === Severity.MAJOR ? ConfidenceLevel.MEDIUM :
                ConfidenceLevel.LOW,
      autoApplicable: issue.severity === Severity.CRITICAL,
      category: issue.category,
      reasoning: `基于问题 "${issue.message}" 生成的修复建议`
    });
  }

  // ==================== 工具方法 ====================

  /**
   * 获取指定行的内容
   * @private
   */
  _getLine(code, lineNumber) {
    if (!lineNumber || lineNumber < 1) return null;
    const lines = code.split('\n');
    return lines[lineNumber - 1] || null;
  }

  /**
   * 应用所有安全的高置信度修复，生成patch预览
   * @private
   */
  _applySafeFixes(code, suggestions) {
    let patchedCode = code;
    const appliedFixes = suggestions.filter(
      s => s.autoApplicable && s.confidence === ConfidenceLevel.HIGH
    );

    // 按行号倒序应用，避免行号偏移问题
    const sortedFixes = [...appliedFixes]
      .filter(f => f.line)
      .sort((a, b) => b.line - a.line);

    for (const fix of sortedFixes) {
      try {
        patchedCode = fix.apply(patchedCode);
      } catch (e) {
        console.warn(chalk.yellow(`  ⚠️ 无法应用修复 ${fix.id}: ${e.message}`));
      }
    }

    return patchedCode;
  }

  /**
   * 为魔法数字建议常量名
   * @private
   */
  _suggestConstantName(number, context) {
    const num = parseInt(number);

    // 常见数字的模式匹配
    const commonPatterns = {
      '60': 'TIMEOUT_SECONDS',
      '100': 'MAX_ITEMS',
      '1000': 'PAGE_SIZE',
      '1024': 'BUFFER_SIZE',
      '2048': 'MAX_LENGTH',
      '3600': 'HOUR_IN_SECONDS',
      '86400': 'DAY_IN_SECONDS',
      '30': 'DEFAULT_PAGE_SIZE',
      '10': 'DEFAULT_LIMIT',
      '5': 'MAX_RETRIES',
      '3': 'DEFAULT_RETRIES',
      '0': 'ZERO',
      '1': 'ONE',
      '-1': 'ERROR_CODE'
    };

    if (commonPatterns[number]) {
      return commonPatterns[number];
    }

    // 根据上下文推测
    if (context?.category === 'performance') {
      return `PERFORMANCE_THRESHOLD_${number}`;
    }
    if (context?.rule?.includes('timeout')) {
      return `TIMEOUT_MS_${number}`;
    }
    if (context?.rule?.includes('limit')) {
      return `MAX_LIMIT_${number}`;
    }

    return `MAGIC_NUMBER_${number}`;
  }

  /**
   * 初始化内置修复策略
   * @private
   */
  _initStrategies() {
    return {
      // 安全相关
      'sql-injection-template': { handler: (c, i, s) => this._fixSqlInjection(c, i), priority: 1 },
      'sql-injection-concat': { handler: (c, i, s) => this._fixSqlInjection(c, i), priority: 1 },
      'sql-injection-array': { handler: (c, i, s) => this._fixSqlInjection(c, i), priority: 1 },
      'xss-innerHTML': { handler: (c, i, s) => this._fixXss(c, i), priority: 1 },
      'xss-document-write': { handler: (c, i, s) => this._fixXss(c, i), priority: 1 },
      'xss-jquery-html-concat': { handler: (c, i, s) => this._fixXss(c, i), priority: 1 },
      'hardcoded-password': { handler: (c, i, s) => this._fixHardcodedSecret(c, i), priority: 1 },
      'hardcoded-api-key': { handler: (c, i, s) => this._fixHardcodedSecret(c, i), priority: 1 },
      'hardcoded-secret': { handler: (c, i, s) => this._fixHardcodedSecret(c, i), priority: 1 },
      'hardcoded-connection-string': { handler: (c, i, s) => this._fixHardcodedSecret(c, i), priority: 1 },
      'no-eval': { handler: (c, i, s) => this._fixEval(c, i), priority: 1 },

      // 性能相关
      'no-sync-in-loop': { handler: (c, i, s) => this._fixPerformanceIssue(c, i), priority: 2 },
      'n-plus-one-query': { handler: (c, i, s) => this._fixPerformanceIssue(c, i), priority: 2 },
      'event-listener-leak': { handler: (c, i, s) => this._fixPerformanceIssue(c, i), priority: 2 },
      'large-array-chain': { handler: (c, i, s) => this._fixPerformanceIssue(c, i), priority: 3 },

      // 风格相关
      'max-line-length': { handler: (c, i, s) => this._fixStyleIssue(c, i), priority: 3 },
      'no-console-log': { handler: (c, i, s) => this._fixStyleIssue(c, i), priority: 3 },
      'no-magic-numbers': { handler: (c, i, s) => this._fixStyleIssue(c, i), priority: 3 },
      'semi-style': { handler: (c, i, s) => this._fixStyleIssue(c, i), priority: 4 },

      // 逻辑相关
      'max-nesting-depth': { handler: (c, i, s) => this._fixLogicIssue(c, i), priority: 2 },
      'max-function-length': { handler: (c, i, s) => this._fixLogicIssue(c, i), priority: 2 },
      'no-duplicated-code': { handler: (c, i, s) => this._fixLogicIssue(c, i), priority: 2 },

      // 规格相关
      'required-function-missing': { handler: (c, i, s) => this._fixSpecViolation(c, i), priority: 1 },
      'required-export-missing': { handler: (c, i, s) => this._fixSpecViolation(c, i), priority: 1 },
      'forbidden-api-used': { handler: (c, i, s) => this._fixSpecViolation(c, i), priority: 1 },

      // 默认策略
      'default': { handler: (c, i, s) => [this._generateGenericFix(c, i)], priority: 99 }
    };
  }

  /**
   * 更新运行统计
   * @private
   */
  _updateStats(result) {
    this.stats.totalFixSessions++;
    this.stats.totalSuggestionsGenerated += result.suggestions.length;
    this.stats.avgSuggestionsPerIssue =
      result.suggestions.length / Math.max(1, result.suggestions.length);
  }

  /**
   * 获取统计信息
   * @returns {Object}
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 重置统计
   */
  resetStats() {
    this.stats = {
      totalFixSessions: 0,
      totalSuggestionsGenerated: 0,
      avgSuggestionsPerIssue: 0
    };
  }

  /**
   * 导出修复报告为Markdown格式
   * @param {FixResult} fixResult - 修复结果
   * @returns {string} Markdown文本
   */
  exportMarkdownReport(fixResult) {
    const summary = fixResult.getSummary();
    let md = '# 代码修复建议报告\n\n';
    md += `**生成时间**: ${new Date().toLocaleString()}\n\n`;
    md += `## 概览\n\n`;
    md += `- 总建议数: ${summary.totalSuggestions}\n`;
    md += `- 可自动应用: ${summary.autoApplied}\n`;
    md += `- 需人工审核: ${summary.manualReview}\n\n`;

    md += `## 详细建议\n\n`;

    for (const sug of fixResult.suggestions) {
      const icon = sug.confidence === ConfidenceLevel.HIGH ? '🟢' :
                   sug.confidence === ConfidenceLevel.MEDIUM ? '🟡' : '🔴';
      md += `### ${icon} ${sug.description}\n\n`;
      md += `- **类型**: ${sug.type}\n`;
      md += `- **置信度**: ${sug.confidence}\n`;
      md += `- **可自动应用**: ${sug.autoApplicable ? '是' : '否'}\n`;
      if (sug.line) md += `- **位置**: 第${sug.line}行\n`;
      if (sug.originalCode) {
        md += `- **原代码**:\n\`\`\`\n${sug.originalCode}\n\`\`\`\n`;
      }
      if (sug.fixedCode) {
        md += `- **修复后**:\n\`\`\`\n${sug.fixedCode}\n\`\`\`\n`;
      }
      if (sug.reasoning) md += `- **理由**: ${sug.reasoning}\n`;
      if (sug.risks?.length > 0) {
        md += `- **潜在风险**:\n`;
        for (const risk of sug.risks) {
          md += `  - ${risk}\n`;
        }
      }
      md += '\n---\n\n';
    }

    return md;
  }
}

/**
 * 默认导出
 */
export default AutoFixer;
