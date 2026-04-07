/**
 * PDD 功能验证模块
 * 验证代码实现是否符合开发规格和验收标准
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
 * 验证结果类
 */
class VerificationResult {
  constructor() {
    this.featureName = '';
    this.specPath = '';
    this.codeDir = '';
    this.timestamp = new Date().toISOString();
    this.checks = [];
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
    this.overallStatus = 'PENDING';
    this.issues = [];
    this.recommendations = [];
  }

  /**
   * 添加检查项
   * @param {string} name - 检查项名称
   * @param {string} status - 状态: PASS/FAIL/WARN/SKIP
   * @param {string} message - 描述信息
   */
  addCheck(name, status, message = '') {
    this.checks.push({
      name,
      status,
      message,
      timestamp: new Date().toISOString()
    });

    switch (status) {
      case 'PASS':
        this.passed++;
        break;
      case 'FAIL':
        this.failed++;
        this.issues.push({ type: 'error', name, message });
        break;
      case 'WARN':
        this.warnings++;
        this.issues.push({ type: 'warning', name, message });
        break;
    }
  }

  /**
   * 计算总体状态
   */
  calculateOverallStatus() {
    if (this.failed > 0) {
      this.overallStatus = 'FAILED';
    } else if (this.warnings > 0) {
      this.overallStatus = 'WARNING';
    } else if (this.passed > 0) {
      this.overallStatus = 'PASSED';
    }
  }

  /**
   * 获取通过率
   * @returns {number} 通过率百分比
   */
  getPassRate() {
    const total = this.passed + this.failed;
    return total > 0 ? Math.round((this.passed / total) * 100) : 0;
  }

  /**
   * 转换为JSON对象
   * @returns {Object}
   */
  toJSON() {
    this.calculateOverallStatus();
    return {
      featureName: this.featureName,
      specPath: this.specPath,
      codeDir: this.codeDir,
      timestamp: this.timestamp,
      summary: {
        totalChecks: this.checks.length,
        passed: this.passed,
        failed: this.failed,
        warnings: this.warnings,
        passRate: `${this.getPassRate()}%`,
        overallStatus: this.overallStatus
      },
      checks: this.checks,
      issues: this.issues,
      recommendations: this.recommendations
    };
  }
}

/**
 * 验证功能实现是否符合规格
 * @param {Object} options - 命令行选项
 */
export async function verifyFeature(options) {
  try {
    console.log(chalk.blue('🔍 开始验证功能实现...\n'));

    // 1. 初始化验证结果
    const result = new VerificationResult();
    result.codeDir = path.resolve(options.code);

    // 2. 检查代码目录是否存在
    result.addCheck(
      '代码目录存在性检查',
      fs.existsSync(result.codeDir) ? 'PASS' : 'FAIL',
      `代码目录: ${result.codeDir}`
    );

    if (!fs.existsSync(result.codeDir)) {
      throw new Error(`代码目录不存在: ${result.codeDir}`);
    }

    // 3. 解析规格文件（如果提供）
    let specData = null;
    if (options.spec) {
      result.specPath = path.resolve(options.spec);
      
      result.addCheck(
        '规格文件存在性检查',
        fs.existsSync(result.specPath) ? 'PASS' : 'FAIL',
        `规格文件: ${result.specPath}`
      );

      if (fs.existsSync(result.specPath)) {
        specData = await parseSpecForVerification(result.specPath);
        result.featureName = specData.title || '未命名功能';
        
        // 基于规格进行详细验证
        await verifyAgainstSpec(result, specData, options);
      }
    } else {
      result.featureName = '通用验证';
      
      // 无规格文件时进行基础代码质量检查
      await performBasicCodeVerification(result, options);
    }

    // 4. 计算总体状态并生成报告
    result.calculateOverallStatus();

    // 5. 输出验证结果
    printVerificationResult(result, options);

    // 6. 如果是JSON模式，输出JSON格式报告
    if (options.json) {
      const jsonReport = JSON.stringify(result.toJSON(), null, 2);
      const reportPath = path.join(process.cwd(), 'verification-report.json');
      await fs.promises.writeFile(reportPath, jsonReport, 'utf-8');
      console.log(chalk.cyan(`\n📄 JSON报告已保存: ${reportPath}\n`));
    }

    // 7. 根据验证结果设置退出码
    if (result.overallStatus === 'FAILED') {
      process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red(`\n❌ 验证失败: ${error.message}\n`));
    process.exit(1);
  }
}

/**
 * 解析规格文件用于验证
 * @param {string} specPath - 规格文件路径
 * @returns {Object} 规格数据
 */
async function parseSpecForVerification(specPath) {
  const content = await fs.promises.readFile(specPath, 'utf-8');
  
  const specData = {
    title: '',
    features: [],
    acceptanceCriteria: [],
    requirements: []
  };

  // 提取标题
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    specData.title = titleMatch[1];
  }

  // 提取验收标准
  const acRegex = /(?:验收标准|Acceptance Criteria)[：:\s]*\n((?:[-*]\s+.+\n?)+)/gi;
  let acMatch;
  while ((acMatch = acRegex.exec(content)) !== null) {
    const criteria = acMatch[1]
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^[-*]\s*/, '').trim());
    specData.acceptanceCriteria.push(...criteria);
  }

  // 提取需求列表
  const reqRegex = /(?:需求|Requirements?)[：:\s]*\n((?:\d+.\s+.+\n?)+)/gi;
  let reqMatch;
  while ((reqMatch = reqRegex.exec(content)) !== null) {
    const requirements = reqMatch[1]
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^\d+.\s*/, '').trim());
    specData.requirements.push(...requirements);
  }

  // 提取功能点
  const featureRegex = /^(#{2,3})\s+(.+?)$/gm;
  let featureMatch;
  while ((featureMatch = featureRegex.exec(content)) !== null) {
    specData.features.push({
      level: featureMatch[1].length,
      title: featureMatch[2].trim()
    });
  }

  return specData;
}

/**
 * 基于规格进行验证
 * @param {VerificationResult} result - 验证结果对象
 * @param {Object} specData - 规格数据
 * @param {Object} options - 命令行选项
 */
async function verifyAgainstSpec(result, specData, options) {
  console.log(chalk.cyan(`📋 验证功能点: ${specData.title}\n`));

  // 1. 验证需求覆盖度
  if (specData.requirements.length > 0) {
    console.log(chalk.blue('检查需求覆盖度...'));
    
    for (let i = 0; i < specData.requirements.length; i++) {
      const req = specData.requirements[i];
      const isCovered = await checkRequirementCoverage(req, result.codeDir);
      
      result.addCheck(
        `需求 #${i + 1}: ${req.slice(0, 50)}${req.length > 50 ? '...' : ''}`,
        isCovered ? 'PASS' : 'FAIL',
        isCovered ? '已找到对应实现' : '未找到明确实现'
      );
    }
  }

  // 2. 验收标准检查
  if (specData.acceptanceCriteria.length > 0) {
    console.log(chalk.blue('\n检查验收标准...'));
    
    for (let i = 0; i < specData.acceptanceCriteria.length; i++) {
      const criterion = specData.acceptanceCriteria[i];
      const isMet = await checkAcceptanceCriterion(criterion, result.codeDir);
      
      result.addCheck(
        `验收标准 #${i + 1}: ${criterion.slice(0, 50)}${criterion.length > 50 ? '...' : ''}`,
        isMet ? 'PASS' : 'FAIL',
        isMet ? '标准已满足' : '标准未满足'
      );
    }
  }

  // 3. 功能点完整性检查
  if (specData.features.length > 0) {
    console.log(chalk.blue('\n检查功能点完整性...'));
    
    for (const feature of specData.features) {
      const featureFiles = await findFeatureImplementation(feature.title, result.codeDir);
      const hasImplementation = featureFiles.length > 0;
      
      result.addCheck(
        `功能点: ${feature.title}`,
        hasImplementation ? 'PASS' : 'WARN',
        hasImplementation 
          ? `找到 ${featureFiles.length} 个相关文件` 
          : '可能缺少实现文件'
      );

      if (hasImplementation && options.verbose) {
        for (const file of featureFiles) {
          console.log(chalk.gray(`    📄 ${file}`));
        }
      }
    }
  }

  // 4. 代码质量基本检查
  await performBasicCodeVerification(result, options);
}

/**
 * 执行基础代码质量验证
 * @param {VerificationResult} result - 验证结果对象
 * @param {Object} options - 命令行选项
 */
async function performBasicCodeVerification(result, options) {
  console.log(chalk.blue('\n执行基础代码质量检查...\n'));

  // 1. 文件结构检查
  const files = await getAllCodeFiles(result.codeDir);
  
  result.addCheck(
    '代码文件数量',
    files.length > 0 ? 'PASS' : 'FAIL',
    `发现 ${files.length} 个代码文件`
  );

  // 2. 文件类型分布
  const fileTypes = {};
  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    fileTypes[ext] = (fileTypes[ext] || 0) + 1;
  });

  if (options.verbose) {
    console.log(chalk.cyan('文件类型分布:'));
    Object.entries(fileTypes).forEach(([ext, count]) => {
      console.log(chalk.gray(`  ${ext || '(无扩展名)'}: ${count} 个文件`));
    });
  }

  // 3. JavaScript/TypeScript语法检查
  const jsFiles = files.filter(f => 
    ['.js', '.jsx', '.ts', '.tsx'].includes(path.extname(f).toLowerCase())
  );

  if (jsFiles.length > 0) {
    console.log(chalk.blue('\nJavaScript/TypeScript语法检查...'));
    
    for (const file of jsFiles.slice(0, 10)) {  // 最多检查10个文件
      const syntaxOk = await checkSyntaxValidity(file);
      result.addCheck(
        `语法检查: ${path.basename(file)}`,
        syntaxOk ? 'PASS' : 'FAIL',
        syntaxOk ? '语法正确' : '存在语法错误'
      );
    }

    if (jsFiles.length > 10) {
      result.addCheck(
        '语法检查范围',
        'WARN',
        `仅检查了前10个文件，共${jsFiles.length}个JS/TS文件`
      );
    }
  }

  // 4. 测试文件检查
  const testFiles = files.filter(f => 
    f.includes('.test.') || f.includes('.spec.') || f.includes('__tests__')
  );

  result.addCheck(
    '测试文件存在性',
    testFiles.length > 0 ? 'PASS' : 'WARN',
    `发现 ${testFiles.length} 个测试文件`
  );

  // 5. README文档检查
  const readmeExists = fs.existsSync(path.join(result.codeDir, 'README.md'));
  result.addCheck(
    'README文档',
    readmeExists ? 'PASS' : 'WARN',
    readmeExists ? '项目包含README文档' : '建议添加README文档'
  );

  // 6. 包管理文件检查
  const packageJsonExists = fs.existsSync(path.join(result.codeDir, 'package.json'));
  result.addCheck(
    'package.json',
    packageJsonExists ? 'PASS' : 'WARN',
    packageJsonExists ? '项目包含package.json' : 'Node.js项目缺少package.json'
  );

  // 7. 生成改进建议
  generateRecommendations(result);
}

/**
 * 检查需求是否被代码覆盖
 * @param {string} requirement - 需求描述
 * @param {string} codeDir - 代码目录
 * @returns {boolean} 是否覆盖
 */
async function checkRequirementCoverage(requirement, codeDir) {
  try {
    // 从需求中提取关键词
    const keywords = extractKeywords(requirement);
    
    // 在代码文件中搜索这些关键词
    const files = await getAllCodeFiles(codeDir);
    
    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf-8');
        const matchCount = keywords.filter(kw => 
          content.toLowerCase().includes(kw.toLowerCase())
        ).length;

        // 如果匹配到超过50%的关键词，认为已覆盖
        if (matchCount >= Math.ceil(keywords.length * 0.5)) {
          return true;
        }
      } catch {
        // 忽略读取错误
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * 检查验收标准是否满足
 * @param {string} criterion - 验收标准
 * @param {string} codeDir - 代码目录
 * @returns {boolean} 是否满足
 */
async function checkAcceptanceCriterion(criterion, codeDir) {
  try {
    // 简单的文本匹配检查
    const keywords = extractKeywords(criterion);
    const files = await getAllCodeFiles(codeDir);

    for (const file of files) {
      const content = await fs.promises.readFile(file, 'utf-8');
      
      // 检查是否包含相关的测试用例或实现
      const hasTest = content.toLowerCase().includes('test') || 
                      content.toLowerCase().includes('it(') ||
                      content.toLowerCase().includes('describe(');
      
      const keywordMatches = keywords.filter(kw =>
        content.toLowerCase().includes(kw.toLowerCase())
      ).length;

      if (keywordMatches > 0 && hasTest) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * 查找功能的实现文件
 * @param {string} featureTitle - 功能标题
 * @param {string} codeDir - 代码目录
 * @returns {string[]} 相关文件列表
 */
async function findFeatureImplementation(featureTitle, codeDir) {
  const keywords = extractKeywords(featureTitle);
  const matchedFiles = [];

  try {
    const files = await getAllCodeFiles(codeDir);

    for (const file of files) {
      const fileName = path.basename(file).toLowerCase();
      const matches = keywords.filter(kw =>
        fileName.includes(kw.toLowerCase())
      ).length;

      if (matches >= Math.ceil(keywords.length * 0.3)) {
        matchedFiles.push(file);
      }
    }
  } catch {
    // 忽略错误
  }

  return matchedFiles;
}

/**
 * 获取所有代码文件
 * @param {string} dir - 目录路径
 * @returns {string[]} 文件列表
 */
async function getAllCodeFiles(dir) {
  const files = [];

  async function traverse(currentDir) {
    try {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        // 跳过 node_modules、.git 等目录
        if (entry.isDirectory() && !['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
          await traverse(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          // 只收集代码文件
          if (['.js', '.jsx', '.ts', '.tsx', '.java', '.py', '.sql', '.vue', '.json'].includes(ext) ||
              entry.name === 'README.md') {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // 忽略权限错误等
    }
  }

  await traverse(dir);
  return files;
}

/**
 * 检查JavaScript/TypeScript文件语法有效性
 * @param {string} filePath - 文件路径
 * @returns {boolean} 语法是否正确
 */
async function checkSyntaxValidity(filePath) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    
    // 简单的语法检查 - 尝试解析为函数
    if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
      // 使用 Function 构造器进行基础语法检查（不执行）
      try {
        new Function(content);
        return true;
      } catch {
        // 对于模块化代码，Function构造器可能会失败，使用更宽松的检查
        return checkBasicSyntax(content);
      }
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * 基础语法检查
 * @param {string} code - 代码内容
 * @returns {boolean} 语法是否基本正确
 */
function checkBasicSyntax(code) {
  // 检查括号匹配
  let braceCount = 0;
  let parenCount = 0;
  let bracketCount = 0;
  
  // 移除字符串中的字符
  const cleanCode = code
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    .replace(/\/\/.*$/gm, '')  // 移除单行注释
    .replace(/\/\*[\s\S]*?\*\//g, '');  // 移除多行注释

  for (const char of cleanCode) {
    switch (char) {
      case '{': braceCount++; break;
      case '}': braceCount--; break;
      case '(': parenCount++; break;
      case ')': parenCount--; break;
      case '[': bracketCount++; break;
      case ']': bracketCount--; break;
    }

    // 如果计数出现负数，说明括号不匹配
    if (braceCount < 0 || parenCount < 0 || bracketCount < 0) {
      return false;
    }
  }

  // 最终所有计数应该为0
  return braceCount === 0 && parenCount === 0 && bracketCount === 0;
}

/**
 * 从文本中提取关键词
 * @param {string} text - 输入文本
 * @returns {string[]} 关键词列表
 */
function extractKeywords(text) {
  // 移除常见的停用词和标点
  const stopWords = ['的', '是', '在', '有', '和', '与', '或', '等', '及', '能', '可以', '需要', '应该', '必须', '支持', '包括', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'into', 'through'];
  
  return text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !stopWords.includes(word))
    .slice(0, 10);  // 最多返回10个关键词
}

/**
 * 生成改进建议
 * @param {VerificationResult} result - 验证结果对象
 */
function generateRecommendations(result) {
  // 根据失败的检查项生成建议
  for (const issue of result.issues) {
    if (issue.type === 'error') {
      if (issue.name.includes('需求')) {
        result.recommendations.push(`请确保实现了以下需求: ${issue.name}`);
      } else if (issue.name.includes('验收')) {
        result.recommendations.push(`请满足以下验收标准: ${issue.name}`);
      } else if (issue.name.includes('语法')) {
        result.recommendations.push(`修复 ${issue.name} 的语法错误`);
      }
    }
  }

  // 通用建议
  if (result.warnings > 0) {
    result.recommendations.push('建议补充单元测试以提高代码覆盖率');
  }

  if (!result.issues.some(i => i.name.includes('README'))) {
    result.recommendations.push('建议添加或完善README文档');
  }

  // 去重
  result.recommendations = [...new Set(result.recommendations)];
}

/**
 * 打印验证结果
 * @param {VerificationResult} result - 验证结果对象
 * @param {Object} options - 命令行选项
 */
function printVerificationResult(result, options) {
  console.log('\n' + '='.repeat(70));
  console.log(chalk.bold('🔍 验证结果摘要'));
  console.log('='.repeat(70) + '\n');

  // 总体状态
  const statusColor = {
    'PASSED': chalk.green,
    'WARNING': chalk.yellow,
    'FAILED': chalk.red,
    'PENDING': chalk.gray
  };

  console.log(`功能名称: ${chalk.cyan(result.featureName)}`);
  console.log(`验证时间: ${new Date(result.timestamp).toLocaleString()}`);
  console.log(`总体状态: ${statusColor[result.overallStatus](result.overallStatus)}`);
  console.log(`通过率: ${result.getPassRate()}%`);
  console.log('');

  // 统计信息
  console.log('-'.repeat(70));
  console.log('统计信息:');
  console.log(`  ✅ 通过: ${chalk.green(result.passed)} 项`);
  console.log(`  ❌ 失败: ${chalk.red(result.failed)} 项`);
  console.log(`  ⚠️  警告: ${chalk.yellow(result.warnings)} 项`);
  console.log(`  📊 总计: ${result.checks.length} 项`);
  console.log('-'.repeat(70) + '\n');

  // 详细检查结果（verbose模式）
  if (options.verbose && result.checks.length > 0) {
    console.log('详细检查结果:\n');
    
    for (const check of result.checks) {
      const icon = {
        'PASS': '✅',
        'FAIL': '❌',
        'WARN': '⚠️ ',
        'SKIP': '⏭️ '
      };
      
      const color = statusColor[check.status] || chalk.gray;
      console.log(`${icon[check.status]} ${color(check.status.padEnd(6))} ${check.name}`);
      
      if (check.message && options.verbose) {
        console.log(`   ${chalk.gray(check.message)}`);
      }
    }
    console.log('');
  }

  // 问题列表
  if (result.issues.length > 0) {
    console.log(chalk.red('发现的问题:'));
    for (const issue of result.issues) {
      const icon = issue.type === 'error' ? '❌' : '⚠️ ';
      console.log(`  ${icon} ${issue.name}`);
      if (issue.message) {
        console.log(`     ${chalk.gray(issue.message)}`);
      }
    }
    console.log('');
  }

  // 改进建议
  if (result.recommendations.length > 0) {
    console.log(chalk.blue('💡 改进建议:'));
    for (let i = 0; i < result.recommendations.length; i++) {
      console.log(`  ${i + 1}. ${result.recommendations[i]}`);
    }
    console.log('');
  }

  console.log('='.repeat(70) + '\n');
}

export { verifyFeature, VerificationResult };
