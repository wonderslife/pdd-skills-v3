---
name: pdd-entropy-reduction
description: PDD Entropy Reduction Agent monitoring technical debt and preventing system decay. Invoke for code cleanup, documentation updates, debt management, or garbage collection. 支持中文触发：熵减、技术债务、代码清理。
license: MIT
metadata:
  author: neuqik@hotmail.com
  version: "2.0"
  parent: pdd-main
  triggers:
    - "熵减" | "清理技术债务" | "代码清理"
    - "文档更新" | "技术债务管理" | "架构对齐"
---

# PDD Entropy Reduction Agent - 熵减智能体 / Entropy Reduction Agent for Continuous System Hygiene

## 核心理念 / Core Philosophy

### 🇨🇳 核心理念

> "Technical debt is like a high-interest loan: it's better to continuously repay the debt in small amounts than to let it accumulate and then painfully resolve it all at once." —— OpenAI Harness Engineering

**目标**: 通过定期运行智能体来发现文档不一致或违反架构约束的情况,**对抗系统的熵增与衰减**。

### 熵增自然趋势 vs 熵减干预

| 熵增表现(自然趋势) | 熵减对策(需要能量输入) |
|------------------|---------------------|
| 代码腐化(重复代码/过长函数/命名不一致) | 重构(消除重复/简化复杂度) |
| 文档过时(代码与文档不同步/注释过时) | 文档更新(同步文档与代码) |
| 技术债务累积(未处理的TODO/临时方案) | 债务偿还(处理TODO/优化临时方案) |
| 架构漂移(违反依赖方向/边界模糊) | 架构对齐(修复违规/加强边界) |
| 测试不足(覆盖率下降/测试过时) | 测试补充(增加覆盖率/更新测试) |

### 🇺🇸 Core Philosophy

> "Technical debt is like a high-interest loan: it's better to continuously repay the debt in small amounts than to let it accumulate and then painfully resolve it all at once." —— OpenAI Harness Engineering

**Goal**: Proactively detect documentation inconsistencies and architecture violations through scheduled agent runs, **combating system entropy and decay**.

#### Natural Entropy Growth vs. Entropy Reduction Intervention

| Entropy Manifestation (Natural Trend) | Countermeasure (Requires Energy Input) |
|--------------------------------------|---------------------------------------|
| Code rot (duplicate code / long functions / naming inconsistencies) | Refactoring (eliminate duplication / simplify complexity) |
| Stale documentation (code-doc drift / outdated comments) | Documentation updates (sync docs with code) |
| Technical debt accumulation (unhandled TODOs / workarounds) | Debt repayment (address TODOs / optimize workarounds) |
| Architecture drift (dependency direction violations / blurred boundaries) | Architecture alignment (fix violations / strengthen boundaries) |
| Insufficient testing (declining coverage / stale tests) | Test supplementation (increase coverage / update tests) |

## 四大专业子技能 / Four Professional Sub-Skills

### 🇨🇳 四大专业子技能

协调器(pdd-entropy-reduction)负责调度和聚合结果,不直接执行具体操作:

| 子技能 | 职责 | 检测项 | 行动 |
|--------|------|--------|------|
| **pdd-doc-gardener** | 文档园丁 | 代码与文档不一致/注释过时/API文档不匹配 | 自动创建修复PR |
| **expert-arch-enforcer** | 架构约束强制 | 模块依赖方向违规/边界数据缺失/文件过大/命名违规 | 运行自定义Linter检测偏差 |
| **expert-entropy-auditor** | 熵增审计 | PRD与代码不一致/规格与代码不一致/AI残渣/分散工具类 | 归集到共享工具包 |
| **expert-auto-refactor** | 自动化重构 | 重复代码/复杂逻辑/命名优化 | 定期发起针对性重构PR |

### 🇺🇸 Four Professional Sub-Skills

The coordinator (pdd-entropy-reduction) is responsible for scheduling and aggregating results; it does not directly execute specific operations:

| Sub-Skill | Responsibility | Detection Items | Action |
|-----------|---------------|-----------------|--------|
| **pdd-doc-gardener** | Documentation Gardener | Code-doc inconsistencies / stale comments / API doc mismatches | Auto-create fix PRs |
| **expert-arch-enforcer** | Architecture Constraint Enforcer | Module dependency direction violations / missing boundary data / oversized files / naming violations | Run custom Linter to detect deviations |
| **expert-entropy-auditor** | Entropy Auditor | PRD-code inconsistencies / spec-code discrepancies / AI residue / scattered utility classes | Consolidate into shared utility packages |
| **expert-auto-refactor** | Automated Refactorer | Duplicate code / complex logic / naming optimization | Periodically initiate targeted refactoring PRs |

## 工作流程 / Workflow

### 🇨🇳 工作流程

触发(手动/定时/事件) → 扫描(文档/代码/架构) → 分析(熵评分/分类/优先级) → 执行(自动修复/创建PR/更新文档)

### 熵评分系统 (0-100分,100=最有秩序)

| 分数范围 | 状态 | 建议行动 |
|--------|------|---------|
| 90-100 | 优秀 | 维持现状 |
| 70-89 | 良好 | 小幅改进 |
| 50-69 | 一般 | 计划清理 |
| 30-49 | 警告 | 优先处理 |
| 0-29 | 危急 | 紧急重构 |

### 🇺🇸 Workflow

Trigger (manual / scheduled / event) → Scan (docs / code / architecture) → Analyze (entropy score / categorization / priority) → Execute (auto-fix / create PR / update docs)

#### Entropy Scoring System (0-100 points, 100 = most orderly)

| Score Range | Status | Recommended Action |
|-------------|--------|-------------------|
| 90-100 | Excellent | Maintain status quo |
| 70-89 | Good | Minor improvements |
| 50-69 | Fair | Plan cleanup |
| 30-49 | Warning | Prioritize handling |
| 0-29 | Critical | Emergency refactoring |

## 执行指南 / Execution Guide

### 🇨🇳 执行指南

### Step 1: 熵增检测
选择范围: 全量检测 | 仅文档 | 仅架构 | 仅代码

### Step 2: 生成熵减报告
使用 `references/entropy-report-template.md`,包含: 熵评分 | 问题列表(按优先级排序) | 修复建议 | 预估工作量

### Step 3: 熵减执行

| 问题类型 | 执行方式 | 人工确认 |
|--------|---------|---------|
| 简单修复(命名/格式) | 自动修复提交 | 否 |
| 中等修复(文档更新) | 创建PR | 是 |
| 复杂修复(重构) | 创建Issue+PR | 是 |

### 🇺🇸 Execution Guide

#### Step 1: Entropy Detection
Select scope: Full scan | Docs only | Architecture only | Code only

#### Step 2: Generate Entropy Reduction Report
Use `references/entropy-report-template.md`, containing: Entropy score | Issue list (sorted by priority) | Fix recommendations | Estimated effort

#### Step 3: Execute Entropy Reduction

| Issue Type | Execution Method | Human Confirmation |
|------------|------------------|-------------------|
| Simple fix (naming / formatting) | Auto-fix commit | No |
| Medium fix (documentation update) | Create PR | Yes |
| Complex fix (refactoring) | Create Issue + PR | Yes |

## 黄金原则 / Golden Rules

### 🇨🇳 黄金原则

1. **使用共享工具包,避免手写辅助函数** - 集中管理不变量,减少重复代码
2. **验证边界数据,不猜测数据结构** - 所有API入口必须有Schema验证
3. **保持代码简洁,优先可读性** - 单文件≤300行,单函数≤50行
4. **文档即代码,保持同步** - 代码变更必须同步文档,过时文档=技术债务
5. **小额还贷,持续改进** - 每次commit都是改进机会,不让债务累积

### 🇺🇸 Golden Rules

1. **Use shared utility packages; avoid writing ad-hoc helper functions** — Centralize invariants to reduce code duplication.
2. **Validate boundary data; never guess data structures** — All API entry points must have schema validation.
3. **Keep code concise; prioritize readability** — Single file ≤300 lines, single function ≤50 lines.
4. **Documentation is code; keep them in sync** — Code changes must be reflected in documentation; stale docs = technical debt.
5. **Small repayments; continuous improvement** — Every commit is an improvement opportunity; never let debt accumulate.

## 配置文件 (`entropy-config.yaml`) / Configuration File

### 🇨🇳 配置文件

```yaml
entropy_reduction:
  triggers:
    schedule: "0 2 * * *"  # 每天凌晨2点
    on_commit: false
    on_pr_merge: true
  detection:
    docs:
      enabled: true
      paths: ["docs/", "*.md"]
      max_age_days: 30
    architecture:
      enabled: true
      layers: ["types", "config", "repo", "service", "runtime", "ui"]
    code:
      enabled: true
      max_file_lines: 300
      max_function_lines: 50
  execution:
    auto_fix: true
    create_pr: true
    max_pr_per_run: 5
```

### 🇺🇸 Configuration File (`entropy-config.yaml`)

```yaml
entropy_reduction:
  triggers:
    schedule: "0 2 * * *"  # Daily at 2:00 AM
    on_commit: false
    on_pr_merge: true
  detection:
    docs:
      enabled: true
      paths: ["docs/", "*.md"]
      max_age_days: 30
    architecture:
      enabled: true
      layers: ["types", "config", "repo", "service", "runtime", "ui"]
    code:
      enabled: true
      max_file_lines: 300
      max_function_lines: 50
  execution:
    auto_fix: true
    create_pr: true
    max_pr_per_run: 5
```

## 输出格式 / Output Format

### 🇨🇳 输出格式

每次熵减执行后生成报告保存到 `docs/entropy-reports/`:

```markdown
# Entropy Reduction Report - YYYY-MM-DD
## Entropy Score: XX/100
## Issue List: Critical(N) / Warning(N) / Info(N)
## Fix Recommendations & Execution Results
```

### 🇺🇸 Output Format

After each entropy reduction run, generate a report saved to `docs/entropy-reports/`:

```markdown
# Entropy Reduction Report - YYYY-MM-DD
## Entropy Score: XX/100
## Issue List: Critical(N) / Warning(N) / Info(N)
## Fix Recommendations & Execution Results
```

## 与PDD流程集成 / PDD Process Integration

### 🇨🇳 与PDD流程集成

PDD正向流程(PRD→功能提取→规格设计→代码实现→验收测试) ←→ PDD熵减流程(熵增检测→熵减报告→熵减执行→自动修复→PR创建)

### 🇺🇸 PDD Process Integration

PDD Forward Flow (PRD → Feature Extraction → Spec Design → Code Implementation → Acceptance Testing) ←↔ PDD Entropy Reduction Flow (Entropy Detection → Entropy Report → Entropy Execution → Auto-Fix → PR Creation)

---

## Iron Law / 铁律

### 🇨🇳 Iron Law (中文)

1. **子技能协调不替代**: pdd-entropy-reduction是协调器,负责调度和聚合结果,不得直接执行子技能的具体检测或修复操作。

2. **熵评分客观化**: 熵评分必须基于可量化指标(代码重复率/文档过时率/架构违规数等),不得凭主观感觉给分。

3. **修复策略分级**: 必须根据问题类型和严重程度选择合适策略(自动修复/创建PR/人工介入),不得一刀切。

4. **变更影响可控**: 每次熵减操作的变更范围必须可控(如限制单次PR修改文件数量),避免大规模重构引入新风险。

5. **执行结果可度量**: 每次执行前后都必须有明确度量对比(熵分变化/修复问题数/引入新问题数),无法度量的改进等于没做。

**违规示例**: ❌ 直接编写代码修复逻辑而非调用auto-refactor | ❌ 给出"感觉代码质量不太好"式的模糊评分 | ❌ 对所有问题都尝试自动修复 | ❌ 一次提交50+文件 | ❌ 只说"清理完成"而无量化结果

**合规示例**: ✅ 调用doc-gardener扫描文档,arch-enforcer检查架构 | ✅ 评分报告:文档过时率15%,架构违规2处,代码重复率8% → 总分72/100 | ✅ Critical自动修复,Warning创建PR,Suggestion待观察 | ✅ 单次PR≤5文件 | ✅ 报告含:执行前68分→后82分,修复Critical 3个

### 🇺🇸 Iron Law (English)

1. **Sub-skill coordination, not substitution**: pdd-entropy-reduction is a coordinator responsible for scheduling and aggregating results. It must NOT directly execute specific detection or repair operations of sub-skills.

2. **Objective entropy scoring**: Entropy scores must be based on quantifiable metrics (code duplication rate / documentation staleness rate / architecture violation count, etc.). Subjective feelings are not acceptable.

3. **Tiered fix strategies**: Must select appropriate strategy based on issue type and severity (auto-fix / create PR / human intervention). One-size-fits-all approaches are prohibited.

4. **Controlled change impact**: The scope of each entropy reduction operation must be controllable (e.g., limit the number of files modified per PR). Avoid introducing new risks through large-scale refactoring.

5. **Measurable execution results**: Every run must have clear before/after metric comparisons (entropy score change / issues fixed / new issues introduced). Unmeasurable improvements are equivalent to doing nothing.

**Violation Examples**: ❌ Writing code fix logic directly instead of calling auto-refactor | ❌ Giving vague scores like "code quality doesn't feel great" | ❌ Attempting auto-fix for all issues | ❌ Committing 50+ files at once | ❌ Saying "cleanup complete" without quantitative results

**Compliance Examples**: ✅ Call doc-gardener to scan docs, arch-enforcer to check architecture | ✅ Scoring report: doc staleness 15%, 2 arch violations, 8% code duplication → Total 72/100 | ✅ Auto-fix Critical, create PR for Warning, monitor Suggestions | ✅ Single PR ≤5 files | ✅ Report includes: Before 68 → After 82, fixed 3 Critical issues

---

## Rationalization Table / 理性化对照表

### 🇨🇳 理性化对照表

| 你可能的想法 | 请问自己 | 应该怎么做 |
|-------------|---------|-----------|
| "子技能太慢了,我直接做吧" | 协调器价值在于专业化分工,越职会导致质量下降 | 坚持调度模式,委托给对应专家技能 |
| "熵评分差不多给个整数就行" | 模糊评分无法指导优先级决策 | 建立量化评分模型,每个维度都有计算公式 |
| "反正都是修复,一起提交吧" | 大批量变更会增加review难度和回滚风险 | 设定单次变更上限,超阈值必须拆分 |
| "这次先清理明显的,深层的以后再说" | 熵增是持续过程,推迟深层问题会导致债务累积 | 每次执行覆盖全部维度,但按优先级分配精力 |
| "应该没什么风险,不用验证了吧" | 熵减本身也可能引入新问题 | 执行后必须验证:编译通过/测试通过/功能正常 |

### 🇺🇸 Rationalization Table

| # | Trap / 陷阱 | Question | Action |
|---|-------------|----------|--------|
| 1 | "子技能太慢了,我直接做吧" / "Sub-skills are too slow, I'll do it myself" | The coordinator's value lies in specialized division of labor; overstepping leads to quality degradation | Stick to the dispatch pattern; delegate to the corresponding expert skill |
| 2 | "熵评分差不多给个整数就行" / "Just give entropy score a round number" | Vague scores cannot guide prioritization decisions | Establish a quantitative scoring model with formulas for each dimension |
| 3 | "反正都是修复,一起提交吧" / "It's all fixes anyway, commit them together" | Large batch changes increase review difficulty and rollback risk | Set per-change limits; exceeding threshold requires splitting |
| 4 | "这次先清理明显的,深层的以后再说" / "Clean obvious ones first, deep issues later" | Entropy growth is continuous; postponing deep issues causes debt accumulation | Cover all dimensions each run but allocate effort by priority |
| 5 | "应该没什么风险,不用验证了吧" / "Probably no risk, skip verification" | Entropy reduction itself may introduce new problems | Must verify after execution: compile passes / tests pass / functionality normal |

**常见陷阱 / Common Traps**:

1. **"全能选手"陷阱 / "Jack-of-all-trades" Trap**: 协调器试图自己完成所有工作 → 明确职责:协调器只负责调度、聚合、报告 / Coordinator tries to do everything → Clarify role: coordinator only handles dispatch, aggregation, reporting
2. **"模糊评分"陷阱 / "Vague Scoring" Trap**: 评分缺乏量化依据 → 建立评分模型:指标+权重+计算方法 / Scoring lacks quantifiable basis → Build scoring model: metrics + weights + calculation methods
3. **"暴力清洗"陷阱 / "Violent Cleanup" Trap**: 一次性大规模修改导致高风险 → 安全阈值:单次修改≤5文件,删除≤100行 / One-time large-scale changes cause high risk → Safety threshold: ≤5 files per change, ≤100 lines deleted
4. **"无闭环"陷阱 / "No Closed Loop" Trap**: 执行了熵减但没有验证效果 → 强制要求执行报告含前后对比+回归验证 / Executed entropy reduction without verifying results → Mandate execution reports include before/after comparison + regression verification

---

## Red Flags / 红旗警告

### 🇨🇳 Red Flags (中文)

### Layer 1: 输入检查
- **INPUT-ER-001**: 项目目录不存在或无法访问 → 🔴 CRITICAL → 终止并提示检查路径
- **INPUT-ER-002**: entropy-config.yaml缺失 → 🔵 INFO → 使用默认配置
- **INPUT-ER-003**: 未指定检测范围 → 🔵 INFO → 默认全量检测

### Layer 2: 执行检查
- **EXEC-ER-001**: 协调器直接执行子技能的具体操作 → 🟡 WARN → 改为调用对应子技能
- **EXEC-ER-002**: 熵评分缺少量化计算过程 → 🔴 CRITICAL → 补充评分模型说明
- **EXEC-ER-003**: 单次修复超过配置上限 → 🔴 CRITICAL → 拆分为多批次
- **EXEC-ER-004**: 自动修复未生成备份 → 🟡 WARN → 执行前创建备份

### Layer 3: 输出检查
- **OUTPUT-ER-001**: 熵减报告缺少执行前后对比 → 🔴 CRITICAL → 补充对比数据
- **OUTPUT-ER-002**: 报告缺少后续行动计划 → 🟡 WARN → 补充下一步建议
- **OUTPUT-ER-003**: 报告声明"已修复"但缺验证证据 → 🔴 CRITICAL → 补充验证结果

### 触发Red Flag时的处理流程
🔴 CRITICAL → 立即停止,报告问题详情,等待指示 | 🟡 WARN → 记录警告,尝试自动修复,在报告中标注 | 🔵 INFO → 记录信息,正常继续

### 🇺🇸 Red Flags (English)

#### Layer 1: Input Validation Guards / 输入检查防护
- **INPUT-ER-001**: Project directory does not exist or is inaccessible → 🔴 CRITICAL → Terminate and prompt to check path / 终止并提示检查路径
- **INPUT-ER-002**: entropy-config.yaml missing → 🔵 INFO → Use default configuration / 使用默认配置
- **INPUT-ER-003**: Detection scope not specified → 🔵 INFO → Default to full scan / 默认全量检测

#### Layer 2: Execution Guards / 执行检查防护
- **EXEC-ER-001**: Coordinator directly executes sub-skill operations → 🟡 WARN → Change to call the corresponding sub-skill / 改为调用对应子技能
- **EXEC-ER-002**: Entropy score lacks quantitative calculation process → 🔴 CRITICAL → Add scoring model documentation / 补充评分模型说明
- **EXEC-ER-003**: Single fix exceeds configured limit → 🔴 CRITICAL → Split into multiple batches / 拆分为多批次
- **EXEC-ER-004**: Auto-fix did not create backup → 🟡 WARN → Create backup before execution / 执行前创建备份

#### Layer 3: Output Validation Guards / 输出检查防护
- **OUTPUT-ER-001**: Entropy reduction report lacks before/after comparison → 🔴 CRITICAL → Add comparison data / 补充对比数据
- **OUTPUT-ER-002**: Report lacks follow-up action plan → 🟡 WARN → Add next-step recommendations / 补充下一步建议
- **OUTPUT-ER-003**: Report claims "fixed" but lacks verification evidence → 🔴 CRITICAL → Add verification results / 补充验证结果

#### Red Flag Trigger Handling / 触发红旗时的处理流程

| Severity | Chinese Description | English Description | Action |
|----------|-------------------|---------------------|--------|
| 🔴 CRITICAL | 立即停止,报告问题详情,等待指示 | Stop immediately, report problem details, await instructions | Halt execution and escalate |
| 🟡 WARN | 记录警告,尝试自动修复,在报告中标注 | Log warning, attempt auto-fix, annotate in report | Continue with mitigation |
| 🔵 INFO | 记录信息,正常继续 | Log information, continue normally | Proceed without interruption |
