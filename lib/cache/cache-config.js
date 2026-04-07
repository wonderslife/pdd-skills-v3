// lib/cache/cache-config.js - PDD Cache Configuration
// 定义缓存策略、TTL、容量限制等配置

/**
 * 缓存级别枚举
 */
export const CacheLevel = {
  SESSION: 1,    // L1: 会话缓存（内存）
  PROJECT: 2,    // L2: 项目缓存（内存）
  GLOBAL: 3      // L3: 全局缓存（磁盘）
};

/**
 * 默认缓存配置
 * 定义各级缓存的默认策略
 */
export const DEFAULT_CACHE_CONFIG = {
  // L1 会话缓存配置
  session: {
    enabled: true,
    ttl: null,                    // null表示会话时长（不过期）
    maxSize: 100,                 // 最大条目数
    evictionPolicy: 'lru',        // 淘汰策略：LRU
    description: 'Session-level cache for current operation context'
  },

  // L2 项目缓存配置
  project: {
    enabled: true,
    ttl: 30 * 60 * 1000,         // 30分钟（毫秒）
    maxSize: 500,                 // 最大条目数
    evictionPolicy: 'lru',        // 淘汰策略：LRU
    description: 'Project-level cache shared within project scope'
  },

  // L3 全局缓存配置
  global: {
    enabled: true,
    ttl: 24 * 60 * 60 * 1000,    // 24小时（毫秒）
    maxSize: 2000,                // 最大条目数
    evictionPolicy: 'lfu',        // 淘汰策略：LFU（磁盘缓存适合LFU）
    persistToDisk: true,          // 是否持久化到磁盘
    diskPath: '.pdd-cache',       // 磁盘缓存目录
    compression: false,           // 是否压缩存储
    description: 'Global cache persisted to disk across sessions'
  }
};

/**
 * 缓存键前缀定义
 * 用于区分不同类型的数据
 */
export const CACHE_KEY_PREFIXES = {
  SPEC: 'spec:',              // 规格文档缓存
  FEATURE: 'feature:',        // 功能点矩阵缓存
  REVIEW: 'review:',          // 代码审查结果缓存
  STATUS: 'status:',          // 项目状态缓存
  ANALYSIS: 'analysis:',      // 业务分析结果缓存
  CODE: 'code:',              // 生成的代码缓存
  CONFIG: 'config:',          // 配置信息缓存
  TOKEN: 'token:'             // Token/认证信息缓存
};

/**
 * 特定数据类型的缓存策略覆盖
 * 允许为不同数据类型定制缓存行为
 */
export const CACHE_STRATEGIES = {
  [CACHE_KEY_PREFIXES.SPEC]: {
    level: CacheLevel.PROJECT,
    ttl: 60 * 60 * 1000,      // 1小时
    priority: 'high'
  },
  [CACHE_KEY_PREFIXES.FEATURE]: {
    level: CacheLevel.PROJECT,
    ttl: 2 * 60 * 60 * 1000,  // 2小时
    priority: 'high'
  },
  [CACHE_KEY_PREFIXES.REVIEW]: {
    level: CacheLevel.SESSION,
    ttl: 15 * 60 * 1000,      // 15分钟
    priority: 'medium'
  },
  [CACHE_KEY_PREFIXES.STATUS]: {
    level: CacheLevel.SESSION,
    ttl: 5 * 60 * 1000,       // 5分钟
    priority: 'low'
  },
  [CACHE_KEY_PREFIXES.ANALYSIS]: {
    level: CacheLevel.PROJECT,
    ttl: 4 * 60 * 60 * 1000,  // 4小时
    priority: 'medium'
  },
  [CACHE_KEY_PREFIXES.CODE]: {
    level: CacheLevel.SESSION,
    ttl: 30 * 60 * 1000,      // 30分钟
    priority: 'high'
  },
  [CACHE_KEY_PREFIXES.CONFIG]: {
    level: CacheLevel.GLOBAL,
    ttl: 24 * 60 * 60 * 1000, // 24小时
    priority: 'low'
  },
  [CACHE_KEY_PREFIXES.TOKEN]: {
    level: CacheLevel.SESSION,
    ttl: null,                 // 不过期（由Token本身控制）
    priority: 'critical'
  }
};

/**
 * 缓存统计指标定义
 */
export const CACHE_METRICS = {
  HITS: 'hits',
  MISSES: 'misses',
  EVICTIONS: 'evictions',
  SIZE: 'size',
  MEMORY_USAGE: 'memoryUsage',
  DISK_USAGE: 'diskUsage'
};

/**
 * 创建自定义缓存配置
 * @param {Object} overrides - 配置覆盖项
 * @returns {Object} 合并后的配置
 */
export function createCacheConfig(overrides = {}) {
  return {
    ...DEFAULT_CACHE_CONFIG,
    ...overrides,
    session: { ...DEFAULT_CACHE_CONFIG.session, ...(overrides.session || {}) },
    project: { ...DEFAULT_CACHE_CONFIG.project, ...(overrides.project || {}) },
    global: { ...DEFAULT_CACHE_CONFIG.global, ...(overrides.global || {}) }
  };
}

/**
 * 根据键名获取推荐的缓存策略
 * @param {string} key - 缓存键
 * @returns {Object} 推荐的缓存策略
 */
export function getRecommendedStrategy(key) {
  for (const [prefix, strategy] of Object.entries(CACHE_STRATEGIES)) {
    if (key.startsWith(prefix)) {
      return strategy;
    }
  }

  // 默认策略：使用L2项目缓存
  return {
    level: CacheLevel.PROJECT,
    ttl: DEFAULT_CACHE_CONFIG.project.ttl,
    priority: 'medium'
  };
}

/**
 * 验证缓存配置的有效性
 * @param {Object} config - 缓存配置
 * @returns {Object} 验证结果 { valid: boolean, errors: string[] }
 */
export function validateCacheConfig(config) {
  const errors = [];

  if (!config) {
    errors.push('Config object is required');
    return { valid: false, errors };
  }

  // 验证各级别的配置
  ['session', 'project', 'global'].forEach(level => {
    if (config[level]) {
      const levelConfig = config[level];

      if (levelConfig.ttl !== null && typeof levelConfig.ttl !== 'number') {
        errors.push(`${level}.ttl must be a number or null`);
      }

      if (levelConfig.ttl !== null && levelConfig.ttl <= 0) {
        errors.push(`${level}.ttl must be positive or null`);
      }

      if (typeof levelConfig.maxSize !== 'number' || levelConfig.maxSize <= 0) {
        errors.push(`${level}.maxSize must be a positive number`);
      }

      if (!['lru', 'lfu', 'fifo'].includes(levelConfig.evictionPolicy)) {
        errors.push(`${level}.evictionPolicy must be one of: lru, lfu, fifo`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  CacheLevel,
  DEFAULT_CACHE_CONFIG,
  CACHE_KEY_PREFIXES,
  CACHE_STRATEGIES,
  CACHE_METRICS,
  createCacheConfig,
  getRecommendedStrategy,
  validateCacheConfig
};
