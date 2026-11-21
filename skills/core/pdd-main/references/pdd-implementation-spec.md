# PDD实现规范摘要与断点续传

> 本文件为 pdd-main 的参考资料，按需加载。完整规范见 [pdd-framework-design.md 第9章](../../../docs/pdd-framework-design.md#9-pdd-implementation-specification)。

## 核心规范摘要

| 规范 | 核心内容 |
|-----|---------|
| **技能边界** | pdd-code-reviewer(合规性) → expert-code-quality(质量深度)，先审查后分析 |
| **上下文传递** | 文件系统传递，目录结构规范，支持断点续传 |
| **人工审核** | 批量审核+关键功能详细审核 |
| **错误处理** | Critical阻断，重试3次后暂停等待人工 |
| **PR管理** | 手动触发，变更粒度PR，手动归档 |
| **文档系统** | 9种核心文档类型，命名规范，文档内部变更历史 |

## 审查与质量分析协作流程

代码实现完成 → pdd-code-reviewer(合规性审查) → [有Critical问题]返回修复重新审查 → [无问题]expert-code-quality(质量深度分析) → 生成质量改进任务(improvement-tasks.md) → 进入下一阶段

## 断点续传

- **状态文件**: `.pdd-state.json`
- **触发方式**: 用户发出"继续执行"命令
- **状态内容**: 当前阶段/已完成功能/待处理功能