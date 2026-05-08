# Testcase Agent - CLI 命令行接口参考

> **版本**: 1.0.1
> **最后更新**: 2026-05-08
> **用途**: testcase-agent 的完整命令行接口文档

---

## 📖 目录

1. [快速开始](#快速开始)
2. [核心命令](#核心命令)
3. [高级选项](#高级选项)
4. [调试与排错](#调试与排错)
5. [缓存管理](#缓存管理)
6. [动作管理](#动作管理)
7. [报告生成](#报告生成)
8. [环境配置](#环境配置)
9. [输出格式](#输出格式)
10. [退出码](#退出码)

---

## 快速开始

### 安装与初始化

```bash
# 确保已安装 pdd-cli
npm install -g @pdd/cli

# 初始化配置（首次使用）
pdd test init
# 将在当前目录创建 cdp-test-config.yaml

# 验证安装
pdd test --version
# 输出: PDD Test Skill v1.0.1
```

### 最简单的执行

```bash
# 执行单个YAML用例
pdd test replay tests/login/portal-login.yaml

# 输出:
# ✓ Test started: login-001-portal-login
# ✓ Context check: Already logged in (skipped login steps)
# ✓ Step 1/5: Navigate to portal... PASS (230ms)
# ✓ Step 2/5: Fill username... PASS (145ms)
# ✓ Step 3/5: Fill password... PASS (152ms)
# ✓ Step 4/5: Click login button... PASS (890ms)
# ✓ Step 5/5: Verify homepage... PASS (34ms)
#
# 📊 Result: PASS (5/5 steps, 100%, total 1451ms)
# 📄 Report: test-results/reports/login-001-portal-login_report_20260508.html
```

---

## 核心命令

### 1. pdd test replay - 执行测试用例

#### 基础用法

```bash
# 执行单个文件
pdd test replay <yaml-file>

# 示例
pdd test replay tests/login/portal-login.yaml
pdd test replay ./tests/asset-eval/apply-normal.yaml
```

#### 批量执行

```bash
# 执行目录下所有yaml文件
pdd test replay ./tests/login/

# 执行多个指定文件
pdd test replay tests/*.yaml

# 递归执行子目录
pdd test replay ./tests/ --recursive
```

#### 带环境变量

```bash
# 从.env文件加载环境变量
pdd test replay tests/login.yaml --env .env.test

# 直接指定环境变量
pdd test replay tests/login.yaml \
  --env TEST_USER=admin \
  --env TEST_PASS=password123 \
  --env BASE_URL=http://staging.example.com
```

#### 调试模式

```bash
# 单步执行模式（每步暂停，等待确认）
pdd test replay tests/login.yaml --debug

# 输出示例:
# [DEBUG] Step 1: Navigate to http://portal.example.com
# Press Enter to execute, 's' to skip, 'q' to quit >
# (用户按回车)
# ✓ Executed: Navigate completed (230ms)
# Screenshot saved: step_1_navigate.png
#
# [DEBUG] Step 2: Fill username input
# Press Enter to execute, 's' to skip, 'q' to quit >
```

#### 指定起始步骤

```bash
# 从第3步开始执行（跳过前2步）
pdd test replay tests/login.yaml --start-at 3

# 只执行第5步（用于单独调试某一步）
pdd test replay tests/login.yaml --only-step 5
```

---

### 2. pdd test validate - 验证YAML格式

```bash
# 只做语法和结构检查，不实际执行
pdd test validate tests/login/portal-login.yaml

# 输出:
# ✓ YAML syntax: Valid
# ✓ Required fields: Complete
# ✓ Actions: All defined in test-actions.yaml
# ✓ Assertions: Valid types
# ✓ Security: No hardcoded secrets detected
#
# Validation: PASSED
```

#### 详细验证模式

```bash
# 显示详细的验证信息
pdd test validate tests/login.yaml --verbose

# 输出:
# Validating: tests/login/portal-login.yaml
#
# [Structure]
#   ✓ test_id: "LOGIN-001-portal-login" (format OK)
#   ✓ title: "统一门户登录流程" (non-empty)
#   ✓ priority: "P0" (valid: P0/P1/P2)
#   ✓ context_check: Present (login_url + credentials)
#   ✓ steps: 5 items (≥ 1)
#
# [Security]
#   ✓ Password uses env var: ${TEST_PASS}
#   ✓ Username uses env var: ${TEST_USER}
#   ✓ No hardcoded tokens detected
#
# [Assertions]
#   Step 1: text_contains ✓
#   Step 2: field_filled ✓
#   Step 3: field_filled ✓
#   Step 4: text_contains ✓
#   Step 5: text_contains ✓
#
# [Warnings]
#   ⚠ Step 4: No network assertion (recommended for submit actions)
#
# Result: VALID (with 1 warning)
```

---

### 3. pdd test actions - 动作管理

#### 列出所有可用动作

```bash
# 列出所有内置动作
pdd test actions list

# 输出:
# Available Actions (28 total):
#
# Navigation (2):
#   navigate      - 打开页面
#   go_back       - 返回上一页
#
# Form Operations (6):
#   fill          - 填写输入框
#   select_option - 选择下拉选项
#   checkbox      - 勾选复选框
#   fill_form     - 批量填写表单
#   clear         - 清空输入框
#   submit        - 提交表单
#
# Click Operations (3):
#   click         - 点击元素
#   double_click  - 双击元素
#   right_click   - 右键点击
#
# File Operations (2):
#   upload_file   - 上传文件
#   download_file - 下载文件
#
# Wait Operations (3):
#   wait_for      - 等待元素/文本
#   wait_time     - 固定时间等待
#   wait_navigation - 等待页面导航
#
# Screenshot (1):
#   screenshot    - 截图
#
# Scroll (2):
#   scroll        - 滚动页面
#   scroll_to     - 滚动到元素
#
# Assertions (6):
#   assert_text   - 文本断言
#   assert_visible - 可见性断言
#   assert_network - 网络断言
#   assert_value  - 值断言
#   assert_count  - 数量断言
#   assert_custom - 自定义断言
#
# Use 'pdd test actions show <name>' for details
```

#### 搜索动作

```bash
# 搜索特定动作
pdd test actions search "upload"

# 输出:
# Found 2 matching actions:
#
# 1. upload_file
#    Display: 上传文件
#    Patterns:
#      - "上传 {file} 到 {target}"
#      - "upload file {path}"
#    MCP: upload_file
#    Params: target (element), path (string)
#
# 2. download_file
#    Display: 下载文件
#    Patterns:
#      - "下载 {file}"
#      - "download {url}"
#    MCP: (browser native)
#    Params: url (string), saveAs (string)
```

#### 查看动作详情

```bash
# 查看某个动作的完整定义
pdd test actions show upload_file

# 输出:
# Action: upload_file
# Display: 上传文件
# Category: File Operations
#
# Description:
#   Upload a file to a file input element or drop zone.
#   Supports drag-and-drop simulation via CDP.
#
# Trigger Patterns:
#   - "上传 {file} 到 {target}"
#   - "upload file {path} to {target}"
#   - "附件上传"
#
# MCP Tool: mcp_Chrome_DevTools_MCP_upload_file
#
# Parameters:
#   Name       | Type    | Required | Default | Description
#   ----------|---------|----------|---------|------------
#   target    | element | Yes      | -       | Target element description or UID
#   path      | string  | Yes      | -       | Path to file (absolute or relative)
#   waitForUpload | bool | No       | true    | Wait for upload to complete
#
# Example:
#   - step: 5
#     action: upload_file
#     target: "证件上传按钮"
#     path: "${TEST_FILE_PATH}"
#
# Notes:
#   - File must exist on local filesystem
#   - Large files (>10MB) may require increased timeout
#   - Uses CDP DOM.setFileInputFiles under the hood
```

---

## 高级选项

### 并行执行

```bash
# 并行执行多个用例（多标签页）
pdd test replay tests/*.yaml --parallel --max-tabs=3

# 输出:
# Starting parallel execution (max 3 concurrent tabs)
#
# [Tab 1] ✓ login-portal.yaml... PASS (1451ms)
# [Tab 2] ✓ asset-eval-apply.yaml... PASS (3245ms)
# [Tab 3] ✓ system-user-crud.yaml... PASS (2134ms)
#
# 📊 Parallel Result: 3/3 PASS (100%, total wall time: 3245ms)
```

### 失败重跑

```bash
# 只重跑上次失败的用例
pdd test replay tests/ --rerun-failed

# 重跑失败次数最多的Top N用例
pdd test replay tests/ --rerun-flaky --top 5

# 指定重跑次数上限
pdd test replay tests/ --max-reruns 3
```

### 输出控制

```bash
# 安静模式（只输出最终结果）
pdd test replay tests/login.yaml --quiet

# JSON格式输出（便于CI/CD解析）
pdd test replay tests/login.yaml --json

# 输出到文件
pdd test replay tests/login.yaml --output result.json

# 详细日志（包含每步的MCP调用）
pdd test replay tests/login.yaml --verbose
```

### 浏览器选项

```bash
# 指定浏览器窗口大小
pdd test replay tests/login.yaml --viewport "1920x1080"

# 模拟移动设备
pdd test replay tests/mobile.yaml --device "iPhone 12"

# 无头模式（无GUI，适合CI/CD）
pdd test replay tests/login.yaml --headless

# 禁用JavaScript（测试noscript场景）
pdd test replay tests/login.yaml --disable-js

# 设置User-Agent
pdd test replay tests/login.yaml --user-agent "PDD-TestBot/1.0"
```

---

## 调试与排错

### Debug模式详解

```bash
# 启动交互式debug会话
pdd test replay tests/login.yaml --debug

# Debug会话命令:
#   Enter  - 执行当前步骤
#   s      - 跳过当前步骤（标记为SKIP）
#   r      - 重试当前步骤（重新定位元素）
#   i      - 进入inspect模式（查看页面状态）
#   q      - 退出debug模式
#   ?      - 查看帮助
#   c      - 继续执行剩余步骤（退出debug模式）
```

#### Inspect模式

在debug模式下按 `i` 进入inspect模式：

```
[Inspect Mode]
Current URL: http://portal.example.com/login
Available commands:
  snapshot    - Show current page snapshot
  elements   - List all interactive elements
  network    - Show recent network requests
  console    - Show console logs/errors
  screenshot - Take a screenshot now
  evaluate   - Execute JavaScript expression
  back       - Return to debug mode

inspect > snapshot
# 输出当前页面的DOM树快照

inspect > elements button
# 列出所有button元素

inspect > evaluate document.title
# "统一门户登录"

inspect > back
# 返回debug模式
```

### 日志级别

```bash
# 设置日志级别
pdd test replay tests/login.yaml --log-level debug
# 可选: trace | debug | info | warn | error | silent

# 输出日志到文件
pdd test replay tests/login.yaml --log-file test-execution.log

# 同时输出到console和文件
pdd test replay tests/login.yaml --log-file test.log --log-level debug
```

### 性能分析

```bash
# 启用性能分析（记录每步耗时）
pdd test replay tests/login.yaml --profile

# 输出性能报告:
# Performance Profile:
# ┌─────────────────────────────────────────────┐
# │ Step  │ Action  │ Duration │ % of Total  │
# │-------|---------|----------|-------------│
# │ 1     │ navigate│ 230ms    │ 15.8%       │
# │ 2     │ fill    │ 145ms    │ 10.0%       │
# │ 3     │ fill    │ 152ms    │ 10.5%       │
# │ 4     │ click   │ 890ms    │ 61.3%       │
# │ 5     │ assert  │ 34ms     │ 2.4%        │
# │-------|---------|----------|-------------│
# │ Total │         │ 1451ms   │ 100%        │
# └─────────────────────────────────────────────┘
#
# Bottleneck: Step 4 (click) took 61.3% of total time
# Recommendation: Consider adding explicit wait_after for navigation
```

---

## 缓存管理

### 查看缓存统计

```bash
pdd test cache stats

# 输出:
# ═════════════════════════════════════════
#  UID Cache Statistics
# ═════════════════════════════════════════
#
#  Total Entries: 45
#  Cache Size: 12.3 KB
#
#  Hit Rate:
#    Level 1 Hits: 128 (72%)
#    Level 2+ Fallbacks: 50 (28%)
#
#  Top 10 Most Used Keys:
#    1. username_input     (23 uses)
#    2. password_input     (21 uses)
#    3. login_button       (18 uses)
#    4. submit_button      (15 uses)
#    ...
#
#  Stale Entries (>7 days): 3
#  Invalidated Entries: 2
#
#  Recommendations:
#    ✓ Cache hit rate is healthy (>70%)
#    ⚠ Consider clearing 3 stale entries
```

### 清空缓存

```bash
# 清空所有缓存
pdd test cache clear

# 输出:
# Cleared 45 cache entries
# Freed 12.3 KB memory

# 只清空过期缓存（>7天未使用）
pdd test cache clear --stale-only

# 清空指定模式的缓存
pdd test cache clear --pattern "login_*"
```

### 导出/导入缓存

```bash
# 导出缓存为JSON文件
pdd test cache export --output uid-cache-backup.json

# 输出:
# Exported 45 cache entries to uid-cache-backup.json
# File size: 18.7 KB

# 从JSON导入缓存
pdd test cache import --input uid-cache-backup.json

# 输出:
# Imported 45 cache entries
# Merged with existing cache (no duplicates)
```

### 预热缓存

```bash
# 从之前的执行结果预热缓存
pdd test cache warmup --from test-results/reports/

# 输出:
# Warmed up cache from 3 previous executions
# Added 32 new cache entries
# Updated 13 existing entries (freshened timestamps)
```

---

## 报告生成

### 从执行结果重新生成报告

```bash
# 从已有的测试结果目录生成报告
pdd test report --input ./test-results/ -o ./reports/

# 输出:
# Generated 5 reports:
#   reports/login-001-portal-login_report.html
#   reports/asset-eval-001-apply_normal_report.html
#   ...
#
# Open: reports/index.html  (aggregate report)

# 合并多次执行的报告
pdd test report --merge \
  --inputs "run-1/, run-2/, run-3/" \
  --output trend-report.html

# 生成趋势报告（对比多次执行）
```

### 报告定制

```bash
# 指定报告模板
pdd test report --template my-custom-template.html

# 包含/排除某些章节
pdd test report \
  --include screenshots,details \
  --exclude appendix,network-logs

# 设置报告元信息
pdd test report \
  --title "回归测试报告 v2.3" \
  --author "QA Team" \
  --client "Asset Management Dept"

# 导出为PDF（需要puppeteer）
pdd test report --format pdf --output report.pdf
```

### 聚合报告

```bash
# 生成测试套件的聚合报告
pdd test aggregate \
  --dir ./test-results/ \
  --output suite-summary.html

# 输出:
# Suite Summary Report
# ===================
# Execution Date: 2026-05-08 14:30:00
# Total Test Cases: 15
# Passed: 12 (80%)
# Failed: 2 (13.3%)
# Skipped: 1 (6.7%)
#
# Average Duration: 2.3s per case
# Total Execution Time: 34.5s
#
# Failure Breakdown:
#   1. asset-eval-apply.yaml (Step 13: Network assertion failed)
#   2. user-role-crud.yaml (Step 7: Element not found)
#
# See detailed reports for each failure.
```

---

## 环境配置

### 配置文件位置

```bash
# 查看当前使用的配置文件
pdd test config show

# 输出:
# Active Configuration:
#   Primary: ./cdp-test-config.yaml
#   User override: ~/.pdd/test-config.yaml
#   Default: <builtin>
#
# Config Hierarchy: command-line > user > project > default

# 使用指定的配置文件
pdd test replay tests/login.yaml --config my-custom-config.yaml

# 重置为默认配置
pdd test config reset
```

### 环境变量优先级

```
优先级（从高到低）:
1. 命令行参数 (--env KEY=VALUE)
2. 系统环境变量 (export KEY=VALUE)
3. .env 文件 (--env .env.file)
4. cdp-test-config.yaml 中的 env_mapping
5. 内置默认值
```

### 常用环境变量

```bash
# 必需的环境变量
export TEST_USER="your_username"
export TEST_PASS="your_password"
export BASE_URL="http://your-system"

# 可选的环境变量
export LOGIN_URL="${BASE_URL}/login"  # 有默认值
export TEST_PROJECT_NAME="测试项目"
export TEST_AMOUNT="100万"
export TEST_PHONE="13800138000"
export BROWSER="chromium"  # chrome | chromium | firefox
export HEADLESS="false"    # true | false
export LOG_LEVEL="info"    # trace | debug | info | warn | error
export SCREENSHOT_DIR="./test-results/screenshots/"
export REPORT_DIR="./test-results/reports/"

# MCP服务器配置
export CDP_HOST="localhost"
export CDP_PORT=9222
```

---

## 输出格式

### Console输出格式

```bash
# 指定输出格式
pdd test replay tests/login.yaml --format pretty  # 默认，彩色表格
pdd test replay tests/login.yaml --format json    # JSON对象
pdd test replay tests/login.yaml --format junit   # JUnit XML格式
pdd test replay tests/login.yaml --format markdown # Markdown表格
```

### JUnit XML格式（CI/CD友好）

```xml
<!-- pdd test replay tests/login.yaml --format junit -->
<testsuite name="login-001-portal-login" tests="5" failures="0" errors="0" time="1.451">
  <testcase classname="navigate" name="Step 1: Navigate to portal" time="0.230"/>
  <testcase classname="fill" name="Step 2: Fill username" time="0.145"/>
  <testcase classname="fill" name="Step 3: Fill password" time="0.152"/>
  <testcase classname="click" name="Step 4: Click login" time="0.890"/>
  <testcase classname="assert" name="Step 5: Verify homepage" time="0.034"/>
</testsuite>
```

### Markdown表格格式

```markdown
# pdd test replay tests/login.yaml --format markdown

| Step | Action    | Target           | Status | Duration |
|------|-----------|------------------|--------|----------|
| 1    | navigate  | portal login    | ✅ PASS | 230ms    |
| 2    | fill      | username input  | ✅ PASS | 145ms    |
| 3    | fill      | password input  | ✅ PASS | 152ms    |
| 4    | click     | login button    | ✅ PASS | 890ms    |
| 5    | assert    | homepage text   | ✅ PASS | 34ms     |
|------|-----------|------------------|--------|----------|
|      |           | **Total**       | **5/5** | **1451ms** |
```

---

## 退出码

| 退出码 | 含义 | CI/CD处理建议 |
|--------|------|---------------|
| 0 | 所有测试通过 | ✅ 构建继续 |
| 1 | 存在失败的测试 | ⚠️ 构建标记为unstable |
| 2 | 配置错误或用法错误 | ❌ 构建失败，检查参数 |
| 3 | 执行中断（用户取消或fatal错误） | ❌ 构建失败 |
| 130 | 被信号中断（Ctrl+C） | ⚠️ 构建取消 |

### CI/CD集成示例

#### Jenkins pipeline

```groovy
pipeline {
  agent any
  stages {
    stage('E2E Tests') {
      steps {
        script {
          def exitCode = sh(
            script: 'pdd test replay tests/**/*.yaml --format junit --output results/',
            returnStatus: true
          )
          
          junit 'results/**/*.xml'
          
          if (exitCode != 0) {
            error("E2E tests failed with exit code ${exitCode}")
          }
        }
      }
    }
  }
}
```

#### GitHub Actions

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install PDD CLI
        run: npm install -g @pdd/cli
      
      - name: Run E2E Tests
        env:
          TEST_USER: ${{ secrets.TEST_USER }}
          TEST_PASS: ${{ secrets.TEST_PASS }}
          BASE_URL: ${{ secrets.BASE_URL }}
        run: |
          pdd test replay tests/**/*.yaml \
            --format junit \
            --output results/ \
            --headless
      
      - name: Publish Test Report
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: test-reports
          path: results/**/*.html
```

---

## 📚 相关文档

- [铁律完整实现](./iron-rules-detail.md) - 执行规则详解
- [自愈机制详解](./self-healing-strategy.md) - 元素定位策略
- [错误处理与重试](./error-handling.md) - 异常处理
- [HTML报告模板](../templates/report-template.html) - 报告结构

---

## 快速命令速查

```bash
# 执行测试
pdd test replay <file>

# 验证格式
pdd test validate <file>

# 调试模式
pdd test replay <file> --debug

# 动作列表
pdd test actions list
pdd test actions search <keyword>
pdd test actions show <name>

# 缓存管理
pdd test cache stats
pdd test cache clear
pdd test cache export/import

# 报告生成
pdd test report --input <dir> -o <output>

# 帮助
pdd test --help
pdd test <command> --help
```

---

> **维护者**: PDD Team
> **最后更新**: 2026-05-08
> **版本**: 1.0.1
