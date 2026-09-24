---
name: pdd-code-reviewer
description: PDD框架下的代码审查Skill，验证功能点实现是否符合开发规格和验收标准。触发：代码审查、代码review、PDD审查、质量检查、code review。
license: MIT
compatibility: 需要先完成代码实现
metadata:
  author: "neuqik@hotmail.com"
  version: "2.1"
  parent: pdd-main
---

# 代码审查 - 验证功能点实现是否符合开发规格

**输入**: 代码文件 | 开发规格(spec.md) | 验收标准(checklist.md)
**输出**: 审查报告(`docs/reviews/review-{timestamp}.md`) | 问题列表(issues)

## 技能整合（按需调用）
- **架构师**：software-architect（架构偏离/接口设计）、system-architect（系统架构）
- **专家**：expert-code-quality（代码异味/重构）、expert-ruoyi（若依）、expert-mysql（SQL）
- **必须基础审查**：所有代码对照规格验证实现完整性；架构/质量问题按需唤起专家。

## 审查维度
- **设计一致性**：实现与规格/接口路径/请求响应结构/业务逻辑一致
- **代码质量**：可读性/命名/错误处理/注释
- **安全性**：参数校验/SQL注入/XSS/权限校验
- **性能**：数据库查询/循环优化/缓存
- **业务逻辑**：状态转换/规则执行/异常处理
- **Bug模式库匹配**（`config/bug-patterns.yaml`）：PATTERN-001 datetime非str | 002 /options在/{id}前 | 003 枚举编码 | 004 safeAlert | 005 my-tasks条件 | 007 编号生成查重 | R001 @PreAuthorize | R002 sys_menu | R003 @DataScope | R005 @Validated | R006 @Xss | R008 API路径一致 | R009 上传参数类型 | R010 审批日志 | R011 状态字典同步 | R012 @Param
- **UX一致性**：表单组件与PRD映射一致、下拉走Options API、列表布局一致、按钮用v-hasPermi、错误用safeAlert、遵循global-reset.css

## 问题分级
- 🔴 **CRITICAL**：严重偏离规格/核心流程错误/严重安全漏洞/数据不一致
- 🟡 **WARNING**：可读性/错误处理不完善/潜在性能/编码规范
- 🔵 **SUGGESTION**：优化建议/重构/最佳实践

## 流程步骤
1. 收集代码文件（后端/前端/SQL）
2. 读取 `dev-specs/FP-{序号}/spec.md`
3. **基础审查**：a.接口 b.业务逻辑 c.数据模型 d.Bug模式库匹配 e.UX一致性
4. 代码质量审查（按需，委托 expert-code-quality）
5. 架构偏离检查（按需，委托 software-architect）
6. 生成审查报告到 `docs/reviews/review-{timestamp}.md`（含基本信息/分级问题/Bug模式匹配结果/UX结果/结论）
7. 输出问题列表 `{"critical":[...],"warning":[...],"suggestion":[...]}`

## 与 expert-code-quality 协作
- **职责边界**：pdd-code-reviewer=流程合规性审查（Critical阻塞）；expert-code-quality=代码质量深度分析（不阻塞）
- **协作流程**：实现完成→合规审查→[有Critical]返回修复 | [无Critical]→quality深度分析→improvement-tasks.md(不阻塞)→pdd-verify-feature
- **问题处理**：Critical阻塞；Warning/Suggestion不阻塞记录；quality任何级别不阻塞记录改进清单

## Guardrails
- 对照规格逐项审查；问题准确引用代码；CRITICAL 修复后才能通过；报告完整记录所有问题
- 架构问题必须咨询架构师；代码质量问题必须咨询 expert-code-quality

## Iron Law 铁律
1. **规格对照优先**：验证实现是否符合规格，Critical 必须基于规格明确要求。
2. **职责边界清晰**：合规性归 code-reviewer，深度质量分析委托 expert-code-quality。
3. **问题可操作**：每个问题含文件位置/描述/修复建议。
4. **架构问题必升级**：模块边界/接口偏离必须调用架构师。
5. **Critical 阻塞原则**：Critical 修复后才能通过，不得降级。
- 违规：❌个人偏好提Critical ❌越界分析代码异味 ❌"Service层有问题"不具体 ❌不调架构师自行判断 ❌SQL注入标Suggestion
- 合规：✅Critical引用spec章节 ✅异味转交expert-code-quality ✅"TransferApplyServiceImpl.java:142 缺底价校验，参考BR-001" ✅调software-architect ✅SQL注入标Critical并阻止

## Rationalization 陷阱
- "主观审查"：以偏好代替标准→问题须引用规格/规范/安全标准
- "角色越位"：合规审查中过度深入质量→明确边界
- "模糊反馈"：问题笼统→五要素（位置/现象/预期/实际/建议）
- "架构擅断"：自行判断架构→触线即调架构师

## Red Flags 红旗
- **L1 输入**：INPUT-CR-001 代码为空→🔴；002 spec缺失→🔴；003 ID不匹配→🟡
- **L2 执行**：EXEC-CR-001 Critical不可追溯→🔴；002 质量未转交→🟡；003 架构问题未调架构师→🔴；004 安全漏洞非Critical→🔴；005 触犯Bug模式未标记→🔴；006 UX问题未记录→🟡
- **L3 输出**：OUTPUT-CR-001 缺分级汇总→🔴；002 通过却有Critical→🔴；003 问题不可定位→🟡；004 缺Bug模式匹配→🔴；005 缺UX结果→🟡
- 处理：🔴立即停止上报 | 🟡记录警告尝试修复 | 🔵记录正常继续