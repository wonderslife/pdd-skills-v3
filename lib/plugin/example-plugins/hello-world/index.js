/**
 * Hello World 示例插件
 *
 * PDD 插件系统的最简入门示例，演示：
 * - 继承 PluginBase 基类
 * - 实现 onActivate 生命周期钩子
 * - 使用 registerCommand 注册自定义命令
 *
 * @module hello-world
 * @author PDD Team
 * @version 1.0.0
 */

import { PluginBase } from '../plugin-sdk.js';

/**
 * Hello World 插件类
 *
 * @class HelloWorldPlugin
 * @extends PluginBase
 */
export default class HelloWorldPlugin extends PluginBase {
  constructor() {
    super({
      name: 'hello-world',
      version: '1.0.0',
      description: 'Hello World 示例插件 - PDD 插件系统入门示例',
      author: 'PDD Team',
      license: 'MIT',
      keywords: ['example', 'demo', 'getting-started'],
      pddVersionRange: '>=1.0.0',
    });
  }

  /**
   * 插件激活时调用
   * 注册 hello 命令并输出欢迎信息
   *
   * @param {import('../plugin-sdk.js').PluginContext} context - 插件上下文
   */
  async onActivate(context) {
    context.logger.info('Hello World 插件正在激活...');

    // 注册 hello 命令
    this.registerCommand('hello', (args = {}) => {
      const name = args.name || 'World';
      return {
        message: `Hello, ${name}! 🎉`,
        from: this.name,
        version: this.version,
        timestamp: new Date().toISOString(),
      };
    }, {
      description: '输出 Hello World 问候语，可指定名称',
      usage: 'hello [--name <名字>]',
      examples: [
        { command: 'hello', output: 'Hello, World!' },
        { command: 'hello --name PDD', output: 'Hello, PDD!' },
      ],
    });

    // 注册 hello:info 子命令
    this.registerCommand('hello:info', () => ({
      pluginName: this.name,
      version: this.version,
      description: this.description,
      author: this.author,
      commands: Array.from(this.getCommands().keys()),
    }), {
      description: '显示插件自身信息',
    });

    context.logger.info(`Hello World 插件激活成功！已注册命令: ${Array.from(this.getCommands().keys()).join(', ')}`);
  }

  /**
   * 插件停用时调用
   * 清理资源（本示例无额外资源需要清理）
   *
   * @param {import('../plugin-sdk.js').PluginContext} context - 插件上下文
   */
  async onDeactivate(context) {
    context.logger.info('Hello World 插件正在停用...');
    // 命令注册表会在 unload 时自动清理
  }
}
