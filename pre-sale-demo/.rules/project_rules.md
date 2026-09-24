# Project Rules

本文档定义项目级的规范和标准，所有开发者和AI Agent必须遵循。

## 1. Directory Structure


### 基准目录

| 目录 | 用途 |
|------|------|
| `docs/reviews/` | Code Review 报告 |
| `docs/plans/` | 设计文档 |
| `specs/features/` | 功能规格 |
| `scripts/` | 工具脚本 |
| `openspec/changes/` | 活跃变更 |
| `openspec/archive/` | 归档变更 |

### AI 测试框架目录

| 目录 | 用途 |
|------|------|
| `tests/` | AI自动化测试框架核心代码（Python） |
| `tests/testcase-ai.py` | 主执行引擎 - YAML驱动测试用例执行器 |
| `tests/login_manager.py` | 登录状态管理器 - 智能检测/跳过/切换用户 |
| `tests/.env.test` | 环境变量配置（用户名、密码、MCP等） |
| `testcases/` | YAML测试用例文件 |
| `testcases/examples/` | YAML格式说明与样例文档 |
| `test-result/` | 测试运行结果（自动生成，含报告和快照）



### 完整目录结构

```
├── docs/
│   ├── reviews/
│   └── plans/
├── specs/features/
├── scripts/
├── openspec/
│   ├── changes/
│   └── archive/
├── tests/                          ← AI测试框架
│   ├── testcase-ai.py              # 主执行引擎
│   ├── login_manager.py            # 登录管理
│   ├── .env.test                   # 环境配置
│   └── README.md                   # 框架说明
├── testcases/                      ← YAML测试用例
│   ├── examples/                   # 格式文档与样例
│   │   └── yaml-format-guide.md
│   └── README.md
└── test-result/                    ← 运行结果（自动生成）
    └── run-YYYYMMDD-HHMMSS/
        ├── report-*.md
        └── snapshots/
```


## 2. Naming Conventions

### 2.1 业务模块命名

- 使用 kebab-case 格式
- 示例：`equity-transfer`、`asset-disposition`、`property-evaluation`

### 2.2 功能点编号

格式：`FP-{module}-{NNN}-{name}`

示例：
- `FP-ZCCZ1-001-transfer` - 转让申请功能
- `FP-ZCPG1-001-evaluation` - 评估备案功能

## 3. Development Standards

### 3.1 变更管理

OpenSpec 变更操作目录：

| 变更类型 | 操作目录 | 说明 |
|---------|---------|------|
| 源码实现 | `openspec/` | 涉及代码编写、重构、测试等源码相关工作 |
| 需求分析设计 | `openspec/` | 涉及需求分析、设计文档、原型等文档工作 |

### 3.2 文档命名

| 类型 | 格式 | 示例 |
|------|------|------|
| 设计文档 | `{序号}-{主题}.md` | `01-项目概述.md` |
| Review报告 | `review-YYYYMMDD-HHMMSS.md` | `review-20260407-143000.md` |
| 功能规格 | `FP-{module}-{NNN}-{name}/spec.md` | `FP-ZCCZ1-001-transfer/spec.md` |

## 4. Code Quality

## 5. Testing Requirements

## 6. Documentation Standards
