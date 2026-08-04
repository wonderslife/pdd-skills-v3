---
name: pdd-main
description: "PRD驱动开发的主入口Skill，协调pdd-ba/实现/审查等子技能完成从需求分析到代码交付的全流程。当用户基于PRD文档开发功能、从需求文档生成代码、执行PDD方法论、开发业务模块、'搞个功能'、'开发ZCCZ'时触发。支持中文触发：PRD驱动开发、PDD开发、功能开发、启动PDD、开发ZCCZ、搞个功能。"
license: MIT
compatibility: Requires complete PRD document system
metadata:
  author: neuqik@hotmail.com
  version: "3.4"
---

# PDD Main / PDD主入口 - PRD驱动开发编排器

**核心概念**: PDD (PRD-Driven Development / PRD驱动开发) 通过编排 system-architect、software-architect、software-engineer 和 expert-xxx 子技能，实现从需求分析到交付的全流程智能覆盖。**输入**: PRD文档路径|Bug描述；**输出**: 代码+验证报告|变更发布单。

## 双模式架构

pdd-main 依据用户输入自动路由两种模式：

| 模式 | 触发条件 | 流程 | 输出 |
|------|---------|------|------|
| **开发模式** | 提供PRD文档、模块编号、"开发功能" | 六阶段流水线(BA→提取→规格→实现→审查→验证) | 代码+验证报告 |
| **维护模式** | 描述Bug、报错、"改一下" | 委托 expert-bug-fixer(定位→影响→修复→发布单) | 修复代码+发布单 |

**路由规则**: 含"修复Bug/线上问题/改一下/不对/报错/显示异常/404"→进入维护模式；其他→进入开发模式。

**自治模式（实验性）**: 维护模式的自动化扩展，闭环"发现Bug→分析根因→生成补丁→自检模式库→生成发布单"。流程: 触发→`pdd deps impact`/`pdd contract`影响图→expert-bug-fixer四步SOP→pdd-verify-feature回归验证→合并发布单。⚠️ 修复涉及5+文件或触发CRITICAL Red Flag时，必须退出自治模式转人工维护。

## 方法论架构（三层）

- **主入口层(pdd-main)**: 流程编排|状态管理|上下文传递|结果聚合 → 不直接实现代码
- **PDD流程层**: pdd-ba→pdd-extract-features→pdd-generate-spec→pdd-implement-feature→pdd-code-reviewer→pdd-verify-feature
- **专业支持层**: 架构师(system-architect/software-architect)|工程师(software-engineer)|专家(expert-ruoyi/expert-activiti/expert-mysql/expert-code-quality/**expert-bug-fixer**/expert-springcloud/expert-vue3)
- **工具支持层**: `pdd deps scan/impact/orphans`依赖链引擎|`pdd contract`契约发现(AST级)

## 完整流程（六阶段）

1. **Phase 1 业务分析与功能提取**: PRD→5W1H分析→用例图→流程图→状态图→功能矩阵
2. **Phase 2 开发规格生成**: 功能矩阵→架构咨询(按需)→接口设计→数据模型→开发规格+验收标准
3. **Phase 3 功能循环实现**: 每功能(P0→P1→P2): 实现→审查→修复→验收
4. **Phase 3.5 MVP分层交付(推荐)**: 按MVP层级递进交付，每层独立可验证。MVP-1骨架层(数据模型+CRUD+种子数据)、MVP-2功能层(业务逻辑+状态流转+表单校验)、MVP-3体验层(UX+权限+样式)。每层完成向用户反馈再进入下一层。详见 `references/mvp-delivery.md`
5. **Phase 4 架构审查集成**: 按需调用 system-architect / software-architect
6. **Phase 5 专家技能集成**: 按需调用 expert-xxx
7. **Phase 6 交付与复盘**: 开发报告→文档归档→经验总结

## 工作步骤

### Step 1 解析输入与发现PRD文档
- **Mode A 模块编号自动发现**: 输入`ZCCZ-2`→扫描`docs/business-analysis/`匹配目录名→自动聚合设计文档
- **Mode B 手动指定文档**: 指定单个/多个设计文档路径(逗号或换行分隔)或目录(自动发现所有.md)
- **标准PRD结构**: `docs/business-analysis/{business-domain}/`含 PRD-{module}.md | UseCase-{module}.md | BusinessFlow-{module}.md | StateDiagram-{module}.md | SequenceDiagram-{module}.md(可选) | FormDesign/(可选)

### Step 2-3 确认模块信息与技术栈
提取模块编号和名称→分析项目技术栈确定技能调用策略: RuoYi框架→software-engineer+expert-ruoyi | 工作流→expert-activiti | 数据库密集型→expert-mysql | 架构设计→system-architect/software-architect

### Step 4-6 业务分析→功能提取→人工审核
pdd-ba(5W1H/MECE/CRUD) → pdd-extract-features(feature-matrix.md) → **等待用户审核**功能点矩阵的完整性/复杂度/测试策略/AI角色分配

### Step 7-8 规格生成→人工审核
pdd-generate-spec(spec.md+checklist.md) → 架构咨询(按需) → **等待用户审核**接口设计/数据模型/业务逻辑/测试用例

### Step 8.1 生成代码目录结构
**⚠️ 重要原则**: 新业务功能应创建独立Maven模块(命名`asset-{business-domain}`)，不要放在`asset-system`。模块编号→代码路径映射与前后端目录结构详见 `references/code-structure.md`。

### Step 9 循环实现每个功能
每功能(按P0→P1→P2): a.实现(pdd-implement-feature)→b.工程师执行(software-engineer)→c.专家咨询(按需)→d.代码审查(pdd-code-reviewer)→e.架构审查(按需)→f.处理审查结果(无Critical继续/有Critical修复重审)→g.功能验证(pdd-verify-feature)→h.处理验收结果(通过→完成|有条件通过→修复重验|未通过→重新开发)

### Step 10 输出开发报告

## AI协作模式

按功能复杂度自动选择AI角色策略(完整见 `references/ai-collaboration.md`):
- **P0**: 协作者+架构师+专家，人工参与度高
- **P1**: 协作者+架构师，人工参与度中
- **P2**: 主导者+工程师，人工参与度低

## 子技能列表

核心链: pdd-ba→pdd-extract-features→pdd-generate-spec→pdd-implement-feature→pdd-code-reviewer→pdd-verify-feature。完整子技能清单见 `references/sub-skills.md`。

## Guardrails / 安全护栏

- 必须在提取功能前执行业务分析
- 必须等待人工审核功能点矩阵和开发规格
- 必须在代码实现后执行代码审查
- 每个功能必须通过验收才能标记为完成
- 代码变更后必须同步更新规格文档
- 问题必须记录到经验教训库
- **架构决策必须咨询架构师技能**
- **技术问题必须咨询专家技能**
- **专家建议必须集成到代码实现**

## 需求变更处理

需求变更时: pdd-doc-change分析影响→更新规格文档→通知受影响功能→架构变更则system-architect重审|技术变更则expert-xxx重咨询→重新代码审查和验证

## PDD实现规范

完整规范见 [pdd-framework-design.md 第9章](../docs/pdd-framework-design.md#9-pdd-implementation-specification)。核心规范摘要(技能边界/上下文传递/人工审核/错误处理/PR管理/文档系统)与断点续传详见 `references/pdd-implementation-spec.md`。

## Iron Law / 核心铁律

1. **编排者不实现**: pdd-main只负责流程编排和状态管理，绝不直接编写业务代码。代码实现必须委托给 pdd-implement-feature 和 software-engineer。
2. **人工审核不可跳过**: 功能点矩阵确认、开发规格确认这两个关键节点必须等待人类明确确认后才能继续，不得自动通过。
3. **上下文完整性传递**: 每次调用子技能必须传递完整上下文(已完成阶段输出、当前状态、依赖关系)，不得让子技能自行推断缺失信息。
4. **幂等性恢复保障**: 断点续传时先读取 `.pdd-state.json` 恢复状态，而非从头开始；重复执行同一阶段不得产生重复产出物。
5. **架构决策专业化**: 涉及技术选型和系统架构的决策必须调用 system-architect 或 software-architect，不得由 pdd-main 自行做出架构判断。

**违规示例**: ❌ 直接在pdd-main生成Controller代码 | 跳过人工审核 | 不传子技能上下文 | 忽略状态重来 | 自行决定Redis方案
**合规示例**: ✅ 委托pdd-implement-feature并传spec路径 | 生成规格后暂停确认 | 传完整功能矩阵 | 读.pdd-state.json恢复 | 选型咨询system-architect

## Rationalization Table / 合理化防御表

| 陷阱 | 正确做法 |
|------|---------|
| "急着要，跳过审核" | 说明审核重要性，提供批量审核加速 |
| "功能简单，我自己写" | 委托 pdd-implement-feature + software-engineer |
| "子技能应该能找到文档" | 显式传递所有输入文件路径和上下文 |
| "架构师太慢，先按常见做法" | 必须等待架构师回复 |
| "上次成功，复用流程" | 按模块特性重新评估技能组合 |

**常见陷阱**: 流程自动化(移除审核→强制暂停点)|上下文压缩(截断上下文→最小必需清单)|技能堆砌(全调→按P0/P1/P2动态调整)|状态丢失(中断未保存→每阶段持久化到.pdd-state.json)

## Red Flags / 三层防御体系

### Layer 1: 输入防护
- **INPUT-PDD-001**: PRD路径不存在或无.md → 🔴 CRITICAL → 终止并提示检查路径
- **INPUT-PDD-002**: 模块编号格式不符 → 🟡 WARN → 提示确认，支持手动指定路径
- **INPUT-PDD-003**: 缺少PRD文档(唯一必填) → 🔴 CRITICAL → 提示至少提供PRD

### Layer 2: 执行防护
- **EXEC-PDD-001**: 在pdd-main直接写代码 → 🔴 CRITICAL → 阻止并委托实现类技能
- **EXEC-PDD-002**: 跳过功能点矩阵/规格人工审核 → 🔴 CRITICAL → 强制暂停并等待确认
- **EXEC-PDD-003**: 调用子技能未传完整上下文 → 🟡 WARN → 记录警告补默认值，报告中标注
- **EXEC-PDD-004**: 同一功能点重复标记完成 → 🟡 WARN → 检查状态文件是否损坏

### Layer 3: 输出防护
- **OUTPUT-PDD-001**: 开发报告缺功能点列表/验收状态 → 🔴 CRITICAL → 补充完整后输出
- **OUTPUT-PDD-002**: .pdd-state.json格式异常 → 🟡 WARN → 备份旧文件重新初始化
- **OUTPUT-PDD-003**: 交付物缺代码文件或验证报告 → 🔴 CRITICAL → 不标记完成，补齐缺失项

**触发处理**: 🔴 CRITICAL→立即停止报告等待指示 | 🟡 WARN→记录警告继续、报告中标注 | 🔵 INFO→记录信息正常继续

## 参考资料加载指引

按需加载 `references/` 下的参考资料：
- `references/mvp-delivery.md` - MVP三层交付模型与实现清单
- `references/code-structure.md` - 模块编号→代码路径映射与目录结构
- `references/sub-skills.md` - 完整子技能清单
- `references/ai-collaboration.md` - AI协作与复杂度策略
- `references/pdd-implementation-spec.md` - 实现规范摘要与断点续传

**加载策略**: 常规流程用SKILL.md内置知识；需要清单/映射/策略时按需加载对应 references 文件。