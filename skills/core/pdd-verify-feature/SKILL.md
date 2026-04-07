---
name: pdd-verify-feature
description: 验证功能点实现是否符合开发规格和验收标准，采用三维验证模型（完整性、正确性、一致性）。当用户需要验证功能或检查实现时自动触发。支持中文触发：验证功能、功能验证、验收检查、PDD验证。
license: MIT
compatibility: 需要功能点代码和验收标准
metadata:
  author: "neuqik@hotmail.com"
  version: "4.1"
  parent: pdd-main
  triggers:
    - "验证功能" | "验收" | "/verify"
    - "功能点验收" | "checklist验证"
---

# PDD-Verify Feature - 功能点验证技能 / Feature Verification Skill

## 核心概念 / Core Concepts

### 🇨🇳

验证功能点实现是否符合开发规格和验收标准，确保交付质量。采用**三维验证模型**:

| 维度 | 定义 | 验证要点 |
|------|------|---------|
| **Completeness (完整性)** | 所有规格要求的功能是否都已实现 | 接口完整 | 字段齐全 | 业务规则覆盖 |
| **Correctness (正确性)** | 实现是否符合规格定义 | 接口逻辑正确 | 数据处理准确 | 业务规则正确 |
| **Coherence (一致性)** | 前后端、文档与代码是否一致 | 前后端接口一致 | 文档与代码一致 | 命名规范统一 |

### 问题分级

| 级别 | 符号 | 说明 | 处理方式 |
|------|------|------|---------|
| **Critical** | 🔴 | 必须修复，否则验收不通过 | 修复后重新验证 |
| **Warning** | 🟡 | 建议修复，不影响验收通过 | 记录，待后续处理 |
| **Suggestion** | 🔵 | 可选优化 | 记录，作为后续改进项 |

### 🇺🇸

Verify that feature implementation conforms to development specifications and acceptance criteria, ensuring delivery quality. Adopts a **Three-Dimensional Verification Model**:

| Dimension | Definition | Verification Points |
|-----------|------------|-------------------|
| **Completeness** | Are all specified features implemented? | Interface complete | Fields complete | Business rules covered |
| **Correctness** | Does implementation match specification? | Interface logic correct | Data processing accurate | Business rules correct |
| **Coherence** | Are frontend/backend, docs, and code consistent? | Frontend-backend interfaces consistent | Docs consistent with code | Naming conventions unified |

### Issue Classification

| Level | Symbol | Description | Action |
|-------|--------|-------------|--------|
| **Critical** | 🔴 | Must fix; otherwise acceptance fails | Re-verify after fix |
| **Warning** | 🟡 | Recommended fix; does not block acceptance | Log for follow-up |
| **Suggestion** | 🔵 | Optional optimization | Log as future improvement item |

## 验证流程 / Verification Process

### 🇨🇳

### Step 1: 收集验证材料

**代码文件**: 后端(Controller/Service/Mapper) | 前端(Vue组件/API接口) | 数据库脚本(SQL)

**规格文档**: spec.md(开发规格) | checklist.md(验收标准)

**其他**: 业务分析报告 | PRD文档

### Step 2: Completeness 验证 (完整性)

**接口完整性**: 对照规格逐一检查每个API是否已实现（路径/方法/参数/响应/错误码）

**字段完整性**: 对照数据模型检查每个字段是否已实现（类型/长度/必填/格式）

**业务规则覆盖**: 检查所有业务规则是否都有对应的校验逻辑

### Step 3: Correctness 验证 (正确性)

**接口逻辑正确性**: 检查请求处理流程是否符合规格描述的业务流程

**业务规则正确性**: 逐条验证每个业务规则的实现是否准确（边界条件/异常情况）

**数据处理正确性**: 验证数据转换/计算/持久化是否准确

### Step 4: Coherence 验证 (一致性)

**前后端一致性**: 对比接口定义（路径/字段名/数据类型/校验规则）

**文档代码一致性**: 对比规格文档与实际代码实现（接口路径/响应结构/命名）

**命名规范性**: 检查代码命名是否符合项目约定

### 🇺🇸

### Step 1: Gather Verification Materials

**Code Files**: Backend (Controller/Service/Mapper) | Frontend (Vue components/API interfaces) | Database scripts (SQL)

**Specification Documents**: spec.md (development specification) | checklist.md (acceptance criteria)

**Others**: Business analysis report | PRD documents

### Step 2: Completeness Verification

**Interface Completeness**: Check each API against specification for implementation (path/method/params/response/error codes)

**Field Completeness**: Check each field against data model for implementation (type/length/required/format)

**Business Rule Coverage**: Verify all business rules have corresponding validation logic

### Step 3: Correctness Verification

**Interface Logic Correctness**: Verify request handling flow matches specification-described business process

**Business Rule Correctness**: Validate each business rule implementation for accuracy (edge cases/exceptions)

**Data Processing Correctness**: Verify data transformation/computation/persistence accuracy

### Step 4: Coherence Verification

**Frontend-Backend Consistency**: Compare interface definitions (path/field names/data types/validation rules)

**Doc-Code Consistency**: Compare specification documents with actual code implementation (interface path/response structure/naming)

**Naming Convention Compliance**: Check if code naming follows project conventions

## 验证检查清单 / Verification Checklist

### 🇨🇳

### 接口验证
- [ ] 接口路径是否符合规格
- [ ] 请求方法是否正确
- [ ] 请求参数是否完整
- [ ] 响应结构是否符合规格
- [ ] 错误码是否正确

### 业务逻辑验证
- [ ] 状态转换是否正确
- [ ] 业务规则是否执行
- [ ] 校验逻辑是否完整
- [ ] 异常处理是否得当

### 数据验证
- [ ] 字段类型是否正确
- [ ] 字段长度是否足够
- [ ] 必填字段是否校验
- [ ] 数据格式是否正确

### 权限验证
- [ ] 是否有权限注解
- [ ] 数据权限是否配置
- [ ] 按钮权限是否控制

### 一致性验证
- [ ] 接口路径是否一致
- [ ] 字段名称是否一致
- [ ] 数据类型是否一致
- [ ] 校验规则是否一致

### 🇺🇸

### Interface Verification
- [ ] Interface path matches specification
- [ ] Request method is correct
- [ ] Request parameters are complete
- [ ] Response structure matches specification
- [ ] Error codes are correct

### Business Logic Verification
- [ ] State transitions are correct
- [ ] Business rules are executed
- [ ] Validation logic is complete
- [ ] Exception handling is appropriate

### Data Verification
- [ ] Field types are correct
- [ ] Field lengths are sufficient
- [ ] Required fields are validated
- [ ] Data formats are correct

### Permission Verification
- [ ] Permission annotations present
- [ ] Data permissions configured
- [ ] Button permissions controlled

### Consistency Verification
- [ ] Interface paths are consistent
- [ ] Field names are consistent
- [ ] Data types are consistent
- [ ] Validation rules are consistent

## 输出规范 / Output Specification

### 🇨🇳

### 验收报告模板

```markdown
# [功能点名称] 验收报告

## 基本信息
| 项目 | 内容 |
|------|------|
| 功能点ID | FP-xxx |
| 验收日期 | yyyy-MM-dd |
| 验收人 | AI/人工 |
| 验收结果 | 通过/不通过 |

## 三维度验证结果
### Completeness (完整性)
| 验证项 | 结果 | 问题数 |
|-------|------|-------|
| 接口完整性 | 🟢/🟡/🔴 | N |

### Correctness (正确性)
| 验证项 | 结果 | 问题数 |
|-------|------|-------|
| 接口逻辑 | 🟢/🟡/🔴 | N |

### Coherence (一致性)
| 验证项 | 结果 | 问题数 |
|-------|------|-------|
| 前后端一致 | 🟢/🟡/🔴 | N |

## 问题清单
### 🔴 Critical问题
| 序号 | 问题描述 | 位置 | 建议修复 |
|------|---------|------|---------|

### 🟡 Warning问题
| 序号 | 问题描述 | 位置 | 建议修复 |
|------|---------|------|---------|

## 验收结论
- [ ] **通过验收**: 所有Critical问题已修复
- [ ] **有条件通过**: Critical问题已记录，待修复
- [ ] **不通过验收**: 存在未修复的Critical问题

## 签名
| 角色 | 签名 | 日期 |
|------|------|------|
| AI验证 |  |  |
| 人工复核 |  |  |
```

### 🇺🇸

### Acceptance Report Template

```markdown
# [Feature Name] Acceptance Report

## Basic Information
| Item | Content |
|------|---------|
| Feature ID | FP-xxx |
| Acceptance Date | yyyy-MM-dd |
| Verifier | AI/Human |
| Result | Pass/Fail |

## Three-Dimension Verification Results
### Completeness
| Verification Item | Result | Issue Count |
|-------------------|--------|-------------|
| Interface Completeness | 🟢/🟡/🔴 | N |

### Correctness
| Verification Item | Result | Issue Count |
|-------------------|--------|-------------|
| Interface Logic | 🟢/🟡/🔴 | N |

### Coherence
| Verification Item | Result | Issue Count |
|-------------------|--------|-------------|
| Frontend-Backend Consistency | 🟢/🟡/🔴 | N |

## Issue List
### 🔴 Critical Issues
| # | Description | Location | Suggested Fix |
|---|-------------|----------|---------------|

### 🟡 Warning Issues
| # | Description | Location | Suggested Fix |
|---|-------------|----------|---------------|

## Acceptance Conclusion
- [ ] **Pass**: All Critical issues fixed
- [ ] **Conditional Pass**: Critical issues logged, pending fix
- [ ] **Fail**: Unfixed Critical issues exist

## Signatures
| Role | Signature | Date |
|------|-----------|------|
| AI Verification |  |  |
| Human Review |  |  |
```

## 验证启发式方法 / Verification Heuristics

### 🇨🇳

### 常见遗漏检查
- [ ] 分页参数处理 | [ ] 排序参数处理 | [ ] 导出功能 | [ ] 导入功能 | [ ] 批量操作

### 常见错误检查
- [ ] 空指针异常处理 | [ ] 数组越界检查 | [ ] 类型转换检查 | [ ] 日期格式检查 | [ ] 数字精度检查

### 降级处理策略
当无法完整验证时:
1. **代码审查降级**: 缺少测试→进行代码审查 | 缺少文档→参考现有代码
2. **部分验证**: 核心功能优先验证 | 非核心功能标记"待验证"
3. **记录未验证项**: 明确标记未验证内容 | 记录原因和风险

### 🇺🇸

### Common Omission Checks
- [ ] Pagination parameter handling | [ ] Sorting parameter handling | [ ] Export function | [ ] Import function | [ ] Batch operations

### Common Error Checks
- [ ] Null pointer exception handling | [ ] Array bounds checking | [ ] Type conversion checks | [ ] Date format checks | [ ] Numeric precision checks

### Degradation Strategies
When full verification is not possible:
1. **Code Review Fallback**: Missing tests → perform code review | Missing docs → reference existing code
2. **Partial Verification**: Prioritize core functionality verification | Mark non-core features as "pending verification"
3. **Log Unverified Items**: Clearly mark unverified content | Record reasons and risks

## Guardrails / Safety Guardrails

### 🇨🇳

**必须验证项**:
- [ ] 所有Critical问题必须修复
- [ ] 验收报告必须完整
- [ ] 三维度验证必须覆盖

**避免事项**:
- ❌ 跳过任何Critical问题
- ❌ 口头验收无文档记录
- ❌ 降级处理无风险说明

### 🇺🇸

**Mandatory Verification Items**:
- [ ] All Critical issues must be fixed
- [ ] Acceptance report must be complete
- [ ] Three-dimension verification must be covered

**Avoid**:
- ❌ Skip any Critical issues
- ❌ Verbal acceptance without documentation
- ❌ Degradation without risk explanation

## 与其他技能协作 / Collaboration with Other Skills

| 协作技能 | 协作方式 | 传入数据 | 期望输出 |
|---------|---------|---------|---------|
| **pdd-code-reviewer** | Sequential | 审查报告 | 问题列表 |
| **pdd-implement-feature** | Loop | 验收不通过 | 修复代码 |
| **pdd-main** | Sequential | 验收报告 | 最终交付确认 |

### 🇺🇸

| Collaborating Skill | Collaboration Mode | Input Data | Expected Output |
|---------------------|-------------------|------------|-----------------|
| **pdd-code-reviewer** | Sequential | Review report | Issue list |
| **pdd-implement-feature** | Loop | Acceptance failure | Fixed code |
| **pdd-main** | Sequential | Acceptance report | Final delivery confirmation |

## 断点续传与错误处理规范 / Checkpoint Resume & Error Handling Specification

### 🇨🇳

本Skill遵循PDD框架实施规范,详见 [pdd-framework-design.md 第9章](../docs/pdd-framework-design.md#9-pdd-实施规范)。

**断点续传**:
- **状态文件**: `.pdd-state.json`
- **触发方式**: 用户发出"继续执行"命令
- **状态内容**: 当前阶段/已完成功能点/待处理功能点

**错误处理**:
- **重试限制**: 同一功能点最多3次
- **超过限制**: 暂停流程,等待人工决策
- **失败记录**: 记录到 `dev-specs/FP-{模块}-{序号}/review-report.md`

**质量改进任务**:
- **处理时机**: 模块所有功能点完成后统一处理
- **输出文件**: `dev-specs/FP-{模块}-{序号}/improvement-tasks.md`

### 🇺🇸

This Skill follows PDD framework implementation standards. See [pdd-framework-design.md Chapter 9](../docs/pdd-framework-design.md#9-pdd-实施规范).

**Checkpoint Resume**:
- **State File**: `.pdd-state.json`
- **Trigger**: User issues "continue execution" command
- **State Content**: Current stage / Completed features / Pending features

**Error Handling**:
- **Retry Limit**: Maximum 3 times per feature point
- **Exceeding Limit**: Pause process, await human decision
- **Failure Log**: Record to `dev-specs/FP-{module}-{sequence}/review-report.md`

**Quality Improvement Tasks**:
- **Processing Timing**: Process uniformly after all feature points in module are complete
- **Output File**: `dev-specs/FP-{module}-{sequence}/improvement-tasks.md`

---

## Iron Law / Iron Laws

### 🇨🇳

1. **三维验证不可缺省**: 必须完整执行Completeness(完整性)、Correctness(正确性)、Coherence(一致性)三个维度的验证,不得因时间压力而跳过任一维度。
2. **Critical问题一票否决**: 只要存在一个未修复的Critical级别问题,就不能通过验收。不得因为"其他都没问题"而放行。
3. **证据驱动结论**: 每个验证结论都必须有明确的证据支撑(如:具体代码位置、规格引用章节、测试结果),不得给出模糊的"看起来没问题"式判断。
4. **不假设运行环境**: 验证基于静态代码分析和规格对照,不假设代码在特定环境下能正常运行。如果需要运行验证,必须明确说明环境依赖。
5. **验收报告必须可追溯**: 报告中的每个问题都必须精确到文件名、行号、规格引用,使开发者能直接定位和修复。

**违规示例**: ❌ 只检查接口完整性就标记通过(跳过Correctness和Coherence) | ❌ 存在Critical问题但认为"不影响主流程"而给予通过 | ❌ 写"业务逻辑基本正确"而不指出具体代码位置和规则 | ❌ 假设数据库连接配置好了而跳过数据访问层验证 | ❌ 问题清单只写"状态转换有问题"而不说明具体是哪个状态的哪个转换

**合规示例**: ✅ 输出三维验证矩阵,每个维度都有明确判定 | ✅ 发现Critical问题后直接判定为"不通过验收",并列出修复建议 | ✅ 每个问题都标注:TransferApplyServiceImpl.java:142 状态校验缺失,参考spec.md第4.3节 | ✅ 明确说明"数据访问层验证基于SQL语法分析,未执行实际数据库查询" | ✅ 问题描述精确:"申请提交接口缺少底价校验(TransferApplyController.java:68),违反规则BR-001"

### 🇺🇸

1. **Three-Dimensional Verification is Mandatory**: Must fully execute all three dimensions of verification — Completeness, Correctness, and Coherence. No dimension may be skipped due to time pressure.
2. **Critical Issues Have Veto Power**: A single unresolved Critical-level issue means acceptance cannot be granted. Do not grant a pass because "everything else looks fine."
3. **Evidence-Driven Conclusions**: Every verification conclusion must have clear evidence support (e.g., specific code locations, specification section references, test results). Never give vague "looks fine" judgments.
4. **Do Not Assume Runtime Environment**: Verification is based on static code analysis and specification comparison. Do not assume code runs correctly in any specific environment. If runtime verification is needed, explicitly state environment dependencies.
5. **Acceptance Reports Must Be Traceable**: Every issue in the report must be precise to filename, line number, and specification reference, enabling developers to directly locate and fix.

**Violation Examples**: ❌ Mark as pass after only checking interface completeness (skipping Correctness and Coherence) | ❌ Grant pass despite Critical issues claiming "doesn't affect main flow" | ❌ Write "business logic basically correct" without specifying code location and rules | ❌ Skip data access layer verification assuming database connection is configured | ❌ Issue list only says "state transition has problems" without specifying which state's which transition

**Compliance Examples**: ✅ Output three-dimension verification matrix with clear judgment for each dimension | ✅ Immediately judge as "acceptance failed" upon discovering Critical issues, list fix suggestions | ✅ Each issue annotated: TransferApplyServiceImpl.java:142 missing status validation, refer to spec.md Section 4.3 | ✅ Clearly state "data access layer verification based on SQL syntax analysis, actual database queries not executed" | ✅ Issue description precise: "Submit application interface missing floor price validation (TransferApplyController.java:68), violates rule BR-001"

---

## Rationalization Table / Rationalization Table

| # | Trap / 陷阱 | Question / 请问自己 | Action / 应该怎么做 |
|---|-------------|-------------------|---------------------|
| 1 | "这个Critical问题影响不大,算了吧" / "This Critical issue isn't that big a deal, let it go" | Critical的定义就是"必须修复",放宽标准会导致缺陷流入生产 / Critical means "must fix"; relaxing standards lets defects into production | 维持Critical的一票否决权,任何Critical问题都必须修复后重新验证 / Maintain Critical's veto power; any Critical issue must be fixed and re-verified |
| 2 | "代码看起来没问题,应该对的" / "Code looks fine, should be correct" | 视觉检查会遗漏大量细节问题,特别是逻辑错误 / Visual inspection misses many details, especially logic errors | 逐项对照checklist进行系统性验证,而非概览式检查 / Verify systematically against checklist item by item, not overview-style |
| 3 | "三维度太耗时,只验核心维度吧" / "Three dimensions take too long, just verify core ones" | 每个维度捕获不同类型的问题,跳过会导致特定类别缺陷漏检 / Each dimension catches different issues; skipping causes specific defect categories to be missed | 三维验证是最低要求,可以使用降级策略但不能完全跳过 / Three-dimension verification is minimum requirement; can use degradation but never skip entirely |
| 4 | "这个问题实现者肯定知道,不用写那么细" / "The implementer definitely knows this, no need to be so detailed" | 详细的问题是修复的直接依据,模糊描述会增加沟通成本 / Detailed issues are direct basis for fixes; vague descriptions increase communication cost | 每个问题都要包含:位置、现象、期望行为、实际行为、修复建议 / Every issue must include: location, phenomenon, expected behavior, actual behavior, fix suggestion |
| 5 | "差不多通过了,让code-reviewer再查一遍吧" / "It's mostly passing, let code-reviewer check again" | verify-feature是最终把关,不能寄希望于下游补救 / verify-feature is the final gate; cannot rely on downstream remediation | 坚守验收标准,不合格就是不合格 / Hold acceptance standards; unqualified means unqualified |

**常见陷阱** / **Common Traps**:
1. **"宽松验收"陷阱 / "Lenient Acceptance" Trap**: 为了赶进度或避免冲突而放宽验收标准 → 建立"验收红线":Critical数量>0则绝对不通过 / Relaxing standards to meet deadlines or avoid conflict → Establish "acceptance red line": absolutely fail if Critical count > 0
2. **"模糊报告"陷阱 / "Vague Report" Trap**: 问题描述笼统导致开发者无法定位 → 强制要求问题描述包含"五要素":文件、行号、现象、预期、实际 / Vague descriptions prevent developers from locating issues → Require "five elements" in every issue: file, line number, phenomenon, expected, actual
3. **"单维验证"陷阱 / "Single-Dimension Verification" Trap**: 只关注代码是否写完而忽略规格符合性和前后端一致性 → 使用三维验证检查清单强制覆盖全部维度 / Only checking if code is written while ignoring spec compliance and frontend-backend consistency → Use three-dimension verification checklist to force full coverage
4. **"乐观假设"陷阱 / "Optimistic Assumption" Trap**: 假设配置正确、依赖可用、环境就绪 → 明确标注验证前提和未验证项,不做隐含假设 / Assuming config is correct, dependencies available, environment ready → Clearly mark verification prerequisites and unverified items; make no implicit assumptions

---

## Red Flags / Red Flags

### Layer 1: 输入检查 / Input Validation Guards
- **INPUT-VER-001**: 代码文件不存在或目录为空 / Code files missing or directory empty → 🔴 CRITICAL → 终止并提示先完成代码实现 / Terminate and prompt to complete code implementation first
- **INPUT-VER-002**: spec.md或checklist.md缺失 / spec.md or checklist.md missing → 🔴 CRITICAL → 终止并提示无法进行规格对照验证 / Terminate and prompt that specification comparison verification cannot proceed
- **INPUT-VER-003**: 代码文件与规格的功能点ID不匹配 / Code file feature ID does not match specification → 🟡 WARN → 提示用户确认是否验证了正确的功能点 / Prompt user to confirm if verifying the correct feature point

### Layer 2: 执行检查 / Execution Validation Guards
- **EXEC-VER-001**: 跳过任一维度的验证(只做了Completeness没做Coherence) / Skipped any dimension of verification (e.g., did Completeness but not Coherence) → 🔴 CRITICAL → 补充完整的验证后再生成报告 / Complete full verification before generating report
- **EXEC-VER-002**: 存在Critical问题但仍判定为通过 / Critical issues exist but still judged as pass → 🔴 CRITICAL → 修正判定结果为"不通过" / Correct judgment result to "fail"
- **EXEC-VER-003**: 验收报告中存在无法追溯到具体代码或规格的问题描述 / Acceptance report contains issues not traceable to specific code or specification → 🟡 WARN → 补充具体的证据引用 / Add specific evidence references
- **EXEC-VER-004**: 前后端接口对比发现不一致但未记录 / Frontend-backend interface comparison found inconsistencies but not recorded → 🔴 CRITICAL → 将所有不一致项记入问题清单 / Record all inconsistent items in issue list

### Layer 3: 输出检查 / Output Validation Guards
- **OUTPUT-VER-001**: 验收报告缺少三维验证结果汇总 / Acceptance report missing three-dimension verification summary → 🔴 CRITICAL → 补充完整性、正确性、一致性三个维度的验证结论 / Add verification conclusions for Completeness, Correctness, and Coherence dimensions
- **OUTPUT-VER-002**: 验收结论为"通过"但问题列表中存在Critical问题 / Acceptance conclusion is "pass" but Critical issues exist in issue list → 🔴 CRITICAL → 修正结论或补充修复说明 / Correct conclusion or add fix explanation
- **OUTPUT-VER-003**: 报告中缺少签名确认区域(AI验证+人工复核) / Report missing signature confirmation area (AI verification + human review) → 🟡 WARN → 补充签名字段 / Add signature fields

### 触发Red Flag时的处理流程 / Red Flag Trigger Handling
🔴 CRITICAL → 立即停止,报告问题详情,等待指示 / Immediately stop, report problem details, await instructions | 🟡 WARN → 记录警告到验证日志,尝试自动修复,在最终报告中标注 / Log warning to verification log, attempt auto-fix, annotate in final report | 🔵 INFO → 记录信息,正常继续 / Log information, continue normally
