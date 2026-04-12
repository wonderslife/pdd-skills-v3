/**
 * PDD Visual Manager - 事件总线 (VM-A022)
 *
 * 基于 Node.js EventEmitter 的事件发布/订阅系统，提供：
 * - 类型安全的事件发射方法
 * - SSE (Server-Sent Events) 订阅源支持
 * - 事件历史记录与查询
 * - 增量事件推送（基于 lastEventId）
 *
 * @module vm/event-bus
 */

import { EventEmitter } from 'events';

/**
 * VM 事件类型枚举
 * 定义所有 PDD-VM 系统中的标准事件类型
 *
 * @readonly
 * @enum {string}
 */
export const VMEvents = Object.freeze({
  /** 功能点阶段变更 */
  FEATURE_STAGE_CHANGED: 'feature_stage_changed',
  /** 质量指标更新 */
  QUALITY_UPDATED: 'quality_updated',
  /** Token 使用阈值告警 */
  TOKEN_THRESHOLD: 'token_threshold',
  /** 缓存命中统计 */
  CACHE_HIT: 'cache_hit',
  /** 迭代轮次完成 */
  ITERATION_ROUND_COMPLETE: 'iteration_round_complete',
  /** 系统级事件（启动、错误等） */
  SYSTEM_EVENT: 'system_event',
  /** 数据刷新完成 */
  DATA_REFRESHED: 'data_refreshed'
});

/**
 * VM 事件总线类
 * 继承 Node.js EventEmitter，提供类型安全的事件接口和 SSE 支持
 */
class VMEventBus extends EventEmitter {
  /**
   * 创建事件总线实例
   */
  constructor() {
    super();

    // 设置最大监听器数量（避免内存泄漏警告）
    this.setMaxListeners(50);

    /** @type {Array<Object>} 事件日志记录 */
    this._eventLog = [];

    /** @type {number} 事件 ID 自增计数器 */
    this._eventId = 0;

    /** @type {number} 最大日志容量 */
    this._maxLogSize = 500;
  }

  // ==================== 类型安全的 emit 方法 ====================

  /**
   * 发射功能点阶段变更事件
   * @param {string} featureId - 功能点 ID
   * @param {string} oldStage - 旧阶段
   * @param {string} newStage - 新阶段
   * @param {import('./models.js').Feature} [feature] - 功能点对象（可选）
   * @returns {boolean} 是否有监听器处理此事件
   */
  emitStageChange(featureId, oldStage, newStage, feature) {
    const event = {
      id: ++this._eventId,
      type: VMEvents.FEATURE_STAGE_CHANGED,
      data: {
        featureId,
        oldStage,
        newStage,
        feature: feature ? feature.toJSON() : null,
        timestamp: Date.now()
      }
    };

    this._log(event);
    return this.emit(VMEvents.FEATURE_STAGE_CHANGED, event.data);
  }

  /**
   * 发射质量指标更新事件
   * @param {string} featureId - 功能点 ID
   * @param {import('./models.js').QualityMetrics} quality - 新的质量指标
   * @param {import('./models.js').QualityMetrics|null} [prevQuality] - 旧的质量指标
   * @returns {boolean} 是否有监听器处理此事件
   */
  emitQualityUpdate(featureId, quality, prevQuality) {
    const event = {
      id: ++this._eventId,
      type: VMEvents.QUALITY_UPDATED,
      data: {
        featureId,
        quality: quality ? quality.toJSON() : null,
        prevQuality: prevQuality ? prevQuality.toJSON() : null,
        timestamp: Date.now()
      }
    };

    this._log(event);
    return this.emit(VMEvents.QUALITY_UPDATED, event.data);
  }

  /**
   * 发射 Token 阈值告警事件
   * @param {number} current - 当前使用量
   * @param {number} total - 总配额
   * @param {number} percent - 使用百分比
   * @returns {boolean} 是否有监听器处理此事件
   */
  emitTokenThreshold(current, total, percent) {
    const event = {
      id: ++this._eventId,
      type: VMEvents.TOKEN_THRESHOLD,
      data: {
        current,
        total,
        percent,
        threshold: percent >= 90 ? 'critical' : percent >= 70 ? 'warning' : 'normal',
        timestamp: Date.now()
      }
    };

    this._log(event);
    return this.emit(VMEvents.TOKEN_THRESHOLD, event.data);
  }

  /**
   * 发射缓存命中统计事件
   * @param {number} hitRate - 当前命中率
   * @param {number} [prevHitRate] - 上次命中率（用于对比变化趋势）
   * @returns {boolean} 是否有监听器处理此事件
   */
  emitCacheHit(hitRate, prevHitRate) {
    const event = {
      id: ++this._eventId,
      type: VMEvents.CACHE_HIT,
      data: {
        hitRate,
        prevHitRate: prevHitRate ?? null,
        change: prevHitRate != null ? hitRate - prevHitRate : null,
        timestamp: Date.now()
      }
    };

    this._log(event);
    return this.emit(VMEvents.CACHE_HIT, event.data);
  }

  /**
   * 发射迭代轮次完成事件
   * @param {string} featureId - 功能点 ID
   * @param {number} round - 完成的轮次号
   * @param {boolean} converged - 是否已收敛
   * @returns {boolean} 是否有监听器处理此事件
   */
  emitIterationComplete(featureId, round, converged) {
    const event = {
      id: ++this._eventId,
      type: VMEvents.ITERATION_ROUND_COMPLETE,
      data: {
        featureId,
        round,
        converged,
        timestamp: Date.now()
      }
    };

    this._log(event);
    return this.emit(VMEvents.ITERATION_ROUND_COMPLETE, event.data);
  }

  /**
   * 发射系统级事件
   * @param {string} service - 服务名称（如 'api', 'scanner', 'reconciler'）
   * @param {string} status - 状态 ('online', 'offline', 'error', 'warning')
   * @param {string} [detail=''] - 详细信息
   * @returns {boolean} 是否有监听器处理此事件
   */
  emitSystemEvent(service, status, detail) {
    const event = {
      id: ++this._eventId,
      type: VMEvents.SYSTEM_EVENT,
      data: {
        service,
        status,
        detail: detail || '',
        timestamp: Date.now()
      }
    };

    this._log(event);
    return this.emit(VMEvents.SYSTEM_EVENT, event.data);
  }

  /**
   * 发射数据刷新完成事件
   * @param {import('./models.js').ProjectSummary} summary - 项目汇总数据
   * @returns {boolean} 是否有监听器处理此事件
   */
  emitDataRefreshed(summary) {
    const event = {
      id: ++this._eventId,
      type: VMEvents.DATA_REFRESHED,
      data: {
        summary: summary ? summary.toJSON() : null,
        timestamp: Date.now()
      }
    };

    this._log(event);
    return this.emit(VMEvents.DATA_REFRESHED, event.data);
  }

  // ==================== SSE 订阅源方法 ====================

  /**
   * 获取 SSE 格式的增量事件
   * 用于 Server-Sent Events 实时推送
   *
   * @param {number} [lastEventId=0] - 上次获取的事件 ID（用于增量获取）
   * @returns {{id:number, type:string, data:Object, timestamp:number}|null}
   *   下一个待推送的事件，如果没有新事件则返回 null
   *
   * @example
   * // 在 HTTP SSE 端点中使用
   * let lastId = req.headers['last-event-id'] || 0;
   * while (clientConnected) {
   *   const event = eventBus.getSSEEvent(lastId);
   *   if (event) {
   *     res.write(`id: ${event.id}\n`);
   *     res.write(`event: ${event.type}\n`);
   *     res.write(`data: ${JSON.stringify(event.data)}\n\n`);
   *     lastId = event.id;
   *   }
   *   await sleep(1000);
   * }
   */
  getSSEEvent(lastEventId) {
    if (!lastEventId || lastEventId < 0) {
      lastEventId = 0;
    }

    // 查找第一个 ID 大于 lastEventId 的事件
    const event = this._eventLog.find(e => e.id > lastEventId);

    if (!event) {
      return null;
    }

    return {
      id: event.id,
      type: event.type,
      data: event.data,
      timestamp: event.data.timestamp || Date.now()
    };
  }

  /**
   * 获取事件历史记录
   * 按时间倒序返回最近的事件
   *
   * @param {number} [limit=50] - 返回的最大数量
   * @returns {Array<{id:number, type:string, data:Object, timestamp:number}>}
   *   事件列表（从新到旧排序）
   */
  getEventHistory(limit) {
    const maxLimit = limit || 50;

    // 返回最近的 N 条记录（倒序）
    return [...this._eventLog]
      .sort((a, b) => b.id - a.id)
      .slice(0, maxLimit)
      .map(e => ({
        id: e.id,
        type: e.type,
        data: e.data,
        timestamp: e.data.timestamp || Date.now()
      }));
  }

  /**
   * 获取指定时间之后的所有事件
   * 用于时间范围查询
   *
   * @param {number|Date} timestamp - 起始时间戳（毫秒）或 Date 对象
   * @returns {Array<{id:number, type:string, data:Object, timestamp:number}>}
   *   该时间之后的事件列表（按时间正序排列）
   */
  getEventSince(timestamp) {
    const startTime = typeof timestamp === 'number'
      ? timestamp
      : timestamp instanceof Date
        ? timestamp.getTime()
        : (typeof timestamp === 'string' ? new Date(timestamp).getTime() : 0);

    return this._eventLog
      .filter(e => (e.data.timestamp || 0) >= startTime)
      .sort((a, b) => a.id - b.id)
      .map(e => ({
        id: e.id,
        type: e.type,
        data: e.data,
        timestamp: e.data.timestamp || Date.now()
      }));
  }

  // ==================== 内部方法 ====================

  /**
   * 将事件记录到内部日志
   * 自动管理日志大小，防止内存泄漏
   *
   * @param {Object} event - 事件对象
   * @private
   */
  _log(event) {
    // 添加到日志
    this._eventLog.push(event);

    // 如果超出最大容量，移除最旧的记录
    if (this._eventLog.length > this._maxLogSize) {
      const removeCount = this._eventLog.length - this._maxLogSize;
      this._eventLog.splice(0, removeCount);
    }
  }

  /**
   * 清空事件日志
   * 用于测试或重置场景
   */
  clearHistory() {
    this._eventLog = [];
    this._eventId = 0;
  }

  /**
   * 获取当前事件总数
   * @returns {number} 日志中的事件数量
   */
  getEventCount() {
    return this._eventLog.length;
  }

  /**
   * 获取最新事件 ID
   * 用于 SSE 客户端跟踪位置
   * @returns {number} 最新事件的 ID
   */
  getLatestEventId() {
    return this._eventId;
  }

  /**
   * 按类型过滤事件
   * @param {string} eventType - 事件类型（VMEvents 枚举值）
   * @param {number} [limit=20] - 最大返回数量
   * @returns {Array<Object>} 匹配的事件列表
   */
  getEventsByType(eventType, limit) {
    const maxLimit = limit || 20;

    return this._eventLog
      .filter(e => e.type === eventType)
      .sort((a, b) => b.id - a.id)
      .slice(0, maxLimit)
      .map(e => ({
        id: e.id,
        type: e.type,
        data: e.data,
        timestamp: e.data.timestamp || Date.now()
      }));
  }
}

/**
 * 创建事件总线实例的工厂函数
 * 提供统一的创建入口，便于后续扩展（如添加中间件、拦截器等）
 *
 * @returns {VMEventBus} 新的事件总线实例
 *
 * @example
 * import { createEventBus } from './event-bus.js';
 * const bus = createEventBus();
 * bus.on(bus.events.FEATURE_STAGE_CHANGED, (data) => {
 *   console.log(`阶段变更: ${data.featureId}: ${data.oldStage} -> ${data.newStage}`);
 * });
 */
export function createEventBus() {
  return new VMEventBus();
}

export default VMEventBus;
