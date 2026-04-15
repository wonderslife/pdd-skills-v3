---
name: pdd-ba
description: "PDD framework business analysis Skill for requirement elicitation and modeling. Invoke when users input /analyze, /audit, /doc commands, or need business process analysis, requirement modeling, PRD review, or 5W1H analysis. 支持中文触发：业务分析、需求分析、需求建模、5W1H分析、MECE。"
license: MIT
compatibility: 需要PRD文档或业务需求描述
metadata:
  author: "neuqik@hotmail.com"
  version: "2.0"
  parent: pdd-main
  triggers:
    - "/analyze" | "/audit" | "/doc"
    - "分析业务流程" | "需求建模" | "PRD审核"
    - "业务分析" | "5W1H" | "MECE"
---

# PDD-Business Analysis / 业务分析技能

## Core Concept / 核心概念

### 🇨🇳
运用专业方法论进行需求分析和业务建模,输出结构化的业务分析结果,为后续功能点提取和开发规格生成提供基础。

**输入**: PRD文档/业务需求描述/流程说明 | **输出**: 业务分析报告/用例图/流程图/状态图/CRUD矩阵 | **不负责**: 代码实现/测试编写/架构设计

### 🇺🇸
Applies professional methodology for requirement analysis and business modeling, outputting structured business analysis results as the foundation for subsequent feature extraction and development spec generation.

**Input**: PRD documents / Business requirement descriptions / Process specifications | **Output**: Business analysis report / Use case diagrams / Flowcharts / State diagrams / CRUD matrix | **NOT responsible for**: Code implementation / Test writing / Architecture design

## 方法论工具箱 / Methodology Toolbox

### 🇨🇳
### 5W1H 分析法

| 维度 | 问题 | 分析要点 |
|------|------|---------|
| **Why** | 为什么做？ | 业务背景、目标、价值 |
| **What** | 做什么？ | 功能范围、业务内容 |
| **Who** | 谁来做？ | 角色划分、职责边界 |
| **When** | 何时做？ | 时间要求、里程碑 |
| **Where** | 在哪做？ | 使用场景、环境 |
| **How** | 怎么做？ | 实现方式、流程 |

### MECE 原则

确保业务分析无遗漏、无重叠: 相互独立(各分析项不交叉重叠) | 完全穷尽(覆盖所有业务场景)

**检验清单**: 子类别是否相互独立? | 所有类别是否覆盖完整? | 是否有遗漏的业务场景? | 是否有重叠的功能定义?

### CRUD 矩阵

分析实体与操作的对应关系(实体 × Create/Read/Update/Delete + 列表/导出)

### 🇺🇸
### 5W1H Analysis Method

| Dimension | Question | Analysis Points |
|-----------|----------|----------------|
| **Why** | Why do it? | Business background, goals, value |
| **What** | What to do? | Feature scope, business content |
| **Who** | Who does it? | Role division, responsibility boundaries |
| **When** | When to do? | Time requirements, milestones |
| **Where** | Where to do? | Usage scenarios, environment |
| **How** | How to do? | Implementation approach, process |

### MECE Principle

Ensure business analysis is complete and non-overlapping: Mutually Exclusive (analysis items don't overlap) | Collectively Exhaustive (covers all business scenarios)

**Checklist**: Are sub-categories mutually exclusive? | Are all categories fully covered? | Any missing business scenarios? | Any overlapping feature definitions?

### CRUD Matrix

Analyze entity-operation mapping (entity × Create/Read/Update/Delete + List/Export)

## 分析流程 / Analysis Flow

### 🇨🇳
### Step 1: 需求收集
PRD文档原文 | 业务流程描述 | 业务规则文档 | 现有系统截图/文档 | 竞品分析资料 → 输出:原始需求清单

### Step 2: 5W1H 分析

对每个需求进行六维分析:
- **Why**: 业务背景/核心价值/成功标准
- **What**: 功能描述/范围边界/不做事项
- **Who**: 发起角色/参与角色/审批角色/受益角色
- **When**: 开始时间/结束时间/周期特性(实时/周期/事件)
- **Where**: 使用场景/使用环境/接入方式
- **How**: 实现方式/关键流程/技术约束

### Step 3: 业务建模

**a. 用例图(Use Case Diagram)**: 参与者+用例+关系

**用例模板**:
```markdown
### UC-[编号]: [用例名称]
**参与者**: [主要参与者]
**前置条件**: [进入系统前的状态]
**基本流程**: 1.[步骤1] → 2.[步骤2] → 3.[步骤3]
**扩展流程**: [条件A]:[扩展1] | [条件B]:[扩展2]
**异常流程**: [异常1]:[处理方式]
```

**b. 流程图(Process Flow)**: 开始→判断条件→分支处理→循环→结束

**c. 状态图(State Diagram)**:

**状态定义模板**:
```markdown
### 实体状态机
**实体**: [实体名称]
| 状态 | 代码 | 含义 | 可转入 |
|------|------|------|--------|
| 草稿 | DRAFT | 初始状态 | SUBMITTED |
| 已提交 | SUBMITTED | 已提交待审核 | APPROVED,REJECTED |
| 已审批 | APPROVED | 审批通过 | ARCHIVED |
| 已拒绝 | REJECTED | 审批拒绝 | DRAFT |
```

### Step 4: CRUD 矩阵生成
实体 × 创建/读取/更新/删除/列表/导出 的完整操作矩阵

### Step 5: 业务规则提取

| 规则ID | 规则描述 | 约束类型 | 优先级 |
|--------|---------|---------|--------|
| BR-001 | [规则描述] | 硬性/软性规则 | P0/P1/P2 |

### 🇺🇸
### Step 1: Requirement Gathering
PRD document text | Business process descriptions | Business rule documents | Existing system screenshots/docs | Competitive analysis materials → Output: Raw requirement list

### Step 2: 5W1H Analysis

Six-dimensional analysis for each requirement:
- **Why**: Business background / Core value / Success criteria
- **What**: Feature description / Scope boundaries / Out of scope items
- **Who**: Initiating role / Participating roles / Approval roles / Beneficiary roles
- **When**: Start time / End time / Periodicity (real-time/cyclical/event)
- **Where**: Usage scenarios / Usage environment / Access method
- **How**: Implementation approach / Key processes / Technical constraints

### Step 3: Business Modeling

**a. Use Case Diagram**: Actors + Use cases + Relationships

**Use Case Template**:
```markdown
### UC-[ID]: [Use Case Name]
**Actors**: [Primary actor]
**Preconditions**: [State before entering system]
**Basic Flow**: 1.[Step 1] → 2.[Step 2] → 3.[Step 3]
**Alternative Flows**: [Condition A]:[Alt 1] | [Condition B]:[Alt 2]
**Exception Flows**: [Exception 1]:[Handling]
```

**b. Process Flow**: Start → Decision → Branch processing → Loop → End

**c. State Diagram**:

**State Definition Template**:
```markdown
### Entity State Machine
**Entity**: [Entity Name]
| State | Code | Meaning | Transitions To |
|-------|------|---------|---------------|
| Draft | DRAFT | Initial state | SUBMITTED |
| Submitted | SUBMITTED | Pending review | APPROVED, REJECTED |
| Approved | APPROVED | Review passed | ARCHIVED |
| Rejected | REJECTED | Review rejected | DRAFT |
```

### Step 4: CRUD Matrix Generation
Complete operation matrix: Entity × Create/Read/Update/Delete/List/Export

### Step 5: Business Rule Extraction

| Rule ID | Rule Description | Constraint Type | Priority |
|---------|-----------------|-----------------|----------|
| BR-001 | [Rule description] | Hard/Soft rule | P0/P1/P2 |

## 输出规范 / Output Specification

### 🇨🇳
### 业务分析报告结构
1. **概述**: 文档信息(模块编号/名称/日期/版本) | 业务背景 | 目标与价值
2. **5W1H分析**: 详见Step 2
3. **用例分析**: 详见Step 3.a
4. **流程分析**: 详见Step 3.b
5. **状态分析**: 详见Step 3.c
6. **CRUD矩阵**: 详见Step 4
7. **业务规则**: 详见Step 5
8. **枚举编码约定**: 每个枚举必须给出显示名(中文)+编码值(英文snake_case小写)
9. **权限矩阵**: 角色×状态×操作的操作权限矩阵
10. **风险与假设**: 风险(ID/描述/影响/概率/应对) | 假设(ID/描述/验证方式)
11. **附录**: 术语表 | 参考文档

### 🇺🇸
### Business Analysis Report Structure
1. **Overview**: Document info (module number/name/date/version) | Business background | Goals & value
2. **5W1H Analysis**: See Step 2
3. **Use Case Analysis**: See Step 3.a
4. **Process Analysis**: See Step 3.b
5. **State Analysis**: See Step 3.c
6. **CRUD Matrix**: See Step 4
7. **Business Rules**: See Step 5
8. **Enum Coding Conventions**: Each enum must provide display name (Chinese) + code value (English snake_case lowercase)
9. **Permission Matrix**: Role × State × Operation permission matrix
10. **Risks & Assumptions**: Risks (ID/description/impact/probability/mitigation) | Assumptions (ID/description/verification method)
11. **Appendix**: Glossary | Reference documents

## Guardrails / 安全护栏

### 🇨🇳
**必须遵守**: 每个需求必须有明确的5W1H分析 | 每个业务实体必须有状态定义 | CRUD矩阵必须覆盖所有业务操作 | 业务规则必须标注优先级

**避免事项**: ❌ 遗漏关键业务流程 | ❌ 状态定义不完整或不互斥 | ❌ 业务规则与实际业务不符 | ❌ 用例与流程描述不一致

### 🇺🇸
**MUST comply**: Every requirement MUST have complete 5W1H analysis | Every business entity MUST have state definitions | CRUD matrix MUST cover all business operations | Business rules MUST be marked with priority

**Avoid**: ❌ Missing critical business flows | ❌ Incomplete or non-exclusive state definitions | ❌ Business rules not matching actual business | ❌ Inconsistency between use cases and process descriptions

## 与其他技能协作 / Skill Collaboration

### 🇨🇳
| 协作技能 | 协作方式 | 传入数据 | 期望输出 |
|---------|---------|---------|---------|
| **pdd-main** | 流程调度 | 分析请求 | 业务分析报告 |
| **pdd-extract-features** | Sequential | 分析报告 | 功能点矩阵 |
| **pdd-generate-spec** | Sequential | 分析报告 | 开发规格 |

### 🇺🇸
| Collaborating Skill | Collaboration Mode | Input Data | Expected Output |
|--------------------|-------------------|------------|-----------------|
| **pdd-main** | Workflow scheduling | Analysis request | Business analysis report |
| **pdd-extract-features** | Sequential | Analysis report | Feature matrix |
| **pdd-generate-spec** | Sequential | Analysis report | Development spec |

---

## Iron Law / 核心铁律

### 🇨🇳
1. **方法论驱动分析**: 必须使用5W1H、MECE、CRUD等标准方法论进行分析,不得凭直觉或经验随意输出分析结果。
2. **不越界做技术决策**: 业务分析的产出是业务层面的描述(用例、流程、规则),不涉及具体技术实现方案、数据库设计或接口定义。
3. **完整性优先于速度**: 每个需求必须完成全部六个维度的5W1H分析,不得因为"看起来简单"而跳过某些维度。
4. **可追溯性保障**: 分析报告中的每个结论都必须能追溯到PRD文档原文或用户提供的业务资料,不得编造不存在业务规则。
5. **模型一致性**: 用例图、流程图、状态图之间必须保持一致,同一实体在不同图中的行为描述不得矛盾。

**违规示例**: ❌ 在业务分析中直接设计数据库表结构 | ❌ 因为"登录功能很简单"而跳过其5W1H分析 | ❌ 编造PRD中未提及的业务规则 | ❌ 用例图中显示的操作在流程图中没有对应步骤 | ❌ 使用非标准术语而不在术语表中定义

**合规示例**: ✅ 对每个需求执行完整的5W1H分析并记录到报告中 | ✅ 输出用例图和流程图时保持参与者与操作的一致性 | ✅ 所有业务规则都标注来源(如"源自PRD第3章第2节") | ✅ 在术语表中明确定义所有专业词汇 | ✅ 使用MECE原则检验功能点分类是否完整且互斥

### 🇺🇸
1. **Methodology-Driven Analysis**: MUST use standard methodologies (5W1H, MECE, CRUD) for analysis. NEVER output results based on intuition or experience alone.
2. **No Technical Decision Overreach**: Business analysis outputs are business-level descriptions (use cases, processes, rules). Must NOT involve specific technical implementations, database designs, or API definitions.
3. **Completeness Over Speed**: Every requirement MUST complete all six dimensions of 5W1H analysis. NEVER skip dimensions because something "looks simple".
4. **Traceability Guarantee**: Every conclusion in the analysis report MUST be traceable to PRD document text or user-provided business materials. NEVER fabricate non-existent business rules.
5. **Model Consistency**: Use case diagrams, flowcharts, and state diagrams MUST remain consistent. The same entity's behavior must not contradict across different diagrams.

**Violation Examples**: ❌ Designing database table structures directly in business analysis | ❌ Skipping 5W1H analysis because "login is simple" | ❌ Fabricating business rules not mentioned in PRD | ❌ Operations in use case diagram have no corresponding steps in flowchart | ❌ Using non-standard terms without defining them in glossary

**Compliance Examples**: ✅ Execute complete 5W1H analysis for each requirement and record in report | ✅ Maintain consistency between actors and operations when outputting use case and process diagrams | ✅ Cite sources for all business rules (e.g., "from PRD Ch.3 Sec.2") | ✅ Define all technical terms clearly in glossary | ✅ Use MECE principle to verify feature classification is complete and mutually exclusive

---

## Rationalization Table / 合理化防御表

| # | Trap / 陷阱 | Question / 请问自己 | Action / 应该怎么做 |
|---|-------------|------------------|------------------|
| 1 | "这个需求很明显,不用写那么详细"<br>"This requirement is obvious, no need for detail" | 明显的需求也可能有隐含的业务规则和边界条件 | 至少完成最小化的5W1H分析模板,确保覆盖关键维度 |
| 2 | "PRD已经写得很清楚了,我总结一下就行"<br>"PRD is clear enough, I'll just summarize" | 总结会丢失细节,后续技能需要完整的分析结果作为输入 | 按照标准模板逐项填写,而非概括性总结 |
| 3 | "这个流程图画起来太费时间"<br>"Flowcharts take too much time" | 流程图是后续功能点提取的关键输入,缺失会导致遗漏 | 使用mermaid语法快速生成,确保至少覆盖主流程和异常分支 |
| 4 | "状态定义差不多就行"<br>"State definitions are good enough" | 不完整的状态定义会导致状态机实现缺陷 | 确保每个状态都有明确的转入/转出条件和触发事件 |
| 5 | "用户没提这个规则,但我认为应该有"<br>"User didn't mention this rule, but I think it should exist" | 编造业务规则会导致实现与实际需求不符 | 将推断标记为"假设"并请用户确认,不得直接作为确定规则 |

**常见陷阱 / Common Traps**:
1. **"表面分析"陷阱**: 只描述"做什么"而不深究"为什么"和"怎么做" → 强制完成5W1H全部分析,特别是Why和How维度
2. **"技术前置"陷阱**: 过早引入技术实现细节 → 始终保持业务视角,技术决策留给后续技能
3. **"模型脱节"陷阱**: 用例、流程、状态图各自独立绘制未进行交叉验证 → 在输出前强制执行模型一致性检查清单
4. **"术语泛滥"陷阱**: 大量使用专业术语但不提供定义 → 强制维护术语表,首次出现时必须定义

---

## Red Flags / 红旗警告

### Layer 1: Input Guards / 输入防护
- **INPUT-BA-001**: PRD文档为空或内容少于100字 → 🔴 CRITICAL → 终止并提示用户提供有效的PRD文档 / Terminate and prompt user to provide valid PRD document
- **INPUT-BA-002**: PRD文档格式无法解析(非文本/Markdown) → 🔴 CRITICAL → 提示支持的文档格式 / Prompt for supported document formats
- **INPUT-BA-003**: 用户只提供了需求标题而无详细描述 → 🟡 WARN → 尝试通过对话收集更多信息,基于有限信息进行分析但标注不确定性 / Try to gather more info via conversation, analyze with limited data but mark uncertainty

### Layer 2: Execution Guards / 执行防护
- **EXEC-BA-001**: 跳过5W1H任一维度的分析 → 🔴 CRITICAL → 补充完整后再继续 / Complete missing dimensions before continuing
- **EXEC-BA-002**: 业务规则未标注优先级(P0/P1/P2) → 🟡 WARN → 补充优先级标注,默认设为P1 / Add priority labels, default to P1
- **EXEC-BA-003**: CRUD矩阵未覆盖所有已识别的实体 → 🔴 CRITICAL → 补充遗漏实体的CRUD分析 / Add CRUD analysis for missing entities
- **EXEC-BA-004**: 状态机的状态转换缺少触发事件或条件 → 🟡 WARN → 补充转换条件说明 / Add transition condition descriptions

### Layer 3: Output Guards / 输出防护
- **OUTPUT-BA-001**: 业务分析报告缺少风险与假设章节 → 🔴 CRITICAL → 补充风险识别和假设声明 / Add risk identification and assumption statements
- **OUTPUT-BA-002**: 报告中的结论无法追溯到源文档 → 🟡 WARN → 补充引用来源或标记为推断 / Add citation sources or mark as inference
- **OUTPUT-BA-003**: 术语表中有未定义的术语 → 🟡 WARN → 补充术语定义或替换为通俗表达 / Define terms or replace with plain language

**Trigger Handling / 触发处理流程:**
🔴 CRITICAL → 立即停止,报告问题详情,等待指示 | Stop immediately & report details, wait for instructions
🟡 WARN → 记录警告到分析日志,尝试自动修复,在最终报告中标注 | Log warning, attempt auto-fix, annotate in final report
🔵 INFO → 记录信息,正常继续 | Log info, continue normally
