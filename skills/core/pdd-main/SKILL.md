---
name: pdd-main
description: Main entry Skill for PRD-Driven Development orchestrating the entire workflow from PRD to deployment. Invoke when developing features based on PRD documents. 支持中文触发：PRD驱动开发、PDD开发、功能开发、启动PDD。
license: MIT
compatibility: Requires complete PRD document system
metadata:
  author: neuqik@hotmail.com
  version: "3.4"
---

# PDD Main / PDD主入口 - PRD-Driven Development Orchestrator

**Core Concept / 核心概念**: PDD (PRD-Driven Development) is a development methodology integrating domain expert capabilities. By orchestrating system-architect, software-architect, software-engineer and expert-xxx skills, it achieves full-lifecycle intelligent coverage from requirement analysis to final delivery.
PDD (PRD驱动开发) 是一种结合领域专家能力的开发方法论。通过集成 system-architect、software-architect、software-engineer 和 expert-xxx 技能，实现从需求分析到最终交付的全流程智能覆盖。

**Input**: PRD文档目录路径 | Bug描述 | **Output**: 完成的功能代码和验证报告 | 变更发布单

## 双模式架构 / Dual-Mode Architecture

### 🇨🇳 开发模式 vs 维护模式

pdd-main 支持两种工作模式，根据用户输入自动路由：

| 模式 | 触发条件 | 流程 | 输出 |
|------|---------|------|------|
| **开发模式** | 用户提供 PRD 文档、模块编号、“开发功能” | 完整六阶段流水线（BA→提取→规格→实现→审查→验证） | 代码文件 + 验证报告 |
| **维护模式** | 用户描述 Bug、报错、“改一下”、“显示不对” | 委托 expert-bug-fixer（定位→影响分析→精准修复→变更发布单） | 修复代码 + 变更发布单 |

**路由规则**:
- 包含以下关键词时进入**维护模式**: “修复Bug”、“线上问题”、“改一下”、“不对”、“报错”、“显示异常”、“404”、“数据不对”
- 其他情况进入**开发模式**

### 🇺🇸 Development Mode vs Maintenance Mode

pdd-main supports two operational modes, auto-routing based on user input:

| Mode | Trigger | Workflow | Output |
|------|---------|----------|--------|
| **Development Mode** | User provides PRD docs, module number, "develop feature" | Full six-phase pipeline (BA→Extract→Spec→Implement→Review→Verify) | Code files + Verification report |
| **Maintenance Mode** | User describes bug, error, "fix this", "not working" | Delegate to expert-bug-fixer (Locate→Impact Analysis→Precise Fix→Release Patch) | Fix code + Release Patch Document |

**Routing Rules**:
- Enter **Maintenance Mode** when keywords detected: "fix bug", "production issue", "fix this", "not working", "error", "display anomaly", "404", "data mismatch"
- Enter **Autonomous Mode** when user issues: "/auto-fix", "/自治修复", or when pdd-main detects a chain of related bugs
- All other cases enter **Development Mode**

### 🇨🇳 自治模式（实验性）

自治模式是维护模式的完全自动化扩展，实现“发现Bug → 分析根因 → 生成补丁 → 自检模式库 → 生成发布单”的闭环。

**自治流程**:
1. **触发**: 用户输入 Bug 描述，或从项目测试报告中自动提取 Bug 列表
2. **分析**: 调用 `pdd deps impact` 和 `pdd contract` 建立影响图
3. **修复**: 委托 `expert-bug-fixer` 执行四步 SOP（影响声明自动确认）
4. **验证**: 自动触发 `pdd-verify-feature` 回归验证
5. **输出**: 生成合并的变更发布单 + 回归验证报告
6. **安全护栏**: 如果回归验证发现 Critical 问题，**立即停止并报告**，等待人工介入

> ⚠️ **安全约束**: 自治模式必须在每个关键节点检查 Red Flag。如果修复涉及 5 个以上文件或触发任何 CRITICAL Red Flag，必须退出自治模式，切换为人工维护模式。

### 🇺🇸 Autonomous Mode (Experimental)

Autonomous mode is a fully automated extension of Maintenance Mode, implementing a closed loop: "Discover Bug → Analyze Root Cause → Generate Patch → Self-Check Pattern Library → Generate Release Patch".

**Autonomous Flow**:
1. **Trigger**: User inputs bug description, or auto-extract bug list from project test report
2. **Analyze**: Invoke `pdd deps impact` and `pdd contract` to build impact graph
3. **Fix**: Delegate to `expert-bug-fixer` for four-step SOP (auto-confirm impact declaration)
4. **Verify**: Auto-trigger `pdd-verify-feature` for regression verification
5. **Output**: Generate merged Release Patch Document + Regression Verification Report
6. **Safety Rail**: If regression discovers Critical issues, **immediately stop and report**, await human intervention

> ⚠️ **Safety Constraint**: Autonomous mode must check Red Flags at every critical node. If fix involves 5+ files or triggers any CRITICAL Red Flag, must exit autonomous mode and switch to manual maintenance mode.

## 方法论架构 / Methodology Architecture

### 🇨🇳 PDD技能体系（三层架构）

**主入口层 (pdd-main)**: 流程编排 | 状态管理 | 上下文传递 | 结果聚合 → 不直接实现代码

**PDD流程层**: 业务分析(pdd-ba) → 功能提取(pdd-extract) → 规格生成(pdd-generate) → 代码实现(pdd-implement) → 代码审查(pdd-reviewer) → 功能验证(pdd-verify)

**专业支持层**:
- 架构师: system-architect(系统架构/技术选型) | software-architect(软件架构/模块划分)
- 工程师: software-engineer(代码实现/测试编写)
- 专家: expert-ruoyi(RuoYi框架) | expert-activiti(工作流) | expert-mysql(MySQL优化) | expert-code-quality(代码质量) | **expert-bug-fixer(Bug修复/维护模式)** | expert-springcloud(微服务) | expert-vue3(Vue3前端)

**工具支持层** (新增):
- 依赖链引擎: `pdd deps scan/impact/orphans`（前后端文件关系索引）
- 契约发现: `pdd contract`（AST级前后端契约分析）

### 🇺🇸 PDD Skill System (Three-Layer Architecture)

**Orchestrator Layer (pdd-main)**: Workflow orchestration | State management | Context passing | Result aggregation → Never implements code directly

**PDD Process Layer**: Business Analysis(pdd-ba) → Feature Extraction(pdd-extract) → Spec Generation(pdd-generate) → Code Implementation(pdd-implement) → Code Review(pdd-reviewer) → Feature Verification(pdd-verify)

**Professional Support Layer**:
- Architects: system-architect(system architecture/tech selection) | software-architect(software architecture/module design)
- Engineers: software-engineer(code implementation/test writing)
- Experts: expert-ruoyi(RuoYi framework) | expert-activiti(workflow) | expert-mysql(MySQL optimization) | expert-code-quality(code quality) | **expert-bug-fixer(Bug fix/Maintenance mode)** | expert-springcloud(Microservices) | expert-vue3(Vue3 frontend)

**Tool Support Layer** (New):
- Dependency Chain: `pdd deps scan/impact/orphans` (frontend-backend file relationship indexing)
- Contract Discovery: `pdd contract` (AST-level frontend-backend contract analysis)

## 完整流程（六阶段） / Complete Workflow (Six Phases)

### 🇨🇳
### Phase 1: 业务分析与功能提取
PRD文档 → 5W1H分析 → 用例图 → 流程图 → 状态图 → 功能矩阵

### Phase 2: 开发规格生成
功能矩阵 → 架构咨询(按需) → 接口设计 → 数据模型 → 开发规格 + 验收标准

### Phase 3: 功能循环实现
对每个功能(P0→P1→P2): 实现 → 审查 → 修复 → 验收

### Phase 3.5: MVP分层交付策略（推荐）

**核心理念**: 不要等所有功能点全部完成才交付，而是按MVP层级递进交付，每层都可独立运行和验证。

**三层MVP模型**:

| 层级 | 内容 | 交付标准 | 典型耗时 |
|------|------|---------|---------|
| **MVP-1 骨架层** | 数据模型+基础CRUD接口+种子数据 | 后端API可调通、Swagger可访问、种子数据可查询 | 1-2小时 |
| **MVP-2 功能层** | 业务逻辑+状态流转+表单校验 | 核心业务流程可走通、异常处理完整 | 2-4小时 |
| **MVP-3 体验层** | UX优化+权限控制+Options API+样式打磨 | 前后端联调完成、权限生效、UI一致 | 2-3小时 |

**MVP-1 骨架层实现清单**:
- [ ] Model定义(含审计字段、BaseAuditModel继承)
- [ ] Schema定义(含OptionSchema、ResponseSchema)
- [ ] 基础CRUD API(含/options端点)
- [ ] 路由注册(/options在/{id}之前)
- [ ] 种子数据SQL
- [ ] 微验证通过(后端启动+API可达)

**MVP-2 功能层实现清单**:
- [ ] 业务逻辑Service实现
- [ ] 状态流转/审批流程
- [ ] 参数校验(@Validated/@Xss)
- [ ] 异常处理(try-catch+safeAlert)
- [ ] 微验证通过(Schema序列化+业务流程)

**MVP-3 体验层实现清单**:
- [ ] 前端页面(列表/表单/详情)
- [ ] Options API下拉数据加载
- [ ] 权限控制(@PreAuthorize/v-hasPermi)
- [ ] CSS布局(global-reset.css基线)
- [ ] 微验证通过(前端编译+联调)

**交付节奏**: 每完成一个MVP层级，向用户展示成果并获取反馈，再进入下一层级。避免"黑盒开发"导致的返工。

### Phase 4: 架构审查集成
按需调用 system-architect / software-architect

### Phase 5: 专家技能集成
按需调用 expert-xxx

### Phase 6: 交付与复盘
开发报告 → 文档归档 → 经验总结

### 🇺🇸
### Phase 1: Business Analysis & Feature Extraction
PRD documents → 5W1H analysis → Use case diagrams → Flowcharts → State diagrams → Feature matrix

### Phase 2: Development Spec Generation
Feature matrix → Architecture consultation(as needed) → API design → Data model → Development spec + Acceptance criteria

### Phase 3: Feature Loop Implementation
For each feature (by priority P0→P1→P2): Implement → Review → Fix → Verify

### Phase 3.5: MVP Layered Delivery Strategy (Recommended)

**Core Concept**: Don't wait for all feature points to be complete before delivering. Instead, deliver incrementally by MVP layers, where each layer can run and be verified independently.

**Three-Layer MVP Model**:

| Layer | Content | Delivery Standard | Typical Time |
|-------|---------|-------------------|--------------|
| **MVP-1 Skeleton** | Data models + Basic CRUD APIs + Seed data | Backend APIs callable, Swagger accessible, seed data queryable | 1-2 hours |
| **MVP-2 Functionality** | Business logic + State transitions + Form validation | Core business flow works, exception handling complete | 2-4 hours |
| **MVP-3 Experience** | UX polish + Permission control + Options API + Style refinement | Frontend-backend integration complete, permissions working, UI consistent | 2-3 hours |

**MVP-1 Skeleton Implementation Checklist**:
- [ ] Model definition (with audit fields, BaseAuditModel inheritance)
- [ ] Schema definition (with OptionSchema, ResponseSchema)
- [ ] Basic CRUD API (with /options endpoint)
- [ ] Route registration (/options before /{id})
- [ ] Seed data SQL
- [ ] Micro-verification passed (backend startup + API reachable)

**MVP-2 Functionality Implementation Checklist**:
- [ ] Business logic Service implementation
- [ ] State transitions / approval workflows
- [ ] Parameter validation (@Validated/@Xss)
- [ ] Exception handling (try-catch + safeAlert)
- [ ] Micro-verification passed (Schema serialization + business flow)

**MVP-3 Experience Implementation Checklist**:
- [ ] Frontend pages (list/form/detail)
- [ ] Options API dropdown data loading
- [ ] Permission control (@PreAuthorize/v-hasPermi)
- [ ] CSS layout (global-reset.css baseline)
- [ ] Micro-verification passed (frontend compilation + integration)

**Delivery Rhythm**: After completing each MVP layer, present results to the user and get feedback before proceeding to the next layer. Avoid "black box development" that leads to rework.

### Phase 4: Architecture Review Integration
On-demand invocation of system-architect / software-architect

### Phase 5: Expert Skill Integration
On-demand invocation of expert-xxx skills

### Phase 6: Delivery & Retrospective
Development report → Document archival → Lessons learned

## 详细步骤 / Detailed Steps

### 🇨🇳
### Step 1: 解析输入与发现PRD文档

**两种输入模式**:

**Mode A: 模块编号自动发现**
- 用户输入模块编号(如 `ZCCZ-2`)
- 自动扫描 `docs/business-analysis/` 目录匹配目录名(如 `ZCCZ-2-Asset-Transfer`)
- 自动聚合该目录下所有设计文档

**Mode B: 手动指定文档**
- 用户直接指定一个或多个设计文档路径
- 支持单文件/多文件(逗号或换行分隔)/目录路径(自动发现所有.md文档)

**标准PRD文档结构**: `docs/business-analysis/{business-domain}/` 下包含:
PRD-{module-name}.md | UseCase-{module-name}.md | BusinessFlow-{module-name}.md | StateDiagram-{module-name}.md | SequenceDiagram-{module-name}.md(可选) | FormDesign/(可选)

### Step 2-3: 确认模块信息与技术栈

从PRD提取模块编号和名称 | 分析项目技术栈确定技能调用策略:
- RuoYi框架项目 → software-engineer + expert-ruoyi
- 工作流项目 → expert-activiti
- 数据库密集型 → expert-mysql
- 架构设计阶段 → system-architect / software-architect

### Step 4-6: 业务分析 → 功能提取 → 人工审核

调用 `pdd-ba`(输出业务分析报告,使用5W1H/MECE/CRUD方法论) → 调用 `pdd-extract-features`(输出feature-matrix.md) → **等待用户审核**功能点矩阵的完整性/复杂度评估/测试策略/AI角色分配

### Step 7-8: 规格生成 → 人工审核

调用 `pdd-generate-spec`(输入功能矩阵,输出spec.md和checklist.md)

**架构咨询(按需)**: 调用 `system-architect`(技术选型/系统架构) 或 `software-architect`(模块划分/接口设计)

→ **等待用户审核**接口设计/数据模型/业务逻辑/测试用例

### Step 8.1: 生成代码目录结构

根据模块编号和功能自动生成符合标准的代码目录。

**⚠️ 重要原则**:
- **新业务功能应创建独立Maven模块**,不要放在 `asset-system` 中
- `asset-system` 是系统管理模块,只包含系统相关代码(用户/角色/菜单等)
- 业务模块命名规范: `asset-{business-domain}` (如 `asset-disposition`, `asset-equity`)

**模块编号→代码路径映射**:

| 模块编号 | 功能名称 | Maven模块 | 后端包路径 | 前端路径 |
|---------|---------|----------|-----------|---------|
| ZCCZ-1 | 股权转让 | asset-equity | com.example.equity.transfer | equity-transfer |
| ZCCZ-2 | 资产移交 | asset-equity | com.example.equity.transfer | asset-transfer |
| ZCCZ-3 | 企业增资 | asset-equity | com.example.equity.capital | capital-increase |
| ZCCZ-4 | 股权无偿划转 | asset-equity | com.example.equity.allocation | equity-allocation |
| ZCCZ-5 | 资产租赁 | asset-lease | com.example.lease | asset-lease |
| ZCCZ-6 | 企业担保 | asset-guarantee | com.example.guarantee | enterprise-guarantee |
| ZCCZ-7 | 固定资产处置 | asset-disposition | com.example.disposition | fixed-asset-scrap |

**后端模块目录结构**: `asset-{business-domain}/` (独立Maven模块)
```
├── pom.xml
└── src/main/java/com/example/{module}/
    ├── controller/     # Controllers
    ├── domain/         # Entity classes + vo/
    ├── mapper/         # Mapper interfaces
    ├── service/        # Service interfaces + impl/
    ├── constant/       # Constant classes
    └── util/           # Utility classes
└── src/main/resources/mapper/{module}/  # Mapper XML
```

**前端目录结构**:
```
asset-ui/src/api/{module}/{feature}.js    # API接口
asset-ui/src/views/{module}/              # 视图页面(camelCase)
    ├── index.vue   # 列表页
    ├── form.vue    # 表单页
    └── detail.vue  # 详情页
```

**现有模块复用规则**:
- asset-disposition: 资产处置类(固定资产处置/资产报废等,已存在)
- asset-equity: 股权交易类(股权转让/企业增资等,需创建)
- asset-admin: 系统管理(Controller入口/配置等)
- asset-system: 系统功能(用户/角色/菜单等,**不要放业务代码**)

**错误示例**: ❌ 将业务代码放入 asset-system | ✅ 创建独立的业务模块

### Step 9: 循环实现每个功能

对每个功能(按优先级P0→P1→P2):

**a. 功能实现**: 调用 `pdd-implement-feature`(输入开发规格+验收标准,输出代码文件)

**b. 工程师执行**: 调用 `software-engineer`(基于规格执行代码实现)

**c. 专家咨询(按需)**: RuoYi问题→expert-ruoyi | 数据库问题→expert-mysql | 代码质量问题→expert-code-quality

**d. 代码审查**: 调用 `pdd-code-reviewer`(输入代码+规格+验收标准,输出审查报告)

**e. 架构审查(按需)**: 发现架构问题→software-architect | 发现系统问题→system-architect

**f. 处理审查结果**: 无Critical问题→继续验收 | 有Critical问题→修复并重新审查

**g. 功能验证**: 调用 `pdd-verify-feature`(输入代码+验收标准,输出验收报告)

**h. 处理验收结果**: 通过→标记完成 | 有条件通过→修复问题并重新验证 | 未通过→重新开发

### Step 10: 输出开发报告

生成最终的开发报告

### 🇺🇸
### Step 1: Parse Input & Discover PRD Documents

**Two Input Modes**:

**Mode A: Module Number Auto-Discovery**
- User inputs module number (e.g., `ZCCZ-2`)
- Auto-scan `docs/business-analysis/` directory matching directory name (e.g., `ZCCZ-2-Asset-Transfer`)
- Auto-aggregate all design documents under that directory

**Mode B: Manual Document Specification**
- User specifies one or more design document paths directly
- Supports single file / multiple files (comma or newline separated) / directory path (auto-discover all .md files)

**Standard PRD Document Structure**: Under `docs/business-analysis/{business-domain}/`:
PRD-{module-name}.md | UseCase-{module-name}.md | BusinessFlow-{module-name}.md | StateDiagram-{module-name}.md | SequenceDiagram-{module-name}.md(optional) | FormDesign/(optional)

### Step 2-3: Confirm Module Info & Tech Stack

Extract module number and name from PRD | Analyze project tech stack to determine skill invocation strategy:
- RuoYi framework project → software-engineer + expert-ruoyi
- Workflow project → expert-activiti
- Database-intensive → expert-mysql
- Architecture design phase → system-architect / software-architect

### Step 4-6: Business Analysis → Feature Extraction → Human Review

Invoke `pdd-ba` (output business analysis report using 5W1H/MECE/CRUD methodology) → Invoke `pdd-extract-features` (output feature-matrix.md) → **Wait for user review** of feature matrix completeness/complexity assessment/test strategy/AI role assignment

### Step 7-8: Spec Generation → Human Review

Invoke `pdd-generate-spec` (input feature matrix, output spec.md and checklist.md)

**Architecture Consultation (as needed)**: Invoke `system-architect` (tech selection/system architecture) or `software-architect` (module design/API design)

→ **Wait for user review** of API design/data model/business logic/test cases

### Step 8.1: Generate Code Directory Structure

Auto-generate standard-compliant code directories based on module number and features.

**⚠️ Key Principles**:
- **New business features MUST create independent Maven modules**, do NOT place in `asset-system`
- `asset-system` is the system management module, containing only system-related code (users/roles/menus etc.)
- Business module naming convention: `asset-{business-domain}` (e.g., `asset-disposition`, `asset-equity`)

**Module Number → Code Path Mapping**:

| Module No. | Feature Name | Maven Module | Backend Package | Frontend Path |
|------------|-------------|--------------|-----------------|---------------|
| ZCCZ-1 | Equity Transfer | asset-equity | com.example.equity.transfer | equity-transfer |
| ZCCZ-2 | Asset Transfer | asset-equity | com.example.equity.transfer | asset-transfer |
| ZCCZ-3 | Capital Increase | asset-equity | com.example.equity.capital | capital-increase |
| ZCCZ-4 | Equity Allocation | asset-equity | com.example.equity.allocation | equity-allocation |
| ZCCZ-5 | Asset Lease | asset-lease | com.example.lease | asset-lease |
| ZCCZ-6 | Enterprise Guarantee | asset-guarantee | com.example.guarantee | enterprise-guarantee |
| ZCCZ-7 | Fixed Asset Disposal | asset-disposition | com.example.disposition | fixed-asset-scrap |

**Backend Module Directory Structure**: `asset-{business-domain}/` (independent Maven module)
```
├── pom.xml
└── src/main/java/com/example/{module}/
    ├── controller/     # Controllers
    ├── domain/         # Entity classes + vo/
    ├── mapper/         # Mapper interfaces
    ├── service/        # Service interfaces + impl/
    ├── constant/       # Constant classes
    └── util/           # Utility classes
└── src/main/resources/mapper/{module}/  # Mapper XML
```

**Frontend Directory Structure**:
```
asset-ui/src/api/{module}/{feature}.js    # API endpoints
asset-ui/src/views/{module}/              # View pages (camelCase)
    ├── index.vue   # List page
    ├── form.vue    # Form page
    └── detail.vue  # Detail page
```

**Existing Module Reuse Rules**:
- asset-disposition: Asset disposal class (fixed asset disposal/scrapping etc., exists)
- asset-equity: Equity transaction class (equity transfer/capital increase etc., to be created)
- asset-admin: System management (Controller entry/configs etc.)
- asset-system: System functions (users/roles/menus etc., **DO NOT put business code here**)

**Error Example**: ❌ Placing business code in asset-system | ✅ Create independent business module

### Step 9: Loop Implementation for Each Feature

For each feature (by priority P0→P1→P2):

**a. Feature Implementation**: Invoke `pdd-implement-feature` (input dev spec + acceptance criteria, output code files)

**b. Engineer Execution**: Invoke `software-engineer` (execute code implementation based on spec)

**c. Expert Consultation (as needed)**: RuoYi issues→expert-ruoyi | Database issues→expert-mysql | Code quality issues→expert-code-quality

**d. Code Review**: Invoke `pdd-code-reviewer` (input code + spec + acceptance criteria, output review report)

**e. Architecture Review (as needed)**: Architecture issues→software-architect | System issues→system-architect

**f. Handle Review Results**: No Critical issues→proceed to verification | Has Critical issues→fix and re-review

**g. Feature Verification**: Invoke `pdd-verify-feature` (input code + acceptance criteria, output verification report)

**h. Handle Verification Results**: Pass→mark complete | Conditional pass→fix issues and re-verify | Fail→re-develop

### Step 10: Output Development Report

Generate final development report

## AI协作模式 / AI Collaboration Mode

### 🇨🇳
根据功能复杂度自动选择AI角色:

| 复杂度 | AI角色 | 人工参与度 | 适用场景 |
|-------|--------|-----------|---------|
| P0 | 协作者+架构师+专家 | 高 | 核心业务流程/复杂状态转换 |
| P1 | 协作者+架构师 | 中 | 重要功能/中等复杂度 |
| P2 | 主导者+工程师 | 低 | 简单功能/辅助功能 |

### 复杂度与技能调用策略

**P0(核心业务)**: pdd-main + pdd-ba + pdd-generate-spec → 架构咨询(system-architect + software-architect) → pdd-implement-feature + software-engineer + expert-ruoyi/expert-mysql → pdd-code-reviewer + software-architect → pdd-verify-feature

**P1(重要功能)**: pdd-main + pdd-extract + pdd-generate-spec → 按需咨询software-architect → pdd-implement-feature + software-engineer + expert-xxx(按需) → pdd-code-reviewer → pdd-verify-feature

**P2(辅助功能)**: pdd-main + pdd-generate-spec → pdd-implement-feature + software-engineer(主导) → pdd-code-reviewer(简化版) → pdd-verify-feature

### 🇺🇸
Automatically select AI role based on feature complexity:

| Complexity | AI Role | Human Involvement | Use Case |
|------------|---------|-------------------|----------|
| P0 | Collaborator+Architect+Expert | High | Core business logic / complex state transitions |
| P1 | Collaborator+Architect | Medium | Important features / medium complexity |
| P2 | Leader+Engineer | Low | Simple features / auxiliary functions |

### Complexity & Skill Invocation Strategy

**P0 (Core Business)**: pdd-main + pdd-ba + pdd-generate-spec → Architecture consultation(system-architect + software-architect) → pdd-implement-feature + software-engineer + expert-ruoyi/expert-mysql → pdd-code-reviewer + software-architect → pdd-verify-feature

**P1 (Important Features)**: pdd-main + pdd-extract + pdd-generate-spec → On-demand software-architect consultation → pdd-implement-feature + software-engineer + expert-xxx(as needed) → pdd-code-reviewer → pdd-verify-feature

**P2 (Auxiliary Features)**: pdd-main + pdd-generate-spec → pdd-implement-feature + software-engineer(lead) → pdd-code-reviewer(simplified) → pdd-verify-feature

## 子技能列表 / Sub-Skill List

### 🇨🇳
| 技能名称 | 描述 | 输入 | 输出 | 触发时机 |
|---------|------|------|------|---------|
| **pdd-ba** | 业务分析,使用专业方法论进行需求推导 | PRD文档路径 | 业务分析报告 | 流程开始时 |
| **pdd-extract-features** | 从PRD中提取功能点矩阵 | PRD文档路径 | feature-matrix.md | 业务分析完成后 |
| **pdd-generate-spec** | 生成开发规格 | 功能点矩阵 | spec.md, checklist.md | 功能确认后 |
| **pdd-implement-feature** | 实现功能代码 | 开发规格 | 代码文件 | 规格确认后 |
| **pdd-code-reviewer** | 代码审查,验证实现符合规格 | 代码+规格 | 审查报告 | 代码实现后 |
| **pdd-verify-feature** | 验证功能实现 | 代码+验收标准 | 验收报告 | 代码审查后 |
| **pdd-doc-change** | 文档变更管理 | 变更需求 | 更新后的文档 | 需求变更时 |
| **system-architect** | 系统架构咨询 | 架构需求 | 架构方案 | 按需触发 |
| **software-architect** | 软件架构咨询 | 模块需求 | 模块设计 | 按需触发 |
| **software-engineer** | 代码实现和测试 | 规格文档 | 代码文件 | 实现阶段 |
| **expert-ruoyi** | RuoYi框架专家咨询 | 技术问题 | 解决方案 | 按需触发 |
| **expert-activiti** | Activiti工作流专家 | 流程问题 | 解决方案 | 按需触发 |
| **expert-mysql** | MySQL数据库专家 | SQL/结构问题 | 优化建议 | 按需触发 |
| **expert-code-quality** | 代码质量专家 | 代码片段 | 重构计划 | 按需触发 |

### 🇺🇸
| Skill Name | Description | Input | Output | Trigger Timing |
|------------|-------------|-------|--------|---------------|
| **pdd-ba** | Business analysis using professional methodology for requirement derivation | PRD document path | Business analysis report | At workflow start |
| **pdd-extract-features** | Extract feature matrix from PRD | PRD document path | feature-matrix.md | After business analysis |
| **pdd-generate-spec** | Generate development spec | Feature matrix | spec.md, checklist.md | After feature confirmation |
| **pdd-implement-feature** | Implement feature code | Development spec | Code files | After spec confirmation |
| **pdd-code-reviewer** | Code review verifying implementation matches spec | Code + spec | Review report | After code implementation |
| **pdd-verify-feature** | Verify feature implementation | Code + acceptance criteria | Verification report | After code review |
| **pdd-doc-change** | Document change management | Change request | Updated documents | On requirement change |
| **system-architect** | System architecture consultation | Architecture requirements | Architecture solution | On-demand trigger |
| **software-architect** | Software architecture consultation | Module requirements | Module design | On-demand trigger |
| **software-engineer** | Code implementation and testing | Spec document | Code files | Implementation phase |
| **expert-ruoyi** | RuoYi framework expert consultation | Technical issue | Solution | On-demand trigger |
| **expert-activiti** | Activiti workflow expert | Workflow issue | Solution | On-demand trigger |
| **expert-mysql** | MySQL database expert | SQL/structure issue | Optimization suggestion | On-demand trigger |
| **expert-code-quality** | Code quality expert | Code snippet | Refactoring plan | On-demand trigger |

## Guardrails / 安全护栏

### 🇨🇳
- 必须在提取功能前执行业务分析
- 必须等待人工审核功能点矩阵
- 必须等待人工审核开发规格
- 必须在代码实现后执行代码审查
- 每个功能必须通过验收才能标记为完成
- 代码变更后必须同步更新规格文档
- 问题必须记录到经验教训库
- **架构决策必须咨询架构师技能**
- **技术问题必须咨询专家技能**
- **专家建议必须集成到代码实现**

### 🇺🇸
- MUST execute business analysis before feature extraction
- MUST wait for human review of feature matrix
- MUST wait for human review of development spec
- MUST execute code review after code implementation
- Each feature MUST pass verification to be marked complete
- Spec documents MUST be updated synchronously after code changes
- Issues MUST be recorded in lessons-learned repository
- **Architecture decisions MUST involve architect skills**
- **Technical issues MUST involve expert skills**
- **Expert recommendations MUST be integrated into code implementation**

## 需求变更处理 / Requirement Change Handling

### 🇨🇳
当需求变更时: pdd-doc-change分析变更影响 → 更新相关规格文档 → 通知受影响的功能 → 若涉及架构变更则system-architect重新审查 | 若涉及技术方案变更则相关expert-xxx重新咨询 → 重新执行代码审查和验证

### 🇺🇸
On requirement change: pdd-doc-change analyzes change impact → Update relevant spec documents → Notify affected features → If architecture change involved, system-architect re-reviews | If technical approach change, relevant expert-xxx re-consults → Re-execute code review and verification

## PDD实现规范 / PDD Implementation Specification

### 🇨🇳
本技能遵循PDD框架实现规范,详见 [pdd-framework-design.md 第9章](../docs/pdd-framework-design.md#9-pdd-implementation-specification)。

### 核心规范摘要

| 规范 | 核心内容 |
|-----|---------|
| **技能边界** | pdd-code-reviewer(合规性) → expert-code-quality(质量深度),先审查后分析 |
| **上下文传递** | 文件系统传递,目录结构规范,支持断点续传 |
| **人工审核** | 批量审核+关键功能详细审核 |
| **错误处理** | Critical阻断,重试3次后暂停等待人工 |
| **PR管理** | 手动触发,变更粒度PR,手动归档 |
| **文档系统** | 9种核心文档类型,命名规范,文档内部变更历史 |

### 审查与质量分析协作流程

代码实现完成 → pdd-code-reviewer(合规性审查) → [有Critical问题]返回修复重新审查 → [无问题]expert-code-quality(质量深度分析) → 生成质量改进任务(improvement-tasks.md) → 进入下一阶段

### 断点续传

- **状态文件**: `.pdd-state.json`
- **触发方式**: 用户发出"继续执行"命令
- **状态内容**: 当前阶段/已完成功能/待处理功能

### 🇺🇸
This skill follows the PDD framework implementation specification, see [pdd-framework-design.md Chapter 9](../docs/pdd-framework-design.md#9-pdd-implementation-specification).

### Core Specification Summary

| Specification | Core Content |
|--------------|--------------|
| **Skill Boundaries** | pdd-code-reviewer(compliance) → expert-code-quality(quality depth), review before analysis |
| **Context Passing** | File system transfer, directory structure standards, breakpoint resume support |
| **Human Review** | Batch review + detailed review for critical features |
| **Error Handling** | Critical blocks, pause for human after 3 retries |
| **PR Management** | Manual trigger, change-granularity PR, manual archival |
| **Document System** | 9 core document types, naming conventions, internal document change history |

### Review & Quality Analysis Collaboration Flow

Code complete → pdd-code-reviewer(compliance review) → [Has Critical issues] return fix and re-review → [No issues] expert-code-quality(quality depth analysis) → Generate quality improvement tasks(improvement-tasks.md) → Proceed to next phase

### Breakpoint Resume

- **State file**: `.pdd-state.json`
- **Trigger method**: User issues "continue execution" command
- **State content**: Current stage / completed features / pending features

---

## Iron Law / 核心铁律

### 🇨🇳

1. **编排者不实现**: pdd-main只负责流程编排和状态管理,绝不直接编写业务代码。代码实现必须委托给 pdd-implement-feature 和 software-engineer。
2. **人工审核不可跳过**: 功能点矩阵确认、开发规格确认这两个关键节点必须等待人类伙伴明确确认后才能继续,不得自动通过。
3. **上下文完整性传递**: 每次调用子技能时,必须传递完整的上下文信息(包括已完成的阶段输出、当前状态、依赖关系),不得让子技能自行推断缺失信息。
4. **幂等性恢复保障**: 支持断点续传时,必须先读取 `.pdd-state.json` 恢复状态,而非从头开始;重复执行同一阶段不得产生重复产出物。
5. **架构决策专业化**: 涉及技术选型和系统架构的决策,必须调用 system-architect 或 software-architect,不得由 pdd-main 自行做出架构判断。

**违规示例**: ❌ 在pdd-main中直接生成Controller代码 | ❌ 跳过功能点矩阵的人工审核 | ❌ 调用子技能时不传递业务分析报告 | ❌ 用户说"继续"时忽略已有状态重新开始 | ❌ 自行决定使用Redis作为缓存方案而不咨询架构师

**合规示例**: ✅ 调用pdd-implement-feature并传递spec.md和checklist.md路径 | ✅ 生成规格后暂停并展示给用户确认 | ✅ 将完整的功能点矩阵传递给pdd-generate-spec | ✅ 读取.pdd-state.json后从断点恢复执行 | ✅ 需要选型时调用system-architect获取建议

### 🇺🇸

1. **Orchestrator Never Implements**: pdd-main only handles workflow orchestration and state management. It must NEVER directly write business code. Code implementation must be delegated to pdd-implement-feature and software-engineer.
2. **Human Review Cannot Be Skipped**: Feature matrix confirmation and development spec confirmation are critical gates that require explicit human approval before proceeding. Auto-approval is forbidden.
3. **Complete Context Passing**: Every sub-skill invocation must pass complete context (completed stage outputs, current state, dependencies). Sub-skills must not infer missing information.
4. **Idempotent Recovery**: On resume, always read `.pdd-state.json` to restore state rather than starting from scratch. Re-executing the same stage must not produce duplicate artifacts.
5. **Specialized Architecture Decisions**: Technology selection and system architecture decisions MUST involve system-architect or software-architect. pdd-main must never make architectural judgments independently.

**Violation Examples**: ❌ Generating Controller code in pdd-main | ❌ Skipping feature matrix human review | ❌ Calling sub-skills without passing business analysis report | ❌ Ignoring existing state when user says "continue" | ❌ Deciding on Redis as cache without consulting architect

**Compliance Examples**: ✅ Calling pdd-implement-feature with spec.md and checklist.md paths | ✅ Pausing after spec generation for user review | ✅ Passing complete feature matrix to pdd-generate-spec | ✅ Reading .pdd-state.json before resuming from breakpoint | ✅ Consulting system-architect for technology selection

---

## Rationalization Table / 合理化防御表

| # | Trap / 陷阱 | Question / 请问自己 | Action / 应该怎么做 |
|---|-------------|------------------|------------------|
| 1 | "用户急着要,跳过审核吧" | Skipping review may cause directional errors with higher rework cost later | Clearly communicate review importance to user, but offer batch review mode to speed up |
|   | "User is in a rush, skip the review" | | | 
| 2 | "这个功能简单,我自己写了吧" | Orchestrator's role is coordination; overstepping causes role confusion | Delegate to pdd-implement-feature + software-engineer |
|   | "This feature is simple, I'll code it myself" | | |
| 3 | "子技能应该能自己找到文档" | Sub-skills lack global context and may miss critical dependencies | Explicitly pass all necessary input file paths and context |
|   | "Sub-skill should find docs on its own" | | |
| 4 | "架构师太慢了,我先按常见做法做" | Architecture decisions have far-reaching impact; wrong choices cause massive refactoring | Must wait for architect's response before proceeding |
|   | "Architect is too slow, I'll use common patterns" | | |
| 5 | "上次成功了,这次也用同样的流程" | Each module has different tech stack and complexity | Re-evaluate skill combination based on module characteristics |
|   | "It worked last time, reuse the same flow" | |

**常见陷阱**:
1. **"流程自动化"陷阱**: 过度追求自动化而绕过必要的人工审核节点 → 强制在关键节点设置暂停点并要求显式确认
2. **"上下文压缩"陷阱**: 为了节省token而截断传递给子技能的上下文 → 建立最小必需上下文清单,确保完整传递
3. **"技能堆砌"陷阱**: 无论复杂度如何都调用全部技能 → 根据功能点的P0/P1/P2级别动态调整技能调用策略
4. **"状态丢失"陷阱**: 异常中断后未保存状态导致重复工作 → 每个阶段完成后立即持久化状态到 .pdd-state.json

---

## Red Flags / 三层防御体系

### Layer 1: Input Guards / 输入防护
- **INPUT-PDD-001**: PRD文档路径不存在或目录下无.md文件 → 🔴 CRITICAL → 终止并提示用户检查路径或文档完整性 / Terminate and prompt user to check path or document completeness
- **INPUT-PDD-002**: 模块编号格式不符合规范(如ZCCZ-1,ZCCZ-2) → 🟡 WARN → 提示用户确认模块编号,支持手动指定文档路径 / Prompt user to confirm module number, support manual document path specification
- **INPUT-PDD-003**: 缺少必要的参考文档(PRD文档是唯一必填项) → 🔴 CRITICAL → 提示用户至少提供PRD文档 / Prompt user to provide at least PRD document

### Layer 2: Execution Guards / 执行防护
- **EXEC-PDD-001**: 尝试在pdd-main中直接写入代码文件 → 🔴 CRITICAL → 阻止操作,提示应委托给实现类技能 / Block operation, delegate to implementation skill
- **EXEC-PDD-002**: 跳过功能点矩阵或开发规格的人工审核节点 → 🔴 CRITICAL → 强制暂停,展示待审核内容并等待确认 / Force pause, display pending content and wait for confirmation
- **EXEC-PDD-003**: 调用子技能时未传递完整的上下文参数 → 🟡 WARN → 记录警告,补充默认值后继续,并在报告中标注 / Log warning, fill defaults, note in report
- **EXEC-PDD-004**: 同一功能点被重复标记为完成 → 🟡 WARN → 检查状态文件是否损坏,提示用户确认 / Check state file integrity, prompt user

### Layer 3: Output Guards / 输出防护
- **OUTPUT-PDD-001**: 开发报告缺少已完成功能点列表或验收状态 → 🔴 CRITICAL → 补充完整信息后才能输出 / Supplement complete info before output
- **OUTPUT-PDD-002**: 状态文件.pdd-state.json格式异常或无法解析 → 🟡 WARN → 备份旧文件,重新初始化状态 / Backup old file, reinitialize state
- **OUTPUT-PDD-003**: 最终交付物缺少代码文件或验证报告 → 🔴 CRITICAL → 不标记为完成,继续补齐缺失项 / Don't mark complete, continue supplementing missing items

**Trigger Handling / 触发处理流程:**
🔴 CRITICAL → 立即停止,报告问题详情,等待指示 | Stop immediately & report details, wait for instructions
🟡 WARN → 记录警告到执行日志,继续执行,在最终报告中标注 | Log warning to execution log, continue, annotate in final report
🔵 INFO → 记录信息,正常继续 | Log info, continue normally
