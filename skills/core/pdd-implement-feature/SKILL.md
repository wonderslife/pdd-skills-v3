---
name: pdd-implement-feature
description: Implement feature point code based on development specifications. Call this Skill when users want to start coding implementation. 支持中文触发：实现功能点、编码实现、开始编码、功能开发、代码实现、PDD实现。
license: MIT
compatibility: Requires specification generation to be completed first
metadata:
  author: neuqik@hotmail.com
  version: "2.0"
  parent: pdd-main
---

# Feature Point Implementation - 基于开发规格的功能点实现 / Feature Point Code Implementation Based on Development Specifications

**输入**: spec.md(开发规格) | checklist.md(验收标准) | test-cases.md(测试用例,可选)
**Input**: spec.md (Development Spec) | checklist.md (Acceptance Criteria) | test-cases.md (Test Cases, Optional)

**输出**: 代码文件 | 验收报告
**Output**: Code Files | Acceptance Report

## 技能集成 / Skill Integration

### 🇨🇳 Software Engineer 调用

| 调用时机 | 服务内容 |
|---------|---------|
| 代码实现 | 基于规格执行代码实现 |
| 单元测试 | 编写单元测试和集成测试 |
| 代码重构 | 按编码规范优化代码 |
| 缺陷修复 | 错误处理和问题解决 |

### 🇺🇸 Software Engineer Invocation

| Trigger | Service |
|---------|---------|
| Code Implementation | Execute code implementation based on specifications |
| Unit Testing | Write unit tests and integration tests |
| Code Refactoring | Optimize code per coding standards |
| Defect Fixing | Error handling and issue resolution |

### 🇨🇳 Expert Skill 调用（按需）

| 专家技能 | 触发条件 | 期望输出 |
|---------|---------|---------|
| **expert-ruoyi** | 若依框架问题 | 解决方案+最佳实践 |
| **expert-activiti** | 工作流问题 | BPMN设计建议 |
| **expert-mysql** | 数据库问题 | SQL优化方案 |
| **expert-code-quality** | 代码质量问题 | 重构方案 |

### 🇺🇸 Expert Skill Invocation (On-Demand)

| Expert Skill | Trigger Condition | Expected Output |
|-------------|------------------|-----------------|
| **expert-ruoyi** | RuoYi framework issues | Solution + Best Practices |
| **expert-activiti** | Workflow issues | BPMN design recommendations |
| **expert-mysql** | Database issues | SQL optimization plan |
| **expert-code-quality** | Code quality issues | Refactoring plan |

## 流程步骤 / Process Steps

### 🇨🇳 Step 1: 读取开发规格
从 `dev-specs/FP-{序号}/spec.md` 读取: 接口定义 | 数据模型 | 业务逻辑 | 测试用例

### 🇺🇸 Step 1: Read Development Specification
Read from `dev-specs/FP-{sequence}/spec.md`: API Definitions | Data Models | Business Logic | Test Cases

### 🇨🇳 Step 2: 读取验收标准
从 `dev-specs/FP-{序号}/checklist.md` 读取验收项

### 🇺🇸 Step 2: Read Acceptance Criteria
Read acceptance items from `dev-specs/FP-{sequence}/checklist.md`

### 🇨🇳 Step 3: 确定实现顺序
依赖顺序: 数据模型→数据库脚本 → 后端接口(Controller/Service/Mapper) → 前端页面(Vue组件)

### 🇺🇸 Step 3: Determine Implementation Order
Dependency order: Data Model → Database Scripts → Backend APIs (Controller/Service/Mapper) → Frontend Pages (Vue Components)

### 🇨🇳 Step 4: 生成数据库脚本
基于数据模型生成SQL(含审计字段: create_time/update_time/create_by/update_by/del_flag/status)

### 🇺🇸 Step 4: Generate Database Scripts
Generate SQL based on data model (including audit fields: create_time/update_time/create_by/update_by/del_flag/status)

### 🇨🇳 Step 5: 生成后端代码（委托 software-engineer）
Domain实体类(@Data/@TableName) | Mapper接口(@Mapper/BaseMapper) | Service接口和实现(@Service/ServiceImpl) | Controller(@RestController/@RequestMapping)

### 🇺🇸 Step 5: Generate Backend Code (Delegate to software-engineer)
Domain Entity Classes (@Data/@TableName) | Mapper Interfaces (@Mapper/BaseMapper) | Service Interface & Implementation (@Service/ServiceImpl) | Controller (@RestController/@RequestMapping)

### 🇨🇳 Step 6: 生成前端代码（委托 software-engineer）
API接口(request封装) | Vue组件(template/script/data/methods)

### 🇺🇸 Step 6: Generate Frontend Code (Delegate to software-engineer)
API Interfaces (request wrapper) | Vue Components (template/script/data/methods)

### 🇨🇳 Step 7: 实现业务逻辑
处理流程 | 校验规则 | 状态转换 | 异常处理

**专家咨询(按需)**: RuoYi问题→expert-ruoyi | 数据库问题→expert-mysql

### 🇺🇸 Step 7: Implement Business Logic
Process Flow | Validation Rules | State Transitions | Exception Handling

**Expert Consultation (On-Demand)**: RuoYi Issues → expert-ruoyi | Database Issues → expert-mysql

### 🇨🇳 Step 8: 运行测试验证
单元测试 | 接口测试 | 集成测试

### 🇺🇸 Step 8: Run Test Verification
Unit Tests | API Tests | Integration Tests

### 🇨🇳 Step 9: 更新验收状态
更新checklist.md中的验收状态

### 🇺🇸 Step 9: Update Acceptance Status
Update acceptance status in checklist.md

### 🇨🇳 Step 10: 生成验收报告
输出: 业务验收 | 技术验收 | 问题日志 | 结论(通过/不通过)

### 🇺🇸 Step 10: Generate Acceptance Report
Output: Business Acceptance | Technical Acceptance | Issue Log | Conclusion (Pass/Fail)

## 代码标准 / Code Standards

### 🇨🇳 后端标准
类名PascalCase | 方法名camelCase | 常量UPPER_SNAKE_CASE | 注释Javadoc格式

### 🇺🇸 Backend Standards
Class names PascalCase | Method names camelCase | Constants UPPER_SNAKE_CASE | Comments in Javadoc format

### 🇨🇳 前端标准
组件名PascalCase | 方法名camelCase | CSS类名kebab-case | ES6+语法

### 🇺🇸 Frontend Standards
Component names PascalCase | Method names camelCase | CSS class names kebab-case | ES6+ syntax

### 🇨🇳 software-engineer 标准
先读现有代码风格再写新代码 | 错误处理优先 | 保持最小化 | PR-ready代码

### 🇺🇸 software-engineer Standards
Read existing code style before writing new code | Error handling first | Keep it minimal | PR-ready code

## PR管理提示（功能点完成后）/ PR Management Tips (After Feature Point Completion)

### 🇨🇳
完成并验证通过后，**提示**用户可手动调用PR管理技能:
- `/pdd-pr-create {change-id}` - 创建PR并执行自动审查
- `/pdd-pr-review {change-id}` - 查看PR审查结果
- `/pdd-pr-merge {change-id}` - 合并PR并归档

**重要**: PDD框架**不会自动调用** pdd-pr-* 技能，需用户**手动决定**是否使用PR管理功能。

### 🇺🇸
After completion and verification, **prompt** the user to manually invoke PR management skills:
- `/pdd-pr-create {change-id}` - Create PR and execute auto-review
- `/pdd-pr-review {change-id}` - View PR review results
- `/pdd-pr-merge {change-id}` - Merge PR and archive

**Important**: The PDD framework **will NOT automatically call** pdd-pr-* skills. Users must **manually decide** whether to use PR management features.

## 错误处理与回退规范 / Error Handling & Rollback Rules

### 🇨🇳 错误分级
Critical(必须修复,阻塞流程) | Warning(建议修复,非阻塞) | Suggestion(可选优化)

### 🇺🇸 Error Classification
Critical (Must fix, blocks process) | Warning (Recommended fix, non-blocking) | Suggestion (Optional optimization)

### 🇨🇳 重试策略
限制: 每个功能点最多3次 | 超限: 暂停流程,等待人工决策

### 🇺🇸 Retry Strategy
Limit: Max 3 retries per feature point | Exceeded: Pause process, await human decision

### 🇨🇳 回退规则
pdd-code-reviewer审查失败 → 返回pdd-implement-feature重新实现 | pdd-verify-feature验证失败 → 返回pdd-implement-feature重新验证

### 🇺🇸 Rollback Rules
pdd-code-reviewer review failed → Return to pdd-implement-feature for re-implementation | pdd-verify-feature verification failed → Return to pdd-implement-feature for re-verification

### 🇨🇳 失败记录
位置: `dev-specs/FP-{模块}-{序号}/review-report.md`
内容: 失败时间/阶段/原因/尝试次数/相关错误日志

### 🇺🇸 Failure Record
Location: `dev-specs/FP-{module}-{sequence}/review-report.md`
Content: Failure time / Stage / Reason / Attempt count / Related error logs

## Guardrails

### 🇨🇳
- 代码必须符合项目标准
- 必须实现规格中定义的所有接口
- 必须处理规格中定义的所有异常
- 必须通过所有验收项才能标记完成
- 代码变更后必须同步更新规格文档
- **遇到技术问题时必须咨询专家技能**
- **代码实现必须遵循software-engineer标准**
- **功能点完成后提示用户可用PR管理技能，但不自动调用**

### 🇺🇸
- Code must comply with project standards
- All interfaces defined in the specification must be implemented
- All exceptions defined in the specification must be handled
- Must pass all acceptance items before marking as complete
- Specification documents must be updated synchronously after code changes
- **Must consult expert skills when encountering technical issues**
- **Code implementation must follow software-engineer standards**
- **After feature point completion, prompt user about PR management skills but do not auto-invoke**

---

## Iron Law / 铁律

### 🇨🇳

1. **规格即法律**: 代码实现必须严格遵循spec.md的定义,不得擅自添加规格中未定义的功能,也不得遗漏规格要求的任何接口或字段。

2. **委托不替代**: 遇到框架特定问题时,必须调用对应的expert技能获取方案,不得凭猜测或通用知识硬编码。

3. **错误处理优先**: 业务逻辑实现前,必须先完成参数校验、异常处理、边界条件等防御性代码,不得只写"快乐路径"。

4. **代码标准对齐**: 生成的代码风格必须与项目现有代码保持一致,编写前先阅读同类模块的现有代码。

5. **验收驱动开发**: 每完成一个接口实现,立即对照checklist.md进行自检,不要等到全部写完再统一检查。

**违规示例**: ❌ 实现了规格中未定义的功能(功能蔓延) | ❌ 遇到若依权限注解问题时不调用expert-ruoyi | ❌ 只实现正常流程未处理异常情况 | ❌ 使用与项目不同的命名风格 | ❌ 写完所有代码后才运行发现编译错误

**合规示例**: ✅ 严格按照spec.md的接口列表逐个实现 | ✅ 遇到@PreAuthorize问题时调用expert-ruoyi | ✅ 每个Service方法开头进行参数校验 | ✅ 先阅读现有TransferApplyController保持相同风格 | ✅ 每完成一个Controller方法立即测试

### 🇺🇸

1. **Specification is Law**: Code implementation must strictly follow the definitions in spec.md. Do not arbitrarily add features not defined in the specification, nor omit any interfaces or fields required by the spec.

2. **Delegate, Don't Substitute**: When encountering framework-specific issues, you must invoke the corresponding expert skill to obtain a solution. Do not hard-code based on guesses or generic knowledge.

3. **Error Handling First**: Before implementing business logic, you must complete defensive code including parameter validation, exception handling, and boundary conditions. Do not only write the "happy path".

4. **Code Standard Alignment**: The generated code style must be consistent with the existing project code. Read the existing code of similar modules before writing new code.

5. **Acceptance-Driven Development**: After completing each interface implementation, immediately self-check against checklist.md. Do not wait until all code is written to perform a unified check.

**Violation Examples**: ❌ Implemented features not defined in the spec (feature creep) | ❌ Did not invoke expert-ruoyi when encountering RuoYi permission annotation issues | ❌ Only implemented normal flow without handling exceptions | ❌ Used naming conventions different from the project | ❌ Ran tests only after writing all code and discovered compilation errors

**Compliance Examples**: ✅ Implemented each interface one by one strictly following the spec.md interface list | ✅ Invoked expert-ruoyi when encountering @PreAuthorize issues | ✅ Performed parameter validation at the beginning of each Service method | ✅ Read existing TransferApplyController first to maintain consistent style | ✅ Tested immediately after completing each Controller method

---

## Rationalization Table / 理性化对照表

### 🇨🇳

| # | 你可能的想法 / Trap | 请问自己 / Question | 应该怎么做 / Action |
|---|-------------------|-------------------|-------------------|
| 1 | "这个功能用户可能需要,顺便加上吧" | 未在规格中的功能是范围蔓延,会导致验收失败 | 严格按规格实现,额外需求走正式变更流程 |
| 2 | "这个框架问题我以前遇到过" | 框架版本差异可能导致旧方案失效 | 直接调用对应expert技能获取经过验证的解决方案 |
| 3 | "异常处理后面统一加" | 异常处理后置往往意味着永远不会加 | 在写业务逻辑前先搭建好异常处理骨架 |
| 4 | "项目代码风格太乱了,我按我的习惯写吧" | 不一致的代码风格会增加维护负担 | 先阅读现有代码,适配项目既有风格 |
| 5 | "先全部写完再一起测试" | 大批量代码调试难度远高于增量验证 | 采用TDD思维:实现一个就验证一个 |

**常见陷阱**:
1. **"规格偏离"陷阱**: 实现过程中逐渐偏离规格要求 → 建立实现清单,每完成一项打勾并与规格对照
2. **"框架硬扛"陷阱**: 遇到框架问题反复尝试而不求助专家 → 设定"3次尝试规则",3次未解决必须调用expert
3. **"快乐路径"陷阱**: 只实现正常流程忽略异常处理 → 强制异常覆盖率:每个public方法必须有try-catch
4. **"风格割裂"陷阱**: 新代码与项目现有代码风格不一致 → 实现"先读后写"规则

### 🇺🇸

| # | You Might Think / Trap | Ask Yourself / Question | What To Do / Action |
|---|----------------------|----------------------|--------------------|
| 1 | "Users might need this feature, let me add it too" | Features not in the spec are scope creep and will cause acceptance failure | Implement strictly per spec; extra requirements go through formal change process |
| 2 | "I've encountered this framework issue before" | Framework version differences may render old solutions invalid | Invoke the corresponding expert skill to get a verified solution |
| 3 | "I'll add exception handling later" | Postponed exception handling often means it never gets added | Build the exception handling skeleton before writing business logic |
| 4 | "The project code style is messy, I'll write in my own style" | Inconsistent code style increases maintenance burden | Read existing code first and adapt to project conventions |
| 5 | "I'll test everything after writing all the code" | Debugging a large batch of code is far harder than incremental verification | Adopt TDD mindset: implement one, verify one |

**Common Traps**:
1. **"Spec Drift" Trap**: Gradually deviating from spec requirements during implementation → Create an implementation checklist; check off each item against the spec
2. **"Framework Stubbornness" Trap**: Repeatedly trying to solve framework issues without consulting experts → Enforce "3-attempt rule": must invoke expert after 3 failed attempts
3. **"Happy Path" Trap**: Only implementing normal flow while ignoring exception handling → Enforce exception coverage: every public method must have try-catch
4. **"Style Fragmentation" Trap**: New code inconsistent with existing project code style → Implement "read-first, write-later" rule

---

## Red Flags / 红旗警告

### Layer 1: 输入检查 / Input Validation Guards

#### 🇨🇳
- **INPUT-IMPL-001**: spec.md或checklist.md不存在 → 🔴 CRITICAL → 终止并提示先生成开发规格
- **INPUT-IMPL-002**: spec.md缺少接口定义或数据模型章节 → 🔴 CRITICAL → 提示规格文档不完整
- **INPUT-IMPL-003**: 项目路径不存在或无法访问 → 🔴 CRITICAL → 终止并检查项目路径配置

#### 🇺🇸
- **INPUT-IMPL-001**: spec.md or checklist.md does not exist → 🔴 CRITICAL → Terminate and prompt to generate development specification first
- **INPUT-IMPL-002**: spec.md is missing API definitions or data model sections → 🔴 CRITICAL → Prompt that specification document is incomplete
- **INPUT-IMPL-003**: Project path does not exist or is inaccessible → 🔴 CRITICAL → Terminate and check project path configuration

### Layer 2: 执行检查 / Execution Guards

#### 🇨🇳
- **EXEC-IMPL-001**: 实现了规格中未定义的接口或字段 → 🟡 WARN → 标记为"超出规格",请用户确认
- **EXEC-IMPL-002**: 遇到框架相关问题但未调用expert技能而自行硬编码 → 🔴 CRITICAL → 回退修改,调用expert获取正确方案
- **EXEC-IMPL-003**: 代码存在空指针风险(未做null检查) → 🟡 WARN → 补充null检查或Optional
- **EXEC-IMPL-004**: SQL语句存在注入风险(字符串拼接) → 🔴 CRITICAL → 必须使用参数化查询

#### 🇺🇸
- **EXEC-IMPL-001**: Implemented interfaces or fields not defined in the specification → 🟡 WARN → Mark as "out of scope" and request user confirmation
- **EXEC-IMPL-002**: Encountered framework-related issues but hard-coded without invoking expert skills → 🔴 CRITICAL → Rollback changes, invoke expert for correct solution
- **EXEC-IMPL-003**: Code has null pointer risk (no null checks performed) → 🟡 WARN → Add null checks or use Optional
- **EXEC-IMPL-004**: SQL statements have injection risk (string concatenation) → 🔴 CRITICAL → Must use parameterized queries

### Layer 3: 输出检查 / Output Validation Guards

#### 🇨🇳
- **OUTPUT-IMPL-001**: 代码文件有语法错误(无法编译) → 🔴 CRITICAL → 修复后再标记完成
- **OUTPUT-IMPL-002**: 规格要求的接口未全部实现 → 🔴 CRITICAL → 补充遗漏的实现
- **OUTPUT-IMPL-003**: 代码文件路径不符合规范(如放在asset-system下) → 🔴 CRITICAL → 移动到正确路径

#### 🇺🇸
- **OUTPUT-IMPL-001**: Code files have syntax errors (cannot compile) → 🔴 CRITICAL → Fix before marking as complete
- **OUTPUT-IMPL-002**: Not all interfaces required by the specification are implemented → 🔴 CRITICAL → Supplement missing implementations
- **OUTPUT-IMPL-003**: Code file path does not conform to standards (e.g., placed under asset-system) → 🔴 CRITICAL → Move to correct path

### 触发Red Flag时的处理流程 / Red Flag Trigger Handling

#### 🇨🇳
🔴 CRITICAL → 立即停止,报告问题详情,等待指示 | 🟡 WARN → 记录警告,尝试自动修复,在报告中标注 | 🔵 INFO → 记录信息,正常继续

#### 🇺🇸
🔴 CRITICAL → Stop immediately, report issue details, await instructions | 🟡 WARN → Record warning, attempt auto-fix, annotate in report | 🔵 INFO → Log information, continue normally
