/**
 * @module lib/vm/hooks/generate-hook
 * @description Generate 命令 Hook 实现
 * 负责记录代码生成命令的前后状态变化，包括：
 * - 前置：标记功能点为 IMPLEMENTING 阶段，记录开始时间线
 * - 后置：解析生成结果（文件列表、代码行数、Token 消耗），更新 Feature 的 artifacts 和 tokens
 *
 * 这是 PDD VM 系统中最核心的 Hook 之一
 */

import { PDDHook } from './hook-interface.js';
import { StageEnum, updateStage, addTimelineEvent } from '../models.js';
import { getStateStore } from '../state-store.js';

/**
 * GenerateHook - 处理 `pdd generate` 命令的生命周期事件
 *
 * @class
 * @extends PDDHook
 *
 * @example
 * import { GenerateHook } from './lib/vm/hooks/generate-hook.js';
 * const hook = new GenerateHook();
 * hookManager.register(hook);
 */
export class GenerateHook extends PDDHook {
  /**
   * 创建 GenerateHook 实例
   */
  constructor() {
    super({ enabled: true });
    /** @override */
    this.name = 'generate';

    /**
     * StateStore 实例缓存（懒加载）
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
   * 主要职责：
   * 1. 将 feature.stage 设置为 StageEnum.IMPLEMENTING
   * 2. 在 timeline 中添加实现开始记录
   * 3. 更新 state-store 持久化
   *
   * @async
   * @override
   * @param {import('./hook-interface.js').HookContext} ctx - 钩子上下文
   * @returns {Promise<void>}
   */
  async before(ctx) {
    if (!this._isEnabled()) return;

    try {
      const store = await this._getStore();
      const featureId = ctx.featureId || ctx.options?.feature;

      // 如果没有指定 featureId，尝试从 options 中推断
      if (!featureId) {
        this._log('before', ctx);
        console.log(
          '[GenerateHook] 警告: 未提供 featureId，跳过状态记录'
        );
        return;
      }

      // 获取或创建 Feature
      let feature = store.getFeature(featureId);

      if (!feature) {
        // 如果 Feature 不存在，自动创建一个
        console.log(
          `[GenerateHook] 功能点 ${featureId} 不存在，自动创建`
        );
        feature = await store.addFeature({
          id: featureId,
          name: ctx.options?.feature || featureId,
          description: `通过 generate 命令自动创建`
        });
      }

      // 更新阶段为 IMPLEMENTING
      updateStage(feature, StageEnum.IMPLEMENTING, '开始代码生成');

      // 添加详细的时间线事件
      addTimelineEvent(feature, StageEnum.IMPLEMENTING, '开始代码生成', {
        command: 'generate',
        spec: ctx.options?.spec,
        output: ctx.options?.output,
        dryRun: ctx.options?.dryRun || false
      });

      // 保存到磁盘
      await store.updateFeature(featureId, {});

      this._log('before', ctx);
      console.log(
        `[GenerateHook] 已将功能点 ${featureId} 标记为 ${StageEnum.IMPLEMENTING}`
      );
    } catch (error) {
      console.error(`[GenerateHook] before 钩子执行失败: ${error.message}`);
      // 不抛出异常，不影响主流程
    }
  }

  /**
   * 命令成功执行后的钩子
   * 主要职责：
   * 1. 解析 result 中的代码生成统计信息：
   *    - artifacts.code: 生成的文件路径列表
   *    - artifacts.loc: 总代码行数
   *    - artifacts.fileCount: 文件数
   *    - tokens.used: 本次 Token 消耗
   * 2. 更新 feature.artifacts 和 feature.tokens
   * 3. 在 timeline 中添加完成记录
   * 4. 计算并记录命令耗时
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
      const featureId = ctx.featureId || ctx.options?.feature;
      const result = ctx.result;

      if (!featureId) {
        this._log('after', ctx);
        console.log('[GenerateHook] 警告: 未提供 featureId，跳过结果记录');
        return;
      }

      const feature = store.getFeature(featureId);

      if (!feature) {
        console.log(
          `[GenerateHook] 功能点 ${featureId} 不存在，无法记录结果`
        );
        return;
      }

      // 解析代码生成结果
      const generationResult = this._parseGenerationResult(result);

      // 更新 artifacts
      const artifactsUpdate = {
        code: generationResult.files || [],
        loc: generationResult.totalLoc || 0,
        fileCount: generationResult.fileCount || 0,
        language: generationResult.language || ''
      };

      // 如果有报告信息也一并更新
      if (generationResult.reportPath) {
        artifactsUpdate.report = {
          path: generationResult.reportPath,
          type: 'md',
          lastModified: new Date()
        };
      }

      // 更新 tokens 统计
      const tokensUpdate = {};

      if (generationResult.tokenUsage) {
        tokensUpdate.input =
          (feature.tokens?.input || 0) + (generationResult.tokenUsage.input || 0);
        tokensUpdate.output =
          (feature.tokens?.output || 0) + (generationResult.tokenUsage.output || 0);
        tokensUpdate.total = tokensUpdate.input + tokensUpdate.output;

        if (generationResult.tokenUsage.cost !== undefined) {
          tokensUpdate.cost =
            (feature.tokens?.cost || 0) + generationResult.tokenUsage.cost;
        }
      }

      // 批量更新 Feature
      await store.updateFeature(featureId, {
        artifacts: artifactsUpdate,
        tokens: tokensUpdate
      });

      // 添加完成时间线事件
      addTimelineEvent(feature, StageEnum.IMPLEMENTING, '代码生成完成', {
        filesGenerated: artifactsUpdate.fileCount,
        totalLines: artifactsUpdate.loc,
        tokensUsed: tokensUpdate.total || 0,
        duration: ctx.duration,
        commandOptions: {
          spec: ctx.options?.spec,
          output: ctx.options?.output,
          dryRun: ctx.options?.dryRun
        }
      });

      // 再次保存时间线更新
      await store.saveState();

      this._log('after', ctx);

      // 输出摘要信息
      console.log(
        `[GenerateHook] 代码生成结果已记录:\n` +
        `  - 文件数: ${artifactsUpdate.fileCount}\n` +
        `  - 总行数: ${artifactsUpdate.loc}\n` +
        `  - Token消耗: ${tokensUpdate.total || 0}`
      );
    } catch (error) {
      console.error(`[GenerateHook] after 钩子执行失败: ${error.message}`);
    }
  }

  /**
   * 命令执行出错时的钩子
   * 记录错误信息到 timeline，但不改变 stage
   *
   * @async
   * @override
   * @param {import('./hook-interface.js').HookContext} ctx - 钩子上下文（包含 error）
   * @returns {Promise<void>}
   */
  async error(ctx) {
    if (!this._isEnabled()) return;

    try {
      const store = await this._getStore();
      const featureId = ctx.featureId || ctx.options?.feature;

      if (!featureId) return;

      const feature = store.getFeature(featureId);
      if (!feature) return;

      // 记录错误到 timeline（不改变 stage）
      addTimelineEvent(feature, feature.stage, '代码生成失败', {
        error: {
          message: ctx.error?.message,
          name: ctx.error?.name,
          stack: ctx.error?.stack
        },
        duration: ctx.duration
      });

      await store.saveState();

      this._log('error', ctx);
      console.error(
        `[GenerateHook] 已记录功能点 ${featureId} 的生成失败信息`
      );
    } catch (error) {
      console.error(`[GenerateHook] error 钩子执行失败: ${error.message}`);
    }
  }

  /**
   * 解析代码生成命令的结果对象
   * 支持多种可能的返回格式，提取标准化数据
   *
   * @private
   * @param {*} result - generateCode 函数的返回值
   * @returns {Object} 标准化的生成结果
   * @returns {string[]} [result.files] - 生成的文件路径列表
   * @returns {number} [result.totalLoc] - 总代码行数
   * @returns {number} [result.fileCount] - 文件数量
   * @returns {string} [result.language] - 主要编程语言
   * @returns {Object} [result.tokenUsage] - Token 使用统计
   * @returns {string} [result.reportPath] - 报告路径
   */
  _parseGenerationResult(result) {
    if (!result) {
      return {};
    }

    // 标准化结果格式
    const parsed = {
      files: [],
      totalLoc: 0,
      fileCount: 0,
      language: '',
      tokenUsage: null,
      reportPath: null
    };

    // 格式1: { files: [...], stats: { loc, fileCount }, tokens: {...} }
    if (Array.isArray(result.files)) {
      parsed.files = result.files;
      parsed.fileCount = result.files.length;
    }

    // 尝试从不同位置获取 LOC 信息
    if (result.stats?.loc) {
      parsed.totalLoc = result.stats.loc;
    } else if (result.artifacts?.loc) {
      parsed.totalLoc = result.artifacts.loc;
    } else if (result.totalLoc) {
      parsed.totalLoc = result.totalLoc;
    }

    // 尝试获取文件数
    if (result.stats?.fileCount) {
      parsed.fileCount = result.stats.fileCount;
    } else if (result.artifacts?.fileCount) {
      parsed.fileCount = result.artifacts.fileCount;
    }

    // 获取编程语言
    parsed.language = result.language || result.artifacts?.language || '';

    // 解析 Token 使用情况
    if (result.tokens) {
      parsed.tokenUsage = {
        input: result.tokens.input || 0,
        output: result.tokens.output || 0,
        cost: result.tokens.cost
      };
    } else if (result.tokenUsage) {
      parsed.tokenUsage = result.tokenUsage;
    }

    // 获取报告路径
    if (result.reportPath) {
      parsed.reportPath = result.reportPath;
    } else if (result.artifacts?.report?.path) {
      parsed.reportPath = result.artifacts.report.path;
    }

    // 格式2: { generatedFiles: [...], codeStats: {...} }
    if (!parsed.files.length && Array.isArray(result.generatedFiles)) {
      parsed.files = result.generatedFiles;
      parsed.fileCount = result.generatedFiles.length;
    }

    if (!parsed.totalLoc && result.codeStats?.totalLines) {
      parsed.totalLoc = result.codeStats.totalLines;
    }

    // 格式3: 直接是文件路径数组
    if (
      !parsed.files.length &&
      Array.isArray(result) &&
      typeof result[0] === 'string'
    ) {
      parsed.files = result;
      parsed.fileCount = result.length;
    }

    return parsed;
  }
}

export default GenerateHook;
