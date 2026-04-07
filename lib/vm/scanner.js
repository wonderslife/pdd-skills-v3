/**
 * PDD Visual Manager - 项目扫描引擎
 *
 * 扫描项目目录结构，发现和解析各种制品文件：
 * - dev-specs/ 目录：规格文件 (.md, .json)
 * - src/ 或 outputDir/：源代码文件
 * - reports/：验证报告
 * - PRD 文件：.prdx 格式
 *
 * 根据扫描结果推断功能点的当前阶段
 *
 * @module vm/scanner
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

import { StageEnum, STAGE_VALUES, STAGE_ORDER, Priority, ArtifactType } from './models.js';

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
 * 默认扫描配置
 * @type {Object}
 */
const DEFAULT_CONFIG = {
  specDir: 'dev-specs',
  codeDir: './src',
  outputDir: './generated',
  reportDir: './reports',
  prdFile: null, // 自动查找
  supportedSpecExtensions: ['.md', '.json', '.yaml', '.yml'],
  supportedCodeExtensions: [
    '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte',
    '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h',
    '.sql', '.html', '.css', '.scss', '.less'
  ],
  maxDepth: 10,
  ignorePatterns: ['node_modules', '.git', '__pycache__', 'dist', 'build', '.cache']
};

/**
 * 规格扫描结果
 * @typedef {Object} SpecScanResult
 * @property {string} dir - 扫描的目录
 * @property {boolean} exists - 目录是否存在
 * @property {Array<SpecFile>} files - 发现的规格文件列表
 * @property {number} totalCount - 文件总数
 * @property {number} totalSize - 总大小（字节）
 */

/**
 * 规格文件信息
 * @typedef {Object} SpecFile
 * @property {string} path - 文件相对路径
 * @property {string} absolutePath - 绝对路径
 * @property {string} extension - 文件扩展名
 * @property {number} size - 文件大小（字节）
 * @property {Date} lastModified - 最后修改时间
 * @property {Object|null} parsed - 解析后的内容
 * @property {string|null} featureId - 关联的功能点 ID
 * @property {string|null} featureName - 功能点名称
 * @property {string|null} priority - 优先级
 * @property {string[]} acceptanceCriteria - 验收标准
 */

/**
 * 源代码扫描结果
 * @typedef {Object} SourceCodeScanResult
 * @property {string} dir - 扫描的目录
 * @property {boolean} exists - 目录是否存在
 * @property {number} fileCount - 文件数
 * @property {number} totalLOC - 总代码行数
 * @property {Object<string,number>} languageDistribution - 语言分布统计
 * @property {Array<CodeFile>} files - 文件列表
 * @property {Date} lastModified - 最后修改时间
 */

/**
 * 代码文件信息
 * @typedef {Object} CodeFile
 * @property {string} path - 文件相对路径
 * @property {string} absolutePath - 绝对路径
 * @property {string} language - 编程语言
 * @property {number} lines - 代码行数
 * @property {number} size - 文件大小（字节）
 * @property {Date} lastModified - 最后修改时间
 * @property {string|null} featureId - 可能关联的功能点 ID
 */

/**
 * 报告扫描结果
 * @typedef {Object} ReportScanResult
 * @property {string} dir - 报告目录
 * @property {boolean} exists - 是否存在
 * @property {Array<ReportFile>} reports - 报告文件列表
 * @property {Object} summary - 汇总统计
 */

/**
 * PRD 扫描结果
 * @typedef {Object} PRDScanResult
 * @property {string|null} path - PRD 文件路径
 * @property {boolean} found - 是否找到
 * @property {Object|null} content - 解析内容
 * @property {string} projectName - 项目名称
 * @property {Array<Object>} features - 功能点摘要列表
 */

/**
 * 项目扫描器类
 * 负责扫描项目目录，收集制品信息和元数据
 */
export class ProjectScanner {
  /**
   * 创建项目扫描器实例
   * @param {string} projectRoot - 项目根目录
   * @param {Object} [config={}] - 扫描配置
   */
  constructor(projectRoot, config = {}) {
    if (!projectRoot || typeof projectRoot !== 'string') {
      throw new Error('ProjectScanner: projectRoot 必须是非空字符串');
    }

    /** @type {string} 项目根目录绝对路径 */
    this.projectRoot = path.resolve(projectRoot);

    /** @type {Object} 合并后的配置 */
    this.config = { ...DEFAULT_CONFIG, ...config };

    /** @type {Map<string, Object>} 缓存的扫描结果 */
    this._cache = new Map();

    /** @type {number} 缓存过期时间（毫秒） */
    this._cacheTTL = config.cacheTTL || 30000; // 默认30秒

    console.log(chalk.gray(`[Scanner] 初始化项目扫描器: ${this.projectRoot}`));
  }

  /**
   * 检查路径是否应被忽略
   * @param {string} filePath - 文件路径
   * @returns {boolean} 是否忽略
   * @private
   */
  _shouldIgnore(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    return this.config.ignorePatterns.some(pattern =>
      normalized.includes(pattern) || normalized.endsWith(`/${pattern}`)
    );
  }

  /**
   * 根据扩展名检测编程语言
   * @param {string} ext - 文件扩展名
   * @returns {string} 语言名称
   * @private
   */
  _detectLanguage(ext) {
    const langMap = {
      '.js': 'JavaScript', '.jsx': 'JavaScript (JSX)',
      '.ts': 'TypeScript', '.tsx': 'TypeScript (TSX)',
      '.vue': 'Vue', '.svelte': 'Svelte',
      '.py': 'Python', '.java': 'Java',
      '.go': 'Go', '.rs': 'Rust',
      '.c': 'C', '.cpp': 'C++', '.h': 'C/C++ Header',
      '.sql': 'SQL', '.html': 'HTML',
      '.css': 'CSS', '.scss': 'SCSS', '.less': 'Less'
    };
    return langMap[ext.toLowerCase()] || 'Unknown';
  }

  /**
   * 计算文件行数（非空行）
   * @param {string} content - 文件内容
   * @returns {{total:number, code:number, blank:number, comment:number}} 行数统计
   * @private
   */
  _countLines(content) {
    const lines = content.split('\n');
    let codeLines = 0;
    let blankLines = 0;
    let commentLines = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') {
        blankLines++;
      } else if (trimmed.startsWith('//') || trimmed.startsWith('#') ||
                 trimmed.startsWith('/*') || trimmed.startsWith('*') ||
                 trimmed.startsWith('--') || trimmed.startsWith(';')) {
        commentLines++;
      } else {
        codeLines++;
      }
    }

    return {
      total: lines.length,
      code: codeLines,
      blank: blankLines,
      comment: commentLines
    };
  }

  /**
   * 解析规格文件内容
   * 提取功能点名称、描述、优先级、验收标准等信息
   *
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   * @returns {Object} 解析结果
   * @private
   */
  _parseSpecContent(filePath, content) {
    const ext = path.extname(filePath).toLowerCase();
    const result = {
      featureId: null,
      featureName: null,
      description: '',
      priority: null,
      acceptanceCriteria: [],
      stage: null,
      rawContent: content.substring(0, 500) // 保存前500字符用于预览
    };

    try {
      if (ext === '.json') {
        // JSON 格式规格
        const json = JSON.parse(content);
        result.featureId = json.id || json.featureId || path.basename(filePath, ext);
        result.featureName = json.name || json.title || json.featureName;
        result.description = json.description || json.desc || '';
        result.priority = json.priority || null;
        result.acceptanceCriteria = Array.isArray(json.acceptanceCriteria)
          ? json.acceptanceCriteria
          : (Array.isArray(json.criteria) ? json.criteria : []);
        result.stage = json.stage || null;
      } else if (ext === '.md') {
        // Markdown 格式规格
        // 提取标题（第一个 # 开头的行）
        const titleMatch = content.match(/^#\s+(.+)$/m);
        if (titleMatch) {
          result.featureName = titleMatch[1].trim();
        }

        // 提取 ID（通常在标题后或 frontmatter 中）
        const idMatch = content.match(/(?:ID|Feature[- ]?ID|id)[:\s]*([a-zA-Z0-9_-]+)/i);
        if (idMatch) {
          result.featureId = idMatch[1].trim();
        }

        // 提取优先级
        const priorityMatch = content.match(/(?:Priority|优先级)[:\s]*(P[0-3])/i);
        if (priorityMatch) {
          result.priority = priorityMatch[1];
        }

        // 提取验收标准（通常是 ## Acceptance Criteria 或 ## 验收标准 下的列表）
        const criteriaSection = content.match(
          /(?:##?\s*(?:Acceptance\s*Criteria|验收标准|AC)[\s\S]*?)(?=##|\Z)/i
        );
        if (criteriaSection) {
          const items = criteriaSection[1].match(/^\s*[-*+]\s+.+$/gm);
          if (items) {
            result.acceptanceCriteria = items.map(item =>
              item.replace(/^\s*[-*+]\s*/, '').trim()
            );
          }
        }

        // 提取描述（标题后的第一段）
        const descMatch = content.match(/^#\s+.+\n\n([\s\S]+?)(?:\n##|\n---|\Z)/);
        if (descMatch) {
          result.description = descMatch[1].trim().substring(0, 1000);
        }

        // 如果没有提取到 ID，使用文件名
        if (!result.featureId) {
          result.featureId = path.basename(filePath, ext);
        }
      } else if (ext === '.yaml' || ext === '.yml') {
        // YAML 格式（简化处理）
        const idMatch = content.match(/id[:\s]+([a-zA-Z0-9_-]+)/i);
        const nameMatch = content.match(/name[:\s]+["']?(.+?)["']?\s*$/m);
        const priorityMatch = content.match(/priority[:\s]*(P[0-3])/i);

        result.featureId = idMatch ? idMatch[1] : path.basename(filePath, ext);
        result.featureName = nameMatch ? nameMatch[1].trim() : null;
        result.priority = priorityMatch ? priorityMatch[1] : null;
      }
    } catch (error) {
      console.warn(chalk.yellow(`[Scanner] 解析规格文件失败 ${filePath}: ${error.message}`));
    }

    return result;
  }

  /**
   * 扫描规格文件目录
   * 默认扫描 dev-specs/ 目录，解析 .md/.json/.yaml 规格文件
   *
   * @param {string} [dir] - 要扫描的目录（默认使用配置中的 specDir）
   * @returns {Promise<SpecScanResult>} 扫描结果
   */
  async scanSpecs(dir) {
    const specDir = dir || this.config.specDir;
    const absDir = path.isAbsolute(specDir) ? specDir : path.join(this.projectRoot, specDir);

    const result = {
      dir: specDir,
      exists: false,
      files: [],
      totalCount: 0,
      totalSize: 0
    };

    try {
      // 检查目录是否存在
      if (!fs.existsSync(absDir)) {
        console.log(chalk.yellow(`[Scanner] 规格目录不存在: ${absDir}`));
        return result;
      }

      result.exists = true;

      // 递归扫描目录
      const scanDir = async (currentDir, depth = 0) => {
        if (depth > this.config.maxDepth) return;

        const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          const relPath = path.relative(absDir, fullPath);

          if (entry.isDirectory()) {
            if (!this._shouldIgnore(relPath)) {
              await scanDir(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();

            if (this.config.supportedSpecExtensions.includes(ext)) {
              try {
                const stat = await fs.promises.stat(fullPath);
                const content = await fs.promises.readFile(fullPath, 'utf-8');

                const fileInfo = {
                  path: relPath,
                  absolutePath: fullPath,
                  extension: ext,
                  size: stat.size,
                  lastModified: stat.mtime,
                  parsed: this._parseSpecContent(fullPath, content),
                  checksum: crypto.createHash('sha256').update(content).digest('hex').substring(0, 16)
                };

                result.files.push(fileInfo);
                result.totalCount++;
                result.totalSize += stat.size;
              } catch (fileError) {
                console.warn(chalk.yellow(`[Scanner] 读取规格文件失败: ${relPath} - ${fileError.message}`));
              }
            }
          }
        }
      };

      await scanDir(absDir);

      console.log(chalk.green(
        `[Scanner] 规格扫描完成: ${result.totalCount} 个文件, ${(result.totalSize / 1024).toFixed(1)} KB`
      ));

    } catch (error) {
      console.error(chalk.red(`[Scanner] 规格扫描错误: ${error.message}`));
    }

    return result;
  }

  /**
   * 扫描源代码目录
   * 默认扫描 src/ 或 outputDir/
   * 统计文件数、总 LOC、语言分布等
   *
   * @param {string} [dir] - 要扫描的目录
   * @returns {Promise<SourceCodeScanResult>} 扫描结果
   */
  async scanSourceCode(dir) {
    // 尝试多个可能的代码目录
    const dirsToCheck = dir ? [dir] : [
      this.config.codeDir,
      this.config.outputDir,
      './src',
      './lib',
      './generated'
    ];

    let targetDir = null;
    for (const d of dirsToCheck) {
      const absPath = path.isAbsolute(d) ? d : path.join(this.projectRoot, d);
      if (fs.existsSync(absPath)) {
        targetDir = absPath;
        break;
      }
    }

    const result = {
      dir: dir || targetDir ? path.relative(this.projectRoot, targetDir) : '',
      exists: !!targetDir,
      fileCount: 0,
      totalLOC: 0,
      languageDistribution: {},
      files: [],
      lastModified: null
    };

    if (!targetDir) {
      console.log(chalk.yellow('[Scanner] 未找到源代码目录'));
      return result;
    }

    try {
      let latestMtime = 0;

      const scanDir = async (currentDir, depth = 0) => {
        if (depth > this.config.maxDepth) return;

        const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          const relPath = path.relative(targetDir, fullPath);

          if (entry.isDirectory()) {
            if (!this._shouldIgnore(relPath)) {
              await scanDir(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();

            if (this.config.supportedCodeExtensions.includes(ext)) {
              try {
                const stat = await fs.promises.stat(fullPath);
                const content = await fs.promises.readFile(fullPath, 'utf-8');
                const lineStats = this._countLines(content);
                const language = this._detectLanguage(ext);

                // 更新最新修改时间
                if (stat.mtimeMs > latestMtime) {
                  latestMtime = stat.mtimeMs;
                }

                // 从文件路径推断可能的功能点 ID
                const possibleFeatureId = this._inferFeatureIdFromPath(relPath);

                const fileData = {
                  path: relPath,
                  absolutePath: fullPath,
                  language,
                  lines: lineStats.code,
                  totalLines: lineStats.total,
                  size: stat.size,
                  lastModified: stat.mtime,
                  featureId: possibleFeatureId
                };

                result.files.push(fileData);
                result.fileCount++;
                result.totalLOC += lineStats.code;

                // 统计语言分布
                if (!result.languageDistribution[language]) {
                  result.languageDistribution[language] = { count: 0, loc: 0, size: 0 };
                }
                result.languageDistribution[language].count++;
                result.languageDistribution[language].loc += lineStats.code;
                result.languageDistribution[language].size += stat.size;
              } catch (fileError) {
                console.warn(chalk.yellow(`[Scanner] 读取代码文件失败: ${relPath}`));
              }
            }
          }
        }
      };

      await scanDir(targetDir);

      result.lastModified = latestMtime > 0 ? new Date(latestMtime) : null;

      console.log(chalk.green(
        `[Scanner] 代码扫描完成: ${result.fileCount} 个文件, ${result.totalLOC} LOC`
      ));

    } catch (error) {
      console.error(chalk.red(`[Scanner] 代码扫描错误: ${error.message}`));
    }

    return result;
  }

  /**
   * 从文件路径推断功能点 ID
   * @param {string} filePath - 文件相对路径
   * @returns {string|null} 推断的功能点 ID
   * @private
   */
  _inferFeatureIdFromPath(filePath) {
    // 常见的命名模式：
    // - feat-xxx/file.js -> feat-xxx
    // - xxx/feature-name.js -> feature-name
    // - features/feat-001-xxx/index.js -> feat-001

    const parts = filePath.split(/[/\\]/);
    const fileName = parts[parts.length - 1];

    // 检查是否匹配 feat-xxx 格式
    const featMatch = parts.find(p => /^feat-[a-zA-Z0-9_-]+$/.test(p));
    if (featMatch) return featMatch;

    // 检查父目录名
    if (parts.length > 1 && /^[a-z][a-z0-9-]*$/.test(parts[0])) {
      return parts[0];
    }

    return null;
  }

  /**
   * 扫描报告目录
   * 默认扫描 reports/ 目录
   * 解析验证报告 JSON、覆盖率报告等
   *
   * @param {string} [dir] - 报告目录
   * @returns {Promise<ReportScanResult>} 扫描结果
   */
  async scanReports(dir) {
    const reportDir = dir || this.config.reportDir;
    const absDir = path.isAbsolute(reportDir) ? reportDir : path.join(this.projectRoot, reportDir);

    const result = {
      dir: reportDir,
      exists: false,
      reports: [],
      summary: {
        totalReports: 0,
        verificationReports: [],
        coverageReports: [],
        otherReports: []
      }
    };

    try {
      if (!fs.existsSync(absDir)) {
        console.log(chalk.yellow(`[Scanner] 报告目录不存在: ${absDir}`));
        return result;
      }

      result.exists = true;
      const entries = await fs.promises.readdir(absDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isFile()) continue;

        const filePath = path.join(absDir, entry.name);
        const ext = path.extname(entry.name).toLowerCase();
        const stat = await fs.promises.stat(filePath);

        const reportInfo = {
          name: entry.name,
          path: path.relative(this.projectRoot, filePath),
          absolutePath: filePath,
          type: this._classifyReport(entry.name),
          size: stat.size,
          lastModified: stat.mtime,
          parsed: null
        };

        // 尝试解析 JSON 报告
        if (ext === '.json') {
          try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            reportInfo.parsed = JSON.parse(content);
          } catch (e) {
            // 忽略解析错误
          }
        }

        result.reports.push(reportInfo);
        result.summary.totalReports++;

        // 分类统计
        switch (reportInfo.type) {
          case 'verification':
            result.summary.verificationReports.push(reportInfo);
            break;
          case 'coverage':
            result.summary.coverageReports.push(reportInfo);
            break;
          default:
            result.summary.otherReports.push(reportInfo);
        }
      }

      console.log(chalk.green(
        `[Scanner] 报告扫描完成: ${result.summary.totalReports} 个报告`
      ));

    } catch (error) {
      console.error(chalk.red(`[Scanner] 报告扫描错误: ${error.message}`));
    }

    return result;
  }

  /**
   * 分类报告类型
   * @param {string} fileName - 文件名
   * @returns {string} 报告类型
   * @private
   */
  _classifyReport(fileName) {
    const lower = fileName.toLowerCase();

    if (lower.includes('verify') || lower.includes('validation') || lower.includes('check')) {
      return 'verification';
    }
    if (lower.includes('coverage') || lower.includes('cov') || lower.includes('test-result')) {
      return 'coverage';
    }
    if (lower.includes('quality') || lower.includes('lint') || lower.includes('audit')) {
      return 'quality';
    }

    return 'other';
  }

  /**
   * 扫描 PRD 文件
   * 支持 .prdx 和 .prd 格式
   * 提取项目名、功能点列表摘要
   *
   * @param {string} [prdPath] - PRD 文件路径
   * @returns {Promise<PRDScanResult>} 扫描结果
   */
  async scanPRD(prdPath) {
    // 可能的 PRD 文件位置
    const candidates = prdPath ? [prdPath] : [
      'PRD.prdx',
      'prd.prdx',
      'docs/PRD.prdx',
      'docs/prd.prdx',
      '.pdd-prd.json',
      'config/prd.json'
    ];

    let foundPath = null;

    for (const candidate of candidates) {
      const absPath = path.isAbsolute(candidate) ? candidate : path.join(this.projectRoot, candidate);
      if (fs.existsSync(absPath)) {
        foundPath = absPath;
        break;
      }
    }

    const result = {
      path: foundPath ? path.relative(this.projectRoot, foundPath) : null,
      found: !!foundPath,
      content: null,
      projectName: '',
      features: []
    };

    if (!foundPath) {
      console.log(chalk.yellow('[Scanner] 未找到 PRD 文件'));
      return result;
    }

    try {
      const content = await fs.promises.readFile(foundPath, 'utf-8');
      const ext = path.extname(foundPath).toLowerCase();

      if (ext === '.json' || ext === '.prdx') {
        // JSON 格式 PRD
        try {
          const prd = JSON.parse(content);
          result.content = prd;
          result.projectName = prd.project?.name || prd.name || prd.projectName || '';
          result.features = Array.isArray(prd.features)
            ? prd.features.map(f => ({
                id: f.id || f.featureId,
                name: f.name || f.title,
                description: f.description || f.desc?.substring(0, 200),
                priority: f.priority || 'P2',
                status: f.status || f.stage || 'prd'
              }))
            : [];
        } catch (parseError) {
          console.warn(chalk.yellow(`[Scanner] PRD JSON 解析失败: ${parseError.message}`));
        }
      } else if (ext === '.md' || ext === '.prd') {
        // Markdown 格式 PRD
        result.content = { raw: content };

        // 提取项目名
        const titleMatch = content.match(/^#\s+(.+)$/m);
        if (titleMatch) {
          result.projectName = titleMatch[1].trim();
        }

        // 提取功能点列表（通常是 ## Features 或 ## 功能点 部分）
        const featuresSection = content.match(
          /(?:##\s*(?:Features|功能点|Feature\s*List)[\s\S]*?)(?=##[^#]|\Z)/i
        );

        if (featuresSection) {
          // 匹配功能点条目
          const featureItems = featuresSection[0].matchAll(
            /^\s*(?:[-*+]|\d+[.)])\s+(.+?)(?:\n|$)/gm
          );

          for (const match of featureItems) {
            const text = match[1].trim();
            // 尝试从文本中解析 ID 和名称
            const idMatch = text.match(/\(([a-zA-Z0-9_-]+)\)|\[([a-zA-Z0-9_-]+)\]/);
            const name = text.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();

            result.features.push({
              id: idMatch ? (idMatch[1] || idMatch[2]) : `feature-${result.features.length + 1}`,
              name: name || text,
              description: '',
              priority: 'P2',
              status: 'prd'
            });
          }
        }
      }

      console.log(chalk.green(
        `[Scanner] PRD 扫描完成: ${result.projectName || '(未命名)'}, ${result.features.length} 个功能点`
      ));

    } catch (error) {
      console.error(chalk.red(`[Scanner] PRD 扫描错误: ${error.message}`));
    }

    return result;
  }

  /**
   * 推断指定功能点的当前阶段
   * 根据制品存在情况推断开发阶段
   *
   * 推断规则：
   * - 有 PRD 无 spec → prd
   * - 有 spec 无 code → extracted/spec
   * - 有 code 在生成中 → implementing
   * - 有验证报告 → verifying/done
   *
   * @param {string} featureId - 功能点 ID
   * @returns {Promise<string>} 推断的阶段值 (StageEnum)
   */
  async inferFeatureStage(featureId) {
    if (!featureId) {
      return StageEnum.PRD;
    }

    // 收集各类型的制品存在情况
    const artifacts = {
      hasPRD: false,
      hasSpec: false,
      hasCode: false,
      hasTest: false,
      hasReport: false,
      isImplementing: false
    };

    try {
      // 1. 检查是否有对应的规格文件
      const specs = await this.scanSpecs();
      artifacts.hasSpec = specs.files.some(f =>
        f.parsed?.featureId === featureId ||
        f.path.toLowerCase().includes(featureId.toLowerCase())
      );

      // 2. 检查是否有对应的代码文件
      const sourceCode = await this.scanSourceCode();
      artifacts.hasCode = sourceCode.files.some(f =>
        f.featureId === featureId ||
        f.path.toLowerCase().includes(featureId.toLowerCase())
      );

      // 检查是否有正在生成的标记
      artifacts.isImplementing = sourceCode.files.some(f => {
        // 查找 .generating 或 .tmp 文件
        return f.path.includes('.generating') || f.path.includes('.tmp');
      }) || this._hasGeneratingMarker(featureId);

      // 3. 检查是否有测试文件
      artifacts.hasTest = sourceCode.files.some(f =>
        (f.path.includes('.test.') || f.path.includes('.spec.') || f.path.includes('__tests__')) &&
        (f.featureId === featureId || f.path.toLowerCase().includes(featureId.toLowerCase()))
      );

      // 4. 检查是否有验证报告
      const reports = await this.scanReports();
      artifacts.hasReport = reports.reports.some(r => {
        if (r.parsed && typeof r.parsed === 'object') {
          // 检查报告中是否包含该功能点的信息
          const strContent = JSON.stringify(r.parsed);
          return strContent.includes(featureId);
        }
        return r.path.toLowerCase().includes(featureId.toLowerCase());
      });

      // 5. 检查 PRD 中是否有记录
      const prd = await this.scanPRD();
      artifacts.hasPRD = prd.features.some(f => f.id === featureId);

    } catch (error) {
      console.warn(chalk.yellow(`[Scanner] 推断阶段时出错: ${error.message}`));
    }

    // 根据制品情况推断阶段
    return this._determineStageFromArtifacts(artifacts);
  }

  /**
   * 检查是否有正在生成的标记文件
   * @param {string} featureId - 功能点 ID
   * @returns {boolean} 是否有标记
   * @private
   */
  _hasGeneratingMarker(featureId) {
    const markerPaths = [
      path.join(this.projectRoot, '.pdd-generating', `${featureId}.flag`),
      path.join(this.projectRoot, '.pdd-vm', 'generating', `${featureId}.json`)
    ];

    return markerPaths.some(p => fs.existsSync(p));
  }

  /**
   * 根据制品情况确定阶段
   * @param {Object} artifacts - 制品状态
   * @returns {string} 阶段值
   * @private
   */
  _determineStageFromArtifacts(artifacts) {
    // 最高优先级检查：有验证报告
    if (artifacts.hasReport) {
      // 如果同时有高质量评分，可能是 done
      return StageEnum.VERIFYING; // 默认返回 verifying，需要更多信息才能判断 done
    }

    // 正在实现中
    if (artifacts.isImplementing || (artifacts.hasCode && !artifacts.hasTest)) {
      return StageEnum.IMPLEMENTING;
    }

    // 有代码和测试
    if (artifacts.hasCode && artifacts.hasTest) {
      return StageEnum.VERIFYING;
    }

    // 只有规格
    if (artifacts.hasSpec && !artifacts.hasCode) {
      return StageEnum.SPEC;
    }

    // 只有 PRD
    if (artifacts.hasPRD && !artifacts.hasSpec) {
      return StageEnum.PRD;
    }

    // 有规格但不确定其他状态
    if (artifacts.hasSpec) {
      return StageEnum.EXTRACTED;
    }

    // 默认返回 PRD 阶段
    return StageEnum.PRD;
  }

  /**
   * 执行完整的项目扫描
   * 包含所有扫描类型的综合结果
   *
   * @returns {Promise<{
   *   specs: SpecScanResult,
   *   sourceCode: SourceCodeScanResult,
   *   reports: ReportScanResult,
   *   prd: PRDScanResult,
   *   timestamp: number,
   *   duration: number
   * }>} 完整扫描结果
   */
  async fullScan() {
    const startTime = Date.now();

    console.log(chalk.blue('\n[Scanner] 开始全量项目扫描...\n'));

    // 并行执行所有扫描任务
    const [specs, sourceCode, reports, prd] = await Promise.all([
      this.scanSpecs(),
      this.scanSourceCode(),
      this.scanReports(),
      this.scanPRD()
    ]);

    const endTime = Date.now();
    const duration = endTime - startTime;

    const result = {
      specs,
      sourceCode,
      reports,
      prd,
      timestamp: endTime,
      duration
    };

    // 输出扫描摘要
    console.log(chalk.blue('\n' + '='.repeat(50)));
    console.log(chalk.bold('扫描摘要'));
    console.log('='.repeat(50));
    console.log(`  规格文件: ${chalk.cyan(String(specs.totalCount))} 个`);
    console.log(`  代码文件: ${chalk.cyan(String(sourceCode.fileCount))} 个 (${sourceCode.totalLOC} LOC)`);
    console.log(`  报告文件: ${chalk.cyan(String(reports.reports.length))} 个`);
    console.log(`  PRD: ${prd.found ? chalk.green('已找到') : chalk.gray('未找到')}`);
    console.log(`  扫描耗时: ${chalk.yellow(`${duration}ms`)}`);
    console.log('='.repeat(50) + '\n');

    return result;
  }

  /**
   * 清除扫描缓存
   */
  clearCache() {
    this._cache.clear();
  }

  /**
   * 获取扫描器配置
   * @returns {Object} 当前配置副本
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 更新扫描器配置
   * @param {Object} updates - 配置更新项
   */
  updateConfig(updates) {
    Object.assign(this.config, updates);
    this.clearCache(); // 配置变更后清除缓存
  }
}

/**
 * 导出默认对象
 */
export default ProjectScanner;
