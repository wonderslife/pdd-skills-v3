# PDD Test Skill 设计文档（整合版）

> **版本**: v1.1（整合 Gemini 分析 + Claude Opus 设计 + Antigravity 评估修订）
> **日期**: 2026-05-08
> **状态**: 已批准（v1.1 评审修订）
> **类型**: 新功能设计
> **实施策略**: 方案 A — 纯 Skill 模式（不写 lib/ 代码，AI 直接驱动）
> **定位**: pdd-skills-v3 新增能力 —— 基于 Chrome DevTools MCP 的自然语言驱动 E2E 测试框架

***

## 一、背景与动机

### 1.1 为什么放弃 Playwright？

Playwright 作为传统 E2E 测试框架，在实际落地中暴露了以下问题：

| 痛点            | 具体表现                                           |
| ------------- | ---------------------------------------------- |
| **脚本维护成本高**   | 选择器硬编码（`div > span:nth-child(3)`），前端改版后脚本大面积失效 |
| **对非技术人员不友好** | 测试人员需要理解 TypeScript / Selector 语法才能编写用例        |
| **等待策略不稳定**   | `waitForSelector` 在 SPA（Vue/React）动态渲染场景下误判率高  |
| **调试体验差**     | 异步错误堆栈难以定位，失败报告对业务人员不可读                        |
| **录制重放准确度低**  | 录制生成的代码是静态死板的，登录状态、延迟等问题频发                     |
| **与 AI 协同弱**  | AI 无法直接"看到"浏览器当前状态，只能机械执行脚本                    |

### 1.2 为什么选择 Chrome DevTools MCP？

Chrome DevTools Protocol（CDP）是 Playwright 的底层基础。直接使用 CDP + MCP，相当于移除了中间抽象层，让 AI Agent 直接操控浏览器的"神经系统"。

**核心优势**：

| 优势              | 说明                                                          |
| --------------- | ----------------------------------------------------------- |
| **协议级感知**       | 通过 `take_snapshot` 获取整个渲染树的实时状态，比 `waitForSelector` 更底层、更准确 |
| **语义化定位 (UID)** | 不依赖硬编码 CSS Selector，而是依赖元素的语义意图（文本、role），前端换框架不影响测试         |
| **深度网络校验**      | 可以监控网络请求，验证底层 API 请求的参数和响应，而非仅看 UI 弹窗                       |
| **自愈能力**        | 选择器失效时，AI 可以扫描 DOM 树做语义匹配，自动纠错并记录日志                         |

### 1.3 核心需求

- **零代码**: 目标用户为实习生，无编程能力
- **自然语言驱动**: 通过对话方式描述测试步骤
- **Chrome DevTools MCP**: 替代 Playwright 作为浏览器控制层
- **YAML 脚本输出**: 从对话自动生成可回放的 YAML 文件
- **混合模式**: 支持实时交互 + 脚本批量回放
- **可扩展**: 动作定义可配置，无需修改代码
- **智能引导**: 未知动作时给出提示+修改建议+配置模板

***

## 二、整体设计思路

### 2.1 核心理念：意图驱动型测试（Intent-Driven Testing）

> **从"脚本中心"转向"意图中心"**

传统测试框架以**脚本文件**为中心（代码维护困难），本框架以\*\*任务契约（YAML）\*\*为中心：

- **测试人员**：用自然语言描述业务流程 → AI 生成 YAML 用例
- **AI Agent**：读取 YAML → 调用 Chrome DevTools MCP → 执行并生成报告
- **框架**：规范 YAML 结构 + 约束 AI 执行行为（通过 Skill 定义）

### 2.2 三层架构

```
┌──────────────────────────────────────────────────────┐
│  用例层 (tests/*.yaml)                                 │
│  测试人员维护，YAML 格式，业务语言描述，无代码             │
├──────────────────────────────────────────────────────┤
│  Skill 层 (skills/)                                   │
│  test-case-modeler: 自然语言→YAML                      │
│  cdp-test-agent:      读取YAML→MCP调用→报告            │
├──────────────────────────────────────────────────────┤
│  工具层 + 动作配置                                      │
│  Chrome DevTools MCP Server                           │
│  config/test-actions.yaml (可配置动作定义)              │
└──────────────────────────────────────────────────────┘
```

### 2.3 数据流

```
                    ┌─────────────────────────────┐
                    │      测试人员（非技术背景）     │
                    │  用自然语言描述业务操作步骤      │
                    └──────────────┬──────────────┘
                                   │ 对话输入
                    ┌──────────────▼──────────────┐
                    │  test-case-modeler (Skill)   │
                    │  自然语言 → 结构化 YAML 用例   │
                    └──────────────┬──────────────┘
                                   │ tests/*.yaml
                    ┌──────────────▼──────────────┐
                    │  cdp-test-agent (Skill)       │
                    │  读取 YAML → 制定执行计划      │
                    └──────────────┬──────────────┘
                                   │ MCP 工具调用
                    ┌──────────────▼──────────────┐
                    │  Chrome DevTools MCP Server  │
                    │  navigate / click / inspect  │
                    │  evaluate / screenshot / ...  │
                    └──────────────┬──────────────┘
                                   │ 执行结果
                    ┌──────────────▼──────────────┐
                    │  test-results/ 目录           │
                    │  screenshots + report.html   │
                    └─────────────────────────────┘
```

### 2.4 双 Skill 设计

采用两个独立 Skill 分工协作：

| Skill                | 定位        | 职责                      |
| -------------------- | --------- | ----------------------- |
| **testcase-modeler** | 测试用例建模师   | 自然语言 → YAML 用例（对话录入）    |
| **testcase-agent**   | 自动化测试执行专家 | 读取 YAML → MCP 调用 → 生成报告 |

**为何分离？**

- testcase-modeler 可独立使用（只生成用例不执行）
- testcase-agent 可独立执行已有 YAML 文件
- 职责单一，便于维护和调试
- 测试人员可以分步操作：先生成用例，确认后再执行

***

## 三、可配置动作系统

### 3.1 配置文件位置: `config/test-actions.yaml`

用户可以通过编辑此文件来扩展新动作，无需修改源代码。这是本框架区别于 Claude Opus 原版设计的**核心创新点**。

### 3.2 内置动作定义

```yaml
# === 页面导航 ===
navigate:
  display: "打开页面"
  patterns:
    - "打开 {url}"
    - "访问 {url}"
    - "导航到 {url}"
  mcp: navigate_page
  params:
    - name: url
      type: string
      required: true

# === 表单操作 ===
fill:
  display: "填写输入框"
  patterns:
    - "输入 {value} 到 {target}"
    - "在 {target} 输入 {value}"
  mcp: fill
  params:
    - name: target
      type: element
      required: true
    - name: value
      type: string
      required: true

click:
  display: "点击元素"
  patterns:
    - "点击 {target}"
    - "选择 {target}"
  mcp: click
  params:
    - name: target
      type: element
      required: true

select_option:
  display: "下拉选择"
  patterns:
    - "选择下拉框 {target} 的 {option}"
  mcp: select_option
  params:
    - name: target
      type: element
      required: true
    - name: option
      type: string
      required: true

fill_form:
  display: "批量填写表单"
  patterns:
    - "填写表单"
    - "依次填写以下字段"
  mcp: fill_form
  params:
    - name: fields
      type: array
      required: true

# === 文件操作（可扩展）===
upload_file:
  display: "上传文件"
  patterns:
    - "上传文件 {path} 到 {target}"
  mcp: upload_file
  params:
    - name: target
      type: element
      required: true
    - name: path
      type: filepath
      required: true

delete_file:
  display: "删除文件"
  patterns:
    - "删除 {target} 文件"
  mcp: click
  confirm: true

preview_file:
  display: "预览文件"
  patterns:
    - "预览 {target}"
  mcp: click
  follow_new_page: true

# === 断言验证 ===
assert_text:
  display: "文本断言"
  patterns:
    - "验证页面包含 {text}"
    - "检查显示 {text}"
  mcp: evaluate_script

assert_count:
  display: "记录数断言"
  patterns:
    - "确认有 {count} 条记录"
  mcp: evaluate_script

assert_visible:
  display: "元素可见断言"
  patterns:
    - "验证 {target} 可见"
    - "检查 {target} 显示"
  mcp: take_snapshot

# === 网络校验（深度验证）===
verify_network:
  display: "网络请求校验"
  patterns:
    - "验证接口 {url_pattern} 被调用"
    - "检查 API 返回 {code}"
  mcp: list_network_requests
  params:
    - name: url_pattern
      type: string
      required: true
    - name: method
      type: string
      default: "POST"
    - name: response_code
      type: number
      default: 200

# === 等待操作 ===
wait_for:
  display: "等待元素"
  patterns:
    - "等待 {text} 出现"
  mcp: wait_for

wait_for_navigation:
  display: "等待跳转"
  patterns:
    - "等待页面跳转"
    - "等待新页面打开"
  mcp: list_pages

# === 截图操作 ===
screenshot:
  display: "截图保存"
  patterns:
    - "截图"
    - "截图保存为 {name}"
  mcp: take_screenshot

scroll:
  display: "滚动页面"
  patterns:
    - "滚动到 {direction}"
    - "滚动到底部"
    - "向下滚动"
  mcp: evaluate_script
  script: |
    () => window.scrollTo(0, document.body.scrollHeight)
```

### 3.3 扩展方式

1. **直接编辑** `config/test-actions.yaml`
2. **创建覆盖文件** `config/test-actions-custom.yaml`
3. **API 动态注册**（高级用法）

### 3.4 未知动作处理与引导机制 ⭐

当用户输入的自然语言无法匹配任何内置动作时，系统**不会报错终止**，而是进入**智能引导模式**：

#### 3.4.1 处理流程

```
用户输入: "滚动页面到底部"
        │
        ▼
┌───────────────────────────────────────┐
│                          │
│  遍历所有动作的 patterns → 无匹配结果  │
└───────────────────┬───────────────────┘
                    ▼
┌───────────────────────────────────────┐
│  相似度分析                           │
│  计算输入与已有动作的语义相似度         │
└───────────────────┬───────────────────┘
                    ▼
┌───────────────────────────────────────┐
│  输出友好提示 + 修改建议              │
│  （含配置模板）                       │
└───────────────────────────────────────┘
```

#### 3.4.2 提示输出示例

**场景 A：完全无匹配**

```
❓ 我暂时不理解「滚动页面到底部」这个操作。

📚 当前支持的动作类型：
   📍 页面导航：打开、访问、导航到...
   ✏️ 表单操作：输入、填写、点击、选择...
   🔍 断言验证：验证、检查、确认...
   🌐 网络校验：验证接口、检查API返回...
   ⏳ 等待操作：等待出现、等待加载...
   📸 截图操作：截图、截图保存...
   📜 滚动操作：向上/向下/到底部...

💡 建议：
   方案1：换一种说法试试
   
   方案2：如果这是一个常用操作，可以添加自定义动作：
       
       scroll:
         display: "滚动页面"
         patterns:
           - "滚动 {direction}"
           - "滚动到页面底部"
         mcp: evaluate_script
         script: |
           () => window.scrollTo(0, document.body.scrollHeight)
```

**场景 B：部分匹配（给出最接近的建议）**

```
⚠️ 「拖拽文件到上传区域」暂不支持，但我发现你可能需要：

🎯 最接近的内置动作：
   upload_file - 上传文件
   支持的说法：
     • "上传文件 xxx 到 上传按钮"

💡 如果你确实需要「拖拽」功能，配置模板如下：

drag_drop:
  display: "拖拽文件"
  patterns:
    - "拖拽 {file} 到 {target}"
  mcp: upload_file
  params:
    - name: target
      type: element
      required: true
    - name: file
      type: filepath
      required: true
```

#### 3.4.3 智能建议策略表

| 场景         | 处理方式                      |
| ---------- | ------------------------- |
| **动词不认识**  | 列出所有支持的动词类别，推荐相似动词        |
| **目标元素模糊** | 提示使用更具体的描述，或提供当前页面的可选元素列表 |
| **参数缺失**   | 提示缺少哪些参数，给出示例             |
| **接近已有动作** | 显示最相似的内置动作 + 使用示例         |
| **全新操作类型** | 提供 YAML 配置模板，指导用户如何添加     |

#### 3.4.4 动作发现辅助命令

```bash
pdd test actions list           # 查看所有支持的动作
pdd test actions search "上传"  # 搜索特定动作
pdd test actions show upload_file  # 查看详情和用法示例
pdd test actions validate       # 验证自定义配置是否正确
```

<br />

***

## 四、YAML 测试用例规范

### 4.1 标准用例结构

```yaml
# tests/{module}/{scene}.yaml

test_id: "MODULE-001"                   # 唯一标识
title: "资产评估申请 - 正常路径测试"       # 人类可读标题
priority: "P0"                          # P0=核心 / P1=重要 / P2=边界
tags: ["资产评估", "申请流程", "正常路径"]
author: 通过对话录入

# ── 前置状态感知 ────────────────────────────────────────────
context_check:
  login_url: "http://uniportal.sjjk.com.cn/web/#/login"
  home_indicator: "统一门户（新）"        # 已登录状态的页面特征
  credentials:                            # 从环境变量读取，不硬编码密码
    username: "${TEST_USER}"
    password: "${TEST_PASS}"

# ── 测试步骤 ────────────────────────────────────────────────
steps:
  - step: 1
    desc: "打开统一门户"
    action: navigate
    url: "http://uniportal.sjjk.com.cn"
    assertion:
      type: text_contains
      expected: "欢迎登录"

  - step: 2
    desc: "输入登录凭据"
    action: fill
    target: "用户名输入框"
    value: "${TEST_USER}"
    locator:
      uid_cache_key: username_input
    assertion:
      type: field_filled

  - step: 3
    desc: "点击登录按钮"
    action: click
    target: "登录按钮"
    wait_after:
      type: navigation
      timeout: 10000
    assertion:
      type: text_contains
      expected: "统一门户（新）"

  - step: 4
    desc: "进入资产评估系统"
    action: click
    target: "资产评估系统"
    wait_after:
      type: new_page
    assertion:
      type: text_contains
      expected: "资产处置及评估系统"

  - step: 5
    desc: "展开资产评估菜单"
    action: click
    target: "资产评估菜单"

  - step: 6
    desc: "展开资产评估核准子菜单"
    action: click
    target: "资产评估核准"

  - step: 7
    desc: "点击核准申请"
    action: click
    target: "核准申请"
    assertion:
      type: text_contains
      expected: "项目名称"

  - step: 8
    desc: "验证记录数量"
    action: assert_count
    expected_min: 1

# ── 后置清理 ───────────────────────────────────────────────
teardown:
  - action: screenshot
    name: "test-result-{timestamp}.png"
```

### 4.2 支持的 Action 类型

| Action           | 说明                            | 来源   |
| ---------------- | ----------------------------- | ---- |
| `navigate`       | 页面导航                          | 内置   |
| `click`          | 点击元素（UID定位）                   | 内置   |
| `fill`           | 填写单个字段                        | 内置   |
| `fill_form`      | 批量填写表单                        | 内置   |
| `select_option`  | 下拉框选择                         | 内置   |
| `upload_file`    | 文件上传                          | 可扩展  |
| `wait_for`       | 等待元素出现                        | 内置   |
| `screenshot`     | 手动截图                          | 内置   |
| `assert_text`    | 文本断言                          | 内置   |
| `assert_count`   | 记录数断言                         | 内置   |
| `assert_visible` | 元素可见性断言                       | 内置   |
| `verify_network` | 深度网络校验                        | 内置   |
| `scroll`         | 滚动页面                          | 内置   |
| `custom`         | 自定义动作（从 test-actions.yaml 加载） | 用户扩展 |

### 4.3 断言类型

| Assertion 类型             | 说明           | 必配对步骤              |
| ------------------------ | ------------ | ------------------ |
| `text_contains`          | 页面包含期望文本     | navigate, click    |
| `element_visible`        | 元素可见         | click              |
| `element_hidden`         | 元素不可见        | delete             |
| `element_text`           | 元素文本等于期望值    | fill, form         |
| `toast_visible`          | 弹窗/消息提示出现    | submit             |
| `url_contains`           | 当前 URL 包含某路径 | navigate           |
| `network_called`         | 特定 API 被调用   | click\_and\_verify |
| `response_body_contains` | 响应体包含特定值     | verify\_network    |
| `count_at_least`         | 记录数不少于N      | list page          |
| `field_filled`           | 字段已填写        | fill               |

### 4.4 字段说明

| 字段                   | 必填        | 说明                         |
| -------------------- | --------- | -------------------------- |
| test\_id             | 是         | 唯一标识，格式：模块-序号              |
| title                | 是         | 人类可读的用例标题                  |
| priority             | 是         | P0/P1/P2                   |
| context\_check       | 是         | 前置状态感知（登录检测）               |
| steps                | 是         | 测试步骤数组                     |
| steps\[].step        | 是         | 步骤序号                       |
| steps\[].desc        | 是         | 步骤描述                       |
| steps\[].action      | 是         | 动作类型（对应 test-actions.yaml） |
| steps\[].params      | 视动作       | 动作参数                       |
| steps\[].locator     | 否         | UID 缓存配置                   |
| steps\[].assertion   | **是（强制）** | 每步必须配对断言                   |
| steps\[].wait\_after | 否         | 执行后等待条件                    |
| teardown             | 否         | 后置清理                       |

***

## 五、testcase-agent 执行规则（Iron Law）

### 5.1 五条铁律

**【铁律 1：状态感知优先】**
在执行任何 steps 前，必须先检查 `context_check.home_indicator` 是否存在：

- 如果存在 → 直接执行 steps，严禁重复登录
- 如果不存在 → 执行登录流程，成功后再执行 steps

**【铁律 2：原子化执行】**
每完成一个 step，必须：
① 截图并保存到 `test-results/screenshots/{test_id}/step_{n}.png`
② 记录 CDP/MCP 响应原始数据
③ 评估该步骤的断言是否通过

**【铁律 3：深度网络校验】**
凡是涉及提交/保存的操作，必须通过网络工具监控目标 API：

- 如果接口未被调用 → 记录为 FAIL，即使 UI 显示"成功"
- 如果接口返回非期望状态码 → 记录为 FAIL，需额外截图抓取响应信息

**【铁律 4：自愈而非放弃】**
如果按照 target 找不到元素，禁止直接报错。必须：
① 调用 `take_snapshot` 扫描页面，寻找语义相近的元素
② 尝试匹配并执行
③ 在报告中记录"选择器已自动修复"和新的定位方式
④ 如果自愈失败，记录完整诊断信息（当前 DOM 快照 + 错误详情）

**【铁律 5：报告完整性】**
执行完毕后，必须生成 `test-results/{test_id}_report.html`，包含：

- 每步的意图、实际操作、MCP响应、截图
- 总体通过/失败汇总表
- 失败步骤的诊断建议

### 5.2 自愈详细流程

```
[Step N] 尝试点击 target: "新增申请按钮"
→ 查找 UID 缓存... 未找到
→ 语义匹配... 未找到精确匹配
→ 启动自愈程序:

   ① 调用 take_snapshot() 获取完整 DOM 树
   ② 扫描所有 button/链接元素
   ③ 发现：<button>新增</button> (文字被产品改为"新增")
   ④ 语义相似度计算: 0.87 (高度相关)
   ⑤ 执行点击 <button>新增</button>
   ⑥ 断言验证... ✓ PASS

[报告记录]
⚠️ Step N: 选择器已自动修复
   原始目标: "新增申请按钮"
   实际匹配: button[text="新增"]
   相似度: 87%
   建议: 更新 YAML 用例以保持最新
```

### 5.3 重试策略

```yaml
retry:
  max_attempts: 3
  backoff: 1000ms          # 指数退避
  self_heal_before_retry: true  # 重试前先尝试自愈
```

***

## 六、testcase-modeler 建模规则

### 6.1 输出规范

**【规则 1：结构完整性】**
必须包含 `test_id / title / priority / context_check / steps`，不得省略必填字段。

**【规则 2：智能意图提取】**
从用户描述中提取：

- 导航动作 → `navigate`
- 输入/填写 → `fill` 或 `fill_form`（按字段分组）
- 点击行为 → `click`
- 选择操作 → `select_option`
- 验证期望 → 对应断言类型
- 接口验证 → `verify_network`

**【规则 3：语义化选择器优先】**
永远使用语义化描述，禁止使用 CSS 类名/ID/nth-child：

- 文本定位：`"登录按钮"` `"资产评估系统"`
- Aria 标签：`[aria-label='关闭']`
- 标签组合：`"项目名称输入框"`

**【规则 4：断言注入】**
每个 step **必须** 配对一个 assertion：

- 导航步骤 → 断言目标页面特征
- 点击步骤 → 断言反馈（弹窗/跳转/元素变化）
- 提交步骤 → 优先使用 `verify_network`，同时配 UI 断言

**【规则 5：安全处理】**
用户名、密码等敏感信息必须使用环境变量 `${TEST_USER}`，禁止硬编码。

**【规则 6：生成后确认】**
生成 YAML 后，向用户列出：

- 用例 ID 和标题
- 步骤数量
- 核心校验点（网络接口/UI文本）
- 建议的测试数据（如用户未指定）

***

## 七、元素定位策略

### 7.1 定位优先级

| 优先级 | 策略         | 说明                      |
| --- | ---------- | ----------------------- |
| 1   | **UID 缓存** | 优先使用上次成功的 UID（最稳定）      |
| 2   | **语义匹配**   | 从快照中按 role/name/text 匹配 |
| 3   | **文本匹配**   | 按可见文本内容查找               |
| 4   | **AI 辅助**  | 让 LLM 从快照中选择最佳元素        |

### 7.2 UID 缓存机制

解决 Playwright 选择器脆弱问题的关键创新：

```yaml
# 录制时自动缓存 UID
- action: fill
  params:
    target: "用户名输入框"
  locator:
    uid_cache_key: username_input  # 下次直接用此 key 查找
```

缓存存储位置：`test-results/.uid-cache/{module}.json`

***

## 八、回放机制

### 8.1 命令行接口

```bash
# ===== 对话式录制（test-case-modeler）=====
pdd test record -m <module> -n <name>

# ===== 脚本回放（cdp-test-agent）=====
pdd test replay <script.yaml>
pdd test replay <script.yaml> --debug       # 单步调试模式
pdd test replay ./tests/<module>/            # 批量回放目录

# ===== 报告 =====
pdd test report --input ./tests/ -o ./test-results/reports/

# ===== 动作管理 =====
pdd test actions list                        # 列出所有动作
pdd test actions search "<keyword>"           # 搜索动作
pdd test actions show <action_name>           # 查看动作详情
pdd test actions validate                     # 验证配置
```

### 8.2 回放执行流程

```
1. 加载 YAML 脚本 + test-actions.yaml
2. [铁律1] 检查 context_check（登录状态感知）
3. 逐条执行 steps:
   a. 查找动作定义 (ActionRegistry)
   b. 解析元素定位 (Locator Strategy: UID缓存→语义→文本→AI)
   c. 调用 Chrome DevTools MCP
   d. [铁律2] 截图 + 记录响应
   e. 执行 assertion
   f. 失败时 [铁律4] 自愈 → 重试
4. [铁律5] 生成 HTML 报告
```

***

## 九、与 PDD 工作流集成

```
PRD → 功能提取 → 规格生成 → 代码实现 → 测试验证
                                  ↓           ↓
                            pdd-implement  pdd-test
                                              │
                                   ┌──────────┴──────────┐
                                   │  testcase-modeler   │
                                   │  (对话→YAML)          │
                                   ├──────────────────────┤
                                   │  testcase-agent       │
                                   │  (YAML→执行→报告)     │
                                   └──────────────────────┘
```

### 与 pdd-main 协同（可选）

在 `pdd-verify-feature` 之后，可选择触发 CDP 测试：

```
pdd-main 流程：
... → pdd-implement → pdd-code-reviewer → pdd-verify-feature
                                                           ↓（可选）
                                                   testcase-agent
                                                   （对新功能执行 E2E 测试）
```

***

## 十、项目目录结构

> **实施策略说明**：采用方案 A（纯 Skill 模式），不编写 `lib/test-engine/` 代码模块。
> NLU 解析、语义匹配、自愈决策等能力由 AI Agent（Trae 中的 LLM）天然提供，
> 无需将这些能力"固化"成 JS 代码。Skill 指令 + 动作配置即可约束 AI 行为。

```
pdd-skills-v3/
├── config/
│   ├── test-actions.yaml         # 动作配置（用户可编辑）⭐
│   ├── test-actions-custom.yaml  # 用户自定义动作覆盖
│   └── cdp-test-config.yaml      # 全局测试配置
│
├── skills/
│   └── expert/                   # Expert Skill 分类
│       ├── testcase-agent/       # 执行 Skill ⭐
│       │   ├── SKILL.md          # 含 5 条 Iron Law，AI 直接读取并遵循
│       │   ├── _meta.json
│       │   ├── templates/
│       │   │   └── report-template.html
│       │   └── evals/
│       │       └── default-evals.json
│       └── testcase-modeler/    # 建模 Skill ⭐
│           ├── SKILL.md          # 含 6 条建模规则，AI 直接读取并遵循
│           ├── _meta.json
│           ├── examples/
│           │   ├── asset-eval-apply.yaml
│           │   └── login-flow.yaml
│           └── evals/
│               └── default-evals.json
│
├── tests/                         # 测试用例存储（用户维护）
│   ├── README.md                  # 用例编写指南
│   ├── _login-template.yaml      # 通用登录模板
│   └── {module}/                 # 按模块分组
│       ├── {scene}-normal.yaml
│       └── {scene}-error.yaml
│
├── test-results/                  # 测试结果输出（.gitignore）
│   ├── screenshots/              # 每步截图
│   ├── .uid-cache/               # UID 缓存（按模块分文件）
│   └── *.html                    # HTML 测试报告
│
└── docs/
    └── superpowers/specs/
        └── 2026-05-08-pdd-test-skill-design.md  # 本文档
```

***

## 十一、全局配置

### 11.1 `config/cdp-test-config.yaml`

```yaml
mcp:
  server_type: "Chrome DevTools MCP"

test_settings:
  screenshot_on_each_step: true      # 每步截图
  screenshot_on_failure: true        # 失败时额外截图
  network_monitor: true              # 启用网络监控
  self_healing: true                 # 启用自愈
  report_format: "html"              # 报告格式
  results_dir: "test-results"        # 结果输出目录（独立于 testcases/）

# 环境变量映射（安全）
# 注意：实际值必须通过系统环境变量设置，此处仅声明变量名
# 设置方式：
#   Windows: set TEST_USER=your_username
#   Linux:   export TEST_USER=your_username
env_variables:
  - TEST_USER                        # 测试账号用户名
  - TEST_PASS                        # 测试账号密码
  - BASE_URL                         # 系统基础 URL

retry:
  max_attempts: 3
  backoff: 1000ms
  self_heal_before_retry: true
```

***

## 十二、与 Playwright 能力对比

| 维度         | Playwright           | 本框架 (CDP + MCP)         |
| ---------- | -------------------- | ----------------------- |
| **选择器策略**  | 硬编码 CSS/XPath        | UID缓存 + 语义化文本，自愈修复      |
| **用例编写者**  | 需要会写 TS 代码           | 对话即用例，零代码               |
| **登录状态管理** | 手动 Cookie/Session    | context\_check 自动感知     |
| **等待策略**   | waitForSelector 可能误判 | CDP 实时 DOM 快照，精确判断      |
| **网络校验**   | 需要额外代码拦截             | 内置 verify\_network，一行配置 |
| **失败自愈**   | 直接抛错                 | 语义重匹配 + 自动修复 + 报告记录     |
| **报告可读性**  | 技术报告                 | 含截图+意图+结论，人人可读          |
| **AI 协同度** | AI 只能生成脚本            | AI 全程参与决策，上下文感知         |
| **维护成本**   | 选器变化就要改代码            | YAML 更新或自动自愈            |
| **动作扩展性**  | 需改代码                 | 编辑 YAML 即可              |
| **未知动作处理** | 报错                   | 智能引导 + 配置模板             |
| **目标用户**   | 开发者                  | **实习生/非技术人员**           |

***

## 十三、实施路线图

### Phase 1：纯 Skill 模式落地（1-2 天）⭐ 当前阶段

> **策略**：不写任何 JS 代码。AI Agent 天然具备 NLU、语义匹配、决策能力，
> 全靠 Skill 指令 + 动作配置约束其行为。

- [ ] 创建 `skills/expert/testcase-agent/SKILL.md` — 含 5 条 Iron Law
- [ ] 创建 `skills/expert/testcase-modeler/SKILL.md` — 含 6 条建模规则
- [ ] 创建 `config/test-actions.yaml` — 内置动作定义（§三 完整内容）
- [ ] 创建 `config/cdp-test-config.yaml` — 全局配置
- [ ] 创建 `tests/README.md` — 用例编写指南
- [ ] 创建 2 个示例 YAML 用例（登录流程 + 资产评估申请）
- [ ] 创建 `test-results/` 目录 + `.gitignore`

### Phase 2：试点验证（1 周）

- [ ] 确认 Trae 中 Chrome DevTools MCP 实际可用的工具列表
- [ ] 选择 1-2 个核心业务场景进行试点
- [ ] 由测试人员通过对话生成 YAML 用例，验证 testcase-modeler 可用性
- [ ] 执行用例，验证 testcase-agent 的 5 条铁律是否被正确遵循
- [ ] 收集自愈场景数据，优化 Skill 指令措辞
- [ ] 验证 HTML 报告生成的完整性

### Phase 3：优化与规范化（持续）

- [ ] 整理试点期间的典型自愈案例，写入 Skill 的 examples/
- [ ] 建立用例命名规范和分目录管理规范
- [ ] 完善 test-actions.yaml，补充业务特有的自定义动作
- [ ] 考虑将测试执行集成到 pdd-main 的 pdd-verify-feature 阶段

### Phase 4：按需工程化（当纯 Skill 模式不够用时）

> **触发条件**：仅当以下情况出现时才进入此阶段：
> - 需要 CI/CD 无人值守批量执行
> - 需要跨团队标准化 CLI 命令
> - AI 执行一致性不满足生产要求

- [ ] 添加 CLI 入口（`pdd test replay`）
- [ ] 添加 HTML 报告模板（report-template.html）
- [ ] 按需实现轻量辅助脚本（非完整 test-engine）

***

## 十四、关键设计决策

| 决策             | 选择                  | 理由                         |
| -------------- | ------------------- | -------------------------- |
| 浏览器控制          | Chrome DevTools MCP | 比 Playwright 更稳定、UID 定位更精准 |
| 脚本格式           | YAML                | 可读性高、支持注释、Git 友好、结构化防歧义    |
| 动作定义           | 外部 YAML 配置          | 用户可自行扩展，无需改代码              |
| 双 Skill 分离     | modeler + agent     | 职责单一、可独立使用、便于维护            |
| 元素定位           | UID 缓存 + 语义匹配       | 解决选择器脆弱性问题                 |
| 执行约束           | 5 条 Iron Law        | 确保执行质量、报告完整性               |
| 安全方案           | 环境变量 ${VAR}         | 密码不硬编码                     |
| 目标用户体验         | 对话式 + 智能引导          | 零代码门槛，适合实习生                |
| 为何先生成 YAML 再执行 | 可审计、可复用、可维护、模型无关    | 见 §十 决策 2                  |

***

## 十五、风险与缓解

| 风险        | 影响     | 缓解措施                      |
| --------- | ------ | ------------------------- |
| 自然语言理解歧义  | 动作识别错误 | 智能引导 + 确认机制 + 相似度推荐       |
| 页面结构变化    | UID 失效 | 多策略降级 + 自愈引擎 + AI 辅助重定位   |
| MCP 服务不稳定 | 执行失败   | 重试机制 + 错误恢复 + 诊断日志        |
| 复杂流程难以表达  | 脚本过长   | 支持子流程引用 / 模板复用            |
| 测试数据污染    | 数据重复   | 环境变量 + 数据隔离 + teardown 清理 |
| 并发执行冲突    | 单实例限制  | Phase 4 考虑多实例支持           |

