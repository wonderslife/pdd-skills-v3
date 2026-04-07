// lib/sdk-base.js - PDD SDK Base Class
// 提供统一的SDK接口，支持Python/JavaScript等多语言扩展

import { log } from './utils/logger.js';

/**
 * PDD SDK 基础类
 * 定义了PDD核心API的统一接口，所有语言SDK都应实现这些方法
 */
export class PDDSDKBase {
  /**
   * 构造函数
   * @param {Object} config - 配置对象
   * @param {string} config.endpoint - API端点地址
   * @param {string} config.apiKey - API密钥
   * @param {number} config.timeout - 请求超时时间（毫秒）
   * @param {boolean} config.debug - 调试模式
   */
  constructor(config = {}) {
    this.endpoint = config.endpoint || 'http://localhost:3000';
    this.apiKey = config.apiKey || '';
    this.timeout = config.timeout || 30000;
    this.debug = config.debug || false;

    // 验证配置
    this._validateConfig();
  }

  /**
   * 验证配置参数
   * @private
   */
  _validateConfig() {
    if (!this.endpoint) {
      throw new Error('Endpoint is required');
    }

    try {
      new URL(this.endpoint);
    } catch (error) {
      throw new Error(`Invalid endpoint URL: ${this.endpoint}`);
    }
  }

  /**
   * 构建请求头
   * @private
   * @returns {Object} 请求头对象
   */
  _buildHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * 发送HTTP请求的通用方法（基类提供默认实现，子类可覆盖）
   * @protected
   * @param {string} method - HTTP方法
   * @param {string} path - API路径
   * @param {Object} data - 请求数据
   * @returns {Promise<Object>} 响应数据
   */
  async _request(method, path, data = null) {
    const url = `${this.endpoint}${path}`;
    const options = {
      method,
      headers: this._buildHeaders()
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    if (this.debug) {
      log('debug', `[SDK] ${method} ${url}`, data || '');
    }

    // 基类使用fetch API（Node.js 18+内置），子类可根据需要替换为其他HTTP客户端
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${errorBody}`
        );
      }

      const result = await response.json();

      if (this.debug) {
        log('debug', `[SDK] Response from ${path}`, result);
      }

      return result;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }

      log('error', `[SDK] Request failed: ${method} ${path}`, error.message);
      throw error;
    }
  }

  /**
   * 生成开发规格文档
   * POST /api/v1/spec
   *
   * @param {Object} featureMatrix - 功能点矩阵
   * @param {string} featureMatrix.id - 功能点ID
   * @param {string} featureMatrix.name - 功能点名称
   * @param {Array} featureMatrix.requirements - 需求列表
   * @param {Object} options - 可选参数
   * @param {string} options.outputPath - 输出路径
   * @param {boolean} options.includeTests - 是否包含测试用例
   * @returns {Promise<Object>} 生成的规格文档
   */
  async generateSpec(featureMatrix, options = {}) {
    if (!featureMatrix || !featureMatrix.id) {
      throw new Error('Feature matrix with id is required');
    }

    const payload = {
      ...featureMatrix,
      options: {
        includeTests: true,
        ...options
      }
    };

    return this._request('POST', '/api/v1/spec', payload);
  }

  /**
   * 生成代码
   * POST /api/v1/generate
   *
   * @param {string} specPath - 规格文档路径
   * @param {Object} options - 可选参数
   * @param {string} options.targetDir - 目标目录
   * @param {string} options.language - 编程语言
   * @returns {Promise<Object>} 生成的代码信息
   */
  async generateCode(specPath, options = {}) {
    if (!specPath) {
      throw new Error('Spec path is required');
    }

    return this._request('POST', '/api/v1/generate', {
      specPath,
      ...options
    });
  }

  /**
   * 验证功能点实现
   * POST /api/v1/verify
   *
   * @param {Object} options - 验证选项
   * @param {string} options.specPath - 规格文档路径
   * @param {Array<string>} options.dimensions - 验证维度
   * @param {string} options.targetPath - 目标代码路径
   * @returns {Promise<Object>} 验证结果报告
   */
  async verifyFeature(options = {}) {
    if (!options.specPath) {
      throw new Error('Spec path is required for verification');
    }

    return this._request('POST', '/api/v1/verify', {
      dimensions: ['completeness', 'correctness', 'consistency'],
      ...options
    });
  }

  /**
   * 代码审查
   * POST /api/v1/review
   *
   * @param {Object} options - 审查选项
   * @param {string} options.targetPath - 审查目标路径
   * @param {string} options.specPath - 规格文档路径（可选）
   * @param {Array<string>} options.rules - 审查规则列表
   * @returns {Promise<Object>} 审查报告
   */
  async codeReview(options = {}) {
    if (!options.targetPath) {
      throw new Error('Target path is required for code review');
    }

    return this._request('POST', '/api/v1/review', {
      rules: ['best-practices', 'security', 'performance'],
      ...options
    });
  }

  /**
   * 获取项目状态
   * GET /api/v1/status
   *
   * @returns {Promise<Object>} 项目状态信息
   */
  async getStatus() {
    return this._request('GET', '/api/v1/status');
  }

  /**
   * 提取功能点矩阵
   * POST /api/v1/features/extract
   *
   * @param {string} prdPath - PRD文档路径
   * @param {Object} options - 提取选项
   * @returns {Promise<Object>} 提取的功能点矩阵
   */
  async extractFeatures(prdPath, options = {}) {
    if (!prdPath) {
      throw new Error('PRD path is required for feature extraction');
    }

    return this._request('POST', '/api/v1/features/extract', {
      prdPath,
      ...options
    });
  }

  /**
   * 业务需求分析
   * POST /api/v1/analyze/business
   *
   * @param {string} prdPath - PRD文档路径
   * @param {Object} options - 分析选项
   * @param {string} options.methodology - 分析方法论（5W1H等）
   * @returns {Promise<Object>} 分析结果
   */
  async analyzeBusiness(prdPath, options = {}) {
    if (!prdPath) {
      throw new Error('PRD path is required for business analysis');
    }

    return this._request('POST', '/api/v1/analyze/business', {
      prdPath,
      methodology: '5W1H',
      ...options
    });
  }

  /**
   * 测试连接是否正常
   * GET /api/v1/health
   *
   * @returns {Promise<boolean>} 连接状态
   */
  async healthCheck() {
    try {
      const response = await this._request('GET', '/api/v1/health');
      return response.status === 'ok' || response.healthy === true;
    } catch (error) {
      log('error', '[SDK] Health check failed', error.message);
      return false;
    }
  }

  /**
   * 获取SDK版本信息
   * @returns {Object} 版本信息
   */
  getVersion() {
    return {
      name: 'pdd-sdk-base',
      version: '3.0.0',
      endpoint: this.endpoint
    };
  }
}

/**
 * 创建SDK实例的工厂函数
 * @param {Object} config - 配置对象
 * @returns {PDDSDKBase} SDK实例
 */
export function createSDK(config = {}) {
  return new PDDSDKBase(config);
}

export default PDDSDKBase;
