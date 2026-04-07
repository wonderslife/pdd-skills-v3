/**
 * @module openclaw/api-integration
 * @description OpenClaw API 集成模块 - 提供 RESTful 和流式接口
 * @version 1.0.0
 * @author PDD-Skills Team
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'crypto';
import { OpenClawAdapter, createAdapter } from './openclaw-adapter.js';

/**
 * 中间件上下文对象
 * @typedef {Object} MiddlewareContext
 * @property {IncomingMessage} req - HTTP 请求对象
 * @property {ServerResponse} res - HTTP 响应对象
 * @property {Object} body - 请求体
 * @property {Object} [user] - 认证用户信息
 * @property {Object} [meta] - 元数据
 */

/**
 * 中间件函数类型
 * @callback MiddlewareFunction
 * @param {MiddlewareContext} ctx - 上下文对象
 * @param {Function} next - 下一个中间件
 * @returns {Promise<void>}
 */

/**
 * OpenClaw API Bridge 类 - 处理 HTTP/WebSocket 请求
 * @class OpenClawAPIBridge
 */
export class OpenClawAPIBridge {
  /**
   * 创建 API Bridge 实例
   * @param {Object} options - 配置选项
   * @param {OpenClawAdapter} [options.adapter] - 适配器实例
   * @param {string} [options.apiKey] - API 密钥
   * @param {number} [options.rateLimitMax=100] - 速率限制最大请求数
   * @param {number} [options.rateLimitWindowMs=60000] - 速率限制时间窗口
   */
  constructor(options = {}) {
    this.adapter = options.adapter || createAdapter();
    this.apiKey = options.apiKey;
    this.rateLimitMax = options.rateLimitMax || 100;
    this.rateLimitWindowMs = options.rateLimitWindowMs || 60000;

    /** @type {Array<MiddlewareFunction>} 中间件链 */
    this.middlewares = [];
    
    /** @type {Map<string, Object>} 会话存储 */
    this.sessions = new Map();
    
    /** @type {Map<string, Array>} 速率限制计数器 */
    this.rateLimiters = new Map();
    
    /** @type {Object|null} HTTP 服务器实例 */
    this.server = null;
    
    /** @type {Array<Object>} 请求日志 */
    this.requestLog = [];

    // 初始化内置中间件
    this._initBuiltInMiddlewares();
  }

  /**
   * 初始化内置中间件
   * @private
   */
  _initBuiltInMiddlewares() {
    // 认证中间件
    this.use(async (ctx, next) => {
      if (this.apiKey) {
        const authHeader = ctx.req.headers['authorization'];
        const apiKey = ctx.req.headers['x-api-key'];
        
        const token = authHeader?.startsWith('Bearer ') 
          ? authHeader.substring(7) 
          : apiKey;

        if (!token || token !== this.apiKey) {
          return this._sendError(ctx.res, 401, 'Unauthorized: Invalid or missing API key');
        }
        
        ctx.user = { authenticated: true, apiKey: token.substring(0, 8) + '...' };
      }
      await next();
    });

    // 速率限制中间件
    this.use(async (ctx, next) => {
      const clientId = ctx.req.socket.remoteAddress || 'unknown';
      const now = Date.now();
      
      if (!this.rateLimiters.has(clientId)) {
        this.rateLimiters.set(clientId, []);
      }
      
      const requests = this.rateLimiters.get(clientId);
      const windowStart = now - this.rateLimitWindowMs;
      
      // 清除过期记录
      while (requests.length > 0 && requests[0] < windowStart) {
        requests.shift();
      }
      
      if (requests.length >= this.rateLimitMax) {
        return this._sendError(ctx.res, 429, 'Too Many Requests: Rate limit exceeded');
      }
      
      requests.push(now);
      await next();
    });

    // 日志中间件
    this.use(async (ctx, next) => {
      const start = Date.now();
      
      await next();
      
      const duration = Date.now() - start;
      this._logRequest(ctx, duration);
    });

    // 路由中间件
    this.use(async (ctx, next) => {
      await this._routeRequest(ctx);
    });
  }

  /**
   * 添加自定义中间件
   * @param {MiddlewareFunction} middleware - 中间件函数
   * @returns {OpenClawAPIBridge} this（支持链式调用）
   */
  use(middleware) {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * 启动 API 服务器
   * @param {number} port - 监听端口
   * @param {string} [host='localhost'] - 绑定地址
   * @returns {Promise<void>}
   */
  async start(port, host = 'localhost') {
    return new Promise((resolve, reject) => {
      this.server = createServer(async (req, res) => {
        try {
          const ctx = {
            req,
            res,
            body: await this._parseBody(req),
            meta: {}
          };
          
          // 执行中间件链
          await this._executeMiddlewares(ctx);
        } catch (error) {
          this._sendError(res, 500, `Internal Server Error: ${error.message}`);
        }
      });

      this.server.listen(port, host, () => {
        console.log(`🌐 OpenClaw API 服务器已启动: http://${host}:${port}`);
        console.log(`   端点:`);
        console.log(`     POST /api/openclaw/chat`);
        console.log(`     POST /api/openclaw/tools/call`);
        console.log(`     GET  /api/openclaw/tools`);
        console.log(`     GET  /api/openclaw/sessions`);
        console.log(`     WS   /api/openclaw/stream\n`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  /**
   * 停止服务器
   * @returns {Promise<void>}
   */
  async stop() {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      
      this.server.close(() => {
        this.server = null;
        console.log('🛑 OpenClaw API 服务器已停止');
        resolve();
      });
    });
  }

  /**
   * 处理聊天接口
   * @private
   * @param {MiddlewareContext} ctx - 上下文
   */
  async _handleChat(ctx) {
    const { messages, stream = false } = ctx.body;
    
    if (!messages || !Array.isArray(messages)) {
      return this._sendError(ctx.res, 400, 'messages array is required');
    }

    if (stream) {
      // SSE 流式响应
      this._setSSEHeaders(ctx.res);
      
      for (const message of messages) {
        const response = await this._processChatMessage(message);
        ctx.res.write(`data: ${JSON.stringify(response)}\n\n`);
      }
      
      ctx.res.write('data: [DONE]\n\n');
      ctx.res.end();
    } else {
      // 普通响应
      const results = [];
      for (const message of messages) {
        results.push(await this._processChatMessage(message));
      }
      
      this._sendJSON(ctx.res, 200, {
        success: true,
        responses: results,
        count: results.length
      });
    }
  }

  /**
   * 处理单个聊天消息
   * @private
   * @param {Object} message - 消息对象
   * @returns {Promise<Object>} 响应结果
   */
  async _processChatMessage(message) {
    const { role, content, tool_calls } = message;
    
    // 如果包含工具调用
    if (tool_calls && tool_calls.length > 0) {
      const results = [];
      for (const call of tool_calls) {
        try {
          const result = await this.adapter.sendRequest(call.function.name, call.function.arguments);
          results.push({
            id: call.id,
            result
          });
        } catch (error) {
          results.push({
            id: call.id,
            error: error.message
          });
        }
      }
      
      return {
        role: 'tool',
        content: results
      };
    }

    // 普通消息处理
    return {
      role: 'assistant',
      content: `Processed: ${typeof content === 'string' ? content.substring(0, 100) : '[complex content]'}`,
      timestamp: Date.now()
    };
  }

  /**
   * 处理工具调用接口
   * @private
   * @param {MiddlewareContext} ctx - 上下文
   */
  async _handleToolCall(ctx) {
    const { tool_name, parameters, session_id } = ctx.body;
    
    if (!tool_name) {
      return this._sendError(ctx.res, 400, 'tool_name is required');
    }

    try {
      const result = await this.adapter.sendRequest(tool_name, parameters || {}, {
        sessionId: session_id
      });

      this._sendJSON(ctx.res, 200, {
        success: true,
        tool: tool_name,
        result,
        timestamp: Date.now()
      });
    } catch (error) {
      this._sendError(ctx.res, 500, `Tool execution failed: ${error.message}`);
    }
  }

  /**
   * 处理工具列表接口
   * @private
   * @param {MiddlewareContext} ctx - 上下文
   */
  async _handleListTools(ctx) {
    const tools = this.adapter.registry.toOpenClawTools();
    
    this._sendJSON(ctx.res, 200, {
      success: true,
      tools,
      count: tools.length
    });
  }

  /**
   * 处理会话列表接口
   * @private
   * @param {MiddlewareContext} ctx - 上下文
   */
  async _handleListSessions(ctx) {
    const sessions = this.adapter.listSessions();
    
    this._sendJSON(ctx.res, 200, {
      success: true,
      sessions,
      count: sessions.length
    });
  }

  /**
   * 创建新会话
   * @param {Object} [metadata] - 会话元数据
   * @returns {string} 会话 ID
   */
  createSession(metadata = {}) {
    return this.adapter.createSession(metadata);
  }

  /**
   * 销毁会话
   * @param {string} sessionId - 会话 ID
   * @returns {boolean} 是否成功
   */
  destroySession(sessionId) {
    return this.adapter.destroySession(sessionId);
  }

  /**
   * 批量执行多个工具调用
   * @param {Array<{tool_name: string, parameters?: Object}>} calls - 调用列表
   * @returns {Promise<Array<Object>>} 结果数组
   */
  async batchExecute(calls) {
    const results = await Promise.allSettled(
      calls.map(call => 
        this.adapter.sendRequest(call.tool_name, call.parameters || {})
      )
    );

    return results.map((result, index) => ({
      index,
      tool_name: calls[index].tool_name,
      status: result.status,
      value: result.status === 'fulfilled' ? result.value : null,
      reason: result.status === 'rejected' ? result.reason.message : null
    }));
  }

  /**
   * 获取请求日志
   * @param {Object} [options] - 过滤选项
   * @param {number} [options.limit=100] - 返回条数
   * @returns {Array<Object>} 日志条目
   */
  getRequestLog(options = {}) {
    const limit = options.limit || 100;
    return this.requestLog.slice(-limit);
  }

  /**
   * 路由请求到对应处理器
   * @private
   * @param {MiddlewareContext} ctx - 上下文
   */
  async _routeRequest(ctx) {
    const { method, url } = ctx.req;
    const pathname = url.split('?')[0];

    const routes = {
      'POST /api/openclaw/chat': () => this._handleChat(ctx),
      'POST /api/openclaw/tools/call': () => this._handleToolCall(ctx),
      'GET /api/openclaw/tools': () => this._handleListTools(ctx),
      'GET /api/openclaw/sessions': () => this._handleListSessions(ctx)
    };

    const handler = routes[`${method} ${pathname}`];
    
    if (handler) {
      await handler();
    } else {
      this._sendError(ctx.res, 404, `Not Found: ${method} ${pathname}`);
    }
  }

  /**
   * 执行中间件链
   * @private
   * @param {MiddlewareContext} ctx - 上下文
   */
  async _executeMiddlewares(ctx) {
    let index = 0;
    
    const next = async () => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        await middleware(ctx, next);
      }
    };
    
    await next();
  }

  /**
   * 解析请求体
   * @private
   * @param {IncomingMessage} req - 请求对象
   * @returns {Promise<Object>} 解析后的对象
   */
  async _parseBody(req) {
    if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
      return {};
    }

    return new Promise((resolve, reject) => {
      let data = '';
      
      req.on('data', chunk => {
        data += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (error) {
          reject(new Error(`Invalid JSON: ${error.message}`));
        }
      });
      
      req.on('error', reject);
    });
  }

  /**
   * 发送 JSON 响应
   * @private
   * @param {ServerResponse} res - 响应对象
   * @param {number} statusCode - HTTP 状态码
   * @param {Object} data - 响应数据
   */
  _sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data));
  }

  /**
   * 发送错误响应
   * @private
   * @param {ServerResponse} res - 响应对象
   * @param {number} statusCode - HTTP 状态码
   * @param {string} message - 错误消息
   */
  _sendError(res, statusCode, message) {
    this._sendJSON(res, statusCode, {
      success: false,
      error: message,
      timestamp: Date.now()
    });
  }

  /**
   * 设置 SSE 响应头
   * @private
   * @param {ServerResponse} res - 响应对象
   */
  _setSSEHeaders(res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
  }

  /**
   * 记录请求日志
   * @private
   * @param {MiddlewareContext} ctx - 上下文
   * @param {number} duration - 请求耗时
   */
  _logRequest(ctx, duration) {
    this.requestLog.push({
      method: ctx.req.method,
      url: ctx.req.url,
      statusCode: ctx.res.statusCode,
      duration,
      timestamp: Date.now(),
      clientIp: ctx.req.socket.remoteAddress
    });

    // 限制日志大小
    if (this.requestLog.length > 10000) {
      this.requestLog = this.requestLog.slice(-5000);
    }
  }
}

/**
 * 创建 API Bridge 实例的工厂函数
 * @param {Object} options - 配置选项
 * @returns {OpenClawAPIBridge} API Bridge 实例
 */
export function createAPIBridge(options = {}) {
  return new OpenClawAPIBridge(options);
}
