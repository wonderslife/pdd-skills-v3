---
name: pdd-code-reviewer
description: PDD框架下的代码审查Skill，验证功能点实现是否符合开发规格和验收标准。当需要代码审查或验证代码质量时自动触发。支持中文触发：代码审查、代码review、PDD审查、质量检查。
license: MIT
compatibility: 需要先完成代码实现
metadata:
  author: "neuqik@hotmail.com"
  version: "2.1"
  parent: pdd-main
---

# 代码审查 - 验证功能点实现是否符合开发规格 / Code Review — Verify Feature Implementation Against Development Specs

**输入**: 代码文件 | 开发规格(spec.md) | 验收标准(checklist.md)

**输出**: 审查报告(`docs/reviews/review-{timestamp}.md`) | 问题列表(issues)

## 技能整合 / Skill Integration

### 🇨🇳 架构师评审（按需调用）

| 架构师技能 | 触发条件 | 服务内容 |
|-----------|---------|---------|
| **software-architect** | 发现架构偏离、接口设计问题 | 架构建议、设计模式 |
| **system-architect** | 发现系统架构问题 | 系统架构评审 |

### 🇺🇸 Architect Review (On-demand Invocation)

| Architect Skill | Trigger Condition | Service Content |
|----------------|-------------------|-----------------|
| **software-architect** | Architecture deviation, interface design issues detected | Architecture advice, design patterns |
| **system-architect** | System architecture issues detected | System architecture review |

### 🇨🇳 专家咨询（按需调用）

| 专家技能 | 触发条件 | 服务内容 |
|-----------|---------|---------|
| **expert-code-quality** | 发现代码异味、重构需求 | 重构方案、设计模式 |
| **expert-ruoyi** | 发现若依框架使用问题 | 框架最佳实践 |
| **expert-mysql** | 发现SQL问题 | 优化建议 |

### 🇺🇸 Expert Consultation (On-demand Invocation)

| Expert Skill | Trigger Condition | Service Content |
|--------------|-------------------|-----------------|
| **expert-code-quality** | Code smells, refactoring needs detected | Refactoring plans, design patterns |
| **expert-ruoyi** | RuoYi framework usage issues detected | Framework best practices |
| **expert-mysql** | SQL issues detected | Optimization suggestions |

### 🇨🇳 调用条件

**必须进行基础审查**: 所有代码文件必须经过基础审查 | 对照规格验证实现完整性

**按需调用架构师**: 发现模块边界不清 | 发现接口设计偏离 | 发现架构模式问题

**按需调用专家**: 发现代码质量问题 | 发现框架使用问题 | 发现数据库设计问题

### 🇺🇸 Invocation Conditions

**Mandatory Basic Review**: All code files must undergo basic review | Verify implementation completeness against specs

**On-demand Architect Invocation**: Unclear module boundaries detected | Interface design deviation detected | Architecture pattern issues detected

**On-demand Expert Invocation**: Code quality issues detected | Framework usage issues detected | Database design issues detected

## 审查维度 / Review Dimensions

### 🇨🇳 设计一致性
- [ ] 代码实现是否与规格描述一致
- [ ] 接口路径是否符合规格定义
- [ ] 请求/响应结构是否符合规格
- [ ] 业务逻辑是否遵循规格定义

### 🇺🇸 Design Consistency
- [ ] Does code implementation match spec description
- [ ] Do API paths conform to spec definitions
- [ ] Do request/response structures match specs
- [ ] Does business logic follow spec definitions

### 🇨🇳 代码质量
- [ ] 代码可读性 | [ ] 命名规范性 | [ ] 错误处理完整性 | [ ] 注释质量

### 🇺🇸 Code Quality
- [ ] Code readability | [ ] Naming conventions | [ ] Error handling completeness | [ ] Comment quality

### 🇨🇳 安全性
- [ ] 参数校验 | [ ] SQL注入防护 | [ ] XSS防护 | [ ] 权限校验

### 🇺🇸 Security
- [ ] Parameter validation | [ ] SQL injection protection | [ ] XSS protection | [ ] Authorization check

### 🇨🇳 性能
- [ ] 数据库查询效率 | [ ] 循环处理优化 | [ ] 缓存使用

### 🇺🇸 Performance
- [ ] Database query efficiency | [ ] Loop processing optimization | [ ] Caching usage

### 🇨🇳 业务逻辑
- [ ] 状态转换正确性 | [ ] 业务规则执行 | [ ] 异常处理

### 🇺🇸 Business Logic
- [ ] State transition correctness | [ ] Business rule execution | [ ] Exception handling

### 🇨🇳 Bug模式库匹配
> 完整模式定义参见 `config/bug-patterns.yaml`，以下为检查清单摘要

- [ ] datetime字段是否使用正确类型(非str)(PATTERN-001)
- [ ] /options路由是否在/{id}之前注册(PATTERN-002)
- [ ] 枚举值是否统一编码规范(PATTERN-003)
- [ ] 前端alert是否使用safeAlert而非原生alert(PATTERN-004)
- [ ] my-tasks查询是否同时匹配evaluator_id和created_by(PATTERN-005)
- [ ] 编号生成是否检查已存在记录(PATTERN-007)
- [ ] 若依权限注解是否完整(PATTERN-R001)
- [ ] 若依菜单配置是否完整(PATTERN-R002)
- [ ] 若依数据权限是否配置(PATTERN-R003)
- [ ] 若依参数校验是否添加@Validated(PATTERN-R005)
- [ ] 若依XSS防护是否添加@Xss(PATTERN-R006)

### 🇺🇸 Bug Pattern Library Matching
> Full pattern definitions in `config/bug-patterns.yaml`, below is a checklist summary

- [ ] datetime fields use correct type (not str) (PATTERN-001)
- [ ] /options route registered before /{id} (PATTERN-002)
- [ ] Enum values follow consistent coding convention (PATTERN-003)
- [ ] Frontend uses safeAlert instead of native alert (PATTERN-004)
- [ ] my-tasks query matches both evaluator_id and created_by (PATTERN-005)
- [ ] ID generation checks existing records (PATTERN-007)
- [ ] RuoYi permission annotations are complete (PATTERN-R001)
- [ ] RuoYi menu configuration is complete (PATTERN-R002)
- [ ] RuoYi data scope is configured (PATTERN-R003)
- [ ] RuoYi parameter validation uses @Validated (PATTERN-R005)
- [ ] RuoYi XSS protection uses @Xss (PATTERN-R006)

### 🇨🇳 UX一致性
- [ ] 表单组件是否与PRD中的组件映射一致(Select/Radio/DatePicker等)
- [ ] 下拉选择是否通过Options API获取数据(非硬编码)
- [ ] 列表页是否有一致的搜索/分页/操作按钮布局
- [ ] 操作按钮是否使用v-hasPermi权限控制(RuoYi项目)
- [ ] 错误提示是否使用safeAlert而非原生alert
- [ ] CSS布局是否遵循global-reset.css基线(无width:100%溢出)

### 🇺🇸 UX Consistency
- [ ] Form components match PRD component mapping (Select/Radio/DatePicker etc.)
- [ ] Dropdowns fetch data via Options API (not hardcoded)
- [ ] List pages have consistent search/pagination/action button layout
- [ ] Action buttons use v-hasPermi permission control (RuoYi projects)
- [ ] Error messages use safeAlert instead of native alert
- [ ] CSS layout follows global-reset.css baseline (no width:100% overflow)

## 问题分级 / Issue Classification

### 🇨🇳 CRITICAL - 必须修复
功能实现与规格严重不符 | 核心业务流程有错误 | 严重的安全漏洞 | 数据一致性问题

### 🇺🇸 CRITICAL - Must Fix
Severe deviation from spec implementation | Core business flow errors | Critical security vulnerabilities | Data consistency issues

### 🇨🇳 WARNING - 建议修复
代码可读性问题 | 错误处理不完善 | 潜在性能问题 | 不符合编码规范

### 🇺🇸 WARNING - Recommended Fix
Code readability issues | Incomplete error handling | Potential performance issues | Coding standard violations

### 🇨🇳 SUGGESTION - 可选优化
代码优化建议 | 重构建议 | 最佳实践推荐

### 🇺🇸 SUGGESTION - Optional Optimization
Code optimization suggestions | Refactoring recommendations | Best practice recommendations

## 流程步骤 / Workflow Steps

### 🇨🇳 Step 1: 收集代码文件
后端(Controller/Service/Mapper/Domain) | 前端(Vue组件/API接口) | 数据库脚本(SQL)

### 🇺🇸 Step 1: Collect Code Files
Backend (Controller/Service/Mapper/Domain) | Frontend (Vue components/API interfaces) | Database scripts (SQL)

### 🇨🇳 Step 2: 读取开发规格
从 `dev-specs/FP-{序号}/spec.md` 读取规格定义

### 🇺🇸 Step 2: Read Development Specs
Read spec definitions from `dev-specs/FP-{sequence}/spec.md`

### 🇨🇳 Step 3: 执行基础审查
**a. 接口审查**: 接口路径/请求方法/参数处理/响应结构是否正确匹配规格
**b. 业务逻辑审查**: 处理流程/状态转换/校验规则是否正确
**c. 数据模型审查**: 字段映射/类型定义/审计字段是否完整
**d. Bug模式库匹配**: 读取 `config/bug-patterns.yaml` 中的Bug模式库，逐条检查代码是否触犯已知模式(PATTERN-001~PATTERN-007, PATTERN-R001~R007)
**e. UX一致性审查**: 对照PRD组件映射表检查表单组件、Options API使用、布局一致性

### 🇺🇸 Step 3: Execute Basic Review
**a. API Review**: Do API paths/request methods/parameter handling/response structures correctly match specs
**b. Business Logic Review**: Are processing flows/state transitions/validation rules correct
**c. Data Model Review**: Are field mappings/type definitions/audit fields complete
**d. Bug Pattern Library Matching**: Read bug pattern library from `config/bug-patterns.yaml`, check code against known patterns (PATTERN-001~007, PATTERN-R001~R007)
**e. UX Consistency Review**: Check form components, Options API usage, layout consistency against PRD component mapping

### 🇨🇳 Step 4: 执行代码质量审查（按需）
调用 **expert-code-quality**(如发现代码质量问题): 代码异味检测 | 重构建议 | 设计模式推荐

### 🇺🇸 Step 4: Execute Code Quality Review (On-demand)
Invoke **expert-code-quality** (if code quality issues detected): Code smell detection | Refactoring suggestions | Design pattern recommendations

### 🇨🇳 Step 5: 架构偏离检查（按需）
调用 **software-architect**(如发现架构问题): 模块边界检查 | 接口设计检查 | 架构模式检查

### 🇺🇸 Step 5: Architecture Deviation Check (On-demand)
Invoke **software-architect** (if architecture issues detected): Module boundary check | Interface design check | Architecture pattern check

### 🇨🇳 Step 6: 生成审查报告
输出到 `docs/reviews/review-{timestamp}.md`:
```markdown
# 代码审查报告

## 基本信息
| 项目 | 内容 |
|------|------|
| 功能点 | FP-XXX-NNN |
| 审查日期 | {日期} |
| 审查人 | AI |

## 审查结果
### 通过项 | CRITICAL问题 | WARNING问题 | SUGGESTION问题
(包含: 序号/问题描述/文件/建议)

### Bug模式库匹配结果
> 完整模式定义: `config/bug-patterns.yaml`

| PATTERN编号 | 是否触犯 | 文件位置 | 说明 |
|------------|---------|---------|------|
| PATTERN-001 | ☐是 ☐否 | | datetime字段类型 |
| PATTERN-002 | ☐是 ☐否 | | /options路由顺序 |
| PATTERN-003 | ☐是 ☐否 | | 枚举编码规范 |
| PATTERN-004 | ☐是 ☐否 | | safeAlert使用 |
| PATTERN-005 | ☐是 ☐否 | | my-tasks查询条件 |
| PATTERN-007 | ☐是 ☐否 | | 编号生成检查 |
| PATTERN-R001 | ☐是 ☐否 | | 若依权限注解 |
| PATTERN-R002 | ☐是 ☐否 | | 若依菜单配置 |
| PATTERN-R003 | ☐是 ☐否 | | 若依数据权限 |
| PATTERN-R005 | ☐是 ☐否 | | 若依参数校验 |
| PATTERN-R006 | ☐是 ☐否 | | 若依XSS防护 |

### UX一致性审查结果
| 检查项 | 是否通过 | 说明 |
|--------|---------|------|
| 表单组件映射 | ☐是 ☐否 | |
| Options API使用 | ☐是 ☐否 | |
| 列表页布局一致性 | ☐是 ☐否 | |
| 权限控制(RuoYi) | ☐是 ☐否 | |
| 错误提示方式 | ☐是 ☐否 | |

## 结论
- [ ] 通过审查
- [ ] 需要修复后重新审查
```

### 🇺🇸 Step 6: Generate Review Report
Output to `docs/reviews/review-{timestamp}.md`:
```markdown
# Code Review Report

## Basic Information
| Item | Content |
|------|---------|
| Feature Point | FP-XXX-NNN |
| Review Date | {date} |
| Reviewer | AI |

## Review Results
### Passed Items | CRITICAL Issues | WARNING Issues | SUGGESTION Issues
(Includes: sequence number/description/file/suggestion)

### Bug Pattern Library Matching Results
> Full pattern definitions: `config/bug-patterns.yaml`

| PATTERN ID | Violated? | File Location | Notes |
|------------|-----------|---------------|-------|
| PATTERN-001 | ☐Yes ☐No | | datetime field type |
| PATTERN-002 | ☐Yes ☐No | | /options route order |
| PATTERN-003 | ☐Yes ☐No | | Enum coding convention |
| PATTERN-004 | ☐Yes ☐No | | safeAlert usage |
| PATTERN-005 | ☐Yes ☐No | | my-tasks query condition |
| PATTERN-007 | ☐Yes ☐No | | ID generation check |
| PATTERN-R001 | ☐Yes ☐No | | RuoYi permission annotation |
| PATTERN-R002 | ☐Yes ☐No | | RuoYi menu configuration |
| PATTERN-R003 | ☐Yes ☐No | | RuoYi data scope |
| PATTERN-R005 | ☐Yes ☐No | | RuoYi parameter validation |
| PATTERN-R006 | ☐Yes ☐No | | RuoYi XSS protection |

### UX Consistency Review Results
| Check Item | Passed? | Notes |
|------------|---------|-------|
| Form component mapping | ☐Yes ☐No | |
| Options API usage | ☐Yes ☐No | |
| List page layout consistency | ☐Yes ☐No | |
| Permission control (RuoYi) | ☐Yes ☐No | |
| Error message method | ☐Yes ☐No | |

## Conclusion
- [ ] Passed review
- [ ] Requires fix and re-review
```

### 🇨🇳 Step 7: 输出问题列表
```json
{"critical": [...], "warning": [...], "suggestion": [...]}
```

### 🇺🇸 Step 7: Output Issue List
```json
{"critical": [...], "warning": [...], "suggestion": [...]}
```

## 与 expert-code-quality 协作规范 / Collaboration Rules with expert-code-quality

### 🇨🇳 职责边界

| 技能 | 定位 | 核心职责 | 阻塞性 |
|------|------|---------|--------|
| **pdd-code-reviewer** | 流程合规性审查 | 验证代码是否实现规格要求 | Critical问题阻塞 |
| **expert-code-quality** | 代码质量深度分析 | 识别代码异味、推荐设计模式、重构建议 | 不阻塞流程 |

### 🇺🇸 Responsibility Boundaries

| Skill | Position | Core Responsibility | Blocking |
|------|----------|---------------------|----------|
| **pdd-code-reviewer** | Process compliance review | Verify code implements spec requirements | Critical issues block |
| **expert-code-quality** | Code quality deep analysis | Identify code smells, recommend design patterns, refactoring suggestions | Non-blocking |

### 🇨🇳 协作流程
代码实现完成 → pdd-code-reviewer(合规性审查) → [有Critical]返回修复 | [无Critical] → expert-code-quality(质量深度分析) → 生成质量改进任务(improvement-tasks.md,不阻塞) → 进入pdd-verify-feature

### 🇺🇸 Collaboration Workflow
Code implementation complete → pdd-code-reviewer (compliance review) → [Has Critical] return for fix | [No Critical] → expert-code-quality (quality deep analysis) → Generate quality improvement tasks (improvement-tasks.md, non-blocking) → Enter pdd-verify-feature

### 🇨🇳 问题处理策略

| 问题来源 | 级别 | 是否阻塞 | 处理方式 |
|---------|------|---------|---------|
| pdd-code-reviewer | Critical | ✅ 阻塞 | 必须修复后才能继续 |
| pdd-code-reviewer | Warning/Suggestion | ❌ 不阻塞 | 记录，建议修复/可选优化 |
| expert-code-quality | 任何级别 | ❌ 不阻塞 | 记录到质量改进清单 |

**质量改进任务处理时机**: 模块所有功能点完成后统一处理 | 输出: `dev-specs/FP-{模块}-{序号}/improvement-tasks.md`

### 🇺🇸 Issue Handling Strategy

| Issue Source | Level | Blocking? | Handling Method |
|--------------|-------|-----------|-----------------|
| pdd-code-reviewer | Critical | ✅ Block | Must fix before proceeding |
| pdd-code-reviewer | Warning/Suggestion | ❌ Non-blocking | Record, suggest fix/optional optimization |
| expert-code-quality | Any level | ❌ Non-blocking | Record to quality improvement list |

**Quality Improvement Task Timing**: Process uniformly after all feature points in module are complete | Output: `dev-specs/FP-{module}-{sequence}/improvement-tasks.md`

## Guardrails / Guardrails

- 必须对照规格逐项审查 / Must review item-by-item against specs
- 问题必须准确引用相关代码 / Issues must accurately reference relevant code
- CRITICAL问题必须修复后才能通过 / CRITICAL issues must be fixed before passing
- 审查报告必须完整记录所有问题 / Review report must completely record all issues
- **架构问题必须咨询架构师技能** / **Architecture issues must consult architect skills**
- **代码质量问题必须咨询 expert-code-quality** / **Code quality issues must consult expert-code-quality**

## 与其他技能协作 / Collaboration with Other Skills

| 协作技能 | 协作方式 | 传入数据 | 期望输出 |
|---------|---------|---------|---------|
| **software-architect** | Consultation | 架构问题 | 架构建议 |
| **system-architect** | Consultation | 系统问题 | 系统建议 |
| **expert-code-quality** | Consultation | 代码问题 | 重构方案 |
| **pdd-implement-feature** | Loop | 问题列表 | 修复后的代码 |
| **pdd-verify-feature** | Sequential | 审查通过的代码 | 验收报告 |

| Collaborating Skill | Collaboration Mode | Input Data | Expected Output |
|---------------------|-------------------|------------|------------------|
| **software-architect** | Consultation | Architecture issues | Architecture advice |
| **system-architect** | Consultation | System issues | System advice |
| **expert-code-quality** | Consultation | Code issues | Refactoring plan |
| **pdd-implement-feature** | Loop | Issue list | Fixed code |
| **pdd-verify-feature** | Sequential | Code passed review | Acceptance report |

---

## Iron Law / Iron Laws (The Five Unbreakable Rules)

### 🇨🇳 铁律（中文）

1. **规格对照优先**: 代码审查的核心是验证实现是否符合规格,而非评判代码"好坏"。所有Critical问题必须基于规格的明确要求。

2. **职责边界清晰**: pdd-code-reviewer负责合规性审查(是否实现了规格要求),代码质量深度分析(设计模式、重构建议)委托给expert-code-quality,不得越界做深度质量分析。

3. **问题必须可操作**: 每个问题都必须包含具体的文件位置、问题描述和修复建议,不得给出模糊的"代码质量有待提高"式反馈。

4. **架构问题必升级**: 发现模块边界不清、接口设计偏离等架构问题时,必须调用software-architect或system-architect,不得自行做出架构判断。

5. **Critical阻塞原则**: Critical问题必须修复后才能通过审查,不得因"时间紧"而降级为Warning或忽略。

### 🇺🇸 Iron Laws (English)

1. **Spec-First Principle**: The core of code review is to verify whether implementation conforms to specs, not to judge whether code is "good" or "bad". All CRITICAL issues must be based on explicit spec requirements.

2. **Clear Responsibility Boundaries**: pdd-code-reviewer is responsible for compliance review (whether spec requirements are implemented). Deep code quality analysis (design patterns, refactoring suggestions) should be delegated to expert-code-quality. Do not overstep into deep quality analysis.

3. **Issues Must Be Actionable**: Every issue must include specific file location, issue description, and fix suggestion. Do not give vague feedback like "code quality needs improvement".

4. **Architecture Issues Must Escalate**: When architecture issues such as unclear module boundaries or interface design deviation are detected, must invoke software-architect or system-architect. Do not make architecture judgments independently.

5. **CRITICAL Blocking Principle**: CRITICAL issues must be fixed before passing review. Do not downgrade to Warning or ignore due to "tight schedule".

### 🇨🇳 违规示例

❌ 以个人编码偏好提出Critical问题 | ❌ 在code-reviewer中深入分析代码异味并提出重构方案 | ❌ 写"Service层实现有问题"而不指出具体方法 | ❌ 发现模块依赖方向错误但不调用software-architect | ❌ SQL注入风险标记为Suggestion级别

### 🇺🇸 Violation Examples

❌ Raising CRITICAL issues based on personal coding preferences | ❌ Deeply analyzing code smells and proposing refactoring plans in code-reviewer | ❌ Writing "Service layer implementation has problems" without specifying the exact method | ❌ Detecting module dependency direction errors but not invoking software-architect | ❌ Marking SQL injection risks as Suggestion level

### 🇨🇳 合规示例

✅ 每个Critical问题引用spec.md具体章节 | ✅ 发现代码异味时转交expert-code-quality深度分析 | ✅ 问题描述精确:"TransferApplyServiceImpl.java:142 缺少底价校验逻辑,规格要求参考BR-001" | ✅ 发现模块依赖错误时调用software-architect | ✅ SQL注入问题标记为Critical并阻止通过

### 🇺🇸 Compliance Examples

✅ Each CRITICAL issue references specific sections in spec.md | ✅ Delegate to expert-code-quality for deep analysis when code smells are detected | ✅ Precise issue description: "TransferApplyServiceImpl.java:142 Missing floor price validation logic, refer to BR-001 in specs" | ✅ Invoke software-architect when module dependency errors are detected | ✅ Mark SQL injection as CRITICAL and block passage

---

## Rationalization Table / Rationalization Table

| # | Trap / 陷阱 | Question / 请问自己 | Action / 应该怎么做 |
|---|-------------|---------------------|---------------------|
| 1 | "这段代码写法不好看" / "This code doesn't look good" | 代码风格偏好不是Critical问题的依据,除非违反项目规范 / Code style preference is not a basis for CRITICAL issues unless it violates project standards | 区分"风格偏好"和"规范违规",只有后者才能作为Critical问题 / Distinguish between "style preference" and "standard violation"; only the latter can be a CRITICAL issue |
| 2 | "这个重构很重要,我直接提吧" / "This refactoring is important, I'll just propose it" | 重构建议属于质量分析范畴,应在expert-code-quality阶段处理 / Refactoring suggestions belong to quality analysis and should be handled in expert-code-quality phase | 记录为Suggestion级别的改进建议,不阻塞当前流程 / Record as Suggestion-level improvement, do not block current workflow |
| 3 | "架构问题我大概知道怎么改,直接说吧" / "I roughly know how to fix this architecture issue, let me just say it" | 架构决策影响范围广,需要专业评估 / Architecture decisions have wide impact and require professional evaluation | 必须调用架构师技能获取正式建议后再整合到报告中 / Must invoke architect skills to get formal advice before integrating into report |
| 4 | "这个问题有点严重,但不想让实现者返工" / "This issue is somewhat serious, but I don't want the implementer to rework" | 放宽标准会导致缺陷流入生产环境,后续修复成本更高 / Relaxing standards will cause defects to enter production, with higher future fix costs | 坚持按标准分级,Critical就是Critical,不能因人情放宽 / Stick to standard classification; CRITICAL is CRITICAL, cannot relax due to personal relationships |
| 5 | "这个安全问题应该不会触发吧" / "This security issue probably won't be triggered" | 安全问题一旦被利用就是重大事故,不能抱侥幸心态 / Once exploited, security issues become major incidents; cannot rely on luck | 所有安全漏洞(SQL注入/XSS/权限绕过)一律定为Critical / All security vulnerabilities (SQL injection/XSS/authorization bypass) must be classified as CRITICAL |

### 🇨🇳 常见陷阱

1. **"主观审查"陷阱**: 以个人偏好代替客观标准 → 建立"问题分级依据表":每个问题必须引用规格、规范或安全标准
2. **"角色越位"陷阱**: 在合规审查中过度深入代码质量领域 → 明确职责边界:规格符合性=code-reviewer,代码质量=expert-code-quality
3. **"模糊反馈"陷阱**: 问题描述过于笼统无法指导修复 → 强制执行"问题描述五要素":位置、现象、预期、实际、建议
4. **"架构擅断"陷阱**: 自行判断架构问题而不咨询专家 → 设定"架构红线",触线即调用对应架构师技能

### 🇺🇸 Common Traps

1. **"Subjective Review" Trap**: Using personal preferences instead of objective standards → Establish "Issue Classification Basis Table": Every issue must reference specs, standards, or security standards
2. **"Role Overstepping" Trap**: Over-deepening into code quality domain during compliance review → Clarify responsibility boundaries: Spec compliance = code-reviewer, Code quality = expert-code-quality
3. **"Vague Feedback" Trap**: Issue descriptions too general to guide fixes → Enforce "Five Elements of Issue Description": Location, phenomenon, expected, actual, suggestion
4. **"Architecture Assumption" Trap**: Making independent architecture judgments without consulting experts → Set "Architecture Red Lines"; when crossed, immediately invoke corresponding architect skill

---

## Red Flags / Red Flags

### Layer 1: 输入检查 / Input Validation Guards - 3 guards

- **INPUT-CR-001**: 代码文件为空或不包含任何实现内容 → 🔴 CRITICAL → 终止并提示先完成代码实现 / Terminate and prompt to complete code implementation first
- **INPUT-CR-002**: spec.md缺失导致无法进行规格对照 → 🔴 CRITICAL → 终止并提示缺少规格文档 / Terminate and prompt for missing spec document
- **INPUT-CR-003**: 代码与规格的功能点ID不匹配 → 🟡 WARN → 提示用户确认审查对象是否正确 / Prompt user to confirm review target is correct

### Layer 2: 执行检查 / Execution Checks Guards - 4 guards

- **EXEC-CR-001**: 提出的Critical问题无法追溯到规格文档或编码规范 → 🔴 CRITICAL → 补充依据或调整问题级别 / Supplement evidence or adjust issue level
- **EXEC-CR-002**: 发现代码质量问题但未转交expert-code-quality而是自行深度分析 → 🟡 WARN → 记录质量问题并标注将在expert-code-quality阶段处理 / Record quality issues and mark for expert-code-quality phase
- **EXEC-CR-003**: 发现架构问题但未调用架构师技能 → 🔴 CRITICAL → 暂停审查,先完成架构咨询 / Pause review, complete architecture consultation first
- **EXEC-CR-004**: 安全漏洞(SQL注入/XSS/权限绕过)未标记为Critical → 🔴 CRITICAL → 修正问题级别为Critical
- **EXEC-CR-005**: 代码触犯Bug模式库中的已知模式但未标记为问题 → 🔴 CRITICAL → 按 `config/bug-patterns.yaml` 中的severity级别标记问题并引用PATTERN编号
- **EXEC-CR-006**: UX一致性问题(硬编码下拉选项/原生alert/布局溢出)未记录 → 🟡 WARN → 记录为Warning级别问题

### Layer 3: 输出检查 / Output Validation Guards - 3 guards

- **OUTPUT-CR-001**: 审查报告缺少问题分级汇总(Critical/Warning/Suggestion数量) → 🔴 CRITICAL → 补充分级统计 / Supplement classification statistics
- **OUTPUT-CR-002**: 报告结论为"通过"但存在未解决的Critical问题 → 🔴 CRITICAL → 修正结论为"需要修复" / Correct conclusion to "Requires fix"
- **OUTPUT-CR-003**: 问题列表中存在无法定位到具体代码行的问题 → 🟡 WARN → 补充精确的代码位置引用
- **OUTPUT-CR-004**: 审查报告未包含Bug模式库匹配结果 → 🔴 CRITICAL → 补充Bug模式库匹配章节
- **OUTPUT-CR-005**: 审查报告未包含UX一致性审查结果 → 🟡 WARN → 补充UX一致性审查章节

### 🇨🇳 触发Red Flag时的处理流程
🔴 CRITICAL → 立即停止,报告问题详情,等待指示 | 🟡 WARN → 记录警告到审查日志,尝试自动修复,在最终报告中标注 | 🔵 INFO → 记录信息,正常继续

### 🇺🇸 Red Flag Trigger Handling Procedure
🔴 CRITICAL → Stop immediately, report issue details, await instructions | 🟡 WARN → Log warning to review log, attempt auto-fix, annotate in final report | 🔵 INFO → Record information, continue normally
