/**
 * PDD Plugin Sandbox - 插件安全沙箱
 *
 * 为每个插件提供隔离的执行环境，限制文件系统、网络、
 * CPU/内存等资源访问，防止恶意或失控插件影响宿主系统。
 *
 * 核心安全策略:
 *   - 文件系统白名单：仅允许访问指定目录
 *   - 网络域名白名单：仅允许请求指定域名
 *   - 资源限制：最大内存和执行超时时间
 *   - 全局变量代理：受控访问 process/env 等
 *   - API 审计日志：记录所有敏感操作
 *
 * @module sandbox
 * @author PDD Team
 * @version 1.0.0
 * @license MIT
 */

import { readFile, writeFile, stat, readdir, access } from 'node:fs/promises';
import { join, resolve, isAbsolute, relative } from 'node:path';

// ==================== SandboxPolicy 策略配置 ====================

/**
 * 沙箱策略配置类
 * 定义插件执行时的各项安全约束
 *
 * @class SandboxPolicy
 *
 * @example
 * const policy = new SandboxPolicy({
 *   filesystem: { allowRead: true, allowWrite: false, rootDir: '/safe/dir' },
 *   network: { allowDomains: ['api.example.com'] },
 *   execution: { maxMemoryMB: 256, timeoutMs: 5000 }
 * });
 */
export class SandboxPolicy {
  /**
   * 创建沙箱策略实例
   * @param {Object} options - 策略选项
   * @param {Object} [options.filesystem={}] - 文件系统策略
   * @param {boolean} [options.filesystem.allowRead=true] - 是否允许读取文件
   * @param {boolean} [options.filesystem.allowWrite=false] - 是否允许写入文件
   * @param {string} [options.filesystem.rootDir=''] - 文件系统根目录（空表示不限制）
   * @param {string[]} [options.filesystem.allowExtensions=[]] - 允许的文件扩展名（空表示不限制）
   * @param {Object} [options.network={}] - 网络访问策略
   * @param {string[]} [options.network.allowDomains=[]] - 允许访问的域名白名单（空表示禁止所有网络）
   * @param {number} [options.network.maxRequests=100] - 最大请求数量（0 表示无限制）
   * @param {Object} [options.execution={}] - 执行资源策略
   * @param {number} [options.execution.maxMemoryMB=512] - 最大内存使用（MB）
   * @param {number} [options.execution.timeoutMs=30000] - 单次操作超时时间（毫秒）
   * @param {number} [options.execution.maxCpuTime=0] - 最大 CPU 时间（毫秒，0 表示不限制）
   * @param {Object} [options.environment={}] - 环境变量策略
   * @param {string[]} [options.environment.allowedEnvVars=[]] - 允许读取的环境变量名列表
   * @param {boolean} [options.auditEnabled=true] - 是否启用审计日志
   */
  constructor(options = {}) {
    const fs = options.filesystem || {};
    const net = options.network || {};
    const exec = options.execution || {};
    const env = options.environment || {};

    /** @type {Object} 文件系统策略 */
    this.filesystem = {
      allowRead: fs.allowRead !== false,
      allowWrite: !!fs.allowWrite,
      rootDir: fs.rootDir ? resolve(fs.rootDir) : '',
      allowExtensions: fs.allowExtensions || [],
    };

    /** @type {Object} 网络访问策略 */
    this.network = {
      allowDomains: net.allowDomains || [],
      maxRequests: net.maxRequests ?? 100,
    };

    /** @type {Object} 执行资源策略 */
    this.execution = {
      maxMemoryMB: exec.maxMemoryMB || 512,
      timeoutMs: exec.timeoutMs ?? 30000,
      maxCpuTime: exec.maxCpuTime || 0,
    };

    /** @type {Object} 环境变量策略 */
    this.environment = {
      allowedEnvVars: env.allowedEnvVars || [],
    };

    /** @type {boolean} 是否启用审计 */
    this.auditEnabled = options.auditEnabled !== false;
  }

  /**
   * 将策略序列化为可存储的 JSON 对象
   * @returns {Object}
   */
  toJSON() {
    return {
      filesystem: { ...this.filesystem },
      network: { ...this.network },
      execution: { ...this.execution },
      environment: { ...this.environment },
      auditEnabled: this.auditEnabled,
    };
  }

  /**
   * 从 JSON 对象恢复策略实例
   * @param {Object} data - 序列化的策略数据
   * @returns {SandboxPolicy}
   */
  static fromJSON(data) {
    return new SandboxPolicy(data);
  }
}

// ==================== AuditLog 审计日志 ====================

/**
 * 沙箱审计日志条目
 * @typedef {Object} AuditEntry
 * @property {number} timestamp - 时间戳
 * @property {string} action - 操作类型 (fs.read / fs.write / net.request / env.access)
 * @property {string} target - 操作目标（路径或域名）
 * @property {'allowed'|'denied'} result - 结果
 * @property {string} [reason] - 拒绝原因
 */

/**
 * 审计日志收集器
 * @class AuditLogger
 */
class AuditLogger {
  constructor(pluginName) {
    /** @type {string} 关联的插件名称 */
    this.pluginName = pluginName;
    /** @type {AuditEntry[]} 日志条目 */
    this.entries = [];
    /** @type {number} 最大保留条数 */
    this.maxEntries = 10000;
  }

  /**
   * 记录一条审计日志
   * @param {string} action - 操作类型
   * @param {string} target - 操作目标
   * @param {'allowed'|'denied'} result - 结果
   * @param {string} [reason] - 原因
   */
  log(action, target, result, reason) {
    const entry = {
      timestamp: Date.now(),
      action,
      target,
      result,
      reason: reason || undefined,
    };

    this.entries.push(entry);

    // 防止内存泄漏：超出上限时移除旧条目
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-Math.floor(this.maxEntries / 2));
    }
  }

  /**
   * 获取所有日志
   * @returns {AuditEntry[]}
   */
  getLogs() {
    return [...this.entries];
  }

  /**
   * 获取被拒绝的操作数量
   * @returns {number}
   */
  getDeniedCount() {
    return this.entries.filter(e => e.result === 'denied').length;
  }

  /**
   * 清空日志
   */
  clear() {
    this.entries = [];
  }
}

// ==================== Sandbox 主类 ====================

/**
 * 插件安全沙箱
 *
 * 为插件提供受限的运行环境，通过 Proxy 代理对危险 API 的访问。
 * 所有文件系统、网络和环境变量的访问都经过策略检查。
 *
 * 注意：Node.js 的 Worker Threads 或 VM 可提供更强的隔离能力，
 * 本实现侧重于 API 层面的访问控制和审计追踪。
 *
 * @class Sandbox
 *
 * @example
 * import { createSandbox, SandboxPolicy } from './sandbox.js';
 *
 * const policy = new SandboxPolicy({
 *   filesystem: { rootDir: '/tmp/plugins/my-plugin' },
 *   network: { allowDomains: [] }, // 禁止网络
 * });
 *
 * const sandbox = createSandbox('my-plugin', policy);
 * await sandbox.fs.readFile('/tmp/plugins/my-plugin/config.json');
 */
export class Sandbox {
  /**
   * 创建沙箱实例
   * @param {string} pluginName - 插件名称（用于审计标识）
   * @param {SandboxPolicy} policy - 安全策略
   */
  constructor(pluginName, policy) {
    if (!policy || !(policy instanceof SandboxPolicy)) {
      throw new Error('Sandbox 需要一个有效的 SandboxPolicy 实例');
    }

    /** @type {string} 插件名称 */
    this.pluginName = pluginName;

    /** @type {SandboxPolicy} 安全策略 */
    this.policy = policy;

    /** @type {AuditLogger} 审计日志器 */
    this._audit = new AuditLogger(pluginName);

    /** @type {number} 网络请求计数器 */
    this._requestCount = 0;

    // 初始化受控 API
    this.fs = this._createFsProxy();
    this.net = this._createNetProxy();
    this.env = this._createEnvProxy();

    // 内存监控定时器
    this._memoryMonitor = null;
    this._startMemoryMonitoring();
  }

  // ==================== 文件系统代理 ====================

  /**
   * 创建文件系统访问代理
   * 拦截所有文件操作并检查路径是否在白名单内
   * @returns {Proxy} 受控的文件系统对象
   * @private
   */
  _createFsProxy() {
    const self = this;
    const policy = this.policy.filesystem;

    /**
     * 检查路径是否被允许访问
     * @param {string} filePath - 待检查的路径
     * @param {boolean} isWrite - 是否为写操作
     * @returns {{ allowed: boolean, resolvedPath: string, reason?: string }}
     */
    const checkPath = (filePath, isWrite = false) => {
      let resolvedPath;

      try {
        resolvedPath = resolve(filePath);
      } catch {
        return { allowed: false, resolvedPath: filePath, reason: '无效的文件路径' };
      }

      // 写权限检查
      if (isWrite && !policy.allowWrite) {
        return { allowed: false, resolvedPath, reason: '策略禁止文件写入' };
      }

      // 读权限检查
      if (!isWrite && !policy.allowRead) {
        return { allowed: false, resolvedPath, reason: '策略禁止文件读取' };
      }

      // 根目录限制
      if (policy.rootDir) {
        const rel = relative(policy.rootDir, resolvedPath);
        if (rel.startsWith('..') || rel === filePath) {
          return {
            allowed: false,
            resolvedPath,
            reason: `路径 "${filePath}" 超出允许的根目录 ${policy.rootDir}`,
          };
        }
      }

      // 扩展名检查
      if (policy.allowExtensions.length > 0) {
        const ext = extname(resolvedPath).toLowerCase();
        if (ext && !policy.allowExtensions.includes(ext)) {
          return {
            allowed: false,
            resolvedPath,
            reason: `文件扩展名 "${ext}" 不在允许列表中`,
          };
        }
      }

      return { allowed: true, resolvedPath };
    };

    return new Proxy(
      {},
      {
        get(_, methodName) {
          return async (...args) => {
            const pathArg = args[0];

            // 根据方法名判断是读还是写
            const writeMethods = ['writeFile', 'appendFile', 'mkdir', 'rm', 'unlink'];
            const isWrite = writeMethods.includes(methodName);

            // 路径检查
            if (typeof pathArg === 'string') {
              const check = checkPath(pathArg, isWrite);

              self._audit.log(`fs.${methodName}`, pathArg, check.allowed, check.reason);

              if (!check.allowed) {
                throw new Error(
                  `[Sandbox:${self.pluginName}] 文件访问被拒绝: ${check.reason}`
                );
              }

              // 替换为解析后的绝对路径
              args[0] = check.resolvedPath;
            }

            // 应用超时包装
            return self._withTimeout(() => {
              switch (methodName) {
                case 'readFile':
                  return readFile(...args);
                case 'writeFile':
                  return writeFile(...args);
                case 'stat':
                  return stat(...args);
                case 'readdir':
                  return readdir(...args);
                case 'access':
                  return access(...args);
                default:
                  throw new Error(
                    `[Sandbox] 不支持的文件系统方法: ${methodName}`
                  );
              }
            });
          };
        },
      }
    );
  }

  // ==================== 网络访问代理 ====================

  /**
   * 创建网络访问代理
   * 限制可访问的域名和请求数量
   * @returns {Proxy} 受控的网络对象
   * @private
   */
  _createNetProxy() {
    const self = this;
    const policy = this.policy.network;

    return new Proxy(
      {},
      {
        get(_, methodName) {
          return async (urlOrOptions, ...restArgs) => {
            // 解析目标 URL
            let targetUrl;
            if (typeof urlOrOptions === 'string') {
              targetUrl = urlOrOptions;
            } else if (urlOrOptions?.hostname || urlOrOptions?.host) {
              targetUrl = urlOrOptions.hostname || urlOrOptions.host;
            } else {
              throw new Error('[Sandbox] 无法确定网络请求的目标地址');
            }

            // 从 URL 中提取域名
            let hostname = targetUrl;
            try {
              if (targetUrl.startsWith('http')) {
                hostname = new URL(targetUrl).hostname;
              }
            } catch {
              // 使用原始值
            }

            // 域名白名单检查
            const isAllowed =
              policy.allowDomains.length === 0
                ? false // 空白名单 = 禁止所有
                : policy.allowDomains.some(domain =>
                    hostname === domain || hostname.endsWith(`.${domain}`)
                  );

            self._audit.log(`net.${methodName}`, hostname, isAllowed,
              isAllowed ? undefined : `域名 "${hostname}" 不在白名单中`
            );

            if (!isAllowed) {
              throw new Error(
                `[Sandbox:${self.pluginName}] 网络访问被拒绝: 域名 "${hostname}" 未授权`
              );
            }

            // 请求数量限制
            if (policy.maxRequests > 0) {
              self._requestCount++;
              if (self._requestCount > policy.maxRequests) {
                throw new Error(
                  `[Sandbox:${self.pluginName}] 网络请求数超限 (${policy.maxRequests})`
                );
              }
            }

            // 实际的网络请求需要调用方提供 fetch 实现
            // 这里返回一个标记对象，由 PluginManager 注入真实 fetch
            return self._withTimeout(async () => {
              // 如果有注入的 fetch，使用它；否则抛出提示
              if (self._fetchImpl) {
                return self._fetchImpl(urlOrOptions, ...restArgs);
              }
              throw new Error(
                '[Sandbox] 未注入 fetch 实现，无法完成网络请求。' +
                '请在 PluginManager 中通过 sandbox.setFetch(fetchFn) 设置。'
              );
            });
          };
        },
      }
    );
  }

  // ==================== 环境变量代理 ====================

  /**
   * 创建环境变量访问代理
   * 仅允许读取白名单中的环境变量
   * @returns {Proxy} 受控的环境变量对象
   * @private
   */
  _createEnvProxy() {
    const self = this;
    const allowedVars = this.policy.environment.allowedEnvVars;

    return new Proxy(process.env, {
      get(target, prop) {
        if (typeof prop !== 'string') return undefined;

        const isAllowed =
          allowedVars.length === 0
            ? false // 空白名单 = 禁止访问
            : allowedVars.includes(prop);

        self._audit.log('env.access', prop, isAllowed,
          isAllowed ? undefined : `环境变量 "${prop}" 未在允许列表中`
        );

        if (!isAllowed) {
          throw new Error(
            `[Sandbox:${self.pluginName}] 环境变量访问被拒绝: "${prop}" 未授权`
          );
        }

        return Reflect.get(target, prop);
      },

      set() {
        throw new Error(
          `[Sandbox:${self.pluginName}] 环境变量修改被拒绝`
        );
      },

      ownKeys() {
        // 只列出允许的环境变量键
        return allowedVars.filter(key => key in process.env);
      },

      hasProperty(target, prop) {
        return allowedVars.includes(prop) && prop in target;
      },
    });
  }

  // ==================== 超时与资源控制 ====================

  /**
   * 为异步函数添加超时控制
   * @param {Function} fn - 要执行的异步函数
   * @returns {Promise<*>} 函数结果
   * @private
   */
  async _withTimeout(fn) {
    const timeoutMs = this.policy.execution.timeoutMs;

    if (timeoutMs <= 0) return fn();

    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(
          `[Sandbox:${this.pluginName}] 操作超时 (${timeoutMs}ms)`
        )), timeoutMs)
      ),
    ]);
  }

  /**
   * 启动内存监控
   * 定期检查当前进程内存使用情况
   * @private
   */
  _startMemoryMonitoring() {
    const intervalMs = 5000; // 每 5 秒检查一次
    const maxBytes = this.policy.execution.maxMemoryMB * 1024 * 1024;

    if (maxBytes <= 0) return; // 0 表示不限制

    this._memoryMonitor = setInterval(() => {
      const usage = process.memoryUsage();
      if (usage.heapUsed > maxBytes) {
        console.error(
          `[Sandbox:${this.pluginName}] ` +
          `内存超限: ${(usage.heapUsed / 1024 / 1024).toFixed(1)}MB / ` +
          `${this.policy.execution.maxMemoryMB}MB`
        );
        // 注意：这里只做警告，不强制杀掉进程（因为 Node.js 单进程模型）
        // 生产环境中建议配合 Worker Threads 实现真正的资源隔离
      }
    }, intervalMs).unref(); // unref 阻止定时器保持进程活跃
  }

  // ==================== 公共 API ====================

  /**
   * 设置网络请求实现（通常由 PluginManager 在初始化时注入）
   * @param {Function} fetchFn - fetch 函数实现
   */
  setFetch(fetchFn) {
    this._fetchImpl = fetchFn;
  }

  /**
   * 获取审计日志
   * @returns {AuditEntry[]}
   */
  getAuditLog() {
    return this._audit.getLogs();
  }

  /**
   * 被拒绝的操作计数
   * @returns {number}
   */
  getDeniedCount() {
    return this._audit.getDeniedCount();
  }

  /**
   * 获取当前网络请求计数
   * @returns {number}
   */
  getRequestCount() {
    return this._requestCount;
  }

  /**
   * 销毁沙箱，释放监控资源
   */
  destroy() {
    if (this._memoryMonitor) {
      clearInterval(this._memoryMonitor);
      this._memoryMonitor = null;
    }
    this._audit.clear();
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建沙箱实例的工厂函数
 *
 * @param {string} pluginName - 插件名称
 * @param {SandboxPolicy} [policy] - 安全策略（不传则使用默认严格策略）
 * @returns {Sandbox} 沙箱实例
 *
 * @example
 * // 默认策略（最严格：禁止一切外部访问）
 * const sandbox = createSandbox('my-plugin');
 *
 * // 自定义宽松策略
 * const looseSandbox = createSandbox('my-plugin', new SandboxPolicy({
 *   filesystem: { allowRead: true, allowWrite: true, rootDir: './data' },
 *   network: { allowDomains: ['api.example.com'], maxRequests: 50 },
 *   execution: { maxMemoryMB: 1024, timeoutMs: 60000 },
 * }));
 */
export function createSandbox(pluginName, policy) {
  // 默认策略：最严格的限制
  const defaultPolicy = policy || new SandboxPolicy({
    filesystem: { allowRead: true, allowWrite: false },
    network: { allowDomains: [] }, // 禁止所有网络
    execution: { maxMemoryMB: 256, timeoutMs: 10000 },
    environment: { allowedEnvVars: [] }, // 禁止访问环境变量
  });

  return new Sandbox(pluginName, defaultPolicy);
}

// ==================== 导出 ====================

export default Sandbox;
