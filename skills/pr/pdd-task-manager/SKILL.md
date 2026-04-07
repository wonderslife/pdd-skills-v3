---
name: pdd-task-manager
description: PDD任务管理技能，提供细粒度任务清单管理和断点续传能力。当用户需要继续中断任务或恢复执行进度时自动触发。支持中文触发：任务管理、断点续传、恢复进度、继续执行。
license: MIT
compatibility: 需要 .pdd/state-{moduleId}.json 状态文件，支持多模块并行执行
metadata:
  author: "neuqik@hotmail.com"
  version: "1.0"
---

# PDD任务管理技能

## 技能描述

PDD任务管理技能提供细粒度的任务清单管理和断点续传能力，支持在开发过程中中断后精确恢复执行进度，确保不会遗漏任何执行步骤。

## 触发条件

- PDD流程开始时自动创建任务清单
- 用户发出"继续执行"、"恢复进度"等命令
- 功能点实现过程中需要跟踪子任务进度

## 核心能力

### 1. 分层任务清单

```yaml
任务层级:
  模块级 (Module)
    └── 功能点级 (Feature)
          └── 任务组级 (TaskGroup)
                └── 原子任务级 (Task)

示例:
  ZCCZ-1 (模块)
    └── FP-ZCCZ1-001 (功能点)
          ├── database (任务组)
          │     ├── create-table
          │     └── insert-dict-data
          ├── backend (任务组)
          │     ├── generate-entity
          │     ├── generate-mapper
          │     ├── generate-service
          │     └── generate-controller
          └── frontend (任务组)
                ├── generate-api
                ├── generate-list-page
                ├── generate-form-page
                └── generate-detail-page
```

### 2. 任务状态跟踪

```yaml
任务状态:
  - pending: 待执行
  - in_progress: 执行中
  - completed: 已完成
  - failed: 失败
  - skipped: 已跳过
  - blocked: 被阻塞

状态转换规则:
  pending → in_progress: 开始执行任务
  in_progress → completed: 任务执行成功
  in_progress → failed: 任务执行失败
  in_progress → blocked: 任务被阻塞（依赖未满足）
  failed → in_progress: 重试任务
  pending → skipped: 跳过任务
```

### 3. 断点续传机制

```yaml
状态文件路径规则:
  - 单模块模式: .pdd/state.json
  - 多模块模式: .pdd/state-{moduleId}.json
  - 示例: .pdd/state-ZCCZ-1.json, .pdd/state-ZCPG-1.json

目录结构:
  .pdd/
  ├── state-ZCCZ-1.json      # 国有产权转让模块状态
  ├── state-ZCCZ-2.json      # 资产转让模块状态
  ├── state-ZCPG-1.json      # 评估备案模块状态
  └── archive/               # 已完成模块归档目录
      └── state-ZCCZ-1.completed.json

并发安全机制:
  - 每个模块独立状态文件，避免冲突
  - 文件锁机制防止并发写入
  - 状态文件版本控制

内容结构:
  version: "2.0"
  moduleId: "ZCCZ-1"
  moduleName: "国有产权转让"
  
  currentPhase: "feature-loop"
  currentFeature: "FP-ZCCZ1-002"
  currentTaskGroup: "backend"
  currentTask: "generate-service"
  
  progress:
    totalFeatures: 5
    completedFeatures: 1
    currentFeatureProgress: 45%
  
  taskProgress:
    FP-ZCCZ1-001:
      status: completed
      completedAt: "2026-03-31T10:30:00Z"
      taskGroups:
        database: completed
        backend: completed
        frontend: completed
        menu: completed
    
    FP-ZCCZ1-002:
      status: in_progress
      startedAt: "2026-03-31T11:00:00Z"
      taskGroups:
        database: completed
        backend:
          generate-entity: completed
          generate-mapper: completed
          generate-service: in_progress
          generate-controller: pending
        frontend: pending
        menu: pending
  
  retryHistory:
    - taskId: "generate-service"
      attempt: 1
      error: "缺少依赖接口定义"
      timestamp: "2026-03-31T11:15:00Z"
      resolved: true
      resolution: "补充接口定义后重试成功"
  
  checkpoints:
    - id: "cp-001"
      timestamp: "2026-03-31T10:00:00Z"
      phase: "spec-generation"
      description: "规格生成完成"
    
    - id: "cp-002"
      timestamp: "2026-03-31T11:00:00Z"
      phase: "feature-loop"
      featureId: "FP-ZCCZ1-001"
      description: "第一个功能点完成"
```

### 4. 任务依赖管理

```yaml
依赖类型:
  - sequential: 顺序依赖（A完成后才能执行B）
  - parallel: 并行依赖（A和B可以同时执行）
  - conditional: 条件依赖（满足条件后才能执行）

依赖规则:
  backend → frontend: 后端完成后才能开发前端
  database → backend: 数据库完成后才能开发后端
  generate-entity → generate-mapper: 实体类完成后才能生成Mapper
  generate-service → generate-controller: Service完成后才能生成Controller

依赖图示例:
  database
      │
      ▼
  generate-entity
      │
      ├──────────────┐
      ▼              ▼
  generate-mapper  generate-service
      │              │
      │              ▼
      │          generate-controller
      │              │
      └──────────────┤
                     ▼
                 frontend
```

## 执行流程

```
PDD流程启动
    │
    ▼
┌─────────────────────────────────┐
│   1. 创建模块级任务清单          │
│   - 解析功能点矩阵               │
│   - 生成功能点列表               │
│   - 初始化状态文件               │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│   2. 为每个功能点生成任务清单    │
│   - 数据库任务组                 │
│   - 后端任务组                   │
│   - 前端任务组                   │
│   - 菜单配置任务组               │
│   - 测试任务组                   │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│   3. 执行任务并更新状态          │
│   - 标记任务开始                 │
│   - 执行任务                     │
│   - 记录结果                     │
│   - 更新进度                     │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│   4. 检查点保存                  │
│   - 每完成一个任务组保存检查点   │
│   - 记录关键状态变更             │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│   5. 异常处理与恢复              │
│   - 记录失败原因                 │
│   - 保存恢复上下文               │
│   - 等待用户指令                 │
└─────────────────────────────────┘
```

## 任务清单模板

### 功能点任务清单模板 (tasks.md)

```markdown
# 功能点任务清单

## 功能点信息
- **功能点ID**: FP-ZCCZ1-001
- **功能名称**: 国有产权转让申请
- **复杂度**: P0
- **创建时间**: 2026-03-31 10:00:00

## 任务概览

| 任务组 | 任务数 | 已完成 | 进度 |
|--------|--------|--------|------|
| 数据库 | 2 | 2 | 100% |
| 后端 | 4 | 2 | 50% |
| 前端 | 4 | 0 | 0% |
| 菜单 | 1 | 0 | 0% |
| 测试 | 2 | 0 | 0% |

## 详细任务列表

### 1. 数据库任务组

#### 1.1 创建数据库表
- **状态**: ✅ 已完成
- **开始时间**: 2026-03-31 10:05:00
- **完成时间**: 2026-03-31 10:10:00
- **输出文件**: `sql/equity_transfer_apply.sql`
- **执行结果**: 成功创建表 equity_transfer_apply

#### 1.2 插入字典数据
- **状态**: ✅ 已完成
- **开始时间**: 2026-03-31 10:10:00
- **完成时间**: 2026-03-31 10:12:00
- **输出文件**: `sql/dict_data.sql`
- **执行结果**: 成功插入5条字典数据

### 2. 后端任务组

#### 2.1 生成实体类
- **状态**: ✅ 已完成
- **开始时间**: 2026-03-31 10:15:00
- **完成时间**: 2026-03-31 10:20:00
- **输出文件**: `EquityTransferApply.java`
- **执行结果**: 成功生成实体类

#### 2.2 生成Mapper
- **状态**: ✅ 已完成
- **开始时间**: 2026-03-31 10:20:00
- **完成时间**: 2026-03-31 10:25:00
- **输出文件**: 
  - `EquityTransferApplyMapper.java`
  - `EquityTransferApplyMapper.xml`
- **执行结果**: 成功生成Mapper接口和XML

#### 2.3 生成Service
- **状态**: 🔄 执行中
- **开始时间**: 2026-03-31 10:25:00
- **依赖**: 2.2 生成Mapper
- **输出文件**: 
  - `IEquityTransferApplyService.java`
  - `EquityTransferApplyServiceImpl.java`

#### 2.4 生成Controller
- **状态**: ⏳ 待执行
- **依赖**: 2.3 生成Service
- **输出文件**: `EquityTransferApplyController.java`

### 3. 前端任务组

#### 3.1 生成API接口
- **状态**: ⏳ 待执行
- **依赖**: 2.4 生成Controller
- **输出文件**: `equity-transfer.js`

#### 3.2 生成列表页
- **状态**: ⏳ 待执行
- **依赖**: 3.1 生成API接口
- **输出文件**: `index.vue`

#### 3.3 生成表单页
- **状态**: ⏳ 待执行
- **依赖**: 3.1 生成API接口
- **输出文件**: `form.vue`

#### 3.4 生成详情页
- **状态**: ⏳ 待执行
- **依赖**: 3.1 生成API接口
- **输出文件**: `detail.vue`

### 4. 菜单配置任务组

#### 4.1 配置菜单权限
- **状态**: ⏳ 待执行
- **依赖**: 3.4 生成详情页
- **输出文件**: `menu_equity_transfer_apply.sql`

### 5. 测试任务组

#### 5.1 编写单元测试
- **状态**: ⏳ 待执行
- **依赖**: 4.1 配置菜单权限
- **输出文件**: `EquityTransferApplyTest.java`

#### 5.2 编写集成测试
- **状态**: ⏳ 待执行
- **依赖**: 5.1 编写单元测试
- **输出文件**: `EquityTransferApplyIntegrationTest.java`

## 执行历史

| 时间 | 任务 | 操作 | 结果 |
|------|------|------|------|
| 10:05 | 1.1 创建数据库表 | 开始 | - |
| 10:10 | 1.1 创建数据库表 | 完成 | 成功 |
| 10:10 | 1.2 插入字典数据 | 开始 | - |
| 10:12 | 1.2 插入字典数据 | 完成 | 成功 |
| 10:15 | 2.1 生成实体类 | 开始 | - |
| 10:20 | 2.1 生成实体类 | 完成 | 成功 |
| 10:20 | 2.2 生成Mapper | 开始 | - |
| 10:25 | 2.2 生成Mapper | 完成 | 成功 |
| 10:25 | 2.3 生成Service | 开始 | - |

## 重试记录

| 任务 | 尝试次数 | 最后错误 | 解决方案 |
|------|---------|---------|---------|
| - | - | - | - |

## 恢复点

**当前恢复点**: 2.3 生成Service

**恢复操作**:
1. 读取 spec.md 获取服务接口定义
2. 调用 pdd-template-engine 渲染 Service 模板
3. 输出 IEquityTransferApplyService.java
4. 输出 EquityTransferApplyServiceImpl.java
5. 更新任务状态为完成
6. 继续执行 2.4 生成Controller
```

## 中断续传流程

```
用户发出"继续执行"命令
    │
    ▼
┌─────────────────────────────────┐
│   1. 读取状态文件                │
│   - 读取 .pdd/state-{moduleId}.json │
│   - 解析当前进度                 │
│   - 识别当前任务                 │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│   2. 验证恢复条件                │
│   - 检查依赖是否满足             │
│   - 检查文件是否完整             │
│   - 检查环境是否就绪             │
└─────────────────────────────────┘
    │
    ├─ 条件满足 ─────────────────────┐
    │                                │
    ▼                                ▼
┌─────────────────────────────────┐
│   3. 恢复执行上下文              │
│   - 加载 spec.md                 │
│   - 加载已完成的代码             │
│   - 准备模板变量                 │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│   4. 继续执行当前任务            │
│   - 从断点处继续                 │
│   - 执行剩余步骤                 │
│   - 更新任务状态                 │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│   5. 继续后续任务                │
│   - 按依赖顺序执行               │
│   - 定期保存检查点               │
└─────────────────────────────────┘
```

## 状态文件格式

### .pdd/state-{moduleId}.json 完整示例

```json
{
  "version": "2.0",
  "moduleId": "ZCCZ-1",
  "moduleName": "国有产权转让",
  "startedAt": "2026-03-31T09:00:00Z",
  "updatedAt": "2026-03-31T11:30:00Z",
  
  "currentPhase": "feature-loop",
  "currentFeature": "FP-ZCCZ1-002",
  "currentTaskGroup": "backend",
  "currentTask": "generate-service",
  
  "progress": {
    "totalFeatures": 5,
    "completedFeatures": 1,
    "skippedFeatures": 0,
    "failedFeatures": 0,
    "overallProgress": 25
  },
  
  "featureList": [
    {
      "id": "FP-ZCCZ1-001",
      "name": "转让申请",
      "priority": "P0",
      "status": "completed",
      "completedAt": "2026-03-31T10:30:00Z"
    },
    {
      "id": "FP-ZCCZ1-002",
      "name": "转让审批",
      "priority": "P0",
      "status": "in_progress",
      "startedAt": "2026-03-31T11:00:00Z",
      "progress": 45
    },
    {
      "id": "FP-ZCCZ1-003",
      "name": "转让公告",
      "priority": "P1",
      "status": "pending"
    },
    {
      "id": "FP-ZCCZ1-004",
      "name": "转让成交",
      "priority": "P1",
      "status": "pending"
    },
    {
      "id": "FP-ZCCZ1-005",
      "name": "转让归档",
      "priority": "P2",
      "status": "pending"
    }
  ],
  
  "taskProgress": {
    "FP-ZCCZ1-001": {
      "status": "completed",
      "taskGroups": {
        "database": {
          "status": "completed",
          "tasks": {
            "create-table": "completed",
            "insert-dict-data": "completed"
          }
        },
        "backend": {
          "status": "completed",
          "tasks": {
            "generate-entity": "completed",
            "generate-mapper": "completed",
            "generate-service": "completed",
            "generate-controller": "completed"
          }
        },
        "frontend": {
          "status": "completed",
          "tasks": {
            "generate-api": "completed",
            "generate-list-page": "completed",
            "generate-form-page": "completed",
            "generate-detail-page": "completed"
          }
        },
        "menu": {
          "status": "completed",
          "tasks": {
            "config-menu": "completed"
          }
        },
        "test": {
          "status": "completed",
          "tasks": {
            "unit-test": "completed",
            "integration-test": "completed"
          }
        }
      }
    },
    "FP-ZCCZ1-002": {
      "status": "in_progress",
      "taskGroups": {
        "database": {
          "status": "completed",
          "tasks": {
            "create-table": "completed",
            "insert-dict-data": "completed"
          }
        },
        "backend": {
          "status": "in_progress",
          "tasks": {
            "generate-entity": "completed",
            "generate-mapper": "completed",
            "generate-service": "in_progress",
            "generate-controller": "pending"
          }
        },
        "frontend": {
          "status": "pending",
          "tasks": {
            "generate-api": "pending",
            "generate-list-page": "pending",
            "generate-form-page": "pending",
            "generate-detail-page": "pending"
          }
        },
        "menu": {
          "status": "pending",
          "tasks": {
            "config-menu": "pending"
          }
        },
        "test": {
          "status": "pending",
          "tasks": {
            "unit-test": "pending",
            "integration-test": "pending"
          }
        }
      }
    }
  },
  
  "retryHistory": [
    {
      "taskId": "FP-ZCCZ1-002/generate-service",
      "attempt": 1,
      "error": "缺少依赖接口定义",
      "timestamp": "2026-03-31T11:15:00Z",
      "resolved": true,
      "resolution": "补充接口定义后重试成功"
    }
  ],
  
  "checkpoints": [
    {
      "id": "cp-001",
      "timestamp": "2026-03-31T09:30:00Z",
      "phase": "business-analysis",
      "description": "业务分析完成"
    },
    {
      "id": "cp-002",
      "timestamp": "2026-03-31T10:00:00Z",
      "phase": "spec-generation",
      "description": "规格生成完成"
    },
    {
      "id": "cp-003",
      "timestamp": "2026-03-31T10:30:00Z",
      "phase": "feature-loop",
      "featureId": "FP-ZCCZ1-001",
      "description": "功能点FP-ZCCZ1-001完成"
    }
  ],
  
  "context": {
    "specPath": "docs/dev-specs/ZCCZ-1/spec.md",
    "outputPath": "Asset-Management-Platform/asset-equity",
    "templateVariables": {
      "package": "com.sjjk.equity.transfer",
      "moduleName": "equity-transfer",
      "permissionPrefix": "equity:transfer"
    }
  }
}
```

## Guardrails

- 每个任务必须有明确的开始和结束状态
- 任务失败必须记录原因和重试次数
- 检查点保存频率：每完成一个任务组
- 状态文件更新频率：每次任务状态变更
- 重试次数限制：同一任务最多3次
- 依赖检查：执行任务前必须验证依赖是否满足

## 与其他技能协作

| 协作技能 | 协作方式 | 传入数据 | 期望输出 |
|---------|---------|---------|---------|
| **pdd-main** | 被调用 | 功能点矩阵 | 任务清单 |
| **pdd-implement-feature** | 被调用 | 任务清单 | 任务执行结果 |
| **pdd-template-engine** | 调用 | 任务上下文 | 生成的代码 |
| **pdd-code-reviewer** | 调用 | 完成的任务 | 审查结果 |
