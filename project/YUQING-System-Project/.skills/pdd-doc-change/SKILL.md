---
name: pdd-doc-change
description: PDD框架下的文档变更管理Skill，管理开发规格文档修改工作流。当需求变更需要更新规格文档时调用。支持中文触发：文档变更、规格修改、需求变更、变更管理。
license: MIT
compatibility: 需要已有的开发规格文档
metadata:
  author: "neuqik@hotmail.com"
  version: "1.0"
  parent: pdd-main
---

# PDD 文档变更管理 (pdd-doc-change) / Document Change Management

## 核心概念 / Core Concepts

### 🇨🇳 核心概念

本Skill是PRD驱动开发(PDD)框架下的文档变更管理组件,专门用于管理开发规格文档的修改工作流,确保文档变更的系统性、完整性和可追溯性。

### 🇺🇸 Core Concepts

This Skill is a document change management component within the PRD-Driven Development (PDD) framework, specifically designed to manage the modification workflow of development specification documents, ensuring systematic, complete, and traceable document changes.

## 触发时机 / Trigger Conditions

### 🇨🇳 触发时机

**自动触发**: 需求变更需要更新开发规格 | 功能点实现过程中发现规格问题

**手动触发**: 用户输入`/analyze`/`/audit`/`/doc`等命令 | 用户明确要求修改设计文档

### 🇺🇸 Trigger Conditions

**Auto-triggered**: Requirement changes require updating development specs | Specification issues discovered during feature point implementation

**Manual trigger**: User inputs `/analyze`/`/audit`/`/doc` commands | User explicitly requests design document modifications

## 核心能力 / Core Capabilities

### 🇨🇳 核心能力

1. **文档导入与分析**: 解析现有规格文档 | 提取变更关键点 | 建立文档结构索引 | 识别文档间依赖关系

2. **修改计划生成**: 对比分析现有规格 | 生成系统性修改计划(修改范围/内容/优先级P0-P2/实施步骤)

3. **TODO.md生成**: 结构化任务清单(任务ID/修改内容/关联文档/优先级/状态/修改说明)

4. **文档修改执行**: 根据TODO.md对指定规格文档进行修改 | 确保符合技术规范 | 保持文档风格一致性

5. **CHANGELOG.md维护**: 记录详细变更信息(时间/文档/内容摘要/前后对比/关联需求ID)

6. **变更校验与核对**: 比对TODO.md与CHANGELOG.md | 验证所有计划修改已实施并记录 | 检查文档间一致性

7. **结果报告生成**: 总体完成情况 | 已完成/未完成项 | 一致性校验结果 | 后续建议

### 🇺🇸 Core Capabilities

1. **Document Import & Analysis**: Parse existing specification documents | Extract key change points | Build document structure index | Identify inter-document dependencies

2. **Modification Plan Generation**: Comparative analysis of existing specs | Generate systematic modification plan (scope/content/priority P0-P2/implementation steps)

3. **TODO.md Generation**: Structured task list (task ID/modification content/associated document/priority/status/modification notes)

4. **Document Modification Execution**: Modify specified spec documents per TODO.md | Ensure compliance with technical standards | Maintain consistent document style

5. **CHANGELOG.md Maintenance**: Record detailed change information (time/document/content summary/before-after comparison/associated requirement ID)

6. **Change Verification & Validation**: Compare TODO.md with CHANGELOG.md | Verify all planned modifications implemented and documented | Check inter-document consistency

7. **Result Report Generation**: Overall completion status | Completed/incomplete items | Consistency verification results | Follow-up recommendations

## 工作流程 / Workflow

### 🇨🇳 工作流程

接收修改需求 → 分析变更文档/需求 → 对比现有规格文档 → 生成修改计划 → 创建TODO.md → 执行文档修改 → 更新CHANGELOG.md → 变更校验 → [全部完成?] → 是:生成结果报告 | 否:继续执行修改

### 🇺🇸 Workflow

Receive modification request → Analyze change documents/requirements → Compare with existing spec documents → Generate modification plan → Create TODO.md → Execute document modifications → Update CHANGELOG.md → Change verification → [All complete?] → Yes:Generate result report | No:Continue modifications

## 与PDD流程集成 / PDD Process Integration

### 🇨🇳 与PDD流程集成

需求变更发生 → pdd-doc-change分析变更影响 → 确定需要修改的规格文档 → 生成修改计划和TODO → 执行文档修改 → 更新CHANGELOG → 校验变更完整性 → 通知相关功能点重新验证

### 🇺🇸 PDD Process Integration

Requirement change occurs → pdd-doc-change analyzes change impact → Determine spec documents to modify → Generate modification plan and TODO → Execute document modifications → Update CHANGELOG → Verify change completeness → Notify related feature points for re-validation

## 使用场景 / Use Cases

### 🇨🇳 使用场景

1. **需求变更管理**: 业务需求变化时系统性更新相关规格文档
2. **版本迭代更新**: 产品版本迭代时的规格文档同步更新
3. **问题修复记录**: 基于用户反馈修复文档中的错误或遗漏
4. **合规性调整**: 根据新法规或内部制度调整规格内容
5. **流程优化**: 业务流程优化后的规格文档更新

### 🇺🇸 Use Cases

1. **Requirement Change Management**: Systematically update related specification documents when business requirements change
2. **Version Iteration Updates**: Synchronize specification document updates during product version iterations
3. **Issue Fix Records**: Fix errors or omissions in documents based on user feedback
4. **Compliance Adjustments**: Adjust specification content according to new regulations or internal policies
5. **Process Optimization**: Update specification documents after business process optimization

## 操作规范 / Operational Standards

### 🇨🇳 操作规范

#### 文档命名规范
TODO.md: `dev-specs/`目录下 | CHANGELOG.md: `dev-specs/`目录下 | 修改计划:`变更计划.md` | 结果报告:`变更完成报告.md`

#### 任务优先级定义

| 优先级 | 定义 | 处理方式 |
|--------|------|----------|
| P0 | 紧急且重要(影响核心业务流程或合规性) | 立即执行 |
| P1 | 重要不紧急(重要的功能改进) | 短期内完成 |
| P2 | 可优化(体验优化或补充说明) | 可延后处理 |

#### 变更日志格式
```markdown
### [版本号] - YYYY-MM-DD
#### 新增 | #### 修改 | #### 删除 | #### 修复
```

### 🇺🇸 Operational Standards

#### Document Naming Conventions
TODO.md: Under `dev-specs/` directory | CHANGELOG.md: Under `dev-specs/` directory | Modification Plan:`变更计划.md` | Result Report:`变更完成报告.md`

#### Task Priority Definition

| Priority | Definition | Handling |
|----------|------------|----------|
| P0 | Urgent & Critical (affects core business processes or compliance) | Execute immediately |
| P1 | Important but Not Urgent (important feature improvements) | Complete within short term |
| P2 | Can Optimize (experience optimization or supplementary notes) | Can be deferred |

#### Change Log Format
```markdown
### [Version] - YYYY-MM-DD
#### Added | #### Modified | #### Deleted | #### Fixed
```

## 输出模板 / Output Templates

### 🇨🇳 输出模板

#### TODO.md模板
```markdown
# 规格文档修改任务清单
## 修改背景 | ## 关联功能点(FP-XXX)
## 任务列表: ### [任务ID]-[任务名称](优先级/关联文档/修改内容/状态/备注)
```

#### 变更完成报告模板
```markdown
# 规格文档变更完成报告
## 基本信息(变更主题/日期/负责人/关联需求)
## 完成情况(总任务数/已完成/完成率)
## 已完成修改项 | ## 文档一致性校验
## 影响的功能点(FP-ID/名称/影响程度/需要重新验证)
## 后续建议
```

### 🇺🇸 Output Templates

#### TODO.md Template
```markdown
# Specification Document Modification Task List
## Modification Background | ## Associated Feature Points (FP-XXX)
## Task List: ### [Task ID]-[Task Name](Priority/Associated Document/Modification Content/Status/Notes)
```

#### Change Completion Report Template
```markdown
# Specification Document Change Completion Report
## Basic Information (Change Topic/Date/Owner/Associated Requirement)
## Completion Status (Total Tasks/Completed/Completion Rate)
## Completed Modifications | ## Document Consistency Verification
## Affected Feature Points (FP-ID/Name/Impact Level/Re-validation Required)
## Follow-up Recommendations
```

## 最佳实践 / Best Practices

### 🇨🇳 最佳实践

1. **修改前备份**: 执行修改前创建文档备份
2. **小步快跑**: 将大修改分解为多个小任务,逐个完成
3. **及时记录**: 每完成一个修改立即更新CHANGELOG
4. **交叉验证**: 修改完成后进行文档间的一致性检查
5. **相关方确认**: 重要修改需经相关方确认后再提交

### 🇺🇸 Best Practices

1. **Backup Before Modification**: Create document backup before executing modifications
2. **Small Steps Fast**: Break down large modifications into smaller tasks, complete one by one
3. **Timely Recording**: Update CHANGELOG immediately after each modification is completed
4. **Cross-validation**: Perform inter-document consistency checks after modifications are complete
5. **Stakeholder Confirmation**: Important modifications require stakeholder confirmation before submission

## 注意事项 / Notes

### 🇨🇳 注意事项

保持文档风格一致 | 避免过度修改(只改必要内容) | 术语一致性 | 链接有效性 | 版本兼容性考虑

### 🇺🇸 Notes

Maintain consistent document style | Avoid over-modification (only modify necessary content) | Terminology consistency | Link validity | Version compatibility considerations

## Guardrails / Guardrails

### 🇨🇳 Guardrails

- 修改规格文档必须同步更新CHANGELOG
- 修改后必须通知相关功能点进行重新验证
- 必须保持文档间的一致性
- 必须记录变更影响范围

### 🇺🇸 Guardrails

- Modifying specification documents requires synchronous CHANGELOG update
- After modification, must notify related feature points for re-validation
- Must maintain inter-document consistency
- Must record change impact scope

---

## Iron Law / 铁律

### 🇨🇳 Iron Law (中文)

1. **变更必须有据**: 每次文档修改都必须关联到明确的需求变更ID或沟通记录,不得基于模糊的"感觉需要改"而修改规格。

2. **影响分析前置**: 执行任何修改前必须先完成影响分析(哪些功能点、哪些文档会受影响),不得直接修改后再看影响范围。

3. **变更可追溯**: 所有修改操作必须记录到CHANGELOG.md中,包含修改前后对比、修改原因、关联的需求变更ID。

4. **一致性强制校验**: 修改完成后必须执行文档间一致性检查(接口定义、数据模型、业务规则在不同文档间是否一致),不一致的变更不得标记为完成。

5. **通知下游不可省略**: 规格文档变更后必须通知相关功能点进行重新验证,不得静默更新规格而期望下游自动感知。

**违规示例**: ❌ 直接修改spec.md而不记录到CHANGELOG | ❌ 修改接口字段后未检查前端API调用是否同步更新 | ❌ 变更影响范围未评估就执行了修改 | ❌ 修改了规格但未通知相关的功能点重新验证 | ❌ CHANGELOG中只写"修改了接口"而没有具体说明改了什么

**合规示例**: ✅ 每个修改任务都关联需求变更REQ-CHANGE-20260322-001 | ✅ 修改前生成影响分析报告:涉及FP-001和FP-002 | ✅ CHANGELOG详细记录:"v1.1-2026-03-22:新增evaluationMethod字段(String),源自需求变更REQ-xxx" | ✅ 修改后自动检查spec.md与checklist.md的一致性 | ✅ 变更完成后输出通知清单:需要FP-001和FP-002重新执行验证

### 🇺🇸 Iron Law (English)

1. **Changes Must Be Grounded**: Every document modification must be linked to a clear requirement change ID or communication record; never modify specifications based on vague "feeling it needs change."

2. **Impact Analysis First**: Before executing any modification, complete impact analysis first (which feature points, which documents will be affected); never modify first and check impact scope later.

3. **Changes Must Be Traceable**: All modification operations must be recorded in CHANGELOG.md, including before/after comparison, modification reason, and associated requirement change ID.

4. **Mandatory Consistency Verification**: After modifications are complete, must execute inter-document consistency checks (whether interface definitions, data models, and business rules are consistent across documents); inconsistent changes cannot be marked as complete.

5. **Downstream Notification Cannot Be Omitted**: After specification document changes, must notify related feature points for re-validation; never silently update specifications expecting downstream to automatically detect changes.

**Violation Examples**: ❌ Directly modifying spec.md without recording in CHANGELOG | ❌ Modified interface fields without checking if frontend API calls were synchronized | ❌ Executed modifications without evaluating change impact scope | ❌ Modified specifications but did not notify related feature points for re-validation | ❌ CHANGELOG only says "modified interface" without specifying what was changed

**Compliance Examples**: ✅ Every modification task is linked to requirement change REQ-CHANGE-20260322-001 | ✅ Generated impact analysis report before modification: involves FP-001 and FP-002 | ✅ CHANGELOG detailed record: "v1.1-2026-03-22: Added evaluationMethod field (String), sourced from requirement change REQ-xxx" | ✅ Automatically checked consistency between spec.md and checklist.md after modification | ✅ Output notification list after change completion: FP-001 and FP-002 need to re-execute verification

---

## Rationalization Table / 理性化对照表

### 🇨🇳 Rationalization Table (中文)

| 你可能的想法 | 请问自己 | 应该怎么做 |
|-------------|---------|-----------|
| "这个改动很小,不用走正式流程吧" | 小改动也可能引发连锁反应,且缺乏追踪会导致后续排查困难 | 所有规格文档变更都必须走完整流程:分析→计划→TODO→执行→记录→校验 |
| "CHANGELOG后面再补" | 延迟记录会导致遗漏或记忆偏差,失去追溯价值 | 边修改边记录,每完成一个TODO项就更新一次CHANGELOG |
| "这个文档改了,那个应该差不多吧" | 文档间的不一致是PDD流程中最常见的缺陷来源 | 修改后强制执行交叉引用检查,确保所有相关文档同步更新 |
| "通知验证太麻烦了,他们应该能看到" | 下游技能不会主动监控上游文档变化,必须显式通知 | 变更完成后生成通知清单,明确列出需要重新验证的功能点 |
| "原来的内容反正不对,直接覆盖吧" | 覆盖式修改会丢失历史信息,无法回溯和审计 | 保留修改历史,在CHANGELOG中记录修改前后的关键差异 |

**常见陷阱**:
1. **"随意变更"陷阱**: 缺乏正式变更请求就直接修改规格 → 强制要求变更必须有明确的变更源(需求变更单/沟通记录/问题报告)
2. **"孤岛修改"陷阱**: 只修改了一个文档而未同步更新关联文档 → 建立"文档依赖图",修改时自动识别所有受影响的文档
3. **"记录缺失"陷阱**: 执行了修改但没有完整的变更记录 → 将CHANGELOG更新作为TODO完成的必要条件
4. **"静默变更"陷阱**: 更新了规格但未通知下游重新验证 → 变更完成报告必须包含"下游通知清单"作为必填项

### 🇺🇸 Rationalization Table (English)

| # | Trap / 陷阱 | Question / 请问自己 | Action / 应该怎么做 |
|---|-------------|-------------------|-------------------|
| 1 | "This change is small, no need for formal process" / "这个改动很小,不用走正式流程吧" | Small changes can also trigger chain reactions, and lack of tracking makes future troubleshooting difficult | All specification document changes must follow the complete process: Analyze → Plan → TODO → Execute → Record → Verify |
| 2 | "I'll update CHANGELOG later" / "CHANGELOG后面再补" | Delayed recording leads to omissions or memory bias, losing traceability value | Record while modifying; update CHANGELOG after each TODO item is completed |
| 3 | "This doc changed, that one should be fine" / "这个文档改了,那个应该差不多吧" | Inter-document inconsistency is the most common defect source in PDD process | Enforce cross-reference checks after modification to ensure all related documents are synchronized |
| 4 | "Notification is too troublesome, they should see it" / "通知验证太麻烦了,他们应该能看到" | Downstream skills don't proactively monitor upstream document changes; explicit notification is required | Generate notification list after change completion, clearly listing feature points needing re-validation |
| 5 | "The original content was wrong anyway, just overwrite" / "原来的内容反正不对,直接覆盖吧" | Overwrite modifications lose historical information, making rollback and auditing impossible | Preserve modification history and record key differences before/after in CHANGELOG |

**Common Traps**:
1. **"Arbitrary Change" Trap / "随意变更"陷阱**: Modifying specifications without formal change request → Require changes to have clear change source (change request form/communication record/issue report)
2. **"Isolated Modification" Trap / "孤岛修改"陷阱**: Only modified one document without synchronizing related documents → Build "document dependency map" to automatically identify all affected documents during modification
3. **"Missing Records" Trap / "记录缺失"陷阱**: Executed modifications without complete change records → Make CHANGELOG update a mandatory condition for TODO completion
4. **"Silent Change" Trap / "静默变更"陷阱**: Updated specifications without notifying downstream for re-validation → Change completion report must include "downstream notification list" as a required field

---

## Red Flags / 红旗警告

### 🇨🇳 Red Flags (中文)

#### Layer 1: 输入检查
- **INPUT-DC-001**: 变更需求描述为空或过于模糊(如"优化一下接口") → 🔴 CRITICAL → 终止并要求提供具体的变更描述
- **INPUT-DC-002**: 目标规格文档不存在或路径不正确 → 🔴 CRITICAL → 终止并提示检查文档路径
- **INPUT-DC-003**: 缺少变更依据(无需求变更ID、无问题报告编号) → 🟡 WARN → 记录为"临时变更"并在报告中标注缺少正式变更依据

#### Layer 2: 执行检查
- **EXEC-DC-001**: 未完成影响分析就开始执行修改 → 🔴 CRITICAL → 暂停执行,先完成影响范围评估
- **EXEC-DC-002**: 修改了文档但未同步更新CHANGELOG → 🟡 WARN → 立即补充变更记录
- **EXEC-DC-003**: 发现文档间不一致(spec.md改了字段但checklist.md未更新) → 🔴 CRITICAL → 暂停修改,先制定完整的同步修改计划
- **EXEC-DC-004**: TODO列表中有未完成任务但标记变更为完成 → 🔴 CRITICAL → 修正状态为进行中或部分完成

#### Layer 3: 输出检查
- **OUTPUT-DC-001**: 变更完成报告缺少影响的功能点列表 → 🔴 CRITICAL → 补充受影响的功能点及建议的处理方式
- **OUTPUT-DC-002**: CHANGELOG与实际修改内容不一致 → 🔴 CRITICAL → 核对并修正CHANGELOG
- **OUTPUT-DC-003**: 缺少文档一致性校验结果 → 🟡 WARN → 补充一致性检查结果或说明未检查的原因

#### 触发Red Flag时的处理流程
🔴 CRITICAL → 立即停止,报告问题详情,等待指示 | 🟡 WARN → 记录警告到变更日志,尝试自动修复,在最终报告中标注 | 🔵 INFO → 记录信息,正常继续

### 🇺🇸 Red Flags (English)

#### Layer 1: Input Validation Guards / 输入检查防护
- **INPUT-DC-001**: Change requirement description is empty or too vague (e.g., "optimize the interface") → 🔴 CRITICAL → Terminate and request specific change description / 终止并要求提供具体的变更描述
- **INPUT-DC-002**: Target specification document does not exist or path is incorrect → 🔴 CRITICAL → Terminate and prompt to check document path / 终止并提示检查文档路径
- **INPUT-DC-003**: Missing change basis (no requirement change ID, no issue report number) → 🟡 WARN → Record as "temporary change" and note in report that formal change basis is missing / 记录为"临时变更"并在报告中标注缺少正式变更依据

#### Layer 2: Execution Validation Guards / 执行检查防护
- **EXEC-DC-001**: Started modifications without completing impact analysis → 🔴 CRITICAL → Pause execution, complete impact scope assessment first / 暂停执行,先完成影响范围评估
- **EXEC-DC-002**: Modified document but did not synchronously update CHANGELOG → 🟡 WARN → Immediately supplement change records / 立即补充变更记录
- **EXEC-DC-003**: Discovered inter-document inconsistency (spec.md field changed but checklist.md not updated) → 🔴 CRITICAL → Pause modification, formulate complete synchronization plan first / 暂停修改,先制定完整的同步修改计划
- **EXEC-DC-004**: TODO list has incomplete tasks but marked as complete → 🔴 CRITICAL → Correct status to in-progress or partially complete / 修正状态为进行中或部分完成

#### Layer 3: Output Validation Guards / 输出检查防护
- **OUTPUT-DC-001**: Change completion report missing list of affected feature points → 🔴 CRITICAL → Supplement affected feature points and recommended handling methods / 补充受影响的功能点及建议的处理方式
- **OUTPUT-DC-002**: CHANGELOG inconsistent with actual modification content → 🔴 CRITICAL → Verify and correct CHANGELOG / 核对并修正CHANGELOG
- **OUTPUT-DC-003**: Missing document consistency verification results → 🟡 WARN → Supplement consistency check results or explain why checks were not performed / 补充一致性检查结果或说明未检查的原因

#### Red Flag Trigger Handling / 触发Red Flag时的处理流程
🔴 CRITICAL → Stop immediately, report problem details, await instructions / 立即停止,报告问题详情,等待指示 | 🟡 WARN → Record warning in change log, attempt auto-fix, annotate in final report / 记录警告到变更日志,尝试自动修复,在最终报告中标注 | 🔵 INFO → Record information, continue normally / 记录信息,正常继续
