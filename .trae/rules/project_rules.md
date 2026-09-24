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


### 特定目录

| 目录 | 用途 |
|------|------|
| `admin/` | 后端主应用 |
| `system/` | 系统业务模块 |
| `framework/` | 框架核心模块 |
| `common/` | 通用工具模块 |
| `testcases/backend/` | 后端测试 |
| `testcases/frontend/` | 前端测试 |
| `testcases/shared/` | 共享测试数据 |
| `testcases/reports/` | 测试报告 |
| `ui/` | Vue前端项目 |
| `{业务模块}/` | 业务模块（kebab-case命名） |


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
├── admin/              # 后端主应用
├── system/             # 系统业务模块
├── framework/          # 框架核心模块
├── common/             # 通用工具模块
├── testcases/          # 测试用例
│   ├── backend/        # 后端测试
│   ├── frontend/       # 前端测试
│   ├── shared/         # 共享测试数据
│   └── reports/        # 测试报告
├── ui/                 # Vue前端项目
└── {其他业务模块}/      # 业务模块（kebab-case命名）
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
