# 子技能清单（Sub-Skill List）

> 本文件为 pdd-main 的参考资料，按需加载。核心链：pdd-ba→pdd-extract-features→pdd-generate-spec→pdd-implement-feature→pdd-code-reviewer→pdd-verify-feature。

| 技能名称 | 描述 | 输入 | 输出 | 触发时机 |
|---------|------|------|------|---------|
| **pdd-ba** | 业务分析，使用专业方法论进行需求推导 | PRD文档路径 | 业务分析报告 | 流程开始时 |
| **pdd-extract-features** | 从PRD中提取功能点矩阵 | PRD文档路径 | feature-matrix.md | 业务分析完成后 |
| **pdd-generate-spec** | 生成开发规格 | 功能点矩阵 | spec.md, checklist.md | 功能确认后 |
| **pdd-implement-feature** | 实现功能代码 | 开发规格 | 代码文件 | 规格确认后 |
| **pdd-code-reviewer** | 代码审查，验证实现符合规格 | 代码+规格 | 审查报告 | 代码实现后 |
| **pdd-verify-feature** | 验证功能实现 | 代码+验收标准 | 验收报告 | 代码审查后 |
| **pdd-doc-change** | 文档变更管理 | 变更需求 | 更新后的文档 | 需求变更时 |
| **system-architect** | 系统架构咨询 | 架构需求 | 架构方案 | 按需触发 |
| **software-architect** | 软件架构咨询 | 模块需求 | 模块设计 | 按需触发 |
| **software-engineer** | 代码实现和测试 | 规格文档 | 代码文件 | 实现阶段 |
| **expert-ruoyi** | RuoYi框架专家咨询 | 技术问题 | 解决方案 | 按需触发 |
| **expert-activiti** | Activiti工作流专家 | 流程问题 | 解决方案 | 按需触发 |
| **expert-mysql** | MySQL数据库专家 | SQL/结构问题 | 优化建议 | 按需触发 |
| **expert-code-quality** | 代码质量专家 | 代码片段 | 重构计划 | 按需触发 |
| **expert-bug-fixer** | Bug修复/维护模式 | Bug描述 | 修复代码+发布单 | 维护模式 |
| **expert-springcloud** | 微服务专家 | 技术问题 | 解决方案 | 按需触发 |
| **expert-vue3** | Vue3前端专家 | 技术问题 | 解决方案 | 按需触发 |