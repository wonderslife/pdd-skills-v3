/**
 * @module openclaw/openclaw-adapter
 * @description OpenClaw 适配器核心模块 - 实现 PDD 与 OpenClaw 平台的双向集成
 * @version 1.0.0
 * @author PDD-Skills Team
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

/**
 * 标准消息封装类 - 用于 OpenClaw Protocol 消息格式化
 * @class OpenClawMessage
 */
export class OpenClawMessage {
  /**
   * 创建消息实例
   * @param {Object} options - 消息配置选项
   * @param {string} options.id - 消息唯一标识符（自动生成）
   * @param {string} options.type - 消息类型 (request/response/event/error)
   * @param {Object} options.payload - 消息负载
   * @param {string} [options.sessionId] - 会话ID
   * @param {number} [options.timestamp] - 时间戳
   */
  constructor({ id, type, payload, sessionId, timestamp }) {
    this.id = id || randomUUID();
    this.type = type;
    this.payload = payload;
    this.sessionId = sessionId;
    this.timestamp = timestamp || Date.now();
  }

  /**
   * 序列化为 JSON 字符串
   * @returns {string} JSON 格式的消息字符串
   */
  toJSON() {
    return JSON.stringify({
      id: this.id,
      type: this.type,
      payload: this.payload,
      sessionId: this.sessionId,
      timestamp: this.timestamp
    });
  }

  /**
   * 从 JSON 字符串解析消息
   * @param {string} jsonString - JSON 字符串
   * @returns {OpenClawMessage} 消息实例
   */
  static fromJSON(jsonString) {
    const data = JSON.parse(jsonString);
    return new OpenClawMessage(data);
  }

  /**
   * 创建请求消息
   * @param {string} toolName - 工具名称
   * @param {Object} params - 参数对象
   * @param {string} [sessionId] - 会话ID
   * @returns {OpenClawMessage} 请求消息实例
   */
  static createRequest(toolName, params, sessionId) {
    return new OpenClawMessage({
      type: 'request',
      payload: {
        tool: toolName,
        params: params || {}
      },
      sessionId
    });
  }

  /**
   * 创建响应消息
   * @param {string} requestId - 关联的请求ID
   * @param {*} result - 结果数据
   * @param {boolean} [success=true] - 是否成功
   * @returns {OpenClawMessage} 响应消息实例
   */
  static createResponse(requestId, result, success = true) {
    return new OpenClawMessage({
      id: requestId,
      type: 'response',
      payload: {
        success,
        result,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 创建错误消息
   * @param {string} requestId - 关联的请求ID
   * @param {Error|string} error - 错误信息
   * @param {number} [code] - 错误码
   * @returns {OpenClawMessage} 错误消息实例
   */
  static createError(requestId, error, code) {
    return new OpenClawMessage({
      id: requestId,
      type: 'error',
      payload: {
        success: false,
        error: error instanceof Error ? error.message : error,
        code: code || 500,
        timestamp: Date.now()
      }
    });
  }
}

/**
 * 能力注册表类 - 管理可暴露给 OpenClaw 的工具能力
 * @class CapabilityRegistry
 */
export class CapabilityRegistry {
  constructor() {
    /** @type {Map<string, Object>} 能力映射表 */
    this.capabilities = new Map();
    
    // 注册默认的 PDD 能力映射
    this._registerDefaultCapabilities();
  }

  /**
   * 注册默认的 PDD → OpenClaw 能力映射
   * @private
   */
  _registerDefaultCapabilities() {
    const defaultCapabilities = [
      {
        name: 'pdd_generate_spec',
        description: '根据功能点生成开发规格和验收标准',
        inputSchema: {
          type: 'object',
          properties: {
            featureId: { type: 'string', description: '功能点ID' },
            prdPath: { type: 'string', description: 'PRD文档路径' }
          },
          required: ['featureId']
        },
        handler: async (params) => ({
          action: 'generate_spec',
          params
        })
      },
      {
        name: 'pdd_generate_code',
        description: '基于开发规格生成实现代码',
        inputSchema: {
          type: 'object',
          properties: {
            specPath: { type: 'string', description: '规格文件路径' },
            outputDir: { type: 'string', description: '输出目录' }
          },
          required: ['specPath']
        },
        handler: async (params) => ({
          action: 'generate_code',
          params
        })
      },
      {
        name: 'pdd_verify_feature',
        description: '验证功能实现是否符合规格和验收标准',
        inputSchema: {
          type: 'object',
          properties: {
            specPath: { type: 'string', description: '规格文件路径' },
            codeDir: { type: 'string', description: '代码目录' }
          },
          required: ['specPath']
        },
        handler: async (params) => ({
          action: 'verify_feature',
          params
        })
      },
      {
        name: 'pdd_code_review',
        description: '执行代码审查并生成审查报告',
        inputSchema: {
          type: 'object',
          properties: {
            codePath: { type: 'string', description: '代码路径' },
            specPath: { type: 'string', description: '规格文件路径' }
          },
          required: ['codePath']
        },
        handler: async (params) => ({
          action: 'code_review',
          params
        })
      },
      {
        name: 'pdd_list_skills',
        description: '列出所有可用的PDD技能',
        inputSchema: {
          type: 'object',
          properties: {
            category: { type: 'string', description: '技能分类' },
            format: { type: 'string', enum: ['text', 'json'] }
          }
        },
        handler: async (params) => ({
          action: 'list_skills',
          params
        })
      },
      {
        name: 'pdd_analyze_project',
        description: '分析项目结构和依赖关系',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: { type: 'string', description: '项目路径' },
            depth: { type: 'number', description: '分析深度' }
          },
          required: ['projectPath']
        },
        handler: async (params) => ({
          action: 'analyze_project',
          params
        })
      }
    ];

    for (const cap of defaultCapabilities) {
      this.register(cap.name, cap);
    }
  }

  /**
   * 注册新能力
   * @param {string} name - 能力名称
   * @param {Object} capability - 能力定义
   * @param {string} capability.description - 能力描述
   * @param {Object} capability.inputSchema - 输入参数 schema
   * @param {Function} capability.handler - 处理函数
   * @returns {boolean} 是否注册成功
   */
  register(name, capability) {
    if (this.capabilities.has(name)) {
      return false;
    }
    this.capabilities.set(name, {
      name,
      description: capability.description || '',
      inputSchema: capability.inputSchema || {},
      handler: capability.handler || (() => ({})),
      registeredAt: Date.now()
    });
    return true;
  }

  /**
   * 注销能力
   * @param {string} name - 能力名称
   * @returns {boolean} 是否注销成功
   */
  unregister(name) {
    return this.capabilities.delete(name);
  }

  /**
   * 获取能力定义
   * @param {string} name - 能力名称
   * @returns {Object|undefined} 能力定义
   */
  get(name) {
    return this.capabilities.get(name);
  }

  /**
   * 列出所有已注册的能力
   * @returns {Array<Object>} 能力列表
   */
  list() {
    return Array.from(this.capabilities.values());
  }

  /**
   * 获取能力数量
   * @returns {number} 已注册能力总数
   */
  get size() {
    return this.capabilities.size;
  }

  /**
   * 将能力转换为 OpenClaw tools 格式
   * @returns {Array<Object>} OpenClaw tools 数组
   */
  toOpenClawTools() {
    return this.list().map(cap => ({
      type: 'function',
      function: {
        name: cap.name,
        description: cap.description,
        parameters: cap.inputSchema
      }
    }));
  }
}

/**
 * OpenClaw 适配器核心类 - 管理连接、协议转换和消息处理
 * @class OpenClawAdapter
 * @extends EventEmitter
 */
export class OpenClawAdapter extends EventEmitter {
  /**
   * 创建适配器实例
   * @param {Object} options - 配置选项
   * @param {string} [options.endpoint='http://localhost:8080'] - OpenClaw 服务端点
   * @param {string} [options.token] - 认证令牌
   * @param {number} [options.timeout=30000] - 请求超时时间(ms)
   * @param {number} [options.heartbeatInterval=30000] - 心跳间隔(ms)
   * @param {number} [options.maxReconnectDelay=30000] - 最大重连延迟(ms)
   */
  constructor(options = {}) {
    super();
    
    this.endpoint = options.endpoint || 'http://localhost:8080';
    this.token = options.token;
    this.timeout = options.timeout || 30000;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    this.maxReconnectDelay = options.maxReconnectDelay || 30000;

    /** @type {'disconnected'|'connecting'|'connected'|'reconnecting'} 连接状态 */
    this._status = 'disconnected';
    
    /** @type {CapabilityRegistry} 能力注册表 */
    this.registry = new CapabilityRegistry();
    
    /** @type {Map<string, Function>} 待处理请求回调 */
    this._pendingRequests = new Map();
    
    /** @type {Timer|null} 心跳定时器 */
    this._heartbeatTimer = null;
    
    /** @type {number} 当前重连延迟 */
    this._reconnectDelay = 1000;
    
    /** @type {number} 重连尝试次数 */
    this._reconnectAttempts = 0;
    
    /** @type {Array<Object>} 消息日志 */
    this._messageLog = [];
    
    /** @type {Map<string, Object>} 会话存储 */
    this._sessions = new Map();
  }

  /**
   * 获取当前连接状态
   * @returns {string} 状态字符串
   */
  getStatus() {
    return this._status;
  }

  /**
   * 获取适配器状态详情
   * @returns {Object} 状态信息对象
   */
  getStatusDetails() {
    return {
      status: this._status,
      endpoint: this.endpoint,
      connectedAt: this._connectedAt || null,
      uptime: this._connectedAt ? Date.now() - this._connectedAt : 0,
      pendingRequests: this._pendingRequests.size,
      activeSessions: this._sessions.size,
      capabilitiesCount: this.registry.size,
      reconnectAttempts: this._reconnectAttempts,
      messageLogSize: this._messageLog.length
    };
  }

  /**
   * 连接到 OpenClaw 服务
   * @param {Object} [options] - 连接选项
   * @param {string} [options.endpoint] - 覆盖默认端点
   * @param {string} [options.token] - 覆盖默认令牌
   * @returns {Promise<boolean>} 是否连接成功
   */
  async connect(options = {}) {
    if (this._status === 'connected') {
      return true;
    }

    this._status = 'connecting';
    this.emit('connecting');

    const endpoint = options.endpoint || this.endpoint;
    const token = options.token || this.token;

    try {
      // 模拟连接过程（实际场景中会建立 WebSocket 或 HTTP 连接）
      await this._simulateConnection(endpoint, token);
      
      this._status = 'connected';
      this._connectedAt = Date.now();
      this._reconnectDelay = 1000;
      this._reconnectAttempts = 0;
      
      // 启动心跳机制
      this._startHeartbeat();
      
      this.emit('connected', {
        endpoint,
        timestamp: Date.now()
      });

      this._logMessage('system', 'Connected to OpenClaw service');
      return true;
    } catch (error) {
      this._status = 'disconnected';
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 断开连接
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this._status === 'disconnected') {
      return;
    }

    // 停止心跳
    this._stopHeartbeat();

    // 清理待处理请求
    for (const [id, callback] of this._pendingRequests) {
      callback(OpenClawMessage.createError(id, 'Connection closed', 503));
    }
    this._pendingRequests.clear();

    this._status = 'disconnected';
    this._connectedAt = null;
    
    this.emit('disconnected', {
      timestamp: Date.now()
    });

    this._logMessage('system', 'Disconnected from OpenClaw service');
  }

  /**
   * 重连到服务
   * @returns {Promise<boolean>} 是否重连成功
   */
  async reconnect() {
    if (this._status === 'connected') {
      return true;
    }

    this._status = 'reconnecting';
    this._reconnectAttempts++;
    this.emit('reconnecting', {
      attempt: this._reconnectAttempts,
      delay: this._reconnectDelay
    });

    this._logMessage('system', `Reconnecting (attempt ${this._reconnectAttempts}, delay ${this._reconnectDelay}ms)`);

    // 等待退避时间
    await this._sleep(this._reconnectDelay);

    try {
      const success = await this.connect();
      if (success) {
        this._logMessage('system', 'Reconnection successful');
      }
      return success;
    } catch (error) {
      // 指数退避：1s -> 2s -> 4s -> 8s -> max 30s
      this._reconnectDelay = Math.min(
        this._reconnectDelay * 2,
        this.maxReconnectDelay
      );
      
      this.emit('error', error);
      return false;
    }
  }

  /**
   * 发送请求消息
   * @param {string} toolName - 目标工具名称
   * @param {Object} params - 参数对象
   * @param {Object} [options] - 请求选项
   * @param {number} [options.timeout] - 自定义超时时间
   * @param {string} [options.sessionId] - 会话ID
   * @returns {Promise<*>} 响应结果
   */
  async sendRequest(toolName, params, options = {}) {
    if (this._status !== 'connected') {
      throw new Error(`Adapter is not connected (current status: ${this._status})`);
    }

    const message = OpenClawMessage.createRequest(
      toolName,
      params,
      options.sessionId
    );

    this._logMessage('outgoing', message);

    return new Promise((resolve, reject) => {
      const timeout = options.timeout || this.timeout;
      const timer = setTimeout(() => {
        this._pendingRequests.delete(message.id);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      this._pendingRequests.set(message.id, (response) => {
        clearTimeout(timer);
        this._pendingRequests.delete(message.id);
        
        if (response.type === 'error' || !response.payload.success) {
          reject(new Error(response.payload.error || 'Unknown error'));
        } else {
          resolve(response.payload.result);
        }
      });

      // 模拟发送和处理（实际场景中通过网络发送）
      this._processRequest(message);
    });
  }

  /**
   * 处理接收到的消息
   * @param {OpenClawMessage|string} message - 接收到的消息
   */
  handleMessage(message) {
    const msg = typeof message === 'string' 
      ? OpenClawMessage.fromJSON(message)
      : message;

    this._logMessage('incoming', msg);

    switch (msg.type) {
      case 'response':
      case 'error':
        this._handleResponse(msg);
        break;
      case 'event':
        this.emit('message', msg);
        this.emit(`event:${msg.payload.event}`, msg);
        break;
      default:
        this.emit('message', msg);
    }
  }

  /**
   * 创建新会话
   * @param {Object} [metadata] - 会话元数据
   * @returns {string} 会话ID
   */
  createSession(metadata = {}) {
    const sessionId = randomUUID();
    this._sessions.set(sessionId, {
      id: sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      metadata,
      messageCount: 0
    });
    return sessionId;
  }

  /**
   * 销毁会话
   * @param {string} sessionId - 会话ID
   * @returns {boolean} 是否销毁成功
   */
  destroySession(sessionId) {
    return this._sessions.delete(sessionId);
  }

  /**
   * 获取会话列表
   * @returns {Array<Object>} 会话列表
   */
  listSessions() {
    return Array.from(this._sessions.values());
  }

  /**
   * 获取消息日志
   * @param {Object} [options] - 过滤选项
   * @param {number} [options.limit=100] - 返回条数限制
   * @param {string} [options.direction] - 方向过滤 (outgoing/incoming/system)
   * @returns {Array<Object>} 消息日志
   */
  getMessageLog(options = {}) {
    let log = [...this._messageLog];
    
    if (options.direction) {
      log = log.filter(entry => entry.direction === options.direction);
    }

    const limit = options.limit || 100;
    return log.slice(-limit);
  }

  /**
   * 清空消息日志
   */
  clearMessageLog() {
    this._messageLog = [];
  }

  /**
   * 模拟连接过程
   * @private
   * @param {string} endpoint - 端点URL
   * @param {string} token - 认证令牌
   */
  async _simulateConnection(endpoint, token) {
    // 在实际实现中，这里会建立真实的网络连接
    // 当前为模拟实现
    await this._sleep(100);
    
    // 验证端点格式
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      throw new Error(`Invalid endpoint format: ${endpoint}`);
    }
  }

  /**
   * 处理请求（模拟）
   * @private
   * @param {OpenClawMessage} message - 请求消息
   */
  async _processRequest(message) {
    // 模拟处理延迟
    await this._sleep(50);

    const capability = this.registry.get(message.payload.tool);
    
    if (!capability) {
      const errorMsg = OpenClawMessage.createError(
        message.id,
        `Unknown tool: ${message.payload.tool}`,
        404
      );
      this._handleResponse(errorMsg);
      return;
    }

    try {
      // 执行能力处理器
      const result = await capability.handler(message.payload.params);
      
      const response = OpenClawMessage.createResponse(message.id, {
        tool: message.payload.tool,
        ...result
      });
      
      this._handleResponse(response);
    } catch (error) {
      const errorMsg = OpenClawMessage.createError(message.id, error, 500);
      this._handleResponse(errorMsg);
    }
  }

  /**
   * 处理响应消息
   * @private
   * @param {OpenClawMessage} response - 响应消息
   */
  _handleResponse(response) {
    const callback = this._pendingRequests.get(response.id);
    if (callback) {
      callback(response);
    }
    this.emit('message', response);
  }

  /**
   * 启动心跳机制
   * @private
   */
  _startHeartbeat() {
    this._stopHeartbeat();
    
    this._heartbeatTimer = setInterval(() => {
      if (this._status === 'connected') {
        this._sendHeartbeat();
      }
    }, this.heartbeatInterval);

    // 防止进程退出
    if (this._heartbeatTimer.unref) {
      this._heartbeatTimer.unref();
    }
  }

  /**
   * 停止心跳机制
   * @private
   */
  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  /**
   * 发送心跳包
   * @private
   */
  _sendHeartbeat() {
    const heartbeat = new OpenClawMessage({
      type: 'event',
      payload: { event: 'ping', timestamp: Date.now() }
    });
    
    this._logMessage('outgoing', heartbeat);
    this.emit('heartbeat', { direction: 'sent' });
  }

  /**
   * 记录消息日志
   * @private
   * @param {string} direction - 消息方向
   * @param {OpenClawMessage} message - 消息对象
   */
  _logMessage(direction, message) {
    this._messageLog.push({
      direction,
      message,
      timestamp: Date.now()
    });

    // 限制日志大小，防止内存泄漏
    if (this._messageLog.length > 10000) {
      this._messageLog = this._messageLog.slice(-5000);
    }
  }

  /**
   * 异步等待工具函数
   * @private
   * @param {number} ms - 等待毫秒数
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 销毁适配器实例，释放所有资源
   * @returns {Promise<void>}
   */
  async destroy() {
    await this.disconnect();
    this._sessions.clear();
    this._messageLog = [];
    this.removeAllListeners();
  }
}

/**
 * 导出模块默认实例创建工厂
 * @param {Object} options - 配置选项
 * @returns {OpenClawAdapter} 适配器实例
 */
export function createAdapter(options = {}) {
  return new OpenClawAdapter(options);
}
