/**
 * PDD 报告生成模块
 * 支持生成 MD/JSON/HTML 格式的分析报告
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
 * 收集项目数据用于报告生成
 * @param {string} projectDir - 项目根目录
 * @returns {Object} 项目数据
 */
async function collectProjectData(projectDir) {
  const data = {
    projectInfo: {
      name: '',
      version: '',
      description: ''
    },
    structure: {
      totalFiles: 0,
      totalDirs: 0,
      fileTypes: {},
      directories: []
    },
    skills: [],
    specs: [],
    tests: [],
    timestamp: new Date().toISOString()
  };

  try {
    // 1. 收集项目基本信息
    const packageJsonPath = path.join(projectDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));
      data.projectInfo.name = pkg.name || 'Unknown';
      data.projectInfo.version = pkg.version || '0.0.0';
      data.projectInfo.description = pkg.description || '';
    }

    // 2. 遍历目录结构
    await traverseDirectory(projectDir, data);

    // 3. 收集技能文件信息
    const skillsDir = path.join(projectDir, 'skills');
    if (fs.existsSync(skillsDir)) {
      data.skills = await collectSkillsInfo(skillsDir);
    }

    // 4. 收集规格文档信息
    const specsDir = path.join(projectDir, 'dev-specs');
    if (fs.existsSync(specsDir)) {
      data.specs = await collectSpecsInfo(specsDir);
    }

    // 5. 收集测试文件信息
    const testsDir = path.join(projectDir, 'tests');
    if (fs.existsSync(testsDir)) {
      data.tests = await collectTestsInfo(testsDir);
    }

  } catch (error) {
    console.error(chalk.yellow(`⚠️  收集项目数据时出错: ${error.message}`));
  }

  return data;
}

/**
 * 遍历目录收集结构信息
 * @param {string} dir - 目录路径
 * @param {Object} data - 数据对象
 */
async function traverseDirectory(dir, data, depth = 0) {
  if (depth > 5) return;  // 防止无限递归

  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      // 跳过隐藏目录和node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || 
          entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') {
        continue;
      }

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        data.totalDirs++;
        
        if (depth < 2) {  // 只记录前两层目录
          data.directories.push({
            name: entry.name,
            path: path.relative(process.cwd(), fullPath)
          });
        }

        await traverseDirectory(fullPth, data, depth + 1);
      } else if (entry.isFile()) {
        data.totalFiles++;
        
        const ext = path.extname(entry.name).toLowerCase();
        data.fileTypes[ext] = (data.fileTypes[ext] || 0) + 1;
      }
    }
  } catch (error) {
    // 忽略权限错误等
  }
}

/**
 * 收集技能信息
 * @param {string} skillsDir - 技能目录
 * @returns {Array} 技能列表
 */
async function collectSkillsInfo(skillsDir) {
  const skills = [];

  try {
    const categories = await fs.promises.readdir(skillsDir);

    for (const category of categories) {
      const categoryPath = path.join(skillsDir, category);
      
      if (!fs.statSync(categoryPath).isDirectory()) continue;

      const skillFiles = (await fs.promises.readdir(categoryPath))
        .filter(f => f.endsWith('.md'));

      for (const skillFile of skillFiles) {
        const skillPath = path.join(categoryPath, skillFile);
        const content = await fs.promises.readFile(skillPath, 'utf-8');
        
        skills.push({
          name: skillFile.replace('.md', ''),
          category,
          path: skillPath,
          size: content.length,
          lines: content.split('\n').length,
          hasDescription: content.includes('description:'),
          hasTriggers: content.includes('triggers:')
        });
      }
    }
  } catch (error) {
    console.error(chalk.yellow(`收集技能信息失败: ${error.message}`));
  }

  return skills;
}

/**
 * 收集规格文档信息
 * @param {string} specsDir - 规格文档目录
 * @returns {Array} 规格列表
 */
async function collectSpecsInfo(specsDir) {
  const specs = [];

  try {
    const files = await fs.promises.readdir(specsDir)
      .filter(f => f.endsWith('.md') || f.endsWith('.json'));

    for (const file of files) {
      const filePath = path.join(specsDir, file);
      const stat = await fs.promises.stat(filePath);
      
      specs.push({
        name: file,
        path: filePath,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        type: path.extname(file).slice(1)
      });
    }
  } catch (error) {
    // 规格目录可能不存在
  }

  return specs;
}

/**
 * 收集测试文件信息
 * @param {string} testsDir - 测试目录
 * @returns {Array} 测试列表
 */
async function collectTestsInfo(testsDir) {
  const tests = [];

  async function findTestFiles(dir) {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !['node_modules', '.git'].includes(entry.name)) {
          await findTestFiles(fullPath);
        } else if (entry.isFile() && 
                   (entry.name.includes('.test.') || 
                    entry.name.includes('.spec.') ||
                    entry.name === 'test.js')) {
          
          const content = await fs.promises.readFile(fullPath, 'utf-8');
          tests.push({
            name: entry.name,
            path: fullPath,
            lines: content.split('\n').length,
            hasAssertions: /expect\(|assert\(|\.to(Equal|Be|Contain)/.test(content)
          });
        }
      }
    } catch {
      // 忽略错误
    }
  }

  await findTestFiles(testsDir);
  return tests;
}

/**
 * 生成分析报告
 * @param {Object} options - 命令行选项
 */
export async function generateReport(options) {
  try {
    console.log(chalk.blue('📊 开始收集项目数据...\n'));

    // 1. 收集项目数据
    const projectDir = process.cwd();
    const projectData = await collectProjectData(projectDir);

    // 2. 根据类型生成不同格式的报告
    const outputBase = options.output;
    
    switch (options.type.toLowerCase()) {
      case 'json':
        await generateJSONReport(projectData, outputBase + '.json', options);
        break;
      case 'html':
        await generateHTMLReport(projectData, outputBase + '.html', options);
        break;
      case 'md':
      default:
        await generateMarkdownReport(projectData, outputBase + '.md', options);
        break;
    }

    console.log(chalk.green('\n✅ 报告生成完成!\n'));

  } catch (error) {
    console.error(chalk.red(`\n❌ 报告生成失败: ${error.message}\n`));
    process.exit(1);
  }
}

/**
 * 生成 Markdown 格式报告
 * @param {Object} data - 项目数据
 * @param {string} outputPath - 输出路径
 * @param {Object} options - 选项
 */
async function generateMarkdownReport(data, outputPath, options) {
  let report = `# PDD 项目分析报告

> **生成时间:** ${new Date(data.timestamp).toLocaleString('zh-CN')}  
> **项目名称:** ${data.projectInfo.name || 'Unknown'}  
> **版本:** ${data.projectInfo.version || 'N/A'}

---

## 📋 项目概览

| 指标 | 数值 |
|------|------|
| 总文件数 | ${data.structure.totalFiles.toLocaleString()} |
| 总目录数 | ${data.structure.totalDirs.toLocaleString()} |
| 技能数量 | ${data.skills.length} |
| 规格文档 | ${data.specs.length} |
| 测试文件 | ${data.tests.length} |

`;

  // 文件类型分布
  if (options.includeStats && Object.keys(data.structure.fileTypes).length > 0) {
    report += `## 📁 文件类型分布

| 扩展名 | 数量 | 占比 |
|--------|------|------|
${Object.entries(data.structure.fileTypes)
  .sort((a, b) => b[1] - a[1])
  .map(([ext, count]) => {
    const percent = ((count / data.structure.totalFiles) * 100).toFixed(1);
    return `| ${ext || '(无)'} | ${count} | ${percent}% |`;
  })
  .join('\n')}

`;
  }

  // 目录结构
  if (data.directories.length > 0) {
    report += `## 🗂️ 目录结构

\`\`\`
${process.cwd()}/
${data.directories.map(d => `├── ${d.name}/`).join('\n')}
\`\`\`

`;
  }

  // 技能统计
  if (data.skills.length > 0) {
    report += `## 🎯 技能统计

### 分类概览

`;
    
    // 按分类统计
    const skillsByCategory = {};
    for (const skill of data.skills) {
      if (!skillsByCategory[skill.category]) {
        skillsByCategory[skill.category] = [];
      }
      skillsByCategory[skill.category].push(skill);
    }

    for (const [category, skills] of Object.entries(skillsByCategory)) {
      report += `#### ${category}
- 技能数量: ${skills.length}
- 完整性: ${skills.filter(s => s.hasDescription && s.hasTriggers).length}/${skills.length}
`;
      
      if (options.includeStats) {
        report += `- 技能列表:\n`;
        for (const skill of skills.slice(0, 10)) {
          report += `  - ${skill.name} (${skill.lines} 行)\n`;
        }
        if (skills.length > 10) {
          report += `  - ... 还有 ${skills.length - 10} 个\n`;
        }
        report += '\n';
      }
    }
  }

  // 规格文档
  if (data.specs.length > 0) {
    report += `## 📄 规格文档

| 文档名称 | 类型 | 大小 | 最后修改 |
|----------|------|------|----------|
${data.specs.map(s => {
  const sizeKB = (s.size / 1024).toFixed(2);
  const modified = new Date(s.modifiedAt).toLocaleDateString('zh-CN');
  return `| ${s.name} | ${s.type.toUpperCase()} | ${sizeKB} KB | ${modified} |`;
}).join('\n')}

`;
  }

  // 测试覆盖情况
  if (data.tests.length > 0) {
    const testsWithAssertions = data.tests.filter(t => t.hasAssertions).length;
    
    report += `## 🧪 测试概况

- **测试文件总数:** ${data.tests.length}
- **包含断言的测试:** ${testsWithAssertions}/${data.tests.length}
- **覆盖率估算:** ${((testsWithAssertions / Math.max(data.tests.length, 1)) * 100).toFixed(1)}%

### 测试文件列表

${data.tests.map(t => `- ${t.name} (${t.lines} 行)`).join('\n')}

`;
  }

  // 建议和改进方向
  report += `## 💡 建议与改进

`;

  const recommendations = generateRecommendations(data);
  for (let i = 0; i < recommendations.length; i++) {
    report += `${i + 1}. ${recommendations[i]}\n`;
  }

  report += `
---

*本报告由 PDD-Skills CLI 工具自动生成*
`;

  // 确保输出目录存在
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    await fs.promises.mkdir(outputDir, { recursive: true });
  }

  await fs.promises.writeFile(outputPath, report, 'utf-8');
  console.log(chalk.cyan(`📝 Markdown报告已保存: ${outputPath}`));
  
  // 显示报告预览（前30行）
  console.log('\n' + '-'.repeat(70));
  console.log('报告预览:');
  console.log('-'.repeat(70) + '\n');
  console.log(report.split('\n').slice(0, 40).join('\n'));
  if (report.split('\n').length > 40) {
    console.log('\n... (报告较长，请查看完整文件)');
  }
}

/**
 * 生成 JSON 格式报告
 * @param {Object} data - 项目数据
 * @param {string} outputPath - 输出路径
 * @param {Object} options - 选项
 */
async function generateJSONReport(data, outputPath, options) {
  const jsonData = {
    metadata: {
      generatedAt: data.timestamp,
      generator: 'pdd-skills',
      version: '3.0.0'
    },
    project: data.projectInfo,
    summary: {
      totalFiles: data.structure.totalFiles,
      totalDirectories: data.structure.totalDirs,
      skillsCount: data.skills.length,
      specsCount: data.specs.length,
      testsCount: data.tests.length,
      fileTypes: data.structure.fileTypes
    },
    skills: data.skills,
    specs: data.specs,
    tests: data.tests,
    recommendations: generateRecommendations(data)
  };

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    await fs.promises.mkdir(outputDir, { recursive: true });
  }

  await fs.promises.writeFile(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');
  console.log(chalk.cyan(`📊 JSON报告已保存: ${outputPath}`));
}

/**
 * 生成 HTML 格式报告
 * @param {Object} data - 项目数据
 * @param {string} outputPath - 输出路径
 * @param {Object} options - 选项
 */
async function generateHTMLReport(data, outputPath, options) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PDD 项目分析报告 - ${data.projectInfo.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 15px; margin-bottom: 25px; font-size: 28px; }
    h2 { color: #34495e; margin-top: 35px; margin-bottom: 20px; font-size: 22px; border-left: 4px solid #3498db; padding-left: 15px; }
    h3 { color: #555; margin-top: 25px; margin-bottom: 15px; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; }
    th, td { padding: 12px 15px; text-align: left; border: 1px solid #ddd; }
    th { background: #3498db; color: white; font-weight: 600; }
    tr:nth-child(even) { background: #f9f9f9; }
    tr:hover { background: #f1f7ff; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 25px 0; }
    .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 10px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .stat-number { font-size: 36px; font-weight: bold; display: block; margin-bottom: 8px; }
    .stat-label { font-size: 14px; opacity: 0.9; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; background: #e8f4fd; color: #2980b9; }
    .success { background: #d4edda; color: #155724; }
    .warning { background: #fff3cd; color: #856404; }
    .danger { background: #f8d7da; color: #721c24; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #888; font-size: 14px; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 PDD 项目分析报告</h1>
    
    <div style="background: #e8f4fd; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
      <strong>项目:</strong> ${data.projectInfo.name || 'Unknown'} &nbsp;|&nbsp;
      <strong>版本:</strong> ${data.projectInfo.version || 'N/A'} &nbsp;|&nbsp;
      <strong>生成时间:</strong> ${new Date(data.timestamp).toLocaleString('zh-CN')}
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-number">${data.structure.totalFiles.toLocaleString()}</span>
        <span class="stat-label">总文件数</span>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
        <span class="stat-number">${data.skills.length}</span>
        <span class="stat-label">技能数量</span>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
        <span class="stat-number">${data.specs.length}</span>
        <span class="stat-label">规格文档</span>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
        <span class="stat-number">${data.tests.length}</span>
        <span class="stat-label">测试文件</span>
      </div>
    </div>

    <h2>📁 文件类型分布</h2>
    <table>
      <thead>
        <tr><th>扩展名</th><th>数量</th><th>占比</th></tr>
      </thead>
      <tbody>
${Object.entries(data.structure.fileTypes)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .map(([ext, count]) => {
    const percent = ((count / data.structure.totalFiles) * 100).toFixed(1);
    return `<tr><td><code>${ext || '(无)'}</code></td><td>${count}</td><td>${percent}%</td></tr>`;
  }).join('\n')}
      </tbody>
    </table>

    ${data.skills.length > 0 ? `
    <h2>🎯 技能统计</h2>
    <table>
      <thead>
        <tr><th>分类</th><th>技能数</th><th>完整性</th></tr>
      </thead>
      <tbody>
${(() => {
  const byCategory = {};
  data.skills.forEach(s => {
    if (!byCategory[s.category]) byCategory[s.category] = [];
    byCategory[s.category].push(s);
  });
  return Object.entries(byCategory).map(([cat, skills]) => {
    const complete = skills.filter(s => s.hasDescription && s.hasTriggers).length;
    return `<tr><td><strong>${cat}</strong></td><td>${skills.length}</td><td><span class="badge ${complete === skills.length ? 'success' : complete > 0 ? 'warning' : 'danger'}">${complete}/${skills.length}</span></td></tr>`;
  }).join('\n');
})()}
      </tbody>
    </table>
    ` : ''}

    ${data.tests.length > 0 ? `
    <h2>🧪 测试概况</h2>
    <table>
      <thead>
        <tr><th>测试文件</th><th>代码行数</th><th>状态</th></tr>
      </thead>
      <tbody>
${data.tests.map(t => `<tr><td>${t.name}</td><td>${t.lines}</td><td><span class="badge ${t.hasAssertions ? 'success' : 'warning'}">${t.hasAssertions ? '有断言' : '待完善'}</span></td></tr>`).join('\n')}
      </tbody>
    </table>
    ` : ''}

    <h2>💡 建议</h2>
    <ul style="line-height: 2;">
${generateRecommendations(data).map(r => `<li>${r}</li>`).join('\n')}
    </ul>

    <div class="footer">
      <p>由 PDD-Skills CLI 自动生成 | ${new Date(data.timestamp).toLocaleString('zh-CN')}</p>
    </div>
  </div>
</body>
</html>`;

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    await fs.promises.mkdir(outputDir, { recursive: true });
  }

  await fs.promises.writeFile(outputPath, html, 'utf-8');
  console.log(chalk.cyan(`🌐 HTML报告已保存: ${outputPath}`));
  
  if (options.includeCharts) {
    console.log(chalk.yellow('提示: 图表功能需要额外的前端库支持，当前使用基础表格展示'));
  }
}

/**
 * 生成改进建议
 * @param {Object} data - 项目数据
 * @returns {Array} 建议列表
 */
function generateRecommendations(data) {
  const recommendations = [];

  // 技能相关建议
  if (data.skills.length > 0) {
    const incompleteSkills = data.skills.filter(s => !(s.hasDescription && s.hasTriggers));
    if (incompleteSkills.length > 0) {
      recommendations.push(`有 ${incompleteSkills.length} 个技能缺少完整的description或triggers，建议补充`);
    }
  }

  // 规格文档建议
  if (data.specs.length === 0) {
    recommendations.push('项目缺少开发规格文档，建议在 dev-specs/ 目录下创建规格文件');
  }

  // 测试相关建议
  if (data.tests.length === 0) {
    recommendations.push('未发现测试文件，建议添加单元测试以提高代码质量保障');
  } else {
    const testWithoutAssertions = data.tests.filter(t => !t.hasAssertions);
    if (testWithoutAssertions.length > 0) {
      recommendations.push(`${testWithoutAssertions.length} 个测试文件缺少断言，请检查测试有效性`);
    }
  }

  // README建议
  const readmeExists = fs.existsSync(path.join(process.cwd(), 'README.md'));
  if (!readmeExists) {
    recommendations.push('项目缺少README.md文档，建议添加项目说明文档');
  }

  // 文件组织建议
  if (data.structure.totalFiles > 500) {
    recommendations.push('项目文件较多，建议优化目录结构或考虑模块化拆分');
  }

  // 如果没有问题
  if (recommendations.length === 0) {
    recommendations.push('项目结构良好，继续保持！');
  }

  return recommendations;
}

export { generateReport, collectProjectData };
