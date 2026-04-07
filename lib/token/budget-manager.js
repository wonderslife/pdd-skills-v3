// lib/token/budget-manager.js - Token Budget Manager
// 管理每次PDD执行的Token消耗，防止超预算

import { EventEmitter } from 'events';
import { BudgetAlert } from './budget-alert.js';

/**
 * PDD执行阶段枚举
 */
export const PHASES = {
  ANALYSIS: 'analysis',       // 业务分析阶段
  DESIGN: 'design',           // 设计规格阶段
  IMPLEMENTATION: 'impl',     // 代码实现阶段
  REVIEW: 'review',           // 代码审查阶段
  VERIFICATION: 'verify'      // 验证确认阶段
};

/**
 * 默认的阶段Token分配比例
 */
const DEFAULT_ALLOCATION = {
  [PHASES.ANALYSIS]: 0.20,    // 分析阶段占20%
  [PHASES.DESIGN]: 0.15,      // 设计阶段占15%
  [PHASES.IMPLEMENTATION]: 0.40, // 实现阶段占40%
  [PHASES.REVIEW]: 0.15,      // 审查阶段占15%
  [PHASES.VERIFICATION]: 0.10 // 验证阶段占10%
};

/**
 * TokenBudgetManager - Token预算管理器
 *
 * 职责：
 * - 管理PDD全流程的Token消耗预算
 * - 按阶段分配和追踪Token使用情况
 * - 提供预警和阻断机制
 * - 与token-analyzer.js集成，记录详细的消耗历史
 *
 * 使用示例：
 * ```js
 * const manager = new TokenBudgetManager({ totalBudget: 100000 });
 * manager.allocate(PHASES.ANALYSIS, 20000);
 * const result = manager.consume(PHASES.ANALYSIS, 5000, '分析PRD文档');
 * if (result.blocked) {
 *   console.log('超预算，操作被阻断');
 * }
 * ```
 */
export class TokenBudgetManager extends EventEmitter {
  /**
   * 创建Token预算管理器实例
   * @param {Object} config - 配置选项
   * @param {number} config.totalBudget - 总Token预算（默认100000）
   * @param {number} config.warningThreshold - 预警阈值比例（默认0.8即80%）
   * @param {number} config.criticalThreshold - 阻断阈值比例（默认0.95即95%）
   * @param {Object} config.allocation - 自定义阶段分配比例
   * @param {boolean} config.autoAlert - 是否启用自动预警（默认true）
   */
  constructor(config = {}) {
    super();

    this.totalBudget = config.totalBudget || 100000;
    this.warningThreshold = config.warningThreshold || 0.8;
    this.criticalThreshold = config.criticalThreshold || 0.95;
    this.currentUsage = 0;
    this.sessionId = this._generateSessionId();
    this.startTime = Date.now();

    // 按阶段分配的预算（绝对值tokens）
    this.allocation = {};
    // 按阶段实际消耗
    this.phaseUsage = {};
    // 消耗历史记录
    this.history = [];

    // 初始化预警系统
    this.alert = new BudgetAlert({
      warningThreshold: this.warningThreshold,
      criticalThreshold: this.criticalThreshold,
      manager: this
    });

    // 应用默认或自定义分配
    const allocationConfig = config.allocation || DEFAULT_ALLOCATION;
    this._applyAllocation(allocationConfig);

    // 自动预警监听
    if (config.autoAlert !== false) {
      this._setupAutoAlert();
    }
  }

  /**
   * 为指定阶段分配Token预算
   * @param {string} phase - 阶段标识 (PHASES枚举)
   * @param {number} tokens - 分配的Token数量（可选，不传则按比例计算）
   * @returns {Object} 分配结果
   */
  allocate(phase, tokens) {
    if (!this._isValidPhase(phase)) {
      return { success: false, error: `无效的阶段标识: ${phase}` };
    }

    const allocatedTokens = tokens !== undefined
      ? tokens
      : Math.floor(this.totalBudget * (DEFAULT_ALLOCATION[phase] || 0.1));

    // 检查总分配是否超预算
    const currentTotalAllocated = Object.values(this.allocation).reduce((s, v) => s + v, 0);
    if (currentTotalAllocated + allocatedTokens > this.totalBudget) {
      return {
        success: false,
        error: `分配失败: 总分配(${currentTotalAllocated + allocatedTokens})超过总预算(${this.totalBudget})`,
        remaining: this.totalBudget - currentTotalAllocated
      };
    }

    this.allocation[phase] = allocatedTokens;
    this.phaseUsage[phase] = 0;

    this.emit('allocate', {
      phase,
      tokens: allocatedTokens,
      timestamp: Date.now()
    });

    return {
      success: true,
      phase,
      allocated: allocatedTokens,
      totalAllocated: currentTotalAllocated + allocatedTokens
    };
  }

  /**
   * 记录Token消耗并检查是否超预算
   * @param {string} phase - 消耗所属阶段
   * @param {number} tokens - 消耗的Token数量
   * @param {string} detail - 消耗详情描述
   * @returns {Object} 消耗结果 { consumed, blocked, warning, remaining, usagePercent }
   */
  consume(phase, tokens, detail = '') {
    if (!this._isValidPhase(phase)) {
      return { success: false, error: `无效的阶段标识: ${phase}`, blocked: true };
    }

    if (typeof tokens !== 'number' || tokens <= 0) {
      return { success: false, error: 'Token数量必须为正数', blocked: true };
    }

    const beforeUsage = this.currentUsage;
    const afterUsage = beforeUsage + tokens;
    const usagePercent = afterUsage / this.totalBudget;

    // 检查是否达到阻断阈值
    if (usagePercent >= this.criticalThreshold && beforeUsage < this.criticalThreshold * this.totalBudget) {
      const result = {
        success: false,
        consumed: 0,
        phase,
        tokens,
        detail,
        blocked: true,
        reason: 'CRITICAL_BUDGET_EXCEEDED',
        usagePercent,
        threshold: this.criticalThreshold,
        remaining: this.getRemaining(),
        alertLevel: 'critical'
      };

      this.emit('critical', result);
      this.alert.handleCritical(result);
      return result;
    }

    // 检查是否已处于阻断状态
    if (beforeUsage >= this.criticalThreshold * this.totalBudget) {
      return {
        success: false,
        consumed: 0,
        phase,
        tokens,
        detail,
        blocked: true,
        reason: 'ALREADY_CRITICAL',
        usagePercent: beforeUsage / this.totalBudget,
        remaining: this.getRemaining(),
        alertLevel: 'critical'
      };
    }

    // 正常消耗
    this.currentUsage = afterUsage;
    this.phaseUsage[phase] = (this.phaseUsage[phase] || 0) + tokens;

    // 记录历史
    const record = {
      id: this.history.length + 1,
      sessionId: this.sessionId,
      phase,
      tokens,
      detail,
      timestamp: Date.now(),
      cumulativeUsage: this.currentUsage,
      usagePercent: Math.round(usagePercent * 10000) / 100
    };
    this.history.push(record);

    // 判断预警状态
    const isWarning = usagePercent >= this.warningThreshold;
    const isCritical = usagePercent >= this.criticalThreshold;

    const result = {
      success: true,
      consumed: tokens,
      phase,
      detail,
      blocked: false,
      warning: isWarning,
      critical: isCritical,
      usagePercent: Math.round(usagePercent * 10000) / 100,
      remaining: this.getRemaining()
    };

    // 触发事件
    this.emit('consume', record);

    if (isCritical) {
      this.emit('critical', result);
      this.alert.handleCritical(result);
    } else if (isWarning) {
      this.emit('warning', result);
      this.alert.handleWarning(result);
    }

    return result;
  }

  /**
   * 获取剩余可用Token
   * @returns {number}
   */
  getRemaining() {
    return Math.max(0, this.totalBudget - this.currentUsage);
  }

  /**
   * 获取当前使用率
   * @returns {number} 0-1之间的小数
   */
  getUsagePercent() {
    return this.currentUsage / this.totalBudget;
  }

  /**
   * 获取指定阶段的已用Token数量
   * @param {string} phase - 阶段标识
   * @returns {number}
   */
  getPhaseUsage(phase) {
    return this.phaseUsage[phase] || 0;
  }

  /**
   * 获取指定阶段的预算分配
   * @param {string} phase - 阶段标识
   * @returns {number}
   */
  getPhaseAllocation(phase) {
    return this.allocation[phase] || 0;
  }

  /**
   * 获取指定阶段的使用率
   * @param {string} phase - 阶段标识
   * @returns {number}
   */
  getPhaseUsagePercent(phase) {
    const allocated = this.allocation[phase];
    if (!allocated || allocated === 0) return 0;
    return (this.phaseUsage[phase] || 0) / allocated;
  }

  /**
   * 判断是否进入预警状态
   * @returns {boolean}
   */
  isWarning() {
    return this.getUsagePercent() >= this.warningThreshold;
  }

  /**
   * 判断是否进入阻断状态
   * @returns {boolean}
   */
  isCritical() {
    return this.getUsagePercent() >= this.criticalThreshold;
  }

  /**
   * 获取完整的预算使用报告
   * @returns {Object} 结构化报告数据
   */
  getReport() {
    const durationMs = Date.now() - this.startTime;
    const phaseReports = {};

    for (const [phase, allocated] of Object.entries(this.allocation)) {
      const used = this.phaseUsage[phase] || 0;
      phaseReports[phase] = {
        allocated,
        used,
        remaining: Math.max(0, allocated - used),
        usagePercent: allocated > 0 ? Math.round((used / allocated) * 10000) / 100 : 0,
        status: this._getPhaseStatus(phase)
      };
    }

    return {
      summary: {
        sessionId: this.sessionId,
        totalBudget: this.totalBudget,
        currentUsage: this.currentUsage,
        remaining: this.getRemaining(),
        usagePercent: Math.round(this.getUsagePercent() * 10000) / 100,
        status: this.isCritical() ? 'critical' : this.isWarning() ? 'warning' : 'normal',
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date().toISOString(),
        durationSeconds: Math.round(durationMs / 1000),
        totalOperations: this.history.length
      },
      phases: phaseReports,
      thresholds: {
        warning: this.warningThreshold,
        critical: this.criticalThreshold,
        warningTokens: Math.floor(this.totalBudget * this.warningThreshold),
        criticalTokens: Math.floor(this.totalBudget * this.criticalThreshold)
      },
      history: this.history,
      recommendations: this._generateRecommendations()
    };
  }

  /**
   * 重置所有计数器和历史记录
   * @param {Object} options - 重置选项
   * @param {boolean} options.keepAllocation - 是否保留阶段分配（默认false）
   */
  reset(options = {}) {
    const oldSession = this.sessionId;

    this.currentUsage = 0;
    this.sessionId = this._generateSessionId();
    this.startTime = Date.now();

    if (!options.keepAllocation) {
      this.allocation = {};
      const allocationConfig = DEFAULT_ALLOCATION;
      this._applyAllocation(allocationConfig);
    }

    this.phaseUsage = {};
    this.history = [];

    this.emit('reset', {
      oldSession,
      newSession: this.sessionId,
      timestamp: Date.now()
    });
  }

  /**
   * 导出为JSON格式（用于持久化）
   * @returns {string}
   */
  toJSON() {
    return JSON.stringify(this.getReport(), null, 2);
  }

  // ==================== 私有方法 ====================

  /**
   * 生成会话ID
   * @private
   */
  _generateSessionId() {
    return `pdd-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * 验证阶段标识有效性
   * @private
   */
  _isValidPhase(phase) {
    return Object.values(PHASES).includes(phase);
  }

  /**
   * 应用阶段分配配置
   * @private
   */
  _applyAllocation(allocationConfig) {
    if (typeof allocationConfig === 'object' && !Array.isArray(allocationConfig)) {
      // 绝对值配置: { analysis: 20000, design: 15000, ... }
      for (const [phase, tokens] of Object.entries(allocationConfig)) {
        if (this._isValidPhase(phase) && typeof tokens === 'number') {
          this.allocation[phase] = tokens;
          this.phaseUsage[phase] = 0;
        }
      }
    } else {
      // 按默认比例分配
      for (const [phase, ratio] of Object.entries(DEFAULT_ALLOCATION)) {
        this.allocation[phase] = Math.floor(this.totalBudget * ratio);
        this.phaseUsage[phase] = 0;
      }
    }
  }

  /**
   * 获取阶段状态
   * @private
   */
  _getPhaseStatus(phase) {
    const percent = this.getPhaseUsagePercent(phase);
    if (percent >= 1) return 'exceeded';
    if (percent >= 0.9) return 'critical';
    if (percent >= 0.75) return 'warning';
    if (percent > 0) return 'active';
    return 'idle';
  }

  /**
   * 设置自动预警监听
   * @private
   */
  _setupAutoAlert() {
    this.on('warning', (data) => {
      this.alert.handleWarning(data);
    });
    this.on('critical', (data) => {
      this.alert.handleCritical(data);
    });
  }

  /**
   * 根据当前使用情况生成优化建议
   * @private
   */
  _generateRecommendations() {
    const recommendations = [];
    const usagePercent = this.getUsagePercent();

    if (usagePercent > 0.9) {
      recommendations.push({
        level: 'critical',
        message: 'Token使用率超过90%，建议立即结束非关键操作'
      });
    }

    // 检查各阶段是否有异常消耗
    for (const [phase, usage] of Object.entries(this.phaseUsage)) {
      const allocated = this.allocation[phase];
      if (allocated && usage / allocated > 1.2) {
        recommendations.push({
          level: 'warning',
          message: `${phase}阶段超预算${Math.round((usage / allocated - 1) * 100)}%，建议优化该阶段的Prompt策略`
        });
      }
    }

    // 检查是否有未使用的阶段
    for (const phase of Object.keys(this.allocation)) {
      if (!this.phaseUsage[phase] || this.phaseUsage[phase] === 0) {
        recommendations.push({
          level: 'info',
          message: `${phase}阶段尚未使用`
        });
      }
    }

    return recommendations;
  }
}

export default TokenBudgetManager;
