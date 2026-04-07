/**
 * @module lib/vm/hooks/verify-hook
 * @description Verify 命令 Hook 实现
 * 负责记录验证命令的前后状态变化，包括：
 * - 前置：标记功能点为 VERIFYING 阶段
 * - 后置：解析验证结果（覆盖率、评分、问题列表、通过率），
 *         根据结果更新质量指标和阶段状态（全部通过 -> DONE）
 *
 * 这是 PDD VM 系统中最重要的质量门禁 Hook
 */

import { PDDHook } from './hook-interface.js';
import { StageEnum, updateStage, addTimelineEvent, getGradeFromScore } from '../models.js';
import { getStateStore } from '../state-store.js';

/**
 * VerifyHook - 处理 `pdd verify` 命令的生命周期事件
 *
 * @class
 * @extends PDDHook
 *
 * @example
 * import { VerifyHook } from './lib/vm/hooks/verify-hook.js';
 * const hook = new VerifyHook();
 * hookManager.register(hook);
 */
export class VerifyHook extends PDDHook {
  /**
   * 创建 VerifyHook 实例
   */
  constructor() {
    super({ enabled: true });
    /** @override */
    this.name = 'verify';

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
   * 主要职责：
   * 1. 将 feature.stage 设置为 StageEnum.VERIFYING
   * 2. 在 timeline 中添加验证开始记录
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

      if (!featureId) {
        this._log('before', ctx);
        console.log('[VerifyHook] 警告: 未提供 featureId，跳过状态记录');
        return;
      }

      let feature = store.getFeature(featureId);

      // 如果 Feature 不存在，自动创建
      if (!feature) {
        console.log(`[VerifyHook] 功能点 ${featureId} 不存在，自动创建`);
        feature = await store.addFeature({
          id: featureId,
          name: ctx.options?.feature || featureId,
          description: `通过 verify 命令自动创建`,
          stage: StageEnum.IMPLEMENTING // verify 前应该是实现阶段
        });
      }

      // 更新阶段为 VERIFYING
      updateStage(feature, StageEnum.VERIFYING, '开始功能验证');

      // 添加详细时间线事件
      addTimelineEvent(feature, StageEnum.VERIFYING, '开始功能验证', {
        command: 'verify',
        spec: ctx.options?.spec,
        codeDir: ctx.options?.code,
        verbose: ctx.options?.verbose || false,
        outputJson: ctx.options?.json || false
      });

      // 持久化
      await store.updateFeature(featureId, {});

      this._log('before', ctx);
      console.log(
        `[VerifyHook] 已将功能点 ${featureId} 标记为 ${StageEnum.VERIFYING}`
      );
    } catch (error) {
      console.error(`[VerifyHook] before 钩子执行失败: ${error.message}`);
    }
  }

  /**
   * 命令成功执行后的钩子
   * 主要职责：
   * 1. 解析验证结果 (VerificationResult 对象)
   * 2. 计算并更新质量指标：
   *    - quality.coverage = result.coverage 或计算通过率
   *    - quality.score = result.overallScore 或基于 pass/fail 计算
   *    - quality.grade = 根据 score 映射等级 S(>95)/A(>85)/B(>70)/C(>55)/D(>40)/F(≤40)
   *    - quality.issues = result.issues 列表
   *    - quality.passRate = passed / (passed + failed) * 100
   * 3. 如果验证全部通过：stage = DONE
   * 4. 否则保持 VERIFYING（或标记为 NEEDS_FIX）
   * 5. 如果有迭代数据：添加 IterationRound
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
        console.log('[VerifyHook] 警告: 未提供 featureId，跳过结果记录');
        return;
      }

      const feature = store.getFeature(featureId);
      if (!feature) {
        console.log(
          `[VerifyHook] 功能点 ${featureId} 不存在，无法记录验证结果`
        );
        return;
      }

      // 解析验证结果
      const verificationResult = this._parseVerificationResult(result);

      // 构建质量指标对象
      const qualityUpdate = {
        coverage: verificationResult.coverage || 0,
        score: verificationResult.overallScore || 0,
        grade: '',
        issues: verificationResult.issues || [],
        passRate: verificationResult.passRate || 0,
        passed: verificationResult.passed || 0,
        failed: verificationResult.failed || 0,
        lastChecked: new Date()
      };

      // 计算质量等级
      if (qualityUpdate.score > 0) {
        const gradeInfo = getGradeFromScore(qualityUpdate.score);
        qualityUpdate.grade = gradeInfo.grade;
      } else if (qualityUpdate.passRate >= 0) {
        // 如果没有 score，用 passRate 作为替代
        const gradeInfo = getGradeFromScore(qualityUpdate.passRate);
        qualityUpdate.grade = gradeInfo.grade;
        qualityUpdate.score = qualityUpdate.passRate;
      }

      // 确定是否需要更新 stage
      let newStage = null;
      let stageNote = '';

      if (verificationResult.allPassed === true || qualityUpdate.failed === 0) {
        // 全部通过 -> DONE
        newStage = StageEnum.DONE;
        stageNote = `验证通过 (grade=${qualityUpdate.grade}, score=${qualityUpdate.score})`;
      } else if (qualityUpdate.failed > 0 && qualityUpdate.passRate < 50) {
        // 通过率过低 -> NEEDS_FIX
        newStage = StageEnum.NEEDS_FIX;
        stageNote = `验证未通过，需要修复 (${qualityUpdate.failed} 项失败)`;
      }
      // 其他情况保持 VERIFYING

      // 准备迭代数据（如果有）
      const iterationData = verificationResult.iterationRound
        ? this._buildIterationRound(verificationResult.iterationRound)
        : null;

      // 构建 updates 对象
      const updates = {
        quality: qualityUpdate
      };

      // 如果有新阶段，添加 stage 更新
      if (newStage) {
        updates.stage = newStage;
      }

      // 如果有迭代数据
      if (iterationData) {
        iterations: [...(feature.iterations || []), iterationData];
      }

      // 执行更新
      await store.updateFeature(featureId, updates);

      // 手动添加时间线事件（如果阶段变更了）
      if (newStage) {
        addTimelineEvent(feature, newStage, stageNote, {
          qualityMetrics: {
            score: qualityUpdate.score,
            grade: qualityUpdate.grade,
            passRate: qualityUpdate.passRate,
            issuesCount: qualityUpdate.issues.length
          },
          duration: ctx.duration
        });
        await store.saveState();
      } else {
        // 即使没有阶段变更，也记录验证完成事件
        addTimelineEvent(feature, StageEnum.VERIFYING, '验证完成（有未通过项）', {
          qualityMetrics: {
            score: qualityUpdate.score,
            grade: qualityUpdate.grade,
            passRate: qualityUpdate.passRate,
            passed: qualityUpdate.passed,
            failed: qualityUpdate.failed
          },
          duration: ctx.duration
        });
        await store.saveState();
      }

      this._log('after', ctx);

      // 输出摘要信息
      console.log(
        `[VerifyHook] 验证结果已记录:\n` +
        `  - 综合评分: ${qualityUpdate.score}\n` +
        `  - 质量等级: ${qualityUpdate.grade}\n` +
        `  - 通过率: ${qualityUpdate.passRate.toFixed(1)}%\n` +
        `  - 通过项: ${qualityUpdate.passed}\n` +
        `  - 失败项: ${qualityUpdate.failed}\n` +
        `  - 问题数: ${qualityUpdate.issues.length}\n` +
        `  - 当前阶段: ${newStage || StageEnum.VERIFYING}`
      );

      // 如果有问题，输出简要列表
      if (qualityUpdate.issues.length > 0 && qualityUpdate.issues.length <= 5) {
        console.log('\n  问题详情:');
        for (const issue of qualityUpdate.issues.slice(0, 5)) {
          console.log(
            `    [${issue.severity}] ${issue.type}: ${issue.message}`
          );
        }
        if (qualityUpdate.issues.length > 5) {
          console.log(`    ... 还有 ${qualityUpdate.issues.length - 5} 个问题`);
        }
      }
    } catch (error) {
      console.error(`[VerifyHook] after 钩子执行失败: ${error.message}`);
    }
  }

  /**
   * 命令执行出错时的钩子
   * 记录验证错误到 timeline
   *
   * @async
   * @override
   * @param {import('./hook-interface.js').HookContext} ctx - 钩子上下文
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

      // 记录错误到 timeline
      addTimelineEvent(feature, feature.stage, '验证过程出错', {
        error: {
          message: ctx.error?.message,
          name: ctx.error?.name
        },
        duration: ctx.duration
      });

      await store.saveState();

      this._log('error', ctx);
      console.error(
        `[VerifyHook] 已记录功能点 ${featureId} 的验证错误`
      );
    } catch (error) {
      console.error(`[VerifyHook] error 钩子执行失败: ${error.message}`);
    }
  }

  /**
   * 解析验证命令的结果对象
   * 支持多种可能的返回格式，提取标准化数据
   *
   * @private
   * @param {*} result - verifyFeature 函数的返回值
   * @returns {Object} 标准化的验证结果
   */
  _parseVerificationResult(result) {
    if (!result) {
      return {};
    }

    const parsed = {
      overallScore: 0,
      coverage: 0,
      passRate: 0,
      passed: 0,
      failed: 0,
      issues: [],
      allPassed: false,
      iterationRound: null
    };

    // 格式1: 标准 VerificationResult 结构
    if (result.overallScore !== undefined) {
      parsed.overallScore = result.overallScore;
    }

    if (result.coverage !== undefined) {
      parsed.coverage = result.coverage;
    }

    // 解析通过/失败统计
    if (result.summary) {
      parsed.passed = result.summary.passed || 0;
      parsed.failed = result.summary.failed || 0;
      parsed.allPassed = result.summary.allPassed === true ||
                         result.summary.status === 'passed' ||
                         result.failed === 0;
    } else if (result.passed !== undefined || result.failed !== undefined) {
      parsed.passed = result.passed || 0;
      parsed.failed = result.failed || 0;
      parsed.allPassed = (parsed.failed === 0);
    } else if (result.results) {
      // 从 results 数组计算
      for (const check of result.results) {
        if (check.status === 'pass' || check.passed === true) {
          parsed.passed++;
        } else {
          parsed.failed++;
        }
      }
      parsed.allPassed = (parsed.failed === 0);
    }

    // 计算通过率
    const total = parsed.passed + parsed.failed;
    if (total > 0) {
      parsed.passRate = (parsed.passed / total) * 100;
    }

    // 解析问题列表
    if (Array.isArray(result.issues)) {
      parsed.issues = result.issues.map(issue => ({
        type: issue.type || issue.checkType || 'unknown',
        name: issue.name || issue.rule || issue.title || '',
        message: issue.message || issue.description || issue.detail || '',
        severity: issue.severity || issue.level || 'medium',
        file: issue.file || issue.filePath || '',
        line: issue.line || issue.lineNumber || null
      }));
    } else if (Array.isArray(result.errors)) {
      parsed.issues = result.errors.map(err => ({
        type: 'error',
        name: err.name || 'Error',
        message: err.message || '',
        severity: 'high',
        file: err.file || '',
        line: err.line || null
      }));
    } else if (Array.isArray(result.warnings)) {
      parsed.issues = [
        ...parsed.issues,
        ...result.warnings.map(warn => ({
          type: 'warning',
          name: warn.name || 'Warning',
          message: warn.message || '',
          severity: 'medium',
          file: warn.file || '',
          line: warn.line || null
        }))
      ];
    }

    // 解析迭代数据
    if (result.iteration) {
      parsed.iterationRound = result.iteration;
    } else if (result.round) {
      parsed.iterationRound = result.round;
    }

    // 从 status 字段推断 allPassed
    if (parsed.allPassed === false && result.status === 'passed') {
      parsed.allPassed = true;
    }

    return parsed;
  }

  /**
   * 构建迭代轮次记录对象
   *
   * @private
   * @param {Object} rawData - 原始迭代数据
   * @returns {import('../models.js').IterationRound}
   */
  _buildIterationRound(rawData) {
    const now = new Date();

    return {
      round: rawData.round || 1,
      startTime: rawData.startTime ? new Date(rawData.startTime) : now,
      endTime: rawData.endTime ? new Date(rawData.endTime) : now,
      fixedIssues: rawData.fixedIssues || [],
      metrics: rawData.metrics || {},
      summary: rawData.summary || ''
    };
  }
}

export default VerifyHook;
