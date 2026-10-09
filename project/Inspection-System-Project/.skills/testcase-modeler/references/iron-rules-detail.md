# testcase-modeler 六条建模规则详细示例（Iron Rules v2.0）

> 本文件为 testcase-modeler 的参考资料，按需加载。规则核心在 SKILL.md。

## 规则 1：结构完整性 + .env 配对文件

**必填字段 YAML 模板:**

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

**.env 配对文件（v2.0 新增）**

每个 YAML 用例必须配套一个同目录、同名的 `.env` 文件：

```
testcases/examples/
├── asset-eval-apply.yaml       # 测试用例
├── asset-eval-apply.env        # 该用例的环境变量 ← 必须创建！
├── login-flow.yaml
└── login-flow.env
```

`.env` 文件格式：
```env
TEST_USER=yuanye
TEST_PASS=yuanye
TEST_DISPLAY_NAME=袁野
TEST_PROJECT_NAME=AI自动测试项目-001
TEST_AMOUNT=1000000
```

**关键规则**：框架不再硬编码任何默认值；所有测试数据通过 `.env` 或系统环境变量提供；`.env` 与 YAML 同目录同名自动加载；执行后自动清理环境变量。

**验收清单**：`test_id` 存在且格式正确 | `title` 有意义 | `priority` 是 P0/P1/P2 | `context_check` 含 login_url 和 credentials | `steps` 非空 | 每步有 `step`/`desc`/`action` | 已创建配套 `.env` 文件

**步骤编号规范（v2.0.1）**：`step` 必须为纯整数，禁止 `19b`/`step_2` 等混合格式。原因：`_include` 引用共享步骤时框架 `_resolve_includes()` 做 `new_num = old_num + step_offset` 重编号，字符串编号会触发 `TypeError: can only concatenate str (not "int") to str`。

```yaml
# ✅ 连续整数编号（推荐）
- step: 19
  desc: 点击日期选择器打开面板
  action: click
  target: 请选择评估基准日
# ❌ 禁止：混合格式编号 step: 19b
```

## 规则 2：智能意图提取（Intent Extraction）

**动作映射表:**

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

**select_option — 下拉选择器（重要）**

专门用于 `<select>` 和自定义下拉组件（如 Element UI `el-select`）：

```yaml
# el-select 单选/多选 — 使用中文显示名！
- step: N
  action: select_option
  target: "请选择评估方法"       # placeholder 或 label 文本
  option: "市场法"                # 中文显示名（非代码值）
```

框架自动处理：检测 readonly（el-select 的 input）→ 自动切换 JS DOM click 模式 → evaluate_script 在 DOM 中找选项并 click → 支持中文名称匹配。

**fill — 数字输入框（spinbutton）**

```yaml
- step: N
  action: fill
  target: "请输入报送评估值"      # placeholder 文本
  value: "${TEST_AMOUNT}"
```
⚠️ spinbutton 是独立交互角色，若 fill 定位到错误文本框，检查 target 是否够精确。

## 规则 3：三层语义化定位（Semantic Selector v2.0）

永远使用人类可读的语义化描述。三层解析策略：
```
P0 (最高) → locator.uid_cache_key 缓存命中 → 直接使用 UID
P1 (中)   → _exact_match_uid() 精确文本匹配 → target文本包含在元素中
P2 (兜底) → 模糊评分匹配 → TF-IDF相似度排序取最佳
```

**禁止**：CSS 类名、XPath、nth-child、任意硬编码选择器。

**推荐定位方式**：UID 缓存(`uid_cache_key`) | 占位符文本(`"请输入报送评估值"`) | ARIA 标签(`[aria-label='关闭']`) | 语义组合(`"用户名输入框"`) | Role+文本(`button"提交"`)

**UID 缓存机制**：
```yaml
- step: 2
  action: fill
  target: "用户名输入框"
  value: "${TEST_USER}"
  locator:
    uid_cache_key: "username_input"  # P0: 后续直接用此 key
```

**15 种交互角色**：`button` `textbox` `input` `combobox` `select` `checkbox` `radio` **`spinbutton`(易遗漏！)** `menuitem` `option` `tab` `treeitem` `slider` `switch` `link`

## 规则 4：断言注入（Assertion Injection）

**断言类型选择指南:**

| 操作类型 | 推荐断言类型 | 断言目标 | 示例 |
|---------|------------|---------|------|
| **navigate** | `text_contains` / `element_visible` | 页面特征文本 | 包含"欢迎登录" |
| **click** (导航) | `text_contains` / `element_visible` | 新出现的元素 | 显示"资产管理" |
| **click** (提交) | `network_called` + `toast_visible` | API调用+提示 | 接口被调用且显示"保存成功" |
| **fill** | `field_filled` / `element_text` | 输入框值 | 字段已填入指定值 |
| **select_option** | `element_text` | 选中项显示 | 显示"市场法 ×" |
| **delete** | `element_hidden` | 元素消失 | 记录已从列表移除 |
| **upload** | `element_visible` | 上传后的预览 | 显示文件名和大小 |

**断言模板库:**
```yaml
# 导航后验证
assertion:
  type: text_contains
  expected: "期望出现的文本"

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

**强制要求**：每个 step 都有 assertion | assertion.type 必须是已知类型 | assertion.expected 不能为空 | 提交/保存类建议含 network_called 断言

## 规则 5：安全处理 + 环境变量管理

**敏感信息必须使用环境变量引用**，禁止在 YAML 中硬编码。

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

**环境变量来源优先级（高到低）**：1. 用例专属 `.env` 文件(最高，推荐) → 2. 全局环境变量(系统级) → 3. 无默认值(框架不再预设)

Modeler 生成 YAML 时必须同时生成配套 `.env` 文件，并提醒用户确认其中值。

## 规则 6：特殊组件处理指南

**Vue Element UI 组件对照表:**

| 组件 | action | target 写法 | option/value | 框架自动处理 |
|------|--------|-----------|-------------|-------------|
| **el-input (text)** | `fill` | placeholder 或 label | 普通文本 | 直接 fill |
| **el-input-number** | `fill` | placeholder | 数字字符串 | ✅ spinbutton 角色 |
| **el-select (单选/多选)** | `select_option` | placeholder 或 label | 中文显示名 | ✅ JS DOM click |
| **el-input (readonly)** | `fill` | label | 文本 | ⚠️ 可能需 JS |
| **el-cascader** | `click` + 键盘 | label | 逐级选择 | ⚠️ 可能需 JS |
| **el-date-picker** | `click` + 键盘 | label | 日期格式 | ⚠️ 可能需 JS |

**el-select 技术背景**：选项通过 teleport/portal 渲染到 `<body>` 外层 → a11y 快照树看不到选项 → MCP 键盘事件无法传递 → MCP fill() 写入但 Vue v-model 忽略。
**框架内置解决**：MCP click 打开下拉(等待1.5s) → evaluate_script 查选项并点击 → 验证选中状态。

**可用工具能力:**
| 能力 | 支持情况 | 说明 |
|------|---------|------|
| MCP `fill` | ✅ | 普通文本框、非 readonly 输入 |
| MCP `click` | ✅ | 按钮、链接、下拉触发器 |
| MCP `press_key` | ⚠️ | 对 teleport 渲染的下拉无效 |
| MCP `type_text` | ⚠️ | 对 readonly 输入无效 |
| **`evaluate_script`** | **✅ 强力** | 可执行任意 JS 操作 DOM |
| 截图验证 | ✅ | 每步自动截图 |
| 网络请求监控 | ✅ | network_called 断言 |

## 规则 7：生成后确认

生成 YAML + `.env` 后必须向用户展示摘要并请求确认。展示内容：基本信息(用例ID/标题/优先级/步骤数)、配套文件、核心校验点、安全处理、下一步选项。