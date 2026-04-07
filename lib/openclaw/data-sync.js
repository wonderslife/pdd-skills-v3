/**
 * @module openclaw/data-sync
 * @description OpenClaw 数据同步模块 - 管理 PDD 与 OpenClaw 之间的双向数据同步
 * @version 1.0.0
 * @author PDD-Skills Team
 */

import { readFile, writeFile, mkdir, access, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';

/**
 * 同步冲突解决策略枚举
 * @enum {string}
 */
export const ConflictStrategy = {
  LAST_WRITE_WINS: 'last-write-wins',
  MERGE: 'merge',
  MANUAL: 'manual'
};

/**
 * 同步方向枚举
 * @enum {string}
 */
export const SyncDirection = {
  PUSH: 'push',         // PDD → OpenClaw
  PULL: 'pull',         // OpenClaw → PDD
  BIDIRECTIONAL: 'bidirectional'  // 双向同步
};

/**
 * 数据类型枚举
 * @enum {string}
 */
export const DataType = {
  SKILLS: 'skills',
  CONFIG: 'config',
  CACHE: 'cache',
  REPORT: 'report'
};

/**
 * 同步操作记录
 * @typedef {Object} SyncLogEntry
 * @property {string} id - 操作唯一标识
 * @property {string} dataType - 数据类型
 * @property {string} direction - 同步方向
 * @property {string} status - 操作状态 (success/failed/conflict/rolled_back)
 * @property {Object} sourceData - 源数据快照
 * @property {Object} [targetData] - 目标数据快照
 * @property {number} timestamp - 操作时间戳
 * @property {number} duration - 操作耗时(ms)
 * @property {string} [errorMessage] - 错误信息
 */

/**
 * DataSyncManager 类 - 管理双向数据同步
 * @class DataSyncManager
 */
export class DataSyncManager {
  /**
   * 创建同步管理器实例
   * @param {Object} options - 配置选项
   * @param {string} [options.syncDir] - 同步数据存储目录
   * @param {ConflictStrategy} [options.conflictStrategy=ConflictStrategy.LAST_WRITE_WINS] - 冲突解决策略
   * @param {boolean} [options.autoResolveConflicts=true] - 是否自动解决冲突
   * @param {number} [options.maxLogEntries=1000] - 最大日志条目数
   */
  constructor(options = {}) {
    this.syncDir = options.syncDir || join(process.cwd(), '.pdd', 'sync');
    this.conflictStrategy = options.conflictStrategy || ConflictStrategy.LAST_WRITE_WINS;
    this.autoResolveConflicts = options.autoResolveConflicts !== false;
    this.maxLogEntries = options.maxLogEntries || 1000;

    /** @type {Map<string, Object>} 本地数据缓存 */
    this.localCache = new Map();
    
    /** @type {Map<string, number>} 版本号追踪 */
    this.versionTracker = new Map();
    
    /** @type {Array<SyncLogEntry>} 同步日志 */
    this.syncLog = [];
    
    /** @type {Map<string, Object>} 回滚快照 */
    this.rollbackSnapshots = new Map();
  }

  /**
   * 初始化同步管理器
   * @returns {Promise<void>}
   */
  async initialize() {
    // 确保同步目录存在
    await mkdir(this.syncDir, { recursive: true });
    
    // 加载版本追踪数据
    await this._loadVersionTracker();
    
    // 加载同步日志
    await this._loadSyncLog();
    
    console.log('✅ DataSyncManager 初始化完成');
  }

  /**
   * 执行同步操作
   * @param {DataType|string} dataType - 数据类型
   * @param {SyncDirection|string} [direction=SyncDirection.BIDIRECTIONAL] - 同步方向
   * @param {Object} [options] - 同步选项
   * @returns {Promise<SyncLogEntry>} 同步操作记录
   */
  async sync(dataType, direction = SyncDirection.BIDIRECTIONAL, options = {}) {
    const startTime = Date.now();
    const syncId = randomUUID();
    
    const logEntry = {
      id: syncId,
      dataType,
      direction,
      status: 'success',
      sourceData: null,
      targetData: null,
      timestamp: startTime,
      duration: 0,
      errorMessage: null
    };

    try {
      // 创建回滚快照
      await this._createRollbackSnapshot(dataType, syncId);

      // 根据方向执行同步
      if (direction === SyncDirection.PUSH || direction === SyncDirection.BIDIRECTIONAL) {
        await this._pushToRemote(dataType, logEntry);
      }

      if (direction === SyncDirection.PULL || direction === SyncDirection.BIDIRECTIONAL) {
        await this._pullFromRemote(dataType, logEntry);
      }

      // 更新版本号
      this._updateVersion(dataType);

    } catch (error) {
      logEntry.status = 'failed';
      logEntry.errorMessage = error.message;
      
      // 尝试回滚
      if (options.rollbackOnError !== false) {
        await this._rollback(syncId);
        logEntry.status = 'rolled_back';
      }
    }

    logEntry.duration = Date.now() - startTime;
    
    // 记录日志
    this._addLogEntry(logEntry);
    await this._persistSyncLog();

    return logEntry;
  }

  /**
   * 推送数据到远程 (PDD → OpenClaw)
   * @private
   * @param {DataType} dataType - 数据类型
   * @param {SyncLogEntry} logEntry - 日志条目
   */
  async _pushToRemote(dataType, logEntry) {
    const localData = await this._getLocalData(dataType);
    logEntry.sourceData = localData;

    // 检查是否有变更
    const localVersion = this.versionTracker.get(`${dataType}:local`) || 0;
    const remoteVersion = this.versionTracker.get(`${dataType}:remote`) || 0;

    if (localVersion <= remoteVersion && !this._hasChanges(localData)) {
      console.log(`[${dataType}] 无需推送 (本地版本 ${localVersion} <= 远程版本 ${remoteVersion})`);
      return;
    }

    // 冲突检测
    if (remoteVersion > 0 && localVersion > remoteVersion) {
      const conflict = await this._detectConflict(dataType, localData);
      if (conflict) {
        await this._resolveConflict(dataType, conflict, logEntry);
        return;
      }
    }

    // 执行推送
    console.log(`[${dataType}] 推送数据到 OpenClaw...`);
    await this._simulatePush(dataType, localData);
    
    logEntry.targetData = await this._getRemoteSnapshot(dataType);
    console.log(`[${dataType}] ✅ 推送完成`);
  }

  /**
   * 从远程拉取数据 (OpenClaw → PDD)
   * @private
   * @param {DataType} dataType - 数据类型
   * @param {SyncLogEntry} logEntry - 日志条目
   */
  async _pullFromRemote(dataType, logEntry) {
    const remoteData = await this._getRemoteData(dataType);
    logEntry.targetData = remoteData;

    // 检查是否有变更
    const remoteVersion = this.versionTracker.get(`${dataType}:remote`) || 0;
    const localVersion = this.versionTracker.get(`${dataType}:local`) || 0;

    if (remoteVersion <= localVersion && !this._hasChanges(remoteData)) {
      console.log(`[${dataType}] 无需拉取 (远程版本 ${remoteVersion} <= 本地版本 ${localVersion})`);
      return;
    }

    // 冲突检测
    if (localVersion > 0 && remoteVersion > localVersion) {
      const conflict = await this._detectConflict(dataType, remoteData);
      if (conflict) {
        await this._resolveConflict(dataType, conflict, logEntry);
        return;
      }
    }

    // 执行拉取
    console.log(`[${dataType}] 从 OpenClaw 拉取数据...`);
    await this._simulatePull(dataType, remoteData);
    
    logEntry.sourceData = await this._getLocalData(dataType);
    console.log(`[${dataType}] ✅ 拉取完成`);
  }

  /**
   * 检测数据冲突
   * @private
   * @param {DataType} dataType - 数据类型
   * @param {Object} incomingData - 新到达的数据
   * @returns {Promise<Object|null>} 冲突信息或 null
   */
  async _detectConflict(dataType, incomingData) {
    const existingData = await this._getLocalData(dataType);
    
    // 简单比较：检查关键字段是否都有修改
    const existingKeys = Object.keys(existingData || {});
    const incomingKeys = Object.keys(incomingData || {});

    if (existingKeys.length === 0 || incomingKeys.length === 0) {
      return null; // 一方为空，无冲突
    }

    // 检查双方都有修改的字段
    const modifiedBoth = existingKeys.filter(key => 
      incomingKeys.includes(key) &&
      JSON.stringify(existingData[key]) !== JSON.stringify(incomingData[key])
    );

    if (modifiedBoth.length > 0) {
      return {
        dataType,
        conflictingFields: modifiedBoth,
        localData: existingData,
        remoteData: incomingData,
        detectedAt: Date.now()
      };
    }

    return null;
  }

  /**
   * 解决冲突
   * @private
   * @param {DataType} dataType - 数据类型
   * @param {Object} conflict - 冲突信息
   * @param {SyncLogEntry} logEntry - 日志条目
   */
  async _resolveConflict(dataType, conflict, logEntry) {
    console.warn(`[${dataType}] ⚠️ 检测到冲突! 字段: ${conflict.conflictingFields.join(', ')}`);

    let resolvedData;

    switch (this.conflictStrategy) {
      case ConflictStrategy.LAST_WRITE_WINS:
        resolvedData = conflict.remoteData; // 远程数据更新（假设拉取场景）
        console.log(`[${dataType}] 使用 Last-Write-Wins 策略解决冲突`);
        break;

      case ConflictStrategy.MERGE:
        resolvedData = this._mergeData(conflict.localData, conflict.remoteData);
        console.log(`[${dataType}] 使用 Merge 策略解决冲突`);
        break;

      case ConflictStrategy.MANUAL:
        if (!this.autoResolveConflicts) {
          logEntry.status = 'conflict';
          logEntry.errorMessage = `Manual resolution required for fields: ${conflict.conflictingFields.join(', ')}`;
          throw new Error(logEntry.errorMessage);
        }
        // 自动模式下回退到 last-write-wins
        resolvedData = conflict.remoteData;
        console.log(`[${dataType}] 自动模式回退到 Last-Write-Wins`);
        break;

      default:
        resolvedData = conflict.remoteData;
    }

    // 应用解决后的数据
    await this._applyResolvedData(dataType, resolvedData);
    console.log(`[${dataType]} ✅ 冲突已解决`);
  }

  /**
   * 合并两份数据
   * @private
   * @param {Object} local - 本地数据
   * @param {Object} remote - 远程数据
   * @returns {Object} 合并后的数据
   */
  _mergeData(local, remote) {
    const merged = { ...local };
    
    for (const key of Object.keys(remote)) {
      if (!(key in local)) {
        merged[key] = remote[key];
      } else if (typeof remote[key] === 'object' && typeof local[key] === 'object' && 
                 remote[key] !== null && local[key] !== null && !Array.isArray(remote[key])) {
        merged[key] = this._mergeData(local[key], remote[key]);
      }
      // 对于基本类型和数组，保留远程值（last-write-wins for leaf nodes）
    }

    return merged;
  }

  /**
   * 回滚到指定同步操作前的状态
   * @param {string} syncId - 同步操作 ID
   * @returns {Promise<boolean>} 是否回滚成功
   */
  async rollback(syncId) {
    return this._rollback(syncId);
  }

  /**
   * 执行回滚操作
   * @private
   * @param {string} syncId - 同步操作 ID
   * @returns {Promise<boolean>}
   */
  async _rollback(syncId) {
    const snapshot = this.rollbackSnapshots.get(syncId);
    
    if (!snapshot) {
      console.warn(`未找到同步操作 ${syncId} 的回滚快照`);
      return false;
    }

    console.log(`↩️ 正在回滚同步操作 ${syncId}...`);

    try {
      for (const [dataType, data] of Object.entries(snapshot)) {
        await this._restoreLocalData(dataType, data);
      }

      // 更新日志
      const logEntry = this.syncLog.find(e => e.id === syncId);
      if (logEntry) {
        logEntry.status = 'rolled_back';
      }

      // 清理快照
      this.rollbackSnapshots.delete(syncId);
      
      console.log(`✅ 回滚完成`);
      return true;
    } catch (error) {
      console.error(`❌ 回滚失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取同步日志
   * @param {Object} [options] - 过滤选项
   * @param {DataType} [options.dataType] - 按数据类型过滤
   * @param {string} [options.status] - 按状态过滤
   * @param {number} [options.limit=100] - 返回条数限制
   * @returns {Array<SyncLogEntry>} 日志条目
   */
  getSyncLog(options = {}) {
    let log = [...this.syncLog];

    if (options.dataType) {
      log = log.filter(entry => entry.dataType === options.dataType);
    }

    if (options.status) {
      log = log.filter(entry => entry.status === options.status);
    }

    const limit = options.limit || 100;
    return log.slice(-limit);
  }

  /**
   * 获取同步统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    const total = this.syncLog.length;
    const successful = this.syncLog.filter(e => e.status === 'success').length;
    const failed = this.syncLog.filter(e => e.status === 'failed').length;
    const conflicts = this.syncLog.filter(e => e.status === 'conflict').length;
    const rolledBack = this.syncLog.filter(e => e.status === 'rolled_back').length;

    const avgDuration = total > 0 
      ? Math.round(this.syncLog.reduce((sum, e) => sum + e.duration, 0) / total)
      : 0;

    return {
      totalSyncOperations: total,
      successful,
      failed,
      conflicts,
      rolledBack,
      successRate: total > 0 ? ((successful / total) * 100).toFixed(2) + '%' : 'N/A',
      averageDuration: avgDuration + 'ms',
      trackedTypes: Array.from(new Set(this.syncLog.map(e => e.dataType))),
      lastSyncTime: total > 0 ? this.syncLog[total - 1].timestamp : null
    };
  }

  /**
   * 获取本地数据
   * @private
   * @param {DataType} dataType - 数据类型
   * @returns {Promise<Object>} 本地数据
   */
  async _getLocalData(dataType) {
    // 从实际的数据源获取数据
    switch (dataType) {
      case DataType.SKILLS:
        return this._getMockSkillsData();
      case DataType.CONFIG:
        return this._getMockConfigData();
      case DataType.CACHE:
        return this._getMockCacheData();
      case DataType.REPORT:
        return this._getMockReportData();
      default:
        return {};
    }
  }

  /**
   * 获取远程数据（模拟）
   * @private
   * @param {DataType} dataType - 数据类型
   * @returns {Promise<Object>} 远程数据
   */
  async _getRemoteData(dataType) {
    // 模拟从 OpenClaw 获取数据
    await this._sleep(50);
    
    // 返回模拟的远程数据
    return {
      _source: 'remote',
      _syncedAt: Date.now(),
      ...(await this._getLocalData(dataType)),
      remoteField: 'remote_value_' + Date.now()
    };
  }

  /**
   * 获取远程数据快照
   * @private
   * @param {DataType} dataType - 数据类型
   * @returns {Promise<Object>}
   */
  async _getRemoteSnapshot(dataType) {
    return {
      snapshot: true,
      dataType,
      timestamp: Date.now()
    };
  }

  /**
   * 模拟推送操作
   * @private
   * @param {DataType} dataType - 数据类型
   * @param {Object} data - 数据
   */
  async _simulatePush(dataType, data) {
    await this._sleep(30);
    // 实际实现中这里会调用 OpenClaw API
  }

  /**
   * 模拟拉取操作
   * @private
   * @param {DataType} dataType - 数据类型
   * @param {Object} data - 数据
   */
  async _simulatePull(dataType, data) {
    await this._sleep(30);
    // 实际实现中这里会更新本地数据源
  }

  /**
   * 应用解决后的数据
   * @private
   * @param {DataType} dataType - 数据类型
   * @param {Object} data - 数据
   */
  async _applyResolvedData(dataType, data) {
    // 实际实现中这里会写回到本地数据源
    this.localCache.set(dataType, data);
  }

  /**
   * 恢复本地数据
   * @private
   * @param {DataType} dataType - 数据类型
   * @param {Object} data - 数据
   */
  async _restoreLocalData(dataType, data) {
    this.localCache.set(dataType, data);
  }

  /**
   * 创建回滚快照
   * @private
   * @param {DataType} dataType - 数据类型
   * @param {string} syncId - 同步操作 ID
   */
  async _createRollbackSnapshot(dataType, syncId) {
    if (!this.rollbackSnapshots.has(syncId)) {
      this.rollbackSnapshots.set(syncId, {});
    }
    
    const currentData = await this._getLocalData(dataType);
    this.rollbackSnapshots.get(syncId)[dataType] = currentData;
  }

  /**
   * 更新版本号
   * @private
   * @param {DataType} dataType - 数据类型
   */
  _updateVersion(dataType) {
    const now = Date.now();
    this.versionTracker.set(`${dataType}:local`, now);
    this.versionTracker.set(`${dataType}:remote`, now);
  }

  /**
   * 检查数据是否有实质变更
   * @private
   * @param {Object} data - 数据
   * @returns {boolean}
   */
  _hasChanges(data) {
    if (!data) return false;
    return Object.keys(data).length > 0;
  }

  /**
   * 添加日志条目
   * @private
   * @param {SyncLogEntry} entry - 日志条目
   */
  _addLogEntry(entry) {
    this.syncLog.push(entry);
    
    // 限制日志大小
    if (this.syncLog.length > this.maxLogEntries) {
      this.syncLog = this.syncLog.slice(-Math.floor(this.maxLogEntries / 2));
    }
  }

  /**
   * 持久化同步日志
   * @private
   */
  async _persistSyncLog() {
    try {
      const logPath = join(this.syncDir, 'sync-log.json');
      await writeFile(logPath, JSON.stringify(this.syncLog, null, 2), 'utf-8');
    } catch (error) {
      console.error('持久化同步日志失败:', error.message);
    }
  }

  /**
   * 加载同步日志
   * @private
   */
  async _loadSyncLog() {
    try {
      const logPath = join(this.syncDir, 'sync-log.json');
      const content = await readFile(logPath, 'utf-8');
      this.syncLog = JSON.parse(content);
    } catch {
      this.syncLog = [];
    }
  }

  /**
   * 加载版本追踪数据
   * @private
   */
  async _loadVersionTracker() {
    try {
      const trackerPath = join(this.syncDir, 'versions.json');
      const content = await readFile(trackerPath, 'utf-8');
      const data = JSON.parse(content);
      
      for (const [key, value] of Object.entries(data)) {
        this.versionTracker.set(key, value);
      }
    } catch {
      // 使用空版本追踪器
    }
  }

  /**
   * 持久化版本追踪数据
   * @private
   */
  async _persistVersionTracker() {
    try {
      const trackerPath = join(this.syncDir, 'versions.json');
      const data = Object.fromEntries(this.versionTracker);
      await writeFile(trackerPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('持久化版本追踪失败:', error.message);
    }
  }

  /**
   * 模拟数据获取方法
   * @private
   */
  async _getMockSkillsData() {
    return {
      skills: [
        { name: 'pdd_generate_spec', version: '1.0.0', updatedAt: Date.now() },
        { name: 'pdd_generate_code', version: '1.0.0', updatedAt: Date.now() }
      ],
      totalCount: 6,
      lastUpdated: Date.now()
    };
  }

  async _getMockConfigData() {
    return {
      port: 8080,
      logLevel: 'info',
      syncEnabled: true,
      updatedAt: Date.now()
    };
  }

  async _getMockCacheData() {
    return {
      entries: 0,
      size: 0,
      lastCleared: Date.now()
    };
  }

  async _getMockReportData() {
    return {
      reports: [],
      generatedAt: Date.now()
    };
  }

  /**
   * 异步等待工具函数
   * @private
   * @param {number} ms - 毫秒数
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * SyncScheduler 类 - 定时同步调度器
 * @class SyncScheduler
 */
export class SyncScheduler {
  /**
   * 创建调度器实例
   * @param {DataSyncManager} syncManager - 同步管理器实例
   * @param {Object} options - 配置选项
   * @param {number} [options.defaultIntervalMs=300000] - 默认调度间隔(5分钟)
   */
  constructor(syncManager, options = {}) {
    this.syncManager = syncManager;
    this.defaultIntervalMs = options.defaultIntervalMs || 300000; // 5分钟

    /** @type {Map<string, Timer>} 已注册的任务 */
    this.scheduledTasks = new Map();
    
    /** @type {boolean} 是否运行中 */
    this.running = false;
  }

  /**
   * 启动调度器
   */
  start() {
    if (this.running) return;
    this.running = true;
    console.log('⏰ SyncScheduler 已启动');
  }

  /**
   * 停止调度器
   */
  stop() {
    this.running = false;
    
    // 清除所有定时任务
    for (const [id, timer] of this.scheduledTasks) {
      clearInterval(timer);
    }
    this.scheduledTasks.clear();
    
    console.log('⏹️ SyncScheduler 已停止');
  }

  /**
   * 注册定时同步任务
   * @param {string} taskId - 任务ID
   * @param {DataType} dataType - 要同步的数据类型
   * @param {SyncDirection} [direction] - 同步方向
   * @param {number} [intervalMs] - 自定义间隔
   * @returns {string} 任务ID
   */
  schedule(taskId, dataType, direction = SyncDirection.BIDIRECTIONAL, intervalMs) {
    if (this.scheduledTasks.has(taskId)) {
      this.unschedule(taskId);
    }

    const interval = intervalMs || this.defaultIntervalMs;
    
    const timer = setInterval(async () => {
      if (!this.running) return;
      
      try {
        console.log(`⏰ 执行定时同步任务: ${taskId} (${dataType})`);
        await this.syncManager.sync(dataType, direction);
      } catch (error) {
        console.error(`定时同步任务 ${taskId} 执行失败:`, error.message);
      }
    }, interval);

    // 防止进程被阻塞
    if (timer.unref) {
      timer.unref();
    }

    this.scheduledTasks.set(taskId, timer);
    
    console.log(`✅ 已注册定时任务: ${taskId} (间隔: ${interval / 1000}s)`);
    return taskId;
  }

  /**
   * 取消定时任务
   * @param {string} taskId - 任务ID
   * @returns {boolean} 是否取消成功
   */
  unschedule(taskId) {
    const timer = this.scheduledTasks.get(taskId);
    
    if (!timer) return false;
    
    clearInterval(timer);
    this.scheduledTasks.delete(taskId);
    
    console.log(`❌ 已取消定时任务: ${taskId}`);
    return true;
  }

  /**
   * 获取已注册的任务列表
   * @returns {Array<Object>} 任务列表
   */
  listTasks() {
    return Array.from(this.scheduledTasks.keys()).map(id => ({
      id,
      active: this.running
    }));
  }

  /**
   * 立即执行所有任务一次
   * @returns {Promise<number>} 执行成功的任务数
   */
  async triggerAll() {
    let successCount = 0;
    
    for (const taskId of this.scheduledTasks.keys()) {
      try {
        // 这里简化处理，实际应该从任务配置中获取 dataType 和 direction
        console.log(`⚡ 手动触发任务: ${taskId}`);
        successCount++;
      } catch (error) {
        console.error(`触发任务 ${taskId} 失败:`, error.message);
      }
    }
    
    return successCount;
  }
}

/**
 * 创建同步管理器的工厂函数
 * @param {Object} options - 配置选项
 * @returns {DataSyncManager} 同步管理器实例
 */
export function createDataSyncManager(options = {}) {
  return new DataSyncManager(options);
}

/**
 * 创建同步调度器的工厂函数
 * @param {DataSyncManager} syncManager - 同步管理器实例
 * @param {Object} options - 配置选项
 * @returns {SyncScheduler} 调度器实例
 */
export function createSyncScheduler(syncManager, options = {}) {
  return new SyncScheduler(syncManager, options);
}
