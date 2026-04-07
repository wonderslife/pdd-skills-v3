---
name: pdd-generate-spec
description: 根据功能点矩阵生成开发规格和验收标准。当用户想要生成功能点的技术规格时调用此Skill。支持中文触发：生成规格、开发规格、技术规格、PDD规格。
license: MIT
compatibility: 需要功能点矩阵和业务分析报告
metadata:
  author: "neuqik@hotmail.com"
  version: "2.1"
  parent: pdd-main
  triggers:
    - "生成开发规格" | "生成spec" | "/spec"
    - "技术设计" | "接口设计" | "数据模型"
---

# PDD-Generate Spec - 开发规格生成技能 / Development Specification Generation Skill

## 核心概念 / Core Concepts

### 🇨🇳

根据功能点矩阵和业务分析报告,为每个功能点生成详细的开发规格文档(spec.md)和验收标准(checklist.md)。

**输入**: feature-matrix.md(功能点矩阵) | 业务分析报告 | **输出**: spec.md(开发规格) | checklist.md(验收标准) | **不负责**: 代码实现/测试执行

### 🇺🇸

Based on the feature matrix and business analysis report, generate detailed development specification documents (spec.md) and acceptance criteria (checklist.md) for each feature point.

**Input**: feature-matrix.md (Feature Matrix) | Business Analysis Report | **Output**: spec.md (Development Specification) | checklist.md (Acceptance Criteria) | **Not Responsible For**: Code implementation / Test execution

## 规格文档结构 / Specification Document Structure

### 🇨🇳

### spec.md 模板

```markdown
# [模块名称] 开发规格

## 基本信息
| 项目 | 内容 |
|------|------|
| 功能点ID | FP-XXX-NNN |
| 版本 | v1.0 |
| 日期 | YYYY-MM-DD |

## 1. 接口定义

### 1.1 API列表
| 序号 | 方法 | 路径 | 描述 | 认证 |

### 1.2 接口详情
#### POST /api/{module}/create
**请求参数**: 字段名/类型/必填/说明
**响应结构**: code/msg/data
**错误码**: 错误码/描述/处理方式

## 2. 数据模型

### 2.1 实体关系图(文字描述)
实体间的关系和依赖

### 2.2 数据表设计
| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|

### 2.3 枚举值定义
| 字段 | 值 | 含义 |

## 3. 业务逻辑

### 3.1 处理流程
1.[步骤] → 2.[步骤] → 3.[步骤]

### 3.2 业务规则
| 规则ID | 规则描述 | 约束类型 | 优先级 |

### 3.3 状态转换
当前状态 → 条件/事件 → 目标状态

## 4. 前端页面设计

### 4.1 页面清单
| 页面 | 路径 | 类型 |

### 4.2 表单字段
| 字段名 | 组件类型 | 校验规则 |

## 5. 权限与安全

### 5.1 接口权限
| 路径 | 权限标识 | 角色 |

### 5.2 数据权限
| 操作 | 数据范围 |
```

### checklist.md 模板

```markdown
# [功能点名称] 验收标准

## 业务验收标准
| 序号 | 验收项 | 预期结果 | 验证方法 |
|------|-------|---------|---------|

## 技术验收标准
| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|

## 集成验收标准
| 序号 | 验收项 | 标准 | 验证方法 |
```

### 🇺🇸

### spec.md Template

```markdown
# [Module Name] Development Specification

## Basic Information
| Item | Content |
|------|---------|
| Feature Point ID | FP-XXX-NNN |
| Version | v1.0 |
| Date | YYYY-MM-DD |

## 1. API Definition

### 1.1 API List
| No. | Method | Path | Description | Auth |

### 1.2 API Details
#### POST /api/{module}/create
**Request Parameters**: Field Name / Type / Required / Description
**Response Structure**: code / msg / data
**Error Codes**: Error Code / Description / Handling

## 2. Data Model

### 2.1 Entity Relationship Diagram (Text Description)
Relationships and dependencies between entities

### 2.2 Database Table Design
| Field Name | Type | Required | Description |
|------------|------|----------|-------------|

### 2.3 Enumeration Value Definitions
| Field | Value | Meaning |

## 3. Business Logic

### 3.1 Processing Flow
1.[Step] → 2.[Step] → 3.[Step]

### 3.2 Business Rules
| Rule ID | Rule Description | Constraint Type | Priority |

### 3.3 State Transitions
Current State → Condition/Event → Target State

## 4. Frontend Page Design

### 4.1 Page List
| Page | Path | Type |

### 4.2 Form Fields
| Field Name | Component Type | Validation Rules |

## 5. Permissions & Security

### 5.1 API Permissions
| Path | Permission Identifier | Role |

### 5.2 Data Permissions
| Operation | Data Scope |
```

### checklist.md Template

```markdown
# [Feature Point Name] Acceptance Criteria

## Business Acceptance Criteria
| No. | Acceptance Item | Expected Result | Verification Method |
|-----|----------------|-----------------|---------------------|

## Technical Acceptance Criteria
| No. | Acceptance Item | Standard | Verification Method |
|-----|----------------|----------|---------------------|

## Integration Acceptance Criteria
| No. | Acceptance Item | Standard | Verification Method |
```

## 生成流程 / Generation Process

### 🇨🇳

### Step 1: 读取功能点矩阵
从 `dev-specs/feature-matrix.md` 读取功能点定义

### Step 2: 分析功能点详情
提取: 功能描述 | 输入字段 | 输出信息 | 业务规则 | 状态转换 | 测试策略

### Step 3: 设计接口定义
RESTful规范 | HTTP方法语义 | URL命名规范 | 请求/响应格式 | 错误码体系

### Step 4: 设计数据模型
实体识别 | 属性定义 | 关系映射 | 索引设计 | 审计字段(create_time/update_time/create_by/update_by/del_flag/status)

### Step 5: 定义业务逻辑
核心流程 | 边界条件 | 异常处理 | 状态机转换

### Step 6: 设计前端页面
页面结构 | 表单布局 | 列表展示 | 交互流程

### Step 7: 定义权限与安全
接口权限 | 数据权限 | 输入校验 | SQL注入防护

### Step 8: 编写验收标准
业务场景覆盖 | 技术指标达标 | 集成测试通过

### Step 9: 输出规格文档
保存到 `dev-specs/FP-{序号}/spec.md` 和 `checklist.md`

### 🇺🇸

### Step 1: Read Feature Matrix
Read feature point definitions from `dev-specs/feature-matrix.md`

### Step 2: Analyze Feature Point Details
Extract: Feature Description | Input Fields | Output Information | Business Rules | State Transitions | Test Strategy

### Step 3: Design API Definitions
RESTful Conventions | HTTP Method Semantics | URL Naming Conventions | Request/Response Format | Error Code System

### Step 4: Design Data Model
Entity Identification | Attribute Definition | Relationship Mapping | Index Design | Audit Fields (create_time/update_time/create_by/update_by/del_flag/status)

### Step 5: Define Business Logic
Core Flow | Edge Cases | Exception Handling | State Machine Transitions

### Step 6: Design Frontend Pages
Page Structure | Form Layout | List Display | Interaction Flow

### Step 7: Define Permissions & Security
API Permissions | Data Permissions | Input Validation | SQL Injection Protection

### Step 8: Write Acceptance Criteria
Business Scenario Coverage | Technical Metrics Compliance | Integration Test Pass

### Step 9: Output Specification Documents
Save to `dev-specs/FP-{sequence}/spec.md` and `checklist.md`

## Guardrails / 质量护栏

### 🇨🇳

**必须遵守**: 接口定义必须符合RESTful规范 | 数据模型必须包含审计字段 | 业务规则必须标注优先级 | 验收标准必须可测试可验证

**避免事项**: ❌ 接口路径不符合RESTful规范 | ❌ 数据模型缺少审计字段 | ❌ 业务规则模糊无法验证 | ❌ 验收标准不可测试

### 🇺🇸

**Must Follow**: API definitions must comply with RESTful conventions | Data models must include audit fields | Business rules must be marked with priority levels | Acceptance criteria must be testable and verifiable

**Avoid**: ❌ API paths that do not follow RESTful conventions | ❌ Data models missing audit fields | ❌ Business rules that are vague and unverifiable | ❌ Acceptance criteria that are not testable

## 与其他技能协作 / Collaboration with Other Skills

### 🇨🇳

| 协作技能 | 协作方式 | 传入数据 | 期望输出 |
|---------|---------|---------|---------|
| **pdd-extract-features** | Sequential | 功能点矩阵 | 功能点详情 |
| **pdd-ba** | Sequential | 业务分析报告 | 用例/流程/状态 |
| **system-architect** | Consultation | 架构需求 | 架构建议 |
| **software-architect** | Consultation | 模块需求 | 模块设计 |
| **pdd-implement-feature** | Sequential | spec.md + checklist.md | 代码实现 |

### 🇺🇸

| Collaborating Skill | Collaboration Mode | Input Data | Expected Output |
|---------------------|-------------------|------------|-----------------|
| **pdd-extract-features** | Sequential | Feature Matrix | Feature Point Details |
| **pdd-ba** | Sequential | Business Analysis Report | Use Cases / Flows / States |
| **system-architect** | Consultation | Architecture Requirements | Architecture Recommendations |
| **software-architect** | Consultation | Module Requirements | Module Design |
| **pdd-implement-feature** | Sequential | spec.md + checklist.md | Code Implementation |

## 人工审核规范 / Human Review Guidelines

### 🇨🇳

**审核节点**: 开发规格生成完成后需要人工审核

**审核内容**: 接口设计合理性 | 数据模型完整性 | 业务逻辑正确性 | 验收标准完备性

**审核粒度**:
- **批量审核**: 快速浏览整体,标记需详细审核的内容
- **关键功能点详细审核**: P0优先级 | 复杂状态转换 | 外部系统集成 | 敏感数据处理

**输出文件**: `review-spec.md` | **结果类型**: passed / rejected / conditional

### 🇺🇸

**Review Checkpoint**: Human review is required after development specification generation is complete

**Review Content**: API design rationality | Data model completeness | Business logic correctness | Acceptance criteria completeness

**Review Granularity**:
- **Batch Review**: Quickly scan the overall content and flag items requiring detailed review
- **Detailed Review for Critical Features**: P0 priority | Complex state transitions | External system integration | Sensitive data handling

**Output File**: `review-spec.md` | **Result Types**: passed / rejected / conditional

---

## Iron Law / 铁律

### 🇨🇳

1. **规格驱动实现**: 生成的spec.md必须是后续代码实现的唯一依据,所有接口定义、数据模型、业务规则都必须在规格中明确声明,不得让实现者自行推断。

2. **验收标准可测试性**: checklist.md中的每条验收标准都必须是客观的、可验证的,不得出现"界面美观""响应迅速"等主观描述。

3. **前后端一致性**: 规格中的接口定义必须同时适用于后端实现和前端调用,前端API层应能直接基于规格生成。

4. **完整性与简洁性平衡**: 规格必须足够详细以指导实现(不遗漏关键细节),但也要避免过度详细导致维护成本过高。

5. **变更追溯性**: 规格中每个决策(如选择某种数据结构、设计某个接口)都应有简要的理由说明或引用来源,便于后续审查和理解。

**违规示例**: ❌ 接口只写了路径而未定义请求参数和响应结构 | ❌ 验收标准写"用户体验良好"而非具体指标 | ❌ 后端规格与前端实际调用的字段名不一致 | ❌ 为了省事将规格写得过于简略导致实现者频繁询问 | ❌ 数据库设计了联合索引但未说明查询场景

**合规示例**: ✅ 每个接口都包含完整的请求/响应定义和错误码列表 | ✅ 验收标准明确:"列表接口响应时间<500ms(1000条数据)" | ✅ 前后端使用同一份接口规格作为开发依据 | ✅ 规格详细但不冗余:关键决策有注释,常规内容用表格呈现 | ✅ 索引设计附带说明:"支持按status+create_time的组合查询"

### 🇺🇸

1. **Specification-Driven Implementation**: The generated spec.md must be the sole basis for subsequent code implementation. All API definitions, data models, and business rules must be explicitly declared in the specification — implementers must not be left to make their own inferences.

2. **Acceptance Criteria Testability**: Each acceptance criterion in checklist.md must be objective and verifiable. Subjective descriptions such as "beautiful UI" or "fast response" are prohibited.

3. **Frontend-Backend Consistency**: API definitions in the specification must be applicable to both backend implementation and frontend invocation. The frontend API layer should be able to generate code directly based on the specification.

4. **Balance of Completeness and Conciseness**: The specification must be sufficiently detailed to guide implementation (without omitting key details), but should avoid excessive detail that leads to high maintenance costs.

5. **Change Traceability**: Every decision in the specification (such as choosing a data structure or designing an API) should include a brief rationale or reference source for subsequent review and understanding.

**Violation Examples**: ❌ An API only has a path defined without request parameters and response structure | ❌ Acceptance criterion says "good user experience" instead of specific metrics | ❌ Backend spec field names are inconsistent with what the frontend actually calls | ❌ Specification is overly brief to save effort, causing implementers to frequently ask questions | ❌ Database composite index is designed without explaining the query scenario

**Compliance Examples**: ✅ Every API includes complete request/response definitions and error code list | ✅ Acceptance criterion is explicit: "List API response time < 500ms (1000 records)" | ✅ Frontend and backend use the same API specification as development basis | ✅ Specification is detailed but not redundant: key decisions have comments, routine content uses tables | ✅ Index design includes explanation: "Supports combined queries by status + create_time"

---

## Rationalization Table / 理性化对照表

### 🇨🇳

| # | 陷阱 / Trap | 请问自己 / Ask Yourself | 应该怎么做 / Action |
|---|------------|----------------------|---------------------|
| 1 | "这个接口很简单,写个路径就行了" / "This API is simple, just write the path" | 简单的接口也需要明确的参数定义,否则实现者会自行猜测 / Even simple APIs need clear parameter definitions, otherwise implementers will guess | 即使是最简单的CRUD接口也必须定义完整的请求/响应结构 / Even the simplest CRUD APIs must have complete request/response structure defined |
| 2 | "验收标准差不多就行,反正后面会测" / "Acceptance criteria is good enough, it will be tested later anyway" | 模糊的验收标准会导致验收阶段扯皮,且无法客观判断是否通过 / Vague acceptance criteria leads to disputes during acceptance and makes objective judgment impossible | 每条标准都必须量化或提供明确的判定方法 / Every criterion must be quantified or provide a clear determination method |
| 3 | "前端后面再对吧,先完成后端" / "Let's do frontend later, finish backend first" | 前后端不一致是集成阶段最常见的问题 / Frontend-backend inconsistency is the most common problem in integration phase | 规格生成时就必须同步考虑前后端,确保接口定义的双向适用性 / Frontend and backend must be considered together during spec generation to ensure bidirectional applicability |
| 4 | "这些细节实现者应该知道" / "Implementers should know these details" | 不同开发者有不同的理解和习惯,细节缺失会导致实现差异 / Different developers have different understandings and habits; missing details lead to implementation divergence | 将你认为"显而易见"的细节都显式写入规格,特别是边界条件 / Explicitly write all "obvious" details into the specification, especially edge cases |
| 5 | "规格写得太长没人看" / "The spec is too long, no one will read it" | 过于简略的规格会导致频繁沟通,反而浪费更多时间 / Overly brief specs cause frequent communication and waste more time | 采用分层详略策略:概览+详细表格,让读者可按需深入 / Adopt a layered detail strategy: overview + detailed tables, allowing readers to drill down as needed |

**常见陷阱 / Common Traps**:
1. **"假 completeness"陷阱 / "Fake Completeness" Trap**: 看起来覆盖了所有章节但每章内容空洞 → 建立"章节质量检查":每章至少回答What/Who/How三个问题 / Appears to cover all sections but each section is empty → Establish "section quality check": each section must answer at least What/Who/How questions
2. **"主观验收"陷阱 / "Subjective Acceptance" Trap**: 使用无法客观验证的描述作为验收标准 → 强制要求每条标准可通过自动化测试或明确步骤验证 / Uses unverifiable descriptions as acceptance criteria → Require every criterion to be verifiable via automated tests or explicit steps
3. **"后端偏见"陷阱 / "Backend Bias" Trap**: 规格只关注后端实现而忽略前端需求 → 强制要求规格包含"前端适配"章节,明确Vue组件需要的数据结构 / Spec focuses only on backend implementation while ignoring frontend requirements → Require spec to include "Frontend Adaptation" section with data structures needed by Vue components
4. **"快照思维"陷阱 / "Snapshot Thinking" Trap**: 将规格视为静态文档而不考虑变更管理 → 在规格模板中内置CHANGELOG区域,鼓励记录变更历史 / Treats spec as a static document without considering change management → Build CHANGELOG area into spec template to encourage recording change history

### 🇺🇸

| # | Trap / 陷阱 | Question | Action |
|---|------------|----------|--------|
| 1 | "This API is simple, just write the path" / 这个接口很简单,写个路径就行了 | Even simple APIs need clear parameter definitions, otherwise implementers will guess / 简单的接口也需要明确的参数定义,否则实现者会自行猜测 | Even the simplest CRUD APIs must have complete request/response structure defined / 即使是最简单的CRUD接口也必须定义完整的请求/响应结构 |
| 2 | "Acceptance criteria is good enough, it will be tested later anyway" / 验收标准差不多就行,反正后面会测 | Vague acceptance criteria leads to disputes during acceptance and makes objective judgment impossible / 模糊的验收标准会导致验收阶段扯皮,且无法客观判断是否通过 | Every criterion must be quantified or provide a clear determination method / 每条标准都必须量化或提供明确的判定方法 |
| 3 | "Let's do frontend later, finish backend first" / 前端后面再对吧,先完成后端 | Frontend-backend inconsistency is the most common problem in integration phase / 前后端不一致是集成阶段最常见的问题 | Frontend and backend must be considered together during spec generation to ensure bidirectional applicability / 规格生成时就必须同步考虑前后端,确保接口定义的双向适用性 |
| 4 | "Implementers should know these details" / 这些细节实现者应该知道 | Different developers have different understandings and habits; missing details lead to implementation divergence / 不同开发者有不同的理解和习惯,细节缺失会导致实现差异 | Explicitly write all "obvious" details into the specification, especially edge cases / 将你认为"显而易见"的细节都显式写入规格,特别是边界条件 |
| 5 | "The spec is too long, no one will read it" / 规格写得太长没人看 | Overly brief specs cause frequent communication and waste more time / 过于简略的规格会导致频繁沟通,反而浪费更多时间 | Adopt a layered detail strategy: overview + detailed tables, allowing readers to drill down as needed / 采用分层详略策略:概览+详细表格,让读者可按需深入 |

**Common Traps / 常见陷阱**:
1. **"Fake Completeness" Trap / "假 completeness"陷阱**: Appears to cover all sections but each section is empty → Establish "section quality check": each section must answer at least What/Who/How questions / 看起来覆盖了所有章节但每章内容空洞 → 建立"章节质量检查":每章至少回答What/Who/How三个问题
2. **"Subjective Acceptance" Trap / "主观验收"陷阱**: Uses unverifiable descriptions as acceptance criteria → Require every criterion to be verifiable via automated tests or explicit steps / 使用无法客观验证的描述作为验收标准 → 强制要求每条标准可通过自动化测试或明确步骤验证
3. **"Backend Bias" Trap / "后端偏见"陷阱**: Spec focuses only on backend implementation while ignoring frontend requirements → Require spec to include "Frontend Adaptation" section with data structures needed by Vue components / 规格只关注后端实现而忽略前端需求 → 强制要求规格包含"前端适配"章节,明确Vue组件需要的数据结构
4. **"Snapshot Thinking" Trap / "快照思维"陷阱**: Treats spec as a static document without considering change management → Build CHANGELOG area into spec template to encourage recording change history / 将规格视为静态文档而不考虑变更管理 → 在规格模板中内置CHANGELOG区域,鼓励记录变更历史

---

## Red Flags / 红旗警告

### Layer 1: 输入检查 / Input Validation Guards

- **INPUT-GS-001**: 功能点矩阵为空或缺少功能点详情 → 🔴 CRITICAL → 终止并提示先完成功能点提取 / Feature matrix is empty or missing feature point details → 🔴 CRITICAL → Terminate and prompt to complete feature extraction first
- **INPUT-GS-002**: 业务分析报告缺少用例或状态定义 → 🔴 CRITICAL → 提示补充完整的业务分析后再生成规格 / Business analysis report is missing use cases or state definitions → 🔴 CRITICAL → Prompt to supplement complete business analysis before generating specs
- **INPUT-GS-003**: 功能点的复杂度标记(P0/P1/P2)与实际描述不符 → 🟡 WARN → 记录并在规格中标注可能的复杂度评估偏差 / Feature point complexity marking (P0/P1/P2) does not match actual description → 🟡 WARN → Record and flag possible complexity assessment deviation in spec

### Layer 2: 执行检查 / Execution Validation Guards

- **EXEC-GS-001**: 接口定义缺少请求参数或响应结构的详细说明 → 🔴 CRITICAL → 补充完整的接口定义 / API definition is missing detailed request parameters or response structure → 🔴 CRITICAL → Supplement complete API definition
- **EXEC-GS-002**: 数据模型缺少审计字段(create_time等)或主键定义 → 🔴 CRITICAL → 补充标准的审计字段和主键 / Data model is missing audit fields (create_time, etc.) or primary key definition → 🔴 CRITICAL → Supplement standard audit fields and primary key
- **EXEC-GS-003**: 验收标准存在无法客观验证的条目 → 🟡 WARN → 重写为可量化的或可明确判定的标准 / Acceptance criteria contains items that cannot be objectively verified → 🟡 WARN → Rewrite as quantifiable or clearly determinable criteria
- **EXEC-GS-004**: 规格中的业务规则与业务分析报告矛盾 → 🔴 CRITICAL → 以业务分析为准修正规格或记录冲突并请用户确认 / Business rules in spec contradict business analysis report → 🔴 CRITICAL → Correct spec based on business analysis or record conflict and ask user for confirmation

### Layer 3: 输出检查 / Output Validation Guards

- **OUTPUT-GS-001**: spec.md缺少必要的章节(接口定义/数据模型/业务逻辑) → 🔴 CRITICAL → 补充缺失的章节 / spec.md is missing required sections (API definition/data model/business logic) → 🔴 CRITICAL → Supplement missing sections
- **OUTPUT-GS-002**: checklist.md的验收标准少于5条或明显不足以覆盖主要功能 → 🔴 CRITICAL → 补充更完善的验收标准 / checklist.md has fewer than 5 acceptance criteria or is clearly insufficient to cover main functionality → 🔴 CRITICAL → Supplement more comprehensive acceptance criteria
- **OUTPUT-GS-003**: 规格文件的保存路径不符合规范(不在dev-specs/FP-{序号}/下) → 🟡 WARN → 移动到正确的目录位置 / Spec file save path does not conform to standards (not under dev-specs/FP-{sequence}/) → 🟡 WARN → Move to correct directory location

### 触发Red Flag时的处理流程 / Red Flag Trigger Handling Process

🔴 CRITICAL → 立即停止,报告问题详情,等待指示 | 🟡 WARN → 记录警告到规格日志,尝试自动修复,在最终报告中标注 | 🔵 INFO → 记录信息,正常继续

🔴 CRITICAL → Stop immediately, report problem details, wait for instructions / 立即停止,报告问题详情,等待指示 | 🟡 WARN → Log warning to spec log, attempt auto-fix, annotate in final report / 记录警告到规格日志,尝试自动修复,在最终报告中标注 | 🔵 INFO → Log information, continue normally / 记录信息,正常继续
