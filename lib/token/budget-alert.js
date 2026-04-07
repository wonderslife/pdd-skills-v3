// lib/token/budget-alert.js - Token Budget Alert System
// 超预算时的自动预警和处理策略

import chalk from 'chalk';

/**
 * 预警级别枚举
 */
export const ALERT_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical'
};

/**
 * 预警处理策略枚举
 */
export const ALERT_STRATEGIES = {
  LOG_ONLY: 'log_only',           // 仅记录日志
  SOFT_BLOCK: 'soft_block',       // 软阻断（警告但允许继续）
  HARD_BLOCK: 'hard_block',        // 硬阻断（直接拒绝）
  AUTO_SCALE: 'auto_scale'        // 自动降级（降低后续请求的token预算）
};

/**
 * BudgetAlert - Token预算预警系统
 *
 * 职责：
 * - 监控Token使用率，在达到阈值时触发预警
 * - 提供多级预警处理策略（日志/软阻断/硬阻断/自动降级）
 * - 生成结构化的预警报告
 * - 支持自定义预警回调（如发送通知、写入文件等）
 *
 * 使用示例：
 * ```js
 * const alert = new BudgetAlert({
 *   warningThreshold: 0.8,
 *   criticalThreshold: 0.95,
 *   strategy: ALERT_STRATEGIES.SOFT_BLOCK,
 *   onWarning: (data) => sendNotification(data),
 *   onCritical: (data) => emergencyStop(data)
 * });
 * ```
 */
export class BudgetAlert {
  /**
   * 创建预算预警实例
   * @param {Object} config - 配置选项
   * @param {number} config.warningThreshold - 预警阈值（默认0.8）
   * @param {number} config.criticalThreshold - 阻断阈值（默认0.95）
   * @param {string} config.strategy - 处理策略（默认SOFT_BLOCK）
   * @param {Function} config.onWarning - 预警回调
   * @param {Function} config.onCritical - 阻断回调
   * @param {Object} config.manager - 关联的BudgetManager实例
   */
  constructor(config = {}) {
    this.warningThreshold = config.warningThreshold || 0.8;
    this.criticalThreshold = config.criticalThreshold || 0.95;
    this.strategy = config.strategy || ALERT_STRATEGIES.SOFT_BLOCK;
    this.manager = config.manager || null;

    // 自定义回调
    this.onWarningCallback = config.onWarning || null;
    this.onCriticalCallback = config.onCritical || null;

    // 预警历史记录
    this.alertHistory = [];
    // 状态追踪
    this.warningTriggered = false;
    this.criticalTriggered = false;
    this.firstWarningTime = null;
    this.firstCriticalTime = null;

    // 冷却时间（毫秒），防止频繁报警
    this.warningCooldown = config.warningCooldown || 30000;   // 30秒
    this.criticalCooldown = config.criticalCooldown || 10000;  // 10秒
    this.lastWarningTime = 0;
    this.lastCriticalTime = 0;

    // 统计信息
    this.stats = {
      totalWarnings: 0,
      totalCriticals: 0,
      totalBlockedOperations: 0,
      autoScaledCount: 0
    };
  }

  /**
   * 处理预警级别事件
   * @param {Object} data - 消耗数据
   * @returns {Object} 预警结果
   */
  handleWarning(data) {
    const now = Date.now();

    // 检查冷却时间
    if (now - this.lastWarningTime < this.warningCooldown) {
      return { handled: false, reason: 'cooldown' };
    }
    this.lastWarningTime = now;

    if (!this.warningTriggered) {
      this.firstWarningTime = now;
      this.warningTriggered = true;
    }

    const alertRecord = this._createAlertRecord(ALERT_LEVELS.WARNING, data);
    this.alertHistory.push(alertRecord);
    this.stats.totalWarnings++;

    // 输出控制台预警
    this._printWarningAlert(data);

    // 执行策略
    let actionTaken = null;
    switch (this.strategy) {
      case ALERT_STRATEGIES.LOG_ONLY:
        actionTaken = 'logged';
        break;
      case ALERT_STRATEGIES.SOFT_BLOCK:
        actionTaken = 'warned';
        break;
      case ALERT_STRATEGIES.AUTO_SCALE:
        actionTaken = this._applyAutoScale(data);
        break;
      default:
        actionTaken = 'warned';
    }

    // 触发自定义回调
    if (typeof this.onWarningCallback === 'function') {
      try {
        this.onWarningCallback({ ...alertRecord, actionTaken });
      } catch (e) {
        console.error(chalk.red('[BudgetAlert] onWarning回调执行失败:', e.message));
      }
    }

    return {
      handled: true,
      level: ALERT_LEVELS.WARNING,
      record: alertRecord,
      actionTaken,
      shouldContinue: this.strategy !== ALERT_STRATEGIES.HARD_BLOCK
    };
  }

  /**
   * 处理阻断级别事件
   * @param {Object} data - 消耗数据
   * @returns {Object} 阻断结果
   */
  handleCritical(data) {
    const now = Date.now();

    // 检查冷却时间
    if (now - this.lastCriticalTime < this.criticalCooldown) {
      return { handled: false, reason: 'cooldown' };
    }
    this.lastCriticalTime = now;

    if (!this.criticalTriggered) {
      this.firstCriticalTime = now;
      this.criticalTriggered = true;
    }

    const alertRecord = this._createAlertRecord(ALERT_LEVELS.CRITICAL, data);
    this.alertHistory.push(alertRecord);
    this.stats.totalCriticals++;
    this.stats.totalBlockedOperations++;

    // 输出控制台阻断警报
    this._printCriticalAlert(data);

    // 执行策略
    let actionTaken = 'blocked';
    let shouldContinue = false;

    switch (this.strategy) {
      case ALERT_STRATEGIES.LOG_ONLY:
        actionTaken = 'logged';
        shouldContinue = true;
        break;
      case ALERT_STRATEGIES.SOFT_BLOCK:
        actionTaken = 'soft_blocked';
        shouldContinue = false;
        break;
      case ALERT_STRATEGIES.HARD_BLOCK:
        actionTaken = 'hard_blocked';
        shouldContinue = false;
        break;
      case ALERT_STRATEGIES.AUTO_SCALE:
        actionTaken = this._applyAutoScale(data);
        shouldContinue = true; // 自动降级后仍可继续，但用更少tokens
        break;
      default:
        shouldContinue = false;
    }

    // 触发自定义回调
    if (typeof this.onCriticalCallback === 'function') {
      try {
        this.onCriticalCallback({ ...alertRecord, actionTaken });
      } catch (e) {
        console.error(chalk.red('[BudgetAlert] onCritical回调执行失败:', e.message));
      }
    }

    return {
      handled: true,
      level: ALERT_LEVELS.CRITICAL,
      record: alertRecord,
      actionTaken,
      shouldContinue
    };
  }

  /**
   * 获取预警历史记录
   * @param {Object} options - 过滤选项
   * @returns {Array}
   */
  getHistory(options = {}) {
    let filtered = [...this.alertHistory];

    if (options.level) {
      filtered = filtered.filter(a => a.level === options.level);
    }
    if (options.since) {
      filtered = filtered.filter(a => a.timestamp >= options.since);
    }
    if (options.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  /**
   * 获取当前预警状态摘要
   * @returns {Object}
   */
  getStatus() {
    return {
      warningTriggered: this.warningTriggered,
      criticalTriggered: this.criticalTriggered,
      firstWarningTime: this.firstWarningTime ? new Date(this.firstWarningTime).toISOString() : null,
      firstCriticalTime: this.firstCriticalTime ? new Date(this.firstCriticalTime).toISOString() : null,
      currentStrategy: this.strategy,
      stats: { ...this.stats },
      thresholds: {
        warning: this.warningThreshold,
        critical: this.criticalThreshold
      }
    };
  }

  /**
   * 重置预警状态
   */
  reset() {
    this.alertHistory = [];
    this.warningTriggered = false;
    this.criticalTriggered = false;
    this.firstWarningTime = null;
    this.firstCriticalTime = null;
    this.lastWarningTime = 0;
    this.lastCriticalTime = 0;
    this.stats = {
      totalWarnings: 0,
      totalCriticals: 0,
      totalBlockedOperations: 0,
      autoScaledCount: 0
    };
  }

  /**
   * 更新处理策略
   * @param {string} strategy - 新的策略
   */
  setStrategy(strategy) {
    if (!Object.values(ALERT_STRATEGIES).includes(strategy)) {
      throw new Error(`无效的预警策略: ${strategy}`);
    }
    this.strategy = strategy;
  }

  // ==================== 私有方法 ====================

  /**
   * 创建预警记录
   * @private
   */
  _createAlertRecord(level, data) {
    return {
      id: this.alertHistory.length + 1,
      level,
      timestamp: Date.now(),
      isoTime: new Date().toISOString(),
      usagePercent: data.usagePercent || (data.cumulativeUsage / (this.manager?.totalBudget || 100000)),
      phase: data.phase,
      tokens: data.tokens,
      detail: data.detail,
      remaining: data.remaining,
      strategy: this.strategy
    };
  }

  /**
   * 输出预警到控制台
   * @private
   */
  _printWarningAlert(data) {
    const percent = ((data.usagePercent || 0) * 100).toFixed(1);
    console.log('\n' + chalk.yellow('╔══════════════════════════════════════════════════╗'));
    console.log(chalk.yellow('║') + chalk.bold.yellow('         TOKEN BUDGET WARNING              ') + chalk.yellow('║'));
    console.log(chalk.yellow('╠══════════════════════════════════════════════════╣'));
    console.log(chalk.yellow('║') + ` 使用率: ${chalk.bold(percent)}%  |  阈值: ${(this.warningThreshold * 100).toFixed(0)}%          ` + chalk.yellow('║'));
    console.log(chalk.yellow('║') + ` 剩余: ${chalk.cyan((data.remaining || 0).toLocaleString())} tokens                        ` + chalk.yellow('║'));
    if (data.phase) {
      console.log(chalk.yellow('║') + ` 阶段: ${chalk.white(data.phase)}  |  操作: ${chalk.gray((data.detail || '').substring(0, 30))} ` + chalk.yellow('║'));
    }
    console.log(chalk.yellow('╚══════════════════════════════════════════════════╝\n');
  }

  /**
   * 输出阻断警报到控制台
   * @private
   */
  _printCriticalAlert(data) {
    const percent = ((data.usagePercent || 0) * 100).toFixed(1);
    console.log('\n' + chalk.red('╔══════════════════════════════════════════════════╗'));
    console.log(chalk.red('║') + chalk.bold.bgRed('       TOKEN BUDGET CRITICAL - BLOCKED       ') + chalk.red('║'));
    console.log(chalk.red('╠══════════════════════════════════════════════════╣'));
    console.log(chalk.red('║') + ` 使用率: ${chalk.bold.white(percent)}%  |  阈值: ${(this.criticalThreshold * 100).toFixed(0)}%          ` + chalk.red('║'));
    console.log(chalk.red('║') + ` 操作已被${chalk.bold('阻断')}! 剩余: ${(data.remaining || 0).toLocaleString()} tokens     ` + chalk.red('║'));
    if (data.phase) {
      console.log(chalk.red('║') + ` 阶段: ${chalk.white(data.phase)}  |  请求: ${(data.tokens || 0).toLocaleString()} tokens    ` + chalk.red('║'));
    }
    console.log(chalk.red('╚══════════════════════════════════════════════════╝\n'));
  }

  /**
   * 应用自动降级策略
   * @private
   */
  _applyAutoScale(data) {
    this.stats.autoScaledCount++;

    // 计算建议的缩放因子
    const usagePercent = data.usagePercent || 0;
    let scaleFactor = 1.0;

    if (usagePercent >= this.criticalThreshold) {
      scaleFactor = 0.3; // 降至30%
    } else if (usagePercent >= this.warningThreshold) {
      scaleFactor = 0.6; // 降至60%
    }

    console.log(chalk.yellow(`[BudgetAlert] 自动降级: 后续请求Token预算缩放至 ${Math.round(scaleFactor * 100)}%`));

    return `auto_scaled_${Math.round(scaleFactor * 100)}pct`;
  }
}

export default BudgetAlert;
