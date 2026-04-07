// lib/iteration/controller.js - Iteration Controller
// 控制多轮优化迭代：每轮自动审查 -> 修复 -> 验证循环
// 集成eval-runner.js进行验证评分

import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import { AutoReviewer } from './auto-reviewer.js';
import { AutoFixer } from './auto-fixer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 迭代状态枚举
 */
export const IterationStatus = {
  IDLE: 'idle',
  REVIEWING: 'reviewing',
  FIXING: 'fixing',
  VERIFYING: 'verifying',
  CONVERGED: 'converged',
  MAX_ROUNDS_REACHED: 'max_rounds_reached',
  ERROR: 'error'
};

/**
 * 问题严重级别
 */
export const Severity = {
  CRITICAL: 'critical',   // 阻塞性问题，必须修复
  MAJOR: 'major',         // 重要问题，强烈建议修复
  MINOR: 'minor',         // 次要问题，建议修复
  INFO: 'info'            // 信息性提示
};

/**
 * 单轮迭代结果
 */
class RoundResult {
  constructor(roundNumber) {
    this.round = roundNumber;
    this.status = IterationStatus.IDLE;
    this.startTime = Date.now();
    this.endTime = null;
    this.duration = null;
    this.issues = [];              // 审查发现的问题列表
    this.fixSuggestions = [];      // 修复建议列表
    this.score = null;             // 本轮验证得分 (0-100)
    this.previousScore = null;     // 上一轮得分
    this.improvement = null;       // 改进幅度 (百分比)
    this.codeVersion = null;       // 当前代码版本快照
    this.convergenceReason = null; // 收敛原因（如果已收敛）
  }

  finalize() {
    this.endTime = Date.now();
    this.duration = this.endTime - this.startTime;
  }
}

/**
 * IterationController - 多轮迭代优化控制器
 *
 * 核心循环:
 *   Round 1: review(initialCode) -> issues -> fix -> verify -> score
 *   Round N: if improvement > threshold -> continue else stop
 *
 * 安全原则:
 *   - 自动修复只生成建议，不直接修改源码
 *   - 每轮都有完整的审查-修复-验证记录
 *   - 收敛检测防止无限循环
 */
export class IterationController {
  /**
   * @param {Object} config - 配置选项
   * @param {number} config.maxRounds - 最大迭代轮数 (默认5)
   * @param {number} config.convergenceThreshold - 收敛阈值，改进<此值则停止 (默认0.05即5%)
   * @param {number} config.minScore - 最低可接受分数 (默认60)
   * @param {boolean} config.verbose - 详细输出模式 (默认false)
   * @param {Object} config.reviewerConfig - 审查器配置
   * @param {Object} config.fixerConfig - 修复器配置
   */
  constructor(config = {}) {
    this.maxRounds = config.maxRounds || 5;
    this.convergenceThreshold = config.convergenceThreshold || 0.05; // 5%
    this.minScore = config.minScore || 60;
    this.verbose = config.verbose || false;

    // 初始化子模块
    this.reviewer = new AutoReviewer(config.reviewerConfig || {});
    this.fixer = new AutoFixer(config.fixerConfig || {});

    // 状态跟踪
    this.roundResults = [];
    this.currentRound = 0;
    this.status = IterationStatus.IDLE;
    this.initialCode = null;
    this.currentCode = null;
    this.spec = null;
  }

  /**
   * 执行多轮迭代优化
   *
   * @param {string} initialCode - 初始代码
   * @param {Object} spec - 开发规格/验收标准
   * @param {Function} [verifyFn] - 自定义验证函数 (可选，用于集成外部验证器如eval-runner)
   * @returns {Promise<Object>} 迭代结果 { rounds, finalScore, improvements, converged, summary }
   */
  async runIteration(initialCode, spec, verifyFn) {
    // 参数校验
    if (!initialCode || typeof initialCode !== 'string') {
      throw new Error('initialCode必须是非空字符串');
    }
    if (!spec || typeof spec !== 'object') {
      throw new Error('spec必须是有效的规格对象');
    }

    // 初始化状态
    this.initialCode = initialCode;
    this.currentCode = initialCode;
    this.spec = spec;
    this.roundResults = [];
    this.currentRound = 0;
    this.status = IterationStatus.REVIEWING;

    console.log(chalk.blue.bold('\n🔄 Iteration Controller - 多轮迭代优化启动\n'));
    console.log(`  最大轮数: ${this.maxRounds}`);
    console.log(`  收敛阈值: ${(this.convergenceThreshold * 100).toFixed(1)}%`);
    console.log(`  最低分数: ${this.minScore}`);
    console.log(`  初始代码长度: ${initialCode.length} 字符`);

    try {
      // 主迭代循环
      while (this.currentRound < this.maxRounds) {
        const shouldContinue = await this._executeRound(verifyFn);
        if (!shouldContinue) break;
      }

      // 生成最终报告
      return this._generateFinalResult();

    } catch (error) {
      this.status = IterationStatus.ERROR;
      console.error(chalk.red(`\n❌ 迭代过程出错: ${error.message}`));
      throw error;
    }
  }

  /**
   * 执行单轮迭代: 审查 -> 修复建议 -> 验证评分
   * @private
   */
  async _executeRound(verifyFn) {
    this.currentRound++;
    const round = new RoundResult(this.currentRound);
    this.roundResults.push(round);

    console.log(chalk.cyan.bold(`\n━━━ Round ${this.currentRound}/${this.maxRounds} ━━━`));

    // Step 1: 自动审查
    round.status = IterationStatus.REVIEWING;
    console.log(chalk.yellow('  📋 Step 1: 自动审查...'));

    const reviewResult = await this.reviewer.review(this.currentCode, this.spec);
    round.issues = reviewResult.issues;
    round.codeVersion = reviewResult.codeHash;

    this._printReviewSummary(reviewResult);

    // 检查是否无问题（完美代码）
    if (round.issues.length === 0) {
      round.status = IterationStatus.CONVERGED;
      round.convergenceReason = 'no_issues';
      round.finalize();
      console.log(chalk.green('  ✅ 未发现任何问题，代码质量达标'));
      return false; // 停止迭代
    }

    // Step 2: 生成修复建议
    round.status = IterationStatus.FIXING;
    console.log(chalk.yellow('\n  🔧 Step 2: 生成修复建议...'));

    const fixResult = this.fixer.generateFixes(this.currentCode, round.issues, this.spec);
    round.fixSuggestions = fixResult.suggestions;

    this._printFixSummary(fixResult);

    // 应用修复到当前代码（生成新版本供下一轮使用）
    // 注意：这里只是模拟应用，实际不会修改原始源码
    if (fixResult.patchedCode && verifyFn) {
      this.currentCode = fixResult.patchedCode;
    }

    // Step 3: 验证评分
    round.status = IterationStatus.VERIFYING;
    console.log(chalk.yellow('\n  🧪 Step 3: 验证评分...'));

    let score;
    if (typeof verifyFn === 'function') {
      // 使用自定义验证函数（如集成eval-runner）
      score = await verifyFn(this.currentCode, this.spec, round);
    } else {
      // 使用内置基础评分
      score = this._basicScore(round);
    }

    round.previousScore = this._getPreviousScore();
    round.score = score.value;
    round.improvement = round.previousScore !== null
      ? ((score.value - round.previousScore) / Math.max(round.previousScore, 1)) * 100
      : null;

    this._printScoreSummary(round);

    round.finalize();

    // 判断是否继续迭代
    return this.shouldContinue(round);
  }

  /**
   * 判断是否继续迭代
   * @param {RoundResult} roundResult - 当前轮次结果
   * @returns {boolean} 是否继续
   */
  shouldContinue(roundResult) {
    // 条件1: 达到最高分（100分）
    if (roundResult.score >= 100) {
      roundResult.status = IterationStatus.CONVERGED;
      roundResult.convergenceReason = 'perfect_score';
      console.log(chalk.green('\n  🎯 达到满分，迭代收敛！'));
      return false;
    }

    // 条件2: 超过目标分数且改进幅度低于阈值
    if (roundResult.score >= this.minScore && roundResult.improvement !== null) {
      if (Math.abs(roundResult.improvement) < this.convergenceThreshold * 100) {
        roundResult.status = IterationStatus.CONVERGED;
        roundResult.convergenceReason = 'converged';
        console.log(chalk.green(`\n  📊 改进幅度(${roundResult.improvement.toFixed(2)}%)低于阈值(${(this.convergenceThreshold * 100).toFixed(1)}%)，迭代收敛`));
        return false;
      }
    }

    // 条件3: 分数下降（退化）
    if (roundResult.improvement !== null && roundResult.improvement < -10) {
      console.log(chalk.yellow(`\n  ⚠️ 分数明显下降(${roundResult.improvement.toFixed(2)}%)，可能过度修复`));
      // 继续但发出警告
    }

    // 条件4: 达到最大轮数
    if (this.currentRound >= this.maxRounds) {
      roundResult.status = IterationStatus.MAX_ROUNDS_REACHED;
      roundResult.convergenceReason = 'max_rounds';
      console.log(chalk.yellow(`\n  ⏹️ 达到最大轮数(${this.maxRounds})，停止迭代`));
      return false;
    }

    console.log(chalk.cyan(`\n  ➡️ 继续第${this.currentRound + 1}轮迭代...`));
    return true;
  }

  /**
   * 获取上一轮的分数
   * @private
   */
  _getPreviousScore() {
    if (this.roundResults.length <= 1) return null;
    return this.roundResults[this.roundResults.length - 2].score;
  }

  /**
   * 内置基础评分算法
   * @private
   */
  _basicScore(round) {
    const issues = round.issues;
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case Severity.CRITICAL:
          score -= 25;
          break;
        case Severity.MAJOR:
          score -= 15;
          break;
        case Severity.MINOR:
          score -= 5;
          break;
        case Severity.INFO:
          score -= 1;
          break;
      }
    }

    // 奖励：有修复建议说明问题可解决
    const fixCount = round.fixSuggestions?.length || 0;
    if (fixCount > 0 && issues.length > 0) {
      score += Math.min(fixCount * 2, 10); // 最多加10分
    }

    return {
      value: Math.max(0, Math.min(100, score)),
      details: {
        issueCount: issues.length,
        fixSuggestionCount: fixCount,
        severityBreakdown: this._countBySeverity(issues)
      }
    };
  }

  /**
   * 按严重程度统计问题数量
   * @private
   */
  _countBySeverity(issues) {
    const counts = {};
    for (const sev of Object.values(Severity)) {
      counts[sev] = issues.filter(i => i.severity === sev).length;
    }
    return counts;
  }

  /**
   * 打印审查摘要
   * @private
   */
  _printReviewSummary(reviewResult) {
    const { issues, metrics } = reviewResult;

    console.log(`  发现 ${chalk.red(issues.length.toString())} 个问题`);

    if (this.verbose && issues.length > 0) {
      for (const issue of issues.slice(0, 10)) {
        const icon = this._severityIcon(issue.severity);
        console.log(`    ${icon} [${issue.severity.toUpperCase()}] ${issue.message}${issue.line ? ` (L${issue.line})` : ''}`);
      }
      if (issues.length > 10) {
        console.log(`    ... 还有 ${issues.length - 10} 个问题`);
      }
    }

    if (metrics) {
      console.log(chalk.gray(`  审查指标: 复杂度=${metrics.complexity?.toFixed(1) || '?'}, 行数=${metrics.lines || '?'}`));
    }
  }

  /**
   * 打印修复摘要
   * @private
   */
  _printFixSummary(fixResult) {
    const { suggestions } = fixResult;

    console.log(`  生成 ${chalk.green(suggestions.length.toString())} 条修复建议`);

    if (this.verbose && suggestions.length > 0) {
      for (const suggestion of suggestions.slice(0, 5)) {
        console.log(`    💡 ${suggestion.type}: ${suggestion.description}`);
      }
      if (suggestions.length > 5) {
        console.log(`    ... 还有 ${suggestions.length - 5} 条建议`);
      }
    }
  }

  /**
   * 打印评分摘要
   * @private
   */
  _printScoreSummary(round) {
    const scoreColor = round.score >= 80 ? chalk.green :
                        round.score >= 60 ? chalk.yellow : chalk.red;

    console.log(`  得分: ${scoreColor.bold(round.score.toFixed(1))}/100`);

    if (round.improvement !== null) {
      const impColor = round.improvement >= 0 ? chalk.green : chalk.red;
      const impSign = round.improvement >= 0 ? '+' : '';
      console.log(`  改进: ${impColor(`${impSign}${round.improvement.toFixed(2)}%)`)}`);
    }

    console.log(`  耗时: ${round.duration}ms`);
  }

  /**
   * 严重程度图标
   * @private
   */
  _severityIcon(severity) {
    switch (severity) {
      case Severity.CRITICAL: return chalk.red('🔴');
      case Severity.MAJOR: return chalk.orange('🟠');
      case Severity.MINOR: return chalk.yellow('🟡');
      case Severity.INFO: return chalk.gray('⚪');
      default: return chalk.gray('·');
    }
  }

  /**
   * 生成最终结果报告
   * @private
   */
  _generateFinalResult() {
    const lastRound = this.roundResults[this.roundResults.length - 1];
    this.status = lastRound.status;

    const totalDuration = this.roundResults.reduce((sum, r) => sum + r.duration, 0);
    const totalIssuesFixed = this.roundResults.reduce((sum, r) => sum + r.issues.length, 0);
    const totalSuggestions = this.roundResults.reduce((sum, r) => sum + r.fixSuggestions.length, 0);

    // 计算总体改进
    const firstScore = this.roundResults[0]?.score || 0;
    const finalScore = lastRound?.score || 0;
    const overallImprovement = firstScore > 0
      ? ((finalScore - firstScore) / firstScore) * 100
      : 0;

    const result = {
      rounds: this.currentRound,
      finalScore,
      firstScore,
      overallImprovement,
      converged: this.status === IterationStatus.CONVERGED,
      convergenceReason: lastRound?.convergenceReason,
      status: this.status,

      // 统计信息
      totalIssuesFound: totalIssuesFixed,
      totalFixSuggestions: totalSuggestions,
      totalDuration,

      // 详细轮次数据
      roundDetails: this.roundResults.map(r => ({
        round: r.round,
        status: r.status,
        score: r.score,
        improvement: r.improvement,
        issueCount: r.issues.length,
        fixCount: r.fixSuggestions.length,
        duration: r.duration
      })),

      // 最终修复建议汇总
      allFixSuggestions: this.roundResults.flatMap(r => r.fixSuggestions),

      // 进度报告
      progressReport: this.getProgressReport()
    };

    // 输出最终报告
    this._printFinalReport(result);

    return result;
  }

  /**
   * 打印最终报告
   * @private
   */
  _printFinalReport(result) {
    console.log(chalk.bold('\n━━━ Iteration Final Report ━━━'));
    console.log(`  总轮数: ${result.rounds}/${this.maxRounds}`);
    console.log(`  初始得分: ${result.firstScore?.toFixed(1) || '?'}`);
    console.log(`  最终得分: ${chalk.bold(result.finalScore?.toFixed(1) || '?')}/100`);
    console.log(`  总体改进: ${result.overallImprovement >= 0 ? '+' : ''}${result.overallImprovement.toFixed(2)}%`);
    console.log(`  发现问题: ${result.totalIssuesFound}个`);
    console.log(`  修复建议: ${result.totalFixSuggestions}条`);
    console.log(`  总耗时: ${result.totalDuration}ms`);
    console.log(`  状态: ${this._statusText(result.status)}`);
    console.log(`  收敛原因: ${result.convergenceReason || '-'}`);

    if (result.allFixSuggestions.length > 0) {
      console.log(chalk.bold('\n  修复建议汇总:'));
      for (const sug of result.allFixSuggestions.slice(0, 10)) {
        console.log(`    - [${sug.type}] ${sug.description}`);
      }
      if (result.allFixSuggestions.length > 10) {
        console.log(`    ... 还有 ${result.allFixSuggestions.length - 10} 条建议`);
      }
    }
  }

  /**
   * 状态文本
   * @private
   */
  _statusText(status) {
    switch (status) {
      case IterationStatus.CONVERGED: return chalk.green('已收敛 ✅');
      case IterationStatus.MAX_ROUNDS_REACHED: return chalk.yellow('达到最大轮数 ⏹️');
      default: return chalk.gray(status);
    }
  }

  /**
   * 获取迭代进度报告
   * @returns {Object} 进度报告
   */
  getProgressReport() {
    const completed = this.roundResults.filter(r =>
      r.status === IterationStatus.CONVERGED ||
      r.endTime !== null
    ).length;

    return {
      currentRound: this.currentRound,
      maxRounds: this.maxRounds,
      completedRounds: completed,
      progressPercent: (completed / this.maxRounds) * 100,
      status: this.status,

      // 分数趋势
      scoreTrend: this.roundResults.map(r => ({
        round: r.round,
        score: r.score,
        timestamp: r.startTime
      })),

      // 问题趋势
      issueTrend: this.roundResults.map(r => ({
        round: r.round,
        issueCount: r.issues.length,
        bySeverity: this._countBySeverity(r.issues)
      })),

      // 时间消耗
      timeConsumption: this.roundResults.map(r => ({
        round: r.round,
        duration: r.duration,
        phaseBreakdown: {
          reviewing: r.duration ? Math.floor(r.duration * 0.3) : 0,
          fixing: r.duration ? Math.floor(r.duration * 0.4) : 0,
          verifying: r.duration ? Math.floor(r.duration * 0.3) : 0
        }
      }))
    };
  }

  /**
   * 导出迭代历史为JSON（可用于持久化）
   * @returns {string} JSON字符串
   */
  exportHistory() {
    return JSON.stringify({
      metadata: {
        exportedAt: new Date().toISOString(),
        maxRounds: this.maxRounds,
        convergenceThreshold: this.convergenceThreshold
      },
      rounds: this.roundResults.map(r => ({
        ...r,
        codeVersion: r.codeVersion // 不导出完整代码
      })),
      progressReport: this.getProgressReport()
    }, null, 2);
  }

  /**
   * 重置控制器状态
   */
  reset() {
    this.roundResults = [];
    this.currentRound = 0;
    this.status = IterationStatus.IDLE;
    this.initialCode = null;
    this.currentCode = null;
    this.spec = null;
  }
}

/**
 * 默认导出
 */
export default IterationController;
