---
name: pdd-extract-features
description: 从PRD文档体系中提取功能点矩阵。当用户想要提取功能点、识别功能需求或分析业务功能时调用此Skill。支持中文触发：提取功能点、功能点提取、PRD分析、需求拆解。
license: MIT
compatibility: 需要业务分析报告和PRD文档
metadata:
  author: "neuqik@hotmail.com"
  version: "2.1"
  parent: pdd-main
  triggers:
    - "提取功能点" | "功能点矩阵" | "FP-"
    - "从PRD提取" | "功能点分析"
---

# PDD-Extract Features - 功能点提取技能 / Feature Extraction Skill

## 核心概念 / Core Concepts

### 🇨🇳

从业务分析结果和PRD文档中提取功能点,生成标准化的功能点矩阵。

**输入**: 业务分析报告/PRD文档 | **输出**: feature-matrix.md(功能点矩阵) | **不负责**: 规格编写/代码实现

### 🇺🇸

Extract feature points from business analysis results and PRD documents, generating a standardized feature matrix.

**Input**: Business Analysis Report/PRD Document | **Output**: feature-matrix.md (Feature Matrix) | **Not Responsible For**: Specification writing/Code implementation

## 功能点分类 / Feature Classification

### 🇨🇳 按复杂度分类

| 复杂度 | 代码 | 说明 | 开发时间 | 人工参与 |
|--------|------|------|---------|---------|
| **核心业务** | P0 | 核心业务流程,涉及多方审批 | 3-5天 | 高 |
| **重要功能** | P1 | 重要业务功能,有替代方案 | 1-2天 | 中 |
| **辅助功能** | P2 | 辅助性功能,易于实现 | 0.5天 | 低 |

### 🇺🇸 Classification by Complexity

| Complexity | Code | Description | Dev Time | Human Involvement |
|-----------|------|-------------|----------|-------------------|
| **Core Business** | P0 | Core business process, multi-party approval | 3-5 days | High |
| **Important Feature** | P1 | Important business function, has alternatives | 1-2 days | Medium |
| **Auxiliary Function** | P2 | Auxiliary feature, easy to implement | 0.5 day | Low |

### 🇨🇳 按操作类型分类

C(Create新增) | R(Read查询/详情) | U(Update修改) | D(Delete删除) | B(Batch批量操作) | A(Approve审批流程) | E(Export数据导出) | F(Flow状态流转)

### 🇺🇸 Classification by Operation Type

C (Create) | R (Read/Detail) | U (Update) | D (Delete) | B (Batch Operations) | A (Approval Process) | E (Data Export) | F (Status Flow/Transition)

### 🇨🇳 按AI角色分类

AI-L(AI主导/低参与度) | AI-C(AI与人工协作/中参与度) | AI-R(AI辅助审核/高参与度)

### 🇺🇸 Classification by AI Role

AI-L (AI-led/Low human involvement) | AI-C (AI collaboration/Medium involvement) | AI-R (AI-assisted review/High involvement)

## 功能点提取流程 / Feature Extraction Process

### 🇨🇳 Step 1: 分析业务用例
从业务分析报告中提取: 主要参与者 | 用例名称 | 基本流程 | 扩展流程

### 🇺🇸 Step 1: Analyze Business Use Cases
Extract from business analysis report: Main Actors | Use Case Name | Basic Flow | Alternative Flows

### 🇨🇳 Step 2: 识别功能操作
对每个用例识别操作(用例/操作/操作类型/复杂度/AI角色)

### 🇺🇸 Step 2: Identify Feature Operations
Identify operations for each use case (Use Case/Operation/Operation Type/Complexity/AI Role)

### 🇨🇳 Step 3: 识别页面/接口
功能点/页面路径/API路径/方法

### 🇺🇸 Step 3: Identify Pages/APIs
Feature Point/Page Path/API Path/Method

### 🇨🇳 Step 4: 生成功能点矩阵

```markdown
# [模块名称] 功能点矩阵

## 功能点汇总
| 功能点ID | 功能名称 | 页面/接口 | 操作类型 | 复杂度 | AI角色 | 依赖功能 |
|---------|---------|----------|---------|--------|--------|---------|
| FP-001 | 发起转让申请 | form.vue | C | P0 | AI-C | - |
| FP-002 | 查看转让申请 | detail.vue | R | P1 | AI-L | FP-001 |
```

### 🇺🇸 Step 4: Generate Feature Matrix

```markdown
# [Module Name] Feature Matrix

## Feature Summary
| Feature ID | Feature Name | Page/API | Operation Type | Complexity | AI Role | Dependencies |
|-----------|-------------|----------|---------------|------------|---------|--------------|
| FP-001 | Initiate Transfer Request | form.vue | C | P0 | AI-C | - |
| FP-002 | View Transfer Request | detail.vue | R | P1 | AI-L | FP-001 |
```

### 🇨🇳 Step 5: 功能点详情(P0必填)

对每个P0功能点生成详情:
- **基本信息**: 功能点ID/名称/所属用例/操作类型/复杂度
- **功能描述**: 功能说明
- **前置条件/后置条件**
- **输入字段**(字段名/类型/必填/说明)
- **输出信息**
- **业务规则**(规则ID/描述/约束类型/优先级)
- **测试策略**(正向/异常场景)

### 🇺🇸 Step 5: Feature Details (Required for P0)

Generate details for each P0 feature point:
- **Basic Info**: Feature ID/Name/Belonging Use Case/Operation Type/Complexity
- **Feature Description**: Functional description
- **Preconditions/Postconditions**
- **Input Fields** (Field Name/Type/Required/Description)
- **Output Information**
- **Business Rules** (Rule ID/Description/Constraint Type/Priority)
- **Test Strategy** (Positive/Exception scenarios)

## 功能点矩阵模板 / Feature Matrix Template

### 🇨🇳

```markdown
# [模块名称] 功能点矩阵

## 矩阵信息
| 模块编号 | 模块名称 | 生成日期 | 版本 |

## 功能点汇总表
### 按复杂度统计: P0(N个) | P1(N个) | P2(N个)
### 按操作类型统计: C/R/U/D/A/E/F 各N个

## 详细功能点列表
| 功能点ID | 功能名称 | 页面/接口 | 操作 | 复杂度 | AI角色 | 依赖 | 测试策略 |
```

### 🇺🇸

```markdown
# [Module Name] Feature Matrix

## Matrix Information
| Module ID | Module Name | Generated Date | Version |

## Feature Summary Table
### By Complexity: P0 (N) | P1 (N) | P2 (N)
### By Operation Type: C/R/U/D/A/E/F each N items

## Detailed Feature List
| Feature ID | Feature Name | Page/API | Operation | Complexity | AI Role | Dependencies | Test Strategy |
```

## Guardrails / 安全护栏

### 🇨🇳

**必须遵守**: 功能点ID全局唯一 | 每个功能点必须有明确的操作类型 | 必须标注功能点依赖关系 | P0功能点必须有详细描述

**避免事项**: ❌ 功能点遗漏关键业务操作 | ❌ 依赖关系形成循环 | ❌ 复杂度评估与实际不符

### 🇺🇸

**Must Follow**: Feature IDs must be globally unique | Each feature point must have a clear operation type | Feature dependencies must be explicitly declared | P0 features must have detailed descriptions

**Avoid**: ❌ Missing key business operations in feature points ❌ Circular dependencies ❌ Complexity assessment does not match reality

## 与其他技能协作 / Collaboration with Other Skills

### 🇨🇳

| 协作技能 | 协作方式 | 传入数据 | 期望输出 |
|---------|---------|---------|---------|
| **pdd-ba** | Sequential | 业务分析报告 | 用例和流程 |
| **pdd-generate-spec** | Sequential | 功能点矩阵 | spec.md |

### 🇺🇸

| Collaborating Skill | Collaboration Mode | Input Data | Expected Output |
|-------------------|-------------------|------------|-----------------|
| **pdd-ba** | Sequential | Business Analysis Report | Use cases and flows |
| **pdd-generate-spec** | Sequential | Feature Matrix | spec.md |

## 人工审核规范 / Human Review Guidelines

### 🇨🇳

**审核节点**: 功能点矩阵生成完成后需要进行人工审核

**审核内容**: 功能点完整性(是否覆盖所有业务功能) | 复杂度评估(P0/P1/P2是否合理) | 测试策略(是否完整) | 依赖关系(是否正确)

**审核粒度**:
- **批量审核**: 快速浏览整体,标记需详细审核的内容
- **关键功能点详细审核**: P0优先级/复杂状态转换/外部系统集成/敏感数据处理

**输出文件**: `review-features.md` | **结果类型**: passed / rejected / conditional

### 🇺🇸

**Review Point**: Human review is required after feature matrix generation

**Review Content**: Feature completeness (covers all business functions) | Complexity assessment (P0/P1/P2 reasonableness) | Test strategy completeness | Dependency correctness

**Review Granularity**:
- **Batch Review**: Quick overview, mark items needing detailed review
- **Detailed Review for Key Features**: P0 priority / Complex state transitions / External system integration / Sensitive data handling

**Output File**: `review-features.md` | **Result Types**: passed / rejected / conditional

---

## Iron Law / 铁律

### 🇨🇳

1. **来源可追溯**: 每个功能点必须能追溯到业务分析报告中的具体用例或PRD文档的明确章节,不得凭空创造功能点。

2. **粒度适中**: 功能点粒度应保持在"单个可验收的工作单元"级别,过粗(一个FP包含多个独立功能)或过细(将一个操作的步骤拆分为多个FP)都是违规的。

3. **依赖关系显式化**: 功能点之间的依赖关系必须明确声明,不得隐含依赖;循环依赖是绝对禁止的。

4. **复杂度评估有据可依**: P0/P1/P2的评估必须有明确的判断标准(如涉及审批流程、外部系统集成、核心业务规则等),不得凭感觉随意定级。

5. **完整性通过MECE验证**: 提取完成后必须使用MECE原则检验:所有用例的操作是否都被覆盖?是否有遗漏的辅助功能(如导入导出、批量操作)?

**违规示例**: ❌ 创建了无法追溯到任何用例的功能点 | ❌ 将"用户管理"作为一个功能点(粒度过粗) | ❌ 将"填写表单第一步/第二步"拆分为两个FP(粒度过细) | ❌ 循环依赖(A→B→A) | ❌ 全部标为P0或全部标为P2

**合规示例**: ✅ 每个功能点都标注了"源自UC-xxx" | ✅ FP-001对应"发起申请"这一完整操作 | ✅ 明确标注FP-005(审批)依赖于FP-001(申请) | ✅ P0判定理由:"涉及多级审批工作流和状态机转换" | ✅ 使用MECE清单检验后确认覆盖全部CRUD操作

### 🇺🇸

1. **Traceable Source**: Every feature point must be traceable to a specific use case in the business analysis report or a clear section in the PRD document. Feature points must not be created out of thin air.

2. **Appropriate Granularity**: Feature point granularity should be maintained at the "single acceptable work unit" level. Both too coarse (one FP containing multiple independent functions) and too fine (splitting steps of one operation into multiple FPs) are violations.

3. **Explicit Dependencies**: Dependencies between feature points must be explicitly declared. Implicit dependencies are not allowed. Circular dependencies are absolutely prohibited.

4. **Evidence-Based Complexity Assessment**: P0/P1/P2 assessments must have clear judgment criteria (e.g., involving approval processes, external system integration, core business rules, etc.). Arbitrary classification based on feeling is not allowed.

5. **Completeness Verified via MECE**: After extraction, MECE principle must be used for verification: Are all use case operations covered? Are there missing auxiliary functions (such as import/export, batch operations)?

**Violation Examples**: ❌ Created feature points that cannot be traced to any use case | ❌ Treated "User Management" as a single feature point (too coarse granularity) | ❌ Split "Fill Form Step 1/Step 2" into two FPs (too fine granularity) | ❌ Circular dependency (A→B→A) | ❌ Marked everything as P0 or everything as P2

**Compliance Examples**: ✅ Each feature point is labeled "Source: UC-xxx" | ✅ FP-001 corresponds to "Initiate Request" as a complete operation | ✅ Clearly marked FP-005 (Approval) depends on FP-001 (Request) | ✅ P0 justification: "Involves multi-level approval workflow and state machine transitions" | ✅ Confirmed full CRUD coverage after MECE checklist verification

---

## Rationalization Table / 理性化对照表

### 🇨🇳

| # | 陷阱 | 请问自己 | 应该怎么做 |
|---|------|---------|-----------|
| 1 | "这个功能太小了,不值得单独列为FP" / "This feature is too small to be a separate FP" | 即使小的功能也是独立的交付单元,遗漏会导致验收盲区 | 保持统一粒度标准,只要是独立可验收的操作就应列为FP |
| 2 | "PRD里没写但我觉得应该有这个功能" / "The PRD doesn't mention this but I think it should exist" | 需求外推是有风险的,可能引入不必要的工作量 | 标记为"建议功能"并单独列出,请用户确认是否纳入 |
| 3 | "依赖关系太复杂了,先不管吧" / "Dependencies are too complex, let's ignore them for now" | 缺失依赖关系会导致实施顺序错误和集成问题 | 至少标注直接依赖,复杂的传递依赖可在实施阶段细化 |
| 4 | "全部标为P0吧,这样比较保险" / "Let's mark everything as P0, just to be safe" | P0泛滥会让真正重要的功能失去优先级标识的意义 | 严格按评估标准分级,确保P0数量合理(通常不超过总数的30%) |
| 5 | "测试策略后面再想" / "We'll figure out test strategy later" | 测试策略是功能点定义的重要组成部分,影响后续验证工作 | 为每个P0功能点至少定义正向和异常两个测试场景 |

**常见陷阱**:
1. **"粒度失控"陷阱**: 功能点大小不一,有的过于宏大有的过于琐碎 → 建立粒度参考标准(如:一个FP对应一个完整的用户操作场景)
2. **"隐含依赖"陷阱**: 只记录了明显依赖,忽略了数据依赖和时序依赖 → 强制执行依赖审查:每个FP的前置条件是什么?
3. **"P0通胀"陷阱**: 为了引起重视而将本应是P1的功能提升为P0 → 建立量化评估标准(如:P0=涉及审批/支付/核心业务流)
4. **"测试盲区"陷阱**: 只关注功能描述而忽略测试策略 → 强制要求每个FP至少包含基本测试场景说明

### 🇺🇸

| # | Trap | Ask Yourself | Action |
|---|------|-------------|--------|
| 1 | "This feature is too small to be a separate FP" | Even small features are independent delivery units; omission leads to acceptance blind spots | Maintain consistent granularity; any independently acceptable operation should be listed as an FP |
| 2 | "The PRD doesn't mention this but I think it should exist" | Requirement extrapolation is risky and may introduce unnecessary workload | Mark as "suggested feature" and list separately; ask user to confirm inclusion |
| 3 | "Dependencies are too complex, let's ignore them for now" | Missing dependencies cause implementation sequence errors and integration issues | At least mark direct dependencies; complex transitive dependencies can be refined during implementation |
| 4 | "Let's mark everything as P0, just to be safe" | P0 inflation makes truly important features lose priority significance | Strictly classify by assessment criteria; ensure reasonable P0 count (typically ≤30% of total) |
| 5 | "We'll figure out test strategy later" | Test strategy is an integral part of feature definition, affecting subsequent verification work | Define at least positive and exception test scenarios for each P0 feature |

**Common Traps**:
1. **"Granularity Out of Control" Trap**: Feature points vary in size, some too grandiose others too trivial → Establish granularity reference standard (e.g., one FP = one complete user operation scenario)
2. **"Hidden Dependencies" Trap**: Only recorded obvious dependencies, ignored data and timing dependencies → Enforce dependency review: What are the preconditions for each FP?
3. **"P0 Inflation" Trap**: Elevating P1 features to P0 just to draw attention → Establish quantitative assessment criteria (e.g., P0 = involves approval/payment/core business flow)
4. **"Test Blind Spot" Trap**: Focused only on feature description while ignoring test strategy → Require each FP to include at least basic test scenario descriptions

---

## Red Flags / 红旗警告

### Layer 1: Input Validation Guards / 输入检查防护

- **INPUT-FE-001**: 业务分析报告为空或缺少用例章节 → 🔴 CRITICAL → 终止并提示先完成业务分析 / Terminate and prompt to complete business analysis first
- **INPUT-FE-002**: PRD文档与业务分析报告的内容存在明显矛盾 → 🟡 WARN → 记录矛盾点,以PRD文档为准并在报告中标注 / Record contradictions, use PRD as primary source and note in report
- **INPUT-FE-003**: 业务分析报告缺少CRUD矩阵或状态图 → 🔴 CRITICAL → 提示补充完整后再进行功能点提取 / Prompt to supplement before proceeding with feature extraction

### Layer 2: Execution Validation Guards / 执行检查防护

- **EXEC-FE-001**: 存在无法追溯到用例或PRD的功能点 → 🔴 CRITICAL → 删除无依据的功能点或补充来源引用 / Delete unsupported feature points or add source references
- **EXEC-FE-002**: 功能点ID重复或不遵循命名规范(FP-XXX-NNN) → 🟡 WARN → 重新编号并保持全局唯一性 / Renumber and maintain global uniqueness
- **EXEC-FE-003**: 发现循环依赖(A→B→A) → 🔴 CRITICAL → 分析依赖关系,拆解或合并功能点以消除循环 / Analyze dependencies, split or merge feature points to eliminate cycles
- **EXEC-FE-004**: P0功能点缺少详细描述(输入字段/输出信息/业务规则) → 🔴 CRITICAL → 补充完整详情 / Supplement complete details

### Layer 3: Output Validation Guards / 输出检查防护

- **OUTPUT-FE-001**: 功能点矩阵缺少汇总统计(按复杂度/按操作类型) → 🔴 CRITICAL → 补充统计表格 / Add summary statistics tables
- **OUTPUT-FE-002**: 功能点总数为0或明显少于预期 → 🔴 CRITICAL → 重新审视分析报告,确认是否有遗漏 / Re-examine analysis report to confirm no omissions
- **OUTPUT-FE-003**: 输出的feature-matrix.md格式不符合模板规范 → 🟡 WARN → 调整格式以符合模板要求 / Adjust format to meet template requirements

### 🇨🇳 触发Red Flag时的处理流程
🔴 CRITICAL → 立即停止,报告问题详情,等待指示 | 🟡 WARN → 记录警告到提取日志,尝试自动修复,在最终报告中标注 | 🔵 INFO → 记录信息,正常继续

### 🇺🇸 Red Flag Trigger Handling Process
🔴 CRITICAL → Stop immediately, report problem details, await instructions | 🟡 WARN → Log warning to extraction log, attempt auto-fix, note in final report | 🔵 INFO → Record information, continue normally
