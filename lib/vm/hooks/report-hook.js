/**
 * @module lib/vm/hooks/report-hook
 * @description Report 命令 Hook 实现
 * 负责记录报告生成命令的结果，包括：
 * - after: 将生成的报告路径关联到对应的 Feature
 *        更新 artifacts.report 对象（path/type/lastModified）
 *
 * Report Hook 相对简单，主要关注报告文件的元数据关联
 */

import { PDDHook } from './hook-interface.js';
import { addTimelineEvent } from '../models.js';
import { getStateStore } from '../state-store.js';

/**
 * ReportHook - 处理 `pdd report` 命令的生命周期事件
 *
 * @class
 * @extends PDDHook
 *
 * @example
 * import { ReportHook } from './lib/vm/hooks/report-hook.js';
 * const hook = new ReportHook();
 * hookManager.register(hook);
 */
export class ReportHook extends PDDHook {
  /**
   * 创建 ReportHook 实例
   */
  constructor() {
    super({ enabled: true });
    /** @override */
    this.name = 'report';

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
   * 记录报告生成开始状态
   *
   * @async
   * @override
   * @param {import('./hook-interface.js').HookContext} ctx - 钩子上下文
   * @returns {Promise<void>}
   */
  async before(ctx) {
    if (!this._isEnabled()) return;

    try {
      this._log('before', ctx);
      console.log(
        `[ReportHook] 开始生成报告\n` +
        `  报告类型: ${ctx.options?.type || 'md'}\n` +
        `  输出路径: ${ctx.options?.output || './reports/pdd-report'}\n` +
        `  包含统计: ${ctx.options?.includeStats || false}\n` +
        `  包含图表: ${ctx.options?.includeCharts || false}`
      );
    } catch (error) {
      console.error(`[ReportHook] before 钩子执行失败: ${error.message}`);
    }
  }

  /**
   * 命令成功执行后的钩子
   * 主要职责：
   * 1. 从 result 中获取生成的报告信息
   * 2. 将报告路径关联到对应 feature 的 artifacts.report:
   *    - artifacts.report.path = reportOutputPath
   *    - artifacts.report.type = reportType (md/json/html)
   *    - artifacts.report.lastModified = now
   * 3. 更新对应 feature 的 artifacts
   * 4. 如果报告是针对特定功能点的，更新该功能点；
   *    如果是全局报告，尝试关联到所有相关功能点
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
      const featureId = ctx.featureId || ctx.options?.feature;

      // 解析报告结果
      const reportInfo = this._parseReportResult(result, ctx);

      if (!reportInfo || !reportInfo.path) {
        console.log('[ReportHook] 未获取到有效的报告路径信息');
        this._log('after', ctx);
        return;
      }

      // 构建标准化的报告对象
      const reportArtifact = {
        path: reportInfo.path,
        type: reportInfo.type || ctx.options?.type || 'md',
        lastModified: new Date(),
        size: reportInfo.size || 0,
        metadata: {
          includeStats: ctx.options?.includeStats || false,
          includeCharts: ctx.options?.includeCharts || false,
          generatedAt: new Date().toISOString()
        }
      };

      let updatedFeatures = [];

      if (featureId) {
        // 情况1：针对特定功能点的报告
        const feature = store.getFeature(featureId);

        if (feature) {
          await store.updateFeature(featureId, {
            artifacts: {
              ...feature.artifacts,
              report: reportArtifact
            }
          });

          // 添加时间线事件
          addTimelineEvent(feature, feature.stage, `报告已生成 (${reportArtifact.type})`, {
            reportPath: reportArtifact.path,
            reportType: reportArtifact.type,
            duration: ctx.duration
          });
          await store.saveState();

          updatedFeatures.push(featureId);
        } else {
          console.log(
            `[ReportHook] 功能点 ${featureId} 不存在，无法关联报告`
          );
        }
      } else {
        // 情况2：全局报告，关联到所有活跃的功能点
        const allFeatures = store.getAllFeatures().filter(
          f => f.status === 'active'
        );

        for (const feature of allFeatures) {
          // 为每个活跃功能点添加报告引用
          await store.updateFeature(feature.id, {
            artifacts: {
              ...feature.artifacts,
              report: reportArtifact
            }
          });

          updatedFeatures.push(feature.id);
        }

        console.log(
          `[ReportHook] 全局报告已关联到 ${updatedFeatures.length} 个功能点`
        );
      }

      this._log('after', ctx);

      // 输出摘要信息
      console.log(
        `\n[ReportHook] 报告生成结果:\n` +
        `  报告路径: ${reportArtifact.path}\n` +
        `  报告类型: ${reportArtifact.type}\n` +
        `  文件大小: ${this._formatFileSize(reportArtifact.size)}\n` +
        `  关联功能点: ${updatedFeatures.length} 个\n` +
        `  生成时间: ${reportArtifact.lastModified.toLocaleString()}`
      );

      if (updatedFeatures.length > 0 && updatedFeatures.length <= 5) {
        console.log('\n  关联的功能点:');
        for (const fid of updatedFeatures) {
          const f = store.getFeature(fid);
          console.log(`    - [${fid}] ${f?.name || '未知'}`);
        }
      }
    } catch (error) {
      console.error(`[ReportHook] after 钩子执行失败: ${error.message}`);
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
        `[ReportHook] 报告生成失败:\n` +
        `  错误: ${ctx.error?.message}\n` +
        `  类型: ${ctx.error?.name}`
      );
    } catch (error) {
      console.error(`[ReportHook] error 钩子执行失败: ${error.message}`);
    }
  }

  /**
   * 解析 report 命令的结果对象
   * 提取报告文件路径和元数据
   *
   * @private
   * @param {*} result - generateReport 函数的返回值
   * @param {import('./hook-interface.js').HookContext} ctx - 钩子上下文
   * @returns {Object|null} 报告信息对象
   */
  _parseReportResult(result, ctx) {
    if (!result) {
      // 如果没有返回值，从 options 推断输出路径
      return {
        path: ctx.options?.output ?
          `${ctx.options.output}.${ctx.options?.type || 'md'}` :
          './reports/pdd-report.md',
        type: ctx.options?.type || 'md',
        size: 0
      };
    }

    const parsed = {};

    // 格式1: { path: ..., type: ..., size: ... }
    if (result.path) {
      parsed.path = result.path;
    }

    if (result.type) {
      parsed.type = result.type;
    }

    if (result.size !== undefined) {
      parsed.size = result.size;
    }

    // 格式2: { outputPath: ..., format: ... }
    if (!parsed.path && result.outputPath) {
      parsed.path = result.outputPath;
    }

    if (!parsed.type && result.format) {
      parsed.type = result.format;
    }

    // 格式3: { file: { path, size }, type }
    if (!parsed.path && result.file?.path) {
      parsed.path = result.file.path;
      parsed.size = result.file.size || parsed.size;
    }

    // 格式4: 直接是字符串（文件路径）
    if (
      !parsed.path &&
      typeof result === 'string' &&
      result.endsWith('.md' || '.json' || '.html')
    ) {
      parsed.path = result;
    }

    // 确保有默认值
    if (!parsed.path) {
      parsed.path =
        ctx.options?.output ||
        `./reports/pdd-report.${ctx.options?.type || 'md'}`;
    }

    if (!parsed.type) {
      parsed.type = ctx.options?.type || 'md';
    }

    if (parsed.size === undefined) {
      parsed.size = 0;
    }

    return parsed;
  }

  /**
   * 格式化文件大小显示
   *
   * @private
   * @param {number} bytes - 字节数
   * @returns {string} 格式化后的大小字符串
   */
  _formatFileSize(bytes) {
    if (!bytes || bytes === 0) {
      return '未知';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

export default ReportHook;
