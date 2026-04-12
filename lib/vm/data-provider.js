/**
 * PDD Visual Manager - 数据提供者聚合层 (VM-A020 + VM-A021 + VM-A023)
 *
 * 作为 PDD-VM 系统的核心数据聚合器，统一管理：
 * - 状态存储 (StateStore) - 项目状态文件读写
 * - 项目扫描 (ProjectScanner) - 文件系统扫描
 * - 数据对齐 (Reconciler) - state 与 scanner 的三路合并
 * - 事件总线 (VMEventBus) - 事件发布与订阅
 * - 引擎桥接 - 缓存、Token预算、质量评分、迭代控制等外部引擎
 *
 * 提供统一的查询 API：
 * - 功能点 CRUD 和筛选排序
 * - 质量矩阵分析
 * - Token 使用统计
 * - 迭代进度跟踪
 * - 多格式导出（JSON/Markdown/CSV）
 *
 * @module vm/data-provider
 */

import {
  StageEnum,
  STAGE_VALUES,
  STAGE_ORDER,
  Feature,
  ProjectSummary,
  QualityMetrics,
  TokenUsage
} from './models.js';

import StateStore from './state-store.js';
import ProjectScanner from './scanner.js';
import Reconciler from './reconciler.js';
import { createEventBus, VMEvents } from './event-bus.js';

// 可选的 chalk 彩色输出支持
let chalk;
try {
  const chalkModule = await import('chalk');
  chalk = chalkModule.default;
} catch {
  chalk = {
    cyan: (s) => s,
    green: (s) => s,
    yellow: (s) => s,
    red: (s) => s,
    blue: (s) => s,
    gray: (s) => s,
    bold: (s) => s,
    magenta: (s) => s
  };
}

/**
 * PDD 数据提供者类
 * 系统的核心数据聚合层，协调所有子模块的工作
 */
class PDDDataProvider {
  /**
   * 创建数据提供者实例
   *
   * @param {string} projectRoot - 项目根目录路径
   * @param {Object} [options={}] - 配置选项
   * @param {boolean} [options.autoRefresh=false] - 是否自动定期刷新
   * @param {number} [options.refreshInterval=60000] - 自动刷新间隔（毫秒）
   * @param {boolean} [options.enableEngineBridges=true] - 是否启用引擎桥接
   */
  constructor(projectRoot, options = {}) {
    if (!projectRoot || typeof projectRoot !== 'string') {
      throw new Error('PDDDataProvider: projectRoot 必须是非空字符串');
    }

    /** @type {string} 项目根目录绝对路径 */
    this.projectRoot = projectRoot;

    /** @type {Object} 配置选项 */
    this.options = {
      autoRefresh: false,
      refreshInterval: 60000,
      enableEngineBridges: true,
      ...options
    };

    /** @type {StateStore|null} 状态存储器实例 */
    this.stateStore = null;

    /** @type {ProjectScanner|null} 项目扫描器实例 */
    this.scanner = null;

    /** @type {Reconciler|null} 数据对齐器实例 */
    this.reconciler = null;

    /** @type {VMEventBus} 事件总线实例 */
    this.eventBus = createEventBus();

    /**
     * 引擎桥接对象
     * 用于连接外部引擎（缓存、Token预算、质量评分、迭代控制）
     * @type {Object<string, Object|null>}
     */
    this.engineBridges = {
      cache: null,       // SystemCache 实例
      budget: null,      // BudgetManager 实例
      scorer: null,      // Scorer 实例
      iteration: null    // IterationController 实例
    };

    /** @type {boolean} 是否已完成初始化 */
    this.initialized = false;

    /** @type {Date|null} 最后刷新时间 */
    this.lastRefreshTime = null;

    /**
     * 功能点内存缓存
     * @type {Map<string, Feature>} ID -> Feature 对象的映射
     * @private
     */
    this._features = new Map();

    /** @type {ProjectSummary|null} 项目汇总信息 */
    this._summary = null;

    /** @type {number|null} 自动刷新定时器 ID */
    this._refreshTimer = null;

    console.log(chalk.gray(`[DataProvider] 初始化数据提供者: ${projectRoot}`));
  }

  // ==================== 初始化方法 ====================

  /**
   * 初始化数据提供者
   * 按顺序执行：创建子模块 -> 加载引擎 -> 扫描项目 -> 对齐数据 -> 构建缓存
   *
   * @returns {Promise<void>}
   * @throws {Error} 当初始化步骤失败时抛出异常
   *
   * @example
   * const provider = new PDDDataProvider('./my-project');
   * await provider.init();
   * console.log(provider.getSummary());
   */
  async init() {
    if (this.initialized) {
      console.log(chalk.yellow('[DataProvider] 已经初始化过，跳过重复初始化'));
      return;
    }

    const startTime = Date.now();

    console.log(chalk.blue('\n[DataProvider] 开始初始化...\n'));

    try {
      // 1. 创建状态存储器
      console.log(chalk.gray('[DataProvider] 步骤1/8: 创建状态存储器...'));
      this.stateStore = new StateStore(this.projectRoot, this.options.stateStoreOptions || {});

      // 2. 创建项目扫描器
      console.log(chalk.gray('[DataProvider] 步骤2/8: 创建项目扫描器...'));
      this.scanner = new ProjectScanner(this.projectRoot, this.options.scannerConfig || {});

      // 3. 创建数据对齐器
      console.log(chalk.gray('[DataProvider] 步骤3/8: 创建数据对齐器...'));
      this.reconciler = new Reconciler(this.stateStore, this.scanner, this.options.reconcilerOptions || {});

      // 4. 尝试加载引擎桥接
      if (this.options.enableEngineBridges !== false) {
        console.log(chalk.gray('[DataProvider] 步骤4/8: 加载引擎桥接...'));
        await this._bridgeEngineCaches();
      }

      // 5. 执行全量扫描
      console.log(chalk.gray('[DataProvider] 步骤5/8: 执行全量项目扫描...'));
      const scanResult = await this.scanner.fullScan();

      // 6. 执行数据对齐
      console.log(chalk.gray('[DataProvider] 步骤6/8: 执行数据对齐...'));
      const reconcileResult = await this.reconciler.reconcile();

      // 7. 加载状态并构建功能点映射
      console.log(chalk.gray('[DataProvider] 步骤7/8: 加载状态到内存...'));
      const state = await this.stateStore.loadState();

      // 将 features 存入 _features Map
      this._features.clear();
      const stateFeatures = state.project.features || [];
      for (const featData of stateFeatures) {
        try {
          const feature = Feature.fromJSON(featData);
          this._features.set(feature.id, feature);
        } catch (error) {
          console.warn(chalk.yellow(`[DataProvider] 解析功能点失败: ${featData.id} - ${error.message}`));
        }
      }

      // 8. 构建项目摘要
      console.log(chalk.gray('[DataProvider] 步骤8/8: 构建项目摘要...'));
      this._summary = this._buildSummary();

      // 标记初始化完成
      this.initialized = true;
      this.lastRefreshTime = new Date();

      const duration = Date.now() - startTime;

      // 发射系统事件
      this.eventBus.emitSystemEvent('dataProvider', 'online', `初始化完成，耗时 ${duration}ms`);
      this.eventBus.emitDataRefreshed(this._summary);

      console.log(chalk.green(`\n[DataProvider] 初始化完成！`));
      console.log(chalk.gray(`  - 功能点数量: ${this._features.size}`));
      console.log(chalk.gray(`  - 扫描耗时: ${scanResult.duration}ms`));
      console.log(chalk.gray(`  - 对齐耗时: ${reconcileResult.duration}ms`));
      console.log(chalk.gray(`  - 总耗时: ${duration}ms\n`));

      // 启动自动刷新（如果配置了）
      if (this.options.autoRefresh) {
        this._startAutoRefresh();
      }

    } catch (error) {
      console.error(chalk.red(`[DataProvider] 初始化失败: ${error.message}`));
      this.eventBus.emitSystemEvent('dataProvider', 'error', error.message);
      throw error;
    }
  }

  /**
   * 刷新数据
   * 重新执行完整的初始化流程，并检测变更
   *
   * @returns {Promise<{added:number, removed:number, changed:number}>}
   *   变更统计信息
   */
  async refresh() {
    if (!this.initialized) {
      await this.init();
      return { added: 0, removed: 0, changed: 0 };
    }

    console.log(chalk.blue('\n[DataProvider] 开始数据刷新...\n'));

    // 保存旧的功能点快照用于变更检测
    const oldFeatures = new Map(this._features);

    // 重新初始化
    await this.init();

    // 检测变更
    const changes = this._detectChanges(oldFeatures, this._features);

    console.log(chalk.green(
      `[DataProvider] 刷新完成: +${changes.added} /-${changes.removed} ~${changes.changed}\n`
    ));

    return changes;
  }

  /**
   * 启动自动刷新定时器
   * @private
   */
  _startAutoRefresh() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
    }

    this._refreshTimer = setInterval(async () => {
      try {
        console.log(chalk.gray('[DataProvider] 自动刷新触发...'));
        await this.refresh();
      } catch (error) {
        console.error(chalk.red(`[DataProvider] 自动刷新失败: ${error.message}`));
      }
    }, this.options.refreshInterval);

    console.log(chalk.gray(
      `[DataProvider] 已启动自动刷新，间隔: ${this.options.refreshInterval / 1000}s`
    ));
  }

  /**
   * 停止自动刷新定时器
   */
  stopAutoRefresh() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
      console.log(chalk.gray('[DataProvider] 已停止自动刷新'));
    }
  }

  // ==================== 查询 API ====================

  /**
   * 获取所有功能点
   * @returns {Feature[]} 功能点数组
   */
  getFeatures() {
    this._checkInitialized();
    return Array.from(this._features.values());
  }

  /**
   * 根据 ID 获取功能点
   * @param {string} id - 功能点 ID
   * @returns {Feature|null} 功能点对象或 null
   */
  getFeatureById(id) {
    this._checkInitialized();
    return this._features.get(id) || null;
  }

  /**
   * 根据阶段获取功能点列表
   * @param {string} stage - 阶段值 (StageEnum)
   * @returns {Feature[]} 符合条件的功能点数组
   */
  getFeaturesByStage(stage) {
    this._checkInitialized();
    return this.getFeatures().filter(f => f.stage === stage);
  }

  /**
   * 获取项目汇总信息
   * @returns {ProjectSummary|null} 项目汇总对象
   */
  getSummary() {
    this._checkInitialized();
    return this._summary;
  }

  /**
   * 搜索功能点（模糊匹配）
   * 在名称、描述、标签中进行模糊搜索
   *
   * @param {string} query - 搜索关键词
   * @returns {Feature[]} 匹配的功能点数组
   *
   * @example
   * provider.search('auth')  // 搜索名称/描述/标签中包含 "auth" 的功能点
   */
  search(query) {
    this._checkInitialized();

    if (!query || typeof query !== 'string') {
      return [];
    }

    const q = query.toLowerCase().trim();

    return this.getFeatures().filter(f =>
      f.name.toLowerCase().includes(q) ||
      (f.description || '').toLowerCase().includes(q) ||
      (f.tags || []).some(t => t.toLowerCase().includes(q)) ||
      f.id.toLowerCase().includes(q)
    );
  }

  /**
   * 高级筛选功能点
   * 支持按阶段、质量分数、问题等条件组合筛选
   *
   * @param {Object} criteria - 筛选条件
   * @param {string} [criteria.stage] - 阶段过滤
   * @param {number} [criteria.minScore] - 最小质量分数
   * @param {number} [criteria.maxScore] - 最大质量分数
   * @param {boolean} [criteria.hasIssues] - 是否有问题（true=仅返回有问题的，false=仅返回无问题的）
   * @param {string} [criteria.priority] - 优先级过滤 (P0/P1/P2/P3)
   * @param {string} [criteria.tag] - 标签过滤
   * @returns {Feature[]} 筛选后的功能点数组
   *
   * @example
   * // 获取实现阶段且质量分 >= 70 且有问题的功能点
   * provider.filter({ stage: 'implementing', minScore: 70, hasIssues: true })
   */
  filter(criteria = {}) {
    this._checkInitialized();

    let results = this.getFeatures();

    // 阶段过滤
    if (criteria.stage && STAGE_VALUES.includes(criteria.stage)) {
      results = results.filter(f => f.stage === criteria.stage);
    }

    // 最小质量分数
    if (criteria.minScore !== undefined && criteria.minScore != null) {
      results = results.filter(f => (f.quality?.score ?? 0) >= criteria.minScore);
    }

    // 最大质量分数
    if (criteria.maxScore !== undefined && criteria.maxScore != null) {
      results = results.filter(f => (f.quality?.score ?? 0) <= criteria.maxScore);
    }

    // 问题过滤
    if (criteria.hasIssues === true) {
      results = results.filter(f => f.quality?.issues?.length > 0);
    } else if (criteria.hasIssues === false) {
      results = results.filter(f => !f.quality?.issues || f.quality.issues.length === 0);
    }

    // 优先级过滤
    if (criteria.priority) {
      results = results.filter(f => f.priority === criteria.priority);
    }

    // 标签过滤
    if (criteria.tag) {
      results = results.filter(f =>
        f.tags && Array.isArray(f.tags) && f.tags.includes(criteria.tag)
      );
    }

    return results;
  }

  /**
   * 对功能点列表进行排序
   *
   * @param {Feature[]} features - 要排序的功能点数组（可选，默认使用全部）
   * @param {string} [by='name'] - 排序字段 ('stage'|'score'|'name'|'tokens'|'date')
   * @param {string} [order='asc'] - 排序方向 ('asc'|'desc')
   * @returns {Feature[]} 排序后的新数组（不修改原数组）
   *
   * @example
   * provider.sort(provider.getFeaturesByStage('implementing'), 'score', 'desc')
   */
  sort(features, by = 'name', order = 'asc') {
    const targetArray = features || this.getFeatures();
    const sorted = [...targetArray];

    // 排序比较器映射
    const comparators = {
      stage: (a, b) => (STAGE_ORDER[a.stage] ?? 99) - (STAGE_ORDER[b.stage] ?? 99),
      score: (a, b) => (a.quality?.score ?? 0) - (b.quality?.score ?? 0),
      name: (a, b) => a.name.localeCompare(b.name),
      tokens: (a, b) => (a.tokens?.used ?? 0) - (b.tokens?.used ?? 0),
      date: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
      priority: (a, b) => {
        const orderMap = { P0: 0, P1: 1, P2: 2, P3: 3 };
        return (orderMap[a.priority] ?? 99) - (orderMap[b.priority] ?? 99);
      },
      iterations: (a, b) => (a.iterations?.length ?? 0) - (b.iterations?.length ?? 0)
    };

    const comparatorFn = comparators[by] || comparators.name;

    sorted.sort(order === 'desc' ? (a, b) => comparatorFn(b, a) : comparatorFn);

    return sorted;
  }

  // ==================== 质量分析 API ====================

  /**
   * 获取质量矩阵
   * 统计所有功能点的质量指标分布情况
   *
   * @returns {{
   *   avgScore: number,
   *   avgCoverage: number,
   *   avgPassRate: number,
   *   gradeDistribution: Object<string, number>,
   *   topIssues: Array<{type:string, count:number, features:string[]}>
   * }} 质量矩阵数据
   */
  getQualityMatrix() {
    this._checkInitialized();

    const features = this.getFeatures();
    const withQuality = features.filter(f => f.quality);

    // 等级分布统计
    const gradeDist = { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 };

    let totalScore = 0;
    let totalCoverage = 0;
    let totalPassRate = 0;

    // 问题类型聚合
    const issueMap = new Map(); // type -> { count, features[] }

    withQuality.forEach(f => {
      // 统计等级分布
      const g = f.quality.grade || 'F';
      gradeDist[g] = (gradeDist[g] || 0) + 1;

      // 累加各项指标
      totalScore += f.quality.score || 0;
      totalCoverage += f.quality.coverage || 0;
      totalPassRate += f.quality.passRate || 0;

      // 聚合问题类型
      (f.quality.issues || []).forEach(issue => {
        const key = issue.type || issue.name || 'unknown';

        if (!issueMap.has(key)) {
          issueMap.set(key, { count: 0, features: [] });
        }

        const entry = issueMap.get(key);
        entry.count++;

        // 记录关联的功能点名称（去重）
        if (!entry.features.includes(f.name)) {
          entry.features.push(f.name);
        }
      });
    });

    const n = withQuality.length || 1;

    // 取前10个最常见的问题
    const topIssues = Array.from(issueMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([type, data]) => ({
        type,
        count: data.count,
        features: data.features
      }));

    return {
      avgScore: Math.round(totalScore / n * 10) / 10,
      avgCoverage: Math.round(totalCoverage / n * 10) / 10,
      avgPassRate: Math.round(totalPassRate / n * 10) / 10,
      gradeDistribution: gradeDist,
      topIssues,
      evaluatedCount: withQuality.length,
      totalCount: features.length
    };
  }

  // ==================== Token 统计 API ====================

  /**
   * 获取 Token 使用统计
   * 汇总所有功能点的 Token 消耗情况
   *
   * @returns {{
   *   total: number,
   *   used: number,
   *   remaining: number,
   *   percent: number,
   *   byStage: Object<string, number>,
   *   trend: Array<Object>
   * }} Token 统计信息
   */
  getTokenStats() {
    this._checkInitialized();

    const features = this.getFeatures();

    let totalUsed = 0;
    let totalBudget = 0;

    // 按阶段统计
    const byStage = {};
    STAGE_VALUES.forEach(s => { byStage[s] = 0; });

    // 历史趋势数据
    const history = [];

    features.forEach(f => {
      if (f.tokens) {
        totalUsed += f.tokens.used || 0;
        totalBudget += f.tokens.total || 0;

        // 按阶段累加
        if (f.tokens.byStage) {
          Object.entries(f.tokens.byStage).forEach(([stage, amount]) => {
            byStage[stage] = (byStage[stage] || 0) + amount;
          });
        }

        // 收集历史记录
        if (f.tokens.history && Array.isArray(f.tokens.history)) {
          history.push(...f.tokens.history);
        }
      }
    });

    // 排序历史记录（取最近20条）
    const trend = history
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      .slice(-20);

    const percent = totalBudget > 0 ? Math.round(totalUsed / totalBudget * 100) : 0;

    // 检查是否需要发射阈值告警
    if (percent >= 90 || percent >= 70) {
      this.eventBus.emitTokenThreshold(totalUsed, totalBudget, percent);
    }

    return {
      total: totalBudget,
      used: totalUsed,
      remaining: Math.max(0, totalBudget - totalUsed),
      percent,
      byStage,
      trend
    };
  }

  // ==================== 迭代跟踪 API ====================

  /**
   * 获取迭代列表
   * 返回所有有迭代记录的功能点的迭代概览
   *
   * @returns {Array<{
   *   featureId: string,
   *   featureName: string,
   *   rounds: number,
   *   converged: boolean,
   *   lastScore: number
   * }>} 迭代概览列表
   */
  getIterationList() {
    this._checkInitialized();

    return this.getFeatures()
      .filter(f => f.iterations && f.iterations.length > 0)
      .map(f => {
        const sortedIters = [...f.iterations].sort((a, b) => b.round - a.round);
        const lastRound = sortedIters[0];

        return {
          featureId: f.id,
          featureName: f.name,
          rounds: f.iterations.length,
          converged: f.isConverged ? f.isConverged() : f.iterations.length >= 3,
          lastScore: lastRound ? lastRound.score : 0
        };
      });
  }

  /**
   * 获取指定功能点的迭代历史
   * @param {string} featureId - 功能点 ID
   * @returns {import('./models.js').IterationRound[]} 迭代轮次数组
   */
  getFeatureIterations(featureId) {
    this._checkInitialized();

    const f = this.getFeatureById(featureId);
    if (!f) {
      return [];
    }

    return (f.iterations || []).sort((a, b) => a.round - b.round);
  }

  // ==================== 引擎桥接 API (VM-A021) ====================

  /**
   * 获取缓存统计信息
   * 从 SystemCache 引擎获取缓存命中率等统计数据
   *
   * @returns {Object|null} 缓存统计信息，如果缓存引擎未加载则返回 null
   */
  getCacheStats() {
    if (!this.engineBridges.cache) {
      return null;
    }

    try {
      return this.engineBridges.cache.getStats();
    } catch (error) {
      console.warn(chalk.yellow(`[DataProvider] 获取缓存统计失败: ${error.message}`));
      return null;
    }
  }

  /**
   * 获取系统健康状态
   * 检查各子系统（API、MCP、gRPC 等）的运行状态
   *
   * @returns {{
   *   api: { status: string, latency: number },
   *   mcp: { status: string, latency: number },
   *   grpc: { status: string, latency: number },
   *   openclaw: { status: string, latency: number },
   *   plugins: Array<Object>,
   *   uptime: number,
   *   memory: NodeJS.MemoryUsage
   * }} 系统健康状态
   */
  getSystemHealth() {
    // 尝试从各引擎获取真实状态
    const health = {
      api: { status: 'unknown', latency: 0 },
      mcp: { status: 'unknown', latency: 0 },
      grpc: { status: 'unknown', latency: 0 },
      openclaw: { status: 'unknown', latency: 0 },
      plugins: [],
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };

    // 如果有缓存引擎，尝试获取其健康状态
    if (this.engineBridges.cache && typeof this.engineBridges.cache.healthCheck === 'function') {
      try {
        const cacheHealth = this.engineBridges.cache.healthCheck();
        if (cacheHealth) {
          health.plugins.push({
            name: 'cache',
            status: cacheHealth.status || 'ok',
            details: cacheHealth
          });
        }
      } catch (e) {
        // 忽略错误
      }
    }

    // 如果有预算引擎，尝试获取其状态
    if (this.engineBridges.budget && typeof this.engineBridges.budget.getStatus === 'function') {
      try {
        const budgetStatus = this.engineBridges.budget.getStatus();
        health.plugins.push({
          name: 'budget',
          status: 'ok',
          details: budgetStatus
        });
      } catch (e) {
        // 忽略错误
      }
    }

    return health;
  }

  // ==================== 导出 API (VM-A023) ====================

  /**
   * 导出为 JSON 格式
   *
   * @param {Object} [options={}] - 导出选项
   * @param {string} [options.mode='full'] - 导出模式 ('full'|'summary')
   * @param {string[]} [options.fields] - 仅导出指定字段（mode='full' 时有效）
   * @returns {string} JSON 字符串
   *
   * @example
   * // 导出完整数据
   * provider.exportJSON()
   *
   * // 仅导出摘要
   * provider.exportJSON({ mode: 'summary' })
   *
   * // 只导出特定字段
   * provider.exportJSON({ fields: ['id', 'name', 'stage', 'quality'] })
   */
  exportJSON(options = {}) {
    this._checkInitialized();

    const mode = options.mode || 'full';

    if (mode === 'summary') {
      return JSON.stringify({
        summary: this._summary ? this._summary.toJSON() : null,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      }, null, 2);
    }

    // 完整模式
    let features;

    if (options.fields && Array.isArray(options.fields) && options.fields.length > 0) {
      // 仅导出指定字段
      features = this.getFeatures().map(f => {
        const obj = {};
        options.fields.forEach(key => {
          if (f[key] != null) {
            obj[key] = typeof f[key]?.toJSON === 'function' ? f[key].toJSON() : f[key];
          }
        });
        return obj;
      });
    } else {
      // 导出完整数据
      features = this.getFeatures().map(f => f.toJSON());
    }

    return JSON.stringify({
      summary: this._summary ? this._summary.toJSON() : null,
      features,
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      totalFeatures: this._features.size
    }, null, 2);
  }

  /**
   * 导出为 Markdown 格式
   * 生成美观的项目状态报告
   *
   * @param {Object} [options={}] - 导出选项
   * @param {boolean} [options.includeDetails=true] - 是否包含详细信息
   * @param {boolean} [options.includeQualityMatrix=false] - 是否包含质量矩阵
   * @returns {string} Markdown 格式的报告文本
   */
  exportMarkdown(options = {}) {
    this._checkInitialized();

    const includeDetails = options.includeDetails !== false;
    const includeQualityMatrix = options.includeQualityMatrix || false;

    // 按阶段排序的功能点
    const features = this.sort(this.getFeatures(), 'stage');
    const summary = this._summary || {};

    let md = '# PDD 项目状态报告\n\n';

    // 报告头信息
    md += `> **导出时间**: ${new Date().toLocaleString('zh-CN')}\n`;
    md += `> **项目路径**: \`${this.projectRoot}\`\n\n`;

    // ===== 项目概览 =====
    md += '## 项目概览\n\n';
    md += '| 指标 | 值 |\n|------|-----|\n';
    md += `| 总功能点 | **${summary.totalFeatures || 0}** |\n`;
    md += `| 整体进度 | ${this._generateProgressBar(summary.overallProgress || 0)} ${summary.overallProgress || 0}% |\n`;
    md += `| 平均质量分 | ${summary.avgQualityScore || '-'} |\n`;
    md += `| Token消耗 | ${(summary.totalTokens || 0).toLocaleString()} |\n`;
    md += `| 平均迭代 | ${summary.avgIterations || 0} 轮 |\n`;

    if (this.lastRefreshTime) {
      md += `| 最后刷新 | ${this.lastRefreshTime.toLocaleString('zh-CN')} |\n`;
    }

    md += '\n';

    // ===== 阶段分布 =====
    if (summary.stageDistribution) {
      md += '## 阶段分布\n\n';
      md += '| 阶段 | 数量 | 占比 |\n|------|------|------|\n';

      const total = summary.totalFeatures || 1;
      for (const [stage, count] of Object.entries(summary.stageDistribution)) {
        const pct = total > 0 ? Math.round(count / total * 100) : 0;
        const bar = '█'.repeat(Math.ceil(pct / 5)) || '-';
        md += `| ${stage} | ${count} | ${pct}% ${bar} |\n`;
      }

      md += '\n';
    }

    // ===== 功能点列表 =====
    md += '## 功能点列表\n\n';

    if (includeDetails) {
      md += '| ID | 名称 | 阶段 | 优先级 | 进度 | 评分 | 等级 | Token | 迭代 |\n';
      md += '|----|------|------|--------|------|------|------|-------|------|\n';

      features.forEach(f => {
        const progress = f.progress ? f.progress() : 0;
        md += `| ${f.id} | ${f.name} | ${f.stage} | ${f.priority} | ${progress}% | `;
        md += `${f.quality?.score || '-'} | ${f.quality?.grade || '-'} | `;
        md += `${f.tokens?.used || 0} | ${f.iterations?.length || 0} |\n`;
      });
    } else {
      md += '| ID | 名称 | 阶段 | 评分 | Token |\n|----|------|------|------|-------|\n';

      features.forEach(f => {
        md += `| ${f.id} | ${f.name} | ${f.stage} | ${f.quality?.score||'-'} | ${f.tokens?.used||0} |\n`;
      });
    }

    md += '\n';

    // ===== 质量矩阵（可选）=====
    if (includeQualityMatrix) {
      const qualityMatrix = this.getQualityMatrix();

      md += '## 质量分析\n\n';
      md += `- **平均评分**: ${qualityMatrix.avgScore}\n`;
      md += `- **平均覆盖率**: ${qualityMatrix.avgCoverage}%\n`;
      md += `- **平均通过率**: ${qualityMatrix.avgPassRate}%\n`;
      md += `- **已评估**: ${qualityMatrix.evaluatedCount}/${qualityMatrix.totalCount}\n\n`;

      if (qualityMatrix.topIssues.length > 0) {
        md += '### Top 问题\n\n';
        md += '| 类型 | 出现次数 | 关联功能点 |\n|------|----------|------------|\n';

        qualityMatrix.topIssues.slice(0, 5).forEach(issue => {
          md += `| ${issue.type} | ${issue.count} | ${issue.features.slice(0, 3).join(', ')}${issue.features.length > 3 ? '...' : ''} |\n`;
        });

        md += '\n';
      }
    }

    // ===== Token 统计 =====
    const tokenStats = this.getTokenStats();
    md += '## Token 使用统计\n\n';
    md += `- **总配额**: ${tokenStats.total.toLocaleString()}\n`;
    md += `- **已使用**: ${tokenStats.used.toLocaleString()} (${tokenStats.percent}%)\n`;
    md += `- **剩余**: ${tokenStats.remaining.toLocaleString()}\n\n`;

    return md;
  }

  /**
   * 导出为 CSV 格式
   * 适合在 Excel 或其他表格工具中使用
   *
   * @param {Object} [options={}] - 导出选项
   * @returns {string} CSV 格式的文本
   */
  exportCSV(options = {}) {
    this._checkInitialized();

    // 按阶段排序
    const features = this.sort(this.getFeatures(), 'stage');

    // CSV 头部
    let csv = 'ID,Name,Stage,Priority,Score,Grade,Coverage,PassRate,TokenUsed,TokenTotal,Iterations,Tags,CreatedAt,UpdatedAt\n';

    // 数据行
    features.forEach(f => {
      // 转义字段中的特殊字符
      const escapeField = (value) => {
        if (value == null || value === '') return '';
        const str = String(value);
        // 如果包含逗号、引号或换行，需要用引号包裹并转义内部引号
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          const escaped = str.replace(/"/g, '""');
          return `"${escaped}"`;
        }
        return str;
      };

      csv += [
        escapeField(f.id),
        escapeField(f.name),
        escapeField(f.stage),
        escapeField(f.priority),
        escapeField(f.quality?.score),
        escapeField(f.quality?.grade),
        escapeField(f.quality?.coverage),
        escapeField(f.quality?.passRate),
        escapeField(f.tokens?.used || 0),
        escapeField(f.tokens?.total || 0),
        escapeField(f.iterations?.length || 0),
        escapeField((f.tags || []).join(';')),
        escapeField(f.createdAt ? new Date(f.createdAt).toISOString() : ''),
        escapeField(f.updatedAt ? new Date(f.updatedAt).toISOString() : '')
      ].join(',') + '\n';
    });

    return csv;
  }

  // ==================== 内部方法 ====================

  /**
   * 检查是否已初始化
   * @private
   * @throws {Error} 未初始化时抛出异常
   */
  _checkInitialized() {
    if (!this.initialized) {
      throw new Error('PDDDataProvider: 尚未初始化，请先调用 init() 方法');
    }
  }

  /**
   * 构建项目摘要
   * 从当前功能点集合计算汇总统计信息
   *
   * @returns {ProjectSummary} 项目摘要对象
   * @private
   */
  _buildSummary() {
    const features = this.getFeatures();
    const total = features.length;

    // 阶段分布统计
    const stageDist = {};
    STAGE_VALUES.forEach(s => { stageDist[s] = 0; });

    let totalProgress = 0;
    let totalScore = 0;
    let totalTokens = 0;
    let totalIters = 0;
    let qualityCount = 0;

    features.forEach(f => {
      // 阶段计数
      stageDist[f.stage] = (stageDist[f.stage] || 0) + 1;

      // 进度累加
      totalProgress += f.progress ? f.progress() : (STAGE_ORDER[f.stage] || 0) / 5 * 100;

      // 质量分数累加
      if (f.quality) {
        totalScore += f.quality.score || 0;
        qualityCount++;
      }

      // Token 累加
      totalTokens += f.tokens?.used || 0;

      // 迭代轮次累加
      totalIters += f.iterations?.length || 0;
    });

    // 计算平均值
    const n = total || 1;

    return new ProjectSummary({
      name: this.projectRoot.split(/[/\\]/).pop() || 'pdd-project',
      version: '1.0.0',
      totalFeatures: total,
      stageDistribution: stageDist,
      overallProgress: total > 0 ? Math.round(totalProgress / total) : 0,
      avgQualityScore: qualityCount > 0 ? Math.round(totalScore / qualityCount * 10) / 10 : 0,
      totalTokens,
      avgIterations: total > 0 ? Math.round(totalIters / total * 10) / 10 : 0,
      lastUpdated: Date.now()
    });
  }

  /**
   * 桥接外部引擎
   * 尝试加载可选的外部引擎模块（缓存、预算、评分、迭代控制）
   * 每个引擎都是可选的，加载失败不会影响主流程
   *
   * @returns {Promise<void>}
   * @private
   */
  async _bridgeEngineCaches() {
    // 引擎模块路径定义（相对于 lib/vm/data-provider.js 的位置）
    const modulePaths = {
      cache: '../../cache/system-cache.js',
      budget: '../../token/budget-manager.js',
      scorer: '../../quality/scorer.js',
      iteration: '../../iteration/controller.js'
    };

    // 尝试加载每个引擎
    for (const [key, modulePath] of Object.entries(modulePaths)) {
      try {
        console.log(chalk.gray(`[DataProvider] 尝试加载引擎: ${key} (${modulePath})...`));

        // 动态导入模块
        const module = await import(modulePath);

        // 获取默认导出或命名导出
        const EngineClass = module.default || module;

        // 创建实例（如果导出的是类）
        if (typeof EngineClass === 'function') {
          this.engineBridges[key] = new EngineClass(this.projectRoot);
        } else if (typeof EngineClass === 'object' && EngineClass !== null) {
          // 如果是对象（可能是单例），直接使用
          this.engineBridges[key] = EngineClass;
        }

        console.log(chalk.green(`[DataProvider] ✓ 引擎加载成功: ${key}`));

      } catch (error) {
        // 加载失败是正常的（引擎可能不存在），设为 null 并继续
        this.engineBridges[key] = null;
        console.warn(chalk.yellow(
          `[DataProvider] ⚠ 引擎未加载: ${key} - ${error.message.substring(0, 100)}`
        ));
      }
    }
  }

  /**
   * 检测新旧功能点之间的变更
   * 通过对比新旧 Map，识别新增、删除、修改的功能点
   *
   * @param {Map<string, Feature>} oldMap - 旧的功能点映射
   * @param {Map<string, Feature>} newMap - 新的功能点映射
   * @returns {{ added:number, removed:number, changed:number }}
   *   变更统计
   * @private
   */
  _detectChanges(oldMap, newMap) {
    let added = 0;
    let removed = 0;
    let changed = 0;

    const oldIds = new Set(oldMap.keys());
    const newIds = new Set(newMap.keys());

    // 检测新增的功能点
    for (const id of newIds) {
      if (!oldIds.has(id)) {
        added++;
        const newFeat = newMap.get(id);
        this.eventBus.emitSystemEvent('feature', 'added', `新功能点: ${newFeat.name}`);
      }
    }

    // 检测删除的功能点
    for (const id of oldIds) {
      if (!newIds.has(id)) {
        removed++;
        const oldFeat = oldMap.get(id);
        this.eventBus.emitSystemEvent('feature', 'removed', `删除功能点: ${oldFeat.name}`);
      }
    }

    // 检测修改的功能点
    for (const id of newIds) {
      if (oldIds.has(id)) {
        const oldFeat = oldMap.get(id);
        const newFeat = newMap.get(id);

        // 检查阶段变更
        if (oldFeat.stage !== newFeat.stage) {
          changed++;
          this.eventBus.emitStageChange(newFeat.id, oldFeat.stage, newFeat.stage, newFeat);
        }

        // 检查质量变更
        const oldScore = oldFeat.quality?.score ?? null;
        const newScore = newFeat.quality?.score ?? null;

        if (oldScore !== newScore && newFeat.quality) {
          this.eventBus.emitQualityUpdate(newFeat.id, newFeat.quality, oldFeat.quality || null);
        }

        // 如果不是阶段变更但其他字段变了，也算作 changed
        if (oldFeat.stage === newFeat.stage && oldScore === newScore) {
          // 检查其他关键字段的变更
          const oldJson = JSON.stringify(oldFeat.toJSON());
          const newJson = JSON.stringify(newFeat.toJSON());

          if (oldJson !== newJson) {
            changed++;
          }
        }
      }
    }

    return { added, removed, changed };
  }

  /**
   * 生成进度条字符串
   * @param {number} percent - 百分比 (0-100)
   * @returns {string} 进度条可视化字符串
   * @private
   */
  _generateProgressBar(percent) {
    const p = Math.max(0, Math.min(100, percent));
    const filled = Math.floor(p / 5); // 每5%一个字符
    const empty = 20 - filled;

    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
  }

  // ==================== 清理和销毁 ====================

  /**
   * 销毁数据提供者
   * 释放资源，停止定时器
   */
  async destroy() {
    // 停止自动刷新
    this.stopAutoRefresh();

    // 清空内存缓存
    this._features.clear();
    this._summary = null;

    // 清空事件日志
    this.eventBus.clearHistory();

    // 移除所有事件监听器
    this.eventBus.removeAllListeners();

    // 重置状态
    this.initialized = false;
    this.lastRefreshTime = null;

    console.log(chalk.gray('[DataProvider] 已销毁'));
  }
}

export { PDDDataProvider };
export default PDDDataProvider;
