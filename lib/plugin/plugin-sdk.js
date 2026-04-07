/**
 * PDD Plugin SDK - 插件开发工具包
 *
 * 提供插件基类、上下文对象和清单验证器，定义 PDD 插件系统的标准接口。
 * 所有插件必须继承 PluginBase 并实现其生命周期方法。
 *
 * @module plugin-sdk
 * @author PDD Team
 * @version 1.0.0
 * @license MIT
 */

import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ==================== 插件状态枚举 ====================

/**
 * 插件生命周期状态
 * @enum {string}
 */
export const PluginStatus = {
  /** 已安装，尚未加载 */
  INSTALLED: 'installed',
  /** 已加载到内存 */
  LOADED: 'loaded',
  ** 已激活，可正常使用 */
  ACTIVATED: 'activated',
  /** 已停用 */
  DEACTIVATED: 'deactivated',
  /** 已卸载 */
  UNINSTALLED: 'uninstalled',
  /** 加载或激活出错 */
  ERROR: 'error',
};

// ==================== PluginManifest 清单验证器 ====================

/**
 * 插件清单验证器
 * 负责验证 plugin.json 文件的格式和必填字段
 *
 * @class PluginManifest
 */
export class PluginManifest {
  /**
   * 创建插件清单实例
   * @param {Object} manifest - 原始清单数据
   * @param {string} manifest.name - 插件名称（必填）
   * @param {string} manifest.version - 插件版本（必填）
   * @param {string} [manifest.description] - 插件描述
   * @param {string} [manifest.main] - 入口文件（默认 index.js）
   * @param {string} [manifest.pdd] - 兼容的 PDD 版本范围
   * @param {string[]} [manifest.hooks] - 注册的钩子列表
   * @param {Object} [manifest.dependencies] - 依赖声明
   * @param {Object} [manifest.peerDependencies] - 对等依赖
   * @param {string} [manifest.author] - 作者
   * @param {string} [manifest.license] - 许可证
   * @param {string[]} [manifest.keywords] - 关键词
   */
  constructor(manifest) {
    this.raw = manifest;
    this.errors = [];
    this.warnings = [];
  }

  /**
   * 验证清单数据是否合法
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  validate() {
    this.errors = [];
    this.warnings = [];

    // 必填字段检查
    if (!this.raw.name) {
      this.errors.push('缺少必填字段: name');
    } else if (!/^[a-z][a-z0-9-_]*$/.test(this.raw.name)) {
      this.errors.push(`name 格式无效: "${this.raw.name}"，仅允许小写字母、数字、连字符和下划线`);
    }

    if (!this.raw.version) {
      this.errors.push('缺少必填字段: version');
    } else if (!/^\d+\.\d+\.\d+/.test(this.raw.version)) {
      this.errors.push(`version 格式无效: "${this.raw.version}"，应为语义化版本`);
    }

    // 可选字段默认值
    if (!this.raw.main) {
      this.raw.main = 'index.js';
      this.warnings.push('未指定 main 字段，使用默认值: index.js');
    }

    if (!this.raw.pdd) {
      this.raw.pdd = '>=1.0.0';
      this.warnings.push('未指定 pdd 兼容版本，使用默认值: >=1.0.0');
    }

    // hooks 格式验证
    if (this.raw.hooks && !Array.isArray(this.raw.hooks)) {
      this.errors.push('hooks 字段必须是数组');
    }

    return {
      valid: this.errors.length === 0,
      errors: [...this.errors],
      warnings: [...this.warnings],
    };
  }

  /**
   * 从文件路径加载并验证清单
   * @param {string} manifestPath - plugin.json 的绝对路径
   * @returns {Promise<PluginManifest>}
   * @throws {Error} 文件读取失败时抛出异常
   */
  static async load(manifestPath) {
    const content = await readFile(manifestPath, 'utf-8');
    const data = JSON.parse(content);
    const manifest = new PluginManifest(data);
    return manifest;
  }
}

// ==================== PluginContext 运行时上下文 ====================

/**
 * 插件运行时上下文
 * 为插件提供配置访问、日志记录、缓存和 API 调用能力
 *
 * @class PluginContext
 */
export class PluginContext {
  /**
   * 创建插件上下文实例
   * @param {Object} options - 上下文配置选项
   * @param {Object} options.config - 插件配置对象
   * @param {Object} options.logger - 日志记录器（需实现 info/warn/error/debug 方法）
   * @param {Map} options.cache - 共享缓存实例
   * @param {Object} options.api - PDD 核心 API 对象
   * @param {string} options.pluginDir - 插件根目录绝对路径
   */
  constructor({ config = {}, logger = null, cache = null, api = {}, pluginDir = '' }) {
    /** @type {Object} 插件配置 */
    this.config = config;

    /** @type {Object|null} 日志记录器 */
    this.logger = logger || this._createDefaultLogger();

    /** @type {Map|null} 共享缓存 */
    this.cache = cache || new Map();

    /** @type {Object} PDD 核心 API */
    this.api = api;

    /** @type {string} 插件根目录 */
    this.pluginDir = pluginDir;
  }

  /**
   * 创建默认的日志记录器（输出到控制台）
   * @returns {Object} 默认日志记录器
   * @private
   */
  _createDefaultLogger() {
    return {
      info: (...args) => console.log('[INFO]', ...args),
      warn: (...args) => console.warn('[WARN]', ...args),
      error: (...args) => console.error('[ERROR]', ...args),
      debug: (...args) => process.env.DEBUG && console.log('[DEBUG]', ...args),
    };
  }

  /**
   * 获取配置项
   * @param {string} key - 配置键名（支持点号路径如 "server.port"）
   * @param {*} defaultValue - 配置不存在时的默认值
   * @returns {*} 配置值
   */
  getConfig(key, defaultValue = undefined) {
    const keys = key.split('.');
    let value = this.config;
    for (const k of keys) {
      if (value == null || typeof value !== 'object') return defaultValue;
      value = value[k];
    }
    return value ?? defaultValue;
  }

  /**
   * 设置缓存项
   * @param {string} key - 缓存键
   * @param {*} value - 缓存值
   * @param {number} [ttlMs=0] - 过期时间（毫秒），0 表示永不过期
   */
  setCache(key, value, ttlMs = 0) {
    this.cache.set(key, {
      value,
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0,
    });
  }

  /**
   * 获取缓存项
   * @param {string} key - 缓存键
   * @returns {*|undefined} 缓存值，不存在或已过期返回 undefined
   */
  getCache(key) {
    const item = this.cache.get(key);
    if (!item) return undefined;
    if (item.expiresAt > 0 && Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return item.value;
  }
}

// ==================== PluginBase 抽象基类 ====================

/**
 * PDD 插件抽象基类
 * 所有 PDD 插件必须继承此类并实现必要的方法
 *
 * @abstract
 * @class PluginBase
 *
 * @example
 * import { PluginBase } from './plugin-sdk.js';
 *
 * export default class MyPlugin extends PluginBase {
 *   constructor() {
 *     super({
 *       name: 'my-plugin',
 *       version: '1.0.0',
 *       description: '我的插件',
 *     });
 *   }
 *
 *   async onActivate(context) {
 *     context.logger.info('插件已激活');
 *     this.registerCommand('hello', () => 'Hello World!');
 *   }
 * }
 */
export class PluginBase {
  /**
   * 创建插件实例
   * @param {Object} metadata - 插件元数据
   * @param {string} metadata.name - 插件名称
   * @param {string} metadata.version - 插件版本
   * @param {string} [metadata.description=''] - 插件描述
   * @param {string} [metadata.author=''] - 作者
   * @param {string} [metadata.license='MIT'] - 许可证
   * @param {string[]} [metadata.keywords=[]] - 关键词
   * @param {string} [metadata.pddVersionRange='>=1.0.0'] - 兼容的 PDD 版本范围
   * @param {Object} [metadata.dependencies={}] - 运行时依赖
   * @param {Object} [metadata.peerDependencies={}] - 对等依赖
   */
  constructor({
    name,
    version,
    description = '',
    author = '',
    license = 'MIT',
    keywords = [],
    pddVersionRange = '>=1.0.0',
    dependencies = {},
    peerDependencies = {},
  }) {
    if (new.target === PluginBase) {
      throw new Error('PluginBase 是抽象类，不能直接实例化。请继承此类创建插件。');
    }

    // ========== 元数据 ==========
    /** @type {string} 插件名称 */
    this.name = name;
    /** @type {string} 插件版本 */
    this.version = version;
    /** @type {string} 插件描述 */
    this.description = description;
    /** @type {string} 作者 */
    this.author = author;
    /** @type {string} 许可证 */
    this.license = license;
    /** @type {string[]} 关键词 */
    this.keywords = keywords;
    /** @type {string} PDD 版本兼容范围 */
    this.pddVersionRange = pddVersionRange;

    // ========== 依赖声明 ==========
    /** @type {Object} 运行时依赖 */
    this.dependencies = dependencies;
    /** @type {Object} 对等依赖 */
    this.peerDependencies = peerDependencies;

    // ========== 内部状态 ==========
    /** @type {PluginStatus} 当前状态 */
    this._status = PluginStatus.INSTALLED;
    /** @type {PluginContext|null} 运行时上下文 */
    this._context = null;
    /** @type {Map<string, Function>} 已注册的命令 */
    this._commands = new Map();
    /** @type {Map<string, Function>} 已注册的钩子 */
    this._hooks = new Map();
    /** @type {Map<string, Object>} 已注册的工具 */
    this._tools = new Map();
    /** @type {Map<string, Function>} 已注册的格式化器 */
    this._formatters = new Map();
  }

  /**
   * 获取当前插件状态
   * @returns {PluginStatus}
   */
  get status() {
    return this._status;
  }

  /**
   * 设置插件状态（内部使用）
   * @param {PluginStatus} status - 新状态
   * @private
   */
  _setStatus(status) {
    this._status = status;
  }

  // ==================== 生命周期钩子 ====================

  /**
   * 安装后回调（可选重写）
   * 在插件文件复制到插件目录后调用
   * @param {PluginContext} context - 插件上下文
   * @returns {Promise<void>}
   */
  async onInstall(context) {}

  /**
   * 激活回调（必须实现核心逻辑）
   * 插件被激活时调用，在此处注册命令、钩子、工具等
   * @param {PluginContext} context - 插件上下文
   * @returns {Promise<void>}
   * @abstract
   */
  async onActivate(context) {
    throw new Error(`${this.name}: 必须实现 onActivate 方法`);
  }

  /**
   * 停用回调（可选重写）
   * 插件被停用时调用，在此处清理资源
   * @param {PluginContext} context - 插件上下文
   * @returns {Promise<void>}
   */
  async onDeactivate(context) {}

  /**
   * 卸载前回调（可选重写）
   * 在插件文件删除前调用
   * @param {PluginContext} context - 插件上下文
   * @returns {Promise<void>}
   */
  async onUninstall(context) {}

  /**
   * 配置变更回调（可选重写）
   * 当插件的配置项发生变化时调用
   * @param {PluginContext} context - 插件上下文
   * @param {Object} changedKeys - 变更的配置键
   * @returns {Promise<void>}
   */
  async onConfigChange(context, changedKeys) {}

  // ==================== 能力注册 API ====================

  /**
   * 注册命令
   * @param {string} name - 命令名称
   * @param {Function} handler - 命令处理函数
   * @param {Object} [options={}] - 命令选项
   * @param {string} [options.description] - 命令描述
   * @throws {Error} 如果命令已存在
   */
  registerCommand(name, handler, options = {}) {
    if (this._commands.has(name)) {
      throw new Error(`命令 "${name}" 已在插件 "${this.name}" 中注册`);
    }
    this._commands.set(name, { handler, options, pluginName: this.name });
  }

  /**
   * 注册钩子
   * @param {string} name - 钩子名称（如 pre-verify, post-verify）
   * @param {Function} handler - 钩子处理函数
   * @param {number} [priority=100] - 执行优先级（数值越小越先执行）
   * @throws {Error} 如果钩子已存在
   */
  registerHook(name, handler, priority = 100) {
    const key = `${this.name}:${name}`;
    if (this._hooks.has(key)) {
      throw new Error(`钩子 "${name}" 已在插件 "${this.name}" 中注册`);
    }
    this._hooks.set(key, { name, handler, priority, pluginName: this.name });
  }

  /**
   * 注册工具
   * @param {string} name - 工具名称
   * @param {Object} tool - 工具定义
   * @param {Function} tool.execute - 工具执行函数
   * @param {string} [tool.description] - 工具描述
   * @param {Object} [tool.schema] - 参数 JSON Schema
   * @throws {Error} 如果工具已存在
   */
  registerTool(name, tool) {
    if (this._tools.has(name)) {
      throw new Error(`工具 "${name}" 已在插件 "${this.name}" 中注册`);
    }
    this._tools.set(name, { ...tool, pluginName: this.name });
  }

  /**
   * 注册格式化器
   * @param {string} name - 格式化器名称（如 json, table, markdown）
   * @param {Function} formatter - 格式化函数
   * @throws {Error} 如果格式化器已存在
   */
  registerFormatter(name, formatter) {
    if (this._formatters.has(name)) {
      throw new Error(`格式化器 "${name}" 已在插件 "${this.name}" 中注册`);
    }
    this._formatters.set(name, { formatter, pluginName: this.name });
  }

  // ==================== 查询 API ====================

  /**
   * 获取所有已注册的命令
   * @returns {Map<string, Object>}
   */
  getCommands() {
    return new Map(this._commands);
  }

  /**
   * 获取所有已注册的钩子
   * @returns {Map<string, Object>}
   */
  getHooks() {
    return new Map(this._hooks);
  }

  /**
   * 获取所有已注册的工具
   * @returns {Map<string, Object>}
   */
  getTools() {
    return new Map(this._tools);
  }

  /**
   * 获取所有已注册的格式化器
   * @returns {Map<string, Object>}
   */
  getFormatters() {
    return new Map(this._formatters);
  }

  /**
   * 获取插件元数据摘要
   * @returns {Object}
   */
  toJSON() {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      author: this.author,
      license: this.license,
      keywords: this.keywords,
      pddVersionRange: this.pddVersionRange,
      dependencies: this.dependencies,
      peerDependencies: this.peerDependencies,
      status: this._status,
      commandsCount: this._commands.size,
      hooksCount: this._hooks.size,
      toolsCount: this._tools.size,
      formattersCount: this._formatters.size,
    };
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建插件实例的工厂函数
 * 简化插件创建流程，自动绑定元数据和上下文
 *
 * @param {Class<PluginBase>} PluginClass - 继承自 PluginBase 的插件类
 * @returns {PluginBase} 插件实例
 *
 * @example
 * import { createPlugin, PluginBase } from './plugin-sdk.js';
 *
 * class MyPlugin extends PluginBase {
 *   constructor() {
 *     super({ name: 'my-plugin', version: '1.0.0' });
 *   }
 *   async onActivate(ctx) { /* ... */ }
 * }
 *
 * const plugin = createPlugin(MyPlugin);
 */
export function createPlugin(PluginClass) {
  if (!PluginClass || typeof PluginClass !== 'function') {
    throw new Error('createPlugin 需要一个继承自 PluginBase 的类');
  }
  const instance = new PluginClass();
  if (!(instance instanceof PluginBase)) {
    throw new Error('插件类必须继承自 PluginBase');
  }
  return instance;
}

// ==================== 版本比较工具 ====================

/**
 * 简易版本号比较（仅支持 semver 子集）
 * 用于判断插件是否与当前 PDD 版本兼容
 *
 * @param {string} range - 版本范围表达式（支持 >=, >, <=, <, =）
 * @param {string} version - 实际版本号
 * @returns {boolean} 是否匹配
 * @example
 * matchVersionRange('>=1.0.0', '2.0.0') // true
 * matchVersionRange('>2.0.0', '1.9.0')  // false
 */
export function matchVersionRange(range, version) {
  const rangeMatch = range.match(/^(>=|>|<=|<|=)?(\d+\.\d+\.\d+)$/);
  if (!rangeMatch) return false;

  const [, operator, rangeVer] = rangeMatch;
  const verParts = version.split('.').map(Number);
  const rangeParts = rangeVer.split('.').map(Number);

  const compare = (a, b) => {
    for (let i = 0; i < 3; i++) {
      if ((a[i] ?? 0) > (b[i] ?? 0)) return 1;
      if ((a[i] ?? 0) < (b[i] ?? 0)) return -1;
    }
    return 0;
  };

  const result = compare(verParts, rangeParts);

  switch (operator) {
    case '>=': return result >= 0;
    case '>':  return result > 0;
    case '<=': return result <= 0;
    case '<':  return result < 0;
    case '=':
    default:  return result === 0;
  }
}
