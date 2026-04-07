/**
 * PDD Visual Manager - SSE Manager (VM-B002)
 *
 * Server-Sent Events 管理器，负责：
 * - 管理 SSE 客户端连接
 * - 广播实时事件到所有连接的客户端
 * - 维护心跳机制保持连接活跃
 *
 * @module vm/dashboard/sse
 */

/**
 * SSE 事件类型常量
 * @enum {string}
 */
export const SSEEventType = {
  STAGE_CHANGE: 'stage_change',
  QUALITY_UPDATE: 'quality_update',
  ENGINE_METRICS: 'engine_metrics',
  SYSTEM_EVENT: 'system_event',
  DATA_REFRESHED: 'data_refreshed'
};

/**
 * 默认配置
 * @type {Object}
 */
const DEFAULT_CONFIG = {
  heartbeatInterval: 15000, // 心跳间隔：15秒
  maxConnections: 100       // 最大连接数限制
};

/**
 * 全局事件 ID 计数器
 * @type {number}
 */
let globalEventId = 0;

/**
 * 获取下一个事件 ID
 * @returns {number}
 */
function getNextEventId() {
  return ++globalEventId;
}

/**
 * SSEManager 类
 * 管理所有 Server-Sent Events 连接和消息广播
 */
class SSEManager {
  /**
   * 创建 SSEManager 实例
   * @param {Object} [config={}] - 配置选项
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    /** @type {Set<http.ServerResponse>} 活跃的 SSE 连接集合 */
    this.connections = new Set();

    /** @type {Timer|null} 心跳定时器 */
    this.heartbeatTimer = null;

    /** @type {boolean} 是否已启动 */
    this._started = false;
  }

  /**
   * 处理新的 SSE 连接请求
   * 当客户端访问 /sse 端点时调用
   * @param {http.IncomingMessage} req - HTTP 请求对象
   * @param {http.ServerResponse} res - HTTP 响应对象
   */
  handleConnection(req, res) {
    // 检查连接数限制
    if (this.connections.size >= this.config.maxConnections) {
      res.writeHead(503, {
        'Content-Type': 'application/json; charset=utf-8'
      });
      res.end(JSON.stringify({
        error: 'Service Unavailable',
        message: `达到最大连接数限制 (${this.config.maxConnections})`
      }));
      return;
    }

    // 设置 SSE 必需的响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',        // 禁用 Nginx 缓冲
      'Access-Control-Allow-Origin': '*'
    });

    // 立即发送初始连接确认事件
    this._sendEvent(res, 'connected', {
      timestamp: new Date().toISOString(),
      serverTime: Date.now(),
      connections: this.connections.size + 1
    });

    // 添加到连接集合
    this.connections.add(res);

    console.log(`[SSE] 新连接建立 (当前: ${this.connections.size})`);

    // 监听连接关闭事件
    req.on('close', () => {
      this.removeConnection(res);
    });

    req.on('error', (err) => {
      console.error('[SSE] 连接错误:', err.message);
      this.removeConnection(res);
    });
  }

  /**
   * 移除 SSE 连接
   * @param {http.ServerResponse} res - 要移除的响应对象
   */
  removeConnection(res) {
    if (!this.connections.has(res)) return;

    this.connections.delete(res);
    console.log(`[SSE] 连接断开 (当前: ${this.connections.size})`);

    try {
      // 尝试结束响应（如果还未结束）
      if (!res.writableEnded) {
        res.end();
      }
    } catch (err) {
      // 忽略已关闭的连接错误
    }
  }

  /**
   * 向单个连接发送 SSE 事件
   * @param {http.ServerResponse} res - 目标连接的响应对象
   * @param {string} type - 事件类型
   * @param {Object} data - 事件数据
   * @private
   */
  _sendEvent(res, type, data) {
    if (res.writableEnded) return;

    const eventId = getNextEventId();
    const payload = JSON.stringify(data);

    try {
      res.write(
        `id: ${eventId}\n` +
        `event: ${type}\n` +
        `data: ${payload}\n\n`
      );
    } catch (err) {
      // 写入失败，可能连接已断开
      console.error('[SSE] 发送事件失败:', err.message);
      this.removeConnection(res);
    }
  }

  /**
   * 向所有连接广播事件
   * @param {string} type - 事件类型（使用 SSEEventType 常量）
   * @param {Object} data - 要广播的数据
   */
  broadcast(type, data) {
    if (this.connections.size === 0) return;

    const eventData = {
      ...data,
      _broadcastAt: new Date().toISOString(),
      _connections: this.connections.size
    };

    // 使用副本遍历，防止在迭代中修改集合
    const connectionsCopy = [...this.connections];
    let successCount = 0;

    for (const res of connectionsCopy) {
      try {
        this._sendEvent(res, type, eventData);
        successCount++;
      } catch (err) {
        // 连接可能已断开，将在下次清理
      }
    }

    if (successCount > 0) {
      console.log(`[SSE] 广播 ${type} → ${successCount} 个客户端`);
    }
  }

  /**
   * 启动心跳机制
   * 每 15 秒发送一次注释行保持连接活跃
   */
  startHeartbeat() {
    if (this._started) return;

    this._started = true;
    this.heartbeatTimer = setInterval(() => {
      this._sendHeartbeat();
    }, this.config.heartbeatInterval);

    console.log(`[SSE] 心跳已启动 (间隔: ${this.config.heartbeatInterval / 1000}s)`);
  }

  /**
   * 停止心跳机制
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      this._started = false;
      console.log('[SSE] 心跳已停止');
    }
  }

  /**
   * 发送心跳包到所有连接
   * @private
   */
  _sendHeartbeat() {
    if (this.connections.size === 0) return;

    const comment = ': heartbeat\n\n';
    const disconnected = [];

    for (const res of this.connections) {
      try {
        if (!res.writableEnded) {
          res.write(comment);
        } else {
          disconnected.push(res);
        }
      } catch (err) {
        disconnected.push(res);
      }
    }

    // 清理已断开的连接
    for (const res of disconnected) {
      this.removeConnection(res);
    }
  }

  /**
   * 关闭所有连接并停止心跳
   * 在服务器关闭时调用
   */
  closeAll() {
    console.log(`[SSE] 正在关闭 ${this.connections.size} 个连接...`);

    for (const res of this.connections) {
      try {
        // 发送服务器关闭通知
        this._sendEvent(res, 'server_shutdown', {
          message: 'Server is shutting down',
          timestamp: new Date().toISOString()
        });
        // 结束响应
        setTimeout(() => {
          if (!res.writableEnded) {
            res.end();
          }
        }, 100);
      } catch (err) {
        // 忽略错误
      }
    }

    // 清空连接集合
    this.connections.clear();
    console.log('[SSE] 所有连接已关闭');
  }

  /**
   * 获取当前活跃连接数
   * @returns {number}
   */
  getConnectionCount() {
    return this.connections.size;
  }

  /**
   * 便捷方法：广播阶段变更事件
   * @param {string} featureId - 功能点 ID
   * @param {string} newStage - 新阶段
   * @param {string} [oldStage] - 旧阶段
   */
  broadcastStageChange(featureId, newStage, oldStage) {
    this.broadcast(SSEEventType.STAGE_CHANGE, {
      featureId,
      newStage,
      oldStage,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 便捷方法：广播质量更新事件
   * @param {string} featureId - 功能点 ID
   * @param {Object} qualityData - 质量数据
   */
  broadcastQualityUpdate(featureId, qualityData) {
    this.broadcast(SSEEventType.QUALITY_UPDATE, {
      featureId,
      ...qualityData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 便捷方法：广播引擎指标事件
   * @param {Object} metrics - 引擎指标数据
   */
  broadcastEngineMetrics(metrics) {
    this.broadcast(SSEEventType.ENGINE_METRICS, {
      ...metrics,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 便捷方法：广播系统事件
   * @param {string} level - 日志级别 (info/warn/error)
   * @param {string} message - 事件消息
   * @param {Object} [metadata={}] - 附加元数据
   */
  broadcastSystemEvent(level, message, metadata = {}) {
    this.broadcast(SSEEventType.SYSTEM_EVENT, {
      level,
      message,
      ...metadata,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 便捷方法：广播数据刷新完成事件
   * @param {Object} summary - 刷新后的项目摘要
   */
  broadcastDataRefreshed(summary) {
    this.broadcast(SSEEventType.DATA_REFRESHED, {
      summary,
      timestamp: new Date().toISOString()
    });
  }
}

export { SSEManager };
export default SSEManager;
