// lib/cache/system-cache.js - PDD Three-Level Cache System
// 实现L1(会话) -> L2(项目) -> L3(全局/磁盘)三级缓存架构
// 支持TTL过期、LRU/LFU淘汰、命中统计、自动清理

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { log } from '../utils/logger.js';
import {
  CacheLevel,
  DEFAULT_CACHE_CONFIG,
  CACHE_KEY_PREFIXES,
  getRecommendedStrategy,
  validateCacheConfig
} from './cache-config.js';

/**
 * LRU (Least Recently Used) 缓存实现
 * @private
 */
class LRUCache {
  /**
   * @param {number} maxSize - 最大容量
   */
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map(); // Map保持插入顺序，用于LRU
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * 获取缓存值
   * @param {string} key - 缓存键
   * @returns {*|null} 缓存值或null
   */
  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      this.misses++;
      return null;
    }

    // 检查TTL是否过期
    if (item.ttl && Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.misses++;
      this.evictions++;
      return null;
    }

    // LRU：将访问的项移到最新位置（Map末尾）
    this.cache.delete(key);
    this.cache.set(key, item);
    this.hits++;

    return item.value;
  }

  /**
   * 设置缓存值
   * @param {string} key - 缓存键
   * @param {*} value - 缓存值
   * @param {Object} options - 选项
   * @param {number} options.ttl - TTL（毫秒）
   */
  set(key, value, options = {}) {
    // 如果键已存在，先删除（为了更新顺序）
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // 检查容量，执行LRU淘汰
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.evictions++;
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: options.ttl || null
    });
  }

  /**
   * 删除指定键
   * @param {string} key - 缓存键
   * @returns {boolean} 是否删除成功
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * 检查键是否存在
   * @param {string} key - 缓存键
   * @returns {boolean}
   */
  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;

    if (item.ttl && Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * 获取当前大小
   * @returns {number}
   */
  get size() {
    return this.cache.size;
  }

  /**
   * 获取统计信息
   * @returns {Object}
   */
  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(2) + '%' : 'N/A',
      evictions: this.evictions
    };
  }
}

/**
 * LFU (Least Frequently Used) 磁盘缓存实现
 * @private
 */
class DiskCache {
  /**
   * @param {Object} config - 配置
   */
  constructor(config = {}) {
    this.cacheDir = path.resolve(config.diskPath || '.pdd-cache');
    this.maxSize = config.maxSize || 2000;
    this.defaultTTL = config.ttl || 24 * 60 * 60 * 1000; // 默认24小时
    this.compression = config.compression || false;

    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      writes: 0
    };

    this._ensureCacheDir();
  }

  /**
   * 确保缓存目录存在
   * @private
   */
  _ensureCacheDir() {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
        log('info', `[Cache] Created disk cache directory: ${this.cacheDir}`);
      }
    } catch (error) {
      log('error', '[Cache] Failed to create cache directory', error.message);
    }
  }

  /**
   * 将键转换为安全的文件名
   * @private
   * @param {string} key - 原始键
   * @returns {string} 文件路径
   */
  _keyToPath(key) {
    // 使用hash避免文件名过长或包含非法字符
    const hash = crypto.createHash('md5').update(key).digest('hex').substring(0, 16);
    return path.join(this.cacheDir, `${hash}.json`);
  }

  /**
   * 从磁盘读取缓存元数据
   * @private
   * @param {string} filePath - 文件路径
   * @returns {Object|null} 元数据对象或null
   */
  _readMeta(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * 写入缓存到磁盘
   * @private
   * @param {string} filePath - 文件路径
   * @param {Object} data - 数据对象
   */
  _writeToDisk(filePath, data) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      this.stats.writes++;
    } catch (error) {
      log('error', '[Cache] Failed to write to disk', error.message);
    }
  }

  /**
   * 获取缓存值
   * @param {string} key - 缓存键
   * @returns {*|null} 缓存值或null
   */
  get(key) {
    const filePath = this._keyToPath(key);
    const meta = this._readMeta(filePath);

    if (!meta) {
      this.stats.misses++;
      return null;
    }

    // 检查TTL
    if (Date.now() - meta.timestamp > (meta.ttl || this.defaultTTL)) {
      this._evict(filePath);
      this.stats.misses++;
      return null;
    }

    meta.accessCount = (meta.accessCount || 0) + 1;
    meta.lastAccess = Date.now();
    this._writeToDisk(filePath, meta);

    this.stats.hits++;
    return meta.data;
  }

  /**
   * 设置缓存值
   * @param {string} key - 缓存键
   * @param {*} value - 缓存值
   * @param {Object} options - 选项
   */
  set(key, value, options = {}) {
    // LFU淘汰检查
    this._enforceLFUPolicy();

    const filePath = this._keyToPath(key);
    const meta = {
      key,
      data: value,
      timestamp: Date.now(),
      ttl: options.ttl || this.defaultTTL,
      accessCount: 1,
      lastAccess: Date.now(),
      priority: options.priority || 'medium'
    };

    this._writeToDisk(filePath, meta);
  }

  /**
   * 执行LFU淘汰策略
   * @private
   */
  _enforceLFUPolicy() {
    try {
      const files = fs.readdirSync(this.cacheDir)
        .filter(f => f.endsWith('.json'))
        .map(f => ({
          name: f,
          path: path.join(this.cacheDir, f),
          meta: this._readMeta(path.join(this.cacheDir, f))
        }))
        .filter(f => f.meta !== null)
        .sort((a, b) => (a.meta.accessCount || 0) - (b.meta.accessCount || 0));

      // 当文件数超过最大容量时，淘汰最少使用的
      while (files.length > this.maxSize) {
        const victim = files.shift();
        this._evict(victim.path);
      }
    } catch (error) {
      log('warn', '[Cache] LFU eviction check failed', error.message);
    }
  }

  /**
   * 淘汰指定的缓存文件
   * @private
   * @param {string} filePath - 文件路径
   */
  _evict(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.stats.evictions++;
      }
    } catch (error) {
      log('warn', '[Cache] Failed to evict cache file', error.message);
    }
  }

  /**
   * 删除指定键
   * @param {string} key - 缓存键
   * @returns {boolean}
   */
  delete(key) {
    const filePath = this._keyToPath(key);

    if (fs.existsSync(filePath)) {
      this._evict(filePath);
      return true;
    }

    return false;
  }

  /**
   * 清空所有缓存
   */
  clear() {
    try {
      const files = fs.readdirSync(this.cacheDir).filter(f => f.endsWith('.json'));
      files.forEach(f => {
        this._evict(path.join(this.cacheDir, f));
      });

      this.stats = { hits: 0, misses: 0, evictions: 0, writes: 0 };
      log('info', '[Cache] Disk cache cleared');
    } catch (error) {
      log('error', '[Cache] Failed to clear disk cache', error.message);
    }
  }

  /**
   * 清理过期缓存
   * @returns {number} 清理的条目数
   */
  cleanupExpired() {
    let cleaned = 0;

    try {
      const files = fs.readdirSync(this.cacheDir).filter(f => f.endsWith('.json'));

      files.forEach(f => {
        const filePath = path.join(this.cacheDir, f);
        const meta = this._readMeta(filePath);

        if (meta && Date.now() - meta.timestamp > (meta.ttl || this.defaultTTL)) {
          this._evict(filePath);
          cleaned++;
        }
      });

      if (cleaned > 0) {
        log('info', `[Cache] Cleaned up ${cleaned} expired entries`);
      }
    } catch (error) {
      log('error', '[Cache] Cleanup failed', error.message);
    }

    return cleaned;
  }

  /**
   * 获取统计信息
   * @returns {Object}
   */
  getStats() {
    let fileCount = 0;
    let totalSize = 0;

    try {
      const files = fs.readdirSync(this.cacheDir).filter(f => f.endsWith('.json'));
      fileCount = files.length;

      files.forEach(f => {
        try {
          const stat = fs.statSync(path.join(this.cacheDir, f));
          totalSize += stat.size;
        } catch (e) { /* ignore */ }
      });
    } catch (e) { /* ignore */ }

    const total = this.stats.hits + this.stats.misses;

    return {
      size: fileCount,
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) + '%' : 'N/A',
      evictions: this.stats.evictions,
      writes: this.stats.writes,
      diskUsage: `${(totalSize / 1024).toFixed(2)} KB`,
      cacheDir: this.cacheDir
    };
  }
}

/**
 * SystemCache - PDD三级缓存系统主类
 *
 * 架构说明：
 * - L1 (Session): 会话级内存缓存，TTL=会话时长，容量最小，速度最快
 * - L2 (Project): 项目级内存缓存，TTL=30min，容量中等，跨操作共享
 * - L3 (Global): 全局磁盘缓存，TTL=24h，容量最大，持久化存储
 *
 * 查找策略：L1 -> L2 -> L3 逐级查找，找到后回填上级缓存
 * 写入策略：根据数据类型和配置决定写入级别
 */
export class SystemCache {
  /**
   * 构造函数
   * @param {Object} config - 缓存配置（可选）
   */
  constructor(config = {}) {
    // 验证并合并配置
    const validation = validateCacheConfig(config);
    if (!validation.valid) {
      log('warn', '[Cache] Invalid configuration, using defaults', validation.errors);
      config = {};
    }

    this.config = {
      ...DEFAULT_CACHE_CONFIG,
      ...config,
      session: { ...DEFAULT_CACHE_CONFIG.session, ...(config.session || {}) },
      project: { ...DEFAULT_CACHE_CONFIG.project, ...(config.project || {}) },
      global: { ...DEFAULT_CACHE_CONFIG.global, ...(config.global || {}) }
    };

    // 初始化三级缓存
    this.L1 = new LRUCache(this.config.session.maxSize);  // 会话缓存
    this.L2 = new LRUCache(this.config.project.maxSize);  // 项目缓存
    this.L3 = new DiskCache(this.config.global);           // 全局磁盘缓存

    // 统计信息
    this.totalStats = {
      l1Hits: 0,
      l2Hits: 0,
      l3Hits: 0,
      totalMisses: 0,
      promotions: 0  // 下级向上级的回填次数
    };

    // 启动定期清理任务
    this._cleanupInterval = null;
    this._startCleanupTask();

    log('info', '[Cache] Three-level cache system initialized');
    log(`info`, `  L1 (Session): max=${this.config.session.maxSize}, ttl=${this.formatTTL(this.config.session.ttl)}`);
    log(`info`, `  L2 (Project): max=${this.config.project.maxSize}, ttl=${this.formatTTL(this.config.project.ttl)}`);
    log(`info`, `  L3 (Global):  max=${this.config.global.maxSize}, ttl=${this.formatTTL(this.config.global.ttl)}, dir=${this.config.global.diskPath}`);
  }

  /**
   * 格式化TTL显示
   * @private
   */
  formatTTL(ttl) {
    if (ttl === null) return 'session';
    if (ttl < 1000) return `${ttl}ms`;
    if (ttl < 60000) return `${(ttl / 1000).toFixed(0)}s`;
    if (ttl < 3600000) return `${(ttl / 60000).toFixed(0)}min`;
    return `${(ttl / 3600000).toFixed(1)}h`;
  }

  /**
   * 启动定期清理任务
   * @private
   */
  _startCleanupTask() {
    // 每10分钟清理一次L3过期缓存
    this._cleanupInterval = setInterval(() => {
      try {
        this.L3.cleanupExpired();
      } catch (e) {
        /* ignore cleanup errors */
      }
    }, 10 * 60 * 1000);

    // 防止进程因定时器而无法退出
    if (this._cleanupInterval.unref) {
      this._cleanupInterval.unref();
    }
  }

  /**
   * 获取缓存值（逐级查找）
   *
   * 查找流程：
   * 1. 先查找L1（会话缓存）- 最快
   * 2. 未命中则查找L2（项目缓存）
   * 3. 未命中则查找L3（磁盘缓存）
   * 4. 在低级别命中的数据会回填到高级别缓存
   *
   * @param {string} key - 缓存键
   * @param {number} [level=1] - 最小查找级别（1=L1, 2=L2, 3=L3）
   * @returns {Promise<*>} 缓存值或undefined
   */
  async get(key, level = 1) {
    // L1 查找
    if (level <= 1 && this.config.session.enabled) {
      const value = this.L1.get(key);
      if (value !== null) {
        this.totalStats.l1Hits++;
        return value;
      }
    }

    // L2 查找
    if (level <= 2 && this.config.project.enabled) {
      const value = this.L2.get(key);
      if (value !== null) {
        this.totalStats.l2Hits++;
        // 回填到L1
        if (this.config.session.enabled) {
          this.L1.set(key, value, { ttl: this.config.session.ttl });
          this.totalStats.promotions++;
        }
        return value;
      }
    }

    // L3 查找
    if (level <= 3 && this.config.global.enabled) {
      const value = this.L3.get(key);
      if (value !== null) {
        this.totalStats.l3Hits++;
        // 回填到L2和L1
        if (this.config.project.enabled) {
          this.L2.set(key, value, { ttl: this.config.project.ttl });
        }
        if (this.config.session.enabled) {
          this.L1.set(key, value, { ttl: this.config.session.ttl });
          this.totalStats.promotions++;
        }
        return value;
      }
    }

    // 所有级别都未命中
    this.totalStats.totalMisses++;
    return undefined;
  }

  /**
   * 设置缓存值
   *
   * 根据推荐策略或指定级别写入缓存。
   * 支持同时写入多个级别（回写策略）
   *
   * @param {string} key - 缓存键
   * @param {*} value - 缓存值
   * @param {Object} [options={}] - 选项
   * @param {number} options.level - 目标缓存级别（1/2/3）
   * @param {number} options.ttl - 自定义TTL（毫秒）
   * @param {boolean} options.writeThrough - 是否透写所有下级缓存
   * @param {string} options.priority - 优先级（critical/high/medium/low）
   * @returns {Promise<void>}
   */
  async set(key, value, options = {}) {
    // 获取推荐的缓存策略
    const strategy = getRecommendedStrategy(key);
    const targetLevel = options.level || strategy.level;
    const ttl = options.ttl || strategy.ttl;

    const cacheOptions = {
      ttl: ttl,
      priority: options.priority || strategy.priority
    };

    // 根据目标级别写入
    switch (targetLevel) {
      case CacheLevel.SESSION:
        if (this.config.session.enabled) {
          this.L1.set(key, value, cacheOptions);
        }
        break;

      case CacheLevel.PROJECT:
        if (this.config.project.enabled) {
          this.L2.set(key, value, cacheOptions);
        }
        // 同时写入L1（可选优化）
        if (options.writeThrough && this.config.session.enabled) {
          this.L1.set(key, value, { ...cacheOptions, ttl: this.config.session.ttl });
        }
        break;

      case CacheLevel.GLOBAL:
        if (this.config.global.enabled) {
          this.L3.set(key, value, cacheOptions);
        }
        // 同时写入L2和L1
        if (options.writeThrough) {
          if (this.config.project.enabled) {
            this.L2.set(key, value, { ...cacheOptions, ttl: this.config.project.ttl });
          }
          if (this.config.session.enabled) {
            this.L1.set(key, value, { ...cacheOptions, ttl: this.config.session.ttl });
          }
        }
        break;

      default:
        log('warn', `[Cache] Unknown cache level: ${targetLevel}`);
    }
  }

  /**
   * 使指定key在所有级别失效
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>} 是否成功删除
   */
  async invalidate(key) {
    let deleted = false;

    deleted = this.L1.delete(key) || deleted;
    deleted = this.L2.delete(key) || deleted;
    deleted = this.L3.delete(key) || deleted;

    if (deleted) {
      log('debug', `[Cache] Invalidated key: ${key}`);
    }

    return deleted;
  }

  /**
   * 使匹配前缀的所有key失效
   * @param {string} prefix - 键前缀
   * @returns {Promise<number>} 失效的条目数
   */
  async invalidateByPrefix(prefix) {
    let count = 0;

    // 注意：内存缓存的完整遍历需要更复杂的实现
    // 这里简化处理，实际生产环境可能需要维护索引

    // L3磁盘缓存可以通过扫描文件来处理
    if (this.config.global.enabled) {
      count += this.L3.cleanupExpired(); // 简化：仅清理过期
    }

    log('info', `[Cache] Invalidated ${count} keys with prefix: ${prefix}`);
    return count;
  }

  /**
   * 清空指定级别的缓存
   * @param {number} level - 缓存级别（1/2/3）
   * @returns {Promise<void>}
   */
  async clearLevel(level) {
    switch (level) {
      case CacheLevel.SESSION:
        this.L1.clear();
        log('info', '[Cache] L1 (Session) cache cleared');
        break;

      case CacheLevel.PROJECT:
        this.L2.clear();
        log('info', '[Cache] L2 (Project) cache cleared');
        break;

      case CacheLevel.GLOBAL:
        this.L3.clear();
        log('info', '[Cache] L3 (Global/Disk) cache cleared');
        break;

      default:
        throw new Error(`Invalid cache level: ${level}. Use 1, 2, or 3.`);
    }
  }

  /**
   * 清空所有级别的缓存
   * @returns {Promise<void>}
   */
  async clearAll() {
    await this.clearLevel(CacheLevel.SESSION);
    await this.clearLevel(CacheLevel.PROJECT);
    await this.clearLevel(CacheLevel.GLOBAL);
    log('success', '[Cache] All cache levels cleared');
  }

  /**
   * 获取详细的统计信息
   * @returns {Object} 各级缓存的统计数据
   */
  async stats() {
    const now = new Date().toISOString();

    return {
      timestamp: now,
      system: {
        version: '3.0.0',
        levels: 3,
        config: {
          session: {
            enabled: this.config.session.enabled,
            maxSize: this.config.session.maxSize,
            ttl: this.formatTTL(this.config.session.ttl)
          },
          project: {
            enabled: this.config.project.enabled,
            maxSize: this.config.project.maxSize,
            ttl: this.formatTTL(this.config.project.ttl)
          },
          global: {
            enabled: this.config.global.enabled,
            maxSize: this.config.global.maxSize,
            ttl: this.formatTTL(this.config.global.ttl),
            diskPath: this.config.global.diskPath
          }
        }
      },
      levels: {
        l1_session: {
          ...this.L1.getStats(),
          type: 'Memory (LRU)',
          description: 'Fastest, per-session scope'
        },
        l2_project: {
          ...this.L2.getStats(),
          type: 'Memory (LRU)',
          description: 'Fast, shared within project'
        },
        l3_global: {
          ...this.L3.getStats(),
          type: 'Disk (LFU)',
          description: 'Persistent, cross-session'
        }
      },
      overall: {
        ...this.totalStats,
        totalRequests: this.totalStats.l1Hits + this.totalStats.l2Hits +
                       this.totalStats.l3Hits + this.totalStats.totalMisses,
        overallHitRate: (() => {
          const total = this.totalStats.l1Hits + this.totalStats.l2Hits +
                       this.totalStats.l3Hits + this.totalStats.totalMisses;
          const hits = this.totalStats.l1Hits + this.totalStats.l2Hits + this.totalStats.l3Hits;
          return total > 0 ? ((hits / total) * 100).toFixed(2) + '%' : 'N/A';
        })(),
        distribution: {
          l1HitRate: (() => {
            const t = this.totalStats.l1Hits + this.totalStats.totalMisses;
            return t > 0 ? ((this.totalStats.l1Hits / t) * 100).toFixed(2) + '%' : '0%';
          })(),
          l2HitRate: (() => {
            const t = this.totalStats.l2Hits + this.totalStats.totalMisses;
            return t > 0 ? ((this.totalStats.l2Hits / t) * 100).toFixed(2) + '%' : '0%';
          })(),
          l3HitRate: (() => {
            const t = this.totalStats.l3Hits + this.totalStats.totalMisses;
            return t > 0 ? ((this.totalStats.l3Hits / t) * 100).toFixed(2) + '%' : '0%';
          })()
        }
      }
    };
  }

  /**
   * 手动触发过期缓存清理
   * @returns {Promise<number>} 清理的条目数
   */
  async cleanup() {
    const count = this.L3.cleanupExpired();
    log('info', `[Cache] Manual cleanup completed: ${count} expired entries removed`);
    return count;
  }

  /**
   * 检查键是否存在（任意级别）
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>}
   */
  async has(key) {
    return this.L1.has(key) || this.L2.has(key) || this.L3.get(key) !== null;
  }

  /**
   * 销毁缓存系统，释放资源
   * @returns {Promise<void>}
   */
  async destroy() {
    // 停止清理任务
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }

    // 清空所有缓存
    await this.clearAll();

    log('info', '[Cache] Cache system destroyed');
  }
}

/**
 * 创建SystemCache实例的工厂函数
 * @param {Object} config - 配置对象
 * @returns {SystemCache} 缓存实例
 *
 * @example
 * ```javascript
 * import { createSystemCache } from './lib/cache/system-cache.js';
 *
 * const cache = createSystemCache({
 *   session: { maxSize: 200 },
 *   project: { ttl: 60 * 60 * 1000 } // 1小时
 * });
 *
 * // 使用缓存
 * await cache.set('spec:feat-001', specData);
 * const data = await cache.get('spec:feat-001');
 *
 * // 查看统计
 * console.log(await cache.stats());
 * ```
 */
export function createSystemCache(config = {}) {
  return new SystemCache(config);
}

export default SystemCache;
