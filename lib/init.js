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

const AI_TEST_DIRS = [
  'tests',
  'testcases',
  'testcases/examples',
  'test-result'
];

const AI_TEST_FILES = [
  { path: 'tests/testcase-ai.py', content: `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI Test Framework v2.0 - Main Entry Point
YAML-driven test execution engine with MCP browser automation.
Usage: python tests/testcase-ai.py testcases/<your-test>.yaml
"""
# This is a placeholder - copy from pdd-skills-v3/tests/testcase-ai.py
print("[AI Test Framework] Please copy testcase-ai.py and login_manager.py from source")
` },
  { path: 'tests/login_manager.py', content: `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Login State Manager - Intelligent login detection and auto-switching.
Supports: state detection, user verification, auto-logout via dropdown menu.
"""
# This is a placeholder - copy from pdd-skills-v3/tests/login_manager.py
print("[LoginManager] Please copy from source project")
` },
  { path: 'tests/.env.test', content: `# ============================================================
# AI Test Framework - Environment Configuration
# ============================================================

# --- MCP Server Configuration ---
MCP_SERVER_HOST=localhost
MCP_SERVER_PORT=9222
MCP_TRANSPORT=stdio
MCP_TIMEOUT=30000

# --- Browser Configuration ---
BROWSER_HEADLESS=false
BROWSER_WIDTH=1920
BROWSER_HEIGHT=1080
BROWSER_TIMEOUT=30000

# --- Login Credentials ---
TEST_USER=your_username
TEST_DISPLAY_NAME=YourChineseName
TEST_PASS=your_password

# --- Test Data ---
TEST_PROJECT_NAME=测试项目001
TEST_AMOUNT=10000.00

# --- LLM Configuration (Optional) ---
LLM_ENABLED=false
LLM_BASE_URL=http://localhost:8005/v1
LLM_MODEL_NAME=gemma-4-26B-A4B-it
LLM_API_KEY=your-api-key
LLM_THINK_ENABLED=false
LLM_MAX_TOKENS=2048
LLM_TEMPERATURE=0.1

# --- Execution Settings ---
DEFAULT_RETRY_COUNT=3
DEFAULT_RETRY_DELAY=1000
SNAPSHOT_VERBOSE=true
REPORT_FORMAT=markdown
` },
  { path: 'tests/README.md', content: `# AI Test Framework - 测试框架核心

本目录包含 AI 自动化测试框架的核心 Python 代码。

## 文件说明

| 文件 | 用途 |
|------|------|
| \`testcase-ai.py\` | 主执行入口，YAML 驱动的测试用例执行引擎 |
| \`login_manager.py\` | 登录状态管理器，智能检测/跳过/切换用户登录 |
| \`.env.test\` | 环境变量配置（用户名、密码、MCP 配置等） |

## 快速开始

\`\`\`bash
# 1. 配置环境变量（编辑 .env.test）
vim .env.test

# 2. 执行测试用例
python testcase-ai.py ../testcases/login-flow.yaml

# 3. 查看结果
# 结果自动输出到 ../test-result/run-时间戳/
\`\`\`

## 核心能力

- **YAML 驱动**: 用声明式 YAML 编写测试步骤，无需写代码
- **MCP 浏览器自动化**: 通过 Chrome DevTools MCP 控制浏览器
- **智能登录管理**: 自动检测已登录状态，支持用户切换
- **多层级错误检测**: 4 层错误识别，避免假阳性报告
- **SPA 渲染等待**: 自动检测页面渲染完成，处理新标签页切换
- **本地 LLM 集成**: 可选接入本地模型进行元素语义匹配

## 架构概览

\`\`\`
tests/
├── testcase-ai.py      # 主引擎 (ActionExecutor + 断言系统)
├── login_manager.py    # 登录管理 (LoginManager)
└── .env.test           # 运行时配置
\`\`\`

## 依赖

- Python 3.10+
- \`mcp\` 包 (Model Context Protocol 客户端)
- Chrome DevTools MCP Server (\`npx chrome-devtools-mcp\`)
` },
  { path: 'testcases/README.md', content: `# 测试用例 (Test Cases)

本目录存放 YAML 格式的测试用例文件，由 \`tests/testcase-ai.py\` 引擎驱动执行。

## 文件列表

| 文件 | 说明 | 步骤数 |
|------|------|--------|
| \`login-flow.yaml\` | 统一门户登录流程 | 4 |
| \`asset-eval-apply.yaml\` | 资产评估申请提交流程 | 13 |
| \`asset-eval-approval-flow.yaml\` | 资产评估审批流程 | - |

## 目录结构

\`\`\`
testcases/
├── login-flow.yaml              # 登录用例
├── asset-eval-apply.yaml       # 申请用例
├── asset-eval-approval-flow.yaml # 审批用例
├── examples/                    # 样例与格式文档
│   └── yaml-format-guide.md    # YAML 字段详解
└── README.md                   # 本文件
\`\`\`

## 执行方式

\`\`\`bash
cd tests
python testcase-ai.py ../testcases/login-flow.yaml
python testcase-ai.py ../testcases/asset-eval-apply.yaml
\`\`\`

## YAML 格式规范

每个测试用例文件是一个 YAML 文档，包含以下顶层字段：

### 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| \`test_id\` | string | 唯一标识符，如 \`"ASSET-EVAL-001-apply-normal"\` |
| \`title\` | string | 测试用例标题 |
| \`steps\` | list | 测试步骤列表（核心） |

### 可选字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| \`priority\` | string | \`"P1"\` | 优先级: P0/P1/P2/P3 |
| \`tags\` | list | \`[]\` | 标签，用于分类筛选 |
| \`author\` | string | \`""\` | 作者 |
| \`smart_skip\` | bool | \`true\` | 是否启用智能登录跳过 |
| \`context_check\` | dict | \`{}\` | 前置状态感知配置 |
| \`teardown\` | list | \`[]\` | 后置清理操作 |

### 步骤 (step) 结构

每个 step 是一个操作单元：

\`\`\`yaml
- step: 1                    # 步骤编号（从1开始）
  desc: "打开登录页面"        # 步骤描述
  action: navigate          # 操作类型
  url: "http://..."         # 操作参数（因action而异）
  wait_after:               # 操作后等待
    type: navigation
    timeout: 5000
  assertion:                # 断言验证
    type: text_contains
    expected: "欢迎登录"
\`\`\`

详细格式说明请参阅 [examples/yaml-format-guide.md](examples/yaml-format-guide.md)。
` },
  { path: 'testcases/examples/yaml-format-guide.md', content: `# YAML 格式指南

本文档提供 YAML 测试用例的完整格式参考和示例。

## 完整示例

\`\`\`yaml
# ============================================================
# 资产评估申请 - 正常路径测试
# ============================================================
test_id: "ASSET-EVAL-001-apply-normal"
title: "资产评估申请正常提交流程"
priority: "P0"
tags: ["资产评估", "申请流程", "正常路径", "E2E"]
author: "AI"

# 启用智能登录跳过（已登录则跳过步骤2-4）
smart_skip: true

# 前置状态感知：告诉框架如何判断登录状态
context_check:
  login_url: "http://example.com"
  home_indicator: "门户"
  credentials:
    username: "\${TEST_USER}"
    display_name: "\${TEST_DISPLAY_NAME}"
    password: "\${TEST_PASS}"
  captcha_required: false

steps:
  - step: 1
    desc: "打开统一门户登录页面"
    action: navigate
    url: "http://example.com"
    assertion:
      type: text_contains
      expected: "欢迎登录"

  - step: 2
    desc: "输入用户名"
    action: fill
    target: "用户名输入框"
    value: "\${TEST_USER}"

  - step: 3
    desc: "输入密码"
    action: fill
    target: "密码输入框"
    value: "\${TEST_PASS}"
    isSensitive: true

  - step: 4
    desc: "点击登录按钮"
    action: click
    target: "登录按钮"
    wait_after:
      type: navigation
      timeout: 10000
    assertion:
      type: text_contains
      expected: "门户"

teardown:
  - action: screenshot
    name: "result-{timestamp}.png"
    fullPage: true
\`\`\`

## 支持的操作类型 (action)

| action | 说明 | 常用参数 |
|--------|------|---------|
| \`navigate\` | 打开URL | \`url\` |
| \`click\` | 点击元素 | \`target\` |
| \`fill\` | 填充输入框 | \`target\`, \`value\`, \`isSensitive\` |
| \`select_option\` | 下拉选择 | \`target\`, \`option\` |
| \`type\` | 键盘输入 | \`target\`, \`value\` |
| \`hover\` | 悬停 | \`target\` |
| \`scroll\` | 滚动 | \`direction\`, \`amount\` |
| \`screenshot\` | 截图 | \`name\`, \`fullPage\` |
| \`wait\` | 显式等待 | \`duration\` |

## 支持的断言类型 (assertion)

| type | 说明 | 参数 |
|------|------|------|
| \`text_contains\` | 页面包含文本 | \`expected\` |
| \`element_visible\` | 元素可见 | \`expected\` |
| \`element_hidden\` | 元素隐藏 | \`expected\` |
| \`field_filled\` | 字段已填充 | - |
| \`element_text\` | 元素文本匹配 | \`expected\` |
| \`url_contains\` | URL包含文本 | \`expected\` |
| \`toast_visible\` | 提示消息可见 | \`expected\` |
| \`network_called\` | 网络请求已发出 | \`url_pattern\`, \`method\` |
| \`page_title\` | 页面标题匹配 | \`expected\` |

## 环境变量引用

在 YAML 中使用 \`\${VAR_NAME}\` 引用 \`.env.test\` 中定义的变量：

| 变量 | 说明 | 示例 |
|------|------|------|
| \`\${TEST_USER}\` | 登录用户名 | \`yuanye\` |
| \`\${TEST_DISPLAY_NAME}\` | 用户中文名 | \`袁野\` |
| \`\${TEST_PASS}\` | 登录密码 | \`***\` |
| \`\${TEST_PROJECT_NAME}\` | 测试项目名 | \`测试项目001\` |
| \`\${TEST_AMOUNT}\` | 测试金额 | \`10000.00\` |
` }
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

  // Add AI Test Framework directories (always created)
  for (const dir of AI_TEST_DIRS) {
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

  // Always create AI Test Framework template files
  console.log(chalk.blue('\n>> Creating AI Test Framework files...\n'));
  for (const file of AI_TEST_FILES) {
    const fullPath = path.join(absolutePath, file.path);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, file.content, 'utf-8');
    console.log(chalk.gray(`  [OK] ${file.path}`));
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

### AI 测试框架目录

| 目录 | 用途 |
|------|------|
| \`tests/\` | AI自动化测试框架核心代码（Python） |
| \`tests/testcase-ai.py\` | 主执行引擎 - YAML驱动测试用例执行器 |
| \`tests/login_manager.py\` | 登录状态管理器 - 智能检测/跳过/切换用户 |
| \`tests/.env.test\` | 环境变量配置（用户名、密码、MCP等） |
| \`testcases/\` | YAML测试用例文件 |
| \`testcases/examples/\` | YAML格式说明与样例文档 |
| \`test-result/\` | 测试运行结果（自动生成，含报告和快照）
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
├── openspec/
│   ├── changes/
│   └── archive/
├── tests/                          ← AI测试框架
│   ├── testcase-ai.py              # 主执行引擎
│   ├── login_manager.py            # 登录管理
│   ├── .env.test                   # 环境配置
│   └── README.md                   # 框架说明
├── testcases/                      ← YAML测试用例
│   ├── examples/                   # 格式文档与样例
│   │   └── yaml-format-guide.md
│   └── README.md
└── test-result/                    ← 运行结果（自动生成）
    └── run-YYYYMMDD-HHMMSS/
        ├── report-*.md
        └── snapshots/
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
  const pddIgnore = '\n# PDD\n.pdd/cache/\n.specs/.cache/\n*.pdd-report.md\n\n# AI Test Framework\ntest-result/\ntests/.env.local\nsnapshots/\n__pycache__/\n*.pyc\n';

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
