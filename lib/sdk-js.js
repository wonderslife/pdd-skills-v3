// lib/sdk-js.js - JavaScript SDK
// 继承SDK基类，提供JavaScript/TypeScript友好的API和增强功能

import { PDDSDKBase } from './sdk-base.js';
import { log } from './utils/logger.js';

/**
 * PDD JavaScript SDK
 * 提供Promise-based API、事件系统、自动重试等增强功能
 */
export class PDDJS extends PDDSDKBase {
  /**
   * 构造函数
   * @param {Object} config - 配置对象
   * @param {string} config.endpoint - API端点
   * @param {string} config.apiKey - API密钥
   * @param {number} config.maxRetries - 最大重试次数（默认3）
   * @param {number} config.retryDelay - 重试延迟毫秒数（默认1000）
   * @param {boolean} config.enableCache - 是否启用缓存（默认true）
   */
  constructor(config = {}) {
    super(config);

    // JS SDK特有配置
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.enableCache = config.enableCache !== false;

    // 事件监听器
    this._eventListeners = new Map();

    // 简单的内存缓存（生产环境应使用更完善的缓存方案）
    this._cache = new Map();
    this._cacheTTL = config.cacheTTL || 300000; // 默认5分钟

    log('info', 'PDD JavaScript SDK initialized');
  }

  /**
   * 发送带重试机制的请求
   * @override
   */
  async _request(method, path, data = null) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // 触发请求前事件
        this._emit('request', { method, path, attempt });

        const result = await super._request(method, path, data);

        // 触发成功事件
        this._emit('success', { method, path, result });

        return result;
      } catch (error) {
        lastError = error;

        // 触发错误事件
        this._emit('error', { method, path, error, attempt });

        // 如果是最后一次尝试或错误不可重试，直接抛出
        if (attempt === this.maxRetries || !this._isRetryable(error)) {
          throw error;
        }

        // 指数退避等待
        const delay = this.retryDelay * Math.pow(2, attempt);
        log('warn', `[SDK] Retry ${attempt + 1}/${this.maxRetries} after ${delay}ms`);
        await this._sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * 判断错误是否可重试
   * @private
   */
  _isRetryable(error) {
    // 网络错误、超时、5xx服务器错误可重试
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /ECONNREFUSED/,
      /ECONNRESET/,
      /5\d{2}/
    ];

    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * 延迟函数
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 带缓存的规格生成
   * @param {Object} featureMatrix - 功能点矩阵
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 规格文档
   */
  async generateSpecCached(featureMatrix, options = {}) {
    const cacheKey = `spec:${featureMatrix.id}:${JSON.stringify(options)}`;

    if (this.enableCache) {
      const cached = this._getFromCache(cacheKey);
      if (cached) {
        log('debug', `[SDK] Cache hit for spec: ${featureMatrix.id}`);
        return cached;
      }
    }

    const result = await this.generateSpec(featureMatrix, options);

    if (this.enableCache) {
      this._setCache(cacheKey, result);
    }

    return result;
  }

  /**
   * 批量生成规格文档
   * @param {Array<Object>} featureMatrices - 功能点矩阵数组
   * @param {Object} options - 选项
   * @returns {Promise<Array<Object>} 规格文档数组
   */
  async batchGenerateSpecs(featureMatrices, options = {}) {
    if (!Array.isArray(featureMatrices)) {
      throw new Error('featureMatrices must be an array');
    }

    log('info', `[SDK] Batch generating specs for ${featureMatrices.length} features`);

    // 并发控制：最多同时处理5个
    const concurrencyLimit = options.concurrency || 5;
    const results = [];

    for (let i = 0; i < featureMatrices.length; i += concurrencyLimit) {
      const batch = featureMatrices.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.allSettled(
        batch.map(fm => this.generateSpec(fm, options))
      );

      results.push(...batchResults.map((result, index) => ({
        featureId: batch[index].id,
        status: result.status,
        value: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null
      })));
    }

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    log('success', `[SDK] Batch complete: ${successCount}/${results.length} successful`);

    return results;
  }

  /**
   * 流式代码生成（模拟，实际需要SSE/WebSocket支持）
   * @param {string} specPath - 规格路径
   * @param {Function} onChunk - 数据块回调
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 最终结果
   */
  async generateCodeStream(specPath, onChunk, options = {}) {
    if (!specPath || typeof onChunk !== 'function') {
      throw new Error('specPath and onChunk callback are required');
    }

    log('info', `[SDK] Starting stream code generation for: ${specPath}`);

    try {
      // 模拟流式输出（实际实现需要后端支持SSE）
      onChunk({ type: 'start', message: 'Starting code generation...' });

      const result = await this.generateCode(specPath, options);

      onChunk({ type: 'progress', data: result, percent: 100 });
      onChunk({ type: 'complete', data: result });

      return result;
    } catch (error) {
      onChunk({ type: 'error', error: error.message });
      throw error;
    }
  }

  /**
   * 链式调用API
   * 提供流畅的链式接口用于常见工作流
   * @returns {PDDChain} 链式调用对象
   */
  chain() {
    return new PDDChain(this);
  }

  /**
   * 注册事件监听器
   * @param {string} event - 事件名称
   * @param {Function} listener - 监听函数
   * @returns {PDDJS} this（支持链式调用）
   */
  on(event, listener) {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, []);
    }
    this._eventListeners.get(event).push(listener);
    return this;
  }

  /**
   * 移除事件监听器
   * @param {string} event - 事件名称
   * @param {Function} listener - 监听函数
   * @returns {PDDJS} this
   */
  off(event, listener) {
    const listeners = this._eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }

  /**
   * 触发事件
   * @private
   */
  _emit(event, data) {
    const listeners = this._eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          log('error', `[SDK] Event listener error for "${event}"`, error.message);
        }
      });
    }
  }

  /**
   * 从缓存获取数据
   * @private
   */
  _getFromCache(key) {
    const item = this._cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > this._cacheTTL) {
      this._cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * 设置缓存数据
   * @private
   */
  _setCache(key, value) {
    this._cache.set(key, {
      data: value,
      timestamp: Date.now()
    });

    // 限制缓存大小（最多100条）
    if (this._cache.size > 100) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this._cache.clear();
    log('info', '[SDK] Cache cleared');
  }

  /**
   * 获取SDK信息
   * @override
   */
  getVersion() {
    return {
      ...super.getVersion(),
      name: 'pdd-sdk-js',
      version: '3.0.0',
      features: [
        'auto-retry',
        'event-system',
        'caching',
        'batch-operations',
        'streaming'
      ]
    };
  }
}

/**
 * 链式调用辅助类
 * 提供流畅的API用于PDD工作流
 */
class PDDChain {
  /**
   * @param {PDDJS} sdk - SDK实例
   */
  constructor(sdk) {
    this.sdk = sdk;
    this._context = {};
  }

  /**
   * 设置PRD路径
   * @param {string} prdPath - PRD文档路径
   * @returns {PDDChain} this
   */
  fromPRD(prdPath) {
    this._context.prdPath = prdPath;
    return this;
  }

  /**
   * 提取功能点
   * @returns {Promise<PDDChain>} this
   */
  async extractFeatures() {
    if (!this._context.prdPath) {
      throw new Error('PRD path not set. Use fromPRD() first.');
    }

    this._context.features = await this.sdk.extractFeatures(this._context.prdPath);
    return this;
  }

  /**
   * 生成规格文档
   * @param {string} featureId - 功能点ID（可选，不传则生成所有）
   * @returns {Promise<PDDChain>} this
   */
  async generateSpecs(featureId) {
    if (!this._context.features) {
      throw new Error('Features not extracted. Call extractFeatures() first.');
    }

    const targetFeature = featureId
      ? this._context.features.find(f => f.id === featureId)
      : this._context.features[0];

    if (!targetFeature) {
      throw new Error(`Feature not found: ${featureId}`);
    }

    this._context.spec = await this.sdk.generateSpec(targetFeature);
    return this;
  }

  /**
   * 实现代码
   * @param {string} targetDir - 目标目录
   * @returns {Promise<PDDChain>} this
   */
  async implement(targetDir) {
    if (!this._context.spec || !this._context.spec.path) {
      throw new Error('Spec not generated. Call generateSpecs() first.');
    }

    this._context.implementation = await this.sdk.generateCode(
      this._context.spec.path,
      { targetDir }
    );
    return this;
  }

  /**
   * 验证实现
   * @returns {Promise<Object>} 验证结果
   */
  async verify() {
    if (!this._context.spec || !this._context.implementation) {
      throw new Error('Implementation not complete. Call implement() first.');
    }

    return this.sdk.verifyFeature({
      specPath: this._context.spec.path,
      targetPath: this._context.implementation.path
    });
  }

  /**
   * 获取完整上下文
   * @returns {Object} 工作流上下文
   */
  getContext() {
    return { ...this._context };
  }
}

/**
 * 创建JavaScript SDK实例的便捷函数
 * @param {Object} config - 配置对象
 * @returns {PDDJS} SDK实例
 *
 * @example
 * ```javascript
 * import { createPDDJS } from './lib/sdk-js.js';
 *
 * const pdd = createPDDJS({
 *   endpoint: 'http://localhost:3000',
 *   apiKey: 'your-api-key'
 * });
 *
 * // 使用事件监听
 * pdd.on('error', (data) => console.error('Request failed:', data));
 *
 * // 带重试的API调用
 * const spec = await pdd.generateSpec(featureMatrix);
 *
 * // 链式调用
 * const result = await pdd.chain()
 *   .fromPRD('./docs/prd.md')
 *   .extractFeatures()
 *   .generateSpecs('feat-001')
 *   .implement('./src')
 *   .verify();
 * ```
 */
export function createPDDJS(config = {}) {
  return new PDDJS(config);
}

export default PDDJS;
