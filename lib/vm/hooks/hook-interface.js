/**
 * @module lib/vm/hooks/hook-interface
 * @description PDD Visual Manager Hook 系统核心接口和 HookManager 工厂函数
 * 提供命令执行前后的生命周期钩子管理能力
 *
 * 设计原则：
 * 1. Hook 失败不能影响原始命令执行（隔离机制）
 * 2. 支持 --no-vm 参数完全跳过所有 Hook 记录
 * 3. HookContext 包含足够的上下文信息供后续分析
 */

/**
 * 钩子上下文对象 - 传递给每个 Hook 的运行时信息
 *
 * @typedef {Object} HookContext
 * @property {string} command - 命令名称 (generate/verify/extract/report)
 * @property {string} [featureId] - 关联的功能点 ID（可选）
 * @property {Object} [options] - 命令行选项参数
 * @property {Date} timestamp - 命令开始时间戳
 * @property {number} [duration] - 命令执行耗时（毫秒）
 * @property {*} [result] - 命令成功执行的返回结果
 * @property {Error} [error] - 命令执行时的错误对象
 */

/**
 * 创建新的 HookContext 实例
 *
 * @param {Object} params - 初始化参数
 * @param {string} params.command - 命令名称
 * @param {string} [params.featureId] - 功能点 ID
 * @param {Object} [params.options={}] - 命令选项
 * @returns {HookContext}
 */
export function createHookContext({ command, featureId, options = {} }) {
  return {
    command,
    featureId,
    options: { ...options },
    timestamp: new Date(),
    duration: undefined,
    result: undefined,
    error: undefined
  };
}

/**
 * PDDHook 抽象基类 - 所有命令 Hook 的父类
 * 定义了 Hook 的标准接口和通用行为
 *
 * 子类需要实现 before/after/error 方法来处理特定命令的生命周期事件
 *
 * @abstract
 * @class
 * @example
 * class MyCustomHook extends PDDHook {
 *   name = 'my-custom'
 *
 *   async before(ctx) {
 *     console.log(`Before ${ctx.command}`);
 *   }
 *
 *   async after(ctx) {
 *     console.log(`After ${ctx.command}, result:`, ctx.result);
 *   }
 * }
 */
export class PDDHook {
  /**
   * 创建 PDDHook 实例
   * @param {Object} [options={}] - 配置选项
   * @param {boolean} [options.enabled=true] - 是否启用此 Hook
   */
  constructor(options = {}) {
    /** @type {string} Hook 名称（子类必须设置） */
    this.name = 'base';

    /** @type {boolean} 是否启用 */
    this.enabled = options.enabled !== false;

    /**
     * 是否禁用 VM 模式（全局 --no-vm 标志）
     * @type {boolean}
     * @protected
     */
    this._vmDisabled = false;
  }

  /**
   * 设置 VM 禁用状态
   * 当用户传入 --no-vm 参数时调用
   *
   * @param {boolean} disabled - 是否禁用
   * @returns {void}
   */
  setVmDisabled(disabled) {
    this._vmDisabled = disabled;
  }

  /**
   * 检查当前 Hook 是否应该启用
   * 综合考虑 enabled 标志和全局 _vmDisabled 状态
   *
   * @protected
   * @returns {boolean} 如果应启用返回 true
   */
  _isEnabled() {
    return this.enabled && !this._vmDisabled;
  }

  /**
   * 命令执行前的钩子方法
   * 用于记录前置状态、初始化资源等
   *
   * @async
   * @param {HookContext} ctx - 钩子上下文
   * @returns {Promise<void>}
   */
  async before(ctx) {
    // 默认空实现 - 子类可覆盖
    if (this._isEnabled()) {
      this._log('before', ctx);
    }
  }

  /**
   * 命令成功执行后的钩子方法
   * 用于记录结果、更新状态、收集指标等
   *
   * @async
   * @param {HookContext} ctx - 钩子上下文（包含 result）
   * @returns {Promise<void>}
   */
  async after(ctx) {
    // 默认空实现 - 子类可覆盖
    if (this._isEnabled()) {
      this._log('after', ctx);
    }
  }

  /**
   * 命令执行出错时的钩子方法
   * 用于记录错误、回滚状态等
   *
   * @async
   * @param {HookContext} ctx - 钩子上下文（包含 error）
   * @returns {Promise<void>}
   */
  async error(ctx) {
    // 默认空实现 - 子类可覆盖
    if (this._isEnabled()) {
      this._log('error', ctx);
    }
  }

  /**
   * 内部日志方法（可被子类覆盖以实现自定义日志）
   *
   * @private
   * @param {string} phase - 生命周期阶段
   * @param {HookContext} ctx - 钩子上下文
   * @returns {void}
   */
  _log(phase, ctx) {
    const time = ctx.timestamp.toISOString();
    console.log(
      `[PDD-Hook][${time}] ${this.name}/${phase}` +
      ` command=${ctx.command}` +
      (ctx.featureId ? ` feature=${ctx.featureId}` : '')
    );
  }

  /**
   * 安全执行异步操作并捕获异常
   * 所有 Hook 方法都应使用此包装器确保不抛出异常
   *
   * @async
   * @private
   * @param {string} phase - 生命周期阶段名称
   * @param {Function} fn - 要执行的异步函数
   * @returns {Promise<void>}
   */
  async _safeExecute(phase, fn) {
    try {
      await fn();
    } catch (error) {
      // Hook 异常只记录日志，不影响主流程
      console.error(
        `[PDD-Hook-Error] ${this.name}/${phase}: ${error.message}`
      );
      // 可选：将错误写入错误日志文件
      await this._logHookError(phase, error);
    }
  }

  /**
   * 将 Hook 错误持久化到日志文件
   *
   * @async
   * @private
   * @param {string} phase - 阶段
   * @param {Error} error - 错误对象
   * @returns {Promise<void>}
   */
  async _logHookError(phase, error) {
    try {
      const { promises: fs } = await import('node:fs');
      const logEntry = {
        timestamp: new Date().toISOString(),
        hook: this.name,
        phase,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      };

      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile('.pdd-hook-errors.log', logLine, 'utf-8');
    } catch {
      // 日志写入失败时静默忽略，避免级联错误
    }
  }
}

/**
 * HookManager - Hook 注册表和执行调度器
 * 负责管理所有已注册的 Hook 并在适当时机触发它们
 *
 * @class
 * @example
 * const hm = createHookManager();
 * hm.register(new GenerateHook());
 * hm.register(new VerifyHook());
 *
 * await hm.executeBefore('generate', ctx);
 * // ... 执行命令 ...
 * await hm.executeAfter('generate', { ...ctx, result });
 */
class HookManager {
  constructor() {
    /**
     * 已注册的 Hook 映射表
     * key: hook.name, value: PDDHook instance
     * @type {Map<string, PDDHook>}
     * @private
     */
    this._hooks = new Map();

    /** @type {boolean} 全局 VM 禁用标志 */
    this._globalVmDisabled = false;
  }

  /**
   * 注册一个 Hook 实例
   * 同名的 Hook 会被后注册的替换
   *
   * @param {PDDHook} hook - 要注册的 Hook 实例
   * @returns {HookManager} 返回自身以支持链式调用
   * @throws {TypeError} 如果 hook 不是 PDDHook 的实例
   */
  register(hook) {
    if (!(hook instanceof PDDHook)) {
      throw new TypeError('Hook 必须是 PDDHook 的实例');
    }

    // 同步全局禁用状态
    hook.setVmDisabled(this._globalVmDisabled);

    this._hooks.set(hook.name, hook);
    return this;
  }

  /**
   * 设置全局 VM 禁用状态
   * 会同步到所有已注册的 Hook
   *
   * @param {boolean} disabled - 是否禁用
   * @returns {void}
   */
  setGlobalVmDisabled(disabled) {
    this._globalVmDisabled = disabled;
    for (const hook of this._hooks.values()) {
      hook.setVmDisabled(disabled);
    }
  }

  /**
   * 获取指定名称的 Hook
   *
   * @param {string} name - Hook 名称
   * @returns {PDDHook|undefined}
   */
  getHook(name) {
    return this._hooks.get(name);
  }

  /**
   * 获取所有已注册的 Hook
   *
   * @returns {PDDHook[]}
   */
  getAllHooks() {
    return Array.from(this._hooks.values());
  }

  /**
   * 执行指定命令的所有 before 钩子
   * 按注册顺序串行执行，任何单个 Hook 失败不会影响其他 Hook
   *
   * @async
   * @param {string} command - 命令名称
   * @param {HookContext} ctx - 钩子上下文
   * @returns {Promise<void>}
   */
  async executeBefore(command, ctx) {
    for (const [, hook] of this._hooks) {
      await hook._safeExecute('before', () => hook.before({
        ...ctx,
        command
      }));
    }
  }

  /**
   * 执行指定命令的所有 after 钩子
   * 在命令成功完成后调用
   *
   * @async
   * @param {string} command - 命令名称
   * @param {HookContext} ctx - 钩子上下文（必须包含 result）
   * @returns {Promise<void>}
   */
  async executeAfter(command, ctx) {
    for (const [, hook] of this._hooks) {
      await hook._safeExecute('after', () => hook.after({
        ...ctx,
        command
      }));
    }
  }

  /**
   * 执行指定命令的所有 error 钩子
   * 在命令执行出错时调用
   *
   * @async
   * @param {string} command - 命令名称
   * @param {HookContext} ctx - 钩子上下文（必须包含 error）
   * @returns {Promise<void>}
   */
  async executeError(command, ctx) {
    for (const [, hook] of this._hooks) {
      await hook._safeExecute('error', () => hook.error({
        ...ctx,
        command
      }));
    }
  }

  /**
   * 获取 HookManager 的统计信息
   *
   * @returns {{totalHooks: number, hooksByStatus: Object}}
   */
  getStats() {
    let enabledCount = 0;
    let disabledCount = 0;

    for (const hook of this._hooks.values()) {
      if (hook._isEnabled()) {
        enabledCount++;
      } else {
        disabledCount++;
      }
    }

    return {
      totalHooks: this._hooks.size,
      hooksByStatus: {
        enabled: enabledCount,
        disabled: disabledCount
      },
      globalVmDisabled: this._globalVmDisabled
    };
  }
}

/**
 * 全局单例 HookManager 实例
 * @type {HookManager|null}
 * @private
 */
let _singletonInstance = null;

/**
 * 创建或获取 HookManager 单例实例
 * 这是工厂函数，也是获取 HookManager 的推荐方式
 *
 * 使用示例:
 * ```javascript
 * import { getHookManager } from './lib/vm/hooks/hook-interface.js';
 *
 * // 获取单例
 * const hm = getHookManager();
 *
 * // 注册内置 Hooks
 * hm.register(new GenerateHook());
 * hm.register(new VerifyHook());
 *
 * // 在 CLI 中使用
 * if (!options.noVm) {
 *   await hm.executeBefore('generate', ctx);
 *   try {
 *     result = await generateCode(options);
 *     await hm.executeAfter('generate', { ...ctx, result });
 *   } catch (e) {
 *     await hm.executeError('generate', { ...ctx, error: e });
 *     throw e;
 *   }
 * }
 * ```
 *
 * @param {Object} [options={}] - 初始化选项
 * @param {boolean} [options.noVm=false] - 是否禁用 VM 模式
 * @returns {HookManager} HookManager 单例实例
 */
export function getHookManager(options = {}) {
  if (!_singletonInstance) {
    _singletonInstance = new HookManager();

    // 自动注册内置 Hook（可选，也可以手动注册）
    // 这里不自动注册，让使用者按需注册
  }

  // 应用全局禁用配置
  if (options.noVm) {
    _singletonInstance.setGlobalVmDisabled(true);
  }

  return _singletonInstance;
}

/**
 * 重置单例实例（主要用于测试）
 *
 * @returns {void}
 */
export function resetHookManager() {
  _singletonInstance = null;
}

export default {
  PDDHook,
  createHookContext,
  getHookManager,
  resetHookManager
};
