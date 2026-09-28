---
name: pdd-doc-gardener
description: 文档园丁技能，定期扫描识别过时或废弃文档，保持知识库新鲜度。当用户需要文档一致性检查、文档更新或清理时自动触发。支持中文触发：文档清理、文档一致性、更新文档。
license: MIT
compatibility: 需要文档目录 (docs/)
metadata:
  author: "neuqik@hotmail.com"
  version: "1.0"
  parent: pdd-entropy-reduction
---

# 文档园丁 / Document Gardener (pdd-doc-gardener)

## 核心理念 / Core Philosophy

### 🇨🇳 中文

> "文档即代码，保持同步。文档过时即视为技术债务。" —— PDD 黄金原则

定期扫描代码仓库中的 `docs/` 目录,识别不再反映真实代码行为的过时或废弃文档。

### 🇺🇸 English

> "Documentation is code — keep it in sync. Outdated documentation is technical debt." —— PDD Golden Principle

Periodically scan the `docs/` directory in the code repository to identify outdated or deprecated documents that no longer reflect actual code behavior.

## 检测项 / Detection Items

### 🇨🇳 中文

### 1. 代码与文档不一致
解析文档中的代码引用(文件路径/函数名/API端点) → 检查代码是否存在及行为是否一致

**示例**: 文档描述"API /api/users返回用户列表" | 实际代码返回用户详情(含订单) → 检测结果:文档过时

### 2. 注释过时
扫描TODO/FIXME/HACK注释 → 检查存在时间 → 标记超过N天的注释为过时

**示例**: 代码注释"// TODO: implement this later"(30天前创建) → 检测结果:注释过时

### 3. 文档引用的代码已删除
解析文档中的文件路径引用 → 检查文件是否存在 → 标记引用已删除文件的文档

**示例**: 文档引用"参见src/utils/helper.js" | 实际状态:文件已删除 → 检测结果:引用失效

### 4. API文档与实现不匹配
解析API文档端点定义 → 扫描代码实际实现 → 对比参数/返回值/错误码

**示例**: API文档:"POST /api/users,参数{name,email}" | 实际代码:"{name,email,phone}" → 检测结果:文档缺失phone参数

### 🇺🇸 English

### 1. Code-Documentation Inconsistency
Parse code references in documentation (file paths / function names / API endpoints) → Check whether code exists and behavior is consistent

**Example**: Document states "API /api/users returns user list" | Actual code returns user details (including orders) → Result: Documentation outdated

### 2. Outdated Comments
Scan TODO/FIXME/HACK comments → Check creation time → Mark comments older than N days as stale

**Example**: Code comment "// TODO: implement this later" (created 30 days ago) → Result: Comment outdated

### 3. Referenced Code Deleted
Parse file path references in documentation → Check if files exist → Flag documents referencing deleted files

**Example**: Document references "see src/utils/helper.js" | Actual status: File deleted → Result: Broken reference

### 4. API Documentation Mismatch
Parse API endpoint definitions in docs → Scan actual code implementation → Compare parameters / return values / error codes

**Example**: API doc: "POST /api/users, params {name,email}" | Actual code: "{name,email,phone}" → Result: Doc missing phone parameter

## 执行流程 / Execution Workflow

### 🇨🇳 中文

扫描(文档目录/代码注释/API文档) → 对比(代码引用/API定义/行为描述) → 分类(问题类型/严重程度/优先级) → 执行(更新文档/创建PR/删除废弃)

### 🇺🇸 English

Scan (documentation directory / code comments / API docs) → Compare (code references / API definitions / behavior descriptions) → Classify (issue type / severity / priority) → Execute (update documentation / create PR / delete deprecated)

## 输出格式 / Output Format

### 🇨🇳 中文

### 文档园丁报告

```markdown
# 文档园丁报告 - YYYY-MM-DD
## 扫描范围: docs/(XX文件) / src/
## 发现问题
### Critical(必须修复): 文件 | 问题 | 建议
### Warning(建议修复): 文件 | 问题 | 建议
### Info(可选修复): 文件 | 问题 | 建议
## 执行结果: 更新X项 | 创建PR X项 | 跳过X项
```

### 🇺🇸 English

### Document Gardener Report

```markdown
# Document Gardener Report - YYYY-MM-DD
## Scan Scope: docs/(XX files) / src/
## Issues Found
### Critical(Must Fix): File | Issue | Suggestion
### Warning(Should Fix): File | Issue | Suggestion
### Info(Optional Fix): File | Issue | Suggestion
## Execution Results: Updated X items | Created PR X items | Skipped X items
```

## 配置选项 / Configuration Options (`doc-gardener-config.yaml`)

### 🇨🇳 中文

```yaml
doc_gardener:
  scan:
    docs_paths: ["docs/", "*.md"]
    code_paths: ["src/"]
    exclude: ["node_modules/", "dist/"]
  staleness:
    todo_max_age_days: 30
    doc_max_age_days: 90
  execution:
    auto_update: true
    create_pr: true
    max_pr_per_run: 3
```

### 🇺🇸 English

```yaml
doc_gardener:
  scan:
    docs_paths: ["docs/", "*.md"]
    code_paths: ["src/"]
    exclude: ["node_modules/", "dist/"]
  staleness:
    todo_max_age_days: 30
    doc_max_age_days: 90
  execution:
    auto_update: true
    create_pr: true
    max_pr_per_run: 3
```

## 与其他技能协作 / Integration with Other Skills

### 🇨🇳 中文

- **pdd-entropy-reduction**: 作为子技能被协调调用
- **pdd-doc-change**: 调用此技能创建文档变更PR
- **expert-entropy-auditor**: 接收审计结果,执行文档修复

### 🇺🇸 English

- **pdd-entropy-reduction**: Invoked as a sub-skill by the coordinator
- **pdd-doc-change**: Called to create documentation change PRs
- **expert-entropy-auditor**: Receives audit results, executes documentation fixes

---

## Iron Law / 铁律

### 🇨🇳 中文

1. **证据先行**: 标记文档为"过时"前必须有明确证据(代码已删除/API已变更/行为已修改),不得基于猜测判定。

2. **最小化干预**: 文档修复采用最小改动原则,只更新确实过时的部分,不得借机重写整个文档。

3. **分类处置**: 按Critical/Warning/Info三级分类,Critical立即修复,Warning创建任务,Info记录观察。

4. **不删除仅标记**: 废弃文档应标记"Deprecated"而非直接删除,删除需用户确认。

5. **闭环追踪**: 每个问题都必须有明确状态(已修复/待修复/已忽略)和处置记录。

**违规示例**: ❌ 因为"看起来很久没更新"就标记过时 | ❌ 发现一个过时就重写整个文档 | ❌ 全部标为Critical | ❌ 直接删除引用已删除文件的段落 | ❌ 生成问题清单但不跟踪

**合规示例**: ✅ 标记过时时附证据:"引用的src/utils/helper.js在commit abc123中被删除" | ✅ 只更新过时参数,保留其余部分 | ✅ Critical=影响功能运行,Warning=误导理解,Info=形式问题 | ✅ 先归档到deprecated/目录 | ✅ 报告每个问题都有状态列

### 🇺🇸 English

1. **Evidence First**: Before marking a document as "outdated", there must be clear evidence (code deleted / API changed / behavior modified). Never mark based on speculation.

2. **Minimal Intervention**: Document fixes follow the principle of minimal changes — only update truly outdated parts. Do not use this as an opportunity to rewrite the entire document.

3. **Classified Disposition**: Classify into three levels: Critical / Warning / Info. Critical = fix immediately, Warning = create task, Info = record and observe.

4. **Mark, Don't Delete**: Deprecated documents should be marked "Deprecated" rather than directly deleted. Deletion requires user confirmation.

5. **Closed-Loop Tracking**: Every issue must have a clear status (fixed / pending / ignored) and disposition record.

**Violation Examples**: ❌ Mark as outdated because "looks like it hasn't been updated in a while" | ❌ Rewrite entire document upon finding one outdated item | ❌ Mark everything as Critical | ❌ Directly delete paragraphs referencing deleted files | ❌ Generate issue list without tracking

**Compliant Examples**: ✅ When marking outdated, attach evidence: "Referenced src/utils/helper.js was deleted in commit abc123" | ✅ Only update outdated parameters, preserve the rest | ✅ Critical = affects functionality, Warning = misleading understanding, Info = formatting issue | ✅ Archive to deprecated/ directory first | ✅ Report includes status column for every issue

---

## Rationalization Table / 理性化对照表

| # | Trap / 陷阱 | Question | Action |
|---|-------------|----------|--------|
| 1 | "这个文档肯定过时了,直接标吧" / "This doc is definitely outdated, just mark it" | 无证据判断可能错误,误标浪费时间 / Uninformed judgment may be wrong, wasting time on false positives | 必须找到具体的代码/文档不一致证据 / Must find specific code/documentation inconsistency evidence |
| 2 | "趁机会把文档重写了吧" / "Let's rewrite the doc while we're at it" | 重写会引入新错误且超出职责 / Rewriting introduces new errors and exceeds scope | 只做必要修正,大规模重构单独建议 / Only make necessary fixes; suggest large refactoring separately |
| 3 | "都是小问题,统一标Warning吧" / "These are all minor, just mark them Warning" | 失去分级导致严重问题得不到及时处理 / Losing severity levels causes serious issues to go unaddressed | 严格按影响程度分级 / Classify strictly by impact severity |
| 4 | "旧文档占空间,删掉算了" / "Old docs waste space, just delete them" | 删除不可逆,可能丢失有价值信息 / Deletion is irreversible, may lose valuable information | 先归档deprecated/,保留期(如90天)后再确认 / Archive to deprecated/ first, confirm after retention period (e.g., 90 days) |
| 5 | "报告生成了工作就完成了" / "Report generated, job done" | 发现问题不跟踪等于没做 / Finding issues without tracking is as good as doing nothing | 报告必须含处置建议和跟踪机制 / Report must include disposition suggestions and tracking mechanism |

**常见陷阱 / Common Traps**:

1. **"过度标记"陷阱 / "Over-marking" Trap**: 大量非关键问题标记过时,制造"狼来了"效应 → 严格证据标准:每个标记必须附具体证据 / Mass non-critical issues marked outdated creates "cry wolf" effect → Strict evidence standard: every mark must attach specific evidence

2. **"大修诱惑"陷阱 / "Major Overhaul" Trap**: 借清理之名行重构之实 → 单次修改比例上限(如不超过20%) / Using cleanup as excuse for refactoring → Single-change modification cap (e.g., max 20%)

3. **"分级扁平"陷阱 / "Flat Classification" Trap**: 所有问题同一级别 → 量化标准:Critical=影响功能,Warning=误导理解,Info=形式 / All issues same level → Quantified standard: Critical=affects function, Warning=misleading understanding, Info=formatting

4. **"删除冲动"陷阱 / "Deletion Impulse" Trap**: 倾向删除而非归档 → 强制流程:删除前必须移至deprecated并保留一周期 / Tendency to delete rather than archive → Mandatory process: must move to deprecated before deletion with retention period

---

## Red Flags / 红旗警告

### Layer 1: 输入检查 / Input Validation Guards
- **INPUT-DG-001**: docs/目录不存在或为空 → 🔴 CRITICAL → 终止并提示目录不存在 / Terminate and report directory does not exist
- **INPUT-DG-002**: src/目录不存在无法交叉验证 → 🟡 WARN → 降级为仅检查文档内部一致性 / Degrade to internal documentation consistency check only
- **INPUT-DG-003**: doc-gardener-config.yaml缺失 → 🔵 INFO → 使用默认配置 / Use default configuration

### Layer 2: 执行检查 / Execution Validation Guards
- **EXEC-DG-001**: 标记过时但未提供具体证据 → 🔴 CRITICAL → 补充证据或移除标记 / Provide evidence or remove the mark
- **EXEC-DG-002**: 单次修改超过文档内容的30% → 🟡 WARN → 警告可能属重构范畴,建议拆分 / Warning: may be refactoring scope, suggest splitting
- **EXEC-DG-003**: 直接删除文档而非先归档 → 🔴 CRITICAL → 先移至deprecated/并添加Deprecated标记 / Move to deprecated/ first and add Deprecated marker
- **EXEC-DG-004**: Critical问题未生成修复建议 → 🟡 WARN → 为每个Critical补充人工修复指导 / Add manual fix guidance for each Critical issue

### Layer 3: 输出检查 / Output Validation Guards
- **OUTPUT-DG-001**: 报告缺少分级统计(Critical/Warning/Info数量) → 🔴 CRITICAL → 补充分级汇总 / Add severity classification summary
- **OUTPUT-DG-002**: 报告缺少处置建议或后续计划 → 🟡 WARN → 补充建议处理方式 / Add suggested disposition actions
- **OUTPUT-DG-003**: 执行结果与问题清单不匹配 → 🔴 CRITICAL → 说明未处理原因和状态 / Explain reasons and status for unaddressed items

### 触发Red Flag时的处理流程 / Trigger Handling Workflow

🔴 **CRITICAL** → 立即停止,报告问题详情,等待指示 / Stop immediately, report problem details, await instructions

🟡 **WARN** → 记录警告,尝试自动修复,在报告中标注 / Log warning, attempt auto-fix, annotate in report

🔵 **INFO** → 记录信息,正常继续 / Log information, continue normally
