/**
 * PDD 代码生成模块
 * 基于开发规格文档生成代码实现
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 引入chalk用于彩色输出
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
    magenta: (s) => s
  };
}

/**
 * 解析规格文件，提取功能点信息
 * @param {string} specPath - 规格文件路径
 * @returns {Object} 解析后的规格数据
 */
async function parseSpecFile(specPath) {
  try {
    if (!fs.existsSync(specPath)) {
      throw new Error(`规格文件不存在: ${specPath}`);
    }

    const content = await fs.promises.readFile(specPath, 'utf-8');
    
    // 简单的Markdown解析器 - 提取功能点信息
    const specData = {
      path: specPath,
      features: [],
      metadata: {}
    };

    // 提取元数据（标题、版本等）
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      specData.metadata.title = titleMatch[1];
    }

    const versionMatch = content.match(/版本[：:]\s*(.+)/i);
    if (versionMatch) {
      specData.metadata.version = versionMatch[1].trim();
    }

    // 提取功能点（## 或 ### 标题）
    const featureRegex = /^(#{2,3})\s+(.+?)(?:\s*\|(.+))?$/gm;
    let match;
    
    while ((match = featureRegex.exec(content)) !== null) {
      const level = match[1].length;
      const title = match[2].trim();
      const tags = match[3] ? match[3].split('|').map(t => t.trim()) : [];
      
      if (level === 2 || level === 3) {
        specData.features.push({
          level,
          title,
          tags,
          content: extractFeatureContent(content, match.index)
        });
      }
    }

    console.log(chalk.cyan(`✓ 解析规格文件: ${path.basename(specPath)}`));
    console.log(`  发现 ${specData.features.length} 个功能点\n`);
    
    return specData;
  } catch (error) {
    console.error(chalk.red(`解析规格文件失败: ${error.message}`));
    throw error;
  }
}

/**
 * 提取单个功能点的内容
 * @param {string} content - 完整文档内容
 * @param {number} startIndex - 功能点起始位置
 * @returns {string} 功能点内容
 */
function extractFeatureContent(content, startIndex) {
  // 找到下一个同级或更高级标题的位置
  const remainingContent = content.slice(startIndex);
  const nextHeadingRegex = /\n^(#{1,2})\s+/m;
  const nextMatch = nextHeadingRegex.exec(remainingContent);
  
  if (nextMatch && nextMatch.index > 0) {
    return remainingContent.slice(0, nextIndex).trim();
  }
  
  return remainingContent.trim();
}

/**
 * 根据规格生成代码
 * @param {Object} options - 命令行选项
 */
export async function generateCode(options) {
  try {
    console.log(chalk.blue('📖 开始解析开发规格...\n'));
    
    // 1. 解析规格文件
    const specData = await parseSpecFile(options.spec);
    
    // 2. 如果指定了特定功能点，过滤其他功能点
    let targetFeatures = specData.features;
    if (options.feature) {
      targetFeatures = specData.features.filter(f => 
        f.title.toLowerCase().includes(options.feature.toLowerCase())
      );
      
      if (targetFeatures.length === 0) {
        console.log(chalk.yellow(`⚠️  未找到匹配的功能点: ${options.feature}`));
        console.log(`可用的功能点:\n${specData.features.map((f, i) => `  ${i + 1}. ${f.title}`).join('\n')}\n`);
        return;
      }
      
      console.log(chalk.cyan(`🎯 目标功能点: ${options.feature}\n`));
    }

    // 3. 准备输出目录
    const outputDir = path.resolve(options.output);
    if (!fs.existsSync(outputDir)) {
      await fs.promises.mkdir(outputDir, { recursive: true });
      console.log(chalk.cyan(`📁 创建输出目录: ${outputDir}\n`));
    }

    // 4. Dry-run模式 - 仅显示将要执行的操作
    if (options.dryRun) {
      console.log(chalk.yellow('\n🔍 Dry-Run 模式 - 以下是将要生成的文件:\n'));
      
      for (const feature of targetFeatures) {
        console.log(chalk.magenta(`\n功能点: ${feature.title}`));
        console.log(`  输出路径: ${path.join(outputDir, sanitizeFileName(feature.title))}`);
        
        // 分析功能点内容，预测将生成的文件类型
        const predictedFiles = predictGeneratedFiles(feature);
        for (const file of predictedFiles) {
          console.log(`  📄 ${file}`);
        }
      }
      
      console.log(chalk.green('\n✅ Dry-Run 完成，未实际生成任何文件\n'));
      return;
    }

    // 5. 实际代码生成
    console.log(chalk.blue(`\n🔨 开始生成代码 (${targetFeatures.length} 个功能点)...\n`));
    
    const generatedFiles = [];
    
    for (const feature of targetFeatures) {
      console.log(chalk.cyan(`\n▶ 处理功能点: ${feature.title}`));
      
      const featureOutputDir = path.join(outputDir, sanitizeFileName(feature.title));
      
      if (!fs.existsSync(featureOutputDir)) {
        await fs.promises.mkdir(featureOutputDir, { recursive: true });
      }

      // 为每个功能点生成代码文件
      const files = await generateFeatureCode(feature, featureOutputDir);
      generatedFiles.push(...files);
      
      console.log(chalk.green(`  ✓ 生成 ${files.length} 个文件`));
    }

    // 6. 生成摘要报告
    await generateGenerationReport(specData, targetFeatures, generatedFiles, outputDir);

    console.log(chalk.green('\n' + '='.repeat(60)));
    console.log(chalk.green('✅ 代码生成完成!'));
    console.log(`   总计生成 ${generatedFiles.length} 个文件`);
    console.log(`   输出目录: ${outputDir}`);
    console.log(chalk.green('='.repeat(60) + '\n'));

  } catch (error) {
    console.error(chalk.red(`\n❌ 代码生成失败: ${error.message}\n`));
    process.exit(1);
  }
}

/**
 * 预测将生成的文件列表
 * @param {Object} feature - 功能点对象
 * @returns {string[]} 预测的文件名列表
 */
function predictGeneratedFiles(feature) {
  const files = [];
  const baseName = sanitizeFileName(feature.title);
  
  // 根据标签和内容关键词预测文件类型
  const contentLower = feature.content?.toLowerCase() || '';
  const hasTests = /测试|test|验证|verify/i.test(contentLower);
  hasApi = /api|接口|endpoint|route/i.test(contentLower);
  hasModel = /模型|model|实体|entity|数据结构/i.test(contentLower);
  hasService = /服务|service|业务逻辑/i.test(contentLower);
  
  files.push(`${baseName}.js`);  // 主文件
  
  if (hasModel) files.push(`${baseName}.model.js`);
  if (hasService) files.push(`${baseName}.service.js`);
  if (hasApi) files.push(`${baseName}.route.js`);
  if (hasTests) files.push(`${baseName}.test.js`);
  
  files.push(`${baseName}.md`);  // 文档
  
  return files;
}

/**
 * 为单个功能点生成代码
 * @param {Object} feature - 功能点对象
 * @param {string} outputDir - 输出目录
 * @returns {string[]} 生成的文件列表
 */
async function generateFeatureCode(feature, outputDir) {
  const generatedFiles = [];
  const baseName = sanitizeFileName(feature.title);
  
  // 1. 生成主实现文件
  const mainCode = generateMainImplementation(feature);
  const mainFilePath = path.join(outputDir, `${baseName}.js`);
  await fs.promises.writeFile(mainFilePath, mainCode, 'utf-8');
  generatedFiles.push(mainFilePath);

  // 2. 生成文档说明
  const docContent = generateFeatureDocumentation(feature);
  const docFilePath = path.join(outputDir, `${baseName}.md`);
  await fs.promises.writeFile(docFilePath, docContent, 'utf-8');
  generatedFiles.push(docFilePath);

  // 3. 根据内容分析生成额外的辅助文件
  const contentLower = feature.content?.toLowerCase() || '';
  
  if (/测试|test|验收标准/i.test(contentLower)) {
    const testCode = generateTestTemplate(feature);
    const testFilePath = path.join(outputDir, `${baseName}.test.js`);
    await fs.promises.writeFile(testFilePath, testCode, 'utf-8');
    generatedFiles.push(testFilePath);
  }

  return generatedFiles;
}

/**
 * 生成主实现代码模板
 * @param {Object} feature - 功能点对象
 * @returns {string} 生成的代码
 */
function generateMainImplementation(feature) {
  const timestamp = new Date().toISOString().split('T')[0];
  const className = toClassName(feature.title);
  
  return `/**
 * ${feature.title}
 * 
 * 自动生成于 ${timestamp}
 * 基于 PDD 开发规格
 * 
 * 功能描述:
 * ${feature.content ? feature.content.slice(0, 200) + (feature.content.length > 200 ? '...' : '') : '待补充'}
 */

${feature.tags.includes('class') ? `export class ${className} {
  constructor(options = {}) {
    this.options = options;
    this.initialize();
  }

  /**
   * 初始化
   */
  initialize() {
    // TODO: 实现初始化逻辑
  }

  /**
   * 执行主要功能
   */
  async execute() {
    // TODO: 实现 ${feature.title} 的核心逻辑
    throw new Error('方法尚未实现');
  }
}
` : `/**
 * ${feature.title} - 功能实现
 */

export async function ${toFunctionName(feature.title)}(options = {}) {
  // TODO: 实现 ${feature.title} 的核心逻辑
  
  /**
   * 实现步骤:
   * 1. 解析输入参数
   * 2. 验证参数有效性
   * 3. 执行核心业务逻辑
   * 4. 返回结果
   */
  
  console.log('${feature.title} - 开始执行');
  
  return {
    success: true,
    message: '${feature.title} 执行完成',
    data: null
  };
}
`}
`;
}

/**
 * 生成测试模板
 * @param {Object} feature - 功能点对象
 * @returns {string} 测试代码
 */
function generateTestTemplate(feature) {
  const funcName = toFunctionName(feature.title);
  const className = toClassName(feature.title);
  
  return `/**
 * ${feature.title} - 单元测试
 * 自动生成于 ${new Date().toISOString().split('T')[0]}
 */

import { describe, it, expect, beforeEach } from 'vitest';  // 或使用你的测试框架
import { ${funcName}, ${className} } from './${toFunctionName(feature.title)}.js';

describe('${feature.title}', () => {
  
  beforeEach(() => {
    // 测试前准备工作
  });

  it('应该正确初始化', () => {
    // TODO: 编写初始化测试
    expect(true).toBe(true);
  });

  it('应该处理正常输入', async () => {
    // TODO: 编写正常流程测试
    const result = await ${funcName}({});
    expect(result.success).toBe(true);
  });

  it('应该处理错误情况', async () => {
    // TODO: 编写异常处理测试
    // expect(async () => await ${funcName}(invalidOptions)).toThrow();
  });

  it('应该满足验收标准', () => {
    // TODO: 根据规格中的验收标准编写测试用例
  });
});
`;
}

/**
 * 生成功能点文档
 * @param {Object} feature - 功能点对象
 * @returns {string} 文档内容
 */
function generateFeatureDocumentation(feature) {
  const timestamp = new Date().toISOString();
  
  return `# ${feature.title}

> 自动生成于 ${timestamp} | 基于 PDD 开发规格

## 概述

${feature.content ? feature.content : '*待补充功能描述*'}

## 标签

${feature.tags.length > 0 ? feature.tags.map(tag => `- \`${tag}\``).join('\n') : '- 无'}

## API 接口

\`\`\`javascript
// 使用示例
import { ${toFunctionName(feature.title)} } from './${toFunctionName(feature.title)}.js';

const result = await ${toFunctionName(feature.title)}({
  // 参数选项
});

console.log(result);
\`\`\`

## 参数说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| options | Object | 否 | {} | 配置选项 |

## 返回值

\`\`\`javascript
{
  success: boolean,  // 是否成功
  message: string,   // 结果消息
  data: any          // 返回数据
}
\`\`\`

## 验收标准

- [ ] 功能正常运行
- [ ] 错误处理完善
- [ ] 单元测试通过
- [ ] 代码质量符合规范

## 待办事项

- [ ] 完成核心逻辑实现
- [ ] 补充单元测试
- [ ] 添加集成测试
- [ ] 性能优化

---
*由 PDD-Skills 自动生成*
`;
}

/**
 * 生成代码生成报告
 * @param {Object} specData - 规格数据
 * @param {Array} features - 处理的功能点
 * @param {Array} files - 生成的文件列表
 * @param {string} outputDir - 输出目录
 */
async function generateGenerationReport(specData, features, files, outputDir) {
  const reportPath = path.join(outputDir, 'GENERATION_REPORT.md');
  
  const report = `# 代码生成报告

**生成时间:** ${new Date().toLocaleString()}  
**规格文件:** ${specData.path}  
**功能点数量:** ${features.length}  
**生成文件数:** ${files.length}

## 功能点列表

${features.map((f, i) => `${i + 1}. **${f.title}** - ${f.tags.length > 0 ? f.tags.join(', ') : '无标签'}`).join('\n')}

## 生成文件清单

\`\`\`
${files.map(f => `📄 ${path.relative(outputDir, f)}`).join('\n')}
\`\`\`

## 目录结构

\`\`\`
${outputDir}/
├── GENERATION_REPORT.md
${features.map(f => `├── ${sanitizeFileName(f.title)}/`).join('')}
│   ├── ${sanitizeFileName(f.title)}.js
│   └── ${sanitizeFileName(f.title)}.md
\`\`\`

---

*由 PDD-Skills CLI 工具自动生成*
`;

  await fs.promises.writeFile(reportPath, report, 'utf-8');
  console.log(chalk.cyan(`\n📊 生成报告: ${reportPath}`));
}

/**
 * 将标题转换为合法的文件名
 * @param {string} title - 功能点标题
 * @returns {string} 文件名
 */
function sanitizeFileName(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * 将标题转换为函数名（驼峰）
 * @param {string} title - 标题
 * @returns {string} 函数名
 */
function toFunctionName(title) {
  return title
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word, index) => index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * 将标题转换为类名（PascalCase）
 * @param {string} title - 标题
 * @returns {string} 类名
 */
function toClassName(title) {
  return title
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export { generateCode, parseSpecFile };
