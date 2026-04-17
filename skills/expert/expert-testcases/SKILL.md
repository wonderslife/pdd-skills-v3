---
name: expert-testcases
description: "E2E测试用例生成专家，基于源码/PRD自动生成6层测试用例集（API/集成/UI/E2E/边界异常/性能），包含可运行的pytest代码。当用户需要生成测试用例、测试数据、测试代码、E2E测试、API测试、集成测试、回归测试等场景时自动触发。"
license: "MIT"
author: "neuqik@hotmail.com"
version: "1.0"
---

# E2E测试用例生成专家 (expert-testcases)

## Overview

本技能基于6步E2E测试方法论，从源码/PRD自动生成完整的6层测试用例集，覆盖从API单接口到端到端场景的全链路测试。输出包含标准化文档（Markdown）和可运行代码（pytest/Playwright/Locust）。

核心价值：将测试用例设计从"人工经验驱动"升级为"方法论+模板驱动"，确保一致性和可复现性。

## Directory Structure

```
expert-testcases/
├── SKILL.md                          # 技能定义文件
├── _meta.json                        # 元数据
├── LICENSE                           # MIT License
├── references/                       # 参考文档
│   ├── methodology.md                # E2E测试6步方法论
│   ├── ruoyi-testing-guide.md        # 若依框架测试指南
│   ├── api-testing-patterns.md       # API测试模式库
│   ├── workflow-testing-patterns.md  # 工作流测试模式
│   └── coverage-best-practices.md    # 覆盖率最佳实践
├── templates/                        # Jinja2模板
│   ├── docs/                         # 文档模板
│   │   ├── api-testcase.md.j2
│   │   ├── integration-testcase.md.j2
│   │   ├── e2e-testcase.md.j2
│   │   ├── boundary-testcase.md.j2
│   │   ├── performance-testcase.md.j2
│   │   ├── ui-testcase.md.j2
│   │   └── readme.md.j2
│   ├── code/python/                  # pytest代码模板
│   │   ├── conftest.py.j2
│   │   ├── config.py.j2
│   │   ├── pytest.ini.j2
│   │   ├── requirements.txt.j2
│   │   ├── api_helper.py.j2
│   │   ├── test_crud.py.j2
│   │   ├── test_approval.py.j2
│   │   ├── test_integration.py.j2
│   │   └── test_e2e.py.j2
│   └── data/                         # 数据模板
│       ├── test-data.yaml.j2
│       └── users.yaml.j2
├── scripts/                          # 工具脚本
│   ├── analyze_source.py             # 源码分析
│   ├── extract_api.py                # API提取
│   ├── build_matrix.py               # 权限矩阵构建
│   └── validate_output.py            # 输出验证
├── evals/                            # 评估标准
│   ├── default-evals.json
│   └── quality-rubric.md
└── examples/                         # 示例
    └── zccz-1-equity-transfer/
        ├── snapshot-input.md
        └── snapshot-output.md
```

## Trigger Conditions

**Automatic Triggers:**
- 用户请求"生成测试用例"、"写测试"、"E2E测试"、"API测试"
- pdd-extract-features完成后需要配套测试
- pdd-code-reviewer发现缺陷需要回归测试
- 用户提到"测试覆盖率"、"回归测试"、"测试数据"

**Manual Triggers:**
- 用户输入命令如 `/testcases`, `/test-gen`, `/e2e-test`

---

## Core Capabilities

### C1: 业务流分析与状态机建模

从源码/PRD提取业务流程，构建状态机模型：

```
输入: Controller + Service 源码
    ↓
1. 识别业务操作 (CRUD + 审批)
2. 提取状态码集合
3. 构建合法状态转移图
4. 标记关键转移路径
    ↓
输出: 状态机模型 (status_codes + transitions)
```

**状态机提取规则：**
- 从Service的`determineStatusByNode`方法提取节点→状态映射
- 从`handleApproval`提取approve/reject状态转移
- 从Controller的add/edit提取初始状态设置

### C2: API契约提取与权限矩阵

自动扫描Controller层，生成API端点清单和权限矩阵：

```yaml
# 提取规则
api_extraction:
  source: "@RequestMapping/@GetMapping/@PostMapping/@PutMapping/@DeleteMapping"
  permission: "@PreAuthorize/@ss.hasPermi"
  path_prefix: "class-level @RequestMapping"
  
matrix_generation:
  roles: ["applicant", "dept_manager", "leader", "admin", "cross_dept_user"]
  operations: [list, query, add, edit, remove, approval, export]
  check_method: "对比权限标识与角色分配"
```

### C3: 测试数据工程 (test-data.yaml)

生成标准格式的测试数据文件，包含：
- 5角色测试用户（applicant/dept_manager/leader/admin/cross_dept_user）
- 表单数据变体（valid_draft/valid_submit/invalid_*/boundary_*）
- 审批操作数据（approve/reject/no_opinion）
- 文件上传数据（议案/决议，含合法与非法格式）
- 工作流配置（节点/审批人/必传文件）
- 状态码定义
- API端点清单

### C4: 六层测试用例生成

| 层级 | 文档 | 代码 | 关注点 |
|------|------|------|--------|
| Level 1 API层 | 01-api-testcases.md | pytest (requests) | 单接口输入输出 |
| Level 2 集成层 | 02-integration-testcases.md | pytest (requests) | 多接口联动+状态流转 |
| Level 3 UI层 | 03-ui-testcases.md | Playwright | 页面交互+表单验证 |
| Level 4 E2E层 | 04-e2e-testcases.md | Playwright | 完整业务场景 |
| Level 5 边界异常 | 05-boundary-exception-testcases.md | pytest | 边界值+异常输入 |
| Level 6 性能层 | 06-performance-testcases.md | Locust | 并发+响应时间 |

### C5: 可运行代码生成

为API层和集成层生成可运行的pytest代码：

**代码架构（来自ZCCZ-1验证）：**
```
{NN}-{level}-testcases/
├── conftest.py      # ApiHelper + Session fixtures + 数据fixtures
├── config.py        # BASE_URL/USERS/TIMEOUT配置
├── pytest.ini       # markers定义(p0/p1/p2/functional/permission/exception)
├── requirements.txt # pytest/requests/PyYAML/allure-pytest
├── README.md        # 运行说明
└── test_*.py        # 测试文件
```

**关键设计模式：**
- ApiHelper封装所有API调用
- Session级fixture复用Token
- 每个测试方法独立创建前置数据（幂等性）
- pytest.skip处理流程节点未到达的情况

### C6: 覆盖率保障与报告

生成覆盖率预估报告，包含6维指标：
1. API端点覆盖率（目标100%）
2. 权限场景覆盖率（目标≥95%）
3. 状态转移覆盖率（目标≥90%）
4. 代码行覆盖率（目标≥80%）
5. 分支覆盖率（目标≥70%）
6. 函数覆盖率（目标≥85%）

---

## Execution Flow

```
输入: 项目路径 + 模块名 + 框架类型
    │
    ▼
┌─────────────────────────────────┐
│   Phase 1: 分析                  │
│   1. 扫描Controller提取API端点   │
│   2. 解析@PreAuthorize权限注解   │
│   3. 分析Service提取状态机       │
│   4. 生成test-data.yaml         │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│   Phase 2: 生成                  │
│   5. 渲染6层文档模板             │
│   6. 渲染pytest代码模板          │
│   7. 生成README总览              │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│   Phase 3: 验证                  │
│   8. 语法检查(py_compile)        │
│   9. pytest收集验证              │
│   10. 输出覆盖率预估报告         │
└─────────────────────────────────┘
    │
    ▼
输出: 完整测试用例集 (docs + code + data)
```

---

## Input Specification

```yaml
input:
  project_path: string              # 项目根目录（必填）
  module_name: string               # 模块名如 "equity-transfer"（必填）
  module_code: string               # 编码如 "ZCCZ-1"（必填）
  source_type: "source_code|prd|mixed"  # 分析来源
  backend_framework: "ruoyi|spring_boot|fastapi"  # 后端框架
  frontend_framework: "vue2_elementui|vue3_elementplus"  # 前端框架
  has_workflow: boolean             # 是否含工作流
  workflow_engine: "activiti7|camunda|flowable"  # 工作流引擎
  test_users:                       # 测试用户列表
    - role: string
      username: string
      password: string
      dept: string
      dept_id: int
  output_dir: string               # 输出目录
  levels: ["api","integration","e2e","boundary_exception","performance","ui"]
  include_code: boolean             # 是否生成可运行代码
```

---

## Collaboration Table

| Collaborating Skill | Mode | Description |
|--------------------|------|-------------|
| **pdd-extract-features** | Upstream | 功能点矩阵 → 测试需求 |
| **pdd-generate-spec** | Bidirectional | spec.md ↔ 测试用例对齐 |
| **pdd-implement-feature** | Downstream | 实现代码 → 回归用例 |
| **pdd-code-reviewer** | Feedback | Bug → 回归测试用例 |
| **pdd-verify-feature** | Validation | 验收标准 ↔ 预期结果 |
| **pdd-template-engine** | Delegation | 测试脚手架代码生成 |
| **expert-ruoyi** | Consultation | 若依Bug模式 → 测试用例 |
| **expert-activiti** | Consultation | BPMN节点 → 审批测试链路 |
| **expert-code-quality** | Feedback | Code Smell → 边界测试用例 |
| **expert-security** | Consultation | 安全漏洞 → 安全测试用例 |
| **expert-performance** | Consultation | 性能基线 → 性能测试场景 |

---

## Quick Decision Matrix

| Scenario | Primary Action |
|----------|---------------|
| 新模块需要完整测试 | 6层全量生成 |
| 仅需API测试 | levels=["api"] |
| 已有文档需补代码 | include_code=true, 跳过文档生成 |
| 工作流模块 | has_workflow=true + expert-activiti协作 |
| 代码审查后补回归 | 缺陷驱动模式，仅生成回归用例 |
| 增量更新 | 对比源码指纹，仅更新变更部分 |

---

## Anti-Patterns

| Anti-Pattern | Description | Correct Approach |
|--------------|-------------|------------------|
| 全量硬编码 | 测试数据写死在代码中 | 使用test-data.yaml数据驱动 |
| 忽略权限测试 | 只测功能不测权限 | 每个API至少1个权限用例 |
| 依赖执行顺序 | 用例间有先后依赖 | 每个用例独立创建前置数据 |
| 忽略工作流 | 只测CRUD不测审批链路 | 集成层覆盖完整审批链 |
| 过度Mock | Mock掉所有依赖 | API/集成层使用真实HTTP调用 |

---

## Guardrails

- 生成的测试用例必须基于源码实际逻辑，不得臆造不存在的API或状态
- 错误消息必须与源码中的ServiceException消息一致
- 权限标识必须与@PreAuthorize注解完全匹配
- 状态码映射必须与determineStatusByNode方法一致
- 测试数据中的用户账号必须是真实系统账号
- 每个API端点至少覆盖1个正向用例和1个权限/异常用例
- 工作流测试必须覆盖完整审批链路和驳回重提场景
- 生成的代码必须通过py_compile语法检查

---

## Version History

### v1.0 (2026-04-16)
- 初始版本
- 6层测试用例文档模板
- API层+集成层pytest代码模板
- test-data.yaml标准格式
- 源码分析脚本框架
- ZCCZ-1股权转让模块验证通过
