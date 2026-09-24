# CDP 意图驱动型测试框架设计文档

> 版本：v0.1（设计稿）  
> 日期：2026-05-08  
> 状态：讨论中  
> 定位：pdd-skills-v3 新增能力 —— 基于 Chrome DevTools MCP 的自然语言驱动 E2E 测试框架

---

## 一、背景与动机

### 1.1 为什么放弃 Playwright？

Playwright 作为传统 E2E 测试框架，在实际落地中暴露了以下问题：

| 痛点 | 具体表现 |
|------|----------|
| **脚本维护成本高** | 选择器硬编码，前端改版后脚本大面积失效 |
| **对非技术人员不友好** | 测试人员需要理解 TypeScript / Selector 语法才能编写用例 |
| **等待策略不稳定** | `waitForSelector` 在 SPA（Vue/React）动态渲染场景下误判率高 |
| **调试体验差** | 异步错误堆栈难以定位，失败报告对业务人员不可读 |
| **与 AI 协同弱** | AI 无法直接"看到"浏览器当前状态，只能机械执行脚本 |

### 1.2 为什么选择 Chrome DevTools MCP？

Chrome DevTools Protocol（CDP）是 Playwright 的底层基础。直接使用 CDP + MCP，相当于移除了中间抽象层，让 AI Agent 直接操控浏览器的"神经系统"。

**核心优势**：

- **协议级感知**：通过 `DOM.getFlattenedDocument` 获取整个渲染树的实时状态，比 `waitForSelector` 更底层、更准确
- **语义化定位**：不依赖硬编码 CSS Selector，而是依赖元素的语义意图（文本、aria-label），前端换框架不影响测试
- **深度网络校验**：可以监控 `Network.requestWillBeSent`，验证底层 API 请求的参数和响应，而非仅看 UI 弹窗
- **自愈能力**：选择器失效时，AI 可以扫描 DOM 树做语义匹配，自动纠错并记录日志

---

## 二、整体设计思路

### 2.1 核心理念：意图驱动型测试（Intent-Driven Testing）

> **从"脚本中心"转向"意图中心"**

传统测试框架以**脚本文件**为中心（代码维护困难），本框架以**任务契约（YAML）**为中心：

- **测试人员**：用自然语言描述业务流程 → AI 生成 YAML 用例
- **AI Agent**：读取 YAML → 调用 Chrome DevTools MCP → 执行并生成报告
- **框架**：规范 YAML 结构 + 约束 AI 执行行为（通过 Skill 定义）

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
                    │  cdp-test-agent (Skill)      │
                    │  读取 YAML → 制定执行计划      │
                    └──────────────┬──────────────┘
                                   │ MCP 工具调用
                    ┌──────────────▼──────────────┐
                    │  Chrome DevTools MCP Server  │
                    │  navigate / click / inspect  │
                    │  evaluate / screenshot / ...  │
                    └──────────────┬──────────────┘
                                   │ CDP 原生响应
                    ┌──────────────▼──────────────┐
                    │  test-results/ 目录           │
                    │  screenshots + report.html   │
                    └─────────────────────────────┘
```

### 2.2 三层架构

```
┌──────────────────────────────────────────────────────┐
│  用例层 (tests/*.yaml)                                 │
│  测试人员维护，YAML 格式，业务语言描述，无代码             │
├──────────────────────────────────────────────────────┤
│  Skill 层 (skills/expert/cdp-test-agent/)             │
│  约束 AI 的执行行为：状态感知 / 原子化操作 / 自愈 / 报告  │
├──────────────────────────────────────────────────────┤
│  工具层 (Chrome DevTools MCP Server)                  │
│  navigate / click / inspect_dom / evaluate / network │
└──────────────────────────────────────────────────────┘
```

---

## 三、测试用例规范（YAML 契约）

### 3.1 标准用例结构

```yaml
# tests/功能模块名_场景描述.yaml

test_id: "MODULE-001"                   # 唯一标识，格式：模块-序号
title: "资产评估申请 - 正常路径测试"       # 人类可读的用例标题
priority: "P0"                          # P0=核心路径 / P1=重要 / P2=边界
tags: ["资产评估", "申请流程", "正常路径"]

# ── 前置状态感知 ────────────────────────────────────────────
context_check:
  login_url: "http://your-system/web/#/login"
  home_indicator: ".user-avatar"         # 已登录状态的 DOM 特征
  login_credentials:                     # 可选：如需重新登录时使用
    username_selector: "input[name='username']"
    password_selector: "input[name='password']"
    username: "${TEST_USER}"             # 从环境变量读取，不硬编码密码
    password: "${TEST_PASS}"

# ── 测试步骤 ────────────────────────────────────────────────
steps:
  - step: 1
    desc: "进入资产评估模块"
    action: "navigate_to"
    url: "http://your-system/web/#/asset-eval"
    assertion:
      type: "element_visible"
      target: "text('资产评估')"          # 页面特征元素，确认导航成功

  - step: 2
    desc: "点击新增申请按钮"
    action: "click"
    target: "button:has-text('新增申请')"  # 语义化定位，非 CSS 选择器
    assertion:
      type: "element_visible"
      target: "text('评估项目名称')"       # 表单弹出的特征

  - step: 3
    desc: "填写申请表单"
    action: "fill_form"
    fields:
      - label: "评估项目名称"
        value: "沈阳国资评估A-01"
      - label: "评估基准日"
        value: "2026-05-01"
      - label: "金额"
        value: "1000000"

  - step: 4
    desc: "提交申请并验证接口调用"
    action: "click_and_verify"
    target: "button:has-text('提交')"
    verify_network:                       # 深度网络校验
      url_pattern: "**/api/v1/eval/submit"
      method: "POST"
      response_code: 200
      response_body_contains:             # 可选：验证响应体字段
        - key: "code"
          value: 0
    verify_ui:
      type: "toast_visible"
      text: "操作成功"

# ── 后置清理（可选）────────────────────────────────────────
teardown:
  - action: "navigate_to"
    url: "http://your-system/web/#/asset-eval"
    desc: "返回列表页，保持测试环境整洁"
```

### 3.2 支持的 Action 类型

| Action | 说明 | 示例 |
|--------|------|------|
| `navigate_to` | 页面导航 | `url: "http://..."` |
| `click` | 点击元素（语义定位） | `target: "button:has-text('提交')"` |
| `fill_form` | 批量填写表单字段 | `fields: [{label: "名称", value: "xxx"}]` |
| `click_and_verify` | 点击并同步验证网络请求 | `verify_network: {...}` |
| `select_option` | 下拉框选择 | `label: "状态", option: "已完成"` |
| `upload_file` | 文件上传 | `file_path: "testdata/sample.pdf"` |
| `wait_for` | 等待某个条件成立 | `condition: "element_visible", target: "..."` |
| `screenshot` | 手动截图（自动步骤已内置） | `filename: "step_custom.png"` |
| `assert` | 断言验证 | `type: "element_text", target: "...", expected: "xxx"` |

### 3.3 断言类型

| Assertion 类型 | 说明 |
|----------------|------|
| `element_visible` | 元素可见 |
| `element_hidden` | 元素不可见 |
| `element_text` | 元素文本等于期望值 |
| `toast_visible` | 弹窗/消息提示出现 |
| `url_contains` | 当前 URL 包含某路径 |
| `network_called` | 特定 API 被调用 |
| `response_body_contains` | 响应体包含特定字段值 |

---

## 四、Skill 设计方案

### 4.1 新增两个 Skill

在 `skills/expert/` 下新增：

```
skills/expert/
├── cdp-test-agent/          # 执行技能：读取 YAML，调用 MCP，生成报告
│   ├── SKILL.md
│   ├── _meta.json
│   └── templates/
│       └── report-template.html
└── test-case-modeler/       # 建模技能：自然语言 → YAML 用例
    ├── SKILL.md
    ├── _meta.json
    └── examples/
        ├── asset-eval-apply.yaml    # 示例：资产评估申请
        └── login-flow.yaml          # 示例：登录流程
```

### 4.2 `cdp-test-agent` Skill 核心指令设计

**定位**：自动化测试执行专家。负责读取 YAML 用例，通过 Chrome DevTools MCP 执行测试，生成结构化报告。

**执行规则（Iron Law）**：

```
【铁律 1：状态感知优先】
在执行任何 steps 前，必须先检查 context_check.home_indicator 元素是否存在。
- 如果存在 → 直接执行 steps，严禁重复登录
- 如果不存在 → 执行登录流程，成功后再执行 steps

【铁律 2：原子化执行】
每完成一个 step，必须：
① 截图并保存到 test-results/screenshots/{test_id}/step_{n}.png
② 记录 CDP 响应原始数据
③ 评估该步骤的断言是否通过

【铁律 3：深度网络校验】
凡是 click_and_verify 类操作，必须通过 Network 工具监控目标 API。
- 如果接口未被调用 → 记录为 FAIL，即使 UI 弹窗显示"成功"
- 如果接口返回非期望状态码 → 记录为 FAIL，需额外截图抓取响应体

【铁律 4：自愈而非放弃】
如果按照 target 找不到元素，禁止直接报错。必须：
① 调用 DOM 工具扫描页面，寻找语义相近的元素（相同文字、aria-label）
② 尝试匹配并执行
③ 在报告中记录"选择器已自动修复"和新的定位方式
④ 如果自愈失败，记录完整诊断信息（当前 DOM 快照 + 错误详情）

【铁律 5：报告完整性】
执行完毕后，必须生成 test-results/{test_id}_report.html，包含：
- 每步的意图、实际操作、CDP 响应、截图
- 总体通过/失败汇总表
- 失败步骤的诊断建议
```

### 4.3 `test-case-modeler` Skill 核心指令设计

**定位**：测试用例建模师。负责将用户的自然语言描述转化为符合框架规范的 YAML 测试用例。

**输出规范**：

```
【输出规则 1：结构完整性】
必须包含 test_id / title / priority / context_check / steps。
不得省略任何必填字段。

【输出规则 2：智能意图提取】
从用户描述中提取：
- 导航动作 → navigate_to
- 输入/填写 → fill_form（按字段分组）
- 点击行为 → click 或 click_and_verify
- 选择操作 → select_option
- 验证期望 → assertion / verify_network / verify_ui

【输出规则 3：语义化选择器优先】
永远使用语义化定位，优先级：
① 文本定位：button:has-text('提交')
② Aria 标签：[aria-label='关闭']
③ 标签组合：label:has-text('项目名称') + input（关联输入框）
禁止使用 .class-name / #id / nth-child 等脆弱选择器

【输出规则 4：断言注入】
每个 step 必须配对一个断言。
- 导航步骤 → 断言目标页面特征可见
- 点击步骤 → 断言反馈（弹窗/跳转/元素变化）
- 提交步骤 → 优先使用 verify_network，同时配 verify_ui

【输出规则 5：生成后询问确认】
生成 YAML 后，向用户列出以下信息并询问是否确认保存：
- 用例 ID 和标题
- 步骤数量
- 核心校验点（网络接口 / UI 文本）
- 建议的测试数据（如果用户未指定）
```

---

## 五、项目目录结构规划

```
pdd-skills-v3/
├── skills/
│   └── expert/
│       ├── cdp-test-agent/         # [新增] CDP 测试执行 Skill
│       │   ├── SKILL.md
│       │   ├── _meta.json
│       │   └── templates/
│       │       └── report-template.html
│       └── test-case-modeler/      # [新增] 用例建模 Skill
│           ├── SKILL.md
│           ├── _meta.json
│           └── examples/
│               ├── asset-eval-apply.yaml
│               └── login-flow.yaml
│
├── tests/                          # [新增] 测试用例存储目录
│   ├── README.md                   # 用例编写指南
│   ├── _login-template.yaml        # 通用登录模板（可被引用）
│   └── asset-eval/                 # 按模块分组
│       ├── eval-apply-normal.yaml  # 正常路径
│       └── eval-apply-error.yaml   # 异常路径
│
├── test-results/                   # [新增] 测试结果输出（gitignore）
│   ├── screenshots/
│   └── *.html                      # 测试报告
│
└── docs/
    └── cdp-testing-framework-design.md  # 本文档
```

---

## 六、典型工作流程

### 6.1 用例生成流程（测试人员视角）

```
测试人员对 Trae 说：

"帮我写一个资产评估申请的测试用例。
 流程：已登录后，进入 /asset-eval，点击'新增申请'，
 在'项目名称'填'沈阳国资A-01'，'金额'填100万，
 提交后要确认接口 /api/v1/eval/submit 被调用并返回成功。"

                        ↓ test-case-modeler Skill

① AI 提取结构：navigate_to + click + fill_form + click_and_verify
② AI 推断选择器：button:has-text('新增申请') / button:has-text('提交')
③ AI 注入断言：每步骤配对断言 + verify_network
④ AI 生成 YAML 并列出摘要，询问确认

测试人员确认后 → 文件保存到 tests/asset-eval/eval-apply-normal.yaml
```

### 6.2 用例执行流程（测试人员视角）

```
测试人员对 Trae 说：

"请执行 tests/asset-eval/eval-apply-normal.yaml"

                        ↓ cdp-test-agent Skill

[铁律1] 检查登录状态 → 已登录，跳过登录流程
[Step 1] 导航到资产评估页 → 截图 step_1.png → 断言通过 ✓
[Step 2] 点击新增申请 → 截图 step_2.png → 断言通过 ✓
[Step 3] 填写表单 → 截图 step_3.png → 断言通过 ✓
[Step 4] 点击提交 → 监控网络...
         → /api/v1/eval/submit 被调用 ✓
         → 响应码 200 ✓
         → code=0 ✓
         → 截图 step_4.png ✓

生成 test-results/MODULE-001_report.html

Trae 输出：
"测试完成。4/4 步骤通过，0 个失败。
 报告已生成：test-results/MODULE-001_report.html"
```

### 6.3 自愈场景示例

```
[Step 2] 尝试点击 button:has-text('新增申请')
→ 元素未找到！

[自愈程序启动]
→ 扫描页面所有 button 元素
→ 发现：<button>新增</button>（文字被产品改为"新增"）
→ 语义匹配：与目标意图"新增申请"高度相关
→ 执行点击 <button>新增</button>
→ 断言验证通过

[报告记录]
⚠️ Step 2: 选择器已自动修复
   原选择器：button:has-text('新增申请')
   实际匹配：button:has-text('新增')
   建议：更新 YAML 用例以保持最新
```

---

## 七、与 pdd-skills-v3 的集成方式

### 7.1 作为独立的 Expert Skill

本框架作为两个独立的 Expert Skill 集成到现有的 `skills/expert/` 目录中，与现有技能并列，不修改任何现有文件：

```
skills/expert/
├── expert-bug-fixer/        # 已有：Bug 修复
├── expert-ruoyi/            # 已有：若依框架
├── cdp-test-agent/          # 新增：CDP 测试执行
└── test-case-modeler/       # 新增：用例建模
```

### 7.2 与 pdd-main 的协同（未来扩展）

在 `pdd-main` 的验证阶段（pdd-verify-feature）之后，可以选择性地触发 CDP 测试：

```
pdd-main 流程：
... → pdd-implement-feature → pdd-code-reviewer → pdd-verify-feature
                                                           ↓（可选）
                                                   cdp-test-agent
                                                   （对新功能执行 E2E 测试）
```

### 7.3 配置文件集成

在 `config/` 目录下新增测试框架配置：

```yaml
# config/cdp-test-config.yaml

# Chrome DevTools MCP 连接配置
mcp:
  server_type: "chrome-devtools"
  debug_port: 9222                   # Chrome 远程调试端口

# 全局测试设置
test_settings:
  screenshot_on_each_step: true      # 每步截图
  screenshot_on_failure: true        # 失败时截图
  network_monitor: true              # 启用网络监控
  self_healing: true                 # 启用自愈
  report_format: "html"              # 报告格式
  results_dir: "test-results"        # 结果输出目录
  
# 环境变量映射（测试账号从环境变量读取）
env_mapping:
  TEST_USER: "test_username"
  TEST_PASS: "test_password"
  BASE_URL: "http://your-system/web"
```

---

## 八、与 Playwright 的能力对比

| 维度 | Playwright | CDP + MCP（本框架） |
|------|-----------|-------------------|
| **选择器策略** | 硬编码 CSS/XPath | 语义化文本定位，自愈修复 |
| **用例编写者** | 需要会写代码 | 对话即用例，无代码 |
| **登录状态管理** | 手动处理 Cookie/Session | Skill 自动感知，按需登录 |
| **等待策略** | `waitForSelector` 可能误判 | CDP 实时 DOM 树，精确判断 |
| **网络校验** | 需要额外代码拦截 | 内置 `verify_network`，一行配置 |
| **失败自愈** | 直接抛错 | 语义重匹配，自动修复 |
| **报告可读性** | 技术报告，业务人员难读 | 包含截图+意图+结论，人人可读 |
| **AI 协同度** | AI 只能生成脚本 | AI 全程参与决策，上下文感知 |
| **维护成本** | 选择器变化就要改代码 | YAML 更新，无需写代码 |

---

## 九、实施路线图

### Phase 1：基础框架搭建（1-2天）

- [ ] 创建 `skills/expert/cdp-test-agent/SKILL.md` — 执行 Skill 的完整指令
- [ ] 创建 `skills/expert/test-case-modeler/SKILL.md` — 建模 Skill 的完整指令
- [ ] 创建 `tests/README.md` — 用例编写指南（含 YAML 字段说明和示例）
- [ ] 创建 `config/cdp-test-config.yaml` — 框架全局配置
- [ ] 创建 2-3 个 `tests/examples/` 示例用例

### Phase 2：试点验证（1周）

- [ ] 选择 1-2 个核心业务场景（如资产评估申请）进行试点
- [ ] 由测试人员通过对话生成 YAML 用例，验证建模 Skill 的可用性
- [ ] 执行用例，验证 cdp-test-agent 的执行准确性
- [ ] 收集自愈场景数据，优化 Skill 指令

### Phase 3：规范化与推广（持续）

- [ ] 整理试点期间发现的典型自愈案例，写入 Skill 的 examples
- [ ] 建立用例命名规范和分目录管理规范
- [ ] 考虑将测试执行集成到 pdd-main 的 pdd-verify-feature 阶段

---

## 十、关键设计决策记录

### 决策 1：为何用 YAML 而非 JSON 或纯自然语言？

- **vs JSON**：YAML 可读性更高，测试人员可以直接阅读和手动微调；支持注释（`#`），方便解释字段
- **vs 纯自然语言**：结构化格式防止 AI "偷懒"或曲解意图；格式统一确保不同人描述的用例执行一致

### 决策 2：为何不直接让 AI 在对话中执行，而要先生成 YAML？

- **可审计**：YAML 是明确的测试意图文档，可以 Git 追踪变更
- **可复用**：生成一次，多次执行，不需要每次重新描述
- **可维护**：系统改版时只需更新 YAML，不需要重新描述整个流程
- **AI 独立性**：不绑定特定 AI 模型，未来换模型也能执行同一套 YAML

### 决策 3：为何选择 Expert Skill 而非 Core Skill？

- Core Skill 是 pdd-main 流水线的一部分，有严格的输入/输出契约
- 测试执行是独立的、按需触发的工作，作为 Expert Skill 更灵活
- 测试人员可以单独使用这两个 Skill，不需要跑完整的 pdd-main 流程

---

## 十一、待讨论的开放问题

> 以下问题需要与用户进一步确认，以完善设计：

1. **MCP Server 选型**：目前市场上 Chrome DevTools MCP 实现有多个版本（`@modelcontextprotocol/server-chrome`、`mcp-server-puppeteer` 等），需要测试哪个在 Trae 中稳定可用？

2. **测试数据管理**：测试数据（如评估项目名称、金额）是每次随机生成、固定值、还是从数据文件读取？如何避免重复数据污染系统？

3. **跨会话 Session 保持**：Chrome DevTools MCP 能否保持登录 Session（Cookies）跨测试用例共享？还是每个用例都需要独立登录？

4. **并发执行**：是否有同时执行多个测试用例的需求？CDP 单实例能否支持并行测试？

5. **CI 集成**：是否需要将测试执行集成到 CI/CD 流水线（如 Jenkins/GitLab CI）中实现全自动化？

---

*文档版本 v0.1 — 欢迎提出修改建议*
