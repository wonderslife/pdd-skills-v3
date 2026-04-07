/**
 * Code Stats 代码统计插件
 *
 * 在 post-verify 钩子阶段自动统计代码指标：
 * - 总行数 / 有效代码行数 / 注释行数 / 空白行数
 * - 函数/方法数量
 * - 圈复杂度估算（基于 if/for/while/switch/catch 关键字）
 *
 * 同时注册 code-stats 工具，支持手动触发分析。
 *
 * @module code-stats
 * @author PDD Team
 * @version 1.0.0
 */

import { PluginBase } from '../plugin-sdk.js';

/**
 * 代码统计插件类
 *
 * @class CodeStatsPlugin
 * @extends PluginBase
 */
export default class CodeStatsPlugin extends PluginBase {
  constructor() {
    super({
      name: 'code-stats',
      version: '1.0.0',
      description: '代码统计插件 - 统计代码行数、函数数、复杂度等指标',
      author: 'PDD Team',
      license: 'MIT',
      keywords: ['stats', 'metrics', 'analysis'],
      pddVersionRange: '>=1.0.0',
    });
  }

  /**
   * 插件激活时调用
   * 注册钩子和工具
   *
   * @param {import('../plugin-sdk.js').PluginContext} context - 插件上下文
   */
  async onActivate(context) {
    context.logger.info('Code Stats 插件正在激活...');

    // 注册 post-verify 钩子：在验证完成后自动执行统计
    this.registerHook('post-verify', async (verifyResult) => {
      context.logger.info('[code-stats] 开始执行 post-verify 统计...');

      const stats = await this._analyzeCode(verifyResult);

      context.logger.info(`[code-stats] 统计完成 - 行数: ${stats.totalLines}, 函数: ${stats.functionCount}, 复杂度: ${stats.complexity}`);

      // 将统计数据追加到验证结果中
      return {
        ...verifyResult,
        codeStats: stats,
      };
    }, 50); // 较低优先级，在其他钩子之后运行

    // 注册 code-stats 工具
    this.registerTool('code-stats', {
      description: '分析代码文件或目录，返回详细的统计指标',
      execute: async (params) => {
        const target = params.path || params.content;
        if (!target) {
          throw new Error('code-stats 工具需要 path 或 content 参数');
        }

        const result = await this._analyzeCode({
          content: params.content,
          filePath: params.path,
          language: params.language || 'javascript',
        });

        return result;
      },
      schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '要分析的文件路径',
          },
          content: {
            type: 'string',
            description: '要分析的代码内容（与 path 二选一）',
          },
          language: {
            type: 'string',
            description: '编程语言（默认 javascript）',
            enum: ['javascript', 'typescript', 'python', 'java', 'go'],
          },
        },
      },
    });

    context.logger.info(`Code Stats 插件激活成功！已注册钩子: post-verify, 工具: code-stats`);
  }

  /**
   * 分析代码并返回统计指标
   *
   * @param {Object} input - 输入数据
   * @param {string} [input.content] - 代码文本内容
   * @param {string} [input.filePath] - 文件路径
   * @param {string} [input.language] - 编程语言标识
   * @returns {Promise<Object>} 统计结果对象
   * @private
   */
  async _analyzeCode(input) {
    let content = input.content;

    // 如果没有直接提供内容，尝试从文件路径读取
    if (!content && input.filePath) {
      try {
        const fs = await import('node:fs/promises');
        content = await fs.readFile(input.filePath, 'utf-8');
      } catch (err) {
        return {
          error: `无法读取文件: ${err.message}`,
          analyzedAt: new Date().toISOString(),
        };
      }
    }

    if (!content) {
      return {
        error: '无有效输入内容',
        totalLines: 0,
        codeLines: 0,
        commentLines: 0,
        blankLines: 0,
        functionCount: 0,
        complexity: 0,
        analyzedAt: new Date().toISOString(),
      };
    }

    const lines = content.split('\n');
    const language = input.language || this._detectLanguage(input.filePath);

    // 按语言选择注释模式
    const commentPatterns = this._getCommentPatterns(language);

    let codeLines = 0;
    let commentLines = 0;
    let blankLines = 0;
    let inBlockComment = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // 空行检测
      if (trimmed === '') {
        blankLines++;
        continue;
      }

      // 块注释检测
      if (inBlockComment) {
        commentLines++;
        if (trimmed.includes(commentPatterns.blockEnd)) {
          inBlockComment = false;
        }
        continue;
      }

      if (trimmed.startsWith(commentPatterns.blockStart)) {
        commentLines++;
        if (!trimmed.includes(commentPatterns.blockEnd)) {
          inBlockComment = true;
        }
        continue;
      }

      // 单行注释检测
      if (commentPatterns.line.some(p => trimmed.startsWith(p))) {
        commentLines++;
        continue;
      }

      // 有效代码行
      codeLines++;
    }

    // 函数计数
    const functionCount = this._countFunctions(content, language);

    // 圈复杂度估算
    const complexity = this._estimateComplexity(content, language);

    return {
      totalLines: lines.length,
      codeLines,
      commentLines,
      blankLines,
      functionCount,
      complexity,
      commentRatio: lines.length > 0 ? ((commentLines / lines.length) * 100).toFixed(1) + '%' : '0%',
      avgFunctionLength: functionCount > 0 ? Math.round(codeLines / functionCount) : 0,
      language,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * 根据文件扩展名检测编程语言
   * @param {string} [filePath] - 文件路径
   * @returns {string} 语言标识
   * @private
   */
  _detectLanguage(filePath) {
    if (!filePath) return 'javascript';
    const ext = filePath.split('.').pop().toLowerCase();
    const map = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      go: 'go',
    };
    return map[ext] || 'javascript';
  }

  /**
   * 获取指定语言的注释模式
   * @param {string} language - 编程语言
   * @returns {Object} 注释模式配置
   * @private
   */
  _getCommentPatterns(language) {
    const patterns = {
      javascript: {
        line: ['//'],
        blockStart: '/*',
        blockEnd: '*/',
      },
      typescript: {
        line: ['//'],
        blockStart: '/*',
        blockEnd: '*/',
      },
      python: {
        line: ['#'],
        blockStart: '"""',
        blockEnd: '"""',
      },
      java: {
        line: ['//'],
        blockStart: '/*',
        blockEnd: '*/',
      },
      go: {
        line: ['//'],
        blockStart: '/*',
        blockEnd: '*/',
      },
    };
    return patterns[language] || patterns.javascript;
  }

  /**
   * 统计函数/方法数量
   * 使用正则表达式匹配函数声明模式
   *
   * @param {string} content - 代码内容
   * @param {string} language - 编程语言
   * @returns {number} 函数数量
   * @private
   */
  _countFunctions(content, language) {
    const patterns = {
      javascript: /\b(function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(|=>\s*{|\w+\s*\([^)]*\)\s*{)/g,
      typescript: /\b(function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(|(?:public|private|protected|static)\s+\w+\s*\()/g,
      python: /\bdef\s+\w+\s*\(/g,
      java: /\b(public|private|protected|static)?\s*(?:\w+\s)+\w+\s*\(/g,
      go: /\bfunc\s+\w+/g,
    };

    const pattern = patterns[language] || patterns.javascript;
    const matches = content.match(pattern);
    return matches ? matches.length : 0;
  }

  /**
   * 估算圈复杂度
   * 基于 McCabe 度量法，计算决策点数量 + 1
   *
   * @param {string} content - 代码内容
   * @param {string} language - 编程语言
   * @returns {number} 复杂度值
   * @private
   */
  _estimateComplexity(content, language) {
    // 基础复杂度为 1，每个关键字增加 1
    const keywords = [
      '\\bif\\b',
      '\\belse\\b',
      '\\bfor\\b',
      '\\bwhile\\b',
      '\\bswitch\\b',
      '\\bcase\\b',
      '\\bcatch\\b',
      '\\?\\:',           // 三元运算符
      '\\|\\|',           // 逻辑或短路
      '&&',               // 逻辑与短路
    ];

    let complexity = 1; // 基础复杂度

    for (const keyword of keywords) {
      const regex = new RegExp(keyword, 'g');
      const matches = content.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * 插件停用时调用
   * @param {import('../plugin-sdk.js').PluginContext} context - 插件上下文
   */
  async onDeactivate(context) {
    context.logger.info('Code Stats 插件正在停用...');
  }
}
