---
name: expert-bug-fixer
description: "线上/已开发系统的Bug修复专家。精准定位、控制修改范围、生成变更发布单。当用户描述Bug、报错、显示异常时自动触发。支持中文触发：修复Bug、线上问题、改一下、报错了、显示不对。"
license: MIT
compatibility: 已有代码的Bug修复和小范围功能微调
metadata:
  author: "neuqik@hotmail.com"
  version: "1.0"
  triggers:
    - "/fix-bug" | "/修复Bug"
    - "修复Bug" | "线上问题" | "改一下" | "不对" | "报错"
    - "显示异常" | "接口404" | "数据不对" | "页面空白"
---

# Bug 修复专家 / Bug Fix Expert

## 1. 技能概述 / Overview

### 🇨🇳 定位
本技能专门用于**已上线或已开发完成的系统**的 Bug 修复和小范围功能微调。与 `pdd-implement-feature`（全量开发）形成互补。

**核心原则**: 精准定位 → 控制范围 → 最小修改 → 标准交付

**输入**: Bug 描述（用户对话）| 可选: 错误日志、截图、涉及的页面/接口
**输出**: 修复代码（Diff 格式，最小侵入）| 变更发布单（部署清单）

### 🇺🇸 Positioning
This skill is specifically designed for **bug fixing and minor feature adjustments** in systems that are already deployed or developed. It complements `pdd-implement-feature` (full development).

**Core Principle**: Precise Location → Scope Control → Minimal Changes → Standard Delivery

**Input**: Bug description (user conversation) | Optional: error logs, screenshots, affected pages/APIs
**Output**: Fix code (Diff format, minimal invasiveness) | Release Patch Document (deployment checklist)

### 1.1 与其他技能的边界 / Boundary with Other Skills

| 场景 / Scenario | 使用技能 / Skill | 原因 / Reason |
|--------|--------|--------|
| 修复已有代码中的 Bug / Fix bugs in existing code | **expert-bug-fixer** ✅ | 增量修改，控制范围 / Incremental changes, scope control |
| 新增接口/新增页面 / Add new API/page | **pdd-implement-feature** | 全量开发流程 / Full development workflow |
| 修改规格文档 / Modify spec documents | **pdd-doc-change** | 文档变更管理 / Document change management |
| 若依框架特定问题 / RuoYi framework issues | **expert-ruoyi** (协作) | 框架最佳实践 / Framework best practices |

### 1.2 与其他技能协作 / Collaboration with Other Skills

| 协作技能 / Skill | 协作方式 / Mode | 传入数据 / Input | 期望输出 / Output |
|---------|---------|---------|---------|
| **expert-ruoyi** | Consultation | 若依框架问题 / RuoYi issues | 解决方案 / Solution |
| **expert-mysql** | Consultation | 数据库问题 / DB issues | SQL优化方案 / SQL optimization |
| **pdd-code-reviewer** | Sequential | 修复后的代码 / Fixed code | 审查报告 / Review report |
| **pdd-verify-feature** | Sequential | 修复后的功能点 / Fixed feature | 回归验证报告 / Regression report |
| **dependency-chain** | Tool | 项目路径 / Project path | 影响范围声明 / Impact declaration |

---

## 2. 修复 SOP（四步流程）/ Fix SOP (Four-Step Process)

### 🇨🇳 Step 1: 定位与复现

从用户描述中提取关键信息：

```yaml
Bug定位三要素:
  什么功能: [模块名/页面名/接口名]
  期望行为: [用户期望看到什么]
  实际行为: [实际发生了什么]
```

定位涉及的代码文件（后端 Controller/Service/Mapper + 前端 Vue/API），确认 Bug 类别：

| Bug 类别 | 典型表现 | 定位方向 |
|---------|---------|---------|
| 逻辑错误 | 计算结果不对、状态流转异常 | Service 层业务逻辑 |
| 数据不一致 | 前后端数据不匹配、字段缺失 | Entity/VO/前端数据解析 |
| 接口不通 | 404、参数解析异常 | Controller路径 + 前端API路径 |
| UI显示异常 | 状态标签颜色错误、字段不显示 | Vue组件 + 状态映射 |

### 🇺🇸 Step 1: Locate and Reproduce

Extract key information from user description:

```yaml
Bug Location Three Elements:
  What feature: [module/page/API name]
  Expected behavior: [what user expects to see]
  Actual behavior: [what actually happened]
```

Locate involved code files (backend Controller/Service/Mapper + frontend Vue/API), confirm Bug category:

| Bug Category | Typical Symptoms | Location Direction |
|-------------|-----------------|-------------------|
| Logic Error | Wrong calculation, abnormal state transition | Service layer business logic |
| Data Inconsistency | Frontend-backend data mismatch, missing fields | Entity/VO/frontend data parsing |
| API Unreachable | 404, parameter parsing exception | Controller path + frontend API path |
| UI Display Anomaly | Wrong status label color, field not showing | Vue component + status mapping |

---

### 🇨🇳 Step 2: 五维影响分析

在动代码之前，必须构建"影响范围声明"。按五个维度逐一检查：

| 维度 | 检查内容 | 检查方法 |
|------|---------|---------|
| **纵向** | 修改后端时 → 列出所有调用该接口的前端文件 | 搜索前端 api/ 目录中的 URL |
| **横向** | 修改某个状态映射时 → 列出所有包含同类映射的文件 | 全局搜索 getStatusLabel/statusMap |
| **深度** | 修改状态流转时 → 确认是否需要同步记录审批日志 | 检查 @Transactional 范围 |
| **约束** | 是否涉及若依框架约定 | 检查 @PathVariable/菜单SQL/@Param 等 |
| **推断** | 状态判断是否使用了查表而非推断 | 检查 if/switch 中的状态来源 |

> 🛠️ **工具辅助**: 如果项目已配置依赖链引擎，可使用 `pdd deps impact <file>` 命令自动生成影响范围声明，避免手工遍历。
> 🛠️ **Tool Assist**: If the project has the dependency chain engine configured, use `pdd deps impact <file>` to auto-generate impact declarations.

**输出格式**:

```markdown
## 影响范围声明

本次修复将修改以下文件，请确认：

### 后端
1. `xxx/ServiceImpl.java` — 修复业务逻辑（主修改）
2. `xxx/Controller.java` — 同步参数类型

### 前端
3. `src/api/xxx.js` — 同步接口路径
4. `src/views/xxx/index.vue` — 修复状态映射

### 数据库
5. 无数据库变更

⚠️ 本次修改涉及 4 个文件。确认后开始修复。
```

### 🇺🇸 Step 2: Five-Dimension Impact Analysis

Before touching any code, build an "Impact Scope Declaration". Check along five dimensions:

| Dimension | Check Content | Method |
|-----------|--------------|--------|
| **Vertical** | When modifying backend → list all frontend files calling this API | Search URLs in frontend api/ directory |
| **Horizontal** | When modifying a status mapping → list all files with similar mappings | Global search getStatusLabel/statusMap |
| **Depth** | When modifying state transition → confirm if approval log needs sync | Check @Transactional scope |
| **Constraint** | Whether RuoYi framework conventions are involved | Check @PathVariable/menu SQL/@Param etc. |
| **Inference** | Whether status judgment uses lookup vs inference | Check status source in if/switch |

**Output Format**:

```markdown
## Impact Scope Declaration

This fix will modify the following files, please confirm:

### Backend
1. `xxx/ServiceImpl.java` — Fix business logic (primary change)
2. `xxx/Controller.java` — Sync parameter type

### Frontend
3. `src/api/xxx.js` — Sync API path
4. `src/views/xxx/index.vue` — Fix status mapping

### Database
5. No database changes

⚠️ This fix involves 4 files. Confirm to proceed.
```

---

### 🇨🇳 Step 3: 精准修复

执行修复时严格遵循以下规则：

1. **严格按 Step 2 的文件清单修改，不扩大范围**
2. **使用 Diff 格式输出变更，不重写整个文件**
3. **修改顺序**: Entity/Domain → Mapper/XML → Service → Controller → 前端API → 前端页面
4. **执行 bug-patterns.yaml 自检**：修复完成后，对照 `config/bug-patterns.yaml` 中的所有已知模式逐一检查，确保不引入新 Bug
5. **若依项目额外检查**（如适用）：
   - 修改 Controller → 检查 @PreAuthorize 是否正确 (PATTERN-R001)
   - 修改参数 → 检查 @Validated/@Xss 是否添加 (PATTERN-R005/R006)
   - 修改状态 → 检查审批日志是否记录 (PATTERN-R010)

### 🇺🇸 Step 3: Precise Fix

Strictly follow these rules during fix:

1. **Only modify files listed in Step 2's declaration, do not expand scope**
2. **Output changes in Diff format, do not rewrite entire files**
3. **Modification order**: Entity/Domain → Mapper/XML → Service → Controller → Frontend API → Frontend page
4. **Self-check against bug-patterns.yaml**: After fix, verify against all known patterns in `config/bug-patterns.yaml` to ensure no new bugs are introduced
5. **RuoYi project additional checks** (if applicable):
   - Modified Controller → Check @PreAuthorize is correct (PATTERN-R001)
   - Modified parameters → Check @Validated/@Xss are added (PATTERN-R005/R006)
   - Modified status → Check approval log is recorded (PATTERN-R010)

---

### 🇨🇳 Step 4: 生成变更发布单

修复完成后，**必须**按照 `templates/release-patch-template.md` 模板生成变更发布单，内容包括：

1. **数据库变更**：SQL 脚本 + 回滚方案（如有）
2. **后端变更清单**：文件路径 + 变更类型(新增/修改/删除) + 变更摘要
3. **前端变更清单**：文件路径 + 变更类型 + 变更摘要
4. **部署指引**：重启要求 / 缓存清理 / 验证路径 / 回滚方案
5. **测试验证**：验证步骤 + 预期结果

### 🇺🇸 Step 4: Generate Release Patch Document

After fix completion, **must** generate a release patch document following `templates/release-patch-template.md` template, including:

1. **Database Changes**: SQL scripts + rollback plan (if any)
2. **Backend Change List**: File path + change type (add/modify/delete) + change summary
3. **Frontend Change List**: File path + change type + change summary
4. **Deployment Instructions**: Restart requirements / cache cleanup / verification paths / rollback plan
5. **Test Verification**: Verification steps + expected results

### 🇨🇳 Step 4.5: 自动回归验证（可选但强烈建议）

修复完成后，建议自动触发 `pdd-verify-feature` 对受影响的功能点进行回归验证：

1. 从 Step 2 的影响范围声明中提取受影响的功能点 ID
2. 调用 `pdd-verify-feature` 针对这些功能点执行三维验证（完整性/正确性/一致性）
3. 将回归验证结果附加到变更发布单的“测试验证”章节
4. 如果回归验证发现新的 Critical 问题，必须在发布前修复

### 🇺🇸 Step 4.5: Auto-Regression Verification (Optional but Strongly Recommended)

After fix completion, recommend auto-triggering `pdd-verify-feature` for regression verification on affected feature points:

1. Extract affected feature point IDs from Step 2's Impact Scope Declaration
2. Invoke `pdd-verify-feature` for three-dimension verification (Completeness/Correctness/Coherence) on these feature points
3. Append regression verification results to the Release Patch Document's "Test Verification" section
4. If regression verification discovers new Critical issues, must fix before release

---

## 3. Guardrails

### 🇨🇳 必须遵守
- [ ] 修改前必须输出影响范围声明并等待用户确认
- [ ] 禁止在 Bug 修复中添加新功能（scope creep）
- [ ] 每次修复必须生成变更发布单
- [ ] 修改涉及 3 个以上文件时，提醒用户"修改范围较大，建议先在测试环境验证"
- [ ] 修复完成后必须对照 bug-patterns.yaml 自检
- [ ] 遇到若依框架问题必须咨询 expert-ruoyi

### 🇺🇸 Must Follow
- [ ] Must output Impact Scope Declaration before any code changes and wait for user confirmation
- [ ] No new features allowed during bug fix (scope creep)
- [ ] Must generate Release Patch Document for every fix
- [ ] When fix involves 3+ files, warn user: "Large change scope, recommend testing in staging first"
- [ ] Must self-check against bug-patterns.yaml after fix completion
- [ ] Must consult expert-ruoyi for RuoYi framework issues

---

## 4. Iron Law / 铁律

### 🇨🇳

1. **影响声明先行**: 任何代码修改之前，必须先输出"影响范围声明"并获得用户确认。不允许"先改了再说"。

2. **修复不扩张**: Bug 修复的范围严格限定在"消除 Bug"本身。用户如果在修复过程中提出新需求，必须拒绝并建议走 `pdd-implement-feature` 流程。

3. **Diff 不重写**: 输出代码变更时必须使用 Diff 格式（仅展示修改的行），禁止输出整个文件。防止无关代码被意外修改。

4. **发布单必出**: 每次修复完成后必须生成变更发布单。即使修复"只改了一行"，发布单也必须包含完整的部署指引和验证路径。

5. **模式库自检**: 修复完成后必须对照 `config/bug-patterns.yaml` 逐一自检。修 Bug 不能引入新的已知 Bug。

### 🇺🇸

1. **Declaration First**: Before any code changes, must output "Impact Scope Declaration" and get user confirmation. No "fix first, explain later".

2. **Fix, Don't Expand**: Bug fix scope is strictly limited to "eliminating the bug" itself. If user proposes new requirements during fix, must decline and suggest `pdd-implement-feature` workflow.

3. **Diff, Don't Rewrite**: Code changes must use Diff format (showing only modified lines). Outputting entire files is forbidden. Prevents accidental changes to unrelated code.

4. **Patch Document Required**: Must generate release patch document after every fix. Even if fix "only changed one line", patch document must include complete deployment instructions and verification paths.

5. **Pattern Library Self-Check**: After fix completion, must self-check against `config/bug-patterns.yaml` one by one. Fixing bugs must not introduce new known bugs.

**违规示例 / Violation Examples**:
❌ 直接修改代码而未先声明影响范围 | ❌ 修复 Bug 时顺便添加了新的筛选条件 | ❌ 输出了整个 Vue 文件而非 Diff | ❌ 修复完成后未生成变更发布单 | ❌ 修复了 API 路径问题但引入了 @Param 缺失 (PATTERN-R012)

**合规示例 / Compliance Examples**:
✅ 先列出受影响的 4 个文件等用户确认 | ✅ 用户要求"顺便加个按钮"时回复"建议走功能开发流程" | ✅ 只展示 ServiceImpl.java 第 142-155 行的 Diff | ✅ 修复完成后生成了包含 DB/后端/前端/部署指引的发布单 | ✅ 修复后自检通过 14 个 Bug 模式

---

## 5. Rationalization Table / 合理化防御表

### 🇨🇳

| # | 你可能的想法 | 请问自己 | 应该怎么做 |
|---|-------------|---------|-----------|
| 1 | "这个 Bug 很简单，直接改就行了" | 看似简单的修改可能有纵向/横向影响，不分析就改会引入新 Bug | 即使只改一行，也必须执行五维影响分析 |
| 2 | "用户说顺便改一下那个功能" | Bug 修复中混入功能变更会破坏修改的可追溯性 | 明确拒绝，建议走功能开发流程 |
| 3 | "整个文件都需要重构了" | 大规模重构不在 Bug 修复的范围内 | 只修复 Bug 本身，重构建议记录到 improvement-tasks.md |
| 4 | "变更发布单太麻烦了，口头说一下吧" | 缺少书面记录会导致部署遗漏和回滚困难 | 无论修改多小，都必须生成标准变更发布单 |
| 5 | "这个模式库检查项跟我的修改无关" | 修复代码时容易无意中触犯已知模式 | 完整自检所有模式，不跳过任何一项 |

### 🇺🇸

| # | You Might Think | Ask Yourself | What To Do |
|---|----------------|--------------|------------|
| 1 | "This bug is simple, just fix it directly" | Seemingly simple changes may have vertical/horizontal impacts; fixing without analysis can introduce new bugs | Even for a one-line change, must perform five-dimension impact analysis |
| 2 | "User says fix that feature while we're at it" | Mixing feature changes into bug fixes breaks change traceability | Explicitly decline, suggest going through feature development workflow |
| 3 | "The whole file needs refactoring" | Large-scale refactoring is outside the scope of bug fixing | Only fix the bug itself, record refactoring suggestions in improvement-tasks.md |
| 4 | "Patch document is too much trouble, just mention it verbally" | Lack of written records leads to deployment omissions and rollback difficulties | Regardless of change size, must generate standard release patch document |
| 5 | "This pattern check is irrelevant to my fix" | Fix code can inadvertently trigger known patterns | Complete self-check all patterns, don't skip any |

---

## 6. Red Flags / 红旗警告

### Layer 1: 输入检查 / Input Validation Guards

- **INPUT-BF-001**: Bug 描述过于模糊（如"系统不好用"）→ 🔴 CRITICAL → 终止并要求提供具体的功能名称+期望行为+实际行为 / Terminate and request specific feature name + expected behavior + actual behavior
- **INPUT-BF-002**: 用户描述的是新需求而非 Bug（如"加一个导出功能"）→ 🟡 WARN → 提示应使用 pdd-implement-feature 流程 / Suggest using pdd-implement-feature workflow
- **INPUT-BF-003**: 涉及的代码文件无法找到或路径不存在 → 🔴 CRITICAL → 终止并请求用户确认项目路径 / Terminate and request user to confirm project path

### Layer 2: 执行检查 / Execution Guards

- **EXEC-BF-001**: 未输出影响范围声明就开始修改代码 → 🔴 CRITICAL → 回退所有修改，先完成五维影响分析 / Rollback all changes, complete five-dimension analysis first
- **EXEC-BF-002**: 修改了影响范围声明之外的文件 → 🔴 CRITICAL → 回退额外修改，更新影响范围声明后重新确认 / Rollback extra changes, update declaration and re-confirm
- **EXEC-BF-003**: 在 Bug 修复中添加了新功能 → 🔴 CRITICAL → 回退新功能代码，仅保留 Bug 修复 / Rollback new feature code, keep only bug fix
- **EXEC-BF-004**: 修改涉及 5 个以上文件 → 🟡 WARN → 提醒用户这可能不是简单的 Bug 修复，建议评估是否需要走完整开发流程 / Warn user this may not be a simple bug fix

### Layer 3: 输出检查 / Output Validation Guards

- **OUTPUT-BF-001**: 修复完成但未生成变更发布单 → 🔴 CRITICAL → 补充生成发布单 / Generate release patch document
- **OUTPUT-BF-002**: 变更发布单缺少部署指引或验证路径 → 🟡 WARN → 补充完整 / Complete missing sections
- **OUTPUT-BF-003**: 修复代码未通过 bug-patterns.yaml 自检 → 🔴 CRITICAL → 修复触犯的模式后才能标记完成 / Fix violated patterns before marking as complete
- **OUTPUT-BF-004**: 使用了整个文件输出而非 Diff 格式 → 🟡 WARN → 转换为 Diff 格式 / Convert to Diff format

### 触发 Red Flag 时的处理流程 / Red Flag Handling
🔴 CRITICAL → 立即停止，报告问题详情，等待指示 / Stop immediately, report details, await instructions
🟡 WARN → 记录警告，尝试自动修复，在变更发布单中标注 / Log warning, attempt auto-fix, annotate in patch document

---

## 7. 版本历史 / Version History

| 版本 / Version | 日期 / Date | 变更内容 / Changes |
|------|------|---------|
| 1.1 | 2026-04-28 | 新增 Step 4.5 自动回归验证 + 依赖链引擎集成 + pdd-verify-feature 协作 / Added Step 4.5 auto-regression + dependency chain engine integration + pdd-verify-feature collaboration |
| 1.0 | 2026-04-28 | 初始版本：四步SOP + 五维影响分析 + 变更发布单 / Initial: Four-step SOP + Five-dimension analysis + Release patch document |
