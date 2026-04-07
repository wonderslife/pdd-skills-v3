/**
 * PDD Visual Manager - 数据对齐与合并器
 *
 * 负责协调状态存储（state）和文件系统扫描结果（scanner）之间的数据一致性：
 * - 三路合并策略：state + scanner + 合并规则
 * - 孤儿检测：发现无对应记录的文件或无对应文件的功能点
 * - 冲突解决：自动处理 stage 和 quality 等字段的冲突
 * - 新功能点发现：自动将扫描到的新功能点加入 state
 *
 * @module vm/reconciler
 */

import { Feature, StageEnum, STAGE_VALUES, Priority } from './models.js';

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
 * 对齐结果类型
 * @typedef {Object} ReconciliationResult
 * @property {Feature[]} features - 合并后的功能点列表
 * @property {OrphanFile[]} orphanFiles - 孤儿文件列表
 * @property {Feature[]} newFeatures - 新发现的功能点
 * @property {Conflict[]} conflicts - 冲突列表
 * @property {string[]} warnings - 警告信息
 * @property {Object} statistics - 统计信息
 * @property {number} timestamp - 对齐时间戳
 * @property {number} duration - 耗时（毫秒）
 */

/**
 * 孤儿文件信息
 * @typedef {Object} OrphanFile
 * @property {string} path - 文件路径
 * @property {string} type - 文件类型 (spec/code/test/report)
 * @property {string} reason - 被判定为孤儿的原因
 * @property {string|null} suggestedFeatureId - 建议关联的功能点 ID
 * @property {Date} lastModified - 最后修改时间
 */

/**
 * 冲突信息
 * @typedef {Object} Conflict
 * @property {string} featureId - 涉及的功能点 ID
 * @property {string} field - 冲突字段名
 * @property {*} stateValue - state 中的值
 * @property {*} scannerValue - scanner 扫描到的值
 * @property {string} resolvedValue - 解决后的值
 * @property {string} resolutionStrategy - 解决策略
 */

/**
 * 数据对齐与合并器类
 */
export class Reconciler {
  /**
   * 创建对齐器实例
   * @param {import('./state-store.js').StateStore} stateStore - 状态存储器实例
   * @param {import('./scanner.js').ProjectScanner} scanner - 项目扫描器实例
   * @param {Object} [options={}] - 配置选项
   * @param {boolean} [options.autoStageFromScanner=true] - 是否以 scanner 推断的 stage 为准
   * @param {boolean} [options.autoCreateNewFeatures=true] - 是否自动创建新发现的功能点
   * @param {boolean} [options.preserveStateQuality=true] - 是否保留 state 中的质量指标
   * @param {number} [options.orphanThresholdDays=30] - 判定为孤儿的阈值天数
   * @param {Function} [options.onConflict] - 冲突回调函数
   */
  constructor(stateStore, scanner, options = {}) {
    if (!stateStore) {
      throw new Error('Reconciler: stateStore 是必需的');
    }
    if (!scanner) {
      throw new Error('Reconciler: scanner 是必需的');
    }

    /** @type {import('./state-store.js').StateStore} 状态存储器 */
    this.stateStore = stateStore;

    /** @type {import('./scanner.js').ProjectScanner} 项目扫描器 */
    this.scanner = scanner;

    /** @type {Object} 配置选项 */
    this.options = {
      autoStageFromScanner: true,
      autoCreateNewFeatures: true,
      preserveStateQuality: true,
      orphanThresholdDays: 30,
      ...options
    };

    /** @type {Array<Conflict>} 本次对齐发现的冲突 */
    this._conflicts = [];

    /** @type {Array<string>} 本次对齐产生的警告 */
    this._warnings = [];

    console.log(chalk.gray('[Reconciler] 初始化数据对齐器'));
  }

  /**
   * 执行完整的数据对齐流程
   *
   * 三路合并策略：
   * 1. state中的记录（命令Hook写入的权威数据）
   * 2. scanner扫描结果（文件系统真实状态）
   * 3. 合并规则：
   *    - state有+scanner有 → 取state为主，scanner补充缺失字段
   *    - state有+scanner无 → 标记为orphan(可能被删除)，保留但warn
   *    - state无+scanner有 → 新发现的功能点，自动创建记录
   *    - 冲突解决：stage以scanner推断为准(文件不会撒谎)，质量指标以state为准
   *
   * @returns {Promise<ReconciliationResult>} 对齐结果
   */
  async reconcile() {
    const startTime = Date.now();

    console.log(chalk.blue('\n[Reconciler] 开始数据对齐...\n'));

    // 重置内部状态
    this._conflicts = [];
    this._warnings = [];

    // 1. 加载当前状态
    const state = await this.stateStore.loadState();
    const stateFeatures = (state.project.features || []).map(f => Feature.fromJSON(f));

    // 2. 执行全量扫描
    const scanResult = await this.scanner.fullScan();

    // 3. 构建扫描结果的索引
    const scannedFeatureMap = this._buildScannedFeatureMap(scanResult);

    // 4. 执行三路合并
    const {
      mergedFeatures,
      orphanFiles,
      newFeatures,
      conflicts,
      warnings
    } = await this._performThreeWayMerge(stateFeatures, scannedFeatureMap, scanResult);

    // 5. 统计信息
    const statistics = this._calculateStatistics(
      stateFeatures.length,
      mergedFeatures.length,
      newFeatures.length,
      orphanFiles.length,
      conflicts.length
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    const result = {
      features: mergedFeatures,
      orphanFiles,
      newFeatures,
      conflicts,
      warnings,
      statistics,
      timestamp: endTime,
      duration
    };

    // 输出对齐报告
    this._printReconciliationReport(result);

    return result;
  }

  /**
   * 从扫描结果构建功能点映射
   * 将各种制品文件关联到可能的功能点
   *
   * @param {Object} scanResult - 全量扫描结果
   * @returns {Map<string, Object>} 功能点 ID -> 扫描数据 的映射
   * @private
   */
  _buildScannedFeatureMap(scanResult) {
    const featureMap = new Map();

    // 从规格文件提取
    for (const spec of scanResult.specs.files) {
      const featureId = spec.parsed?.featureId;
      if (featureId) {
        if (!featureMap.has(featureId)) {
          featureMap.set(featureId, {
            id: featureId,
            name: spec.parsed?.featureName || featureId,
            fromSpec: spec,
            fromCode: [],
            fromReport: [],
            inferredStage: null
          });
        }
        featureMap.get(featureId).fromSpec = spec;
      }

      // 同时尝试从文件路径推断
      const pathInferredId = this._extractFeatureIdFromPath(spec.path);
      if (pathInferredId && !featureMap.has(pathInferredId)) {
        featureMap.set(pathInferredId, {
          id: pathInferredId,
          name: spec.parsed?.featureName || pathInferredId,
          fromSpec: spec,
          fromCode: [],
          fromReport: [],
          inferredStage: null
        });
      }
    }

    // 从代码文件提取
    for (const codeFile of scanResult.sourceCode.files) {
      const codeFeatureId = codeFile.featureId;
      if (codeFeatureId && featureMap.has(codeFeatureId)) {
        featureMap.get(codeFeatureId).fromCode.push(codeFile);
      } else if (codeFeatureId) {
        featureMap.set(codeFeatureId, {
          id: codeFeatureId,
          name: codeFeatureId,
          fromSpec: null,
          fromCode: [codeFile],
          fromReport: [],
          inferredStage: StageEnum.IMPLEMENTING
        });
      }
    }

    // 从 PRD 提取功能点
    for (const prdFeature of scanResult.prd.features) {
      if (!featureMap.has(prdFeature.id)) {
        featureMap.set(prdFeature.id, {
          id: prdFeature.id,
          name: prdFeature.name,
          fromSpec: null,
          fromCode: [],
          fromReport: [],
          inferredStage: StageEnum.PRD,
          fromPRD: prdFeature
        });
      }
    }

    // 从报告提取关联的功能点
    for (const report of scanResult.reports.reports) {
      if (report.parsed && report.parsed.featureId) {
        const reportFeatureId = report.parsed.featureId;
        if (featureMap.has(reportFeatureId)) {
          featureMap.get(reportFeatureId).fromReport.push(report);
        }
      }
    }

    return featureMap;
  }

  /**
   * 从文件路径中提取功能点 ID
   * @param {string} filePath - 文件路径
   * @returns {string|null} 提取的 ID 或 null
   * @private
   */
  _extractFeatureIdFromPath(filePath) {
    // 匹配 feat-xxx 格式
    const featMatch = filePath.match(/feat-[a-zA-Z0-9_-]+/i);
    if (featMatch) return featMatch[0].toLowerCase();

    // 匹配目录名作为潜在 ID
    const parts = filePath.split(/[/\\]/);
    if (parts[0] && /^[a-z][a-z0-9-]*$/.test(parts[0])) {
      return parts[0];
    }

    return null;
  }

  /**
   * 执行三路合并
   *
   * @param {Feature[]} stateFeatures - state 中的功能点
   * @param {Map<string, Object>} scannedMap - 扫描到的功能点映射
   * @param {Object} scanResult - 完整扫描结果
   * @returns {Promise<Object>} 合并结果
   * @private
   */
  async _performThreeWayMerge(stateFeatures, scannedMap, scanResult) {
    const mergedFeatures = [];
    const orphanFiles = [];
    const newFeatures = [];
    const conflicts = [...this._conflicts];
    const warnings = [...this._warnings];

    // 用于跟踪已处理的扫描项
    const processedScanIds = new Set();

    // === 第一轮：处理 state 中存在的功能点 ===
    for (const stateFeat of stateFeatures) {
      const scannedData = scannedMap.get(stateFeat.id);

      if (scannedData) {
        // 情况1：state有 + scanner有 -> 合并
        processedScanIds.add(stateFeat.id);

        const merged = await this._mergeFeatureWithScan(stateFeat, scannedData);
        mergedFeatures.push(merged.merged);

        if (merged.conflict) {
          conflicts.push(merged.conflict);
        }
        if (merged.warning) {
          warnings.push(merged.warning);
        }
      } else {
        // 情况2：state有 + scanner无 -> 可能是孤儿
        const orphanCheck = await this._checkForOrphan(stateFeat, scanResult);

        if (orphanCheck.isOrphan) {
          // 标记为孤儿，但保留在列表中
          stateFeat.tags = [...(stateFeat.tags || []), '_orphan'];
          mergedFeatures.push(stateFeat);

          orphanFiles.push({
            featureId: stateFeat.id,
            reason: orphanCheck.reason,
            lastSeen: stateFeat.updatedAt,
            suggestion: orphanCheck.suggestion
          });

          warnings.push(`功能点 "${stateFeat.id}" 在文件系统中未找到对应制品 (${orphanCheck.reason})`);
        } else {
          // 可能是正常的（如刚规划的功能点），保留原样
          mergedFeatures.push(stateFeat);
        }
      }
    }

    // === 第二轮：处理 scanner 有但 state 无的新功能点 ===
    for (const [scanId, scanData] of scannedMap.entries()) {
      if (!processedScanIds.has(scanId)) {
        // 情况3：state无 + scanner有 -> 新发现

        if (this.options.autoCreateNewFeatures) {
          const newFeature = this._createFeatureFromScan(scanData);
          newFeatures.push(newFeature);
          mergedFeatures.push(newFeature);

          // 自动添加到 state
          try {
            await this.stateStore.addFeature(newFeature);
            console.log(chalk.green(`[Reconciler] 自动添加新功能点: ${newFeature.id}`));
          } catch (addError) {
            warnings.push(`无法自动保存新功能点 ${newFeature.id}: ${addError.message}`);
          }
        } else {
          warnings.push(`发现未跟踪的功能点: ${scanId}`);
        }
      }
    }

    // === 第三轮：孤儿文件检测 ===
    const additionalOrphans = await this._detectOrphanFiles(scanResult, mergedFeatures);
    orphanFiles.push(...additionalOrphans);

    return {
      mergedFeatures,
      orphanFiles,
      newFeatures,
      conflicts,
      warnings
    };
  }

  /**
   * 合并单个功能点的 state 和 scanner 数据
   *
   * @param {Feature} stateFeature - state 中的功能点
   * @param {Object} scannedData - 扫描数据
   * @returns {Promise<{merged:Feature, conflict?:Conflict, warning?:string}>} 合并结果
   * @private
   */
  async _mergeFeatureWithScan(stateFeature, scannedData) {
    // 创建副本用于修改
    const merged = Feature.fromJSON(stateFeature.toJSON());
    let conflict = null;
    let warning = null;

    // 1. 阶段冲突解决：以 scanner 推断为准（文件不会撒谎）
    if (this.options.autoStageFromScanner && scannedData.inferredStage) {
      const scannerStage = scannedData.inferredStage;

      if (merged.stage !== scannerStage) {
        // 记录冲突
        conflict = {
          featureId: merged.id,
          field: 'stage',
          stateValue: merged.stage,
          scannerValue: scannerStage,
          resolvedValue: scannerStage,
          resolutionStrategy: 'scanner_priority' // 以扫描结果为准
        };

        // 更新阶段
        merged.stage = scannerStage;

        // 添加时间线条目
        merged.addTimelineEntry(scannerStage, `阶段由对齐器更新（基于文件系统扫描）`);
      }
    }

    // 2. 名称补充：如果 state 中名称为空，使用扫描结果
    if ((!merged.name || merged.name === merged.id) && scannedData.name && scannedData.name !== scannedData.id) {
      merged.name = scannedData.name;
    }

    // 3. 描述补充
    if (!merged.description && scannedData.fromSpec?.parsed?.description) {
      merged.description = scannedData.fromSpec.parsed.description.substring(0, 2000);
    }

    // 4. 优先级补充
    if (merged.priority === 'P2' && scannedData.fromSpec?.parsed?.priority) {
      const scannedPriority = scannedData.fromSpec.parsed.priority;
      if (Object.values(Priority).includes(scannedPriority)) {
        merged.priority = scannedPriority;
      }
    }

    // 5. 制品信息同步
    if (scannedData.fromSpec) {
      const existingSpecArtifact = merged.getArtifactByType('spec');
      if (!existingSpecArtifact) {
        merged.addArtifact({
          type: 'spec',
          path: scannedData.fromSpec.path,
          size: scannedData.fromSpec.size,
          lastModified: scannedData.fromSpec.lastModified.getTime(),
          checksum: scannedData.fromSpec.checksum
        });
      }
    }

    // 同步代码制品
    if (scannedData.fromCode && scannedData.fromCode.length > 0) {
      const existingCodeArtifact = merged.getArtifactByType('code');
      if (!existingCodeArtifact) {
        // 使用第一个代码文件作为代表
        const primaryCode = scannedData.fromCode[0];
        merged.addArtifact({
          type: 'code',
          path: primaryCode.path,
          size: primaryCode.size,
          lastModified: primaryCode.lastModified.getTime()
        });
      }
    }

    // 同步报告制品
    if (scannedData.fromReport && scannedData.fromReport.length > 0) {
      const existingReportArtifact = merged.getArtifactByType('report');
      if (!existingReportArtifact) {
        const primaryReport = scannedData.fromReport[0];
        merged.addArtifact({
          type: 'report',
          path: primaryReport.path,
          size: primaryReport.size,
          lastModified: primaryReport.lastModified.getTime()
        });
      }
    }

    // 6. 质量指标：保留 state 中的值（更准确）
    if (this.options.preserveStateQuality && !merged.quality && scannedData.fromReport?.length > 0) {
      // 尝试从报告中提取质量数据
      for (const report of scannedData.fromReport) {
        if (report.parsed?.score !== undefined || report.parsed?.qualityScore !== undefined) {
          // 不在这里设置，保持 state 为准的原则
          break;
        }
      }
    }

    // 7. 更新时间戳
    merged.updatedAt = Date.now();

    // 尝试保存合并后的功能点到 state
    try {
      await this.stateStore.updateFeature(merged.id, merged.toJSON());
    } catch (saveError) {
      warning = `无法保存合并后的功能点 ${merged.id}: ${saveError.message}`;
    }

    return { merged, conflict, warning };
  }

  /**
   * 检查功能点是否为孤儿
   *
   * @param {Feature} feature - 要检查的功能点
   * @param {Object} scanResult - 扫描结果
   * @returns {Promise<{isOrphan:boolean, reason:string, suggestion:string}>} 检查结果
   * @private
   */
  async _checkForOrphan(feature, scanResult) {
    const now = Date.now();
    const thresholdMs = this.options.orphanThresholdDays * 24 * 60 * 60 * 1000;
    const timeSinceUpdate = now - (feature.updatedAt || feature.createdAt || now);

    // 如果最近有更新，不太可能是孤儿
    if (timeSinceUpdate < thresholdMs) {
      return {
        isOrphan: false,
        reason: '',
        suggestion: ''
      };
    }

    // 根据阶段判断
    switch (feature.stage) {
      case StageEnum.PRD:
      case StageEnum.EXTRACTED:
        // 这些阶段没有制品是正常的
        return { isOrphan: false, reason: '', suggestion: '' };

      case StageEnum.SPEC:
        // 应该有规格文件
        if (scanResult.specs.totalCount > 0) {
          const hasMatchingSpec = scanResult.specs.files.some(f =>
            f.parsed?.featureId === feature.id ||
            f.path.toLowerCase().includes(feature.id.toLowerCase())
          );
          if (!hasMatchingSpec) {
            return {
              isOrphan: true,
              reason: `标记为 SPEC 阶段但未找到规格文件`,
              suggestion: `检查 dev-specs/ 目录是否有 ${feature.id} 相关文件`
            };
          }
        }
        break;

      case StageEnum.IMPLEMENTING:
      case StageEnum.VERIFYING:
      case StageEnum.DONE:
        // 这些阶段应该有代码或报告
        const hasCode = scanResult.sourceCode.fileCount > 0 &&
          scanResult.sourceCode.files.some(f =>
            f.featureId === feature.id ||
            f.path.toLowerCase().includes(feature.id.toLowerCase())
          );

        const hasReport = scanResult.reports.reports.length > 0 &&
          scanResult.reports.reports.some(r =>
            r.path.toLowerCase().includes(feature.id.toLowerCase()) ||
            (r.parsed && JSON.stringify(r.parsed).includes(feature.id))
          );

        if (!hasCode && !hasReport) {
          return {
            isOrphan: true,
            reason: `标记为 ${feature.stage.toUpperCase()} 阶段但未找到对应的代码或报告`,
            suggestion: `检查源码目录和 reports/ 目录`
          };
        }
        break;
    }

    return { isOrphan: false, reason: '', suggestion: '' };
  }

  /**
   * 从扫描数据创建新的功能点对象
   *
   * @param {Object} scanData - 扫描数据
   * @returns {Feature} 新创建的功能点
   * @private
   */
  _createFeatureFromScan(scanData) {
    const now = Date.now();

    // 推断阶段
    let stage = scanData.inferredStage || StageEnum.PRD;

    // 根据可用制品调整阶段
    if (scanData.fromCode && scanData.fromCode.length > 0) {
      stage = StageEnum.IMPLEMENTING;
    }
    if (scanData.fromReport && scanData.fromReport.length > 0) {
      stage = StageEnum.VERIFYING;
    }
    if (scanData.fromSpec && !scanData.fromCode) {
      stage = StageEnum.SPEC;
    }

    // 推断优先级
    let priority = Priority.P2;
    if (scanData.fromSpec?.parsed?.priority) {
      const p = scanData.fromSpec.parsed.priority;
      if (Object.values(Priority).includes(p)) {
        priority = p;
      }
    }

    // 创建功能点
    const feature = new Feature({
      id: scanData.id,
      name: scanData.name || scanData.id,
      description: scanData.fromSpec?.parsed?.description || '',
      stage,
      priority,
      tags: ['_auto-discovered'],
      createdAt: now,
      updatedAt: now
    });

    // 添加初始时间线
    feature.addTimelineEntry(stage, '由对齐器自动发现');

    return feature;
  }

  /**
   * 检测孤儿文件
   * 发现没有对应功能点记录的制品文件
   *
   * @param {Object} scanResult - 扫描结果
   * @param {Feature[]} knownFeatures - 已知功能点列表
   * @returns {Promise<OrphanFile[]>} 孤儿文件列表
   * @private
   */
  async _detectOrphanFiles(scanResult, knownFeatures) {
    const orphans = [];
    const knownIds = new Set(knownFeatures.map(f => f.id));

    // 检查规格文件
    for (const spec of scanResult.specs.files) {
      const specId = spec.parsed?.featureId;
      const pathId = this._extractFeatureIdFromPath(spec.path);

      if (specId && !knownIds.has(specId)) {
        orphans.push({
          path: spec.path,
          type: 'spec',
          reason: '规格文件没有对应的功能点记录',
          suggestedFeatureId: specId,
          lastModified: spec.lastModified
        });
      } else if (pathId && !knownIds.has(pathId) && (!specId || specId === pathId)) {
        orphans.push({
          path: spec.path,
          type: 'spec',
          reason: '规格文件路径暗示了未知的功能点',
          suggestedFeatureId: pathId,
          lastModified: spec.lastModified
        });
      }
    }

    // 检查代码文件
    for (const codeFile of scanResult.sourceCode.files) {
      if (codeFile.featureId && !knownIds.has(codeFile.featureId)) {
        orphans.push({
          path: codeFile.path,
          type: 'code',
          reason: '代码文件引用了未知的功能点 ID',
          suggestedFeatureId: codeFile.featureId,
          lastModified: codeFile.lastModified
        });
      }
    }

    // 检查报告文件
    for (const report of scanResult.reports.reports) {
      if (report.parsed?.featureId && !knownIds.has(report.parsed.featureId)) {
        orphans.push({
          path: report.path,
          type: 'report',
          reason: '验证报告引用了未知的功能点',
          suggestedFeatureId: report.parsed.featureId,
          lastModified: report.lastModified
        });
      }
    }

    return orphans;
  }

  /**
   * 计算统计信息
   *
   * @param {number} originalCount - 原始数量
   * @param {number} mergedCount - 合并后数量
   * @param {number} newCount - 新增数量
   * @param {number} orphanCount - 孤儿数量
   * @param {number} conflictCount - 冲突数量
   * @returns {Object} 统计信息
   * @private
   */
  _calculateStatistics(originalCount, mergedCount, newCount, orphanCount, conflictCount) {
    return {
      originalFeatureCount: originalCount,
      finalFeatureCount: mergedCount,
      newFeaturesDiscovered: newCount,
      orphanFeaturesDetected: orphanCount,
      conflictsResolved: conflictCount,
      changeDelta: mergedCount - originalCount
    };
  }

  /**
   * 打印对齐报告
   *
   * @param {ReconciliationResult} result - 对齐结果
   * @private
   */
  _printReconciliationReport(result) {
    console.log(chalk.bold('\n' + '='.repeat(60)));
    console.log(chalk.bold.cyan('  PDD Visual Manager - 数据对齐报告'));
    console.log('='.repeat(60));

    // 统计摘要
    console.log(chalk.bold('\n统计摘要:'));
    console.log(`  原始功能点数:     ${result.statistics.originalFeatureCount}`);
    console.log(`  最终功能点数:     ${result.statistics.finalFeatureCount}`);
    console.log(`  新发现功能点:     ${chalk.green(String(result.statistics.newFeaturesDiscovered))}`);
    console.log(`  孤儿功能点:       ${chalk.yellow(String(result.statistics.orphanFeaturesDetected))}`);
    console.log(`  解决的冲突:       ${chalk.red(String(result.statistics.conflictsResolved))}`);

    // 新功能点
    if (result.newFeatures.length > 0) {
      console.log(chalk.bold('\n新发现的功能点:'));
      for (const feat of result.newFeatures) {
        console.log(`  ${chalk.green('+')} ${chalk.magenta(feat.id)} ${feat.name} [${chalk.cyan(feat.stage)}]`);
      }
    }

    // 孤儿文件
    if (result.orphanFiles.length > 0) {
      console.log(chalk.bold('\n孤儿警告:'));
      for (const orphan of result.orphanFiles) {
        console.log(`  ${chalk.yellow('!')} ${orphan.featureId || orphan.path}: ${orphan.reason}`);
        if (orphan.suggestedFeatureId) {
          console.log(`     建议: 关联到功能点 "${orphan.suggestedFeatureId}"`);
        }
      }
    }

    // 冲突详情
    if (result.conflicts.length > 0) {
      console.log(chalk.bold('\n解决的冲突:'));
      for (const conflict of result.conflicts) {
        console.log(`  ${chalk.red('*')} [${conflict.featureId}] ${conflict.field}:`);
        console.log(`     State:  ${conflict.stateValue}`);
        console.log(`     Scanner: ${conflict.scannerValue}`);
        console.log(`     -> 采用: ${chalk.green(String(conflict.resolvedValue))} (${conflict.resolutionStrategy})`);
      }
    }

    // 警告
    if (result.warnings.length > 0) {
      console.log(chalk.bold('\n警告信息:'));
      for (const warn of result.warnings.slice(0, 10)) {
        console.log(`  ${chalk.yellow('-')} ${warn}`);
      }
      if (result.warnings.length > 10) {
        console.log(`  ... 还有 ${result.warnings.length - 10} 条警告`);
      }
    }

    console.log(chalk.bold('\n' + '='.repeat(60)));
    console.log(`耗时: ${result.duration}ms | 时间: ${new Date(result.timestamp).toLocaleString()}`);
    console.log('='.repeat(60) + '\n');
  }

  /**
   * 仅执行冲突检测（不修改数据）
   * 用于预览模式或 dry-run
   *
   * @returns {Promise<{conflicts:Conflict[], warnings:string[]}>} 检测结果
   */
  async detectConflictsOnly() {
    console.log(chalk.blue('[Reconciler] 执行仅冲突检测模式...\n'));

    const state = await this.stateStore.loadState();
    const stateFeatures = (state.project.features || []).map(f => Feature.fromJSON(f));
    const scanResult = await this.scanner.fullScan();
    const scannedMap = this._buildScannedFeatureMap(scanResult);

    const conflicts = [];
    const warnings = [];

    for (const stateFeat of stateFeatures) {
      const scannedData = scannedMap.get(stateFeat.id);

      if (scannedData) {
        // 检查阶段差异
        if (scannedData.inferredStage && stateFeat.stage !== scannedData.inferredStage) {
          conflicts.push({
            featureId: stateFeat.id,
            field: 'stage',
            stateValue: stateFeat.stage,
            scannerValue: scannedData.inferredStage,
            resolvedValue: null,
            resolutionStrategy: 'pending'
          });
        }
      }
    }

    // 检测潜在的孤儿
    for (const stateFeat of stateFeatures) {
      const orphanCheck = await this._checkForOrphan(stateFeat, scanResult);
      if (orphanCheck.isOrphan) {
        warnings.push(`[${stateFeat.id}] ${orphanCheck.reason}`);
      }
    }

    return { conflicts, warnings };
  }

  /**
   * 获取配置选项
   * @returns {Object} 当前配置
   */
  getOptions() {
    return { ...this.options };
  }

  /**
   * 更新配置选项
   * @param {Object} updates - 配置更新
   */
  setOptions(updates) {
    Object.assign(this.options, updates);
  }
}

/**
 * 导出默认对象
 */
export default Reconciler;
