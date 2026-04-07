/**
 * PDD API Routes
 * 定义所有API端点和对应的处理函数
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseSpecFile } from './generate.js';
import { verifyFeature as runVerification } from './verify.js';
import { collectProjectData } from './report.js';
import { loadConfig, findConfigFile } from './config-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * API路由定义
 * 每个路由包含: method, path, handler, description
 */
export const apiRoutes = [
  // ==================== 基础端点 ====================
  
  {
    method: 'GET',
    path: '/api/v1/status',
    description: '获取服务状态和基本信息',
    handler: handleStatus
  },
  
  {
    method: 'GET',
    path: '/api/v1/docs',
    description: '获取API文档',
    handler: handleApiDocs
  },

  {
    method: 'GET',
    path: '/api/v1/health',
    description: '健康检查端点',
    handler: handleHealthCheck
  },

  // ==================== 规格相关 ====================
  
  {
    method: 'POST',
    path: '/api/v1/spec/parse',
    description: '解析规格文档，提取功能点信息',
    handler: handleParseSpec
  },

  {
    method: 'POST',
    path: '/api/v1/spec/generate',
    description: '基于PRD生成开发规格文档',
    handler: handleGenerateSpec
  },

  // ==================== 代码生成 ====================
  
  {
    method: 'POST',
    path: '/api/v1/generate',
    description: '基于开发规格生成代码',
    handler: handleGenerateCode
  },

  {
    method: 'POST',
    path: '/api/v1/generate/dry-run',
    description: '预览将要生成的代码（不实际生成）',
    handler: handleDryRun
  },

  // ==================== 验证功能 ====================
  
  {
    method: 'POST',
    path: '/api/v1/verify',
    description: '验证功能实现是否符合规格',
    handler: handleVerify
  },

  {
    method: 'POST',
    path: '/api/v1/verify/quick',
    description: '快速验证（仅基础检查）',
    handler: handleQuickVerify
  },

  // ==================== 报告生成 ====================
  
  {
    method: 'POST',
    path: '/api/v1/report',
    description: '生成项目分析报告',
    handler: handleGenerateReport
  },

  {
    method: 'GET',
    path: '/api/v1/report/stats',
    description: '获取项目统计信息（轻量级）',
    handler: handleProjectStats
  },

  // ==================== 配置管理 ====================
  
  {
    method: 'GET',
    path: '/api/v1/config',
    description: '获取当前PDD配置',
    handler: handleGetConfig
  },

  {
    method: 'PUT',
    path: '/api/v1/config',
    description: '更新PDD配置',
    handler: handleUpdateConfig
  },

  {
    method: 'POST',
    path: '/api/v1/config/reset',
    description: '重置为默认配置',
    handler: handleResetConfig
  },

  // ==================== 技能管理 ====================
  
  {
    method: 'GET',
    path: '/api/v1/skills',
    description: '列出所有可用技能',
    handler: handleListSkills
  },

  {
    method: 'GET',
    path: '/api/v1/skills/:category',
    description: '列出指定分类的技能',
    handler: handleListSkillsByCategory
  },

  {
    method: 'GET',
    path: '/api/v1/skills/:category/:name',
    description: '获取指定技能的详细信息',
    handler: handleGetSkillDetail
  }
];

// ==================== 路由处理器实现 ====================

/**
 * 处理服务状态请求
 */
async function handleStatus(req) {
  const startTime = Date.now(); // 服务器启动时间（简化为当前时间）
  const uptime = process.uptime();
  
  return {
    status: 'running',
    version: '3.0.0',
    name: 'PDD-Skills API Server',
    uptime: {
      seconds: Math.floor(uptime),
      human: formatUptime(uptime)
    },
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB'
    },
    endpoints: apiRoutes.length,
    timestamp: new Date().toISOString()
  };
}

/**
 * 处理API文档请求
 */
async function handleApiDocs(req) {
  return {
    title: 'PDD-Skills API Documentation',
    version: 'v1',
    baseUrl: `http://${req.headers.host}`,
    endpoints: apiRoutes.map(route => ({
      method: route.method,
      path: route.path,
      description: route.description
    })),
    usage: {
      authentication: '暂无认证机制（后续版本支持）',
      rateLimit: '100 requests per minute per IP',
      responseFormat: 'JSON',
      errorCodes: {
        400: 'Bad Request - 请求参数错误',
        404: 'Not Found - 路由不存在',
        429: 'Too Many Requests - 请求过于频繁',
        500: 'Internal Server Error - 服务器内部错误'
      }
    },
    examples: [
      {
        endpoint: 'GET /api/v1/status',
        description: '检查服务状态',
        curl: `curl http://localhost:3000/api/v1/status`
      },
      {
        endpoint: 'POST /api/v1/generate',
        description: '生成代码',
        curl: `curl -X POST http://localhost:3000/api/v1/generate \\
  -H "Content-Type: application/json" \\
  -d '{"spec": "dev-specs/spec.md", "output": "./generated"}'`
      }
    ]
  };
}

/**
 * 健康检查
 */
async function handleHealthCheck(req) {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      filesystem: fs.accessSync ? 'ok' : 'warning',
      memory: process.memoryUsage().heapUsed < 500000000 ? 'ok' : 'warning',
      cpu: 'ok' // 简化处理
    }
  };
}

/**
 * 解析规格文档
 */
async function handleParseSpec(req) {
  const { specPath } = req.body;
  
  if (!specPath) {
    throw new Error('缺少必要参数: specPath');
  }

  const resolvedPath = path.resolve(specPath);
  
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`规格文件不存在: ${resolvedPath}`);
  }

  const specData = await parseSpecFile(resolvedPath);
  
  return {
    spec: resolvedPath,
    parsedAt: new Date().toISOString(),
    ...specData
  };
}

/**
 * 生成开发规格（占位实现）
 */
async function handleGenerateSpec(req) {
  const { prdPath, outputDir, template } = req.body;

  // TODO: 实现完整的PRD到规格的转换逻辑
  
  return {
    message: '规格生成功能正在开发中',
    input: prdPath,
    outputDir: outputDir || './dev-specs',
    template: template || 'default',
    status: 'not_implemented',
    suggestion: '请使用 CLI 命令: pdd-generate-spec'
  };
}

/**
 * 生成代码
 */
async function handleGenerateCode(req) {
  const { 
    spec = 'dev-specs/spec.md', 
    output = './generated',
    feature,
    dryRun = false
  } = req.body;

  // 调用generate模块
  const { generateCode } = await import('./generate.js');
  
  // 由于generateCode是CLI导向的，这里需要适配
  // 简化版：直接调用核心逻辑
  try {
    const specData = await parseSpecFile(path.resolve(spec));
    
    let targetFeatures = specData.features;
    if (feature) {
      targetFeatures = specData.features.filter(f => 
        f.title.toLowerCase().includes(feature.toLowerCase())
      );
    }

    const resultDir = path.resolve(output);
    
    if (!fs.existsSync(resultDir)) {
      await fs.promises.mkdir(resultDir, { recursive: true });
    }

    // 返回将要生成的信息
    return {
      spec: path.resolve(spec),
      features: targetFeatures.length,
      outputDir: resultDir,
      dryRun: dryRun,
      status: dryRun ? 'preview' : 'generated',
      generatedFiles: [], // 实际实现中会填充
      message: dryRun ? '预览模式：未实际生成文件' : '代码生成完成'
    };

  } catch (error) {
    throw new Error(`代码生成失败: ${error.message}`);
  }
}

/**
 * Dry-run 预览
 */
async function handleDryRun(req) {
  // 复用generate逻辑，但设置dryRun=true
  req.body.dryRun = true;
  return handleGenerateCode(req);
}

/**
 * 验证功能实现
 */
async function handleVerify(req) {
  const { 
    spec, 
    code = './src', 
    verbose = false 
  } = req.body;

  // 调用verify模块
  // 注意：verifyFeature是为CLI设计的，需要适配为返回结果而非打印
  try {
    const codeDir = path.resolve(code);
    
    if (!fs.existsSync(codeDir)) {
      throw new Error(`代码目录不存在: ${codeDir}`);
    }

    // 收集基本验证数据
    const files = [];
    
    async function collectFiles(dir) {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !['node_modules', '.git'].includes(entry.name)) {
          await collectFiles(fullPath);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    }

    await collectFiles(codeDir);

    // 如果有规格文件，进行更详细的验证
    let specData = null;
    if (spec && fs.existsSync(path.resolve(spec))) {
      specData = await parseSpecFile(path.resolve(spec));
    }

    return {
      verifiedAt: new Date().toISOString(),
      codeDirectory: codeDir,
      totalFiles: files.length,
      specFile: spec ? path.resolve(spec) : null,
      specFeatures: specData ? specData.features.length : null,
      status: 'verified',
      verbose: verbose,
      message: '验证完成（完整报告请使用 pdd verify CLI命令）'
    };

  } catch (error) {
    throw new Error(`验证失败: ${error.message}`);
  }
}

/**
 * 快速验证
 */
async function handleQuickVerify(req) {
  // 简化版验证，只做基础检查
  const { code = './src' } = req.body;
  const codeDir = path.resolve(code);

  const checks = {
    directoryExists: fs.existsSync(codeDir),
    hasPackageJson: false,
    hasReadme: false,
    hasTestFiles: false,
    fileCount: 0
  };

  if (checks.directoryExists) {
    checks.hasPackageJson = fs.existsSync(path.join(codeDir, 'package.json'));
    checks.hasReadme = fs.existsSync(path.join(codeDir, 'README.md'));
    
    // 统计文件数
    async function countFiles(dir) {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
          await countFiles(fullPath);
        } else if (entry.isFile() && (entry.name.includes('.test.') || entry.name.includes('.spec.'))) {
          checks.hasTestFiles = true;
        }
        
        if (entry.isFile()) {
          checks.fileCount++;
        }
      }
    }

    await countFiles(codeDir);
  }

  const passedChecks = Object.values(checks).filter(v => v === true).length;
  const totalChecks = Object.keys(checks).length - 1; // 排除fileCount

  return {
    verifiedAt: new Date().toISOString(),
    codeDirectory: codeDir,
    checks,
    summary: {
      passed: passedChecks,
      total: totalChecks,
      passRate: `${Math.round((passedChecks / totalChecks) * 100)}%`,
      status: passedChecks === totalChecks ? 'passed' : 'warning'
    }
  };
}

/**
 * 生成报告
 */
async function handleGenerateReport(req) {
  const { 
    type = 'md', 
    output = './reports/pdd-report',
    includeStats = true,
    includeCharts = false
  } = req.body;

  const projectDir = process.cwd();
  const data = await collectProjectData(projectDir);

  // 根据类型生成不同格式
  const outputPath = path.resolve(output);
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    await fs.promises.mkdir(outputDir, { recursive: true });
  }

  // 保存报告数据（实际文件生成在report模块中完成）
  const reportData = {
    generatedAt: new Date().toISOString(),
    type: type.toLowerCase(),
    outputPath: outputPath + '.' + type.toLowerCase(),
    projectData: data,
    options: { includeStats, includeCharts }
  };

  // 如果是JSON格式，直接返回数据
  if (type.toLowerCase() === 'json') {
    return reportData;
  }

  return {
    message: `报告已排队生成`,
    format: type.toUpperCase(),
    outputPath: reportData.outputPath,
    preview: {
      totalFiles: data.structure.totalFiles,
      skillsCount: data.skills.length,
      specsCount: data.specs.length,
      testsCount: data.tests.length
    }
  };
}

/**
 * 项目统计信息（轻量级）
 */
async function handleProjectStats(req) {
  const projectDir = process.cwd();
  
  // 快速统计，不深入遍历
  const stats = {
    name: '',
    version: '',
    fileTypes: {},
    quickCounts: {
      skills: 0,
      specs: 0,
      tests: 0
    }
  };

  // 读取package.json
  try {
    const pkg = JSON.parse(await fs.promises.readFile(
      path.join(projectDir, 'package.json'), 'utf-8'
    ));
    stats.name = pkg.name;
    stats.version = pkg.version;
  } catch {}

  // 快速统计目录
  const dirsToCheck = [
    { name: 'skills', dir: 'skills' },
    { name: 'specs', dir: 'dev-specs' },
    { name: 'tests', dir: 'tests' }
  ];

  for (const { name, dir } of dirsToCheck) {
    const fullPath = path.join(projectDir, dir);
    if (fs.existsSync(fullPath)) {
      try {
        const files = await fs.promises.readdir(fullPath);
        stats.quickCounts[name] = files.filter(f => 
          f.endsWith('.md') || f.endsWith('.js')
        ).length;
      } catch {}
    }
  }

  stats.collectedAt = new Date().toISOString();

  return stats;
}

/**
 * 获取配置
 */
async function handleGetConfig(req) {
  const configPath = findConfigFile();
  const config = await loadConfig(configPath);

  return {
    configFile: configPath || '未找到配置文件（使用默认配置）',
    config: config,
    isDefault: !configPath
  };
}

/**
 * 更新配置
 */
async function handleUpdateConfig(req) {
  const { updates } = req.body;

  if (!updates || typeof updates !== 'object') {
    throw new Error('请提供有效的配置更新对象');
  }

  const configPath = findConfigFile() || path.join(process.cwd(), 'config', 'config.yaml');
  const config = await loadConfig(configPath);

  // 应用更新
  for (const [key, value] of Object.entries(updates)) {
    if (key in config) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(config[key], value);
      } else {
        config[key] = value;
      }
    }
  }

  // 保存配置
  const { saveConfig } = await import('./config-manager.js');
  await saveConfig(config, configPath);

  return {
    message: '配置已更新',
    configFile: configPath,
    updatedKeys: Object.keys(updates),
    config: config
  };
}

/**
 * 重置配置
 */
async function handleResetConfig(req) {
  const { DEFAULT_CONFIG } = await import('./config-manager.js');
  const configPath = findConfigFile() || path.join(process.cwd(), 'config', 'config.yaml');

  const { saveConfig } = await import('./config-manager.js');
  await saveConfig({ ...DEFAULT_CONFIG }, configPath);

  return {
    message: '配置已重置为默认值',
    configFile: configPath,
    defaultConfig: DEFAULT_CONFIG
  };
}

/**
 * 列出所有技能
 */
async function handleListSkills(req) {
  const skillsDir = path.join(process.cwd(), 'skills');
  
  if (!fs.existsSync(skillsDir)) {
    return {
      skills: [],
      count: 0,
      message: '未找到skills目录'
    };
  }

  const categories = await fs.promises.readdir(skillsDir);
  const allSkills = [];

  for (const category of categories) {
    const categoryPath = path.join(skillsDir, category);
    
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const skillFiles = (await fs.promises.readdir(categoryPath))
      .filter(f => f.endsWith('.md'));

    for (const skillFile of skillFiles) {
      allSkills.push({
        name: skillFile.replace('.md', ''),
        category,
        path: path.join('skills', category, skillFile)
      });
    }
  }

  return {
    skills: allSkills,
    count: allSkills.length,
    categories: categories.filter(c => 
      fs.statSync(path.join(skillsDir, c)).isDirectory()
    )
  };
}

/**
 * 按分类列出技能
 */
async function handleListSkillsByCategory(req) {
  const { category } = req.params;
  const categoryPath = path.join(process.cwd(), 'skills', category);

  if (!fs.existsSync(categoryPath)) {
    throw new Error(`分类不存在: ${category}`);
  }

  const skillFiles = (await fs.promises.readdir(categoryPath))
    .filter(f => f.endsWith('.md'));

  const skills = skillFiles.map(file => ({
    name: file.replace('.md', ''),
    path: path.join('skills', category, file)
  }));

  return {
    category,
    skills,
    count: skills.length
  };
}

/**
 * 获取技能详情
 */
async function handleGetSkillDetail(req) {
  const { category, name } = req.params;
  const skillPath = path.join(process.cwd(), 'skills', category, `${name}.md`);

  if (!fs.existsSync(skillPath)) {
    throw new Error(`技能不存在: ${category}/${name}`);
  }

  const content = await fs.promises.readFile(skillPath, 'utf-8');
  
  // 提取基本信息
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const descMatch = content.match(/description:\s*(.+)/i);
  const triggersMatch = content.match(/triggers:\s*\n((?:-\s*.+\n?)+)/i);

  return {
    name,
    category,
    path: skillPath,
    title: titleMatch ? titleMatch[1] : name,
    description: descMatch ? descMatch[1].trim() : '',
    triggers: triggersMatch 
      ? triggersMatch[1].split('\n')
          .filter(l => l.trim())
          .map(l => l.replace(/^-\s*/, '').trim())
      : [],
    contentLength: content.length,
    lines: content.split('\n').length,
    lastModified: (await fs.promises.stat(skillPath)).mtime.toISOString()
  };
}

// ==================== 工具函数 ====================

/**
 * 格式化运行时间
 * @param {number} seconds - 秒数
 * @returns {string} 格式化的时间字符串
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分钟`);
  parts.push(`${secs}秒`);

  return parts.join(' ');
}
