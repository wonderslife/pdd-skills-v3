/**
 * @module lib/vm/hooks/extract-hook
 * @description Extract 命令 Hook 实现
 * 负责记录功能点提取命令的结果，包括：
 * - after: 解析提取结果中的功能点列表
 *        为每个新功能点创建 Feature 记录（stage=EXTRACTED）
 *        批量添加到 state-store
 *
 * 注意：extract 命令通常在 before 时没有明确的 featureId，
 * 因为它是一次性从 PRD 中批量提取多个功能点
 */

import { PDDHook } from './hook-interface.js';
import { StageEnum } from '../models.js';
import { getStateStore } from '../state-store.js';

/**
 * ExtractHook - 处理 `pdd extract` 命令的生命周期事件
 *
 * @class
 * @extends PDDHook
 *
 * @example
 * import { ExtractHook } from './lib/vm/hooks/extract-hook.js';
 * const hook = new ExtractHook();
 * hookManager.register(hook);
 */
export class ExtractHook extends PDDHook {
  /**
   * 创建 ExtractHook 实例
   */
  constructor() {
    super({ enabled: true });
    /** @override */
    this.name = 'extract';

    /**
     * StateStore 实例缓存
     * @type {import('../state-store.js').StateStore|null}
     * @private
     */
    this._store = null;
  }

  /**
   * 获取或初始化 StateStore 实例
   *
   * @async
   * @private
   * @returns {Promise<import('../state-store.js').StateStore>}
   */
  async _getStore() {
    if (!this._store) {
      this._store = await getStateStore();
    }
    return this._store;
  }

  /**
   * 命令执行前的钩子
   * extract 命令在 before 阶段通常没有明确的 featureId，
   * 因为它是从 PRD 批量提取功能点的过程。
   *
   * 这里可以记录提取开始的全局状态（可选）
   *
   * @async
   * @override
   * @param {import('./hook-interface.js').HookContext} ctx - 钩子上下文
   * @returns {Promise<void>}
   */
  async before(ctx) {
    if (!this._isEnabled()) return;

    try {
      // extract 的 before 主要用于日志记录和准备状态
      this._log('before', ctx);
      console.log(
        `[ExtractHook] 开始功能点提取\n` +
        `  PRD路径: ${ctx.options?.prd || '默认'}\n` +
        `  输出目录: ${ctx.options?.output || '默认'}`
      );
    } catch (error) {
      console.error(`[ExtractHook] before 钩子执行失败: ${error.message}`);
    }
  }

  /**
   * 命令成功执行后的钩子
   * 主要职责：
   * 1. 从 ctx.result 中获取功能点列表
   * 2. 为每个新功能点创建 Feature 记录：
   *    - stage = EXTRACTED
   *    - 设置初始 timeline
   *    - 提取元数据（优先级、复杂度等）
   * 3. 批量 addFeature 到 state-store
   * 4. 统计并输出摘要信息
   *
   * @async
   * @override
   * @param {import('./hook-interface.js').HookContext} ctx - 钩子上下文（包含 result）
   * @returns {Promise<void>}
   */
  async after(ctx) {
    if (!this._isEnabled()) return;

    try {
      const store = await this._getStore();
      const result = ctx.result;

      // 解析提取结果
      const extractedFeatures = this._parseExtractResult(result);

      if (!extractedFeatures || extractedFeatures.length === 0) {
        console.log('[ExtractHook] 未提取到任何功能点');
        this._log('after', ctx);
        return;
      }

      console.log(
        `[ExtractHook] 检测到 ${extractedFeatures.length} 个功能点，开始创建记录...`
      );

      // 为每个功能点创建 Feature 记录
      const createdFeatures = [];
      const skippedFeatures = [];

      for (const featData of extractedFeatures) {
        // 生成唯一 ID（如果未提供）
        const featureId = featData.id || this._generateFeatureId(featData);

        // 检查是否已存在
        const existing = store.getFeature(featureId);

        if (existing) {
          skippedFeatures.push({ id: featureId, name: featData.name, reason: '已存在' });
          continue;
        }

        // 创建新 Feature
        const feature = await store.addFeature({
          id: featureId,
          name: featData.name || `未命名功能点-${featureId}`,
          description: featData.description || '',
          stage: StageEnum.EXTRACTED
        });

        // 补充额外元数据
        await store.updateFeature(featureId, {
          metadata: {
            ...feature.metadata,
            source: 'extract',
            prdPath: ctx.options?.prd,
            priority: featData.priority || undefined,
            complexity: featData.complexity || undefined,
            category: featData.category || undefined,
            tags: featData.tags || [],
            acceptanceCriteria: featData.acceptanceCriteria || [],
            dependencies: featData.dependencies || []
          },
          createdAt: feature.createdAt,
          updatedAt: new Date()
        });

        createdFeatures.push(feature);
      }

      this._log('after', ctx);

      // 输出详细统计
      console.log(
        `\n[ExtractHook] 功能点提取完成:\n` +
        `  ✓ 新建: ${createdFeatures.length} 个功能点\n` +
        (skippedFeatures.length > 0 ?
          `  ⊘ 跳过: ${skippedFeatures.length} 个（已存在）\n` : '') +
        `  总计: ${extractedFeatures.length} 个`
      );

      // 列出新建的功能点
      if (createdFeatures.length > 0 && createdFeatures.length <= 10) {
        console.log('\n  新建功能点列表:');
        for (const f of createdFeatures) {
          const meta = f.metadata || {};
          console.log(
            `    - [${f.id}] ${f.name}` +
            (meta.priority ? ` (优先级: ${meta.priority})` : '')
          );
        }
      } else if (createdFeatures.length > 10) {
        console.log(
          `\n  ... 显示前10个，共 ${createdFeatures.length} 个`
        );
        for (const f of createdFeatures.slice(0, 10)) {
          console.log(`    - [${f.id}] ${f.name}`);
        }
      }

      // 更新全局统计信息（可选）
      const stats = store.getStats();
      console.log(
        `\n[ExtractHook] 当前项目总览:\n` +
        `  功能点总数: ${stats.totalFeatures}\n` +
        `  各阶段分布: ${JSON.stringify(stats.byStage, null, 2)}`
      );
    } catch (error) {
      console.error(`[ExtractHook] after 钩子执行失败: ${error.message}`);
    }
  }

  /**
   * 命令执行出错时的钩子
   *
   * @async
   * @override
   * @param {import('./hook-interface.js').HookContext} ctx - 钩子上下文
   * @returns {Promise<void>}
   */
  async error(ctx) {
    if (!this._isEnabled()) return;

    try {
      this._log('error', ctx);
      console.error(
        `[ExtractHook] 功能点提取失败:\n` +
        `  错误: ${ctx.error?.message}\n` +
        `  类型: ${ctx.error?.name}`
      );
    } catch (error) {
      console.error(`[ExtractHook] error 钩子执行失败: ${error.message}`);
    }
  }

  /**
   * 解析 extract 命令的结果对象
   * 支持多种可能的返回格式
   *
   * @private
   * @param {*} result - extract 函数的返回值
   * @returns {Array<Object>} 功能点数据列表
   */
  _parseExtractResult(result) {
    if (!result) {
      return [];
    }

    // 格式1: { features: [...] }
    if (result.features && Array.isArray(result.features)) {
      return result.features;
    }

    // 格式2: { items: [...] }
    if (result.items && Array.isArray(result.items)) {
      return result.items;
    }

    // 格式3: 直接是数组
    if (Array.isArray(result)) {
      return result;
    }

    // 格式4: { data: { features: [...] } }
    if (result.data?.features && Array.isArray(result.data.features)) {
      return result.data.features;
    }

    // 格式5: { extracted: [...] }
    if (result.extracted && Array.isArray(result.extracted)) {
      return result.extracted;
    }

    // 尝试查找任何数组字段
    for (const key of Object.keys(result)) {
      if (Array.isArray(result[key]) && result[key].length > 0) {
        // 简单验证是否像功能点数据
        const firstItem = result[key][0];
        if (
          firstItem &&
          (firstItem.name || firstItem.id || firstItem.title)
        ) {
          return result[key];
        }
      }
    }

    return [];
  }

  /**
   * 根据功能点数据生成唯一 ID
   *
   * @private
   * @param {Object} featData - 功能点数据
   * @returns {string} 生成的 ID
   */
  _generateFeatureId(featData) {
    // 使用名称的简短哈希 + 时间戳生成 ID
    const name = featData.name || 'unknown';
    const timestamp = Date.now().toString(36);
    const shortHash = name
      .slice(0, 8)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    return `feat-${shortHash}-${timestamp}`;
  }
}

export default ExtractHook;
