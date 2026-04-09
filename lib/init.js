import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const IDE_CONFIGS = {
  trae: { name: 'Trae', skillsDir: '.trae/skills', rulesDir: '.trae/rules', configDir: '.trae/config' },
  cursor: { name: 'Cursor', skillsDir: '.cursor/skills', rulesDir: '.cursor/rules', configDir: '.cursor/config' },
  claude: { name: 'Claude Code', skillsDir: '.claude/skills', rulesDir: '.claude/rules', configDir: '.claude/config' },
  codex: { name: 'Codex', skillsDir: '.codex/skills', rulesDir: '.codex/rules', configDir: '.codex/config' },
  generic: { name: 'Generic', skillsDir: '.skills', rulesDir: '.rules', configDir: '.config' }
};

const SUPPORTED_IDES = Object.keys(IDE_CONFIGS);

const BASE_DIRS = [
  'docs/reviews',
  'docs/plans',
  'specs/features',
  'scripts',
  'openspec/changes',
  'openspec/archive'
];

const TEMPLATE_CONFIGS = {
  'business-analysis': {
    name: 'Business Analysis',
    description: 'For requirement analysis, design docs, and prototypes',
    specificDirs: [
      'business-analysis/examples',
      'prototypes'
    ],
    files: [
      { path: 'business-analysis/examples/terms.md', content: '# Terms / Glossary\n\n## Example Module\n\n| Term | Definition |\n|------|------------|\n| | |\n' },
      { path: 'business-analysis/examples/business-rules.md', content: '# Business Rules\n\n## Business Rules\n\n### Process Flow\n\n1. Step 1\n2. Step 2\n3. Step 3\n\n### Key Rules\n\n- Rule 1\n- Rule 2\n' },
      { path: 'business-analysis/examples/conventions.md', content: '# Conventions\n\n## Naming Conventions\n\n| Item | Convention | Example |\n|------|-----------|---------|\n| Module ID | {DOMAIN}-{N} | ZCCZ-1 |\n| Feature ID | FP-{MODULE}-{NNN} | FP-ZCCZ1-001 |\n| API Prefix | /module/feature | /module/feature/list |\n' },
      { path: 'business-analysis/examples/PRD.md', content: '# Product Requirements Document\n\n## Overview\n\n## User Stories\n\n## Functional Requirements\n\n## Non-Functional Requirements\n' },
      { path: 'business-analysis/examples/use-cases.md', content: '# Use Cases\n\n## Use Case 1\n\n**Actor**: User\n\n**Flow**:\n1. User performs action\n2. System responds\n\n**Acceptance Criteria**:\n- Criteria 1\n- Criteria 2\n' },
      { path: 'business-analysis/examples/business-flow.md', content: '# Business Flow\n\n## Process Flow\n\n```\nStart -> Step 1 -> Step 2 -> Step 3 -> End\n                   ↓\n               Alternative\n```\n' },
      { path: 'business-analysis/examples/state-diagram.md', content: '# State Diagram\n\n## State Machine\n\n```\n[State A] -> [State B] -> [State C]\n                ↓\n           [State D]\n```\n' },
      { path: 'prototypes/README.md', content: '# Prototypes\n\n## Structure\n\n```\n{module-id}/\n├── {feature}-list.html\n├── {feature}-form.html\n└── {feature}-detail.html\n```\n\n## Guidelines\n\n- Use kebab-case for file names\n- Include all form fields with validation\n- Mobile-responsive design\n' },
      { path: 'specs/features/README.md', content: '# Feature Specifications\n\nThis directory contains development specifications for each feature.\n\n## Structure\n\n```\nFP-{module}-{NNN}-{name}/\n├── spec.md        # Feature specification\n├── checklist.md   # Acceptance checklist\n└── notes.md       # Implementation notes\n```\n' },
      { path: 'scripts/README.md', content: '# Scripts\n\n## Utility Scripts\n\n| Script | Purpose |\n|--------|---------|\n| execute_menu_config.py | Menu configuration |\n| config_dict_data.py | Dictionary data setup |\n' }
    ]
  },
  'ruoyi': {
    name: 'RuoYi Framework',
    description: 'For RuoYi-based Java projects with standard Maven structure',
    specificDirs: [
      'admin',
      'system',
      'framework',
      'common',
      'testcases/backend',
      'testcases/frontend',
      'testcases/shared',
      'testcases/reports',
      'ui'
    ],
    files: [
      { path: 'testcases/README.md', content: '# E2E Test Cases\n\n## Structure\n\n```\ntestcases/\n├── backend/              # Backend API tests\n├── frontend/            # Frontend E2E tests\n├── shared/              # Shared test data\n├── reports/             # Test reports\n└── scripts/             # Test runner scripts\n```\n\n## Running Tests\n\n```bash\n# All tests\npwsh scripts/run-all-tests.ps1\n\n# Backend only\npwsh scripts/run-backend-tests.ps1\n\n# Frontend only\npwsh scripts/run-frontend-tests.ps1\n```\n' },
      { path: 'testcases/scripts/run-all-tests.ps1', content: '# E2E Test Runner - All Tests\n\n$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path\n$rootDir = Split-Path -Parent $scriptDir\n\nWrite-Host "Running all E2E tests..."\n& pwsh "$scriptDir/run-backend-tests.ps1"\n& pwsh "$scriptDir/run-frontend-tests.ps1"\nWrite-Host "All tests completed."\n' },
      { path: 'testcases/scripts/run-backend-tests.ps1', content: '# Backend Test Runner\n\nWrite-Host "Running backend tests..."\n# TODO: Implement backend test execution\n' },
      { path: 'testcases/scripts/run-frontend-tests.ps1', content: '# Frontend Test Runner\n\nWrite-Host "Running frontend tests..."\n# TODO: Implement frontend test execution\n' },
      { path: 'specs/features/README.md', content: '# Feature Specifications\n\nThis directory contains development specifications for each feature.\n\n## Structure\n\n```\nFP-{module}-{NNN}-{name}/\n├── spec.md        # Feature specification\n├── checklist.md   # Acceptance checklist\n└── notes.md       # Implementation notes\n```\n' },
      { path: 'scripts/README.md', content: '# Scripts\n\n## Utility Scripts\n\n| Script | Purpose |\n|--------|---------|\n| execute_menu_config.py | Menu configuration |\n| config_dict_data.py | Dictionary data setup |\n' }
    ]
  },
  'generic': {
    name: 'Generic',
    description: 'Basic structure for any project type',
    specificDirs: [],
    files: [
      { path: 'specs/features/README.md', content: '# Feature Specifications\n\n## Structure\n\n```\nFP-{module}-{NNN}-{name}/\n├── spec.md\n├── checklist.md\n└── notes.md\n```\n' },
      { path: 'scripts/README.md', content: '# Scripts\n\n## Utility Scripts\n' }
    ]
  }
};

const SUPPORTED_TEMPLATES = Object.keys(TEMPLATE_CONFIGS);

function createReadlineInterface() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer));
  });
}

async function promptSelection(prompt, options, rl) {
  console.log(chalk.blue(`\n${prompt}\n`));
  for (let i = 0; i < options.length; i++) {
    const key = options[i];
    const config = TEMPLATE_CONFIGS[key] || IDE_CONFIGS[key];
    if (config) {
      console.log(chalk.gray(`  [${i + 1}] ${config.name}`));
      if (config.description) {
        console.log(chalk.dim(`      ${config.description}`));
      }
    }
  }
  console.log('');

  let selectedIndex = -1;
  while (selectedIndex < 0) {
    const answer = await askQuestion(rl, 'Enter number or name: ');
    const trimmed = answer.trim();
    const num = parseInt(trimmed, 10);
    if (num >= 1 && num <= options.length) {
      selectedIndex = num - 1;
    } else if (options.includes(trimmed.toLowerCase())) {
      selectedIndex = options.indexOf(trimmed.toLowerCase());
    } else {
      console.log(chalk.yellow('  [!] Invalid selection. Please try again.'));
    }
  }
  return options[selectedIndex];
}

export async function initProject(targetPath = '.', options = {}) {
  const absolutePath = path.resolve(targetPath);
  const pddDir = path.join(absolutePath, '.pdd');
  const rl = createReadlineInterface();

  console.log(chalk.blue('\n========================================'));
  console.log(chalk.blue('   PDD Project Initialization'));
  console.log(chalk.blue('========================================\n'));

  let template = options.template;
  if (!template || !SUPPORTED_TEMPLATES.includes(template)) {
    template = await promptSelection('>> Select project template:', SUPPORTED_TEMPLATES, rl);
  }

  let ide = options.ide;
  if (!ide || !SUPPORTED_IDES.includes(ide)) {
    ide = await promptSelection('>> Select your IDE:', SUPPORTED_IDES, rl);
  }

  rl.close();

  const templateConfig = TEMPLATE_CONFIGS[template];
  const ideConfig = IDE_CONFIGS[ide];

  console.log(chalk.gray(`\n  Template: ${templateConfig.name}`));
  console.log(chalk.gray(`  IDE: ${ideConfig.name}`));
  console.log(chalk.gray(`  Target: ${absolutePath}\n`));

  if (fs.existsSync(pddDir) && !options.force) {
    console.log(chalk.yellow('[!] .pdd directory already exists. Use -f to force overwrite'));
    return;
  }

  console.log(chalk.blue('>> Creating directory structure...\n'));

  const dirs = ['.pdd', '.pdd/cache', '.pdd/cache/specs', '.pdd/cache/reports', ideConfig.skillsDir];

  for (const dir of BASE_DIRS) {
    dirs.push(dir);
  }

  for (const dir of templateConfig.specificDirs) {
    dirs.push(dir);
  }

  for (const dir of dirs) {
    const dirPath = path.join(absolutePath, dir);
    await fs.ensureDir(dirPath);
    console.log(chalk.gray(`  [OK] ${dir}/`));
  }

  console.log(chalk.blue('\n>> Generating config files...\n'));

  await generateConfig(pddDir, template, ideConfig);
  await generateRules(absolutePath, ideConfig, template);
  await updateGitignore(absolutePath);

  const files = templateConfig.files || [];
  if (files.length > 0) {
    console.log(chalk.blue('\n>> Creating template files...\n'));
    for (const file of files) {
      const fullPath = path.join(absolutePath, file.path);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, file.content, 'utf-8');
      console.log(chalk.gray(`  [OK] ${file.path}`));
    }
  }

  await copyOpenspecConfig(absolutePath);
  await copyPrdTemplate(absolutePath);

  console.log(chalk.blue('\n>> Copying skills...\n'));
  await copySkills(path.join(absolutePath, ideConfig.skillsDir));

  console.log(chalk.green('\n========================================'));
  console.log(chalk.green('   [OK] Project initialized!'));
  console.log(chalk.green('========================================\n'));
  console.log(chalk.gray(`  Template: ${templateConfig.name}`));
  console.log(chalk.gray(`  IDE: ${ideConfig.name}`));
  console.log(chalk.gray(`  Location: ${absolutePath}\n`));
}

async function generateConfig(pddDir, template, ideConfig) {
  const configContent = `# PDD Configuration
project:
  name: ""
  version: "1.0.0"
  description: ""
  template: ${template}

ide:
  type: ${ideConfig.name.toLowerCase()}
  skills_dir: ${ideConfig.skillsDir}
  rules_dir: ${ideConfig.rulesDir}

pdd:
  features:
    output_dir: specs/features
    naming_pattern: "FP-{module}-{id}-{name}"
  spec:
    output_dir: specs
    template: default
    include_tests: true
  verify:
    dimensions:
      - completeness
      - correctness
      - consistency
    auto_fix: false

linter:
  enabled: true
  types:
    - code
    - prd
    - sql
    - activiti
  fail_on_error: false
  report_format: markdown

hooks:
  enabled: true
  events:
    - session_start
    - pre_feature
    - post_feature

cache:
  enabled: true
  ttl: 3600
  max_size: 100

logging:
  level: info
`;

  await fs.writeFile(path.join(pddDir, 'config.yaml'), configContent);
  console.log(chalk.gray('  [OK] .pdd/config.yaml'));

  const hooksContent = `# PDD Hooks Configuration
session_start:
  enabled: true
  description: "Execute on session start, load project context"

pre_feature:
  enabled: true
  checks:
    - spec_exists
    - dependencies_met

post_feature:
  enabled: true
  actions:
    - run_linter
    - run_tests

pre_commit:
  enabled: true
  checks:
    - linter_pass
    - tests_pass
`;

  await fs.writeFile(path.join(pddDir, 'hooks.yaml'), hooksContent);
  console.log(chalk.gray('  [OK] .pdd/hooks.yaml'));
}

function generateProjectRulesContent(template) {
  const baseDirs = `
### 基准目录

| 目录 | 用途 |
|------|------|
| \`docs/reviews/\` | Code Review 报告 |
| \`docs/plans/\` | 设计文档 |
| \`specs/features/\` | 功能规格 |
| \`scripts/\` | 工具脚本 |
| \`openspec/changes/\` | 活跃变更 |
| \`openspec/archive/\` | 归档变更 |
`;

  let specificDirs = '';
  let fullStructure = '';

  if (template === 'business-analysis') {
    specificDirs = `
### 特定目录

| 目录 | 用途 |
|------|------|
| \`business-analysis/examples/\` | 业务分析文档示例 |
| \`prototypes/\` | HTML原型文件 |
`;
    fullStructure = `
### 完整目录结构

\`\`\`
├── docs/
│   ├── reviews/
│   └── plans/
├── specs/features/
├── scripts/
├── openspec/
│   ├── changes/
│   └── archive/
├── business-analysis/
│   └── examples/
└── prototypes/
\`\`\`
`;
  } else if (template === 'ruoyi') {
    specificDirs = `
### 特定目录

| 目录 | 用途 |
|------|------|
| \`admin/\` | 后端主应用 |
| \`system/\` | 系统业务模块 |
| \`framework/\` | 框架核心模块 |
| \`common/\` | 通用工具模块 |
| \`testcases/backend/\` | 后端测试 |
| \`testcases/frontend/\` | 前端测试 |
| \`testcases/shared/\` | 共享测试数据 |
| \`testcases/reports/\` | 测试报告 |
| \`ui/\` | Vue前端项目 |
| \`{业务模块}/\` | 业务模块（kebab-case命名） |
`;
    fullStructure = `
### 完整目录结构

\`\`\`
├── docs/
│   ├── reviews/
│   └── plans/
├── specs/features/
├── scripts/
├── openspec/
│   ├── changes/
│   └── archive/
├── admin/              # 后端主应用
├── system/             # 系统业务模块
├── framework/          # 框架核心模块
├── common/             # 通用工具模块
├── testcases/          # 测试用例
│   ├── backend/        # 后端测试
│   ├── frontend/       # 前端测试
│   ├── shared/         # 共享测试数据
│   └── reports/        # 测试报告
├── ui/                 # Vue前端项目
└── {其他业务模块}/      # 业务模块（kebab-case命名）
\`\`\`
`;
  } else {
    fullStructure = `
### 完整目录结构

\`\`\`
├── docs/
│   ├── reviews/
│   └── plans/
├── specs/features/
├── scripts/
└── openspec/
    ├── changes/
    └── archive/
\`\`\`
`;
  }

  return `# Project Rules

本文档定义项目级的规范和标准，所有开发者和AI Agent必须遵循。

## 1. Directory Structure

${baseDirs}
${specificDirs}
${fullStructure}

## 2. Naming Conventions

### 2.1 业务模块命名

- 使用 kebab-case 格式
- 示例：\`equity-transfer\`、\`asset-disposition\`、\`property-evaluation\`

### 2.2 功能点编号

格式：\`FP-{module}-{NNN}-{name}\`

示例：
- \`FP-ZCCZ1-001-transfer\` - 转让申请功能
- \`FP-ZCPG1-001-evaluation\` - 评估备案功能

## 3. Development Standards

### 3.1 变更管理

OpenSpec 变更操作目录：

| 变更类型 | 操作目录 | 说明 |
|---------|---------|------|
| 源码实现 | \`openspec/\` | 涉及代码编写、重构、测试等源码相关工作 |
| 需求分析设计 | \`openspec/\` | 涉及需求分析、设计文档、原型等文档工作 |

### 3.2 文档命名

| 类型 | 格式 | 示例 |
|------|------|------|
| 设计文档 | \`{序号}-{主题}.md\` | \`01-项目概述.md\` |
| Review报告 | \`review-YYYYMMDD-HHMMSS.md\` | \`review-20260407-143000.md\` |
| 功能规格 | \`FP-{module}-{NNN}-{name}/spec.md\` | \`FP-ZCCZ1-001-transfer/spec.md\` |

## 4. Code Quality

## 5. Testing Requirements

## 6. Documentation Standards
`;
}

async function generateRules(projectDir, ideConfig, template) {
  const rulesDir = path.join(projectDir, ideConfig.rulesDir);
  await fs.ensureDir(rulesDir);

  const projectRulesContent = generateProjectRulesContent(template);

  await fs.writeFile(path.join(rulesDir, 'project_rules.md'), projectRulesContent);
  console.log(chalk.gray(`  [OK] ${ideConfig.rulesDir}/project_rules.md`));

  const lessonsContent = `# Lessons Learned

## Guidelines

### Format

\`\`\`markdown
## YYYY-MM-DD: Issue Title

### Problem
Description of the issue.

### Root Cause
Root cause analysis.

### Solution
How it was resolved.

### Prevention
How to prevent recurrence.
\`\`\`

### How to Use

1. When encountering a new issue, create a new entry
2. When fixing an issue, update with solution details
3. Before starting similar work, check this file for relevant lessons
`;

  await fs.writeFile(path.join(rulesDir, 'lessons.md'), lessonsContent);
  console.log(chalk.gray(`  [OK] ${ideConfig.rulesDir}/lessons.md`));
}

async function updateGitignore(projectDir) {
  const gitignorePath = path.join(projectDir, '.gitignore');
  const pddIgnore = '\n# PDD\n.pdd/cache/\n.specs/.cache/\n*.pdd-report.md\n';

  if (fs.existsSync(gitignorePath)) {
    const content = await fs.readFile(gitignorePath, 'utf-8');
    if (!content.includes('# PDD')) {
      await fs.appendFile(gitignorePath, pddIgnore);
      console.log(chalk.gray('  [OK] Updated .gitignore'));
    }
  } else {
    await fs.writeFile(gitignorePath, pddIgnore);
    console.log(chalk.gray('  [OK] Created .gitignore'));
  }
}

async function copyOpenspecConfig(projectDir) {
  const openspecDir = path.join(projectDir, 'openspec');
  const configSource = path.join(__dirname, '../templates/openspec-config.yaml');

  if (fs.existsSync(configSource)) {
    await fs.copy(configSource, path.join(openspecDir, 'config.yaml'));
    console.log(chalk.gray('  [OK] openspec/config.yaml'));
  }
}

async function copyPrdTemplate(projectDir) {
  const templatesDir = path.join(projectDir, 'templates');
  const templateSource = path.join(__dirname, '../templates/prd-template.prdx');

  if (fs.existsSync(templateSource)) {
    await fs.ensureDir(templatesDir);
    await fs.copy(templateSource, path.join(templatesDir, 'prd-template.prdx'));
    console.log(chalk.gray('  [OK] templates/prd-template.prdx'));
  }
}

async function copySkills(skillsDir) {
  const categories = ['core', 'entropy', 'expert', 'openspec', 'pr'];
  const skillsSource = path.join(__dirname, '../skills');

  for (const cat of categories) {
    const catSource = path.join(skillsSource, cat);
    if (!fs.existsSync(catSource)) continue;

    const skillDirs = fs.readdirSync(catSource).filter(f =>
      fs.statSync(path.join(catSource, f)).isDirectory()
    );

    for (const skill of skillDirs) {
      const src = path.join(catSource, skill);
      const dest = path.join(skillsDir, skill);
      await fs.copy(src, dest);
      console.log(chalk.gray(`  [OK] ${skill}`));
    }
  }
}

export function getSupportedTemplates() {
  return SUPPORTED_TEMPLATES;
}

export function getSupportedIDEs() {
  return SUPPORTED_IDES;
}
