/**
 * PDD API Server
 * 基于Node.js内置http模块的RESTful API服务器
 * 提供远程调用PDD能力的接口
 */

import http from 'http';
import { URL } from 'url';
import { apiRoutes } from './api-routes.js';

// 引入chalk用于彩色输出
let chalk;
try {
  const chalkModule = await import('chalk');
  chalk = chalkModule.default;
} catch {
  chalk = {
    cyan: (s) => s,
    green: (s) => s,
    yellow: (s) => s,
    red: (s) => s,
    blue: (s) => s,
    magenta: (s) => s
  };
}

/**
 * 创建HTTP响应的辅助函数
 */
function createResponse(res, statusCode, data, headers = {}) {
  const body = JSON.stringify(data);
  
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...headers
  });
  
  res.end(body);
}

/**
 * 解析请求体
 * @param {http.IncomingMessage} req - HTTP请求对象
 * @returns {Promise<Object>} 解析后的请求体
 */
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
      // 防止超大请求体（限制为10MB）
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    
    req.on('end', () => {
      try {
        if (body) {
          resolve(JSON.parse(body));
        } else {
          resolve({});
        }
      } catch (error) {
        reject(new Error('Invalid JSON in request body'));
      }
    });
    
    req.on('error', reject);
  });
}

/**
 * CORS预检请求处理
 * @param {http.ServerResponse} res - HTTP响应对象
 */
function handleCorsPreflight(req, res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  });
  res.end();
}

/**
 * 请求日志中间件
 * @param {http.IncomingMessage} req - HTTP请求对象
 */
function logRequest(req, method, pathname) {
  const timestamp = new Date().toISOString();
  const clientIp = req.socket.remoteAddress;
  
  console.log(
    `${chalk.gray(timestamp)} ` +
    `${method === 'GET' ? chalk.green(method) : method === 'POST' ? chalk.blue(method) : chalk.yellow(method)} ` +
    `${chalk.cyan(pathname)} ` +
    `${chalk.gray(`from ${clientIp}`)}`
  );
}

/**
 * 简单的速率限制器
 */
class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map(); // IP -> [{timestamp}]
  }

  /**
   * 检查是否允许请求
   * @param {string} ip - 客户端IP
   * @returns {boolean} 是否允许
   */
  isAllowed(ip) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // 获取该IP的请求记录，并清理过期记录
    let requests = this.requests.get(ip) || [];
    requests = requests.filter(r => r.timestamp > windowStart);

    if (requests.length >= this.maxRequests) {
      return false; // 超过限制
    }

    // 记录本次请求
    requests.push({ timestamp: now });
    this.requests.set(ip, requests);

    return true;
  }

  /**
   * 清理所有记录（定期调用）
   */
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [ip, requests] of this.requests.entries()) {
      const validRequests = requests.filter(r => r.timestamp > windowStart);
      if (validRequests.length === 0) {
        this.requests.delete(ip);
      } else {
        this.requests.set(ip, validRequests);
      }
    }
  }
}

/**
 * 启动API服务器
 * @param {Object} options - 服务器配置选项
 * @param {number} options.port - 监听端口
 * @param {string} options.host - 绑定地址
 * @param {boolean} options.cors - 是否启用CORS
 */
export async function startApiServer(options = {}) {
  const {
    port = 3000,
    host = 'localhost',
    cors = true,
    rateLimit = { enabled: true, maxRequests: 100, windowMs: 60000 }
  } = options;

  // 初始化速率限制器
  const rateLimiter = rateLimit.enabled 
    ? new RateLimiter(rateLimit.maxRequests, rateLimit.windowMs)
    : null;

  // 定期清理速率限制记录
  if (rateLimiter) {
    setInterval(() => rateLimiter.cleanup(), 60000);
  }

  // 创建HTTP服务器
  const server = http.createServer(async (req, res) => {
    try {
      // 解析URL
      const parsedUrl = new URL(req.url, `http://${req.host}`);
      const pathname = decodedURIComponent(parsedUrl.pathname);
      const method = req.method.toUpperCase();

      // 记录请求日志
      logRequest(req, method, pathname);

      // CORS预检请求
      if (cors && method === 'OPTIONS') {
        handleCorsPreflight(req, res);
        return;
      }

      // 速率检查
      if (rateLimiter) {
        const clientIp = req.socket.remoteAddress;
        if (!rateLimiter.isAllowed(clientIp)) {
          createResponse(res, 429, {
            error: 'Too Many Requests',
            message: '请求过于频繁，请稍后再试',
            retryAfter: Math.ceil(rateLimit.windowMs / 1000)
          }, { 'Retry-After': Math.ceil(rateLimit.windowMs / 1000) });
          return;
        }
      }

      // 查找匹配的路由
      const routeHandler = findRoute(method, pathname);

      if (routeHandler) {
        // POST/PUT请求需要解析请求体
        let body = {};
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
          try {
            body = await parseRequestBody(req);
          } catch (error) {
            createResponse(res, 400, {
              error: 'Bad Request',
              message: error.message
            });
            return;
          }
        }

        // 执行路由处理器
        try {
          const result = await routeHandler({
            method,
            pathname,
            query: Object.fromEntries(parsedUrl.searchParams),
            body,
            headers: req.headers,
            params: extractRouteParams(routeHandler.route, pathname)
          });

          createResponse(res, 200, {
            success: true,
            data: result,
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          console.error(chalk.red(`路由执行错误: ${error.message}`));
          createResponse(res, 500, {
            error: 'Internal Server Error',
            message: process.env.NODE_ENV === 'development' 
              ? error.message 
              : '服务器内部错误'
          });
        }

      } else {
        // 未找到路由
        createResponse(res, 404, {
          error: 'Not Found',
          message: `未找到路由: ${method} ${pathname}`,
          availableRoutes: getAvailableRoutes()
        });
      }

    } catch (error) {
      console.error(chalk.red(`服务器错误: ${error.message}`));
      
      if (!res.headersSent) {
        createResponse(res, 500, {
          error: 'Internal Server Error',
          message: '服务器发生未知错误'
        });
      }
    }
  });

  // 错误处理
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(chalk.red(`\n❌ 端口 ${port} 已被占用!\n`));
      console.error(`请尝试:\n  1. 更换端口号: pdd api -p ${parseInt(port) + 1}`);
      console.error(`  2. 关闭占用端口的进程\n`);
      process.exit(1);
    } else {
      console.error(chalk.red(`\n❌ 服务器启动失败: ${error.message}\n`));
      process.exit(1);
    }
  });

  // 启动服务器
  server.listen(port, host, () => {
    console.log('\n' + '='.repeat(70));
    console.log(chalk.green.bold('🚀 PDD API Server 已启动'));
    console.log('='.repeat(70) + '\n');
    console.log(`本地访问: ${chalk.cyan(`http://${host}:${port}`)}`);
    console.log(`API文档:  ${chalk.cyan(`http://${host}:${port}/api/v1/docs`)}`);
    console.log(`服务状态:  ${chalk.cyan(`http://${host}:${port}/api/v1/status`)}`);
    console.log('');
    console.log(chalk.yellow('可用API端点:'));
    printAvailableRoutes(host, port);
    console.log('\n' + '-'.repeat(70));
    console.log(chalk.gray('按 Ctrl+C 停止服务器'));
    console.log('-'.repeat(70) + '\n');
  });

  // 优雅关闭
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n🛑 正在关闭服务器...'));
    server.close(() => {
      console.log(chalk.green('✅ 服务器已关闭\n'));
      process.exit(0);
    });
  });

  return server;
}

/**
 * 查找匹配的路由处理器
 * @param {string} method - HTTP方法
 * @param {string} pathname - 路径
 * @returns {Function|null} 路由处理器函数
 */
function findRoute(method, pathname) {
  for (const route of apiRoutes) {
    if (route.method !== method) continue;

    // 将路由模式转换为正则表达式
    const pattern = route.path
      .replace(/:[^/]+/g, '[^/]+')  // 将 :param 替换为匹配任意字符
      .replace(/\//g, '\\/');         // 转义斜杠

    const regex = new RegExp(`^${pattern}$`);
    
    if (regex.test(pathname)) {
      routeHandler = route.handler;
      routeHandler.route = route.path;  // 保存原始路由用于参数提取
      return routeHandler;
    }
  }

  return null;
}

/**
 * 从路径中提取路由参数
 * @param {string} routePattern - 路由模式
 * @param {string} actualPath - 实际路径
 * @returns {Object} 参数对象
 */
function extractRouteParams(routePattern, actualPath) {
  const params = {};
  
  const patternParts = routePattern.split('/');
  const pathParts = actualPath.split('/');

  patternParts.forEach((part, index) => {
    if (part.startsWith(':')) {
      const paramName = part.slice(1);
      params[paramName] = pathParts[index];
    }
  });

  return params;
}

/**
 * 获取可用路由列表
 * @returns {Array} 路由列表
 */
function getAvailableRoutes() {
  return apiRoutes.map(route => ({
    method: route.method,
    path: route.path,
    description: route.description
  }));
}

/**
 * 打印可用路由信息
 * @param {string} host - 主机名
 * @param {number} port - 端口
 */
function printAvailableRoutes(host, port) {
  const baseUrl = `http://${host}:${port}`;
  
  for (const route of apiRoutes) {
    const methodColor = {
      'GET': chalk.green,
      'POST': chalk.blue,
      'PUT': chalk.yellow,
      'DELETE': chalk.red
    };

    const colorFn = methodColor[route.method] || chalk.white;
    console.log(
      `  ${colorFn(route.method.padEnd(6))} ${baseUrl}${chalk.cyan(route.path)}` +
      (route.description ? chalk.gray(` - ${route.description}`) : '')
    );
  }
}

export default { startApiServer };
