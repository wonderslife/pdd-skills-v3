# Testcase Modeler Skill

> **版本**: 2.0.0 | **分类**: Expert Skill

## 概述

Testcase Modeler 是一个 AI 测试用例建模技能，能够将**自然语言描述**或**页面操作录制**转换为结构化的 YAML 测试用例文件。

## v2.0 更新亮点 (2026-05-14)

基于实际调试和验证经验，v2.0 做了以下重大更新：

### 🆕 新特性

| 特性 | 说明 |
|------|------|
| **.env 配对文件机制** | 每个 YAML 用例自动配对同名 .env 文件，测试数据与用例绑定 |
| **el-select 多选框支持** | 使用 `select_option` + 中文 option 名，框架自动处理 readonly + JS DOM click |
| **spinbutton 数字输入框识别** | 修复了数字输入框定位错误的 bug（15 种交互角色全覆盖） |
| **三层元素定位策略** | P0(UID缓存) → P1(精确文本) → P2(模糊评分)，文档化完整策略 |
| **evaluate_script 能力说明** | 记录 MCP 工具能力边界，指导 Modeler 生成正确 YAML |
| **特殊组件处理规则** | 新增规则 6：Vue Element UI 组件对照表和最佳实践 |

### 示例文件更新

- `asset-eval-apply.yaml` — 从简化版升级为完整 13 步用例
  - 步骤 11: spinbutton 数字输入（评估金额）
  - 步骤 12: el-select 多选框（评估方法 → 市场法）
  - 所有 locator 改用 `uid_cache_key` 而非硬编码 uid
- `asset-eval-apply.env` — 配套环境变量文件
- `login-flow.yaml` / `login-flow.env` — 登录流程示例
- `yaml-format-guide.md` — 完整格式参考（含所有新特性）

## 快速开始

```bash
# 触发方式（任选一种）
"帮我写一个资产评估申请的测试用例"
"录制一下登录流程的操作步骤"
"页面操作自动化回放"

# 输出结果
testcases/asset-eval/apply-normal.yaml   # 测试用例
testcases/asset-eval/apply-normal.env    # 环境变量（自动生成）

# 执行测试
python tests/testcase-ai.py testcases/asset-eval/apply-normal.yaml
```

## 核心规则（7 条 Iron Rules v2.0）

1. **结构完整性 + .env 配对** — 必填字段检查清单
2. **智能意图提取** — 自然语言 → action 映射表
3. **三层语义化定位** — P0/P1/P2 解析策略 + 15 种交互角色
4. **断言注入** — 每步操作必须配对断言
5. **安全处理 + .env 管理** — 敏感字段环境变量化
6. **特殊组件处理** — el-select、spinbutton 等 Vue 组件指南
7. **生成后确认** — 展示摘要并请求用户确认

详细规则请参阅 [SKILL.md](./SKILL.md)

## 文件结构

```
skills/expert/testcase-modeler/
├── SKILL.md                    # 主文档（完整规范）
├── _meta.json                  # 元数据（触发词、版本等）
├── README.md                   # 本文件
└── examples/
    ├── asset-eval-apply.yaml   # 资产评估申请示例（13步）
    ├── asset-eval-apply.env    # 配套环境变量
    ├── login-flow.yaml         # 登录流程示例（5步）
    ├── login-flow.env          # 配套环境变量
    └── yaml-format-guide.md    # 完整格式参考
```

## 与 testcase-agent 的协作

```
用户描述操作流程
       ↓
testcase-modeler (建模)
  ↓ 生成 YAML + .env
testcase-agent (执行)
  ↓ 调用 Chrome DevTools MCP
目标业务系统 (验证)
```

## 参考链接

- [SKILL.md](./SKILL.md) — 完整规范文档
- [yaml-format-guide.md](./examples/yaml-format-guide.md) — YAML 格式参考
- [asset-eval-apply.yaml](./examples/asset-eval-apply.yaml) — 完整示例
