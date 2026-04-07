// lib/quality/scorer.js - Code Quality Scorer (五维评分引擎)
// 对代码进行五维度质量评估: 可读性/可维护性/健壮性/性能/安全性

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_DIR = path.join(__dirname, 'rules');

/**
 * 质量评级标准
 */
export const GRADES = {
  S: { minScore: 95, label: '卓越', color: '#FFD700', description: '代码质量卓越，接近完美' },
  A: { minScore: 85, label: '优秀', color: '#4CAF50', description: '代码质量优秀，符合最佳实践' },
  B: { minScore: 70, label: '良好', color: '#2196F3', description: '代码质量良好，有少量可优化项' },
  C: { minScore: 55, label: '及格', color: '#FF9800', description: '代码质量一般，需要改进' },
  D: { minScore: 40, label: '较差', color: '#F44336', description: '代码质量较差，建议重构' },
  F: { minScore: 0, label: '不合格', color: '#9E9E9E', description: '代码质量不合格，必须重构' }
};

/**
 * QualityScorer - 代码质量五维评分引擎
 *
 * 五个评估维度：
 * - readability (20%): 可读性 - 命名规范、注释质量、代码复杂度
 * - maintainability (20%): 可维护性 - 模块化程度、DRY原则、耦合度
 * - robustness (25%): 健壮性 - 错误处理、边界条件、异常覆盖
 * - performance (15%): 性能 - 算法效率、资源使用、I/O操作
 * - security (20%): 安全性 - 输入验证、权限控制、敏感数据处理
 *
 * 使用示例：
 * ```js
 * const scorer = new QualityScorer();
 *
 * // 单文件评分
 * const result = await scorer.scoreFile('src/utils/helper.js');
 * console.log(result.grade, result.weightedScore);
 *
 * // 目录批量评分
 * const dirResult = await scorer.scoreDirectory('src/');
 * console.log(dirResult.summary);
 *
 * // 自定义规则集
 * scorer.registerRule('custom', myCustomRule);
 * ```
 */
export class QualityScorer {
  /**
   * 创建评分引擎实例
   * @param {Object} config - 配置选项
   * @param {Object} config.dimensions - 自定义维度权重配置
   * @param {Array<string>} config.enabledRules - 启用的规则列表（默认全部启用）
   * @param {number} config.maxFileSizeKB - 最大文件大小限制(KB)（默认500）
   */
  constructor(config = {}) {
    this.dimensions = {
      readability: {
        weight: config.dimensions?.readability?.weight || 0.20,
        maxScore: 100,
        label: '可读性',
        description: '命名规范、注释质量、代码复杂度'
      },
      maintainability: {
        weight: config.dimensions?.maintainability?.weight || 0.20,
        maxScore: 100,
        label: '可维护性',
        description: '模块化程度、DRY原则、耦合度'
      },
      robustness: {
        weight: config.dimensions?.robustness?.weight || 0.25,
        maxScore: 100,
        label: '健壮性',
        description: '错误处理、边界条件、异常覆盖'
      },
      performance: {
        weight: config.dimensions?.performance?.weight || 0.15,
        maxScore: 100,
        label: '性能',
        description: '算法效率、资源使用、I/O操作'
      },
      security: {
        weight: config.dimensions?.security?.weight || 0.20,
        maxScore: 100,
        label: '安全性',
        description: '输入验证、权限控制、敏感数据'
      }
    };

    this.enabledRules = config.enabledRules || null; // null表示全部启用
    this.maxFileSizeKB = config.maxFileSizeKB || 500;

    // 规则注册表
    this.rules = {};
    this._loadRules();
  }

  /**
   * 对单个文件进行完整五维评分
   * @param {string} filePath - 文件绝对路径或相对路径
   * @returns {Promise<Object>} 评分结果
   */
  async scoreFile(filePath) {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      return this._errorResult(filePath, 'FILE_NOT_FOUND');
    }

    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) {
      return this._errorResult(filePath, 'NOT_A_FILE');
    }

    const fileSizeKB = stat.size / 1024;
    if (fileSizeKB > this.maxFileSizeKB) {
      return this._errorResult(filePath, 'FILE_TOO_LARGE', `文件${Math.round(fileSizeKB)}KB超过限制${this.maxFileSizeKB}KB`);
    }

    const code = fs.readFileSync(absolutePath, 'utf-8');
    const ext = path.extname(absolutePath).toLowerCase();

    // 执行各维度评分
    const dimensionScores = {};

    for (const [dimName, dimConfig] of Object.entries(this.dimensions)) {
      dimensionScores[dimName] = await this.scoreDimension(code, dimName, ext);
    }

    // 计算加权总分
    const weightedScore = this.getWeightedScore(dimensionScores);
    const grade = this.getGrade(weightedScore);
    const recommendations = this.getRecommendations(dimensionScores);

    return {
      success: true,
      file: {
        path: absolutePath,
        name: path.basename(absolutePath),
        extension: ext,
        sizeBytes: stat.size,
        sizeKB: Math.round(fileSizeKB * 10) / 10,
        lineCount: code.split('\n').length
      },
      dimensions: dimensionScores,
      weightedScore: Math.round(weightedScore * 100) / 100,
      grade,
      gradeLabel: GRADES[grade].label,
      recommendations,
      scoredAt: new Date().toISOString()
    };
  }

  /**
   * 对目录进行批量评分
   * @param {string} dirPath - 目录路径
   * @param {Object} options - 选项
   * @param {Array<string>} options.extensions - 文件扩展名过滤（默认 ['.js','.ts','.jsx','.tsx']）
   * @param {boolean} options.recursive - 是否递归子目录（默认true）
   * @param {boolean} options.excludeNodeModules - 是否排除node_modules（默认true）
   * @returns {Promise<Object>}
   */
  async scoreDirectory(dirPath, options = {}) {
    const absoluteDir = path.resolve(dirPath);

    if (!fs.existsSync(absoluteDir)) {
      return { success: false, error: 'DIRECTORY_NOT_FOUND', path: absoluteDir };
    }

    const extensions = options.extensions || ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];
    const recursive = options.recursive !== false;
    const excludeNodeModules = options.excludeNodeModules !== false;

    // 收集文件列表
    const files = this._collectFiles(absoluteDir, extensions, recursive, excludeNodeModules);

    if (files.length === 0) {
      return {
        success: true,
        directory: absoluteDir,
        fileCount: 0,
        message: '未找到可评分的源代码文件',
        results: [],
        summary: null
      };
    }

    // 逐文件评分
    const results = [];
    let totalWeightedScore = 0;
    let validResults = 0;
    const gradeDistribution = { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 };
    const dimensionAverages = {};

    for (const filePath of files) {
      try {
        const result = await this.scoreFile(filePath);
        results.push(result);

        if (result.success) {
          totalWeightedScore += result.weightedScore;
          validResults++;
          gradeDistribution[result.grade]++;

          // 累加各维度分数
          for (const [dimName, dimScore] of Object.entries(result.dimensions)) {
            if (!dimensionAverages[dimName]) {
              dimensionAverages[dimName] = { total: 0, count: 0 };
            }
            dimensionAverages[dimName].total += dimScore.score;
            dimensionAverages[dimName].count++;
          }
        }
      } catch (e) {
        results.push({
          success: false,
          file: filePath,
          error: e.message
        });
      }
    }

    // 计算汇总统计
    const avgScore = validResults > 0 ? totalWeightedScore / validResults : 0;
    const avgGrade = this.getGrade(avgScore);

    const summaryDimensions = {};
    for (const [dimName, data] of Object.entries(dimensionAverages)) {
      summaryDimensions[dimName] = {
        average: Math.round((data.total / data.count) * 100) / 100,
        fileCount: data.count
      };
    }

    return {
      success: true,
      directory: absoluteDir,
      fileCount: files.length,
      scoredCount: validResults,
      failCount: files.length - validResults,
      results,
      summary: {
        averageScore: Math.round(avgScore * 100) / 100,
        grade: avgGrade,
        gradeLabel: GRADES[avgGrade].label,
        gradeDistribution,
        dimensions: summaryDimensions,
        topIssues: this._extractTopIssues(results),
        scoredAt: new Date().toISOString()
      }
    };
  }

  /**
   * 对指定维度进行单维度评分
   * @param {string} code - 源代码字符串
   * @param {string} dimension - 维度名称
   * @param {string} ext - 文件扩展名（可选，用于语言适配）
   * @returns {Promise<Object>} 维度评分结果
   */
  async scoreDimension(code, dimension, ext = '.js') {
    if (!this.dimensions[dimension]) {
      return {
        dimension,
        score: 0,
        maxScore: 100,
        error: `未知维度: ${dimension}`,
        details: []
      };
    }

    const rulesForDimension = this._getRulesForDimension(dimension);
    const details = [];
    let totalDeduction = 0;
    let totalMaxDeduction = 0;

    for (const rule of rulesForDimension) {
      try {
        const ruleResult = rule.check(code, ext);
        const deduction = Math.min(ruleResult.deduction, rule.maxScore || 20);

        totalMaxDeduction += deduction;

        if (!ruleResult.passed) {
          totalDeduction += deduction;
          details.push({
            rule: rule.name,
            passed: false,
            deduction,
            message: ruleResult.message,
            suggestion: ruleResult.suggestion || '',
            line: ruleResult.line || null
          });
        } else {
          details.push({
            rule: rule.name,
            passed: true,
            deduction: 0,
            message: ruleResult.message || '通过'
          });
        }
      } catch (e) {
        details.push({
          rule: rule.name,
          passed: false,
          deduction: 0,
          error: `规则执行异常: ${e.message}`
        });
      }
    }

    // 计算维度得分：基础分100减去扣分
    const rawScore = Math.max(0, 100 - totalDeduction);
    const normalizedScore = totalMaxDeduction > 0
      ? rawScore
      : Math.min(100, rawScore + 20); // 无规则时给予基础分

    return {
      dimension,
      label: this.dimensions[dimension].label,
      score: Math.round(normalizedScore * 100) / 100,
      maxScore: 100,
      weight: this.dimensions[dimension].weight,
      details,
      rulesChecked: rulesForDimension.length,
      rulesPassed: details.filter(d => d.passed).length,
      rulesFailed: details.filter(d => !d.passed && !d.error).length
    };
  }

  /**
   * 计算加权总分
   * @param {Object} dimensionScores - 各维度评分结果
   * @returns {number} 加权总分 (0-100)
   */
  getWeightedScore(dimensionScores) {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const [dimName, dimResult] of Object.entries(dimensionScores)) {
      const weight = this.dimensions[dimName]?.weight || 0;
      const score = dimResult.score || 0;
      weightedSum += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * 根据分数获取等级
   * @param {number} score - 加权总分
   * @returns {string} 等级标识 (S/A/B/C/D/F)
   */
  getGrade(score) {
    if (score >= GRADES.S.minScore) return 'S';
    if (score >= GRADES.A.minScore) return 'A';
    if (score >= GRADES.B.minScore) return 'B';
    if (score >= GRADES.C.minScore) return 'C';
    if (score >= GRADES.D.minScore) return 'D';
    return 'F';
  }

  /**
   * 根据各维度分数生成改进建议
   * @param {Object} dimensionScores - 各维度评分结果
   * @returns {Array<Object>} 建议列表
   */
  getRecommendations(dimensionScores) {
    const recommendations = [];

    for (const [dimName, dimResult] of Object.entries(dimensionScores)) {
      if ((dimResult.score || 0) < 70) {
        const failedDetails = (dimResult.details || []).filter(d => !d.passed && !d.error);

        recommendations.push({
          priority: dimResult.score < 50 ? 'high' : 'medium',
          dimension: dimName,
          dimensionLabel: this.dimensions[dimName]?.label || dimName,
          currentScore: dimResult.score,
          targetScore: 75,
          issues: failedDetails.slice(0, 5).map(d => ({
            rule: d.rule,
            message: d.message,
            suggestion: d.suggestion
          })),
          suggestion: this._generateDimensionSuggestion(dimName, failedDetails)
        });
      }
    }

    // 按优先级排序
    recommendations.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });

    return recommendations;
  }

  /**
   * 注册自定义规则
   * @param {string} dimension - 规则所属维度
   * @param {Object} rule - 规则对象 { name, check(code), maxScore, description }
   */
  registerRule(dimension, rule) {
    if (!rule.name || typeof rule.check !== 'function') {
      throw new Error('规则必须包含name属性和check方法');
    }
    if (!this.rules[dimension]) {
      this.rules[dimension] = [];
    }
    this.rules[dimension].push(rule);
  }

  /**
   * 导出评分结果为JSON格式
   * @param {Object} result - 评分结果对象
   * @param {string} outputPath - 输出路径（可选，不传则返回字符串）
   * @returns {Promise<string|void>}
   */
  async exportJSON(result, outputPath) {
    const jsonStr = JSON.stringify(result, null, 2);
    if (outputPath) {
      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, jsonStr, 'utf-8');
      return outputPath;
    }
    return jsonStr;
  }

  // ==================== 私有方法 ====================

  /**
   * 加载所有内置规则
   * @private
   */
  _loadRules() {
    const dimensionMap = {
      'readability': 'readability',
      'maintainability': 'maintainability',
      'robustness': 'robustness',
      'performance': 'performance',
      'security': 'security'
    };

    for (const [dimKey, ruleFile] of Object.entries(dimensionMap)) {
      try {
        const rulePath = path.join(RULES_DIR, `${ruleFile}.js`);
        if (fs.existsSync(rulePath)) {
          const module = await import(rulePath);
          if (module.default && Array.isArray(module.default)) {
            this.rules[dimKey] = module.default;
          } else if (module.rules && Array.isArray(module.rules)) {
            this.rules[dimKey] = module.rules;
          }
        }
      } catch (e) {
        // 规则加载失败时使用空数组
        this.rules[dimKey] = [];
      }
    }
  }

  /**
   * 获取指定维度的所有规则
   * @private
   */
  _getRulesForDimension(dimension) {
    let rules = this.rules[dimension] || [];

    // 如果设置了启用的规则过滤器
    if (this.enabledRules && Array.isArray(this.enabledRules)) {
      rules = rules.filter(r => this.enabledRules.includes(r.name));
    }

    return rules;
  }

  /**
   * 收集目录下的文件列表
   * @private
   */
  _collectFiles(dir, extensions, recursive, excludeNodeModules) {
    const files = [];

    function walk(currentDir) {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);

          if (excludeNodeModules && entry.name === 'node_modules') continue;
          if (entry.name.startsWith('.') && entry.name !== '.') continue;

          if (entry.isDirectory() && recursive) {
            walk(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (e) {
        // 忽略无权限访问的目录
      }
    }

    walk(dir);
    return files;
  }

  /**
   * 生成错误结果
   * @private
   */
  _errorResult(filePath, errorCode, detail = '') {
    return {
      success: false,
      file: { path: path.resolve(filePath), name: path.basename(filePath) },
      error: errorCode,
      detail,
      dimensions: {},
      weightedScore: 0,
      grade: 'F',
      recommendations: []
    };
  }

  /**
   * 提取最常见的问题
   * @private
   */
  _extractTopIssues(results) {
    const issueCount = {};

    for (const result of results) {
      if (!result.success || !result.recommendations) continue;
      for (const rec of result.recommendations) {
        for (const issue of rec.issues) {
          const key = `${rec.dimension}:${issue.rule}`;
          issueCount[key] = (issueCount[key] || 0) + 1;
        }
      }
    }

    return Object.entries(issueCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => ({
        issue: key,
        occurrences: count
      }));
  }

  /**
   * 为维度生成改进建议
   * @private
   */
  _generateDimensionSuggestion(dimension, failedDetails) {
    const suggestions = {
      readability: '建议改善命名规范、增加必要注释、降低函数复杂度、控制单行长度',
      maintainability: '建议提取重复逻辑为公共方法、降低模块间耦合、遵循单一职责原则',
      robustness: '建议完善null/undefined检查、添加异常处理、校验输入参数边界值',
      performance: '建议优化循环嵌套、减少不必要的内存分配、使用高效的数据结构',
      security: '建议对用户输入进行严格校验、避免硬编码敏感信息、使用参数化查询'
    };

    return suggestions[dimension] || '请参考具体规则的改进建议进行优化';
  }
}

export default QualityScorer;
