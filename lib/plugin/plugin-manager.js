/**
 * PDD Plugin Manager - 插件生命周期管理器
 *
 * 负责插件的发现、加载、激活、停用、卸载等全生命周期管理。
 * 提供依赖解析、事件系统、状态机等核心能力。
 * 一个插件失败不影响其他插件的运行。
 *
 * @module plugin-manager
 * @author PDD Team
 * @version 1.0.0
 * @license MIT
 */

import { readFile, readdir, stat, access } from 'node:fs/promises';
import { join, extname, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';

import {
  PluginBase,
  PluginContext,
  PluginManifest,
  PluginStatus,
  createPlugin,
  matchVersionRange,
} from './plugin-sdk.js';

// ==================== 事件常量 ====================

/**
 * 插件管理器事件类型
 * @enum {string}
 */
export const PluginEvents = {
  /** 插件加载完成 */
  LOADED: 'plugin-loaded',
  /** 插件激活完成 */
  ACTIVATED: 'plugin-activated',
  /** 插件停用完成 */
  DEACTIVATED: 'plugin-deactivated',
  /** 插件卸载完成 */
  UNINSTALLED: 'plugin-uninstalled',
  /** 插件出错 */
  ERROR: 'plugin-error',
  /** 插件发现完成（批量扫描结束时触发） */
  DISCOVERED: 'plugins-discovered',
};

// ==================== PluginManager 主类 ====================

/**
 * 插件生命周期管理器
 *
 * 管理所有已安装插件的状态转换和资源分配。
 * 实现插件隔离：每个插件拥有独立的上下文和作用域。
 *
 * 状态机流转:
 *   installed → loaded → activated → deactivated → uninstalled
 *                ↘           ↗
 *                  error (任意阶段)
 *
 * @class PluginManager
 * @extends EventEmitter
 *
 * @example
 * import { PluginManager } from './plugin-manager.js';
 *
 * const manager = new PluginManager({ pluginsDir: './plugins' });
 * await manager.discover();
 * await manager.activate('hello-world');
 */
export class PluginManager extends EventEmitter {
  /**
   * 创建插件管理器实例
   * @param {Object} options - 管理器配置选项
   * @param {string} options.pluginsDir - 插件根目录路径
   * @param {Object} [options.globalConfig={}] - 全局配置对象
   * @param {Object} [options.logger] - 日志记录器
   * @param {Object} [options.api={}] - PDD 核心 API
   * @param {string} [options.pddVersion='1.0.0'] - 当前 PDD 版本号
   * @param {boolean} [options.autoActivate=true] - 加载后是否自动激活
   */
  constructor({
    pluginsDir,
    globalConfig = {},
    logger = null,
    api = {},
    pddVersion = '1.0.0',
    autoActivate = true,
  }) {
    super();

    if (!pluginsDir) {
      throw new Error('PluginManager 需要指定 pluginsDir 参数');
    }

    /** @type {string} 插件根目录 */
    this.pluginsDir = pluginsDir;

    /** @type {string} 当前 PDD 版本 */
    this.pddVersion = pddVersion;

    /** @type {boolean} 是否自动激活 */
    this.autoActivate = autoActivate;

    /** @type {Map<string, Object>} 插件注册表 { name → { instance, manifest, path, status, context } } */
    this._registry = new Map();

    /** @type {Map<string, string[]>} 依赖图 { name → [depNames] } */
    this._dependencyGraph = new Map();

    /** @type {Object} 全局配置 */
    this._globalConfig = globalConfig;

    /** @type {Object|null} 日志记录器 */
    this._logger = logger || this._createDefaultLogger();

    /** @type {Object} PDD 核心 API */
    this._api = api;

    /** @type {Set<string>} 正在处理的插件名称集合（防止循环） */
    this._processing = new Set();
  }

  /**
   * 创建默认日志记录器
   * @returns {Object}
   * @private
   */
  _createDefaultLogger() {
    return {
      info: (...args) => console.log(`[PluginManager] [INFO]`, ...args),
      warn: (...args) => console.warn(`[PluginManager] [WARN]`, ...args),
      error: (...args) => console.error(`[PluginManager] [ERROR]`, ...args),
      debug: (...args) => process.env.DEBUG && console.log(`[PluginManager] [DEBUG]`, ...args),
    };
  }

  // ==================== 插件发现 ====================

  /**
   * 扫描插件目录，发现所有可用插件
   * 查找每个子目录中的 plugin.json 清单文件
   *
   * @returns {Promise<string[]>} 发现的插件名称列表
   */
  async discover() {
    this._logger.info(`开始扫描插件目录: ${this.pluginsDir}`);

    let entries;
    try {
      entries = await readdir(this.pluginsDir, { withFileTypes: true });
    } catch (err) {
      this._logger.error(`无法读取插件目录: ${err.message}`);
      throw new Error(`插件目录不存在或不可读: ${this.pluginsDir}`);
    }

    const discovered = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pluginPath = join(this.pluginsDir, entry.name);
      const manifestPath = join(pluginPath, 'plugin.json');

      try {
        // 检查 plugin.json 是否存在
        await access(manifestPath);
        discovered.push(entry.name);
        this._logger.debug(`发现插件: ${entry.name}`);
      } catch {
        // 没有 plugin.json 的目录跳过
        this._logger.debug(`跳过非插件目录: ${entry.name}`);
      }
    }

    this._logger.info(`扫描完成，发现 ${discovered.length} 个插件`);
    this.emit(PluginEvents.DISCOVERED, { plugins: discovered });

    return discovered;
  }

  // ==================== 插件加载 ====================

  /**
   * 加载单个插件
   * 1. 读取并验证 plugin.json
   * 2. 动态 import 入口文件
   * 3. 创建插件实例
   * 4. 注册到管理器
   *
   * @param {string} nameOrPath - 插件名称或绝对路径
   * @returns {Promise<PluginBase>} 已加载的插件实例
   * @throws {Error} 加载失败时抛出异常
   */
  async load(nameOrPath) {
    // 判断是名称还是路径
    let pluginPath;
    let pluginName;

    if (nameOrPath.includes('/') || nameOrPath.includes('\\')) {
      pluginPath = nameOrPath;
      pluginName = basename(nameOrPath);
    } else {
      pluginName = nameOrPath;
      pluginPath = join(this.pluginsDir, pluginName);
    }

    // 防止重复加载
    if (this._registry.has(pluginName)) {
      const existing = this._registry.get(pluginName);
      if (existing.status === PluginStatus.LOADED || existing.status === PluginStatus.ACTIVATED) {
        this._logger.warn(`插件 "${pluginName}" 已加载`);
        return existing.instance;
      }
    }

    this._processing.add(pluginName);

    try {
      // 步骤 1: 读取清单
      const manifestPath = join(pluginPath, 'plugin.json');
      const manifest = await PluginManifest.load(manifestPath);
      const validation = manifest.validate();

      if (!validation.valid) {
        throw new Error(`插件清单验证失败:\n  ${validation.errors.join('\n  ')}`);
      }
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(w => this._logger.warn(`[${pluginName}] ${w}`));
      }

      // 步骤 2: 版本兼容性检查
      if (!matchVersionRange(manifest.raw.pdd, this.pddVersion)) {
        throw new Error(
          `PDD 版本不兼容: 需要 ${manifest.raw.pdd}，当前 ${this.pddVersion}`
        );
      }

      // 步骤 3: 动态导入入口文件
      const entryFile = join(pluginPath, manifest.raw.main);
      const module = await import(entryFile);

      // 获取默认导出或 named export
      const PluginClass = module.default || module;
      if (typeof PluginClass !== 'function') {
        throw new Error(
          `插件入口文件 "${manifest.raw.main}" 必须导出一个继承自 PluginBase 的类`
        );
      }

      // 步骤 4: 创建实例
      const instance = createPlugin(PluginClass);

      // 步骤 5: 创建上下文
      const context = new PluginContext({
        config: { ...this._globalConfig, ...(manifest.raw.config || {}) },
        logger: this._logger,
        cache: new Map(),
        api: this._api,
        pluginDir: pluginPath,
      });

      // 步骤 6: 注册到管理器
      this._registry.set(pluginName, {
        instance,
        manifest: manifest.raw,
        path: pluginPath,
        status: PluginStatus.LOADED,
        context,
        loadedAt: Date.now(),
      });

      // 构建依赖图
      if (manifest.raw.dependencies || manifest.raw.peerDependencies) {
        const deps = [
          ...(Object.keys(manifest.raw.dependencies || {})),
          ...(Object.keys(manifest.raw.peerDependencies || {})),
        ];
        this._dependencyGraph.set(pluginName, deps);
      }

      this._logger.info(`插件 "${pluginName}" v${instance.version} 加载成功`);

      // 触发 onInstall 生命周期
      try {
        await instance.onInstall(context);
      } catch (err) {
        this._logger.warn(`[${pluginName}] onInstall 回调失败: ${err.message}`);
      }

      this.emit(PluginEvents.LOADED, { name: pluginName, instance });

      // 自动激活
      if (this.autoActivate) {
        await this.activate(pluginName);
      }

      return instance;
    } catch (err) {
      this._logger.error(`加载插件 "${pluginName}" 失败: ${err.message}`);

      // 记录错误状态
      this._registry.set(pluginName, {
        instance: null,
        manifest: null,
        path: pluginPath,
        status: PluginStatus.ERROR,
        context: null,
        error: err.message,
      });

      this.emit(PluginEvents.ERROR, { name: pluginName, error: err.message });
      throw err;
    } finally {
      this._processing.delete(pluginName);
    }
  }

  // ==================== 批量加载 ====================

  /**
   * 加载所有已发现的插件
   * 自动解析依赖顺序后按序加载
   *
   * @returns {Promise<PluginBase[]>} 所有成功加载的插件实例数组
   */
  async loadAll() {
    const discovered = await this.discover();
    const loadOrder = this.resolveDependencies(discovered);

    this._logger.info(`按依赖顺序加载 ${loadOrder.length} 个插件`);

    const results = [];
    for (const name of loadOrder) {
      try {
        const instance = await this.load(name);
        results.push(instance);
      } catch (err) {
        this._logger.error(`加载 "${name}" 失败（继续加载其他插件）: ${err.message}`);
        // 单个插件失败不影响其他插件
      }
    }

    return results;
  }

  // ==================== 激活 / 停用 ====================

  /**
   * 激活插件
   * 调用插件的 onActivate 方法，使其进入可用状态
   *
   * @param {string} name - 插件名称
   * @returns {Promise<void>}
   * @throws {Error} 如果插件未加载或激活失败
   */
  async activate(name) {
    const entry = this._registry.get(name);
    if (!entry) {
      throw new Error(`插件 "${name}" 未注册，请先调用 load()`);
    }
    if (entry.status === PluginStatus.ACTIVATED) {
      this._logger.warn(`插件 "${name}" 已经处于激活状态`);
      return;
    }
    if (entry.status === PluginStatus.ERROR) {
      throw new Error(`插件 "${name}" 处于错误状态，无法激活: ${entry.error}`);
    }

    try {
      this._processing.add(name);

      // 先激活依赖项
      const deps = this._dependencyGraph.get(name) || [];
      for (const dep of deps) {
        if (this._registry.has(dep)) {
          const depEntry = this._registry.get(dep);
          if (depEntry.status !== PluginStatus.ACTIVATED) {
            await this.activate(dep);
          }
        }
      }

      entry.instance._setStatus(PluginStatus.ACTIVATED);
      await entry.instance.onActivate(entry.context);

      entry.status = PluginStatus.ACTIVATED;
      entry.activatedAt = Date.now();

      this._logger.info(`插件 "${name}" 激活成功`);
      this.emit(PluginEvents.ACTIVATED, { name, instance: entry.instance });
    } catch (err) {
      entry.status = PluginStatus.ERROR;
      entry.error = err.message;
      entry.instance._setStatus(PluginStatus.ERROR);

      this._logger.error(`激活插件 "${name}" 失败: ${err.message}`);
      this.emit(PluginEvents.ERROR, { name, error: err.message });
      throw err;
    } finally {
      this._processing.delete(name);
    }
  }

  /**
   * 停用插件
   * 调用插件的 onDeactivate 方法，释放其占用的资源
   *
   * @param {string} name - 插件名称
   * @returns {Promise<void>}
   * @throws {Error} 如果插件未激活
   */
  async deactivate(name) {
    const entry = this._registry.get(name);
    if (!entry) {
      throw new Error(`插件 "${name}" 不存在`);
    }
    if (entry.status !== PluginStatus.ACTIVATED) {
      throw new Error(`插件 "${name}" 当前未激活（状态: ${entry.status}）`);
    }

    try {
      await entry.instance.onDeactivate(entry.context);

      entry.status = PluginStatus.DEACTIVATED;
      entry.instance._setStatus(PluginStatus.DEACTIVATED);

      this._logger.info(`插件 "${name}" 已停用`);
      this.emit(PluginEvents.DEACTIVATED, { name });
    } catch (err) {
      this._logger.error(`停用插件 "${name}" 时出错: ${err.message}`);
      this.emit(PluginEvents.ERROR, { name, error: err.message });
      throw err;
    }
  }

  /**
   * 卸载插件
   * 先停用，再调用 onUninstall，最后从注册表移除
   *
   * @param {string} name - 插件名称
   * @returns {Promise<void>}
   */
  async unload(name) {
    const entry = this._registry.get(name);
    if (!entry) {
      this._logger.warn(`插件 "${name}" 未注册，无需卸载`);
      return;
    }

    try {
      // 如果处于激活状态，先停用
      if (entry.status === PluginStatus.ACTIVATED) {
        await this.deactivate(name);
        // 重新获取（deactivate 后引用可能变化）
        const refreshed = this._registry.get(name);
        if (refreshed?.instance) {
          await refreshed.instance.onUninstall(refreshed.context);
        }
      } else if (entry.instance) {
        await entry.instance.onUninstall(entry.context);
      }

      this._registry.delete(name);
      this._dependencyGraph.delete(name);

      this._logger.info(`插件 "${name}" 已卸载`);
      this.emit(PluginEvents.UNINSTALLED, { name });
    } catch (err) {
      this._logger.error(`卸载插件 "${name}" 时出错: ${err.message}`);
      this.emit(PluginEvents.ERROR, { name, error: err.message });
      throw err;
    }
  }

  // ==================== 查询 API ====================

  /**
   * 列出所有已注册的插件及其状态
   * @returns {Array<{name: string, version: string, status: string, description: string}>}
   */
  listPlugins() {
    const result = [];
    for (const [name, entry] of this._registry) {
      result.push({
        name,
        version: entry.instance?.version ?? 'unknown',
        status: entry.status,
        description: entry.instance?.description ?? '',
        path: entry.path,
        loadedAt: entry.loadedAt,
        activatedAt: entry.activatedAt,
      });
    }
    return result;
  }

  /**
   * 根据名称获取插件实例
   * @param {string} name - 插件名称
   * @returns {PluginBase|undefined}
   */
  getPlugin(name) {
    const entry = this._registry.get(name);
    return entry?.instance;
  }

  /**
   * 获取插件上下文
   * @param {string} name - 插件名称
   * @returns {PluginContext|undefined}
   */
  getContext(name) {
    const entry = this._registry.get(name);
    return entry?.context;
  }

  /**
   * 获取所有已注册的命令（跨插件聚合）
   * @returns {Map<string, Object>} { commandName → { handler, options, pluginName } }
   */
  getAllCommands() {
    const allCommands = new Map();
    for (const [, entry] of this._registry) {
      if (entry.instance && entry.status === PluginStatus.ACTIVATED) {
        const commands = entry.instance.getCommands();
        for (const [cmdName, cmdDef] of commands) {
          allCommands.set(cmdName, cmdDef);
        }
      }
    }
    return allCommands;
  }

  /**
   * 获取所有已注册的钩子（跨插件聚合）
   * @returns {Map<string, Object>} { hookKey → { name, handler, priority, pluginName } }
   */
  getAllHooks() {
    const allHooks = new Map();
    for (const [, entry] of this._registry) {
      if (entry.instance && entry.status === PluginStatus.ACTIVATED) {
        const hooks = entry.instance.getHooks();
        for (const [hookKey, hookDef] of hooks) {
          allHooks.set(hookKey, hookDef);
        }
      }
    }
    return allHooks;
  }

  // ==================== 依赖解析 ====================

  /**
   * 解析插件依赖顺序（拓扑排序）
   * 确保被依赖的插件优先加载/激活
   *
   * @param {string[]} pluginNames - 待排序的插件名称列表
   * @returns {string[]} 按依赖顺序排列的插件名称列表
   * @throws {Error} 存在循环依赖时抛出异常
   */
  resolveDependencies(pluginNames) {
    const visited = new Set();
    const visiting = new Set(); // 用于检测环
    const order = [];

    /**
     * 深度优先遍历
     * @param {string} name
     */
    const visit = (name) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(`检测到循环依赖，涉及插件: ${name}`);
      }

      visiting.add(name);

      const deps = this._dependencyGraph.get(name) || [];
      for (const dep of deps) {
        // 只处理在当前待排序列表中的依赖
        if (pluginNames.includes(dep)) {
          visit(dep);
        }
      }

      visiting.delete(name);
      visited.add(name);
      order.push(name);
    };

    for (const name of pluginNames) {
      visit(name);
    }

    return order;
  }

  // ==================== 配置变更通知 ====================

  /**
   * 通知插件配置发生变更
   * @param {string} name - 插件名称
   * @param {Object} changedKeys - 变更的配置键值对
   * @returns {Promise<void>}
   */
  async notifyConfigChange(name, changedKeys) {
    const entry = this._registry.get(name);
    if (!entry || !entry.instance || entry.status !== PluginStatus.ACTIVATED) {
      return;
    }

    try {
      // 更新上下文中的配置
      Object.assign(entry.context.config, changedKeys);
      await entry.instance.onConfigChange(entry.context, changedKeys);
      this._logger.debug(`已通知插件 "${name}" 配置变更`);
    } catch (err) {
      this._logger.error(`通知插件 "${name}" 配置变更失败: ${err.message}`);
      this.emit(PluginEvents.ERROR, { name, error: err.message });
    }
  }

  // ==================== 销毁 ====================

  /**
   * 卸载所有插件并释放资源
   * 应用于程序退出前的清理工作
   *
   * @returns {Promise<void>}
   */
  async destroy() {
    this._logger.info('正在销毁插件管理器...');

    const names = [...this._registry.keys()];
    for (const name of names) {
      try {
        await this.unload(name);
      } catch (err) {
        this._logger.error(`卸载 "${name}" 时出错（忽略）: ${err.message}`);
      }
    }

    this._registry.clear();
    this._dependencyGraph.clear();
    this.removeAllListeners();

    this._logger.info('插件管理器已销毁');
  }
}

// ==================== 导出 ====================

export default PluginManager;
