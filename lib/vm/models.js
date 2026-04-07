/**
 * PDD Visual Manager - 数据模型定义
 *
 * 定义 Feature 数据模型的核心类和枚举，包括：
 * - StageEnum: 开发阶段枚举
 * - TimelineEntry: 时间线条目
 * - Artifact: 制品信息
 * - QualityMetrics: 质量指标
 * - TokenUsage: Token消耗
 * - IterationRound: 迭代轮次
 * - Feature: 核心功能点模型
 * - ProjectSummary: 项目汇总
 */

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
    magenta: (s) => s,
    gray: (s) => s
  };
}

/**
 * 开发阶段枚举
 * @readonly
 * @enum {string}
 */
export const StageEnum = Object.freeze({
  PRD: 'prd',
  EXTRACTED: 'extracted',
  SPEC: 'spec',
  IMPLEMENTING: 'implementing',
  VERIFYING: 'verifying',
  DONE: 'done'
});

/**
 * 所有有效阶段值列表
 * @type {string[]}
 */
export const STAGE_VALUES = Object.values(StageEnum);

/**
 * 阶段顺序映射（用于计算进度）
 * @type {Object<string, number>}
 */
export const STAGE_ORDER = Object.freeze({
  [StageEnum.PRD]: 0,
  [StageEnum.EXTRACTED]: 1,
  [StageEnum.SPEC]: 2,
  [StageEnum.IMPLEMENTING]: 3,
  [StageEnum.VERIFYING]: 4,
  [StageEnum.DONE]: 5
});

/**
 * 优先级枚举
 * @readonly
 * @enum {string}
 */
export const Priority = Object.freeze({
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
  P3: 'P3'
});

/**
 * 制品类型枚举
 * @readonly
 * @enum {string}
 */
export const ArtifactType = Object.freeze({
  SPEC: 'spec',
  CODE: 'code',
  TEST: 'test',
  REPORT: 'report'
});

/**
 * 时间线条目
 * 记录功能点在各个阶段的转换时间
 */
export class TimelineEntry {
  /**
   * 创建时间线条目
   * @param {Object} options - 配置选项
   * @param {string} options.stage - 当前阶段 (StageEnum)
   * @param {Date|number|string} options.timestamp - 进入该阶段的时间戳
   * @param {number} [options.duration=0] - 在该阶段持续的时间（毫秒）
   * @param {string} [options.note=''] - 备注
   */
  constructor({ stage, timestamp, duration = 0, note = '' }) {
    if (!STAGE_VALUES.includes(stage)) {
      throw new Error(`无效的阶段值: ${stage}, 有效值: ${STAGE_VALUES.join(', ')}`);
    }

    /** @type {string} 当前阶段 */
    this.stage = stage;

    /** @type {number} 时间戳（毫秒） */
    this.timestamp = typeof timestamp === 'number' ? timestamp :
      timestamp instanceof Date ? timestamp.getTime() :
      new Date(timestamp).getTime();

    /** @type {number} 持续时间（毫秒） */
    this.duration = duration;

    /** @type {string} 备注 */
    this.note = note || '';
  }

  /**
   * 序列化为 JSON 对象
   * @returns {Object} JSON 对象
   */
  toJSON() {
    return {
      stage: this.stage,
      timestamp: this.timestamp,
      duration: this.duration,
      note: this.note
    };
  }

  /**
   * 从 JSON 对象反序列化
   * @param {Object} data - JSON 数据
   * @returns {TimelineEntry} TimelineEntry 实例
   */
  static fromJSON(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('TimelineEntry.fromJSON: 无效的数据');
    }
    return new TimelineEntry({
      stage: data.stage,
      timestamp: data.timestamp,
      duration: data.duration ?? 0,
      note: data.note ?? ''
    });
  }

  /**
   * 格式化显示
   * @returns {string} 格式化字符串
   */
  toString() {
    const date = new Date(this.timestamp);
    return `[${chalk.cyan(this.stage)}] ${date.toLocaleString()} (${this.duration}ms)${this.note ? ` - ${this.note}` : ''}`;
  }
}

/**
 * 制品信息
 * 记录功能点生成的各种制品文件
 */
export class Artifact {
  /**
   * 创建制品信息
   * @param {Object} options - 配置选项
   * @param {string} options.type - 制品类型 (ArtifactType)
   * @param {string} options.path - 文件路径
   * @param {number} [options.size=0] - 文件大小（字节）
   * @param {Date|number|string} [options.lastModified] - 最后修改时间
   * @param {string} [options.checksum=''] - 文件校验和（SHA256）
   */
  constructor({ type, path: filePath, size = 0, lastModified, checksum = '' }) {
    const validTypes = Object.values(ArtifactType);
    if (!validTypes.includes(type)) {
      throw new Error(`无效的制品类型: ${type}, 有效值: ${validTypes.join(', ')}`);
    }

    /** @type {string} 制品类型 */
    this.type = type;

    /** @type {string} 文件路径 */
    this.path = filePath;

    /** @type {number} 文件大小（字节） */
    this.size = size;

    /** @type {number|null} 最后修改时间戳 */
    this.lastModified = lastModified ? (
      typeof lastModified === 'number' ? lastModified :
      lastModified instanceof Date ? lastModified.getTime() :
      new Date(lastModified).getTime()
    ) : null;

    /** @type {string} SHA256 校验和 */
    this.checksum = checksum || '';
  }

  /**
   * 序列化为 JSON 对象
   * @returns {Object} JSON 对象
   */
  toJSON() {
    return {
      type: this.type,
      path: this.path,
      size: this.size,
      lastModified: this.lastModified,
      checksum: this.checksum
    };
  }

  /**
   * 从 JSON 对象反序列化
   * @param {Object} data - JSON 数据
   * @returns {Artifact} Artifact 实例
   */
  static fromJSON(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Artifact.fromJSON: 无效的数据');
    }
    return new Artifact({
      type: data.type,
      path: data.path,
      size: data.size ?? 0,
      lastModified: data.lastModified,
      checksum: data.checksum ?? ''
    });
  }

  /**
   * 格式化文件大小
   * @returns {string} 格式化的文件大小
   */
  getFormattedSize() {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = this.size;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

/**
 * 质量指标
 * 记录功能点的质量评估数据
 */
export class QualityMetrics {
  /**
   * 创建质量指标
   * @param {Object} options - 配置选项
   * @param {number} [options.coverage=0] - 测试覆盖率 (0-100)
   * @param {number} [options.score=0] - 质量评分 (0-100)
   * @param {string} [options.grade='F'] - 等级 (S/A/B/C/D/F)
   * @param {Array<{message:string,severity:string,file?:string,line?:number}>} [options.issues=[]] - 问题列表
   * @param {number} [options.passRate=0] - 通过率 (0-100)
   */
  constructor({
    coverage = 0,
    score = 0,
    grade = 'F',
    issues = [],
    passRate = 0
  }) {
    /** @type {number} 测试覆盖率 (0-100) */
    this.coverage = Math.max(0, Math.min(100, coverage));

    /** @type {number} 质量评分 (0-100) */
    this.score = Math.max(0, Math.min(100, score));

    /** @type {string} 等级 */
    this.grade = this._validateGrade(grade);

    /** @type {Array<Object>} 问题列表 */
    this.issues = Array.isArray(issues) ? issues : [];

    /** @type {number} 通过率 (0-100) */
    this.passRate = Math.max(0, Math.min(100, passRate));
  }

  /**
   * 验证等级值
   * @param {string} grade - 等级值
   * @returns {string} 有效的等级值
   * @private
   */
  _validateGrade(grade) {
    const validGrades = ['S', 'A', 'B', 'C', 'D', 'F'];
    const upperGrade = String(grade).toUpperCase();
    if (!validGrades.includes(upperGrade)) {
      return 'F';
    }
    return upperGrade;
  }

  /**
   * 根据分数自动计算等级
   * @param {number} score - 分数
   * @returns {string} 等级
   */
  static calculateGrade(score) {
    if (score >= 95) return 'S';
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  /**
   * 序列化为 JSON 对象
   * @returns {Object} JSON 对象
   */
  toJSON() {
    return {
      coverage: this.coverage,
      score: this.score,
      grade: this.grade,
      issues: [...this.issues],
      passRate: this.passRate
    };
  }

  /**
   * 从 JSON 对象反序列化
   * @param {Object} data - JSON 数据
   * @returns {QualityMetrics} QualityMetrics 实例
   */
  static fromJSON(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('QualityMetrics.fromJSON: 无效的数据');
    }
    return new QualityMetrics({
      coverage: data.coverage ?? 0,
      score: data.score ?? 0,
      grade: data.grade ?? 'F',
      issues: Array.isArray(data.issues) ? data.issues : [],
      passRate: data.passRate ?? 0
    });
  }
}

/**
 * Token 使用情况
 * 记录 AI 模型的 Token 消耗
 */
export class TokenUsage {
  /**
   * 创建 Token 使用记录
   * @param {Object} options - 配置选项
   * @param {number} [options.total=0] - 总配额
   * @param {number} [options.used=0] - 已使用量
   * @param {number} [options.remaining=0] - 剩余量
   * @param {Object<string,number>} [options.byStage={}] - 按阶段统计的使用量
   * @param {Array<{stage:string,amount:number,timestamp:number}>} [options.history=[]] - 使用历史
   */
  constructor({
    total = 0,
    used = 0,
    remaining = 0,
    byStage = {},
    history = []
  }) {
    /** @type {number} 总配额 */
    this.total = total;

    /** @type {number} 已使用量 */
    this.used = used;

    /** @type {number} 剩余量 */
    this.remaining = remaining;

    /** @type {Object<string,number>} 按阶段统计 */
    this.byStage = { ...byStage };

    /** @type {Array<Object>} 使用历史 */
    this.history = Array.isArray(history) ? history : [];
  }

  /**
   * 添加使用记录
   * @param {string} stage - 阶段
   * @param {number} amount - 使用量
   * @param {number} [timestamp] - 时间戳
   */
  addUsage(stage, amount, timestamp) {
    this.used += amount;
    this.remaining = Math.max(0, this.total - this.used);

    // 更新按阶段统计
    if (!this.byStage[stage]) {
      this.byStage[stage] = 0;
    }
    this.byStage[stage] += amount;

    // 记录历史
    this.history.push({
      stage,
      amount,
      timestamp: timestamp || Date.now()
    });
  }

  /**
   * 序列化为 JSON 对象
   * @returns {Object} JSON 对象
   */
  toJSON() {
    return {
      total: this.total,
      used: this.used,
      remaining: this.remaining,
      byStage: { ...this.byStage },
      history: [...this.history]
    };
  }

  /**
   * 从 JSON 对象反序列化
   * @param {Object} data - JSON 数据
   * @returns {TokenUsage} TokenUsage 实例
   */
  static fromJSON(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('TokenUsage.fromJSON: 无效的数据');
    }
    return new TokenUsage({
      total: data.total ?? 0,
      used: data.used ?? 0,
      remaining: data.remaining ?? 0,
      byStage: data.byStage ? { ...data.byStage } : {},
      history: Array.isArray(data.history) ? data.history : []
    });
  }

  /**
   * 获取使用率百分比
   * @returns {number} 使用率 (0-100)
   */
  getUsagePercentage() {
    if (this.total === 0) return 0;
    return Math.round((this.used / this.total) * 100);
  }
}

/**
 * 迭代轮次
 * 记录每次迭代修复的详细信息
 */
export class IterationRound {
  /**
   * 创建迭代轮次
   * @param {Object} options - 配置选项
   * @param {number} options.round - 轮次号（从1开始）
   * @param {number} [options.score=0] - 该轮得分
   * @param {number} [options.issuesFixed=0] - 修复的问题数
   * @param {number} [options.tokenUsed=0] - 消耗的 Token 数
   * @param {Array<{file:string,type:string,description:string}>} [options.changes=[]] - 变更列表
   * @param {Date|number|string} [options.timestamp] - 迭代时间
   */
  constructor({
    round,
    score = 0,
    issuesFixed = 0,
    tokenUsed = 0,
    changes = [],
    timestamp
  }) {
    if (!Number.isInteger(round) || round < 1) {
      throw new Error('轮次号必须是正整数');
    }

    /** @type {number} 轮次号 */
    this.round = round;

    /** @type {number} 该轮得分 */
    this.score = score;

    /** @type {number} 修复的问题数 */
    this.issuesFixed = issuesFixed;

    /** @type {number} 消耗的 Token 数 */
    this.tokenUsed = tokenUsed;

    /** @type {Array<Object>} 变更列表 */
    this.changes = Array.isArray(changes) ? changes : [];

    /** @type {number} 迭代时间戳 */
    this.timestamp = timestamp ? (
      typeof timestamp === 'number' ? timestamp :
      timestamp instanceof Date ? timestamp.getTime() :
      new Date(timestamp).getTime()
    ) : Date.now();
  }

  /**
   * 序列化为 JSON 对象
   * @returns {Object} JSON 对象
   */
  toJSON() {
    return {
      round: this.round,
      score: this.score,
      issuesFixed: this.issuesFixed,
      tokenUsed: this.tokenUsed,
      changes: [...this.changes],
      timestamp: this.timestamp
    };
  }

  /**
   * 从 JSON 对象反序列化
   * @param {Object} data - JSON 数据
   * @returns {IterationRound} IterationRound 实例
   */
  static fromJSON(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('IterationRound.fromJSON: 无效的数据');
    }
    return new IterationRound({
      round: data.round,
      score: data.score ?? 0,
      issuesFixed: data.issuesFixed ?? 0,
      tokenUsed: data.tokenUsed ?? 0,
      changes: Array.isArray(data.changes) ? data.changes : [],
      timestamp: data.timestamp
    });
  }
}

/**
 * 功能点核心模型
 * PDD-VM 的核心数据结构，记录一个功能点的完整生命周期
 */
export class Feature {
  /**
   * 创建功能点
   * @param {Object} options - 配置选项
   * @param {string} options.id - 唯一标识符
   * @param {string} options.name - 功能点名称
   * @param {string} [options.description=''] - 描述
   * @param {string} [options.stage=StageEnum.PRD] - 当前阶段
   * @param {string} [options.priority=Priority.P2] - 优先级
   * @param {TimelineEntry[]} [options.timeline=[]] - 时间线
   * @param {Artifact[]} [options.artifacts=[]] - 制品列表
   * @param {QualityMetrics|null} [options.quality=null] - 质量指标
   * @param {TokenUsage} [options.tokens] - Token 使用
   * @param {IterationRound[]} [options.iterations=[]] - 迭代轮次
   * @param {string[]} [options.tags=[]] - 标签
   * @param {Date|number|string} [options.createdAt] - 创建时间
   * @param {Date|number|string} [options.updatedAt] - 更新时间
   */
  constructor({
    id,
    name,
    description = '',
    stage = StageEnum.PRD,
    priority = Priority.P2,
    timeline = [],
    artifacts = [],
    quality = null,
    tokens,
    iterations = [],
    tags = [],
    createdAt,
    updatedAt
  }) {
    if (!id || typeof id !== 'string') {
      throw new Error('Feature.id 必须是非空字符串');
    }
    if (!name || typeof name !== 'string') {
      throw new Error('Feature.name 必须是非空字符串');
    }
    if (!STAGE_VALUES.includes(stage)) {
      throw new Error(`无效的阶段值: ${stage}`);
    }
    if (!Object.values(Priority).includes(priority)) {
      throw new Error(`无效的优先级: ${priority}`);
    }

    /** @type {string} 唯一标识符 */
    this.id = id;

    /** @type {string} 功能点名称 */
    this.name = name;

    /** @type {string} 描述 */
    this.description = description;

    /** @type {string} 当前阶段 */
    this.stage = stage;

    /** @type {string} 优先级 */
    this.priority = priority;

    /** @type {TimelineEntry[]} 时间线 */
    this.timeline = Array.isArray(timeline) ? timeline.map(
      t => t instanceof TimelineEntry ? t : TimelineEntry.fromJSON(t)
    ) : [];

    /** @type {Artifact[]} 制品列表 */
    this.artifacts = Array.isArray(artifacts) ? artifacts.map(
      a => a instanceof Artifact ? a : Artifact.fromJSON(a)
    ) : [];

    /** @type {QualityMetrics|null} 质量指标 */
    this.quality = quality ? (
      quality instanceof QualityMetrics ? quality : QualityMetrics.fromJSON(quality)
    ) : null;

    /** @type {TokenUsage} Token 使用情况 */
    this.tokens = tokens ? (
      tokens instanceof TokenUsage ? tokens : TokenUsage.fromJSON(tokens)
    ) : new TokenUsage();

    /** @type {IterationRound[]} 迭代轮次 */
    this.iterations = Array.isArray(iterations) ? iterations.map(
      i => i instanceof IterationRound ? i : IterationRound.fromJSON(i)
    ) : [];

    /** @type {string[]} 标签 */
    this.tags = Array.isArray(tags) ? tags : [];

    const now = Date.now();

    /** @type {number} 创建时间戳 */
    this.createdAt = createdAt ? (
      typeof createdAt === 'number' ? createdAt :
      createdAt instanceof Date ? createdAt.getTime() :
      new Date(createdAt).getTime()
    ) : now;

    /** @type {number} 更新时间戳 */
    this.updatedAt = updatedAt ? (
      typeof updatedAt === 'number' ? updatedAt :
      updatedAt instanceof Date ? updatedAt.getTime() :
      new Date(updatedAt).getTime()
    ) : now;
  }

  /**
   * 计算完成进度 (0-100)
   * 基于当前阶段在流程中的位置
   * @returns {number} 进度百分比
   */
  progress() {
    const order = STAGE_ORDER[this.stage];
    if (order === undefined) return 0;
    return Math.round((order / (Object.keys(STAGE_ORDER).length - 1)) * 100);
  }

  /**
   * 判断是否已收敛（迭代是否稳定）
   * 收敛条件：最近2轮迭代分数变化小于5分，或已完成3轮以上
   * @returns {boolean} 是否收敛
   */
  isConverged() {
    if (this.iterations.length < 2) return false;
    if (this.stage === StageEnum.DONE) return true;

    // 检查最近两轮的分数变化
    const sorted = [...this.iterations].sort((a, b) => b.round - a.round);
    const recent = sorted.slice(0, 2);
    if (recent.length >= 2) {
      const diff = Math.abs(recent[0].score - recent[1].score);
      if (diff < 5 && this.iterations.length >= 3) {
        return true;
      }
    }

    // 超过5轮自动认为收敛
    return this.iterations.length >= 5;
  }

  /**
   * 添加时间线条目
   * @param {string} stage - 阶段
   * @param {string} [note=''] - 备注
   * @returns {TimelineEntry} 新创建的时间线条目
   */
  addTimelineEntry(stage, note = '') {
    const entry = new TimelineEntry({
      stage,
      timestamp: Date.now(),
      note
    });

    // 计算上一阶段的持续时间
    if (this.timeline.length > 0) {
      const prev = this.timeline[this.timeline.length - 1];
      entry.duration = entry.timestamp - prev.timestamp;
      prev.duration = entry.duration; // 更新前一条的duration
    }

    this.timeline.push(entry);
    this.stage = stage;
    this.updatedAt = Date.now();

    return entry;
  }

  /**
   * 添加制品
   * @param {Artifact} artifact - 制品对象
   * @returns {void}
   */
  addArtifact(artifact) {
    const art = artifact instanceof Artifact ? artifact : new Artifact(artifact);

    // 移除同类型的旧制品
    this.artifacts = this.artifacts.filter(a => a.type !== art.type);
    this.artifacts.push(art);
    this.updatedAt = Date.now();
  }

  /**
   * 获取指定类型的制品
   * @param {string} type - 制品类型
   * @returns {Artifact|null} 制品对象或null
   */
  getArtifactByType(type) {
    return this.artifacts.find(a => a.type === type) || null;
  }

  /**
   * 序列化为 JSON 对象
   * 完整处理所有嵌套对象
   * @returns {Object} JSON 对象
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      stage: this.stage,
      priority: this.priority,
      timeline: this.timeline.map(t => t.toJSON()),
      artifacts: this.artifacts.map(a => a.toJSON()),
      quality: this.quality ? this.quality.toJSON() : null,
      tokens: this.tokens.toJSON(),
      iterations: this.iterations.map(i => i.toJSON()),
      tags: [...this.tags],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * 从 JSON 对象反序列化
   * @param {Object} data - JSON 数据
   * @returns {Feature} Feature 实例
   */
  static fromJSON(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Feature.fromJSON: 无效的数据');
    }
    if (!data.id || !data.name) {
      throw new Error('Feature.fromJSON: 缺少必要字段 id 或 name');
    }
    return new Feature({
      id: data.id,
      name: data.name,
      description: data.description ?? '',
      stage: data.stage ?? StageEnum.PRD,
      priority: data.priority ?? Priority.P2,
      timeline: Array.isArray(data.timeline) ? data.timeline : [],
      artifacts: Array.isArray(data.artifacts) ? data.artifacts : [],
      quality: data.quality || null,
      tokens: data.tokens || null,
      iterations: Array.isArray(data.iterations) ? data.iterations : [],
      tags: Array.isArray(data.tags) ? data.tags : [],
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }

  /**
   * 格式化摘要信息
   * @returns {string} 摘要字符串
   */
  toSummary() {
    const progress = this.progress();
    const progressBar = '[' + '='.repeat(Math.floor(progress / 5)) + '-'.repeat(20 - Math.floor(progress / 5)) + ']';

    return [
      `${chalk.magenta(this.id)} ${chalk.bold(this.name)}`,
      `  阶段: ${chalk.cyan(this.stage)} | 优先级: ${chalk.yellow(this.priority)}`,
      `  进度: ${progressBar} ${progress}%`,
      `  质量: ${this.quality ? `${this.quality.score}(${this.quality.grade})` : chalk.gray('未评估')}`,
      `  迭代: ${this.iterations.length}轮${this.isConverged ? chalk.green(' [已收敛]') : ''}`
    ].join('\n');
  }
}

/**
 * 项目汇总信息
 * 提供项目级别的统计数据和概览
 */
export class ProjectSummary {
  /**
   * 创建项目汇总
   * @param {Object} options - 配置选项
   * @param {string} [options.name=''] - 项目名称
   * @param {string} [options.version='1.0.0'] - 版本号
   * @param {number} [options.totalFeatures=0] - 总功能点数
   * @param {Object<string,number>} [options.stageDistribution={}] - 各阶段分布
   * @param {number} [options.overallProgress=0] - 整体进度 (0-100)
   * @param {number} [options.avgQualityScore=0] - 平均质量分数
   * @param {number} [options.totalTokens=0] - 总Token消耗
   * @param {number} [options.avgIterations=0] - 平均迭代次数
   * @param {Date|number|string} [options.lastUpdated] - 最后更新时间
   */
  constructor({
    name = '',
    version = '1.0.0',
    totalFeatures = 0,
    stageDistribution = {},
    overallProgress = 0,
    avgQualityScore = 0,
    totalTokens = 0,
    avgIterations = 0,
    lastUpdated
  }) {
    /** @type {string} 项目名称 */
    this.name = name;

    /** @type {string} 版本号 */
    this.version = version;

    /** @type {number} 总功能点数 */
    this.totalFeatures = totalFeatures;

    /** @type {Object<string,number>} 各阶段分布 */
    this.stageDistribution = { ...stageDistribution };

    /** @type {number} 整体进度 (0-100) */
    this.overallProgress = Math.max(0, Math.min(100, overallProgress));

    /** @type {number} 平均质量分数 */
    this.avgQualityScore = avgQualityScore;

    /** @type {number} 总Token消耗 */
    this.totalTokens = totalTokens;

    /** @type {number} 平均迭代次数 */
    this.avgIterations = avgIterations;

    /** @type {number|null} 最后更新时间戳 */
    this.lastUpdated = lastUpdated ? (
      typeof lastUpdated === 'number' ? lastUpdated :
      lastUpdated instanceof Date ? lastUpdated.getTime() :
      new Date(lastUpdated).getTime()
    ) : null;
  }

  /**
   * 从功能点数组生成汇总
   * @param {Feature[]} features - 功能点数组
   * @param {string} [name=''] - 项目名称
   * @param {string} [version='1.0.0'] - 版本号
   * @returns {ProjectSummary} ProjectSummary 实例
   */
  static fromFeatures(features, name = '', version = '1.0.0') {
    const featArray = Array.isArray(features) ? features : [];

    // 统计各阶段分布
    const stageDistribution = {};
    for (const stage of STAGE_VALUES) {
      stageDistribution[stage] = 0;
    }
    for (const f of featArray) {
      if (f.stage in stageDistribution) {
        stageDistribution[f.stage]++;
      }
    }

    // 计算整体进度
    let totalProgress = 0;
    let totalQuality = 0;
    let qualityCount = 0;
    let totalTokens = 0;
    let totalIterations = 0;

    for (const f of featArray) {
      totalProgress += f.progress();
      if (f.quality) {
        totalQuality += f.quality.score;
        qualityCount++;
      }
      totalTokens += f.tokens.used;
      totalIterations += f.iterations.length;
    }

    const count = featArray.length || 1;

    return new ProjectSummary({
      name,
      version,
      totalFeatures: featArray.length,
      stageDistribution,
      overallProgress: Math.round(totalProgress / count),
      avgQualityScore: qualityCount > 0 ? Math.round(totalQuality / qualityCount) : 0,
      totalTokens,
      avgIterations: count > 0 ? Math.round((totalIterations / count) * 10) / 10 : 0,
      lastUpdated: Date.now()
    });
  }

  /**
   * 序列化为 JSON 对象
   * @returns {Object} JSON 对象
   */
  toJSON() {
    return {
      name: this.name,
      version: this.version,
      totalFeatures: this.totalFeatures,
      stageDistribution: { ...this.stageDistribution },
      overallProgress: this.overallProgress,
      avgQualityScore: this.avgQualityScore,
      totalTokens: this.totalTokens,
      avgIterations: this.avgIterations,
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * 从 JSON 对象反序列化
   * @param {Object} data - JSON 数据
   * @returns {ProjectSummary} ProjectSummary 实例
   */
  static fromJSON(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('ProjectSummary.fromJSON: 无效的数据');
    }
    return new ProjectSummary({
      name: data.name ?? '',
      version: data.version ?? '1.0.0',
      totalFeatures: data.totalFeatures ?? 0,
      stageDistribution: data.stageDistribution ? { ...data.stageDistribution } : {},
      overallProgress: data.overallProgress ?? 0,
      avgQualityScore: data.avgQualityScore ?? 0,
      totalTokens: data.totalTokens ?? 0,
      avgIterations: data.avgIterations ?? 0,
      lastUpdated: data.lastUpdated
    });
  }

  /**
   * 格式化显示项目状态
   * @returns {string} 格式化的状态报告
   */
  toReport() {
    const lines = [
      chalk.bold.blue('=== 项目汇总 ==='),
      `项目名称: ${chalk.green(this.name || '(未命名)')}`,
      `版本: ${this.version}`,
      `总功能点: ${this.totalFeatures}`,
      ``,
      chalk.bold('阶段分布:')
    ];

    for (const [stage, count] of Object.entries(this.stageDistribution)) {
      const bar = '#'.repeat(count) || '-';
      lines.push(`  ${chalk.cyan(stage.padEnd(12))}: ${String(count).padStart(3)} ${bar}`);
    }

    lines.push('', `整体进度: ${this.overallProgress}%`);
    lines.push(`平均质量分: ${this.avgQualityScore || chalk.gray('N/A')}`);
    lines.push(`总Token消耗: ${this.totalTokens.toLocaleString()}`);
    lines.push(`平均迭代次数: ${this.avgIterations}`);

    if (this.lastUpdated) {
      lines.push(`最后更新: ${new Date(this.lastUpdated).toLocaleString()}`);
    }

    return lines.join('\n');
  }
}

/**
 * 导出默认对象（包含所有模型类）
 */
export default {
  StageEnum,
  STAGE_VALUES,
  STAGE_ORDER,
  Priority,
  ArtifactType,
  TimelineEntry,
  Artifact,
  QualityMetrics,
  TokenUsage,
  IterationRound,
  Feature,
  ProjectSummary
};
