---
name: testcase-modeler
description: "测试用例建模师，将自然语言描述或页面操作录制转换为结构化YAML测试用例。当用户生成测试用例、录制操作流程、创建E2E测试时调用。支持中文触发：写个测试用例、生成测试用例、录制测试流程、零基础写测试、自然语言转测试、回归测试、冒烟测试、UI自动化、E2E自动化。"
license: MIT
compatibility: Chrome DevTools MCP + YAML 测试框架
metadata:
  author: "PDD Team"
  version: "2.0.1"
  lastUpdated: "2026-05-20"
  triggers:
    - "/testcase" | "/model" | "/录制"
    - "写个测试用例" | "生成测试用例" | "录制测试流程"
    - "零基础写测试" | "自然语言转测试"
    - "回归测试" | "冒烟测试" | "UI自动化" | "E2E自动化"
---

# Testcase Modeler Skill - 测试用例建模师

> **版本**: 2.0.1 | **分类**: Expert Skill | **作者**: PDD Team | **更新**: 2026-05-20

## 技能概述

将**自然语言描述（或页面操作录制）转换为结构化 YAML 测试用例**的 AI 技能。测试人员无需编写代码，用日常语言描述业务操作流程即可生成可回放的 E2E 测试脚本。

**核心价值**: 零代码门槛(会说中文就能写) | 智能意图提取(自动识别导航/输入/点击/验证) | 断言自动注入(每步配对断言) | 安全处理(密码等敏感信息用环境变量) | 特殊组件支持(el-select/spinbutton) | 标准输出(YAML + 配套 .env)

**适用场景**: 实习生学习流程(零基础入门) | 测试人员快速写用例/回归 | 业务人员验证功能 | 开发人员回归/E2E自动化 | 项目经理验收测试/场景覆盖

## 触发条件

**主动触发原则**: 用户提到以下关键词时，即使未明确要求"生成测试用例"，也应主动使用本技能。

**核心触发词**: "帮我写个测试用例" | "生成自动化测试" | "录制测试流程" | "把这个操作录下来" | "测试一下XXX功能"
**场景化触发词**: "零基础写测试" | "自然语言转测试" | "回归测试" | "冒烟测试" | "UI自动化" | "E2E自动化" | "验收测试" | "浏览器测试" | "Chrome DevTools测试"
**v2.0新增**: "页面操作记录" | "下拉选择怎么选" | "多选框怎么填" | "数字输入框填值" | "金额字段填写"

**上下文智能识别**: 出现操作序列描述 + 业务系统提及 + 测试意图表达 + 能力限制声明(不会编程) + 组件操作困难(下拉选不了/数字框填不进)时强烈建议触发。

## 六条建模规则（Iron Rules v2.0）

> ⚠️ 必须严格遵守以下规则，确保生成的 YAML 用例质量。详细示例见 `references/iron-rules-detail.md`。

**规则 1：结构完整性 + .env 配对文件**
每个 YAML 必须含必填字段：`test_id`/`title`/`priority`/`tags`/`author`/`context_check`(login_url+credentials)/`steps`/`teardown`。必须配套同目录同名的 `.env` 文件（框架不硬编码默认值，所有测试数据经 `.env` 或系统环境变量提供）。⚠️ `step` 必须为纯整数，禁止 `19b`/`step_2` 混合格式（`_include` 重编号会崩溃）。

**规则 2：智能意图提取**
从自然语言自动映射动作类型：打开→`navigate` | 输入→`fill` | 点击→`click` | 下拉→`select_option`(用中文显示名) | 勾选→`checkbox` | 上传→`upload_file` | 提交→`click` | 等待→`wait_for` | 截图→`screenshot` | 验证→`assert_*` | 滚动→`scroll`。

**规则 3：三层语义化定位**
永远用人类可读语义化描述定位。解析策略: P0 `uid_cache_key`缓存命中 → P1 精确文本匹配 → P2 模糊评分匹配。禁止 CSS 类名/XPath/nth-child/硬编码选择器。推荐: UID缓存/占位符文本/ARIA标签/语义组合/Role+文本。交互角色15种，**`spinbutton`(数字输入框)最易遗漏**。

**规则 4：断言注入**
每步操作必须配对断言。navigate→`text_contains` | click导航→`element_visible` | click提交→`network_called`+`toast_visible` | fill→`field_filled` | select_option→`element_text` | delete→`element_hidden` | upload→`element_visible`。

**规则 5：安全处理 + 环境变量管理**
敏感信息必须用环境变量引用（`${TEST_USER}`等），禁止硬编码明文。来源优先级: 用例 `.env` 文件 > 全局环境变量 > 无默认值。Modeler 必须同时生成 `.env` 文件并提醒用户确认。

**规则 6：特殊组件处理指南**
el-select→`select_option`(中文option名) | el-input-number→`fill`(spinbutton) | el-cascader/el-date-picker→`click`+键盘。el-select 选项经 teleport 渲染到 body 外层，需用 `evaluate_script` JS 点击。详细对照表见 `references/iron-rules-detail.md`。

**规则 7：生成后确认**
生成 YAML + `.env` 后必须向用户展示摘要并请求确认（基本信息/配套文件/核心校验点/安全处理/下一步）。

## 交互式录制模式

除自然语言→YAML 外，支持浏览器操作录制→YAML。命令: `python tests/testcase-ai.py --record [路径]`。录制流程、技术原理、适用场景与优化建议详见 `references/recording-mode.md`。

## 工作流程

```
1. 用户发起 → 2. 信息收集(确认模块/起始状态/测试数据/预期结果)
→ 3. 意图分析(解析操作序列→匹配动作→识别实体→推断隐含步骤→识别特殊组件)
→ 4. YAML + .env 生成(遵循7条规则) → 5. 确认与导出(测试摘要→用户确认→导出)
```

## 输出规范

**命名规则**: `testcases/{module}/{scene}.yaml` + 同名 `.env`。**目录组织**与 **YAML 格式速查**详见 `references/output-spec.md`。

## 与其他 Skill 的协作

**下游 testcase-agent**: 生成的 YAML + .env 可直接交给 testcase-agent 执行（对话委托或 `python tests/testcase-ai.py <yaml>`）。工具链: testcase-modeler(建模)→testcase-agent(执行)→MCP Chrome DevTools(浏览器控制)→目标业务系统。

## 参考资料

- [yaml-format-guide.md](examples/yaml-format-guide.md) - 完整格式参考
- [设计文档](../../docs/superpowers/specs/) - 架构设计
- 示例: [examples/asset-eval-apply.yaml](examples/asset-eval-apply.yaml) + .env | [examples/login-flow.yaml](examples/login-flow.yaml) + .env

## 版本历史

- v2.0.1 (2026-05-20): 新增步骤编号规范 — step 必须纯整数
- v2.0.0 (2026-05-14): 新增 .env 配对机制、el-select 处理、三层定位策略、spinbutton 支持、evaluate_script 能力、特殊组件处理规则
- v1.0.1 (2026-05-08): 增强触发词覆盖、优化文档结构
- v1.0.0 (2026-05-08): 初始版本

> **维护者**: PDD Team | **许可证**: MIT

## 参考资料加载指引

按需加载 `references/` 下的参考资料：
- `references/iron-rules-detail.md` - 六条规则详细 YAML 示例、动作/断言/环境变量表格、特殊组件对照
- `references/recording-mode.md` - 交互式录制模式流程、技术原理、对话示例
- `references/output-spec.md` - 文件命名、目录组织、YAML 格式速查、FAQ 与最佳实践

**加载策略**: 常规建模用SKILL.md内置规则；需要具体 YAML 模板/组件细节时加载 `iron-rules-detail.md`；需要录制模式细节时加载 `recording-mode.md`；需要输出规范/FAQ 时加载 `output-spec.md`。