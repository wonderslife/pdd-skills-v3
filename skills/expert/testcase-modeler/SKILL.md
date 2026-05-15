# Testcase Modeler Skill - 测试用例建模师

> **版本**: 2.0.0
> **分类**: Expert Skill
> **作者**: PDD Team
> **最后更新**: 2026-05-14

---

## 📌 技能概述

**Testcase Modeler** 是一个将**自然语言描述（或页面操作录制）转换为结构化 YAML 测试用例**的 AI 技能。它让测试人员无需编写任何代码，只需用日常语言描述业务操作流程，即可自动生成符合规范的、可回放的 E2E 测试脚本。

### 核心价值

- ✅ **零代码门槛**: 会说中文就能写测试用例
- ✅ **智能意图提取**: 自动识别导航、输入、点击、验证等操作
- ✅ **断言自动注入**: 每个步骤自动配对合适的断言
- ✅ **安全处理**: 密码等敏感信息自动使用环境变量
- ✅ **特殊组件支持**: 自动处理 el-select 多选框、spinbutton 数字输入等复杂组件
- ✅ **标准输出**: 生成符合规范的 YAML + 配套 .env 文件

### 适用场景

| 用户类型 | 使用场景 | 示例 |
|---------|---------|------|
| **实习生** | 学习业务流程/零基础入门 | "帮我录制一下登录流程"、"我不会写代码" |
| **测试人员** | 快速编写用例/回归测试 | "生成资产评估申请的测试用例" |
| **业务人员** | 验证功能/业务流程确认 | "帮我测一下这个功能是否正常" |
| **开发人员** | 回归测试/E2E自动化 | "把这套操作录下来以后可以重放" |
| **项目经理** | 验收测试/场景覆盖 | "验证这个功能的正常路径和异常路径" |

---

## 🎯 触发条件（v2.0）

**⚡ 主动触发原则**：当用户提到以下任何关键词或场景时，即使没有明确要求"生成测试用例"，也应主动使用本技能帮助创建标准化测试脚本。

### 🇨🇳 中文触发词（口语化 + 正式）

#### 核心触发词（必识别）
- "帮我写个测试用例" / "写个测试"
- "录制测试流程" / "帮我录个操作"
- "生成自动化测试" / "生成测试"
- "把这个操作录下来" / "把这个流程记下来"
- "测试一下 XXX 功能" / "帮我验证 XXX 流程"

#### 场景化触发词
- "实习生不会写代码" / "零基础写测试"
- "用大白话描述测试" / "自然语言转测试"
- "回归测试" / "冒烟测试" / "功能验证"
- "UI自动化" / "浏览器测试" / "E2E自动化"
- "验收测试" / "场景测试" / "业务流程测试"
- "Chrome DevTools测试" / "MCP测试"

#### 新增 v2.0 触发词
- "在页面上操作记录一下" / "录屏并生成用例"
- "页面操作自动化" / "浏览器操作回放"
- "下拉选择怎么选" / "多选框怎么填"
- "数字输入框填值" / "金额字段填写"

### 🧠 上下文智能识别

当对话中同时出现以下元素时，**强烈建议触发**：

1. **操作序列描述**：用户描述了一系列UI操作步骤
2. **业务系统提及**：提到了具体的业务系统或页面
3. **测试意图表达**：明确或隐含的验证需求
4. **能力限制声明**：用户表明自己不会编程
5. **组件操作困难**：用户提到下拉框选不了、数字框填不进等具体问题

---

## 📐 六条建模规则（Iron Rules v2.0）

> ⚠️ **必须严格遵守以下规则**，确保生成的 YAML 用例质量。

### 规则 1：结构完整性 + .env 配对文件（Structure Completeness）

每个生成的 YAML 用例**必须包含**以下必填字段：

```yaml
test_id: "{MODULE}-{NNN}-{name}"     # 唯一标识符
title: "{人类可读标题}"               # 清晰的用例名称
priority: "P0/P1/P2"                 # 优先级
tags: ["{标签1}", "{标签2}"]          # 分类标签
author: "通过对话录入"                 # 来源标注

context_check:                        # 前置状态感知（必填！）
  login_url: "..."                    # 登录页 URL
  home_indicator: "..."              # 已登录状态的特征文本
  credentials:
    username: "${TEST_USER}"         # 环境变量引用
    password: "${TEST_PASS}"         # 禁止明文密码！

steps:                               # 测试步骤数组（至少 1 步）

teardown:                             # 后置清理（可选）
```

**🆕 .env 配对文件（v2.0 新增）**

每个 YAML 用例必须配套一个同目录、同名的 `.env` 文件：

```
testcases/examples/
├── asset-eval-apply.yaml       # 测试用例
├── asset-eval-apply.env        # 该用例的环境变量 ← 必须创建！
├── login-flow.yaml             # 另一个用例
└── login-flow.env              # 另一个用例的环境变量
```

`.env` 文件格式：
```env
# 资产评估申请 - 环境变量配置
# 与 asset-eval-apply.yaml 同目录，执行时自动加载
TEST_USER=yuanye
TEST_PASS=yuanye
TEST_DISPLAY_NAME=袁野
TEST_PROJECT_NAME=AI自动测试项目-001
TEST_AMOUNT=1000000
```

**关键规则**：
- 框架**不再硬编码任何默认值**
- 所有测试数据必须通过 `.env` 文件或系统环境变量提供
- `.env` 文件与 YAML 同目录同名，执行时自动加载
- 执行后自动清理环境变量，互不干扰

**验收清单**：
- [ ] `test_id` 存在且格式正确
- [ ] `title` 存在且有意义
- [ ] `priority` 是 P0/P1/P2 之一
- [ ] `context_check` 包含 login_url 和 credentials
- [ ] `steps` 数组非空
- [ ] 每个步骤都有 `step`, `desc`, `action`
- [ ] 🆕 已创建配套的 `.env` 文件

---

### 规则 2：智能意图提取（Intent Extraction）

从用户的自然语言描述中，**自动映射**到对应的动作类型：

#### 动作映射表

| 用户表述关键词 | 映射动作 (action) | 参数示例 |
|--------------|------------------|---------|
| 打开/访问/跳转/进入/导航 | `navigate` | url: "http://..." |
| 输入/填写/填入/键入 | `fill` | target + value |
| 点击/选择/按一下/单击 | `click` | target |
| 选择下拉/选中/勾选(下拉框) | `select_option` | target + option (中文显示名) |
| 勾选复选框 | `checkbox` | target + checked |
| 上传/附件/文件 | `upload_file` | target + path |
| 提交/保存/确认/登录 | `click`（提交按钮） | target |
| 等待/加载/等到 | `wait_for` | text |
| 截图/拍照/截屏 | `screenshot` | name |
| 验证/检查/确认/应该 | `assert_*` 系列 | expected |
| 滚动/向下/向上 | `scroll` | direction |

#### 🆕 特殊动作说明（v2.0 新增）

**select_option — 下拉选择器（重要！）**

专门用于 `<select>` 和自定义下拉组件（如 Element UI `el-select`）：

```yaml
# el-select 单选/多选 — 使用中文显示名！
- step: N
  action: select_option
  target: "请选择评估方法"       # placeholder 或 label 文本
  option: "市场法"                # 中文显示名（非代码值）
```

框架会**自动处理**以下细节：
- 检测元素是否为 readonly（如 el-select 的 input）
- 对 readonly 元素自动切换为 JS DOM click 模式
- 通过 evaluate_script 在 DOM 中找到选项并 click
- 支持中文名称匹配（无需知道字典代码值如 'market'）

**fill — 数字输入框（spinbutton）**

```yaml
# spinbutton 数字输入框 — 正常 fill 即可
- step: N
  action: fill
  target: "请输入报送评估值"      # placeholder 文本
  value: "${TEST_AMOUNT}"
```

⚠️ spinbutton 是独立交互角色，如果发现 fill 定位到了错误的文本框而非数字框，检查 target 是否足够精确。

---

### 规则 3：三层层语义化定位（Semantic Selector v2.0）

**永远使用人类可读的语义化描述**作为元素定位方式。框架采用三层解析策略：

```
P0 (最高优先级) → locator.uid_cache_key 缓存命中 → 直接使用 UID
P1 (中等优先级) → _exact_match_uid() 精确文本匹配 → target文本包含在元素中
P2 (兜底)     → 模糊评分匹配 → TF-IDF相似度排序取最佳
```

❌ **禁止使用的定位方式**：
- CSS 类名：`.btn-primary`, `#submit-btn`
- XPath：`//div[@class='container']/button[3]`
- nth-child：`:nth-child(2)`
- 任意硬编码的选择器

✅ **推荐的定位方式**：

| 定位策略 | 示例 | 适用场景 |
|---------|------|---------|
| **UID 缓存** | `uid_cache_key: "username_input"` | 同一元素多次操作（首选！） |
| **占位符文本** | `"请输入报送评估值"` | 表单字段精确匹配 |
| **ARIA 标签** | `[aria-label='关闭']` | 无障碍属性 |
| **语义组合** | `"用户名输入框"` | 类型+用途 |
| **Role + 文本** | `button"提交"` | 元素角色+文本 |

**UID 缓存机制**（增强稳定性）：

```yaml
# 首次成功定位后，自动缓存 UID
- step: 2
  action: fill
  target: "用户名输入框"
  value: "${TEST_USER}"
  locator:
    uid_cache_key: "username_input"  # P0: 后续直接用此 key

# 后续步骤复用缓存（跳过搜索，直接命中）
- step: 8
  action: fill
  target: "用户名输入框"
  locator:
    uid_cache_key: "username_input"  # P0 命中!
```

**🆕 交互角色识别（v2.0 新增）**

框架能识别以下 **15 种交互角色**，只有这些角色的元素才会被作为操作目标：

| 角色 | 典型元素 | 注意事项 |
|------|---------|---------|
| `button` | 按钮、链接按钮 | |
| `textbox` | 文本输入框、el-select input | |
| `input` | 通用输入 | |
| `combobox` | 组合框 | |
| `select` | 原生下拉框 | |
| `checkbox` | 复选框 | |
| `radio` | 单选框 | |
| **`spinbutton`** | **数字输入框** | ⚠️ 易遗漏！ |
| `menuitem` | 菜单项 | |
| `option` | 选项 | |
| `tab` | 标签页 | |
| `treeitem` | 树节点 | |
| `slider` | 滑块 | |
| `switch` | 开关 | |
| `link` | 链接 | |

💡 **常见陷阱**：`spinbutton`（数字输入框）容易被遗漏导致定位到错误元素。如果发现 fill 定位到了邻近的文本框而非数字框，就是这个问题。

---

### 规则 4：断言注入（Assertion Injection）

**每一步操作都必须配对一个断言**（Assertion），用于验证操作结果。

#### 断言类型选择指南

| 操作类型 | 推荐断言类型 | 断言目标 | 示例 |
|---------|------------|---------|------|
| **navigate** | `text_contains` / `element_visible` | 页面特征文本 | 包含"欢迎登录" |
| **click** (导航) | `text_contains` / `element_visible` | 新出现的元素 | 显示"资产管理" |
| **click** (提交) | `network_called` + `toast_visible` | API调用+提示 | 接口被调用且显示"保存成功" |
| **fill** | `field_filled` / `element_text` | 输入框值 | 字段已填入指定值 |
| **select_option** | `element_text` | 选中项显示 | 显示"市场法 ×" |
| **delete** | `element_hidden` | 元素消失 | 记录已从列表移除 |
| **upload** | `element_visible` | 上传后的预览 | 显示文件名和大小 |

#### 断言模板库

```yaml
# 导航后验证
assertion:
  type: text_contains
  expected: "期望出现的文本"

# 点击后验证元素出现
assertion:
  type: element_visible
  expected: "目标元素描述"

# 点击后验证 API 调用（深度校验）
assertion:
  type: network_called
  url_pattern: "/api/target/*"
  method: POST
  response_code: 200

# 表单提交后双重验证
assertions:
  - type: toast_visible
    expected: "保存成功"
  - type: network_called
    url_pattern: "/api/save"
    response_body_contains: '"code":0'
```

**强制要求**：
- [ ] 每个 step 都有 assertion 字段
- [ ] assertion.type 必须是已知类型
- [ ] assertion.expected 不能为空
- [ ] 提交/保存类操作建议包含 network_called 断言

---

### 规则 5：安全处理 + 环境变量管理（Security Handling v2.0）

**敏感信息必须使用环境变量引用**，禁止在 YAML 中硬编码。

#### 敏感字段列表

| 字段类型 | 示例 | 正确写法 | 错误写法 ❌ |
|---------|------|---------|-----------|
| 用户名 | username | `${TEST_USER}` | `"admin"` |
| 密码 | password | `${TEST_PASS}` | `"123456"` |
| 手机号 | phone | `${TEST_PHONE}` | `"13800138000"` |
| 邮箱 | email | `${TEST_EMAIL}` | `"test@example.com"` |
| Token | token | `${AUTH_TOKEN}` | `"eyJhbGciOi..."` |
| API Key | api_key | `${API_KEY}` | `"sk-xxx"` |
| 项目名称 | project_name | `${TEST_PROJECT_NAME}` | `"测试项目"` |
| 金额 | amount | `${TEST_AMOUNT}` | `"1000000"` |

#### 🆕 环境变量来源（v2.0 更新）

环境变量的设置优先级（从高到低）：

```
1. 用例专属 .env 文件（最高优先级，推荐）
   └── testcases/examples/asset-eval-apply.env
   
2. 全局环境变量（系统级别）
   └── $env:TEST_USER 或 export TEST_USER=xxx
   
3. 无默认值（框架不再预设！）
```

Modeler 在生成 YAML 时必须**同时生成**配套的 `.env` 文件，并在确认阶段提醒用户：

> ℹ️ 已生成配套的环境变量文件 `asset-eval-apply.env`
> 
> 请确保其中的值正确：
> - TEST_USER=yuanye
> - TEST_PASS=yuanye  
> - TEST_AMOUNT=1000000
>
> ⚠️ 密码等敏感信息请勿明文写入 YAML，已通过环境变量引用保护。

---

### 规则 6：特殊组件处理指南（🆕 v2.0 新增规则）

对于常见的复杂 UI 组件，Modeler 生成的 YAML 必须遵循以下规范：

#### Vue Element UI 组件对照表

| 组件 | action | target 写法 | option/value | 框架自动处理 |
|------|--------|-----------|-------------|-------------|
| **el-input (text)** | `fill` | placeholder 或 label | 普通文本 | 直接 fill |
| **el-input-number** | `fill` | placeholder | 数字字符串 | ✅ spinbutton 角色 |
| **el-select (单选)** | `select_option` | placeholder 或 label | 中文显示名 | ✅ JS DOM click |
| **el-select (多选)** | `select_option` | placeholder 或 label | 中文显示名 | ✅ JS DOM click |
| **el-input (readonly)** | `fill` | label | 文本 | ⚠️ 可能需 JS |
| **el-cascader** | `click` + 键盘 | label | 逐级选择 | ⚠️ 可能需 JS |
| **el-date-picker** | `click` + 键盘 | label | 日期格式 | ⚠️ 可能需 JS |

#### el-select 多选框的技术背景（供 Modeler 参考）

Element UI 的 `el-select` 下拉选项通过 **teleport/portal** 渲染到 `<body>` 外层：
- a11y 快照树中**看不到**选项元素
- MCP 的键盘事件（ArrowDown/Enter）**无法传递**到选项
- MCP 的 `fill()` 写入了 DOM 但 **Vue v-model 忽略**

**框架内置解决方案**（Modeler 不需要关心实现细节，只需正确生成 YAML）：

```
1. MCP click 打开下拉框（等待1.5s让DOM渲染完成）
2. evaluate_script 执行JS查找选项并点击
3. 验证选中状态
```

#### 🆕 可用工具能力（v2.0）

Modeler 应了解 testcase-agent 的底层能力边界：

| 能力 | 支持情况 | 说明 |
|------|---------|------|
| MCP `fill` | ✅ | 普通文本框、非 readonly 输入 |
| MCP `click` | ✅ | 按钮、链接、下拉触发器 |
| MCP `press_key` | ⚠️ | 对 teleport 渲染的下拉无效 |
| MCP `type_text` | ⚠️ | 对 readonly 输入无效 |
| **`evaluate_script`** | **✅ 强力** | 可执行任意 JS 操作 DOM |
| 截图验证 | ✅ | 每步自动截图 |
| 网络请求监控 | ✅ | network_called 断言 |

---

### 规则 7：生成后确认（Post-Generation Confirmation）

生成 YAML 用例和配套 `.env` 文件后，**必须向用户展示摘要并请求确认**。

#### 展示内容

```markdown
## 📋 用例生成完成

**基本信息**：
- 用例 ID: ASSET-EVAL-001-apply-normal
- 标题: 资产评估申请正常提交流程
- 优先级: P0
- 步骤数: 13

**配套文件**：
- ✅ asset-eval-apply.yaml（测试用例）
- ✅ asset-eval-apply.env（环境变量）

**核心校验点**：
1. ✓ 导航至登录页 → 验证URL
2. ✓ 登录凭据输入 → 验证字段填充
3. ✓ 点击登录 → 验证跳转到首页
4. ✓ 进入资产评估系统 → 三级菜单导航
5. ✓ 打开核准申请表单
6. ✓ 表单填写（项目名称、评估金额、评估方法等）
7. ✓ 评估方法选择（市场法）→ el-select 多选框
8. ✓ 提交 + 验证结果

**安全处理**：
- ✓ 所有敏感信息使用 ${ENV_VAR} 引用
- ✓ 配套 .env 文件已生成

**下一步**：
- [ ] 查看完整 YAML 内容？
- [ ] 直接导出到 testcases/ 目录？
- [ ] 需要修改某个步骤？
- [ ] 交给 testcase-agent 执行？
```

---

## 🎬 交互式录制模式（🆕 v2.0 新增）

除了**自然语言描述 → YAML** 的建模方式，testcase-modeler 还支持 **浏览器操作录制 → YAML** 模式。

### 使用方式

```bash
# 方式1：录制到默认路径
python tests/testcase-ai.py --record

# 方式2：录制到指定路径
python tests/testcase-ai.py --record testcases/01-系统状况/my-test.yaml
```

### 录制流程

```
┌─────────────────────────────────────────────────────┐
│  1. 启动录制器                                      │
│     $ python testcase-ai.py --record                │
│     [1/4] 连接浏览器... ✅                          │
│     [2/4] 注入事件监听器... ✅                      │
└──────────────────┬──────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────┐
│  2. 用户在浏览器中操作                              │
│                                                     │
│     ╔════════════════════════════════════╗         │
│     ║   🖥️ 现在可以在浏览器中操作了！        ║         │
│     ║                                        ║         │
│     ║   • 点击按钮、链接、输入框等           ║         │
│     ║   • 填写表单、选择下拉框              ║         │
│     ║   • 导航到不同页面                     ║         │
│     ║                                        ║         │
│     ║   操作完成后，按 Enter 停止录制        ║         │
│     ╚════════════════════════════════════╝         │
│                                                     │
│     终端实时显示：                                   │
│       [01] 👆 点击'用户名输入框'                    │
│       [02] ✏️ 填写'用户名输入框'为'test_user'        │
│       [03] ✏️ 填写'密码输入框'为'******'            │
│       [04] 👆 点击'登录按钮'                        │
│       [05] 🌐 导航至 'http://...'                  │
│       [06] 👆 点击'资产处置及评估系统'               │
│       ...                                            │
└──────────────────┬──────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────┐
│  3. 按 Enter 停止录制                               │
│     [4/4] 停止录制，共捕获 6 个操作步骤                 │
│                                                     │
│     自动生成：                                       │
│       ✅ testcases/recorded/testcase.yaml          │
│       ✅ testcases/recorded/testcase.env           │
│                                                     │
│     💡 下一步：编辑 .env → 补充断言 → 执行测试      │
└─────────────────────────────────────────────────────┘
```

### 录制能力

| 可录制的事件 | 转换结果 | 说明 |
|------------|---------|------|
| **点击** (click) | `action: click` + `target` | 按钮、链接、菜单项 |
| **输入** (input/change) | `action: fill` + `target` + `value` | 文本框、数字框 |
| **导航** (pushState) | `action: navigate` + `url` | 页面跳转 |
| **Enter 键** | 忽略（通常伴随 submit） | 表单提交 |

### 技术原理

```
1. evaluate_script 注入 JS 事件监听器到页面
   → document.addEventListener('click', ...)
   → document.addEventListener('input', ...)
   → history.pushState 劫持（捕获导航）

2. 每 1.5 秒轮询 POLL_JS 提取新事件
   → 实时显示操作步骤到终端

3. 用户按 Enter 触发 STOP_JS
   → 收集所有事件 → _event_to_step() 转换
   → yaml.dump() 写入文件 + .env 配对生成
```

### 适用场景

| 场景 | 推荐方式 |
|------|---------|
| 已知业务流程，快速生成用例 | 自然语言描述（Modeler） |
| **未知流程，边操作边记录** | **🎬 录制模式（推荐）** |
| 复杂多步操作，难以文字描述 | **🎬 录制模式（推荐）** |
| 首次接触的新功能探索性测试 | **🎬 录制模式（推荐）** |
| 需要精确元素定位信息 | **🎬 录制模式（推荐）** |

### 录制后优化建议

录制生成的 YAML 是**初稿**，建议进行以下优化：

1. **补充断言**：每个关键步骤添加 `assertion`
2. **优化 target 文本**：录制的 target 可能不够语义化，改为业务语言
3. **添加 wait_after**：导航和提交后添加等待策略
4. **环境变量化**：将硬编码值替换为 `${VAR}` 引用
5. **添加 context_check**：补全前置状态感知配置
6. **拆分长用例**：超过 15 步考虑拆分为多个用例

---

## 🔧 工作流程

### 完整交互流程

```
┌─────────────────────────────────────────────────────┐
│  1. 用户发起                                        │
│     "帮我写一个资产评估申请的测试用例"                  │
└──────────────────┬──────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────┐
│  2. 信息收集（Clarification）                       │
│     • 确认测试模块和场景                              │
│     • 确认起始状态（是否需要登录）                      │
│     • 确认测试数据（如果未提供）                        │
│     • 确认预期结果                                    │
└──────────────────┬──────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────┐
│  3. 意图分析（Intent Analysis）                     │
│     • 解析用户描述的操作序列                           │
│     • 匹配到动作类型（navigate/fill/click/select_option）│
│     • 识别实体（URL、元素、值）                        │
│     • 推断隐含步骤（如等待加载）                        │
│     • 识别特殊组件（el-select、spinbutton 等）          │
└──────────────────┬──────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────┐
│  4. YAML + .env 生成（遵循 7 条规则）                 │
│     • 规则 1: 结构完整性 + .env 配对                    │
│     • 规则 2: 智能意图提取（含特殊组件）                  │
│     • 规则 3: 三层语义化定位                            │
│     • 规则 4: 注入断言                                │
│     • 规则 5: 安全处理 + 环境变量管理                   │
│     • 规则 6: 特殊组件处理指南                         │
└──────────────────┬──────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────┐
│  5. 确认与导出（规则 7）                             │
│     • 展示摘要                                       │
│     • 用户确认/修改                                  │
│     • 导出到 testcases/ 目录（YAML + .env）           │
└─────────────────────────────────────────────────────┘
```

### 对话示例

**示例 1：简单场景**

> **用户**: 帮我写一个登录统一门户的测试用例
>
> **AI**: 好的，我来帮你创建登录测试用例。
>
> 请确认以下信息：
> 1. 登录 URL 是什么？（默认：http://uniportal.sjjk.com.cn）
> 2. 使用哪个账号测试？（我会用环境变量替代真实密码）
> 3. 登录后应该看到什么页面特征？
>
> **用户**: 就用默认的 yuanye 账号，登录后应该看到"统一门户（新）"
>
> **AI**: ✅ 已生成测试用例和配套环境变量文件：
>
> - login-flow.yaml（5 个步骤）
> - login-flow.env（4 个变量）
>
> [展示摘要...]
>
> 是否需要查看完整内容或直接导出？

**示例 2：复杂场景（含特殊组件）**

> **用户**: 我要测试资产评估核准的申请流程：
> 1. 先登录
> 2. 进入资产评估系统
> 3. 点开"资产评估"->"资产评估核准"->"核准申请"
> 4. 点新增，填写项目名称"测试项目"，金额100万
> 5. 选择评估方法为"市场法"
> 6. 点提交，验证保存成功
>
> **AI**: 明白了，这是一个较复杂的多步操作。让我分析一下...
>
> 📊 **用例结构预览**：
> - 模块: asset-eval-approval
> - 场景: apply-new-project
> - 步骤数: 约 12-14 步
> - 关键校验点: 
>   ✓ 登录状态检测
>   ✓ 三级菜单导航
>   ✓ 表单填写（项目名称、评估金额）
>   ✓ 评估方法选择（el-select 多选框 → 市场法）
>   ✓ 提交 + 网络校验 + 成功提示
>
> ⚠️ **注意事项**：
> - 所有测试数据将通过 .env 文件管理
> - 评估方法"市场法"使用 select_option 动作（框架自动处理 el-select）
> - 金额字段使用 ${TEST_AMOUNT} 环境变量
>
> 正在生成完整 YAML 和配套 .env...

---

## 📁 输出规范

### 文件命名规则

```
testcases/{module}/{scene}.yaml          # 测试用例
testcases/{module}/{scene}.env           # 配套环境变量（必选！）

示例:
testcases/login/portal-login.yaml
testcases/login/portal-login.env
testcases/asset-eval/apply-normal.yaml
testcases/asset-eval/apply-normal.env
```

### 目录组织建议

```
testcases/
├── README.md                      # 格式指南
├── examples/
│   ├── yaml-format-guide.md       # 完整格式参考
│   ├── asset-eval-apply.yaml      # 资产评估申请示例
│   ├── asset-eval-apply.env       # 资产评估申请环境变量
│   ├── login-flow.yaml            # 登录流程示例
│   └── login-flow.env             # 登录流程环境变量
├── login/
│   ├── portal-login.yaml
│   └── portal-login.env
├── asset-eval/
│   ├── apply-normal.yaml
│   ├── apply-normal.env
│   ├── apply-error.yaml
│   └── approve-flow.yaml
└── system-manage/
    ├── user-crud.yaml
    └── user-crud.env
```

### YAML 格式速查

```yaml
# 必填字段（规则 1）
test_id: "MODULE-NNN-scene-name"
title: "清晰的人类可读标题"
priority: "P0"
tags: ["标签"]

# 前置状态（规则 1 + 5）
context_check:
  login_url: "http://..."
  home_indicator: "首页特征"
  credentials:
    username: "${ENV_VAR}"
    password: "${ENV_VAR}"

# 步骤数组（规则 2 + 3 + 4 + 6）
steps:
  - step: 1
    desc: "步骤描述"
    action: "动作类型"
    target: "语义化描述"
    value: "值或${ENV_VAR}"        # fill 时使用
    option: "中文显示名"            # select_option 时使用
    locator:
      uid_cache_key: "key"         # 可选（P0 缓存）
    wait_after:                     # 可选
      type: navigation | time
      timeout: 5000
    assertion:                       # 规则 4（必填！）
      type: "断言类型"
      expected: "期望值"

# 后置清理（可选）
teardown:
  - action: screenshot
    name: "result.png"
```

---

## 🔗 与其他 Skill 的协作

### 下游：testcase-agent

生成的 YAML + .env 用例可直接交给 **testcase-agent** 执行：

```bash
# 方式 1：在对话中直接委托
"将这个用例交给 testcase-agent 执行"

# 方式 2：通过命令行
python tests/testcase-ai.py testcases/examples/asset-eval-apply.yaml
```

### 工具链关系

```
testcase-modeler (建模)
    ↓ 生成 YAML + .env
testcase-agent (执行)
    ↓ 调用 MCP Chrome DevTools
Chrome DevTools MCP (浏览器控制)
    ↓ 操作页面
目标业务系统
```

---

## 📚 参考资源

### 相关文档
- [yaml-format-guide.md](examples/yaml-format-guide.md) - 完整格式参考（最新版）
- [设计文档](../../docs/superpowers/specs/) - 架构设计

### 示例用例
- [examples/asset-eval-apply.yaml](examples/asset-eval-apply.yaml) - 资产评估申请（13步，含 el-select）
- [examples/asset-eval-apply.env](examples/asset-eval-apply.env) - 配套环境变量
- [examples/login-flow.yaml](examples/login-flow.yaml) - 登录流程（5步）
- [examples/login-flow.env](examples/login-flow.env) - 配套环境变量

### 最佳实践
- 每个 YAML 必须配对同名 .env 文件
- el-select 使用 select_option + 中文 option 名
- 数字输入框用 fill + placeholder 精确匹配
- 多次操作的同一元素务必用 uid_cache_key
- 重要业务流程准备正反两个用例（正常路径 + 异常路径）
- 用例控制在 5-15 步以内（过长考虑拆分）

---

## 🆘 常见问题

**Q1: 下拉框选不上怎么办？**
A: 使用 `action: select_option` + 中文 option 名称（如 "市场法"）。框架会自动检测 readonly 并使用 JS DOM click 方式处理 Vue Element UI 的 el-select 组件。

**Q2: 数字输入框填不进去？**
A: 确保 target 使用的是 placeholder 文本（如 "请输入报送评估值"），而不是泛泛的 "金额输入框"。spinbutton 是独立的交互角色，需要精确匹配。

**Q3: 环境变量在哪里设置？**
A: 在与 YAML 同目录的 `.env` 文件中设置。执行时框架会自动加载。不再需要在代码中硬编码默认值。

**Q4: 如何处理动态元素（如验证码）？**
A: 在 context_check 中标记 `captcha_required: true`，Agent 执行时会提示人工干预。

**Q5: 生成的用例执行失败怎么办？**
A: 查看截图确认实际效果，检查 target 文本是否与页面一致，调整后重新执行。

---

> **版本历史**
> - v2.0.0 (2026-05-14): 重大更新 — 新增 .env 配对机制、el-select 处理、三层定位策略、spinbutton 支持、evaluate_script 能力、特殊组件处理规则
> - v1.0.1 (2026-05-08): 增强触发词覆盖（30个）、优化文档结构
> - v1.0.0 (2026-05-08): 初始版本
>
> **维护者**: PDD Team  
> **许可证**: MIT
