/**
 * PDD Visual Manager - Dashboard HTTP Server (VM-B001)
 *
 * 基于 Node.js 内置 http 模块的 Dashboard 服务器
 * 提供静态文件托管、REST API 路由和 SSE 端点
 *
 * @module vm/dashboard/server
 */

import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

import { routeMatcher, handleAPIRequest } from './api-routes.js';
import { SSEManager } from './sse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 可选的 chalk 彩色输出支持
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
    magenta: (s) => s,
    bold: (s) => s
  };
}

/**
 * MIME 类型映射表
 * @type {Object<string, string>}
 */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

/**
 * 默认配置选项
 * @type {Object}
 */
const DEFAULT_OPTIONS = {
  open: false,
  host: '127.0.0.1',
  refreshInterval: 30000
};

/**
 * DashboardServer 类
 * 管理 Dashboard 的 HTTP 服务器生命周期
 */
class DashboardServer {
  /**
   * 创建 DashboardServer 实例
   * @param {Object} dataProvider - PDDDataProvider 实例
   */
  constructor(dataProvider) {
    this.dataProvider = dataProvider;
    this.server = null;
    this.sseManager = new SSEManager();
    this.port = null;
    this.options = { ...DEFAULT_OPTIONS };
    this._isRunning = false;
  }

  /**
   * 启动 HTTP 服务器
   * @param {number} port - 监听端口号
   * @param {Object} [options={}] - 配置选项
   * @param {boolean} [options.open=false] - 是否自动打开浏览器
   * @param {string} [options.host='127.0.0.1'] - 绑定地址
   * @param {number} [options.refreshInterval=30000] - 刷新间隔（毫秒）
   * @returns {Promise<number>} 实际监听的端口号
   */
  async start(port, options = {}) {
    if (this._isRunning) {
      console.log(chalk.yellow('[Dashboard] 服务器已在运行中'));
      return this.port;
    }

    // 合并配置选项
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // 尝试绑定端口（自动处理端口冲突）
    const actualPort = await this._findAvailablePort(port, this.options.host);
    this.port = actualPort;

    // 创建 HTTP 服务器
    this.server = http.createServer((req, res) => this._handleRequest(req, res));

    // 启动 SSE 心跳
    this.sseManager.startHeartbeat();

    return new Promise((resolve, reject) => {
      this.server.listen(actualPort, this.options.host, () => {
        this._isRunning = true;
        const url = `http://${this.options.host}:${actualPort}`;
        console.log(chalk.green(`[Dashboard] 服务器已启动: ${chalk.cyan(url)}`));
        console.log(chalk.gray(`[Dashboard] 按 Ctrl+C 停止服务器`));

        // 自动打开浏览器
        if (this.options.open) {
          this._openBrowser(url);
        }

        resolve(actualPort);
      });

      this.server.on('error', (err) => {
        console.error(chalk.red(`[Dashboard] 服务器启动失败:`), err.message);
        reject(err);
      });
    });
  }

  /**
   * 优雅关闭服务器
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this._isRunning) {
      return;
    }

    console.log(chalk.yellow('[Dashboard] 正在关闭服务器...'));

    // 关闭所有 SSE 连接
    this.sseManager.closeAll();

    // 停止心跳定时器
    this.sseManager.stopHeartbeat();

    // 关闭 HTTP 服务器
    return new Promise((resolve) => {
      this.server.close(() => {
        this._isRunning = false;
        this.server = null;
        this.port = null;
        console.log(chalk.green('[Dashboard] 服务器已关闭'));
        resolve();
      });

      // 强制关闭超时连接（5秒后强制关闭）
      setTimeout(() => {
        if (this._isRunning) {
          // 对于仍在运行的连接，直接销毁
          resolve();
        }
      }, 5000);
    });
  }

  /**
   * 获取服务器状态
   * @returns {boolean} 服务器是否运行中
   */
  isRunning() {
    return this._isRunning;
  }

  /**
   * 获取当前监听 URL
   * @returns {string|null}
   */
  getUrl() {
    if (!this._isRunning || !this.port) return null;
    return `http://${this.options.host}:${this.port}`;
  }

  /**
   * 处理 HTTP 请求（内部方法）
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @private
   */
  _handleRequest(req, res) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodedURI(parsedUrl.pathname);

    // 设置 CORS 头
    this._setCORSHeaders(res);

    // 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // 路由分发
      if (pathname === '/' || pathname === '/index.html') {
        this._serveStaticFile(res, 'index.html', 'text/html; charset=utf-8');
      } else if (pathname.startsWith('/api/')) {
        // API 路由
        handleAPIRequest(req, res, pathname, this.dataProvider, this.sseManager);
      } else if (pathname === '/sse') {
        // SSE 端点
        this.sseManager.handleConnection(req, res);
      } else if (pathname.startsWith('/css/') || pathname.startsWith('/js/') || pathname.startsWith('/assets/')) {
        // 静态文件
        this._serveStaticFile(res, pathname.substring(1));
      } else {
        // 404
        this._sendJSON(res, 404, { error: 'Not Found', path: pathname });
      }
    } catch (err) {
      console.error(chalk.red(`[Dashboard] 请求处理错误:`), err);
      this._sendJSON(res, 500, { error: 'Internal Server Error', message: err.message });
    }
  }

  /**
   * 设置 CORS 响应头
   * @param {http.ServerResponse} res
   * @private
   */
  _setCORSHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  /**
   * 提供静态文件服务
   * @param {http.ServerResponse} res
   * @param {string} filePath - 相对于 static 目录的文件路径
   * @param {string} [contentType] - 显式指定的 Content-Type
   * @private
   */
  _serveStaticFile(res, filePath, contentType) {
    const staticDir = path.join(__dirname, 'static');
    const fullPath = path.join(staticDir, filePath);

    // 安全检查：防止路径遍历攻击
    if (!fullPath.startsWith(staticDir)) {
      this._sendJSON(res, 403, { error: 'Forbidden' });
      return;
    }

    fs.readFile(fullPath, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          this._sendJSON(res, 404, { error: 'File Not Found', path: filePath });
        } else {
          this._sendJSON(res, 500, { error: 'Internal Server Error' });
        }
        return;
      }

      // 确定 Content-Type
      const ext = path.extname(filePath).toLowerCase();
      const type = contentType || MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': data.length,
        'Cache-Control': 'public, max-age=3600'
      });
      res.end(data);
    });
  }

  /**
   * 发送 JSON 响应
   * @param {http.ServerResponse} res
   * @param {number} statusCode
   * @param {Object} data
   * @private
   */
  _sendJSON(res, statusCode, data) {
    const body = JSON.stringify(data);
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
  }

  /**
   * 查找可用端口（带冲突检测）
   * @param {number} startPort - 起始端口
   * @param {string} host - 绑定地址
   * @returns {Promise<number>} 可用端口
   * @private
   */
  async _findAvailablePort(startPort, host) {
    let port = startPort;
    const maxAttempts = 100;

    for (let i = 0; i < maxAttempts; i++) {
      const isAvailable = await this._checkPortAvailable(port, host);
      if (isAvailable) {
        return port;
      }
      console.log(chalk.yellow(`[Dashboard] 端口 ${port} 已占用，尝试 ${port + 1}`));
      port++;
    }

    throw new Error(`无法在 ${startPort}-${port} 范围内找到可用端口`);
  }

  /**
   * 检查端口是否可用
   * @param {number} port
   * @param {string} host
   * @returns {Promise<boolean>}
   * @private
   */
  _checkPortAvailable(port, host) {
    return new Promise((resolve) => {
      const tester = http.createServer();

      tester.once('error', () => resolve(false));
      tester.once('listening', () => {
        tester.once('close', () => resolve(true));
        tester.close();
      });

      tester.listen(port, host);
    });
  }

  /**
   * 自动打开浏览器
   * @param {string} url - 要打开的 URL
   * @private
   */
  _openBrowser(url) {
    const platform = process.platform;
    let command;

    switch (platform) {
      case 'darwin':
        command = `open "${url}"`;
        break;
      case 'win32':
        command = `start "" "${url}"`;
        break;
      default:
        command = `xdg-open "${url}"`;
        break;
    }

    exec(command, (err) => {
      if (err) {
        console.log(chalk.yellow(`[Dashboard] 无法自动打开浏览器，请手动访问: ${url}`));
      } else {
        console.log(chalk.green('[Dashboard] 已在默认浏览器中打开'));
      }
    });
  }
}

/**
 * 解码 URI（处理中文路径）
 * @param {string} uri
 * @returns {string}
 */
function decodedURI(uri) {
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
}

export { DashboardServer };
export default DashboardServer;
