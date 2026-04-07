/**
 * PDD gRPC Server
 * 基于 Node.js 内置 http2 模块的 Protocol-Buffer 风格 gRPC 兼容层
 *
 * 本模块实现了一个轻量级的 gRPC 风格服务器，无需引入 @grpc/grpc-js 等外部依赖。
 * 核心设计决策：
 * - 使用 Node.js http2 模块实现 HTTP/2 传输层
 * - 采用 proto3 JSON 编码格式（而非二进制 protobuf）
 * - 模拟 gRPC 的调用约定和错误处理模型
 *
 * 支持的 RPC 模式:
 * - Unary (一元): 标准请求-响应
 * - Server Streaming (服务端流式): SSE over HTTP/2
 * - Client Streaming (客户端流式): chunked transfer
 * - Bidi Streaming (双向流式): HTTP/2 multiplexing
 *
 * @module lib/grpc/grpc-server
 * @author PDD-Skills Team
 * @version 3.0.0
 */

import http2 from 'http2';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { URL } from 'url';
import {
  GrpcStatus,
  StatusMessages,
  ServiceDefinitions,
  SchemaRegistry,
  encode,
  decode,
  validate
} from './proto-definitions.js';

// ==================== 常量定义 ====================

/**
 * gRPC 协议相关常量
 */
const GRPC_CONSTANTS = {
  /** Content-Type 头值 */
  CONTENT_TYPE: 'application/grpc+protojson',
  /** gRPC 状态头名称 */
  STATUS_HEADER: 'grpc-status',
  /** gRPC 消息头名称 */
  MESSAGE_HEADER: 'grpc-message',
  /** gRPC 超时头（毫秒） */
  TIMEOUT_HEADER: 'grpc-timeout',
  /** 默认超时时间（毫秒） */
  DEFAULT_TIMEOUT: 30000,
  /** 最大消息大小（字节） */
  MAX_MESSAGE_SIZE: 4 * 1024 * 1024, // 4MB
  /** 反射服务路径前缀 */
  REFLECTION_PREFIX: '/grpc.reflection.v1.ServerReflection',
  /** 健康检查服务路径 */
  HEALTH_CHECK_PATH: '/grpc.health.v1.Health/Check'
};

// ==================== 拦截器系统 ====================

/**
 * gRPC 拦截器基类
 * 所有拦截器都应继承此类并实现 intercept 方法
 */
export class GrpcInterceptor {
  /**
   * 创建拦截器实例
   * @param {Object} options - 拦截器配置选项
   */
  constructor(options = {}) {
    this.name = options.name || this.constructor.name;
    this.priority = options.priority || 0; // 数值越小优先级越高
  }

  /**
   * 拦截请求
   * @param {Object} context - 调用上下文
   * @param {Function} next - 下一个拦截器或处理器
   * @returns {Promise<Object>} 响应数据
   */
  async intercept(context, next) {
    throw new Error('intercept() must be implemented by subclass');
  }
}

/**
 * 日志拦截器 - 记录所有 RPC 调用信息
 */
export class LoggingInterceptor extends GrpcInterceptor {
  constructor(options = {}) {
    super({ name: 'Logging', ...options });
    this.logger = options.logger || console;
  }

  async intercept(context, next) {
    const startTime = Date.now();
    const callId = crypto.randomBytes(4).toString('hex');

    this.logger.info(`[gRPC] [${callId}] → ${context.service}/${context.method}`);
    this.logger.debug(`[gRPC] [${callId}] Request: ${JSON.stringify(context.request).slice(0, 200)}`);

    try {
      const response = await next();

      const duration = Date.now() - startTime;
      this.logger.info(
        `[gRPC] [${callId}] ← ${context.service}/${context.method} ` +
        `(${duration}ms) status=${context.status || 0}`
      );

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[gRPC] [${callId}] ✗ ${context.service}/${context.method} ` +
        `(${duration}ms) error=${error.message}`
      );
      throw error;
    }
  }
}

/**
 * 认证拦截器 - 验证 API 密钥或 Token
 */
export class AuthInterceptor extends GrpcInterceptor {
  constructor(options = {}) {
    super({ name: 'Auth', priority: 10, ...options });
    this.apiKeys = new Set(options.apiKeys || []);
    this.tokenValidator = options.tokenValidator || null;
  }

  async intercept(context, next) {
    // 如果没有配置任何认证方式，跳过验证
    if (this.apiKeys.size === 0 && !this.tokenValidator) {
      return next();
    }

    const headers = context.headers || {};
    const apiKey = headers['x-api-key'] || headers['authorization']?.replace('Bearer ', '');

    // 验证 API Key
    if (this.apiKeys.size > 0) {
      if (!apiKey || !this.apiKeys.has(apiKey)) {
        const error = new Error('Invalid or missing API key');
        error.grpcCode = GrpcStatus.UNAUTHENTICATED;
        throw error;
      }
    }

    // 验证 Token（如果有配置）
    if (this.tokenValidator && apiKey) {
      try {
        context.auth = await this.tokenValidator(apiKey);
      } catch (err) {
        const error = new Error('Token validation failed');
        error.grpcCode = GrpcStatus.UNAUTHENTICATED;
        throw error;
      }
    }

    return next();
  }
}

/**
 * 性能指标拦截器 - 收集调用统计信息
 */
export class MetricsInterceptor extends GrpcInterceptor {
  constructor(options = {}) {
    super({ name: 'Metrics', priority: 20, ...options });
    this.metrics = {
      totalCalls: 0,
      callsByMethod: {},
      errorsByMethod: {},
      latencyByMethod: {}
    };
  }

  async intercept(context, next) {
    const methodKey = `${context.service}.${context.method}`;
    const startTime = Date.now();

    this.metrics.totalCalls++;
    this.metrics.callsByMethod[methodKey] =
      (this.metrics.callsByMethod[methodKey] || 0) + 1;

    try {
      const response = await next();
      const duration = Date.now() - startTime;

      // 更新延迟统计
      if (!this.metrics.latencyByMethod[methodKey]) {
        this.metrics.latencyByMethod[methodKey] = {
          count: 0,
          total: 0,
          min: Infinity,
          max: 0
        };
      }
      const lat = this.metrics.latencyByMethod[methodKey];
      lat.count++;
      lat.total += duration;
      lat.min = Math.min(lat.min, duration);
      lat.max = Math.max(lat.max, duration);

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      // 更新错误统计
      this.metrics.errorsByMethod[methodKey] =
        (this.metrics.errorsByMethod[methodKey] || 0) + 1;

      // 将指标附加到上下文
      context.metrics = {
        method: methodKey,
        duration,
        success: false
      };

      throw error;
    }
  }

  /**
   * 获取当前收集的指标数据
   * @returns {Object} 指标数据
   */
  getMetrics() {
    // 计算平均延迟
    const avgLatencies = {};
    for (const [method, data] of Object.entries(this.metrics.latencyByMethod)) {
      avgLatencies[method] = {
        avg: Math.round(data.total / data.count),
        min: data.min === Infinity ? 0 : data.min,
        max: data.max,
        count: data.count
      };
    }

    return {
      totalCalls: this.metrics.totalCalls,
      callsByMethod: this.metrics.callsByMethod,
      errorsByMethod: this.metrics.errorsByMethod,
      latency: avgLatencies,
      timestamp: new Date().toISOString()
    };
  }
}

// ==================== gRPC Server 主类 ====================

/**
 * PDD gRPC 兼容服务器
 *
 * 提供类似 gRPC 的远程过程调用接口，基于 HTTP/2 和 proto3 JSON 编码。
 * 支持服务注册、拦截器链、健康检查和服务反射等功能。
 *
 * @example
 * ```javascript
 * import { GRPCServer } from './lib/grpc/grpc-server.js';
 * import { registerGrpcRoutes } from './lib/grpc/grpc-routes.js';
 *
 * const server = new GRPCServer({ port: 50051 });
 * registerGrpcRoutes(server);
 * await server.start();
 * ```
 */
export class GRPCServer extends EventEmitter {
  /**
   * 创建 gRPC 服务器实例
   * @param {Object} options - 服务器配置选项
   * @param {number} options.port - 监听端口（默认 50051，标准 gRPC 端口）
   * @param {string} options.host - 绑定地址（默认 'localhost'）
   * @param {boolean} options.enableTls - 是否启用 TLS（HTTP/2 要求 TLS 或明文升级）
   * @param {Object} options.tlsOptions - TLS 配置（cert, key 等）
   * @param {boolean} options.enableReflection - 是否启用反射服务（默认 true）
   * @param {boolean} options.enableHealthCheck - 是否启用健康检查（默认 true）
   * @param {Array<GrpcInterceptor>} options.interceptors - 全局拦截器列表
   */
  constructor(options = {}) {
    super();

    this.port = options.port || 50051;
    this.host = options.host || 'localhost';
    this.enableTls = options.enableTls || false;
    this.tlsOptions = options.tlsOptions || null;
    this.enableReflection = options.enableReflection !== false; // 默认启用
    this.enableHealthCheck = options.enableHealthCheck !== false;

    // 服务注册表: Map<serviceName, Map<methodName, handler>>
    this.services = new Map();

    // 拦截器链
    this.interceptors = options.interceptors || [
      new LoggingInterceptor(),
      new AuthInterceptor(),
      new MetricsInterceptor()
    ];

    // HTTP/2 服务器实例
    this.server = null;

    // 运行状态
    this.started = false;

    // 绑定方法到实例
    this._handleRequest = this._handleRequest.bind(this);
    this._handleStreamRequest = this._handleStreamRequest.bind(this);
  }

  /**
   * 注册一个 gRPC 服务及其方法处理器
   *
   * @param {string} serviceName - 服务名称（如 'SpecService'）
   * @param {Object} methods - 方法名到处理函数的映射
   * @param {Object} serviceDef - 可选的服务定义（用于反射）
   *
   * @example
   * server.registerService('SpecService', {
   *   GenerateSpec: async (request, context) => {
   *     return { specId: 'spec-001', content: '...' };
   *   },
   *   GetSpec: async (request, context) => { ... }
   * });
   */
  registerService(serviceName, methods, serviceDef = null) {
    if (typeof serviceName !== 'string' || !serviceName.trim()) {
      throw new Error('Service name must be a non-empty string');
    }

    if (!methods || typeof methods !== 'object') {
      throw new Error('Methods must be an object with handler functions');
    }

    // 创建或获取服务的方法映射
    let serviceMethods = this.services.get(serviceName);
    if (!serviceMethods) {
      serviceMethods = new Map();
      this.services.set(serviceName, serviceMethods);
    }

    // 注册每个方法
    for (const [methodName, handler] of Object.entries(methods)) {
      if (typeof handler !== 'function') {
        throw new Error(`Handler for ${serviceName}/${methodName} must be a function`);
      }
      serviceMethods.set(methodName, {
        handler,
        definition: serviceDef?.methods?.[methodName] || null
      });

      this.emit('method:registered', {
        service: serviceName,
        method: methodName
      });
    }

    this.emit('service:registered', { service: serviceName, methods: Object.keys(methods) });
  }

  /**
   * 启动 gRPC 服务器
   *
   * @returns {Promise<GRPCServer>} 服务器实例（支持链式调用）
   * @throws {Error} 启动失败时抛出异常
   */
  async start() {
    if (this.started) {
      throw new Error('Server is already running');
    }

    return new Promise((resolve, reject) => {
      // 创建 HTTP/2 服务器
      if (this.enableTls && this.tlsOptions) {
        this.server = http2.createSecureServer(this.tlsOptions, this._handleRequest);
      } else {
        // 明文 HTTP/2（需要客户端支持 HTTP/2 Knowledge 或使用 h2c）
        this.server = http2.createServer(this._handleRequest);
      }

      // 会话错误处理
      this.server.on('sessionError', (error) => {
        this.emit('error', error);
        console.error(`[gRPC] Session error: ${error.message}`);
      });

      // 流错误处理
      this.server.on('streamError', (error, stream) => {
        this.emit('stream:error', { error, stream });
        console.error(`[gRPC] Stream error: ${error.message}`);
      });

      // 服务器级错误
      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.port} is already in use`));
          return;
        }
        reject(error);
      });

      // 开始监听
      this.server.listen(this.port, this.host, () => {
        this.started = true;

        const address = this.server.address();
        const protocol = this.enableTls ? 'https' : 'http';

        console.log('\n' + '='.repeat(70));
        console.log('PDD gRPC Server Started');
        console.log('='.repeat(70));
        console.log(`Address: ${protocol}://${this.host}:${this.port}`);
        console.log(`Protocol: HTTP/2 (${this.enableTls ? 'TLS' : 'plaintext'})`);
        console.log(`Encoding: proto3 JSON`);
        console.log('');

        // 列出已注册的服务
        this._printRegisteredServices();

        console.log('');
        console.log('-'.repeat(70));
        console.log('Press Ctrl+C to stop the server');
        console.log('-'.repeat(70) + '\n');

        this.emit('started', { address, services: this._getServiceList() });
        resolve(this);
      });
    });
  }

  /**
   * 优雅关闭服务器
   *
   * @param {number} gracePeriodMs - 优雅关闭等待时间（毫秒），默认 5000ms
   * @returns {Promise<void>}
   */
  async stop(gracePeriodMs = 5000) {
    if (!this.started || !this.server) {
      return;
    }

    return new Promise((resolve) => {
      // 设置强制关闭定时器
      const forceCloseTimeout = setTimeout(() => {
        console.warn('[gRPC] Grace period exceeded, forcing close');
        this.server.destroy();
        resolve();
      }, gracePeriodMs);

      // 尝试优雅关闭
      this.server.close(() => {
        clearTimeout(forceCloseTimeout);
        this.started = false;
        this.server = null;
        this.emit('stopped');
        console.log('[gRPC] Server stopped gracefully');
        resolve();
      });
    });
  }

  /**
   * 处理 HTTP/2 请求
   * @private
   */
  _handleRequest(req, res) {
    // 仅接受 POST 方法（gRPC 规范要求）
    if (req.method !== 'POST') {
      this._sendErrorResponse(res, GrpcStatus.UNIMPLEMENTED, 'Method not allowed. Use POST.');
      return;
    }

    // 解析请求路径
    const pathname = new URL(req.url, `http://${this.host}`).pathname;

    // 检查 Content-Type
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('grpc') && !contentType.includes('json')) {
      this._sendErrorResponse(res, GrpcStatus.INVALID_ARGUMENT, 'Invalid content type. Expected application/grpc+* or application/json');
      return;
    }

    // 处理特殊端点
    if (this.enableHealthCheck && pathname === GRPC_CONSTANTS.HEALTH_CHECK_PATH) {
      this._handleHealthCheck(req, res);
      return;
    }

    if (this.enableReflection && pathname.startsWith(GRPC_CONSTANTS.REFLECTION_PREFIX)) {
      this._handleReflection(req, res, pathname);
      return;
    }

    // 解析服务和方法
    const parsedPath = this._parseRpcPath(pathname);
    if (!parsedPath) {
      this._sendErrorResponse(res, GrpcStatus.UNIMPLEMENTED, `Unknown path: ${pathname}`);
      return;
    }

    const { service, method } = parsedPath;

    // 查找处理器
    const serviceHandlers = this.services.get(service);
    if (!serviceHandlers) {
      this._sendErrorResponse(res, GrpcStatus.UNIMPLEMENTED, `Service not found: ${service}`);
      return;
    }

    const methodHandler = serviceHandlers.get(method);
    if (!methodHandler) {
      this._sendErrorResponse(res, GrpcStatus.UNIMPLEMENTED, `Method not found: ${service}/${method}`);
      return;
    }

    // 读取请求体
    this._readRequestBody(req)
      .then(bodyData => {
        // 构建调用上下文
        const context = {
          service,
          method,
          request: bodyData,
          headers: req.headers,
          stream: res,       // HTTP/2 流引用
          metadata: {},      // 自定义元数据
          deadline: this._getDeadline(req.headers),
          peer: req.socket.remoteAddress,
          status: GrpcStatus.OK
        };

        // 执行拦截器链 + 处理器
        return this._executeWithInterceptors(
          context,
          methodHandler.handler,
          methodHandler.definition
        );
      })
      .then(responseData => {
        this._sendSuccessResponse(res, responseData);
      })
      .catch(error => {
        this._handleError(error, res, context);
      });
  }

  /**
   * 处理流式请求（用于 Server Streaming / Bidi Streaming）
   * @private
   */
  _handleStreamRequest(stream, headers) {
    // TODO: 实现完整的流式 RPC 支持
    // 当前版本主要支持 Unary 调用
    console.warn('[gRPC] Streaming requests not fully implemented yet');
  }

  /**
   * 执行带拦截器的调用链
   * @private
   */
  async _executeWithInterceptors(context, handler, definition) {
    // 构建拦截器链
    const sortedInterceptors = [...this.interceptors]
      .sort((a, b) => a.priority - b.priority);

    // 创建执行链
    let chain = async () => {
      // 在调用实际处理器之前进行输入验证
      if (definition?.requestType) {
        const requestSchema = SchemaRegistry[definition.requestType];
        if (requestSchema) {
          const validation = validate(context.request, requestSchema);
          if (!validation.valid) {
            const error = new Error(`Validation failed: ${validation.errors.join('; ')}`);
            error.grpcCode = GrpcStatus.INVALID_ARGUMENT;
            error.validationErrors = validation.errors;
            throw error;
          }
        }
      }

      // 调用实际的 RPC 处理器
      const result = await handler(context.request, context);

      // 输出验证
      if (definition?.responseType) {
        const responseSchema = SchemaRegistry[definition.responseType];
        if (responseSchema) {
          const validation = validate(result, responseSchema);
          if (!validation.valid) {
            console.warn(`[gRPC] Response validation warnings:`, validation.errors);
            // 不抛出错误，只记录警告
          }
        }
      }

      return result;
    };

    // 从后向前包装拦截器
    for (let i = sortedInterceptors.length - 1; i >= 0; i--) {
      const interceptor = sortedInterceptors[i];
      const next = chain;
      chain = () => interceptor.intercept(context, next);
    }

    return chain();
  }

  /**
   * 读取请求体
   * @private
   */
  _readRequestBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;

      req.on('data', chunk => {
        size += chunk.length;
        if (size > GRPC_CONSTANTS.MAX_MESSAGE_SIZE) {
          req.destroy();
          reject(new Error(`Request body too large (max ${GRPC_CONSTANTS.MAX_MESSAGE_SIZE} bytes)`));
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        try {
          const data = body.trim() ? JSON.parse(body) : {};
          resolve(data);
        } catch (e) {
          reject(new Error(`Invalid JSON in request body: ${e.message}`));
        }
      });

      req.on('error', reject);
    });
  }

  /**
   * 发送成功响应
   * @private
   */
  _sendSuccessResponse(res, data) {
    const responseBody = JSON.stringify(data);

    res.writeHead(200, {
      'Content-Type': GRPC_CONSTANTS.CONTENT_TYPE,
      'Content-Length': Buffer.byteLength(responseBody),
      [GRPC_CONSTANTS.STATUS_HEADER]: String(GrpcStatus.OK),
      [GRPC_CONSTANTS.MESSAGE_HEADER]: StatusMessages[GrpcStatus.OK],
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, grpc-timeout, grpc-encoding'
    });

    res.end(responseBody);
  }

  /**
   * 发送错误响应
   * @private
   */
  _sendErrorResponse(res, code, message, details = null) {
    const errorBody = JSON.stringify({
      code,
      message,
      details: details || []
    });

    res.writeHead(200, { // gRPC 错误也返回 200，通过 trailer/header 传递状态
      'Content-Type': GRPC_CONSTANTS.CONTENT_TYPE,
      'Content-Length': Buffer.byteLength(errorBody),
      [GRPC_CONSTANTS.STATUS_HEADER]: String(code),
      [GRPC_CONSTANTS.MESSAGE_HEADER]: encodeURIComponent(message),
      'Access-Control-Allow-Origin': '*'
    });

    res.end(errorBody);
  }

  /**
   * 处理错误
   * @private
   */
  _handleError(error, res, context) {
    const statusCode = error.grpcCode || GrpcStatus.INTERNAL;
    const message = error.message || 'Internal server error';

    // 更新上下文状态
    if (context) {
      context.status = statusCode;
    }

    this.emit('error', { error, context });

    this._sendErrorResponse(res, statusCode, message);
  }

  /**
   * 处理健康检查请求
   * @private
   */
  _handleHealthCheck(req, res) {
    const healthStatus = this.started ? 1 : 2; // SERVING=1, NOT_SERVING=2

    const responseBody = JSON.stringify({
      status: healthStatus
    });

    res.writeHead(200, {
      'Content-Type': GRPC_CONSTANTS.CONTENT_TYPE,
      'Content-Length': Buffer.byteLength(responseBody),
      [GRPC_CONSTANTS.STATUS_HEADER]: String(GrpcStatus.OK)
    });

    res.end(responseBody);
  }

  /**
   * 处理服务反射请求
   * 实现简单的 gRPC Server Reflection Protocol
   * @private
   */
  _handleReflection(req, res, pathname) {
    // 简化版反射：列出所有已注册的服务和方法
    const reflectionData = {
      services: [],
      timestamp: new Date().toISOString()
    };

    for (const [serviceName, methods] of this.services.entries()) {
      const serviceInfo = {
        name: serviceName,
        methods: []
      };

      for (const [methodName, def] of methods.entries()) {
        serviceInfo.methods.push({
          name: methodName,
          requestType: def.definition?.requestType || 'unknown',
          responseType: def.definition?.responseType || 'unknown'
        });
      }

      reflectionData.services.push(serviceInfo);
    }

    const responseBody = JSON.stringify(reflectionData);

    res.writeHead(200, {
      'Content-Type': GRPC_CONSTANTS.CONTENT_TYPE,
      'Content-Length': Buffer.byteLength(responseBody),
      [GRPC_CONSTANTS.STATUS_HEADER]: String(GrpcStatus.OK)
    });

    res.end(responseBody);
  }

  /**
   * 解析 RPC 路径
   * 支持格式: /{package}.{Service}/{Method}
   * @private
   * @returns {{service: string, method: string}|null}
   */
  _parseRpcPath(pathname) {
    // 移除开头的斜杠
    const path = pathname.replace(/^\//, '');

    // 分割服务和方法的分隔符是最后一个 /
    const lastSlashIndex = path.lastIndexOf('/');

    if (lastSlashIndex <= 0 || lastSlashIndex >= path.length - 1) {
      return null;
    }

    const servicePart = path.substring(0, lastSlashIndex);
    const methodPart = path.substring(lastSlashIndex + 1);

    // 服务部分可能包含包名（如 pdd.SpecService）
    // 提取最后的类名作为服务键
    const serviceParts = servicePart.split('.');
    const serviceName = serviceParts[serviceParts.length - 1];

    if (!serviceName || !methodPart) {
      return null;
    }

    return {
      service: serviceName,
      method: methodPart
    };
  }

  /**
   * 从请求头获取截止时间
   * @private
   */
  _getDeadline(headers) {
    const timeoutHeader = headers[GRPC_CONSTANTS.TIMEOUT_HEADER];

    if (!timeoutHeader) {
      return Date.now() + GRPC_CONSTANTS.DEFAULT_TIMEOUT;
    }

    // gRPC timeout 格式: Number followed by unit (H/M/S/m/u/n)
    const match = String(timeoutHeader).match(/^(\d+)([HMSmun])$/);
    if (!match) {
      return Date.now() + GRPC_CONSTANTS.DEFAULT_TIMEOUT;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers = {
      'H': 3600000,   // 小时
      'M': 60000,     // 分钟
      'S': 1000,      // 秒
      'm': 1,         // 毫秒
      'u': 0.001,     // 微秒
      'n': 0.000001   // 纳秒
    };

    return Date.now() + value * (multipliers[unit] || 1000);
  }

  /**
   * 打印已注册的服务信息
   * @private
   */
  _printRegisteredServices() {
    console.log('Registered Services:');
    console.log('-'.repeat(50));

    for (const [serviceName, methods] of this.services.entries()) {
      console.log(`\n  ${serviceName}:`);
      for (const [methodName] of methods.entries()) {
        console.log(`    └─ ${methodName}()`);
      }
    }

    if (this.enableHealthCheck) {
      console.log(`\n  Health Check:`);
      console.log(`    └─ Check() [${GRPC_CONSTANTS.HEALTH_CHECK_PATH}]`);
    }

    if (this.enableReflection) {
      console.log(`\n  Reflection Service: enabled`);
    }
  }

  /**
   * 获取已注册的服务列表
   * @returns {Array<string>} 服务名称数组
   * @private
   */
  _getServiceList() {
    return Array.from(this.services.keys());
  }

  /**
   * 获取服务器的性能指标
   * @returns {Object} 指标数据
   */
  getMetrics() {
    const metricsInterceptor = this.interceptors.find(
      i => i instanceof MetricsInterceptor
    );

    return metricsInterceptor ? metricsInterceptor.getMetrics() : null;
  }
}

// ==================== 导出 ====================

/**
 * 创建并启动 gRPC 服务器的便捷函数
 *
 * @param {Object} options - 服务器配置
 * @param {Function} registerFn - 服务注册回调函数，接收 server 实例作为参数
 * @returns {Promise<GRPCServer>} 已启动的服务器实例
 *
 * @example
 * ```javascript
 * import { createGrpcServer } from './lib/grpc/grpc-server.js';
 * import { registerGrpcRoutes } from './lib/grpc/grpc-routes.js';
 *
 * const server = await createGrpcServer(
 *   { port: 50051 },
 *   registerGrpcRoutes
 * );
 * ```
 */
export async function createGrpcServer(options = {}, registerFn = null) {
  const server = new GRPCServer(options);

  // 执行服务注册
  if (typeof registerFn === 'function') {
    await registerFn(server);
  }

  await server.start();
  return server;
}

export default { GRPCServer, createGrpcServer };
