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
任务层级: 模块级(Module) → 功能点级(Feature) → 任务组级(TaskGroup) → 原子任务级(Task)
示例: ZCCZ-1 → FP-ZCCZ1-001 → database/backend/frontend 任务组 → 具体任务(create-table、generate-entity 等)

### 2. 任务状态跟踪
状态: `pending`(待执行) | `in_progress`(执行中) | `completed`(已完成) | `failed`(失败) | `skipped`(已跳过) | `blocked`(被阻塞)
转换规则: pending→in_progress(开始) | in_progress→completed(成功) | in_progress→failed(失败) | in_progress→blocked(被阻塞) | failed→in_progress(重试) | pending→skipped(跳过)

### 3. 断点续传机制
- **状态文件路径**: 单模块 `.pdd/state.json` | 多模块 `.pdd/state-{moduleId}.json`（如 state-ZCCZ-1.json）
- **目录结构**: `.pdd/` 下每个模块独立状态文件 + `archive/` 归档已完成模块
- **并发安全**: 每模块独立状态文件避免冲突 | 文件锁防并发写入 | 状态文件版本控制
- **内容结构**: version | moduleId | currentPhase/currentFeature/currentTaskGroup/currentTask | progress | taskProgress | retryHistory | checkpoints | context

完整 JSON 示例见 `references/state-file-format.md`。

### 4. 任务依赖管理
依赖类型: `sequential`(顺序) | `parallel`(并行) | `conditional`(条件)
依赖规则: database→backend→frontend | generate-entity→generate-mapper→generate-service→generate-controller

## 执行流程

1. **创建模块级任务清单**: 解析功能点矩阵 → 生成功能点列表 → 初始化状态文件
2. **为每个功能点生成任务清单**: 数据库/后端/前端/菜单配置/测试任务组
3. **执行任务并更新状态**: 标记任务开始 → 执行 → 记录结果 → 更新进度
4. **检查点保存**: 每完成一个任务组保存检查点，记录关键状态变更
5. **异常处理与恢复**: 记录失败原因 → 保存恢复上下文 → 等待用户指令

## 任务清单模板

完整功能点任务清单模板（tasks.md）见 `references/tasks-template.md`。包含：功能点信息、任务概览、详细任务列表（数据库/后端/前端/菜单/测试）、执行历史、重试记录、恢复点。

## 中断续传流程

1. **读取状态文件**: 读取 `.pdd/state-{moduleId}.json` → 解析当前进度 → 识别当前任务
2. **验证恢复条件**: 检查依赖是否满足 | 检查文件是否完整 | 检查环境是否就绪
3. **恢复执行上下文**: 加载 spec.md | 加载已完成的代码 | 准备模板变量
4. **继续执行当前任务**: 从断点处继续 → 执行剩余步骤 → 更新任务状态
5. **继续后续任务**: 按依赖顺序执行 → 定期保存检查点

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