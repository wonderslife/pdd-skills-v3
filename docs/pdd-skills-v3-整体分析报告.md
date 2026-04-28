# PDD-Skills-v3 整体分析报告

> 分析日期：2026-04-28
> 分析范围：项目架构、技能体系、代码实现、实战效果
> 分析基础：项目源码全量审阅 + 《ZCPG-3 共识 Bug 分析报告》实战数据

---

## 一、项目概览

### 1.1 项目定位
PDD-Skills-v3 是一个 **PRD 驱动的 AI 原生软件开发工作流框架**，核心理念是以产品需求文档 (PRD) 为驱动，通过编排一系列 AI 技能 (Skill)，实现从需求分析到代码交付的全链路自动化。

### 1.2 技术栈
- **运行时**：Node.js >= 18 (ESM)
- **依赖**：极简（仅 commander + chalk + fs-extra + yaml）
- **协议**：REST API + MCP + gRPC + SSE
- **SDK**：JavaScript + Python

### 1.3 规模统计

| 维度 | 数量 | 说明 |
|------|------|------|
| 技能总数 | 41+ | 核心(12) + 专家(10) + 熵减(4) + OpenSpec(10) + PR(7) |
| 代码文件 (lib/) | 23 文件 + 10 子目录 | CLI、API、SDK、缓存、插件、质量引擎等 |
| 配置文件 | 9 个 | bug-patterns / prd-rules / linter configs |
| Bug 模式 | 14 个 | 7 通用 + 7 若依专用 |
| PRD 规则 | 30 条 | 6 大类 |
| 脚手架模板 | 2 个 | Python Fullstack + 若依 RuoYi |

---

## 二、架构分析

### 2.1 目录结构图

```
pdd-skills-v3/
├── bin/pdd.js              # CLI 入口（13KB，所有命令注册）
├── index.js                # SDK 导出入口
├── package.json            # v3.1.2
│
├── skills/                 # ⭐ 核心资产：AI 技能定义
│   ├── core/               # 12 个核心流程技能
│   │   ├── pdd-main/       #   主编排器
│   │   ├── pdd-ba/         #   业务分析
│   │   ├── pdd-extract-features/
│   │   ├── pdd-generate-spec/
│   │   ├── pdd-implement-feature/
│   │   ├── pdd-code-reviewer/
│   │   ├── pdd-verify-feature/
│   │   ├── pdd-doc-change/
│   │   ├── pdd-doc-gardener/
│   │   ├── pdd-entropy-reduction/
│   │   ├── pdd-vm/
│   │   └── official-doc-writer/
│   ├── expert/             # 10 个专家技能
│   │   ├── expert-ruoyi/
│   │   ├── expert-activiti/
│   │   ├── expert-mysql/
│   │   ├── expert-security/
│   │   ├── expert-performance/
│   │   ├── expert-testcases/
│   │   ├── expert-ruoyi-permission/
│   │   ├── software-architect/
│   │   ├── software-engineer/
│   │   └── system-architect/
│   ├── entropy/            # 4 个熵减技能
│   ├── openspec/           # 10 个 OpenSpec 变更管理技能
│   └── pr/                 # 7 个 PR 管理技能
│
├── config/                 # 配置中心
│   ├── bug-patterns.yaml   # 14 个 Bug 模式库
│   ├── prd-rules.yaml      # 30 条 PRD 规则
│   ├── checkstyle.xml      # Java Linter
│   ├── eslint.config.js    # JS Linter
│   ├── pmd.xml             # Java 静态分析
│   ├── ruff.toml           # Python Linter
│   ├── sqlfluff.cfg        # SQL Linter
│   ├── bpmn-rules.yaml     # BPMN 流程规则
│   └── gate-config.yaml    # 质量门控配置
│
├── lib/                    # 运行时实现
│   ├── api-server.js       # HTTP 服务器
│   ├── api-routes.js       # REST API 路由
│   ├── mcp-server.js       # MCP 协议服务
│   ├── generate.js         # 代码生成引擎
│   ├── verify.js           # 验证引擎
│   ├── report.js           # 报告生成器
│   ├── sdk-base.js / sdk-js.js  # JS SDK
│   ├── cache/              # 三级缓存系统
│   ├── grpc/               # gRPC 兼容层
│   ├── iteration/          # 多轮迭代优化
│   ├── plugin/             # 插件系统
│   ├── quality/            # 五维质量评分
│   ├── token/              # Token 预算管理
│   ├── vm/                 # Visual Manager 数据层
│   ├── openclaw/           # OpenClaw 集成
│   └── sdk-python/         # Python SDK
│
├── templates/              # 模板资源
├── scaffolds/              # 项目脚手架
│   ├── python-fullstack/   # Python+Vue3 全栈模板
│   └── ruoyi/              # 若依框架模板
├── hooks/                  # 钩子系统
├── scripts/                # 脚本工具
├── testcases/              # 评估测试
├── ui/                     # Web Dashboard + TUI
└── docs/                   # 文档
```

### 2.2 架构层次

```
┌────────────────────────────────────────────────────────┐
│                  展示层 (Presentation)                  │
│  CLI (bin/pdd.js)  │  Web Dashboard (ui/)  │  TUI      │
├────────────────────────────────────────────────────────┤
│                  接口层 (Interface)                     │
│  REST API  │  MCP Protocol  │  gRPC  │  SSE  │  SDK   │
├────────────────────────────────────────────────────────┤
│                  编排层 (Orchestration)                 │
│  pdd-main（技能调度）│ Hook 系统 │ 状态管理 │ 断点续传   │
├────────────────────────────────────────────────────────┤
│                  技能层 (Skills)                        │
│  核心技能(12) │ 专家技能(10) │ 熵减(4) │ OpenSpec(10) │
├────────────────────────────────────────────────────────┤
│                  基础设施层 (Infrastructure)             │
│  缓存系统 │ Token管理 │ 质量引擎 │ Linter │ 插件沙箱    │
├────────────────────────────────────────────────────────┤
│                  配置层 (Configuration)                 │
│  bug-patterns.yaml │ prd-rules.yaml │ gate-config.yaml │
└────────────────────────────────────────────────────────┘
```

---

## 三、能力评估

### 3.1 核心优势 ✅

| 优势 | 说明 | 评价 |
|------|------|------|
| **完整的全量开发流水线** | PRD → BA → 特征提取 → 规格生成 → 代码实现 → 审查 → 验证，6 阶段闭环 | ⭐⭐⭐⭐⭐ 业界领先 |
| **行为塑造三层防御** | Iron Law（铁律）+ Rationalization Table（合理化防御）+ Red Flags（红旗警告），有效约束 AI 行为 | ⭐⭐⭐⭐⭐ 独创 |
| **Bug 模式库机制** | 集中式 `bug-patterns.yaml`，14 个已知模式，代码审查时自动匹配 | ⭐⭐⭐⭐ 实用 |
| **中英双语全覆盖** | 所有核心 Skill 都有完整的中英文版本 | ⭐⭐⭐⭐ 覆盖国际化场景 |
| **极简依赖** | 仅 4 个 npm 依赖，零外部服务依赖 | ⭐⭐⭐⭐ 部署友好 |
| **多协议接入** | REST + MCP + gRPC + SSE，适配不同 AI Agent | ⭐⭐⭐⭐ 灵活 |
| **MVP 分层交付策略** | 骨架层 → 功能层 → 体验层，避免黑盒开发 | ⭐⭐⭐⭐ 务实 |
| **上下文注入机制** | `pdd-implement-feature` Step 1.5 在代码生成前扫描已有代码 | ⭐⭐⭐ 方向正确但不够深入 |

### 3.2 核心短板 ❌

| 短板 | 严重程度 | 影响 | 实战证据 |
|------|---------|------|---------|
| **缺少增量修改/Bug修复流程** | 🔴 致命 | 72% 的 Bug 发生在"修改已有代码"场景，但框架无任何专属 Skill | 共识报告：48 次修改中 38 次是迭代式修复 |
| **缺少变更传播感知** | 🔴 严重 | AI 修改后端时不会自动检查前端是否需要同步修改 | A1/A2/A5 类 Bug（前后端参数/路径/结构不一致） |
| **缺少打版/部署变更记录** | 🟡 中等 | 修复 Bug 后无法自动生成运维友好的变更清单 | 上线系统每次修复都需要手动整理变更文件 |
| **状态/字典管理无规范** | 🟡 中等 | AI 在每个 Vue 文件中重复硬编码状态映射 | A4/A7/A17/A21 类 Bug（状态映射不完整/横向不一致） |
| **前后端契约关系不可见** | 🟡 中等 | 上下文注入只扫描 models/schemas/routes，不扫描 Controller↔API 的映射关系 | A5 类 Bug（API 路径 404） |
| **空目录过多** | 🟢 轻微 | `system/`、`framework/`、`common/` 均为空目录，占位但未实现 | 项目结构存在"规划过度、实现不足"的情况 |
| **Skill 粒度不均匀** | 🟢 轻微 | `pdd-main` 613 行 vs `pdd-doc-gardener` 可能很短；部分专家 Skill 功能重叠 | expert-ruoyi 与 expert-ruoyi-permission 边界不清 |

### 3.3 设计意图 vs 实际使用的错配

```
设计意图（全量开发流水线）          实际使用场景分布
┌──────────────────────┐         ┌──────────────────────┐
│ PRD → BA → 规格 →    │         │                      │
│ 代码生成 → 审查 → 验证 │  ~28%   │ 全量新功能开发        │  ~28%
│                      │         │                      │
├──────────────────────┤         ├──────────────────────┤
│                      │         │ 增量修改/Bug修复       │
│   （无对应 Skill）     │  ~0%    │ "改一下这个接口"       │  ~72%
│                      │         │ "这里显示不对"         │
└──────────────────────┘         └──────────────────────┘

             ⬆ 框架覆盖                    ⬆ 实际需求
```

> **核心洞察**：pdd-skills-v3 在"从 0 到 1"的全量开发上做到了业界顶尖水平，但在"从 1 到 1.1"的增量维护上几乎是空白。这是最大的战略短板。

---

## 四、逐模块细评

### 4.1 核心技能 (skills/core/)

| 技能 | 成熟度 | 优点 | 不足 |
|------|--------|------|------|
| `pdd-main` | ⭐⭐⭐⭐⭐ | 613 行，编排逻辑清晰，Phase 明确，断点续传 | 仅支持全量开发流程，无增量修改入口 |
| `pdd-implement-feature` | ⭐⭐⭐⭐ | Step 1.5 上下文注入是亮点，微验证机制好 | 上下文注入不够深：缺少前后端契约扫描和状态映射扫描 |
| `pdd-code-reviewer` | ⭐⭐⭐⭐ | Bug 模式库匹配 + UX 一致性审查 + 明确的职责边界 | Bug 模式库缺少前后端契约类模式（R008-R013） |
| `pdd-doc-change` | ⭐⭐⭐ | 文档变更管理完善 | 仅管理规格文档变更，不管理代码变更和部署记录 |
| `pdd-ba` | ⭐⭐⭐⭐ | 5W1H/MECE 方法论体系化 | — |
| `pdd-generate-spec` | ⭐⭐⭐⭐ | 自动生成 spec.md + checklist.md | — |
| `pdd-verify-feature` | ⭐⭐⭐ | 验收驱动 | — |

### 4.2 专家技能 (skills/expert/)

| 技能 | 成熟度 | 优点 | 不足 |
|------|--------|------|------|
| `expert-ruoyi` | ⭐⭐⭐⭐ | 548 行，覆盖权限/菜单/数据权限/代码生成/常见问题 | 缺少前后端联调规范（API路径拼接/附件模式/响应解析/页面生命周期） |
| `software-engineer` | ⭐⭐⭐⭐ | 代码质量规范完善，分层架构示例好 | 定位是通用工程师，缺少"Bug 修复"的专属模式 |
| `software-architect` | ⭐⭐⭐ | 架构决策模板 | — |
| `expert-security` | ⭐⭐⭐⭐ | OWASP Top 10 完整覆盖 | — |
| `expert-performance` | ⭐⭐⭐ | HikariCP/Redis/GC 调优 | — |

### 4.3 基础设施 (lib/)

| 模块 | 成熟度 | 说明 |
|------|--------|------|
| `cache/` (三级缓存) | ⭐⭐⭐⭐ | L1/L2/L3 分层，LRU/LFU 策略，O(1) 操作 |
| `quality/` (五维评分) | ⭐⭐⭐⭐ | 可读性/可维护性/健壮性/性能/安全，31 条规则 |
| `token/` (预算管理) | ⭐⭐⭐ | 五阶段分配模型 |
| `plugin/` (插件系统) | ⭐⭐⭐ | 沙箱隔离，3 个示例 |
| `vm/` (可视化) | ⭐⭐⭐ | Dashboard + TUI 双形态 |
| `api-server.js` | ⭐⭐⭐⭐ | 零依赖 HTTP，Rate Limiting + CORS |
| `mcp-server.js` | ⭐⭐⭐⭐ | JSON-RPC 2.0 标准 |

### 4.4 配置中心 (config/)

| 配置 | 成熟度 | 说明 |
|------|--------|------|
| `bug-patterns.yaml` | ⭐⭐⭐ | 14 个模式，但缺少前后端契约类（R008-R013） |
| `prd-rules.yaml` | ⭐⭐⭐⭐ | 30 条规则，6 大类 |
| Linter 配置集 | ⭐⭐⭐⭐ | Java/JS/Python/SQL/BPMN 全覆盖 |

### 4.5 空壳模块

| 目录 | 状态 | 建议 |
|------|------|------|
| `system/` | 空 | 移除或明确用途 |
| `framework/` | 空 | 移除或明确用途 |
| `common/` | 空 | 移除或明确用途 |

---

## 五、修改建议

### 5.1 高优先级 (P0) — 填补战略空白

#### 建议 1：新增 `expert-bug-fixer` 技能

**路径**：`skills/expert/expert-bug-fixer/SKILL.md`

**理由**：框架最大的短板是缺少增量修改/Bug 修复流程。72% 的实际工作落在这个场景，但无任何 Skill 支持。

**核心设计**：
- 四步 SOP：定位复现 → 五维影响分析 → 精准修复 → 生成变更发布单
- 强制输出"影响范围声明"，在修改代码前列出所有受影响文件并等待用户确认
- 修复完成后自动生成包含 DB/后端/前端/部署指引的标准变更发布单
- 与 `bug-patterns.yaml` 联动，修复时自检不引入已知 Bug 模式

#### 建议 2：扩充 `bug-patterns.yaml` (+6 模式)

新增 PATTERN-R008 至 R013：
- R008: API 路径拼接断层
- R009: 附件入参类型错误
- R010: 状态流转审批日志遗漏
- R011: 状态字典映射不完整
- R012: MyBatis 多参数 @Param 缺失
- R013: Service 接口方法未同步声明

### 5.2 中优先级 (P1) — 补强现有能力

#### 建议 3：增强 `expert-ruoyi`

在现有 SKILL.md 中追加三节规范：
- §6.3 前后端契约规范（API 路径拼接规则 + 附件处理标准模式 + 响应解析约定）
- §6.4 页面生命周期规范（列表→详情→返回的标准流程 + 状态字典统一管理）
- §6.5 状态流转规范（审批日志强制记录 + 状态判断优先查表而非推断）

#### 建议 4：增强 `pdd-implement-feature` 上下文注入

在 Step 1.5 中追加两项扫描：
- 扫描前后端契约关系（Controller @RequestMapping → 前端 API 调用 URL 的映射表）
- 扫描状态映射关系（所有包含 getStatusLabel/statusMap 等方法的文件列表）

#### 建议 5：新增变更发布单模板

**路径**：`templates/release-patch-template.md`

标准化的部署交付物模板，包含 DB 脚本、后端变更清单、前端变更清单、部署指引和回滚方案。

### 5.3 低优先级 (P2) — 治理技术债

#### 建议 6：清理空壳目录

删除或赋予实际用途：`system/`、`framework/`、`common/`

#### 建议 7：合并重叠的专家技能

评估 `expert-ruoyi` 和 `expert-ruoyi-permission` 的边界，考虑合并。

#### 建议 8：增强 `pdd-code-reviewer`

Bug 模式库匹配章节中追加 R008-R013 的检查项，与 `bug-patterns.yaml` 保持同步。

---

## 六、功能修改路线图

```
2026 Q2 (4-6月)                    2026 Q3 (7-9月)                    2026 Q4 (10-12月)
┌─────────────────────┐            ┌─────────────────────┐            ┌─────────────────────┐
│  Phase A: 补短板     │            │  Phase B: 深化增强   │            │  Phase C: 生态扩展   │
│                     │            │                     │            │                     │
│  ① 新增              │            │  ④ 依赖链感知引擎     │            │  ⑦ 项目契约自动发现   │
│    expert-bug-fixer  │───────────▶│    (轻量级索引)      │───────────▶│    (AST解析)        │
│                     │            │                     │            │                     │
│  ② 扩充              │            │  ⑤ pdd-main 分叉    │            │  ⑧ 多框架专家扩展    │
│    bug-patterns.yaml │            │    开发模式/维护模式  │            │    SpringCloud      │
│    (+6 模式)         │            │    的入口区分         │            │    微服务             │
│                     │            │                     │            │                     │
│  ③ 增强              │            │  ⑥ 自动化回归验证    │            │  ⑨ AI Agent 自治    │
│    expert-ruoyi      │            │    修复后自动触发     │            │    循环               │
│    pdd-implement     │            │    相关测试           │            │    (修复→验证→发布)  │
│    pdd-code-reviewer │            │                     │            │                     │
│                     │            │                     │            │                     │
│  预期效果:            │            │  预期效果:            │            │  预期效果:            │
│  Bug减少 30-40%      │            │  Bug减少 55-65%      │            │  Bug减少 70-80%      │
│  迭代轮次降低 30%     │            │  迭代轮次降低 50%     │            │  迭代轮次降低 60%     │
└─────────────────────┘            └─────────────────────┘            └─────────────────────┘
```

### Phase A: 补短板（2026 Q2，工作量 ~1-2 天）

| 序号 | 任务 | 优先级 | 工作量 | 预期收益 |
|------|------|--------|--------|---------|
| ① | 新增 `expert-bug-fixer` SKILL.md | P0 | 2-3 小时 | 增量修改场景从无到有 |
| ② | 扩充 `bug-patterns.yaml` (+6 模式) | P0 | 30 分钟 | 自动拦截 6 类已知 Bug |
| ③-a | 增强 `expert-ruoyi` (+3 节规范) | P1 | 1 小时 | 减少前后端联调 Bug |
| ③-b | 增强 `pdd-implement-feature` 上下文注入 | P1 | 30 分钟 | 提升代码生成精准度 |
| ③-c | 增强 `pdd-code-reviewer` 审查维度 | P2 | 15 分钟 | 审查覆盖面扩大 |
| ③-d | 新增 `templates/release-patch-template.md` | P1 | 15 分钟 | 标准化打版交付物 |

### Phase B: 深化增强（2026 Q3，工作量 ~1 周）

| 序号 | 任务 | 说明 |
|------|------|------|
| ④ | 依赖链感知引擎 | 在 lib/ 中实现轻量级的文件关系索引器，扫描 Controller↔API、状态映射等关系 |
| ⑤ | pdd-main 模式分叉 | 在 pdd-main 中区分"开发模式"（全量流水线）和"维护模式"（增量修复），维护模式直接调用 expert-bug-fixer |
| ⑥ | 自动化回归验证 | Bug 修复完成后自动触发 `pdd-verify-feature` 对受影响的功能点进行回归验证 |

### Phase C: 生态扩展（2026 Q4，工作量 ~2 周）

| 序号 | 任务 | 说明 |
|------|------|------|
| ⑦ | 项目契约自动发现 | 基于 AST 解析自动构建"后端接口 → 前端调用"的契约图，替代手工维护 |
| ⑧ | 多框架专家扩展 | 增加 expert-springcloud、expert-nextjs 等，扩大适用范围 |
| ⑨ | AI Agent 自治循环 | 实现"发现 Bug → 分析根因 → 生成补丁 → 运行测试 → 生成发布单"的全自动闭环 |

---

## 七、总结

### 一句话评价

> **PDD-Skills-v3 是一个在"全量开发"方向上做到极致的 AI 开发框架，但在"增量维护"这个占据日常工作 72% 的场景上几乎是空白——补上这个短板，它将从优秀变为卓越。**

### 关键行动项

1. **立即做**：新增 `expert-bug-fixer` + 扩充 `bug-patterns.yaml`（工作量 ~3 小时，收益最高）
2. **本月做**：增强 `expert-ruoyi` / `pdd-implement-feature` / `pdd-code-reviewer`（工作量 ~2 小时）
3. **下季度做**：依赖链感知引擎 + pdd-main 模式分叉（工作量 ~1 周）
