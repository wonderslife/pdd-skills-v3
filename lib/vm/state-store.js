/**
 * PDD Visual Manager - 状态存储器
 *
 * 负责项目状态文件 (project-state.json) 的读写操作，提供：
 * - 原子写入（write tmp + rename）
 * - 自动备份（.bak 文件）
 * - 功能点 CRUD 操作
 * - 状态查询与汇总
 *
 * @module vm/state-store
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { Feature, ProjectSummary } from './models.js';
import { validate, migrate, createEmptyState, SCHEMA_VERSION } from './state-schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    bold: (s) => s
  };
}

/**
 * 状态文件名常量
 * @type {string}
 */
export const STATE_FILENAME = 'project-state.json';

/**
 * 备份文件扩展名
 * @type {string}
 */
export const BACKUP_EXT = '.bak';

/**
 * 最大备份数量
 * @type {number}
 */
export const MAX_BACKUPS = 5;

/**
 * 状态存储器类
 * 管理 project-state.json 文件的读写和功能点数据操作
 */
export class StateStore {
  /**
   * 创建状态存储器实例
   * @param {string} projectRoot - 项目根目录路径
   * @param {Object} [options={}] - 配置选项
   * @param {boolean} [options.autoBackup=true] - 是否自动备份
   * @param {number} [options.maxBackups=MAX_BACKUPS] - 最大备份数量
   * @param {boolean} [options.validateOnLoad=true] - 加载时是否验证
   * @param {boolean} [options.validateOnSave=true] - 保存时是否验证
   * @param {string} [options.stateDir='.pdd-vm'] - 状态文件所在目录（相对于 projectRoot）
   */
  constructor(projectRoot, options = {}) {
    if (!projectRoot || typeof projectRoot !== 'string') {
      throw new Error('StateStore: projectRoot 必须是非空字符串');
    }

    /** @type {string} 项目根目录绝对路径 */
    this.projectRoot = path.resolve(projectRoot);

    /** @type {string} 状态目录名称 */
    this.stateDirName = options.stateDir || '.pdd-vm';

    /** @type {string} 状态目录完整路径 */
    this.stateDir = path.join(this.projectRoot, this.stateDirName);

    /** @type {string} 状态文件完整路径 */
    this.statePath = path.join(this.stateDir, STATE_FILENAME);

    /** @type {string} 备份目录路径 */
    this.backupDir = path.join(this.stateDir, 'backups');

    /** @type {boolean} 是否自动备份 */
    this.autoBackup = options.autoBackup !== false;

    /** @type {number} 最大备份数量 */
    this.maxBackups = options.maxBackups || MAX_BACKUPS;

    /** @type {boolean} 加载时是否验证 */
    this.validateOnLoad = options.validateOnLoad !== false;

    /** @type {boolean} 保存时是否验证 */
    this.validateOnSave = options.validateOnSave !== false;

    /** @type {Object|null} 内存中的状态缓存 */
    this._cache = null;

    /** @type {boolean} 缓存是否脏 */
    this._dirty = false;
  }

  /**
   * 确保状态目录存在
   * 如果不存在则创建
   * @returns {Promise<void>}
   * @private
   */
  async _ensureDir() {
    // 创建主状态目录
    if (!fs.existsSync(this.stateDir)) {
      await fs.promises.mkdir(this.stateDir, { recursive: true });
      console.log(chalk.gray(`[StateStore] 创建状态目录: ${this.stateDir}`));
    }

    // 创建备份目录
    if (!fs.existsSync(this.backupDir)) {
      await fs.promises.mkdir(this.backupDir, { recursive: true });
    }
  }

  /**
   * 创建当前状态的备份
   * @returns {Promise<string|null>} 备份文件路径，失败返回 null
   * @private
   */
  async _createBackup() {
    try {
      if (!fs.existsSync(this.statePath)) {
        return null; // 没有文件可备份
      }

      await this._ensureDir();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${STATE_FILENAME}.${timestamp}${BACKUP_EXT}`;
      const backupPath = path.join(this.backupDir, backupFileName);

      // 复制文件到备份位置
      await fs.promises.copyFile(this.statePath, backupPath);

      // 清理旧备份
      await this._cleanupOldBackups();

      console.log(chalk.gray(`[StateStore] 已创建备份: ${backupFileName}`));
      return backupPath;
    } catch (error) {
      console.error(chalk.red(`[StateStore] 备份失败: ${error.message}`));
      return null;
    }
  }

  /**
   * 清理超出数量限制的旧备份
   * @returns {Promise<void>}
   * @private
   */
  async _cleanupOldBackups() {
    try {
      const files = await fs.promises.readdir(this.backupDir);
      const backups = files
        .filter(f => f.endsWith(BACKUP_EXT))
        .map(f => ({
          name: f,
          path: path.join(this.backupDir, f),
          mtime: fs.statSync(path.join(this.backupDir, f)).mtimeMs
        }))
        .sort((a, b) => b.mtime - a.mtime); // 按修改时间降序

      // 删除超出的旧备份
      if (backups.length > this.maxBackups) {
        for (let i = this.maxBackups; i < backups.length; i++) {
          await fs.promises.unlink(backups[i].path).catch(() => {});
          console.log(chalk.gray(`[StateStore] 删除旧备份: ${backups[i].name}`));
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`[StateStore] 清理备份失败: ${error.message}`));
    }
  }

  /**
   * 原子写入文件
   * 先写入临时文件，然后重命名到目标位置
   * 这确保了在写入过程中不会产生损坏的文件
   *
   * @param {string} filePath - 目标文件路径
   * @param {string|Buffer} content - 要写入的内容
   * @returns {Promise<void>}
   * @private
   */
  async _atomicWrite(filePath, content) {
    const dir = path.dirname(filePath);
    await this._ensureDir();

    // 生成临时文件路径
    const tmpPath = `${filePath}.tmp.${Date.now()}`;

    try {
      // 写入临时文件
      await fs.promises.writeFile(tmpPath, content, 'utf-8');

      // 同步确保数据落盘
      await fs.promises.fsync(await fs.promises.open(tmpPath, 'r')).then(fd => fd.close()).catch(() => {});

      // 原子重命名（在大多数文件系统上是原子操作）
      await fs.promises.rename(tmpPath, filePath);
    } catch (error) {
      // 清理临时文件
      try {
        if (fs.existsSync(tmpPath)) {
          await fs.promises.unlink(tmpPath);
        }
      } catch (cleanupError) {
        // 忽略清理错误
      }
      throw error;
    }
  }

  /**
   * 加载项目状态
   * 从磁盘读取并解析 project-state.json
   *
   * @returns {Promise<Object>} 项目状态对象，包含 features 数组
   * @throws {Error} 当文件不存在或格式无效时抛出异常
   *
   * @example
   * const store = new StateStore('./my-project');
   * const state = await store.loadState();
   * console.log(state.project.features);
   */
  async loadState() {
    await this._ensureDir();

    // 检查文件是否存在
    if (!fs.existsSync(this.statePath)) {
      console.log(chalk.yellow(`[StateStore] 状态文件不存在: ${this.statePath}`));
      return createEmptyState(path.basename(this.projectRoot));
    }

    try {
      // 读取文件内容
      const rawContent = await fs.promises.readFile(this.statePath, 'utf-8');

      // 解析 JSON
      let stateData = JSON.parse(rawContent);

      // 版本迁移检查
      if (stateData.version && stateData.version !== SCHEMA_VERSION) {
        console.log(chalk.yellow(`[StateStore] 检测到版本差异: ${stateData.version} -> ${SCHEMA_VERSION}`));

        if (compareVersions(stateData.version, SCHEMA_VERSION) < 0) {
          // 需要升级
          try {
            stateData = migrate(stateData, stateData.version, SCHEMA_VERSION);
            console.log(chalk.green('[StateStore] 版本迁移完成'));
            // 迁移后自动保存
            await this._atomicWrite(this.statePath, JSON.stringify(stateData, null, 2));
          } catch (migrateError) {
            console.warn(chalk.yellow(`[StateStore] 自动迁移失败: ${migrateError.message}`));
          }
        }
      }

      // 验证数据
      if (this.validateOnLoad) {
        const validation = validate(stateData);
        if (!validation.valid) {
          console.warn(chalk.yellow(`[StateStore] 数据验证警告 (${validation.errors.length} 个问题):`));
          validation.errors.slice(0, 3).forEach(err => {
            console.warn(chalk.yellow(`  - ${err.path}: ${err.message}`));
          });
        }
      }

      // 更新缓存
      this._cache = stateData;
      this._dirty = false;

      return stateData;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`[StateStore] JSON 解析失败: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 保存项目状态
   * 使用原子写入方式保存状态到磁盘
   *
   * @param {Object} state - 项目状态对象
   * @returns {Promise<void>}
   * @throws {Error} 当验证失败或写入失败时抛出异常
   *
   * @example
   * await store.saveState({
   *   version: '1.0.0',
   *   project: { name: 'MyProject', features: [...] },
   *   metadata: { ... }
   * });
   */
  async saveState(state) {
    if (!state || typeof state !== 'object') {
      throw new Error('saveState: state 必须是有效的对象');
    }

    // 保存前验证
    if (this.validateOnSave) {
      const validation = validate(state);
      if (!validation.valid) {
        const errorMessages = validation.errors.map(e => `${e.path}: ${e.message}`).join('; ');
        throw new Error(`saveState: 数据验证失败 - ${errorMessages}`);
      }
    }

    // 更新元数据时间戳
    if (state.metadata) {
      state.metadata.lastUpdated = Date.now();
    }

    // 序列化 JSON（美化输出）
    const jsonContent = JSON.stringify(state, null, 2);

    // 创建备份
    if (this.autoBackup && fs.existsSync(this.statePath)) {
      await this._createBackup();
    }

    // 原子写入
    await this._atomicWrite(this.statePath, jsonContent);

    // 更新缓存
    this._cache = state;
    this._dirty = false;

    console.log(chalk.green(`[StateStore] 状态已保存: ${this.statePath}`));
  }

  /**
   * 获取状态文件路径
   * @returns {string} 状态文件的绝对路径
   */
  getStatePath() {
    return this.statePath;
  }

  /**
   * 获取项目汇总信息
   * @returns {Promise<ProjectSummary>} 项目汇总对象
   */
  async getProject() {
    const state = await this.loadState();
    const features = (state.project.features || []).map(
      f => Feature.fromJSON(f)
    );
    return ProjectSummary.fromFeatures(features, state.project.name, state.project.version);
  }

  /**
   * 根据 ID 获取功能点
   * @param {string} id - 功能点 ID
   * @returns {Promise<Feature|null>} Feature 对象或 null
   */
  async getFeatureById(id) {
    const state = await this.loadState();
    const featureData = (state.project.features || []).find(f => f.id === id);

    if (!featureData) {
      return null;
    }

    return Feature.fromJSON(featureData);
  }

  /**
   * 根据阶段获取功能点列表
   * @param {string} stage - 开发阶段
   * @returns {Promise<Feature[]>} 符合条件的 Feature 数组
   */
  async getFeaturesByStage(stage) {
    const state = await this.loadState();
    const features = (state.project.features || [])
      .filter(f => f.stage === stage)
      .map(f => Feature.fromJSON(f));
    return features;
  }

  /**
   * 更新指定功能点
   * 使用合并策略更新，只修改传入的字段
   *
   * @param {string} id - 功能点 ID
   * @param {Object} updates - 要更新的字段
   * @returns {Promise<Feature>} 更新后的 Feature 对象
   * @throws {Error} 当功能点不存在时抛出异常
   *
   * @example
   * const updated = await store.updateFeature('feat-001', {
   *   stage: 'implementing',
   *   priority: 'P1'
   * });
   */
  async updateFeature(id, updates) {
    const state = await this.loadState();
    const featureIndex = (state.project.features || []).findIndex(f => f.id === id);

    if (featureIndex === -1) {
      throw new Error(`updateFeature: 找不到 ID 为 "${id}" 的功能点`);
    }

    // 合并更新
    const existing = state.project.features[featureIndex];
    const merged = {
      ...existing,
      ...updates,
      updatedAt: Date.now()
    };

    // 特殊处理嵌套对象的深度合并
    if (updates.tokens && typeof updates.tokens === 'object') {
      merged.tokens = { ...existing.tokens, ...updates.tokens };
    }
    if (updates.quality && typeof updates.quality === 'object') {
      merged.quality = { ...(existing.quality || {}), ...updates.quality };
    }
    if (Array.isArray(updates.tags)) {
      merged.tags = updates.tags;
    }
    if (Array.isArray(updates.artifacts)) {
      merged.artifacts = updates.artifacts;
    }

    state.project.features[featureIndex] = merged;

    // 保存状态
    await this.saveState(state);

    return Feature.fromJSON(merged);
  }

  /**
   * 批量更新多个功能点
   * @param {Array<{id:string, updates:Object}>} updateList - 更新列表
   * @returns {Promise<Feature[]>} 更新后的 Feature 数组
   */
  async batchUpdate(updateList) {
    if (!Array.isArray(updateList) || updateList.length === 0) {
      return [];
    }

    const state = await this.loadState();
    const results = [];

    for (const { id, updates } of updateList) {
      const index = (state.project.features || []).findIndex(f => f.id === id);

      if (index !== -1) {
        const existing = state.project.features[index];
        const merged = {
          ...existing,
          ...updates,
          updatedAt: Date.now()
        };

        // 深度合并特殊字段
        if (updates.tokens && typeof updates.tokens === 'object') {
          merged.tokens = { ...existing.tokens, ...updates.tokens };
        }
        if (updates.quality && typeof updates.quality === 'object') {
          merged.quality = { ...(existing.quality || {}), ...updates.quality };
        }

        state.project.features[index] = merged;
        results.push(Feature.fromJSON(merged));
      } else {
        console.warn(chalk.yellow(`[batchUpdate] 找不到功能点: ${id}`));
      }
    }

    // 统一保存一次
    await this.saveState(state);

    return results;
  }

  /**
   * 添加新功能点
   * @param {Object|Feature} featureData - 功能点数据或 Feature 实例
   * @returns {Promise<Feature>} 新创建的 Feature 对象
   * @throws {Error} 当 ID 已存在时抛出异常
   */
  async addFeature(featureData) {
    const state = await this.loadState();

    // 确保 features 数组存在
    if (!state.project.features) {
      state.project.features = [];
    }

    // 处理输入：如果是 Feature 实例则序列化
    const data = featureData instanceof Feature ? featureData.toJSON() : featureData;

    // 检查 ID 是否重复
    const exists = state.project.features.some(f => f.id === data.id);
    if (exists) {
      throw new Error(`addFeature: 功能点 ID "${data.id}" 已存在`);
    }

    // 设置默认值
    const now = Date.now();
    const newFeature = {
      id: data.id,
      name: data.name,
      description: data.description || '',
      stage: data.stage || 'prd',
      priority: data.priority || 'P2',
      timeline: data.timeline || [],
      artifacts: data.artifacts || [],
      quality: data.quality || null,
      tokens: data.tokens || { total: 0, used: 0, remaining: 0, byStage: {}, history: [] },
      iterations: data.iterations || [],
      tags: data.tags || [],
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now
    };

    state.project.features.push(newFeature);

    // 保存
    await this.saveState(state);

    console.log(chalk.green(`[StateStore] 已添加功能点: ${data.id} - ${data.name}`));

    return Feature.fromJSON(newFeature);
  }

  /**
   * 删除指定功能点
   * @param {string} id - 功能点 ID
   * @returns {Promise<boolean>} 是否成功删除
   */
  async removeFeature(id) {
    const state = await this.loadState();
    const initialLength = (state.project.features || []).length;

    // 过滤掉要删除的功能点
    state.project.features = (state.project.features || []).filter(f => f.id !== id);

    const removed = state.project.features.length < initialLength;

    if (removed) {
      await this.saveState(state);
      console.log(chalk.green(`[StateStore] 已删除功能点: ${id}`));
    } else {
      console.warn(chalk.yellow(`[StateStore] 未找到要删除的功能点: ${id}`));
    }

    return removed;
  }

  /**
   * 获取所有功能点
   * @returns {Promise<Feature[]>} 所有功能点数组
   */
  async getAllFeatures() {
    const state = await this.loadState();
    return (state.project.features || []).map(f => Feature.fromJSON(f));
  }

  /**
   * 根据标签搜索功能点
   * @param {string} tag - 标签名
   * @returns {Promise<Feature[]>} 匹配的功能点数组
   */
  async getFeaturesByTag(tag) {
    const state = await this.loadState();
    return (state.project.features || [])
      .filter(f => Array.isArray(f.tags) && f.tags.includes(tag))
      .map(f => Feature.fromJSON(f));
  }

  /**
   * 根据优先级获取功能点
   * @param {string} priority - 优先级 (P0/P1/P2/P3)
   * @returns {Promise<Feature[]>} 匹配的功能点数组
   */
  async getFeaturesByPriority(priority) {
    const state = await this.loadState();
    return (state.project.features || [])
      .filter(f => f.priority === priority)
      .map(f => Feature.fromJSON(f));
  }

  /**
   * 获取统计摘要（不加载完整状态）
   * 快速获取基本信息用于显示
   * @returns {Promise<{totalFeatures:number, lastUpdated:number|null}>} 统计信息
   */
  async getQuickStats() {
    try {
      if (!fs.existsSync(this.statePath)) {
        return { totalFeatures: 0, lastUpdated: null };
      }

      const content = await fs.promises.readFile(this.statePath, 'utf-8');
      const state = JSON.parse(content);

      return {
        totalFeatures: (state.project?.features || []).length,
        lastUpdated: state.metadata?.lastUpdated || null
      };
    } catch (error) {
      return { totalFeatures: 0, lastUpdated: null };
    }
  }

  /**
   * 列出可用的备份文件
   * @returns {Promise<Array<{name:string,path:string,size:number,time:Date}>>} 备份文件列表
   */
  async listBackups() {
    try {
      if (!fs.existsSync(this.backupDir)) {
        return [];
      }

      const files = await fs.promises.readdir(this.backupDir);
      const backups = files
        .filter(f => f.endsWith(BACKUP_EXT))
        .map(f => {
          const filePath = path.join(this.backupDir, f);
          const stat = fs.statSync(filePath);
          return {
            name: f,
            path: filePath,
            size: stat.size,
            time: stat.mtime
          };
        })
        .sort((a, b) => b.time - a.time);

      return backups;
    } catch (error) {
      console.warn(chalk.yellow(`[listBackups] 读取备份目录失败: ${error.message}`));
      return [];
    }
  }

  /**
   * 从备份恢复状态
   * @param {string} backupName - 备份文件名
   * @returns {Promise<boolean>} 是否恢复成功
   */
  async restoreFromBackup(backupName) {
    const backupPath = path.join(this.backupDir, backupName);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`restoreFromBackup: 备份文件不存在: ${backupName}`);
    }

    // 先备份当前状态
    if (fs.existsSync(this.statePath)) {
      await this._createBackup();
    }

    // 从备份恢复
    await fs.promises.copyFile(backupPath, this.statePath);

    // 清除缓存
    this._cache = null;

    console.log(chalk.green(`[StateStore] 已从备份恢复: ${backupName}`));

    return true;
  }

  /**
   * 重置状态（清空所有功能点）
   * @param {string} [projectName] - 项目名称（可选）
   * @returns {Promise<void>}
   */
  async resetState(projectName) {
    const name = projectName || path.basename(this.projectRoot);
    const emptyState = createEmptyState(name);

    // 先备份当前状态
    if (fs.existsSync(this.statePath)) {
      await this._createBackup();
    }

    await this.saveState(emptyState);

    console.log(chalk.yellow('[StateStore] 状态已重置'));
  }
}

/**
 * 版本比较函数（内部使用）
 * @param {string} v1 - 版本1
 * @param {string} v2 - 版本2
 * @returns {number} 比较结果
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }

  return 0;
}

/**
 * 导出默认对象
 */
export default StateStore;
