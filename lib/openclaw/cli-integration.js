/**
 * @module openclaw/cli-integration
 * @description OpenClaw CLI 集成模块 - 提供 pdd openclaw 命令行接口
 * @version 1.0.0
 * @author PDD-Skills Team
 */

import { readFile, writeFile, unlink, access } from 'fs/promises';
import { join, dirname } from 'path';
import { createReadStream } from 'fs';
import { OpenClawAdapter, createAdapter } from './openclaw-adapter.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** PID 文件名 */
const PID_FILE_NAME = 'openclaw.pid';

/** 配置文件名 */
const CONFIG_FILE_NAME = 'openclaw-config.json';

/**
 * OpenClaw CLI 类 - 管理命令行交互和服务控制
 * @class OpenClawCLI
 */
export class OpenClawCLI {
  /**
   * 创建 CLI 实例
   * @param {Object} options - 配置选项
   * @param {string} [options.baseDir] - 项目根目录
   * @param {string} [options.configDir] - 配置文件目录
   */
  constructor(options = {}) {
    this.baseDir = options.baseDir || process.cwd();
    this.configDir = options.configDir || join(this.baseDir, '.pdd');
    
    /** @type {OpenClawAdapter|null} 适配器实例 */
    this.adapter = null;
    
    /** @type {Object|null} 当前配置 */
    this.config = null;
  }

  /**
   * 执行 CLI 命令
   * @param {string} command - 命令名称
   * @param {Object} [options={}] - 命令选项
   * @returns {Promise<*>} 命令执行结果
   */
  async execute(command, options = {}) {
    switch (command) {
      case 'start':
        return this.start(options);
      case 'stop':
        return this.stop();
      case 'status':
        return this.status();
      case 'list-tools':
        return this.listTools();
      case 'test':
        return this.testTool(options);
      case 'logs':
        return this.showLogs(options);
      case 'init':
        return this.initConfig();
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  /**
   * 启动 OpenClaw 服务
   * @param {Object} options - 启动选项
   * @param {number} [options.port=8080] - 监听端口
   * @param {string} [options.token] - 认证令牌
   * @param {boolean} [options.daemon=false] - 是否以守护进程模式运行
   * @returns {Promise<Object>} 启动结果
   */
  async start(options = {}) {
    // 加载配置
    await this._loadConfig();
    
    // 首次运行时显示配置向导
    if (!this.config) {
      console.log('\n📋 首次运行检测到，启动配置向导...\n');
      await this.initConfig();
      await this._loadConfig();
    }

    const port = options.port || this.config?.port || 8080;
    const token = options.token || this.config?.token;

    // 检查是否已在运行
    if (await this._isRunning()) {
      const pid = await this._readPidFile();
      return {
        success: false,
        message: `OpenClaw 服务已在运行 (PID: ${pid})`,
        pid
      };
    }

    console.log(`\n🚀 启动 OpenClaw 服务...`);
    console.log(`   端口: ${port}`);
    console.log(`   端点: http://localhost:${port}\n`);

    // 创建适配器实例
    this.adapter = createAdapter({
      endpoint: `http://localhost:${port}`,
      token,
      heartbeatInterval: 30000
    });

    // 绑定事件监听
    this._bindAdapterEvents();

    try {
      // 连接到服务
      await this.adapter.connect();

      // 写入 PID 文件
      await this._writePidFile(process.pid);

      // 如果是守护进程模式
      if (options.daemon) {
        console.log(`✅ OpenClaw 服务已以守护进程模式启动`);
        console.log(`   PID: ${process.pid}`);
      } else {
        console.log(`✅ OpenClaw 服务已启动`);
        console.log(`   输入 'pdd openclaw stop' 停止服务`);
        console.log(`   输入 'pdd openclaw status' 查看状态\n`);
        
        // 保持进程运行
        await this._keepAlive();
      }

      return {
        success: true,
        port,
        pid: process.pid,
        endpoint: `http://localhost:${port}`
      };
    } catch (error) {
      return {
        success: false,
        message: `启动失败: ${error.message}`,
        error: error.toString()
      };
    }
  }

  /**
   * 停止 OpenClaw 服务
   * @returns {Promise<Object>} 停止结果
   */
  async stop() {
    console.log('\n🛑 正在停止 OpenClaw 服务...\n');

    if (!await this._isRunning()) {
      return {
        success: false,
        message: 'OpenClaw 服务未在运行'
      };
    }

    try {
      // 断开适配器连接
      if (this.adapter) {
        await this.adapter.disconnect();
        this.adapter = null;
      }

      // 删除 PID 文件
      await this._removePidFile();

      console.log('✅ OpenClaw 服务已停止\n');
      return {
        success: true,
        message: 'Service stopped successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `停止失败: ${error.message}`,
        error: error.toString()
      };
    }
  }

  /**
   * 查看连接状态
   * @returns {Promise<Object>} 状态信息
   */
  async status() {
    const isRunning = await this._isRunning();
    const pid = isRunning ? await this._readPidFile() : null;

    let adapterStatus = null;
    if (this.adapter) {
      adapterStatus = this.adapter.getStatusDetails();
    }

    const status = {
      running: isRunning,
      pid,
      adapter: adapterStatus,
      config: this.config ? {
        port: this.config.port,
        hasToken: !!this.config.token
      } : null
    };

    // 格式化输出
    console.log('\n📊 OpenClaw 服务状态\n');
    console.log(`   状态: ${isRunning ? '✅ 运行中' : '⏹️ 未运行'}`);
    if (pid) console.log(`   PID: ${pid}`);
    if (adapterStatus) {
      console.log(`   连接状态: ${adapterStatus.status}`);
      console.log(`   活跃会话: ${adapterStatus.activeSessions}`);
      console.log(`   已注册能力: ${adapterStatus.capabilitiesCount}`);
      console.log(`   待处理请求: ${adapterStatus.pendingRequests}`);
      if (adapterStatus.uptime > 0) {
        const uptime = this._formatUptime(adapterStatus.uptime);
        console.log(`   运行时间: ${uptime}`);
      }
    }
    console.log('');

    return status;
  }

  /**
   * 列出已暴露的工具
   * @returns {Promise<Array<Object>>} 工具列表
   */
  async listTools() {
    if (!this.adapter) {
      // 即使没有活跃连接也返回注册的工具列表
      this.adapter = createAdapter();
    }

    const tools = this.adapter.registry.toOpenClawTools();
    
    console.log('\n🔧 已暴露的 OpenClaw 工具\n');
    console.log(`   总计: ${tools.length} 个工具\n`);
    
    for (const tool of tools) {
      const func = tool.function;
      console.log(`   📦 ${func.name}`);
      console.log(`      描述: ${func.description}`);
      if (func.parameters?.properties) {
        const params = Object.keys(func.parameters.properties);
        if (params.length > 0) {
          console.log(`      参数: ${params.join(', ')}`);
        }
      }
      console.log('');
    }

    return tools;
  }

  /**
   * 测试工具调用
   * @param {Object} options - 测试选项
   * @param {string} [options.toolName] - 要测试的工具名称
   * @returns {Promise<Object>} 测试结果
   */
  async testTool(options = {}) {
    if (!this.adapter) {
      this.adapter = createAdapter();
      await this.adapter.connect().catch(() => {});
    }

    const toolName = options.toolName || 'pdd_list_skills';
    
    console.log(`\n🧪 测试工具调用: ${toolName}\n`);

    try {
      const startTime = Date.now();
      const result = await this.adapter.sendRequest(toolName, {});
      const duration = Date.now() - startTime;

      console.log('✅ 工具调用成功');
      console.log(`   耗时: ${duration}ms`);
      console.log(`   结果:`);
      console.log(`   ${JSON.stringify(result, null, 2)}\n`);

      return {
        success: true,
        tool: toolName,
        duration,
        result
      };
    } catch (error) {
      console.log('❌ 工具调用失败');
      console.log(`   错误: ${error.message}\n`);

      return {
        success: false,
        tool: toolName,
        error: error.message
      };
    }
  }

  /**
   * 显示通信日志
   * @param {Object} options - 日志选项
   * @param {boolean} [options.tail=false] - 是否持续跟踪输出
   * @param {number} [options.limit=50] - 显示条数
   * @returns {Promise<Array<Object>>} 日志条目
   */
  async showLogs(options = {}) {
    if (!this.adapter) {
      console.log('\n⚠️  没有活跃的服务实例，无法获取日志\n');
      return [];
    }

    const limit = options.limit || 50;
    const logs = this.adapter.getMessageLog({ limit });

    console.log(`\n📋 OpenClaw 通信日志 (最近 ${logs.length} 条)\n`);

    for (const entry of logs) {
      const icon = entry.direction === 'outgoing' ? '➡️' :
                   entry.direction === 'incoming' ? '⬅️' : '🔵';
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const msg = entry.message;
      
      console.log(`${icon} [${time}] ${msg.type}`);
      if (msg.payload?.tool) {
        console.log(`   Tool: ${msg.payload.tool}`);
      }
      if (msg.payload?.event) {
        console.log(`   Event: ${msg.payload.event}`);
      }
      console.log('');
    }

    // tail 模式：持续跟踪
    if (options.tail) {
      console.log('... 持续跟踪中 (Ctrl+C 退出) ...\n');
      // 在实际实现中这里会有持续输出的逻辑
    }

    return logs;
  }

  /**
   * 初始化配置（交互式向导）
   * @returns {Promise<Object>} 生成的配置
   */
  async initConfig() {
    console.log('\n🔧 OpenClaw 配置向导\n');
    console.log('本向导将帮助你配置 OpenClaw 集成设置。\n');

    // 使用默认配置或提示用户输入
    const config = {
      port: 8080,
      token: this._generateToken(),
      endpoint: 'http://localhost:8080',
      heartbeatInterval: 30000,
      maxReconnectDelay: 30000,
      logLevel: 'info',
      createdAt: new Date().toISOString()
    };

    console.log('配置项:');
    console.log(`   端口 (port): ${config.port}`);
    console.log(`   端点 (endpoint): ${config.endpoint}`);
    console.log(`   Token: ${config.token.substring(0, 8)}...`);
    console.log(`   心跳间隔: ${config.heartbeatInterval}ms`);
    console.log(`   日志级别: ${config.logLevel}\n`);

    // 保存配置
    await this._saveConfig(config);

    console.log('✅ 配置已保存到:', join(this.configDir, CONFIG_FILE_NAME));
    console.log('   你可以随时使用 "pdd openclaw init" 重新配置\n');

    return config;
  }

  /**
   * 绑定适配器事件
   * @private
   */
  _bindAdapterEvents() {
    if (!this.adapter) return;

    this.adapter.on('connected', () => {
      console.log('   ✅ 已连接到 OpenClaw 服务');
    });

    this.adapter.on('disconnected', () => {
      console.log('   ⚠️  与 OpenClaw 服务的连接已断开');
    });

    this.adapter.on('reconnecting', ({ attempt, delay }) => {
      console.log(`   🔄 正在重连... (第 ${attempt} 次, ${delay}ms 后)`);
    });

    this.adapter.on('error', (error) => {
      console.error(`   ❌ 错误: ${error.message}`);
    });

    this.adapter.on('message', (message) => {
      if (message.type === 'event' && message.payload?.event === 'pong') {
        // 心跳响应，不输出
      }
    });
  }

  /**
   * 加载配置
   * @private
   * @returns {Promise<Object|null>} 配置对象
   */
  async _loadConfig() {
    const configPath = join(this.configDir, CONFIG_FILE_NAME);
    
    try {
      await access(configPath);
      const content = await readFile(configPath, 'utf-8');
      this.config = JSON.parse(content);
      return this.config;
    } catch {
      this.config = null;
      return null;
    }
  }

  /**
   * 保存配置
   * @private
   * @param {Object} config - 配置对象
   */
  async _saveConfig(config) {
    const configPath = join(this.configDir, CONFIG_FILE_NAME);
    const content = JSON.stringify(config, null, 2);
    await writeFile(configPath, content, 'utf-8');
    this.config = config;
  }

  /**
   * 检查服务是否正在运行
   * @private
   * @returns {Promise<boolean>}
   */
  async _isRunning() {
    const pid = await this._readPidFile();
    if (!pid) return false;
    
    try {
      // Windows 下检查进程是否存在
      process.kill(pid, 0);
      return true;
    } catch {
      // 进程不存在，清理 PID 文件
      await this._removePidFile();
      return false;
    }
  }

  /**
   * 读取 PID 文件
   * @private
   * @returns {Promise<number|null>} PID 或 null
   */
  async _readPidFile() {
    const pidPath = join(this.configDir, PID_FILE_NAME);
    
    try {
      const content = await readFile(pidPath, 'utf-8');
      return parseInt(content.trim(), 10);
    } catch {
      return null;
    }
  }

  /**
   * 写入 PID 文件
   * @private
   * @param {number} pid - 进程 ID
   */
  async _writePidFile(pid) {
    const pidPath = join(this.configDir, PID_FILE_NAME);
    await writeFile(pidPath, pid.toString(), 'utf-8');
  }

  /**
   * 删除 PID 文件
   * @private
   */
  async _removePidFile() {
    const pidPath = join(this.configDir, PID_FILE_NAME);
    
    try {
      await unlink(pidPath);
    } catch {
      // 忽略文件不存在的错误
    }
  }

  /**
   * 保持进程活跃
   * @private
   * @returns {Promise<void>}
   */
  async _keepAlive() {
    return new Promise((resolve) => {
      // 监听退出信号
      const cleanup = async () => {
        console.log('\n\n🛑 正在优雅关闭...\n');
        await this.stop();
        resolve();
        process.exit(0);
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
    });
  }

  /**
   * 生成随机 Token
   * @private
   * @returns {string} 随机 token
   */
  _generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = 'oc_';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * 格式化运行时间
   * @private
   * @param {number} ms - 毫秒数
   * @returns {string} 格式化的时间字符串
   */
  _formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天 ${hours % 24}小时 ${minutes % 60}分钟`;
    if (hours > 0) return `${hours}小时 ${minutes % 60}分钟 ${seconds % 60}秒`;
    if (minutes > 0) return `${minutes}分钟 ${seconds % 60}秒`;
    return `${seconds}秒`;
  }
}

/**
 * 创建 CLI 实例的工厂函数
 * @param {Object} options - 配置选项
 * @returns {OpenClawCLI} CLI 实例
 */
export function createCLI(options = {}) {
  return new OpenClawCLI(options);
}
