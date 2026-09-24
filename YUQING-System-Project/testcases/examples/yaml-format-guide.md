# YAML 格式指南

本文档提供 YAML 测试用例的完整格式参考和示例。

## 目录

- [完整示例](#完整示例)
- [文件组织](#文件组织)
- [字段详解](#字段详解)
- [操作类型（action）参考](#操作类型action参考)
- [元素定位机制](#元素定位机制)
- [特殊组件处理](#特殊组件处理)
- [断言完整参数](#断言完整参数)
- [最佳实践](#最佳实践)

---

## 完整示例

以下是一个典型的资产评估申请测试用例：

```yaml
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
  login_url: "http://uniportal.sjjk.com.cn"
  home_indicator: "门户"
  credentials:
    username: "${TEST_USER}"
    display_name: "${TEST_DISPLAY_NAME}"
    password: "${TEST_PASS}"
  captcha_required: false

# ============================================================
# 测试步骤
# ============================================================
steps:
  # --- 步骤1：导航 ---
  - step: 1
    desc: "打开统一门户登录页面"
    action: navigate
    url: "http://uniportal.sjjk.com.cn"
    assertion:
      type: text_contains
      expected: "欢迎登录"

  # --- 步骤2：填充表单 ---
  - step: 2
    desc: "输入用户名"
    action: fill
    target: "用户名输入框"
    value: "${TEST_USER}"
    locator:
      uid_cache_key: "username_input"

  # --- 步骤3：敏感信息 ---
  - step: 3
    desc: "输入密码"
    action: fill
    target: "密码输入框"
    value: "${TEST_PASS}"
    isSensitive: true

  # --- 步骤4：点击 + 导航等待 ---
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

  # --- 步骤5：数字输入(spinbutton) ---
  - step: 5
    desc: "填写评估金额"
    action: fill
    target: "请输入报送评估值"
    value: "${TEST_AMOUNT}"

  # --- 步骤6：下拉选择(el-select多选) ---
  - step: 6
    desc: "选择评估方法为'市场法'"
    action: select_option
    target: "请选择评估方法"
    option: "市场法"          # 使用中文显示名，框架内部自动处理

  # --- 步骤7：多断言 ---
  - step: 7
    desc: "验证页面关键元素"
    action: assert_multiple
    assertions:
      - type: element_visible
        expected: "资产处置及评估系统"
        confidence: high
      - type: network_called
        url_pattern: "/api/asset-eval/*"
        method: GET
        response_code: 200

# 后置清理
teardown:
  - action: screenshot
    name: "result-{timestamp}.png"
    fullPage: true
```

---

## 文件组织

### 配套 .env 文件

每个 YAML 测试用例可以配一个同目录、同名的 `.env` 文件，用于存放该用例专属的环境变量：

```
testcases/examples/
├── asset-eval-apply.yaml       # 测试用例
├── asset-eval-apply.env        # 该用例的环境变量（自动加载）
├── login-flow.yaml             # 另一个测试用例
└── login-flow.env              # 另一个用例的环境变量
```

**`.env` 文件格式**（标准 KEY=VALUE 格式）：

```env
# 资产评估申请 - 环境变量配置
# 与 asset-eval-apply.yaml 同目录，执行时自动加载

TEST_USER=yuanye
TEST_PASS=yuanye
TEST_DISPLAY_NAME=袁野
TEST_PROJECT_NAME=AI自动测试项目-001
TEST_AMOUNT=1000000
```

**加载规则**：

| 规则 | 说明 |
|------|------|
| 自动加载 | 执行 YAML 前，框架自动查找同名 `.env` 并加载 |
| 作用域 | 仅当前用例有效，执行后自动清理 |
| 优先级 | `.env` 文件 > 全局环境变量 > 无默认值 |
| 无 .env 时 | 不报错，跳过加载，依赖已有环境变量 |

> ⚠️ **重要**：框架不再硬编码任何默认值（如用户名/密码）。所有测试数据必须通过 `.env` 文件或系统环境变量提供。

### 环境变量引用语法

在 YAML 中使用 `${VAR_NAME}` 引用环境变量：

```yaml
value: "${TEST_USER}"           # 普通引用，未定义时保留原文本
url: "${LOGIN_URL:-http://default.com}"  # 带默认值，未定义时使用 :- 后的值
```

---

## 字段详解

### 顶层元数据

```yaml
test_id: "MODULE-FEATURE-NUMBER-action"   # 命名规则: 模块-功能-序号-动作
title: "人类可读标题"                      # 用于报告显示
priority: "P0"                             # P0=阻塞 / P1=重要 / P2=一般 / P3=低
tags: ["标签1", "标签2"]                    # 用于筛选和分类
smart_skip: true                            # 是否启用登录状态智能跳过
```

### context_check 详细说明

`context_check` 是框架理解"当前是否已登录"的关键配置：

| 子字段 | 说明 |
|--------|------|
| `login_url` | 登录页面 URL，用于判断是否在登录页 |
| `home_indicator` | 登录成功后页面应包含的文字 |
| `credentials.username` | 期望登录的用户名（英文账号） |
| `credentials.display_name` | 期望登录的中文名（用于对比） |
| `credentials.password` | 登录密码 |
| `captcha_required` | 是否需要验证码（暂未实现） |

### 步骤完整参数参考

#### 通用参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `step` | int | ✅ | 步骤编号，从1开始递增 |
| `desc` | string | ✅ | 步骤描述，出现在日志和报告中 |
| `action` | string | ✅ | 操作类型（见[操作类型参考](#操作类型action参考)） |
| `target` | string | ⚠️ | 目标元素的语义描述（用于MCP定位） |
| `value` | string | ⚠️ | 操作值（fill/select_option等需要） |
| `option` | string | ❌ | 选项值（select_option专用） |
| `assertion/assertions` | dict/list | ❌ | 断言，不配则跳过验证 |
| `wait_after` | dict | ❌ | 操作后等待策略 |
| `locator` | dict | ❌ | 定位器缓存配置 |
| `on_fail` | string | ❌ | 本步骤失败时的策略 |

#### wait_after 等待策略

```yaml
# 方式1: 固定时间等待
wait_after:
  type: time
  duration: 2000          # 毫秒

# 方式2: 导航等待（推荐用于页面跳转后）
wait_after:
  type: navigation
  timeout: 10000          # 最大超时毫秒
# 效果: 等待 + 自动检测新标签页 + DOM渲染完成
```

#### on_fail 失败策略

```yaml
on_fail: continue     # 失败后继续下一步骤（默认）
on_fail: stop         # 失败后终止整个用例
on_fail: retry        # 失败后重试（使用max_retries）
```

#### locator 缓存定位

```yaml
locator:
  uid_cache_key: "username_input"   # 首次定位后缓存UID
# 后续同key的步骤直接使用缓存的UID，无需重新搜索
```

---

## 操作类型（action）参考

### 核心操作

| action | 说明 | 典型参数 | 示例场景 |
|--------|------|----------|---------|
| `navigate` | 打开URL | `url` | 打开登录页、进入业务系统 |
| `fill` | 填写表单 | `target`, `value` | 输入用户名、金额、文本 |
| `click` | 点击元素 | `target` | 点击按钮、链接、Tab |
| `select_option` | 选择下拉选项 | `target`, `option` | 选择评估方法、状态 |
| `type_text` | 键盘输入文字 | `target`, `text` | 搜索框输入（需先focus） |
| `press_key` | 按键 | `key` | Enter、Tab、Escape |
| `scroll` | 滚动页面 | `direction`, `amount` | 滚动到可见区域 |
| `screenshot` | 截图 | `name`, `fullPage` | 记录操作结果 |
| `wait_for` | 等待条件 | `text` | 等待特定文字出现 |
| `assert_multiple` | 多重断言 | `assertions[]` | 验证页面多个状态 |
| `execute_script` | 执行JS | `function` | 自定义DOM操作 |

### `select_option` — 下拉选择器

专门用于 `<select>` 和自定义下拉组件（如 Element UI `el-select`）：

```yaml
# el-select 单选/多选
- step: N
  action: select_option
  target: "请选择评估方法"       # placeholder 或 label 文本
  option: "市场法"                # 显示名（中文），非代码值
```

**框架自动处理**：
- 检测元素是否为 `readonly`（如 el-select 的 input）
- 对 readonly 元素自动切换为 JS DOM 点击模式
- 通过 `evaluate_script` 在 DOM 中找到选项并 click
- 支持中文名称匹配（无需知道字典代码值）

---

## 元素定位机制

### 三层解析策略

框架按优先级依次尝试三种定位方式：

```
P0 (最高) → locator.uid_cache_key 缓存命中 → 直接使用
P1 (中等) → _exact_match_uid() 精确文本匹配 → target文本包含在元素中
P2 (兜底)  → 模糊评分匹配 → TF-IDF相似度排序取最佳
```

#### P0: UID 缓存（最快）

```yaml
- step: 1
  action: fill
  target: "用户名输入框"
  locator:
    uid_cache_key: "username_input"   # 首次搜索并缓存

- step: 10
  action: fill
  target: "用户名输入框"               # 同一target
  locator:
    uid_cache_key: "username_input"   # 直接用缓存UID，不再搜索
```

适用场景：同一元素被多次操作的步骤序列（如表单填写）。

#### P1: 精确文本匹配（推荐无locator时）

```yaml
# 用 placeholder / label / aria-label 等可辨识文本定位
- step: N
  action: fill
  target: "请输入报送评估值"          # 精确匹配含此文本的交互元素
  value: "1000000"
```

框架会在快照中搜索 `text` / `placeholder` / `aria-label` 包含目标文本的**交互元素**。

#### P2: 模糊匹配（兜底）

当 P0 和 P1 都失败时，框架对所有元素做模糊评分，选取最可能的目标。适用于文本不完全精确的场景。

### 交互角色识别

框架识别以下 **15 种交互角色**，只有这些角色的元素才会作为操作目标：

| 角色 | 典型元素 |
|------|---------|
| `button` | 按钮、链接按钮 |
| `textbox` | 文本输入框、el-select input |
| `input` | 通用输入 |
| `combobox` | 组合框 |
| `select` | 原生下拉框 |
| `checkbox` | 复选框 |
| `radio` | 单选框 |
| `spinbutton` | 数字输入框（⚠️ 易遗漏！） |
| `menuitem` | 菜单项 |
| `option` | 选项 |
| `tab` | 标签页 |
| `treeitem` | 树节点 |
| `slider` | 滑块 |
| `switch` | 开关 |
| `link` | 链接 |

> 💡 **常见陷阱**：`spinbutton`（数字输入框）容易被遗漏导致定位到错误元素。如果发现 fill 定位到了邻近的文本框而非数字框，检查是否包含此角色。

---

## 特殊组件处理

### Vue Element UI 组件

| 组件 | 特征 | 框架处理方式 |
|------|------|-------------|
| **el-select (单选)** | textbox + readonly | 自动检测 readonly → JS DOM click 选项 |
| **el-select (多选)** | textbox + readonly + multiple | 同上，支持中文选项名匹配 |
| **el-input (number)** | spinbutton role | 正常 fill 即可（已纳入 INTERACTIVE_ROLES） |
| **el-input (readonly)** | textbox + readonly 属性 | 正常 fill 可尝试；若无效需用 evaluate_script |

### el-select 多选框的技术细节

Element UI 的 `el-select` 下拉选项通过 **teleport/portal** 渲染到 `<body>` 外层：

- a11y 快照树中**看不到**选项元素
- MCP 的键盘事件（ArrowDown/Enter）**无法传递**到选项
- MCP 的 `fill()` 写入了 DOM 但 **Vue v-model 忽略**

**解决方案**（框架已内置，无需手动处理）：

```
1. MCP click 打开下拉框（等待1.5s让DOM渲染完成）
2. evaluate_script 执行JS:
   → document.querySelectorAll('.el-select-dropdown__item')
   → 遍历匹配 option 中文文本
   → item.click() 触发Vue原生事件绑定
3. 验证选中状态
```

---

## 断言完整参数

```yaml
# 单断言
assertion:
  type: text_contains
  expected: "期望文字"
  confidence: high            # high=必须通过 / low=非关键

# 多断言（任一通过即算通过）
assertions:
  - type: element_visible
    expected: "按钮文字"
    confidence: high
  - type: network_called
    url_pattern: "/api/*"
    method: POST
    response_code: 200
```

### 断言类型一览

| 类型 | 说明 | 适用场景 |
|------|------|---------|
| `text_contains` | 页面包含指定文字 | 验证页面标题、提示信息 |
| `element_visible` | 元素存在且可见 | 验证按钮、字段出现 |
| `element_text` | 元素文本匹配 | 验证填入值正确 |
| `field_filled` | 字段已填写（非空） | 验证必填项 |
| `value_equals` | 字段值等于预期 | 精确值比对 |
| `url_contains` | URL包含指定路径 | 验证页面跳转 |
| `network_called` | 发起了指定请求 | 验证API调用 |
| `toast_visible` | Toast提示出现 | 验证操作反馈 |
| `element_count_greater_than` | 元素数量达标 | 验证列表数据量 |

---

## 最佳实践

### 编写规范

1. **step 编号连续**：从1开始，不要跳跃
2. **desc 具体**：描述要能看出做了什么，如"输入用户名"而非"填写表单"
3. **target 语义化**：用业务语言描述元素，如"登录按钮"而非"uid=1_123"
4. **敏感信息标记**：密码等字段务必设置 `isSensitive: true`
5. **导航后加等待**：点击打开新页面后，始终配置 `wait_after: {type: navigation}`
6. **关键步骤加断言**：至少在导航完成后验证页面特征文字

### 环境变量管理

7. **永远不要硬编码敏感信息**：用户名、密码、Token 等必须用 `${VAR}` 引用
8. **每个用例配一个 `.env`**：测试数据与用例绑定，互不干扰
9. **`.env` 加入 .gitignore**：或使用 `.env.example` 提供模板

### 元素定位

10. **优先用 P0 缓存**：多次操作的同一元素务必用 `uid_cache_key`
11. **P1 用可辨识文本**：placeholder、label 比"输入框"更精确
12. **注意 spinbutton**：数字输入框是独立角色，确保不被遗漏
13. **el-select 用 select_option**：不要用 fill，框架会自动处理 readonly 问题

### 调试技巧

14. **查看 snapshot 日志**：定位失败时检查 `[Exact]` 匹配到了哪个 uid
15. **截图确认**：每次运行后查看 result 截图确认实际效果
16. **逐步执行**：出问题时可用 `--stop-on-error` 在失败处停止
