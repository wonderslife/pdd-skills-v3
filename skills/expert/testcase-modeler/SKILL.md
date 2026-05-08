# Testcase Modeler Skill - 测试用例建模师

> **版本**: 1.0.1
> **分类**: Expert Skill
> **作者**: PDD Team
> **最后更新**: 2026-05-08

---

## 📌 技能概述

**Testcase Modeler** 是一个将**自然语言描述转换为结构化 YAML 测试用例**的 AI 技能。它让测试人员（包括实习生）无需编写任何代码，只需用日常语言描述业务操作流程，即可自动生成符合规范的、可回放的 E2E 测试脚本。

### 核心价值

- ✅ **零代码门槛**: 会说中文就能写测试用例
- ✅ **智能意图提取**: 自动识别导航、输入、点击、验证等操作
- ✅ **断言自动注入**: 每个步骤自动配对合适的断言
- ✅ **安全处理**: 密码等敏感信息自动使用环境变量
- ✅ **标准输出**: 生成符合规范的 YAML 格式，可直接交给 Agent 执行

### 适用场景

| 用户类型 | 使用场景 | 示例 |
|---------|---------|------|
| **实习生** | 学习业务流程/零基础入门 | "帮我录制一下登录流程"、"我不会写代码" |
| **测试人员** | 快速编写用例/回归测试 | "生成资产评估申请的测试用例" |
| **业务人员** | 验证功能/业务流程确认 | "帮我测一下这个功能是否正常" |
| **开发人员** | 回归测试/E2E自动化 | "把这套操作录下来以后可以重放" |
| **项目经理** | 验收测试/场景覆盖 | "验证这个功能的正常路径和异常路径" |

---

## 🎯 触发条件（v1.0.1 增强）

**⚡ 主动触发原则**：当用户提到以下任何关键词或场景时，即使没有明确要求"生成测试用例"，也应主动使用本技能帮助创建标准化测试脚本。

### 🇨🇳 中文触发词（口语化 + 正式）

#### 核心触发词（必识别）
- "帮我写个测试用例" / "写个测试"
- "录制测试流程" / "帮我录个操作"
- "生成自动化测试" / "生成测试"
- "把这个操作录下来" / "把这个流程记下来"
- "测试一下 XXX 功能" / "帮我验证 XXX 流程"

#### 场景化触发词（新增）
- "实习生不会写代码" / "零基础写测试"
- "用大白话描述测试" / "自然语言转测试"
- "回归测试" / "冒烟测试" / "功能验证"
- "UI自动化" / "浏览器测试" / "E2E自动化"
- "验收测试" / "场景测试" / "业务流程测试"
- "BDD测试" / "Gherkin语法" / "行为驱动测试"
- "Chrome DevTools测试" / "MCP测试"

### 🇺🇸 英文触发词
- "Create a test case for..." / "Write a test..."
- "Record test flow" / "Record this operation"
- "Generate automated test" / "Help me test..."
- "Regression test" / "E2E test" / "Smoke test"
- "BDD test" / "Gherkin syntax" / "Acceptance test"

### 🧠 上下文智能识别

当对话中同时出现以下元素时，**强烈建议触发**：

1. **操作序列描述**：用户描述了一系列UI操作步骤
   - 例："先登录，然后点击XXX，再填写YYY，最后提交"
   - 例："打开页面→输入账号密码→点击登录→检查首页"

2. **业务系统提及**：提到了具体的业务系统或页面
   - 例："统一门户"、"资产评估系统"、"核准申请页面"

3. **测试意图表达**：明确或隐含的验证需求
   - 例："验证"、"检查"、"确认"、"看看XXX是否正常"
   - 例："这个功能有没有bug"、"能不能跑通"

4. **能力限制声明**：用户表明自己不会编程
   - 例："我不懂代码"、"有没有不用写代码的方法"
   - 例："实习生怎么写测试"、"零基础快速上手"

### 📊 触发置信度评估

| 场景类型 | 置信度 | 建议动作 |
|---------|--------|---------|
| 明确要求生成测试用例 | 100% | ✅ 立即触发 |
| 描述完整操作序列（3步以上） | 95% | ✅ 主动触发并确认 |
| 提及测试相关术语 | 85% | ✅ 建议使用本技能 |
| 表达验证意图 | 75% | ⚠️ 询问是否需要生成用例 |
| 一般性讨论 | <50% | ❌ 不触发，继续对话 |

---

## 📐 六条建模规则（Iron Rules）

> ⚠️ **必须严格遵守以下规则**，确保生成的 YAML 用例质量。

### 规则 1：结构完整性（Structure Completeness）

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
  credentials:                        # 凭据配置
    username: "${TEST_USER}"         # 环境变量引用
    password: "${TEST_PASS}"         # 禁止明文密码！

steps:                               # 测试步骤数组（至少 1 步）
  # ... 见规则 2

teardown:                             # 后置清理（可选）
  # ...
```

**验收清单**：
- [ ] `test_id` 存在且格式正确
- [ ] `title` 存在且有意义（不是空字符串）
- [ ] `priority` 是 P0/P1/P2 之一
- [ ] `context_check` 包含 login_url 和 credentials
- [ ] `steps` 数组非空
- [ ] 每个步骤都有 `step`, `desc`, `action`

---

### 规则 2：智能意图提取（Intent Extraction）

从用户的自然语言描述中，**自动映射**到对应的动作类型：

#### 动作映射表

| 用户表述关键词 | 映射动作 (action) | 参数示例 |
|--------------|------------------|---------|
| 打开/访问/跳转/进入/导航 | `navigate` | url: "http://..." |
| 输入/填写/填入/键入 | `fill` | target + value |
| 点击/选择/按一下/单击 | `click` | target |
| 选择下拉/选中/勾选 | `select_option` 或 `checkbox` | target + option |
| 上传/附件/文件 | `upload_file` | target + path |
| 提交/保存/确认/登录 | `click`（提交按钮）或 `submit` | target |
| 等待/加载/等到 | `wait_for` | text |
| 截图/拍照/截屏 | `screenshot` | name |
| 验证/检查/确认/应该 | `assert_*` 系列 | expected |
| 滚动/向下/向上 | `scroll` | direction |

#### 复杂场景处理

**场景 A：批量表单填写**
```
用户说: "依次填写用户名admin、密码123456、选择角色管理员"
→ 拆分为 3 个 fill/select_option 步骤
→ 或合并为 1 个 fill_form 步骤（推荐）
```

**场景 B：条件判断**
```
用户说: "如果看到弹窗就点确定，否则跳过"
→ 在 step 中添加 condition 字段:
  condition:
    type: element_visible
    target: "弹窗对话框"
```

**场景 C：循环操作**
```
用户说: "对列表中的每一项都点击编辑按钮"
→ 使用 loop 结构:
  loop:
    target: "列表项"
    action: click_edit
```

---

### 规则 3：语义化选择器优先（Semantic Selector）

**永远使用人类可读的语义化描述**作为元素定位方式，**禁止**使用：

❌ **禁止使用的定位方式**：
- CSS 类名：`.btn-primary`, `#submit-btn`
- XPath：`//div[@class='container']/button[3]`
- nth-child：`:nth-child(2)`
- 任意硬编码的选择器

✅ **推荐的定位方式**：

| 定位策略 | 示例 | 说明 |
|---------|------|------|
| **文本内容** | `"登录按钮"` | 最直观，首选 |
| **ARIA 标签** | `[aria-label='关闭']` | 无障碍属性 |
| **语义组合** | `"用户名输入框"` | 类型+用途 |
| **占位符文本** | `"请输入手机号"` | placeholder 值 |
| **Role + 文本** | `button"提交"` | 元素角色+文本 |

**UID 缓存机制**（增强稳定性）：

```yaml
# 首次成功定位后，自动缓存 UID
- step: 2
  action: fill
  target: "用户名输入框"
  value: "${TEST_USER}"
  locator:
    uid_cache_key: "username_input"  # 下次直接用此 key 查找

# 后续步骤可复用缓存
- step: 8
  action: fill
  target: "用户名输入框"           # 同样的描述
  locator:
    uid_cache_key: "username_input"  # 直接命中缓存
```

---

### 规则 4：断言注入（Assertion Injection）

**每一步操作都必须配对一个断言**（Assertion），用于验证操作结果。

#### 断言类型选择指南

| 操作类型 | 推荐断言类型 | 断言目标 | 示例 |
|---------|------------|---------|------|
| **navigate** | `url_contains` / `text_contains` | URL 或页面特征文本 | 页面包含"欢迎登录" |
| **click** (导航) | `text_contains` / `element_visible` | 新出现的元素 | 显示"资产管理"菜单 |
| **click** (提交) | `network_called` + `toast_visible` | API 调用 + 成功提示 | 接口被调用且显示"保存成功" |
| **fill** | `field_filled` | 输入框值 | 字段已填入指定值 |
| **select_option** | `element_text` | 选中项显示 | 下拉框显示"已启用" |
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
assertions:  # 支持多个断言
  - type: toast_visible
    expected: "保存成功"
  - type: network_called
    url_pattern: "/api/save"
    response_body_contains: '"code":0'
```

**强制要求**：
- [ ] 每个 step 都有 assertion 字段
- [ ] assertion.type 必须是已知类型（见上表）
- [ ] assertion.expected 不能为空（除非是特殊类型）
- [ ] 提交/保存类操作必须包含 network_called 断言

---

### 规则 5：安全处理（Security Handling）

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

#### 自动检测与替换逻辑

当用户在对话中说：
> "用用户名 yuanye，密码 yuanye 登录"

Modeler 必须**自动转换**为：
```yaml
credentials:
  username: "${TEST_USER}"
  password: "${TEST_PASS}"
```

并在生成后**提示用户**：
> ℹ️ 已将敏感信息替换为环境变量引用。请确保在执行前设置环境变量：
> ```bash
> export TEST_USER=yuanye
> export TEST_PASS=yuanye
> ```

#### 配置文件中的 env_mapping

参考 `config/cdp-test-config.yaml` 的 `env_mapping` 部分，维护敏感字段的映射关系。

---

### 规则 6：生成后确认（Post-Generation Confirmation）

生成 YAML 用例后，**必须向用户展示摘要并请求确认**。

#### 展示内容

```markdown
## 📋 用例生成完成

**基本信息**：
- 用例 ID: ASSET-EVAL-001-login
- 标题: 统一门户登录流程测试
- 优先级: P0
- 步骤数: 5

**核心校验点**：
1. ✓ 导航至登录页 → 验证URL
2. ✓ 输入凭据 → 验证字段填充
3. ✓ 点击登录 → 验证跳转到首页
4. ✓ 网络校验 → 验证登录API调用

**安全处理**：
- ✓ 密码已使用 ${TEST_PASS} 环境变量
- ✓ 无明文敏感信息

**下一步**：
- [ ] 查看完整 YAML 内容？
- [ ] 直接导出到 tests/ 目录？
- [ ] 需要修改某个步骤？
- [ ] 交给 testcase-agent 执行？
```

#### 用户可选操作

1. **查看完整内容**：展示完整 YAML（可复制）
2. **导出文件**：保存到 `tests/{module}/{scene}.yaml`
3. **修改步骤**：允许调整某个 step 的 desc/action/assertion
4. **立即执行**：调用 testcase-agent 执行该用例
5. **取消**：放弃本次生成的用例

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
│     • 匹配到动作类型（navigate/fill/click/...）        │
│     • 识别实体（URL、元素、值）                        │
│     • 推断隐含步骤（如等待加载）                        │
└──────────────────┬──────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────┐
│  4. YAML 生成（遵循 6 条规则）                       │
│     • 规则 1: 填充所有必填字段                         │
│     • 规则 2: 智能意图提取                            │
│     • 规则 3: 语义化选择器                            │
│     • 规则 4: 注入断言                                │
│     • 规则 5: 安全处理                                │
└──────────────────┬──────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────┐
│  5. 确认与导出（规则 6）                             │
│     • 展示摘要                                       │
│     • 用户确认/修改                                  │
│     • 导出到 tests/ 目录                             │
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
> 3. 登录成功后应该看到什么页面特征？
>
> **用户**: 就用默认的 yuanye 账号，登录后应该看到"统一门户（新）"
>
> **AI**: ✅ 已生成测试用例，共 4 个步骤：
>
> [展示 YAML 摘要...]
>
> 是否需要查看完整内容或直接导出？

**示例 2：复杂场景**

> **用户**: 我要测试资产评估核准的申请流程：
> 1. 先登录
> 2. 进入资产评估系统
> 3. 点开"资产评估"->"资产评估核准"->"核准申请"
> 4. 点新增，填写项目名称"测试项目"，金额100万
> 5. 点提交，验证保存成功
>
> **AI**: 明白了，这是一个较复杂的多步操作。让我分析一下...
>
> 📊 **用例结构预览**：
> - 模块: asset-eval-approval
> - 场景: apply-new-project
> - 步骤数: 约 8-10 步
> - 关键校验点: 
>   ✓ 登录状态检测
>   ✓ 三级菜单导航
>   ✓ 表单填写（2个字段）
>   ✓ 提交 + 网络校验 + 成功提示
>
> ⚠️ **注意事项**：
> - 金额字段会使用环境变量 ${TEST_AMOUNT}
> - 提交后会验证 API 调用和网络响应
>
> 正在生成完整 YAML...

---

## 📁 输出规范

### 文件命名规则

```
tests/{module}/{scene}.yaml

示例:
tests/login/portal-login.yaml
tests/asset-eval/apply-normal.yaml
tests/asset-eval/apply-error-missing-field.yaml
```

### 目录组织建议

```
tests/
├── README.md                    # 本文件
├── _login-template.yaml         # 通用登录模板（可复用）
├── login/
│   ├── portal-login.yaml
│   └── sso-login.yaml
├── asset-eval/
│   ├── apply-normal.yaml       # 正常路径
│   ├── apply-error.yaml        # 异常路径（缺字段）
│   └── approve-flow.yaml       # 审批流程
└── system-manage/
    ├── user-crud.yaml
    └── role-permission.yaml
```

### YAML 格式速查

```yaml
# 必填字段（规则 1）
test_id: "MODULE-NNN-scene-name"
title: "清晰的人类可读标题"
priority: "P0"  # P0(核心) P1(重要) P2(边界)
tags: ["标签"]

# 前置状态（规则 1 + 5）
context_check:
  login_url: "http://..."
  home_indicator: "首页特征"
  credentials:
    username: "${ENV_VAR}"  # 规则 5
    password: "${ENV_VAR}"

# 步骤数组（规则 2 + 3 + 4）
steps:
  - step: 1
    desc: "步骤描述"
    action: "动作类型"      # 规则 2
    target: "语义化描述"    # 规则 3
    value: "值或${ENV_VAR}"
    locator:
      uid_cache_key: "key" # 可选
    wait_after:             # 可选
      type: navigation | time
      timeout: 5000
    assertion:              # 规则 4（必填！）
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

生成的 YAML 用例可直接交给 **testcase-agent** 执行：

```bash
# 方式 1：在对话中直接委托
"将这个用例交给 testcase-agent 执行"

# 方式 2：通过命令行
pdd test replay tests/asset-eval/apply-normal.yaml
```

### 上游：pdd-main

可在 pdd-main 的 verify-feature 阶段自动触发：

```
PRD → 功能实现 → 代码审查 → 功能验证
                                  ↓（可选）
                          testcase-modeler → testcase-agent
```

---

## ⚙️ 高级特性

### 特性 1：未知动作引导

当用户的描述无法匹配任何内置动作时：

```
用户: "拖拽文件到上传区域"

AI: ⚠️ 我暂时不支持"拖拽"操作，但发现你可能需要：

🎯 最接近的内置动作：
   upload_file - 文件上传
   支持的说法："上传文件 xxx 到 上传按钮"

💡 如果确实需要拖拽功能，可以在 config/test-actions.yaml 中添加自定义动作：

drag_drop:
  display: "拖拽文件"
  patterns:
    - "拖拽 {file} 到 {target}"
  mcp: upload_file  # 底层可能复用相同 MCP 工具

是否要我帮你添加这个自定义动作？(Y/n)
```

### 特性 2：模板复用

支持引用已有的通用模板：

```yaml
# 引用登录模板
include: "../_login-template.yaml"

# 然后只定义后续步骤
steps:
  - step: 5
    desc: "进入业务系统"
    action: click
    target: "资产评估系统"
```

### 特性 3：数据驱动

支持参数化测试数据：

```yaml
# 定义测试数据集
test_data:
  - { project_name: "项目A", amount: "100万", expect: "success" }
  - { project_name: "项目B", amount: "-50万", expect: "error" }
  - { project_name: "", amount: "200万", expect: "validation_error" }

# 步骤中使用变量
steps:
  - step: 6
    action: fill
    target: "项目名称"
    value: "${data.project_name}"
```

---

## 📚 参考资源

### 相关文档
- [设计文档 v1.0](../../docs/superpowers/specs/2026-05-08-pdd-test-skill-design.md)
- [动作配置](../../config/test-actions.yaml) - 所有可用动作定义
- [全局配置](../../config/cdp-test-config.yaml) - 测试框架配置

### 示例用例
- [examples/asset-eval-apply.yaml](examples/asset-eval-apply.yaml) - 资产评估申请示例
- [examples/login-flow.yaml](examples/login-flow.yaml) - 登录流程示例

### 最佳实践
- 优先使用高置信度的动作匹配（confidence > 0.85）
- 每个用例控制在 5-15 步以内（过长考虑拆分）
- 重要业务流程准备正反两个用例（正常路径 + 异常路径）
- 定期更新 UID 缓存以适应前端变化

---

## 🆘 常见问题

**Q1: 生成的用例不准确怎么办？**
A: 可以在确认阶段修改具体步骤，或重新描述需求。也可以手动编辑导出的 YAML 文件。

**Q2: 如何处理动态元素（如验证码）？**
A: 在 context_check 中标记 `captcha_required: true`，Agent 执行时会提示人工干预或使用测试环境专用验证码。

**Q3: 能否批量生成多个用例？**
A: 可以。描述多个场景，Modeler 会为每个场景生成独立的 YAML 文件。

**Q4: 如何复用已有用例？**
A: 使用 `include:` 引用通用模板（如登录模板），避免重复定义。

**Q5: 环境变量如何设置？**
A: 参考 `config/cdp-test-config.yaml` 的 `env_mapping` 部分。执行前需在系统中设置对应的环境变量。

---

> **版本历史**
> - v1.0.0 (2026-05-08): 初始版本，基于设计文档 v1.0 实现
>
> **维护者**: PDD Team  
> **许可证**: MIT