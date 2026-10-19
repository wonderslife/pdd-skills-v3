# PDD-Skills v3.3.1

> 从需求文档到代码交付的全链路自动化平台 — **7 大 Phase**、**49 个技能**、**14 个 Bug 模式**、**30 条 PRD 规则**、**4 级质量门控**
>
> **English**: End-to-end automation platform from PRD to code delivery — **7 Phases**, **49 Skills**, **14 Bug Patterns**, **30 PRD Rules**, **4-Level Quality Gates**

***
#特此声明：本项目来源于https://github.com/wonderslife/pdd-skills-v3
## 目录 / Table of Contents

- [什么是 PDD-Skills？ / What is PDD-Skills?](#什么是-pdd-skills--what-is-pdd-skills)
- [核心特性 / Core Features](#核心特性--core-features)
- [快速开始 / Quick Start](#快速开始--quick-start)
- [CLI 命令大全 / CLI Commands](#cli-命令大全--cli-commands)
- [七大 Phase 架构 / Seven Phase Architecture](#七大-phase-架构--seven-phase-architecture)
  - [Phase 1: 基础设施建设 / Infrastructure](#phase-1-基础设施建设--infrastructure)
  - [Phase 2: 核心能力增强 / Core Capabilities](#phase-2-核心能力增强--core-capabilities)
  - [Phase 3: 专家系统扩展 / Expert Systems](#phase-3-专家系统扩展--expert-systems)
  - [Phase 4: 平台化建设 / Platformization](#phase-4-平台化建设--platformization)
  - [Phase 5: 智能化升级 / Intelligence Upgrade](#phase-5-智能化升级--intelligence-upgrade)
  - [Phase 6: 生态建设 / Ecosystem](#phase-6-生态建设--ecosystem)
  - [📊 Phase 7: PDD Visual Manager / Visual Manager](#-phase-7-pdd-visual-manager--visual-manager)
- [技能系统 / Skill System](#技能系统--skill-system)
- [★ 界面设计规范 / Design Spec](#-界面设计规范--design-spec-new-v330)
- [配置中心 / Configuration Center](#配置中心--configuration-center)
- [★ 测试用例系统 / Testcase System](#-测试用例系统--testcase-system-new-v320)
- [API 层 / API Layer](#api-层--api-layer)
- [MCP 协议集成 / MCP Protocol Integration](#mcp-协议集成--mcp-protocol-integration)
- [SDK 使用指南 / SDK Guide](#sdk-使用指南--sdk-guide)
- [智能引擎 / Intelligence Engine](#智能引擎--intelligence-engine)
- [插件系统 / Plugin System](#插件系统--plugin-system)
- [OpenClaw 集成 / OpenClaw Integration](#openclaw-集成--openclaw-integration)
- [项目结构 / Project Structure](#项目结构--project-structure)
- [配置说明 / Configuration](#配置说明--configuration)
- [开发指南 / Development Guide](#开发指南--development-guide)
- [质量保障加固 / Quality Assurance Hardening](#质量保障加固--quality-assurance-hardening)
- [版本历史 / Version History](#版本历史--version-history)

***

## 什么是 PDD-Skills？ / What is PDD-Skills?

**PDD (PRD-Driven Development)** 是一种以 **产品需求文档 (PRD)** 为驱动的 AI 原生软件开发方法论。PDD-Skills 是该方法的完整工具链实现，覆盖从需求分析到代码交付的完整生命周期。

> **English**: **PDD (PRD-Driven Development)** is an AI-native software development methodology driven by **Product Requirement Documents (PRD)**. PDD-Skills is the complete toolchain implementation of this method, covering the full lifecycle from requirements analysis to code delivery.

### 核心理念 / Core Philosophy

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   PRD 文档   │───▶│  特征提取    │───▶│  规格生成    │───▶│  代码实现    │───▶│  验证报告    │
│  PRD Doc    │    │  Extract    │    │  Generate   │    │ Implement   │    │   Verify    │
│  pdd-ba     │    │ pdd-extract │    │ pdd-generate│    │ pdd-implement│   │  pdd-verify │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       ▲                   ▲                   ▲                   ▲                   ▲
       │                   │                   │                   │                   │
  业务分析师            AI Agent           AI Agent          开发者              QA
  Business Analyst     AI Agent           AI Agent          Developer           QA
```

### 为什么选择 PDD-Skills？ / Why PDD-Skills?

| 特性 / Feature | 传统开发 / Traditional | TDD | **PDD-Skills** |
| ----- | ---- | ---- | -------------------------- |
| 驱动文档 / Driver Doc | 无/弱 / None/Weak | 测试用例 / Test Cases | **PRD 需求文档 / PRD Docs** |
| AI 原生 / AI Native | ❌ | ❌ | ✅ **深度集成 / Deep Integration** |
| 双语支持 / Bilingual | ❌ | ❌ | ✅ **🇨🇳🇺🇸 中英双语 / CN/EN** |
| 行为塑造 / Behavior Shaping | ❌ | ❌ | ✅ **Iron Law + Red Flags** |
| 质量门禁 / Quality Gates | 弱 / Weak | 强 / Strong | ✅ **5维评分 + Linter / 5D Scoring** |
| 可视化监控 / Visualization | ❌ | ❌ | ✅ **PDD Visual Manager** |
| 插件扩展 / Plugins | 有限 / Limited | 有限 / Limited | ✅ **沙箱隔离插件系统 / Sandbox Plugins** |
| 多协议 / Multi-Protocol | 单一 / Single | 无 / None | ✅ **REST + MCP + gRPC** |

***

## 核心特性 / Core Features

### 🎯 七大能力矩阵 / Seven Capability Matrix

> **English**: **PDD-Skills v3.2.1 Capability Panorama**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       PDD-Skills v3.2.1 能力全景图 / Capability Panorama        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                        │
│  │ Phase 1  │  │ Phase 2  │  │ Phase 3  │  │ Phase 4  │                        │
│  │ 基础设施  │  │ 核心能力  │  │ 专家系统  │  │ 平台化    │                        │
│  │Infrastructure│Core Capabilities│Expert Systems│Platformization│             │
│  │ • npx安装   │  │ • 11核心   │  │ • 安全     │  │ • CLI    │                        │
│  │ • Linter   │  │   技能     │  │ • 性能     │  │ • API    │                        │
│  │ • Hook     │  │ • i18n    │  │   专家     │  │ • MCP    │                        │
│  │ • Evals    │  │ • CSO     │  │          │  │ • JS SDK │                        │
│  │            │  │ • Token   │  │          │  │ • Python │                        │
│  └──────────┘  │ • Evals   │  └──────────┘  │ • gRPC   │                        │
│                └──────────┘                └──────────┘                        │
│                                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                                      │
│  │ Phase 5  │  │ Phase 6  │  │ Phase 7  │                                      │
│  │ 智能化   │  │ 生态建设  │  │ VM可视化 │                                      │
│  │Intelligence│Ecosystem  │Visualization│                                      │
│  │ • 三级缓存  │  │ • 插件     │  │ • Web    │                                      │
│  │ • Token    │  │   系统     │  │ Dashboard│                                      │
│  │   预算     │  │ • OpenClaw│  │ • TUI    │                                      │
│  │ • 质量评分  │  │ • 社区文档  │  │ • SSE    │                                      │
│  │ • 迭代优化  │  │          │  │ • Canvas │                                      │
│  └──────────┘  └──────────┘  └──────────┘                                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 📊 关键数据 / Key Metrics

| 指标 / Metric | 数值 / Value |
| -------------- | ------------------------------------------------------- |
| **版本 / Version** | **v3.2.1** |
| **核心技能 / Core Skills** | 12 个（全双语 / Full Bilingual 🇨🇳🇺🇸） |
| **专家技能 / Expert Skills** | **14 个**（安全/性能/MySQL/若依/若依权限/Activiti/Vue3/微服务/Bug修复/测试用例建模/测试执行/架构/工程/系统） |
| **熵减技能 / Entropy Skills** | 4 个（审计 + 架构约束 + 代码质量 + 自动重构）；扫描器支持 **JS/TS/Python/Java**，评分按 **KLOC 密度归一化** |
| **OpenSpec技能 / OpenSpec Skills** | 10 个（变更管理全生命周期 / Full Lifecycle） |
| **PR技能 / PR Skills** | 7 个（模板引擎 + 多轮审查 + PR创建/审查/合并/批量/任务管理） |
| **Bug模式库 / Bug Patterns** | 14 个（7通用 + 7若依专用），集中式管理 `config/bug-patterns.yaml` |
| **PRD规则 / PRD Rules** | 30 条（6大类 / 6 Categories），集中式管理 `config/prd-rules.yaml`，其中 7 条为阻断规则 |
| **质量门控 / Quality Gates** | 4级（Blocker/Critical/Warning/Info）+ 0-100评分 + **静默失效防护**（跳过≠通过，豁免必计数） |
| **协议支持 / Protocols** | RESTful + MCP + gRPC + SSE |
| **SDK 语言 / SDK Languages** | JavaScript + Python |

***

## 快速开始 / Quick Start

### 安装 / Installation

```bash
# 全局安装（推荐 / Recommended）
npm install -g pdd-skills

# 或本地安装 / Or local install
npm install pdd-skills
```

<details>
<summary>⚙️ 环境要求 / Environment Requirements</summary>

- **Node.js**: >= 18.0.0 (ESM 模块支持 / ESM Module Support)
- **操作系统 / OS**: Windows / macOS / Linux
- **依赖 / Dependencies**: commander ^12.0.0, chalk ^5.3.0, fs-extra ^11.2.0, yaml ^2.3.0

</details>

### 5 分钟上手 / 5-Minute Quickstart

```bash
# 1️⃣ 初始化项目 / Initialize project
pdd init my-project
cd my-project

# 2️⃣ 查看可用技能 / List available skills
pdd list --json

# 3️⃣ 编写你的 PRD 文档（或使用模板）/ Write your PRD (or use template)
cp templates/prd-template.prdx ./my-feature.prdx

# 4️⃣ 提取功能特征 / Extract features
npx pdd-skills extract-features ./my-feature.prdx

# 5️⃣ 生成开发规格 / Generate specifications
npx pdd-skills generate-spec ./my-feature.prdx -o ./specs

# 6️⃣ 生成界面设计规范 / Generate design spec（★ 新增 / NEW）
#    对话触发："生成界面规范" → 产出 ui/DESIGN.md
node .skills/pdd-design-spec/scripts/gen-design-scaffold.js --prd ./my-feature.prdx
node .skills/pdd-design-spec/scripts/check-design.js ./ui/DESIGN.md

# 7️⃣ 基于规格生成代码骨架 / Generate code skeleton
pdd generate -s ./specs/spec.md -o ./src --dry-run

# 8️⃣ 验证实现 / Verify implementation
pdd verify -s ./specs/spec.md -c ./src --json

# 9️⃣ 生成质量报告 / Generate quality report
pdd report -t html -o ./reports
```

***

## CLI 命令大全 / CLI Commands

### 项目管理 / Project Management

```bash
pdd init [path]              # 初始化项目目录结构 / Initialize project
pdd update [--version]        # 更新技能到最新版本 / Update to latest
pdd list [-c category]       # 列出所有技能 / List all skills
pdd version                  # 显示版本信息 / Show version
```

### 开发流程 / Development Workflow

```bash
# 规格与代码 / Specification & Code
pdd generate -s spec.md -o ./src --dry-run     # 代码生成（预览模式）/ Code generation (dry run)
pdd verify -s spec.md -c ./src --json          # 功能验证 / Feature verification
pdd report -t html|json|md -o ./reports         # 报告生成 / Report generation

# 质量门禁 / Quality Gates
# 类型仅四类: code | prd | sql | activiti（多个用逗号分隔，all = 全部）
pdd linter -t prd -f ./my-feature.prd            # 检查指定 PRD（-f 传文件，非目录）
pdd linter -t prd                                # 检查当前项目内全部 PRD
pdd linter -t sql -o json                        # SQL 检查，JSON 输出便于接 CI
pdd linter                                        # 不传 -t 默认 all
pdd eval -c core|expert                         # 运行评估测试 / Run evals
pdd token -f ./src                               # Token 效率分析 / Token analysis

# 国际化 / Internationalization
pdd i18n -c core|expert|all                     # 双语合规检查 / Bilingual compliance
pdd cso                                           # 触发准确率分析 / Trigger accuracy
```

### 🔥 PDD Visual Manager（新增 / New）

```bash
# Web Dashboard
pdd dashboard              # 启动 Web Dashboard / Start Dashboard
pdd dashboard -p 8080      # 自定义端口 / Custom port

# Terminal TUI
pdd tui                    # 启动 Terminal TUI / Start TUI

# VM 数据查询 / VM Data Query
pdd vm status              # 项目状态摘要 / Project status
pdd vm features            # 功能点列表 / Feature list
pdd vm export --format csv # 导出数据 / Export data
```

***

## 七大 Phase 架构 / Seven Phase Architecture

### Phase 1: 基础设施建设 / Infrastructure

提供项目脚手架、质量门禁和工具链基础能力。

> **English**: Provides project scaffolding, quality gates, and toolchain infrastructure.

| 组件 / Component | 说明 / Description |
| ------------- | ---------------------------------------------------------------------------------------------- |
| **npx 安装机制 / npx Install** | `npx pdd-skills init` 一键初始化 / One-click initialization |
| **Linter 体系 / Linter System** | Java(Checkstyle+PMD) / JS(ESLint) / Python(Ruff) / SQL(SQLFluff) / Activiti(BPMN) / Skill(Custom) |
| **Hook 系统 / Hook System** | 7 种事件钩子 / 7 event hooks for custom logic injection |
| **Evals 框架 / Evals Framework** | 结构/内容/质量/CSO 四种测试类型 / 4 test types |
| **Token 分析器 / Token Analyzer** | 中英文混合 Token 计数与效率评级 / Bilingual token counting |

### Phase 2: 核心能力增强 / Core Capabilities

14 个核心技能 + 五大行为塑造机制。

> **English**: 14 core skills + 5 behavior shaping mechanisms.

#### 核心技能列表 / Core Skills List

| 技能名称 / Skill Name | 用途 / Purpose | 双语 / Bilingual |
| ----------------------- | ------------------------ | -- |
| `pdd-main` | 主入口，协调全部子技能 / Main coordinator | ✅ |
| `pdd-ba` | 业务分析与需求建模 / Business analysis | ✅ |
| `pdd-extract-features` | 从 PRD 提取功能点 / Extract features from PRD | ✅ |
| `pdd-generate-spec` | 生成开发规格文档 / Generate specifications | ✅ |
| `pdd-design-spec` ★v3.3.0 | 生成界面设计规范 DESIGN.md（PRD/specs 之后、实现之前）/ Generate UI design spec (DESIGN.md) | ✅ |
| `pdd-implement-feature` | 基于规格实现代码 / Implement code from spec | ✅ |
| `pdd-verify-feature` | 验证实现符合规格 / Verify implementation | ✅ |
| `pdd-code-reviewer` | 多维度代码审查 / Multi-dimensional code review | ✅ |
| `pdd-doc-change` | 变更文档管理 / Document change management | ✅ |
| `pdd-doc-gardener` | 文档清理与维护 / Document maintenance | ✅ |
| `pdd-entropy-reduction` | 技术债务治理 / Technical debt governance | ✅ |
| `official-doc-writer` | 党政机关公文生成 / Official document generation | ✅ |
| `traffic-accident-assessor` | 交通事故定责辅助评估 / Traffic accident liability assessment | ✅ |
| `pdd-vm` | PDD Visual Manager 可视化监控 / Visual monitoring | ✅ |

### Phase 3: 专家系统扩展 / Expert Systems

| 专家技能 / Expert Skill | 能力范围 / Scope | 特色 / Features |
| --------------------------- | --------------------------------------- | ---------------------------------------- |
| **expert-security** | SQL注入/XSS/CSRF/命令注入/路径遍历/SSRF | OWASP Top 10 2021 完整覆盖 |
| **expert-performance** | CPU/内存/I/O/网络/锁竞争诊断 | HikariCP/Redis多级缓存/G1 GC调优 |
| **expert-mysql** | SQL优化/索引设计/表结构分析/慢查询诊断 | MySQL官方文档参考，执行计划分析 |
| **expert-ruoyi** | 若依框架全流程开发/代码生成/权限配置 | 7个若依Bug模式(PATTERN-R001~R007) |
| **expert-ruoyi-permission** | 若依框架权限配置/权限校验失败诊断 | 四端一致原则 + @PreAuthorize + v-hasPermi |
| **expert-activiti** | Activiti 7工作流引擎/BPMN 2.0/流程部署 | 流程设计规范 + BPMN校验规则 |
| **expert-vue3** | Vue3 组件开发/状态管理/性能优化 | Vue3 生态最佳实践 |
| **expert-springcloud** | 微服务架构/服务治理/配置中心/网关路由 | Spring Cloud Alibaba 全栈解决方案 |
| **expert-bug-fixer** | Bug 根因分析/修复方案生成/回归测试建议 | 智能诊断 + 修复策略推荐 |
| **testcase-modeler** | **测试用例建模/自然语言转YAML/零代码测试** | **6条建模规则+智能意图提取+断言自动注入** |
| **testcase-agent** | **E2E测试执行/Chrome DevTools MCP/自愈引擎** | **5条铁律+4级元素定位+深度网络校验** |
| **software-architect** | 架构模式设计/技术选型/性能权衡 | 生产级架构设计，60+ 界面组件模式 |
| **software-engineer** | 代码实现/重构优化/设计模式应用 | 生产级代码，清洁架构 |
| **system-architect** | 系统架构设计/模块化设计/安全最佳实践 | PEP8/ESLint 标准，项目初始化 |

### Phase 4: 平台化建设 / Platformization

#### RESTful API 层 / RESTful API Layer

| 方法 / Method | 端点 / Endpoint | 说明 / Description |
| -------- | ------------------ | ------- |
| GET | `/api/v1/status` | 服务状态 / Service status |
| GET | `/api/v1/docs` | API 文档 / API docs |
| GET | `/api/v1/health` | 健康检查 / Health check |
| GET/POST | `/api/v1/spec/*` | 规格 CRUD / Spec CRUD |
| POST | `/api/v1/generate` | 代码生成 / Code generation |
| POST | `/api/v1/verify` | 功能验证 / Feature verification |
| POST | `/api/v1/report` | 报告生成 / Report generation |
| GET/POST | `/api/v1/config/*` | 配置管理 / Configuration |
| GET | `/api/v1/skills` | 技能列表 / Skills list |

### Phase 5: 智能化升级 / Intelligence Upgrade

#### 三级缓存系统 / Three-Level Cache System

```
请求 / Request → L1 Session Cache (LRU, 内存 / Memory)
     → MISS → L2 Project Cache (LRU, 内存, 跨会话 / Cross-session)
          → MISS → L3 Global Cache (LFU, 磁盘 / Disk JSON)
```

| 级别 / Level | 策略 / Strategy | 存储 / Storage | TTL | 容量 / Capacity |
| ---------- | --- | -- | ----- | ----- |
| L1 Session | LRU | 内存 / Memory | 5min | 100条 |
| L2 Project | LRU | 内存 / Memory | 30min | 500条 |
| L3 Global | LFU | 磁盘 / Disk | 2h | 2000条 |

#### Token 预算管理 / Token Budget Management

| 阶段 / Phase | 占比 / Ratio | 说明 / Description |
| -------------- | --- | ------ |
| analysis | 15% | 需求分析阶段 / Requirements analysis |
| design | 20% | 规格设计阶段 / Specification design |
| implementation | 35% | 代码实现阶段 / Implementation |
| review | 20% | 代码审查阶段 / Code review |
| verify | 10% | 验证确认阶段 / Verification |

阈值策略 / Threshold: **80% 警告 / Warning** / **95% 阻断 / Block**

#### 代码质量评分 — 五维引擎 / Quality Scoring — Five Dimensions

| 维度 / Dimension | 权重 / Weight | 规则数 / Rules | 评级 / Rating |
| -------- | --- | --- | ----------------------------------------------- |
| **可读性 / Readability** | 20% | 7 | 命名规范/函数长度/行长度/圈复杂度/注释覆盖率 |
| **可维护性 / Maintainability** | 20% | 6 | 重复代码/模块内聚/耦合度/单一职责/死代码 |
| **健壮性 / Robustness** | 25% | 6 | Null检查/错误处理/边界验证/异步错误/类型检查 |
| **性能 / Performance** | 15% | 6 | 循环效率/内存分配/I/O操作/字符串拼接/异步模式 |
| **安全性 / Security** | 20% | 6 | SQL注入/XSS风险/硬编码密钥/输入验证/依赖安全 |

**评级 / Grades**: S≥90 / A≥80 / B≥70 / C≥60 / D≥50 / F<50

### Phase 6: 生态建设 / Ecosystem

#### 插件系统 / Plugin System

```
PluginBase (抽象基类 / Abstract Base)
  ├── onInstall()      安装后执行一次 / Run once after install
  ├── onActivate()     激活时调用 / Called on activation
  ├── onDeactivate()   停用时调用 / Called on deactivation
  ├── onUninstall()    卸载前清理 / Cleanup before uninstall
  └── onConfigChange() 配置变更响应 / Config change response
```

**安全沙箱 / Security Sandbox**: Proxy 拦截 fs/net/process/env，四维策略控制

### 📊 Phase 7: PDD Visual Manager / Visual Manager

> **重要说明 / Important**: PDD Visual Manager 用于 **可视化监控使用 PDD 方法开发的业务项目的运行状态**，而非管理 PDD-Skills 自身的开发任务。
>
> **English**: PDD Visual Manager is used for **visual monitoring of business projects developed using the PDD method**, not for managing PDD-Skills' own development tasks.

#### 双形态架构图 / Dual-Mode Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        PDD Visual Manager Architecture                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         Data Layer (数据层 / Data Layer)                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │   │
│  │  │ Feature Store│  │ Config Store │  │ Cache Store  │  │ Event Bus  │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                           │
│                                    ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        Service Layer (服务层 / Service Layer)              │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────────┐   │   │
│  │  │  HTTP Server   │  │  SSE Server    │  │     REST API (11端点)     │   │   │
│  │  └────────────────┘  └────────────────┘  └──────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│              │                                    │                           │
│              ▼                                    ▼                           │
│  ┌─────────────────────────────┐    ┌─────────────────────────────────────┐   │
│  │      Presentation Layer     │    │       Presentation Layer            │   │
│  │  ┌───────────────────────┐  │    │  ┌─────────────────────────────┐   │   │
│  │  │   Web Dashboard       │  │    │  │     Terminal TUI             │   │   │
│  │  │   (零依赖 SPA)         │  │    │  │     (零依赖 ANSI)            │   │   │
│  │  └───────────────────────┘  │    │  └─────────────────────────────┘   │   │
│  └─────────────────────────────┘    │                                     │   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Web Dashboard — 4 大视图面板 / 4 View Panels

| 视图 / View | 名称 / Name | 主要内容 / Content |
| -------- | -------- | ------------------- |
| Pipeline | 流水线视图 / Pipeline View | 各阶段状态和进度 / Stage status & progress |
| Kanban | 看板视图 / Kanban View | 功能点开发状态 / Feature development status |
| Quality | 质量视图 / Quality View | 代码质量指标 / Code quality metrics |
| System | 系统视图 / System View | 系统运行状态 / System runtime status |

#### Terminal TUI — 快捷键 / Shortcuts

| 按键 / Key | 功能 / Function | 适用场景 / Scenario |
| -------------- | ------------ | ---------- |
| `Tab` | 切换到下一个屏幕 / Next screen | 所有屏幕 / All screens |
| `q` 或 `Ctrl+C` | 退出 TUI / Quit | 所有屏幕 / All screens |
| `r` 或 `F5` | 强制刷新 / Refresh | 所有屏幕 / All screens |
| `1` - `4` | 直接跳转到指定屏幕 / Jump to screen | 所有屏幕 / All screens |
| `/` | 打开搜索框 / Search | 支持搜索的屏幕 / Searchable screens |

***

## 技能系统 / Skill System

### 技能分类 / Skill Categories

```
skills/
├── core/                    # 14 个核心技能 / 14 Core Skills (必装 / Required)
│   ├── pdd-main/           # 主协调器 / Main coordinator
│   ├── pdd-ba/             # 业务分析 / Business analysis
│   ├── pdd-extract-features/   # 特征提取 / Feature extraction
│   ├── pdd-generate-spec/      # 规格生成 / Spec generation
│   ├── pdd-design-spec/        # ★ 界面设计规范 / Design spec (NEW v3.3.0)
│   ├── pdd-implement-feature/  # 代码实现 / Code implementation
│   ├── pdd-verify-feature/     # 功能验证 / Feature verification
│   ├── pdd-code-reviewer/      # 代码审查 / Code review
│   ├── pdd-doc-change/         # 变更文档 / Document change
│   ├── pdd-doc-gardener/       # 文档维护 / Document maintenance
│   ├── pdd-entropy-reduction/  # 技术债务 / Technical debt
│   ├── official-doc-writer/    # 公文生成 / Official documents
│   ├── traffic-accident-assessor/ # 交通事故评估 / Traffic accident assessor
│   └── pdd-vm/                 # 可视化监控 / Visual monitoring
│
├── expert/                  # 专家技能 / Expert Skills (12个)
│   ├── expert-security/    # 安全审计 / Security audit
│   ├── expert-performance/ # 性能优化 / Performance
│   ├── expert-mysql/       # MySQL数据库 / MySQL
│   ├── expert-ruoyi/       # 若依框架 / RuoYi framework
│   ├── expert-ruoyi-permission/ # 若依权限 / RuoYi permission
│   ├── expert-activiti/    # Activiti工作流 / Workflow
│   ├── expert-vue3/        # Vue3前端 / Vue3 frontend
│   ├── expert-springcloud/ # SpringCloud微服务 / Microservices
│   ├── expert-bug-fixer/   # Bug修复 / Bug fixing
│   ├── testcase-modeler/   # ★ 测试用例建模 / Testcase modeling (NEW)
│   ├── testcase-agent/      # ★ 测试执行引擎 / Test execution engine (NEW)
│   ├── software-architect/ # 软件架构 / Software architecture
│   ├── software-engineer/  # 软件工程 / Software engineering
│   └── system-architect/   # 系统架构 / System architecture │
├── entropy/                 # 熵减治理 / Entropy reduction (4个)
├── pr/                      # PR与交付 / PR & Delivery (7个)
├── openspec/                # OpenSpec 协作 / Collaboration (10个)
└── software/                # 通用软件工程 / General software engineering
```

***

## ★ 界面设计规范 / Design Spec (NEW v3.3.0)

> 让 AI 写出来的前端"像同一个系统"，而不是每个模块各长一套。
> 核心产物 `ui/DESIGN.md` —— 一份 **AI 可读、可执行、可审计**的设计契约。

### 为什么需要它

后台系统的视觉碎片化几乎是必然的：多端（PC / 移动 / 大屏）、多角色、多模块、多人多批次开发。每个模块自己定按钮圆角、表格行高、状态色，最后用户面对的是拼装货。

PRD 回答"有什么"，spec 回答"怎么调"，**DESIGN.md 回答"长什么样、什么规则"**。三者正交：

| 文档 | 读者 | 回答什么 | 变更频率 |
|------|------|---------|---------|
| `AGENTS.md` | 编码 agent | 怎么建（技术栈/目录/命令） | 低 |
| PRD 第4章「界面原型」 | 人 | 这个页面放哪些字段和按钮 | 高 |
| `spec.md` 第4/6章 | 人 + 后端 | 这个功能调什么接口、字段什么类型 | 高 |
| **`ui/DESIGN.md`** | **AI + 人** | **全系统统一的颜色/字号/间距/状态/密度** | **极低** |

**取舍准则**：只对一个页面成立的约定留在 PRD；两个以上页面成立的必须上升到 DESIGN.md。

### 流水线位置

```
PRD ──→ dev-specs ──→ specs/spec.md ──→ 【ui/DESIGN.md】 ──→ generate ──→ verify
                                              ↑ 本技能            │
                                              └── pdd-implement-feature Step 2 强制读取（v3.3.1）
```

触发时机：`specs/spec.md` 生成之后、写前端代码之前。也可在任意阶段单独触发（老系统补规范）。

**消费闭环（v3.3.1）**：规范不只要被生成，更要被消费。`pdd-implement-feature` 已升级——前端编码前必须读取 `ui/DESIGN.md` 并对齐其 token/状态色板/间距密度/组件模式（铁律 9「设计规范对齐」，红旗 EXEC-IMPL-007）；若 `ui/DESIGN.md` 不存在则输出 WARN 提示先运行 `/pdd-design-spec`，不阻塞后端实现。

### 两条与业界不同的设计主张

**1. 状态优先于品牌。**

先定业务状态机色板，再定品牌主色。顺序颠倒会导致品牌色侵占状态语义——最终"加急/置顶/驳回/失败"全都变红，红色彻底失去信息量。

**2. 状态色只作圆点，不作文字。**

高明度橙/绿做 12px 标签文字，对比度必然不足（实测 `#FF7D00` 在白底仅 2.57:1，`#00B42A` 仅 2.78:1，远低于 WCAG 4.5:1）。

正确做法：**彩色圆点 + 中性深灰文字**（7.2:1）。颜色只需要在 14px 色块内被**识别**，不需要被**阅读**。一条规则同时解决可读性、色盲、黑白打印三个问题。

```html
<span class="status"><i class="dot dot--returned">↩</i>退回修改</span>
```

### 状态爆炸怎么办：收敛色族

状态超过 9 个时，**不要新增色相**——色相距离会挤到 15° 以内，反而更难分。

正确做法是收敛成 ≤8 个色族，用**明度差 ≥18 + 图标**承担细分：

| 族 | 状态 | 区分手段 |
|----|------|---------|
| 灰 | 草稿 / 已撤回 | 明度 + 图标 |
| 橙 | 待审核 | 色相 |
| 深橙 | 发布失败 | 同族，明度差 22 + ⚠ |
| 绿 | 已通过 / 已发布 | 明度差 22 + 图标（✓ / ●） |
| 红 | 退回修改 / 退回重写 | 明度差 21 + 图标（↩ / ↻） |
| 紫 | 定时待发 | 色相 |
| 青 | 部分成功 | 色相 |
| 深靛 | 审核中 | 与品牌蓝同系但明度差 24 |

### 使用方式

```bash
# ① 确定性抽取：从 PRD/spec 扫描状态枚举、页面清单、渠道，自动配好合规色板
node .skills/pdd-design-spec/scripts/gen-design-scaffold.js \
  --prd ./my-feature.prdx --spec ./specs/spec.md --out ./ui/DESIGN.md

# ② 结构化自检（7 项，退出码 0=通过 1=严重 2=有警告）
node .skills/pdd-design-spec/scripts/check-design.js ./ui/DESIGN.md
```

也可以在对话里直接触发：**"生成界面规范" / "设计规范" / "UI规范" / "DESIGN.md"**。

`gen-design-scaffold.js` 解决的是 LLM 最容易出错的环节——**状态枚举漏项**。它从 PRD 的 EARS 需求、状态转换描述里正则抽取全部状态词，按语义映射到色族，再用明度差拉开同族，保证产出**天生能通过 check-design.js**。

### 文档结构（12 章）

| # | 章节 | 关键点 |
|---|------|--------|
| 1 | 视觉主题与气质 | 先定调，后续所有决策的依据 |
| 2 | 颜色与角色 | 颜色必须绑定**功能角色**，附语义禁区 |
| 3 | 字体规则 | 中文优先栈 + 数字必须 `tabular-nums` |
| 4 | 组件规范 | 每个组件写全 **8 态**（含 loading / 无权限） |
| 5 | 布局原则 | 归纳布局类型，不逐页描述 |
| 6 | 层级与深度 | L0-L3 表面阶梯，投影只允许 L2+ |
| 7 | **数据密度** | 行高 / 一屏行数 / 列数上限，全部可测 |
| 8 | Do's and Don'ts | 每条必须**可机器判定** |
| 9 | 响应式与多端 | 断点 + PC/移动/大屏差异矩阵 |
| 10 | 内容模型映射 | 内容类型 → 字段 → 模板 → 可发渠道 |
| 11 | 组件库映射 | Element Plus `--el-*` 变量覆盖 |
| 12 | Agent Prompt Guide | 速查色板 + 现成 prompt + 迭代审计清单 |

### 校验器覆盖

`check-design.js` 不是格式检查，是**语义检查**：

| 检查项 | 判定规则 |
|--------|---------|
| front matter | YAML 合法 + 5 个必需顶层键 |
| 裸 hex | `components` 下必须是 `{colors.x}` 引用 |
| 引用完整性 | 每个 token 引用都真实存在 |
| 状态色冲突 | **色相 × 明度双重判定**：灰阶（S<20%）豁免；色相差 <25° 但明度差 ≥18 判为"同族可接受" |
| 对比度 | 状态色若被用作文字，白底须 ≥3:1 |
| 双编码 | 必须声明图标/形状，不能只靠颜色 |

```bash
$ node .skills/pdd-design-spec/scripts/check-design.js ./ui/DESIGN.md
通过 6 | 严重 0 | 警告 0
结果: 通过
```

### 领域预设

技能本体通用，领域差异通过 `references/presets/` 覆盖。新增领域只加一个文件，不改 SKILL.md——这是跨项目复用的关键。

| 预设 | 适用 | 提供什么 |
|------|------|---------|
| `media.md` | 融媒体 / 内容发布 / CMS | 11 态稿件状态机、8 渠道清单、内容分级标识、栏目色彩体系、AI 标注分档 |

融媒体预设的三个关键判断（都来自真实项目）：

1. **驳回必须分两支**——"退回修改"（编辑手工改）与"退回重写"（系统重跑 AI 并保留原版本）。合并成一个"已驳回"，编辑每次都要点进去才知道下一步做什么。
2. **已通过 ≠ 已发布**——前者是审核终态，后者是分发终态。合并后审核队列分不清哪些还没发出去。
3. **必须有"部分成功"**——一条稿件发 8 个平台可能 6 成 2 败，既不是成功也不是失败。

### 文件位置

```
skills/core/pdd-design-spec/
├── SKILL.md                    # 主文件：8 条铁律 + 三层红旗 + 12 章规范
├── _meta.json                  # 触发词
├── evals/default-evals.json    # 10 项评估断言
├── references/
│   ├── design-md-template.md   # 完整模板，可整体复制
│   ├── token-spec.md           # token 命名 + 色板推导五步法
│   ├── density-spec.md         # 后台密度数字表
│   ├── pattern-library.md      # 12 个可复用模式
│   ├── audit-checklist.md      # 12 项可判定审计
│   └── presets/media.md        # 融媒体预设
└── scripts/
    ├── gen-design-scaffold.js  # 从 PRD/spec 抽取并生成骨架
    └── check-design.js         # 语义校验
```

项目内产出：`ui/DESIGN.md`（与 `specs/`、`dev-specs/` 平级）。

***

## 配置中心 / Configuration Center

> **Single Source of Truth 原则 / Principle**: 所有配置集中管理，技能和脚本通过引用获取，避免散落和不一致。
>
> **English**: All configurations are centrally managed; skills and scripts access them by reference to avoid scattering and inconsistency.

### 配置文件一览 / Configuration Files

| 配置文件 / Config File | 用途 / Purpose | 消费方 / Consumers |
| -------------------------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| `config/bug-patterns.yaml` | Bug模式库（14个模式 / 14 patterns） | pdd-code-reviewer, pdd-verify-feature, pdd-implement-feature, pdd-template-engine, expert-ruoyi |
| `config/prd-rules.yaml` | PRD检测规则（30条 / 30 rules，其中 7 条为阻塞规则 / 7 blocking） | pdd-linter, run-linters.js |
| `config/gate-config.yaml` | 质量门控配置（4级 / 4 levels + `grade_thresholds` A~D 分档） | gate-engine.js |
| **`config/test-actions.yaml`** | **测试动作库（30+ 动作 / 30+ actions）** | **testcase-modeler, testcase-agent** |
| **`config/cdp-test-config.yaml`** | **全局测试配置（环境变量/超时/报告）** | **testcase-agent** |

### Bug模式库架构 / Bug Pattern Library

```
config/bug-patterns.yaml          ← 唯一真相源 / Single Source of Truth
├── categories.general            # 通用模式 / General Patterns PATTERN-001~007
│   ├── PATTERN-001  datetime字段类型陷阱 / Datetime field type trap
│   ├── PATTERN-002  静态路由注册顺序错误 / Static route registration order
│   ├── PATTERN-003  枚举硬编码/编码不一致 / Enum hardcoding
│   ├── PATTERN-004  alert()未用safeAlert()包装 / alert() not wrapped
│   ├── PATTERN-005  my-tasks查询条件不完整 / Query condition incomplete
│   ├── PATTERN-006  Options接口路由顺序 / Options API route order
│   └── PATTERN-007  编号生成未检查已存在记录 / ID generation without existence check
└── categories.ruoyi              # 若依专用 / RuoYi Specific PATTERN-R001~R007
    ├── PATTERN-R001  权限注解缺失 / Missing permission annotation
    ├── PATTERN-R002  菜单配置不完整 / Incomplete menu config
    ├── PATTERN-R003  数据权限未配置 / Data permission not configured
    ├── PATTERN-R004  Redis缓存未清除 / Redis cache not cleared
    ├── PATTERN-R005  参数校验缺失 / Missing parameter validation
    ├── PATTERN-R006  XSS防护缺失 / Missing XSS protection
    └── PATTERN-R007  操作日志缺失 / Missing operation log
```

### 如何运行 / How to Run

```bash
# 在目标项目目录下运行（项目根 = 当前工作目录，无 --project 参数）
cd D:/APPPROJECTS/RuoYi-Vue-Plus-v6.0.0
node "D:/APPPROJECTS/pdd-skills-v3-main/pdd-skills-v3-main/bin/pdd.js" linter -t prd -f ./my-feature.prd
```

| 参数 / Option | 取值 / Values | 说明 / Notes |
| ------------- | ------------- | ------------ |
| `-t, --type` | `code` / `prd` / `sql` / `activiti` / `all` | 可逗号组合；不传默认 `all` |
| `-f, --file` | 文件路径 | **传文件，不是目录**。传目录会被过滤掉，判为「未真正执行」 |
| `-o, --output` | `text` / `json` | `json` 输出 `summary.gateResult`，便于程序判定；`html` 未实现（等同 text） |
| `--incremental` | — | 仅检查 `git diff` 变更的文件 |

**当前环境实测可用的检查项**（其余因缺依赖未执行，会被明确报为「未真正执行」）：

| 类型 / Type | 状态 / Status | 依赖 / Requires |
| ----------- | ------------- | --------------- |
| `prd` | ✅ 可用 | 无（内置规则引擎，30 条规则） |
| `sql` | ✅ 可用 | 无（无 sqlfluff 时自动降级为内置检查） |
| `code` | ❌ 未执行 | 需自带 checkstyle jar、pmd 的 `run.sh`、eslint、ruff |
| `activiti` | ❌ 未执行 | 需 `xml2js`（`package.json` 尚未声明该依赖） |

> **三个使用上的坑 / Three Gotchas**
> 1. **报告路径不可指定**：固定落在 `<项目根>/.pdd/cache/reports/linter-report-<时间戳>.md`，与 `entropy_scan.py --output` 不同。
> 2. **退出码恒为 0**：`gateResult.action.exitCode` 虽被算出但从未 `process.exit()`，因此 **不能靠退出码接 CI**，需解析 `-o json` 的 `summary.gateResult.passed`。
> 3. **不传 `-f` 时，派生产物会被当成 PRD 一起检查**：文件发现规则 `isLikelyPRD()` 只看**文件名关键词**（`prd` / `spec` / `feature` / `需求` / `规格` / `功能` …），因此 `specs/spec.md`、`specs/features/feature-matrix.md` 这类**由 PRD 生成的产物**也会被当作 PRD 送检，并因不含「版本号 / 不在范围 / 权限矩阵」等章节而触发 Blocker。实测某项目 `-t prd` 不带 `-f` 时：`filesChecked=2`、**13 errors / 15 warnings**、`评分 0/100` 🚫 **BLOCKER 阻断** —— 而被检查的两份文件没有一份是 PRD。**结论：查 PRD 时始终显式带 `-f` 指向真正的 PRD 文件。**

### 质量门控流程 / Quality Gate Process

```
PRD文档 / PRD Doc → prd-linter (30条规则 / 30 rules) → gate-engine (4级门控 / 4 levels) → 评分卡 / Scorecard
                                                            │
                                              ┌─────────────┼─────────────┐
                                              ▼             ▼             ▼
                                         BLOCKER       CRITICAL      WARNING/INFO
                                         (阻断)        (必须修复)     (建议修复)
                                              │             │
                                              ▼             ▼
                                         Score = 0     Score -= 15/5/1
                                              │             │
                                              ▼             ▼
                                         Grade: F      Grade: A~D
                                              │             │
                                              ▼             ▼
                                         ❌ FAIL        ✅ PASS
```

### ⚠️ 静默失效防护 / Silent-Failure Guard

门控体系有一条硬性要求：**「检查没跑」与「检查通过」绝不能给出同一个绿灯**。凡是「规则未执行」「文件未匹配」这类情况，一律按**不通过**处理，而不是当作无问题放行。

同一条要求也适用于**「问题被规则主动豁免」**：豁免是设计内的行为，但它必须留下计数，否则「少报」会伪装成「干净」。

```javascript
// scripts/linter/prd-linter.js
// ① 规则正则：剥离 Python 风格内联标志 (?i)，大小写不敏感由 RegExp 的 i 标志保证
function normalizePattern(pattern) {
  if (typeof pattern !== 'string') return pattern;
  return pattern.replace(/\(\?[a-zA-Z]*\)/g, '');
}

// ② 没有可检查对象时，必须区分「路径打错」与「项目本来就没有 PRD」
if (prdFiles.length === 0) {
  const requested = options.files || [];
  const explicitRequest = requested.length > 0;
  return {
    skipped: explicitRequest,     // 显式指定却零匹配 → 未真正执行
    applicable: explicitRequest,  // 未显式指定 → 项目内无 PRD，属「不适用」
    message: explicitRequest
      ? `指定的文件未匹配到任何 PRD（已跳过检查）：${requested.join(', ')}`
      : `${t('noFiles')}（该检查不适用，非通过）`,
  };
}

// ③ 豁免按「整行内容」比对（不是命中的关键词本身），且命中豁免必须记数上报
const hit = excludeRegexes.find(({ regex: ex }) => ex.test(lineContent));
if (hit) {
  suppressions.push({ line: lineNum, matchedText, excludedBy: hit.source, context: lineContent });
  continue;                      // 不报为问题 —— 但已进入 suppressions，摘要与报告都会显示
}
```

被豁免的命中会出现在两处，**不会消失**：

```
━━━ 检查摘要 ━━━
  ℹ 已豁免: prd-linter 1 处（命中规则豁免白名单，未计入问题，明细见报告）

## 已豁免命中 / Suppressed by exclude_patterns   ← 报告中的独立章节
共 1 处命中被规则豁免白名单挡下，未计入问题数：
- prd-no-vague-language  (probe-input.prd:7)  命中「优化」，被 /作为.*参考/ 豁免
```

> 该防护由 2026-09-30 的缺陷修复引入，详见 [质量保障加固 / Quality Assurance Hardening](#质量保障加固--quality-assurance-hardening)。

---

## ★ 测试用例系统 / Testcase System (NEW v3.2.0)

> **重要说明 / Important**: PDD Test Skill 是基于 **Chrome DevTools MCP** 的零代码 E2E 测试自动化解决方案，专为无编程经验的测试人员（如实习生）设计。
>
> **English**: PDD Test Skill is a **zero-code E2E test automation solution based on Chrome DevTools MCP**, designed for testers without programming experience (such as interns).

### 🎯 系统架构 / System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PDD Test Skill - 零代码 E2E 测试平台                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────┐    ┌──────────────────────┐                       │
│  │  testcase-modeler   │    │   testcase-agent      │                       │
│  │  (测试用例建模师)     │───▶│  (自动化测试执行专家)   │                       │
│  └──────────────────────┘    └──────────────────────┘                       │
│           │                           │                                      │
│           ▼                           ▼                                      │
│  ┌──────────────────────┐    ┌──────────────────────┐                       │
│  │  自然语言描述         │    │  Chrome DevTools MCP  │                       │
│  │       ↓              │    │       ↓               │                       │
│  │  智能意图提取         │    │  CDP 协议操控浏览器     │                       │
│  │       ↓              │    │       ↓               │                       │
│  │  YAML 测试用例        │    │  执行 + 截图 + 验证    │                       │
│  └──────────────────────┘    └──────────────────────┘                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      配置中心 (Configuration Center)                  │   │
│  │  • config/test-actions.yaml  ← 30+ 内置动作（可扩展）                   │   │
│  │  • config/cdp-test-config.yaml ← 全局配置（环境变量/超时/报告）          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📊 核心特性 / Core Features

| 特性 / Feature | 说明 / Description | 受益者 / Beneficiary |
| --------------- | ------------------- | -------------------- |
| **零代码门槛 / Zero-Code** | 自然语言 → YAML 用例，无需编程 | 实习生、业务人员 |
| **智能建模 / Smart Modeling** | 6条 Iron Rules + 意图自动提取 + 断言注入 | 所有测试人员 |
| **可靠执行 / Reliable Execution** | 5条铁律 + 每步截图 + 深度网络校验 | QA工程师 |
| **自愈引擎 / Self-Healing** | 4级元素定位降级策略（成功率 >65%） | 自动化测试 |
| **安全处理 / Security First** | 密码等敏感信息使用环境变量，禁止硬编码 | 安全合规 |
| **专业报告 / Professional Reports** | HTML报告含截图/时间线/诊断建议 | 项目经理、管理层 |

---

### 🚀 快速开始 / Quick Start

#### 步骤 1：环境配置 / Environment Setup

```bash
# 设置测试环境变量（Windows PowerShell）
$env:TEST_USER = "your_username"
$env:TEST_PASS = "your_password"
$env:BASE_URL = "http://your-system"

# 或 Linux/Mac
export TEST_USER="your_username"
export TEST_PASS="your_password"
export BASE_URL="http://your-system"
```

#### 步骤 2：使用 Modeler 创建测试用例 / Create Test Case with Modeler

**对话触发示例 / Dialog Trigger Examples**:

```bash
# 方式 1：明确要求生成测试用例
"帮我写个统一门户登录的测试用例"

# 方式 2：自然语言描述操作流程
"先打开 uniportal.sjjk.com.cn，然后用 yuanye/yuanye 登录，验证首页是否正常显示"

# 方式 3：场景化需求
"实习生不会写代码，帮我录制一下资产评估核准的申请流程"
```

**Modeler 输出示例 / Modeler Output Example**:

生成的 YAML 文件会保存到 `skills/expert/testcase-modeler/examples/` 目录：

```yaml
test_id: "LOGIN-001-portal-normal"
title: "统一门户登录正常流程"
priority: "P0"
tags: ["登录", "统一门户", "E2E", "冒烟测试"]

context_check:
  login_url: "http://uniportal.sjjk.com.cn"
  home_indicator: "统一门户（新）"
  credentials:
    username: "${TEST_USER}"     # 从环境变量读取
    password: "${TEST_PASS}"     # 从环境变量读取

steps:
  - step: 1
    desc: "打开统一门户登录页面"
    action: navigate
    url: "${LOGIN_URL:-http://uniportal.sjjk.com.cn}"
    wait_after:
      type: time
      duration: 2000
    assertions:
      - type: text_contains
        expected: "欢迎登录"
        confidence: high

  - step: 2
    desc: "输入用户名"
    action: fill
    target: "用户名输入框"
    value: "${TEST_USER}"
    assertions:
      - type: field_filled
        expected: "字段已填写"
        confidence: high

  # ... 更多步骤
```

#### 步骤 3：使用 Agent 执行测试用例 / Execute Test with Agent

**对话触发示例 / Dialog Trigger Examples**:

```bash
# 方式 1：执行指定文件
"执行 LOGIN-001-portal-normal.yaml 用例"

# 方式 2：执行刚才生成的用例
"将刚才生成的测试用例跑一下"

# 方式 3：调试模式
"带截图执行这个YAML文件，单步调试"
```

**Agent 执行过程 / Agent Execution Process**:

1. **状态感知（铁律1）**: 检查当前浏览器是否已登录
2. **逐步执行**: 按照 YAML 的 steps 顺序执行每个动作
3. **每步截图（铁律2）**: 记录操作前后的页面状态
4. **断言验证**: 检查文本内容、元素可见性、网络调用
5. **自愈机制（铁律4）**: 元素找不到时自动降级尝试其他定位策略
6. **报告生成（铁律5）**: 输出 HTML 报告到 `test-results/reports/`

**执行结果示例 / Execution Result Example**:

```
✅ LOGIN-001-portal-normal 测试通过！

📊 执行摘要:
• 总步骤数: 5
• 通过: 5 | 失败: 0 | 跳过: 0
• 自愈次数: 1（Step 3 密码框UID修复）
• 执行时间: 8.5s

📸 截图证据:
• step-01-before.png  (登录页初始状态)
• step-02-after.png   (用户名已填入)
• step-03-after.png   (密码已填入)
• step-04-after.png   (点击登录后)
• step-05-after.png   (首页加载完成)

🌐 网络校验:
✅ POST /data/sys-auth/login [200]
✅ POST /data/sys-person/sysPersonConfig/details [200]

📄 完整报告: test-results/reports/TR-1778232000000.html
```

---

### 📚 YAML 用例规范 / YAML Test Case Specification

#### 必填字段 / Required Fields

| 字段 / Field | 类型 / Type | 说明 / Description |
| ------------- | ----------- | ------------------- |
| `test_id` | string | 唯一标识符（格式：`MODULE-NNN-name`） |
| `title` | string | 测试用例标题 |
| `priority` | string | 优先级（P0/P1/P2/P3） |
| `tags` | array | 标签数组（用于分类和筛选） |
| `context_check` | object | 前置状态检查配置 |
| `steps` | array | 测试步骤列表 |

#### context_check 配置 / Context Check Configuration

```yaml
context_check:
  login_url: "http://example.com/login"   # 登录页 URL
  home_indicator: "首页"                   # 已登录状态的标志性文本
  credentials:                               # 凭据配置
    username: "${TEST_USER}"                # 用户名（环境变量）
    password: "${TEST_PASS}"                # 密码（环境变量）
  captcha_required: false                    # 是否需要验证码
  sso_enabled: true                          # 是否支持 SSO 单点登录
```

#### steps 步骤定义 / Step Definition

每个步骤支持以下核心字段：

```yaml
- step: 1                              # 步骤序号（必填）
  desc: "步骤描述"                        # 人类可读的描述（必填）
  action: navigate | fill | click |     # 动作类型（必填）
          select | assert_multiple | 
          wait | screenshot | evaluate
  target: "目标元素描述"                  # 语义化元素描述
  url: "URL地址"                         # 用于 navigate 动作
  value: "输入值"                         # 用于 fill/select 动作
  locator:                                # 元素定位器（可选）
    uid_cache_key: "username_input"      # UID缓存键（复用优化）
  wait_after:                             # 操作后等待策略
    type: time | navigation | element     # 等待类型
    duration: 2000                        # 等待时间(ms)或超时时间
  assertions:                             # 断言列表（规则4推荐）
    - type: text_contains | element_visible | 
            field_filled | value_equals |
            url_contains | network_called | 
            element_count_greater_than
      expected: "期望值"
      confidence: high | medium | low     # 置信度
```

#### 支持的动作类型 / Supported Action Types

| 动作 / Action | 说明 / Description | MCP 工具 / MCP Tool |
| ------------- | ------------------ | -------------------- |
| `navigate` | 打开页面 / Navigate to URL | `navigate_page` |
| `fill` | 填写输入框 / Fill input field | `fill` / `fill_form` |
| `click` | 点击元素 / Click element | `click` |
| `select` | 选择下拉选项 / Select dropdown | `select_option` |
| `wait` | 等待条件 / Wait for condition | `wait_for` |
| `screenshot` | 截图 / Take screenshot | `take_screenshot` |
| `assert_multiple` | 多重断言 / Multiple assertions | （内置逻辑） |
| `evaluate` | 执行 JavaScript / Execute JS | `evaluate_script` |

#### 支持的断言类型 / Supported Assertion Types

| 断言 / Assertion | 说明 / Description | 适用场景 / Use Case |
| ---------------- | ------------------ | ------------------- |
| `text_contains` | 页面包含文本 | 验证页面内容 |
| `element_visible` | 元素可见 | 验证UI元素存在 |
| `field_filled` | 字段已填写 | 验证表单输入完成 |
| `value_equals` | 值匹配 | 验证具体值 |
| `url_contains` | URL包含特征 | 验证页面跳转 |
| `network_called` | API调用检查 | 深度验证后端请求 |
| `element_count_greater_than` | 元素数量验证 | 验证列表数据量 |

---

### ⚙️ 配置文件详解 / Configuration Files Details

#### config/test-actions.yaml - 动作库 / Action Library

定义所有可用的测试动作及其自然语言匹配模式：

```yaml
# 示例：导航类动作
navigate:
  display: "打开页面"
  patterns:
    - "打开 {url}"
    - "访问 {url}"
    - "导航到 {url}"
  mcp: mcp_Chrome_DevTools_MCP_navigate_page
  params:
    - name: url
      type: string
      required: true
  examples:
    - "打开 http://uniportal.sjjk.com.cn"

# 示例：表单操作类动作
fill:
  display: "填写输入框"
  patterns:
    - "输入 {value} 到 {target}"
    - "在 {target} 输入 {value}"
  mcp: mcp_Chrome_DevTools_MCP_fill
```

**扩展自定义动作 / Extend Custom Actions**:

用户可以在 `config/test-actions.yaml` 中添加自定义动作：

```yaml
my_custom_action:
  display: "我的自定义动作"
  patterns:
    - "执行自定义操作 {param}"
  mcp: mcp_Chrome_DevTools_MCP_evaluate_script
  params:
    - name: param
      type: string
      required: true
```

#### config/cdp-test-config.yaml - 全局配置 / Global Configuration

控制测试框架的全局行为：

```yaml
test_settings:
  screenshot_on_each_step: true      # 每步都截图（铁律2强制要求）
  network_monitor: true              # 监控网络请求（铁律3）
  self_healing: true                 # 启用自愈机制（铁律4）
  report_format: "html"              # 报告格式（铁律5）
  
  timeouts:
    navigation: 30000               # 页面导航超时 30s
    element_locate: 10000           # 元素定位超时 10s
    action_execute: 15000           # 动作执行超时 15s

env_mapping:
  TEST_USER: "${TEST_USER}"          # 用户名（从环境变量读取）
  TEST_PASS: "${TEST_PASS}"          # 密码（绝对禁止明文！）
  BASE_URL: "${BASE_URL}"            # 基础URL
```

---

### 🛡️ 质量保障机制 / Quality Assurance Mechanisms

#### Testcase Modeler - 6条建模规则 / 6 Modeling Rules

| 规则 / Rule | 名称 / Name | 说明 / Description |
| ------------ | ----------- | ------------------- |
| 规则 1 | 结构完整性 | 必填字段完整性检查 |
| 规则 2 | 语义化定位 | 使用人类可读的目标描述，而非CSS/XPath |
| 规则 3 | 断言注入 | 每个步骤必须配对至少1个断言 |
| 规则 4 | 深度网络校验 | 关键步骤需验证底层API调用 |
| 规则 5 | 安全处理 | 敏感信息使用环境变量引用 |
| 规则 6 | 可读性优先 | YAML结构清晰，注释完整 |

#### Testcase Agent - 5条执行铁律 / 5 Execution Iron Laws

| 铁律 / Law | 名称 / Name | 强制要求 / Mandatory Requirement |
| ---------- | ----------- | -------------------------------- |
| 铁律 1 | **状态感知优先** | 执行前必须检测当前登录状态 |
| 铁律 2 | **每步留痕** | 每个步骤必须截图记录 |
| 铁律 3 | **深度网络校验** | 监控并验证关键API调用 |
| 铁律 4 | **自愈而非放弃** | 元素失效时启动4级降级策略 |
| 铁律 5 | **报告完整性** | 生成包含截图/时间线/诊断的专业报告 |

#### 4级元素定位自愈策略 / 4-Level Element Location Self-Healing

```
Level 1: UID 缓存查找   (<1ms, 命中率~95% 复用时)
  ↓ 失败
Level 2: 精确语义匹配   (~50ms, 命中率~80%)
  ↓ 失败
Level 3: 模糊匹配       (~100ms, 命中率~65%)
  ↓ 失败
Level 4: AI 辅助        (~500ms-2s, 命中率~55%, 兜底)

整体自愈成功率目标: >65%
```

---

### 📖 使用场景与最佳实践 / Use Cases & Best Practices

#### 场景 1：实习生快速上手 / Intern Onboarding

```bash
# 实习生只需用自然语言描述需求
"我想测试一下登录功能，用户名是admin，密码是123456，
 登录成功后应该看到首页的欢迎信息"

# Modeler 自动生成标准YAML用例
# Agent 自动执行并生成报告
# 全程无需编写任何代码！
```

#### 场景 2：回归测试套件 / Regression Testing Suite

```bash
# 测试人员批量创建业务流程用例
1. "生成资产评估核准申请的完整流程测试用例"
2. "生成资产评估核准审批的完整流程测试用例"
3. "生成资产处置立项的完整流程测试用例"

# 定期批量执行（可集成到CI/CD）
"批量执行 tests/regression/ 目录下的所有YAML用例"
```

#### 场景 3：Bug复现与验证 / Bug Reproduction & Verification

```bash
# 开发人员/QA描述Bug复现步骤
"按照这个步骤复现Bug：
 1. 打开核准申请页面
 2. 筛选状态为'待核准'
 3. 点击'批量审批'按钮
 4. 预期：弹出审批对话框
 5. 实际：按钮无响应"

# Agent 执行并记录每一步的截图和网络请求
# 快速定位问题所在！
```

#### 最佳实践清单 / Best Practices Checklist

- [ ] **始终使用环境变量**存储敏感信息（用户名/密码/token）
- [ ] **为每个步骤添加断言**，确保可追溯性
- [ ] **使用语义化的 target 描述**（如"登录按钮"而非"uid=15_4"）
- [ ] **合理设置等待策略**：优先使用 `navigation` 或 `element` 而非固定时间
- [ ] **利用 uid_cache_key** 优化重复元素的定位性能
- [ ] **定期更新 test-actions.yaml** 以支持新的业务操作
- [ ] **查看HTML报告**获取详细的执行诊断信息

---

### 🔧 故障排查 / Troubleshooting

| 问题 / Problem | 可能原因 / Possible Cause | 解决方案 / Solution |
| --------------- | ------------------------ | ------------------ |
| 环境变量未识别 | 未设置或名称不匹配 | 检查 `$env:TEST_USER` 是否正确设置 |
| 元素找不到 | 页面未加载完成或选择器变化 | 增加 `wait_after` 时间或启用自愈机制 |
| 登录失败 | Session过期或验证码拦截 | 检查 `context_check` 配置，考虑设置 `captcha_required: true` |
| 断言失败 | UI变更或异步加载延迟 | 调整 `confidence` 级别或增加等待时间 |
| 报告生成失败 | 目录权限不足 | 检查 `test-results/` 目录写入权限 |
| 网络校验失败 | API端点变更或CORS限制 | 更新 `network_called` 的 `url_pattern` 或暂时降低置信度 |

---

### 📁 项目结构 / Project Structure

```
pdd-skills-v3/
├── config/
│   ├── test-actions.yaml        # ★ 测试动作库（30+内置动作）
│   └── cdp-test-config.yaml     # ★ 全局测试配置
│
├── skills/expert/
│   ├── testcase-modeler/        # ★ 测试用例建模师 Skill
│   │   ├── SKILL.md            #    技能定义文件
│   │   ├── examples/           #    示例用例库
│   │   │   ├── LOGIN-001-portal-normal.yaml
│   │   │   ├── asset-eval-apply.yaml
│   │   │   └── asset-eval-approval-flow.yaml
│   │   └── evals/              #    评估标准
│   │
│   └── testcase-agent/          # ★ 自动化测试执行专家 Skill
│       ├── SKILL.md            #    技能定义文件
│       ├── references/         #    详细参考文档
│       │   ├── iron-rules-detail.md
│       │   ├── self-healing-strategy.md
│       │   ├── assertion-types.md
│       │   └── report-template.html
│       └── templates/          #    报告模板
│
└── test-results/               # ★ 测试输出目录（执行后自动生成）
    └── reports/                #    HTML测试报告
```

---

### 🎓 学习资源 / Learning Resources

| 资源 / Resource | 路径 / Path | 说明 / Description |
| --------------- | ----------- | ------------------- |
| **Modeler 完整文档** | `skills/expert/testcase-modeler/SKILL.md` | 6条建模规则 + 触发词 + 示例 |
| **Agent 完整文档** | `skills/expert/testcase-agent/SKILL.md` | 5条铁律 + 自愈策略 + 执行流程 |
| **铁律详细实现** | `skills/expert/testcase-agent/references/iron-rules-detail.md` | 每条铁律的实现细节和代码示例 |
| **自愈策略详解** | `skills/expert/testcase-agent/references/self-healing-strategy.md` | 4级降级的完整算法和案例 |
| **断言类型参考** | `skills/expert/testcase-agent/references/assertion-types.md` | 所有断言类型的参数和使用场景 |
| **设计文档** | `docs/superpowers/specs/2026-05-08-pdd-test-skill-design.md` | 完整的系统设计和架构决策 |
| **开发计划** | `.trae/documents/pdd-test-skill-development-plan.md` | 三阶段实施计划和任务分解 |

---

### 🔄 版本路线图 / Version Roadmap

| 版本 / Version | 计划日期 / Planned Date | 主要特性 / Key Features |
| -------------- | ---------------------- | ----------------------- |
| **v3.2.0** | 2026-05-08 | ✅ testcase-modeler + testcase-agent 基础版 |
| **v3.2.1** (当前) | 2026-09-30 | ✅ **质量保障加固 / Quality Assurance Hardening** — 质量门控静默失效修复 + 熵减评分模型重构（详见 [质量保障加固](#质量保障加固--quality-assurance-hardening)） |
| **v3.2.2** | 计划中 | 🔄 批量执行 + 并行测试 + CI/CD 集成（原 v3.2.1 计划，因版本号复用顺延） |
| **v3.3.0** | 2026-06-01 | 📋 数据驱动测试（CSV/Excel参数化） |
| **v3.4.0** | 2026-06-15 | 🌐 跨浏览器测试（Firefox/Safari/Edge） |
| **v3.5.0** | 2026-07-01 | 🤖 AI辅助用例生成（GPT/Claude集成） |
| **v4.0.0** | 2026-08-01 | 🎯 完整测试平台（管理后台 + 历史分析 + 趋势图表） |

---



## API 层 / API Layer

### 启动 API 服务器 / Start API Server

```bash
# 默认端口 / Default port 3000
pdd api

# 自定义端口 + CORS
pdd api -p 8080 --cors
```

### 调用示例 / Usage Examples

```bash
# 生成规格 / Generate spec
curl -X POST http://localhost:3000/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{"prd_path": "./prd.prdx", "template": "default"}'

# 验证功能 / Verify feature
curl -X POST http://localhost:3000/api/v1/verify \
  -H "Content-Type: application/json" \
  -d '{"spec_path": "./spec.md", "source_dir": "./src"}'

# 列出技能 / List skills
curl http://localhost:3000/api/v1/skills?category=core
```

***

## MCP 协议集成 / MCP Protocol Integration

PDD-Skills 可作为 MCP Server 被 Claude Desktop / Cursor / Windsurf 等 AI IDE 直接调用：

> **English**: PDD-Skills can serve as an MCP Server directly callable by AI IDEs like Claude Desktop, Cursor, and Windsurf.

### 配置 Claude Desktop / Configure Claude Desktop

```json
{
  "mcpServers": {
    "pdd": {
      "command": "node",
      "args": ["path/to/pdd-skills-v3/lib/mcp-server.js"]
    }
  }
}
```

### 可用 Tools / Available Tools

| Tool | 参数 / Parameters | 返回值 / Returns |
| -------------------- | ----------------------- | ------------- |
| `pdd_generate_spec` | prd_path, template | 生成的规格文件路径 / Generated spec path |
| `pdd_generate_code` | spec_path, feature_id | 生成的文件列表 / Generated files |
| `pdd_verify_feature` | spec_path, source_dir | 验证结果 / Verification result |
| `pdd_code_review` | source_dir, rules | 审查报告 / Review report |
| `pdd_list_skills` | category, language | 技能列表 / Skills list |
| `pdd_get_status` | - | 系统状态 / System status |

***

## SDK 使用指南 / SDK Guide

### JavaScript SDK

```javascript
import { PDDJS } from 'pdd-skills/lib/sdk-js.js';

const client = new PDDJS({
  endpoint: 'http://localhost:3000',
  apiKey: 'your-key',
  maxRetries: 3,
  enableCache: true
});

// 事件监听 / Event listening
client.on('success', ({ method, result }) => {
  console.log(`✅ ${method} 完成 / completed`);
});

// 完整工作流 / Complete workflow
const spec = await client.generateSpec({ prdPath: './prd.prdx' });
console.log(`提取了 / Extracted ${spec.features.length} 个功能点 / features`);

// 验证 / Verification
const verifyResult = await client.verifyFeature({
  specPath: spec.specPath,
  sourceDir: './src'
});
console.log(`覆盖率 / Coverage: ${verifyResult.coveragePercent}%`);

await client.close();
```

### Python SDK

```python
import asyncio
from pdd_sdk import PDDClient

async def main():
    async with PDDClient(endpoint="http://localhost:3000", debug=True) as client:
        # 生成规格 / Generate spec
        spec = await client.generate_spec(prd_path="./prd.prdx")
        print(f"生成 / Generated {len(spec.features)} 个功能点 / features")

        # 批量生成代码 / Batch generate code
        results = await client.batch_generate_specs([
            {"spec_path": spec.spec_path, "feature_id": f["id"]}
            for f in spec.features[:3]
        ])

        # 验证 / Verify
        verify = await client.verify_feature(spec_path=spec.spec_path, source_dir="./src")
        print(f"覆盖率 / Coverage: {verify.coverage_percent}%")
        print(f"等级 / Grade: {verify.grade}")

if __name__ == "__main__":
    asyncio.run(main())
```

***

## 智能引擎 / Intelligence Engine

### 缓存使用 / Cache Usage

```javascript
import { createSystemCache } from 'pdd-skills/lib/cache/system-cache.js';

const cache = createSystemCache({
  l1: { maxSize: 100, ttl: 300000 },    // 5min
  l2: { maxSize: 500, ttl: 1800000 },   // 30min
  l3: { maxSize: 2000, ttl: 7200000, dir: './cache' } // 2h
});

// 自动三级穿透 / Auto three-level penetration
await cache.set('spec:user-auth', specData);
const hit = await cache.get('spec:user-auth');  // L1 命中 / L1 hit

// 命中统计 / Hit statistics
console.log(cache.stats());
// { l1: { hits: 95, misses: 5, rate: 0.95 }, ... }
```

### Token 预算 / Token Budget

```javascript
import { TokenBudgetManager } from 'pdd-skills/lib/token/budget-manager.js';

const budget = new TokenBudgetManager({ totalTokens: 100000 });

budget.on('warning', ({ phase, percent }) => {
  console.log(`⚠️ ${phase} 阶段已使用 / phase used ${percent}%`);
});

budget.on('critical', ({ phase }) => {
  console.log(`🚫 ${phase} 阶段超预算! / phase exceeded budget!`);
});

// 在各阶段消费 / Consume in phases
budget.consume('analysis', 5000);
budget.consume('implementation', 35000);

// 生成报告 / Generate report
console.log(budget.generateReport());
```

### 质量评分 / Quality Scoring

```javascript
import { QualityScorer } from 'pdd-skills/lib/quality/scorer.js';

const scorer = new QualityScorer();

// 评分单个文件 / Score single file
const result = await scorer.scoreFile('./src/user-service.js');
console.log(`${result.grade} (${result.score}/100)`);
// B (72/100) — readability: B, maintainability: A, robustness: C, ...

// 评分整个目录 / Score directory
const report = await scorer.scoreDirectory('./src', {
  format: 'table',  // table | json | markdown
  threshold: 'C'    // 低于此级别高亮 / Highlight below this level
});
```

***

## 插件系统 / Plugin System

### 开发插件 / Develop Plugin

最小可行插件只需 2 个文件 / Minimum viable plugin requires only 2 files:

**plugin.json**

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "我的插件 / My plugin",
  "main": "index.js",
  "pdd": ">=3.0.0",
  "hooks": ["post-verify"],
  "permissions": {
    "filesystem": { "allowRead": true, "allowWrite": false }
  }
}
```

**index.js**

```javascript
import { PluginBase } from 'pdd-skills/lib/plugin/plugin-sdk.js';

export default class MyPlugin extends PluginBase {
  async onActivate(context) {
    context.logger.info('MyPlugin 已激活! / Activated!');

    this.registerCommand('greet', {
      description: '打个招呼 / Say hello',
      handler: (args) => `Hello, ${args.name || 'world'}!`
    });
  }

  async onDeactivate(context) {
    context.logger.info('MyPlugin 正在停用... / Deactivating...');
  }
}
```

### 加载插件 / Load Plugin

```bash
# 复制到插件目录 / Copy to plugins directory
cp -r my-plugin ~/.pdd-skills/plugins/

# 通过 PluginManager 加载 / Load via PluginManager
node -e "
import { PluginManager } from './lib/plugin/plugin-manager.js';
const mgr = new PluginManager({ pluginsDir: './plugins' });
await mgr.loadAll();
console.log(mgr.listPlugins());
"
```

***

## OpenClaw 集成 / OpenClaw Integration

### 启动 OpenClaw 服务 / Start OpenClaw Service

```bash
# 启动服务（后台守护进程 / Daemon mode）
pdd openclaw start -p 5001 -t my-secret-token --daemon

# 查看状态 / Check status
pdd openclaw status

# 列出已注册工具 / List registered tools
pdd openclaw list-tools

# 测试工具调用 / Test tool invocation
pdd openclaw test -n pdd_generate_spec

# 查看通信日志 / View communication logs
pdd openclaw logs --tail
```

### 数据同步 / Data Sync

```javascript
import { DataSyncManager, SyncScheduler } from 'pdd-skills/lib/openclaw/data-sync.js';

const sync = new DataSyncManager({
  direction: 'bidirectional',
  conflictStrategy: 'last-write-wins'
});

// 同步四种数据类型 / Sync four data types
await sync.syncSkills();
await sync.syncConfig();
await sync.syncCache();
await sync.syncReports();

// 定时同步（每5分钟 / Every 5 minutes）
const scheduler = new SyncScheduler(sync, { interval: 300000 });
scheduler.start();
```

***

## 项目结构 / Project Structure

```
pdd-skills-v3/
├── bin/
│   └── pdd.js                  # CLI 入口 / CLI Entry (20+ 子命令 / subcommands)
│
├── lib/                        # 核心库 / Core Library (~80 个模块 / modules)
│   ├── api-server.js           # HTTP 服务器 / HTTP Server
│   ├── api-routes.js            # 18 个 RESTful 端点 / Endpoints
│   ├── mcp-server.js           # MCP 协议服务器 / MCP Protocol Server
│   ├── grpc/                   # gRPC 兼容层 / gRPC Compatible Layer
│   ├── sdk-base.js             # SDK 统一接口 / SDK Unified Interface
│   ├── sdk-js.js               # JavaScript SDK
│   ├── sdk-python/             # Python SDK (8 文件 / files)
│   ├── plugin/                 # 插件系统 / Plugin System
│   ├── openclaw/               # OpenClaw 集成 / Integration
│   ├── cache/                  # 三级缓存 / Three-Level Cache
│   ├── token/                  # Token 预算 / Budget
│   ├── quality/                # 质量评分 / Quality Scoring
│   ├── iteration/              # 迭代优化 / Iteration
│   └── vm/                     # ★ PDD Visual Manager (~38 文件 / files)
│
├── skills/                     # 技能文件 / Skill Files (49 个)
│   ├── core/                   # 14 个核心技能 / Core Skills
│   │                           #   pdd-main · pdd-ba · pdd-extract-features
│   │                           #   pdd-generate-spec · pdd-design-spec ★v3.3.0
│   │                           #   pdd-implement-feature · pdd-verify-feature
│   │                           #   pdd-code-reviewer · pdd-doc-change
│   │                           #   pdd-doc-gardener · pdd-entropy-reduction
│   │                           #   pdd-vm · official-doc-writer
│   │                           #   traffic-accident-assessor
│   ├── expert/                 # 14 个专家技能 / Expert Skills
│   ├── entropy/                # 4 个熵减技能 / Entropy Skills
│   ├── openspec/               # 10 个 OpenSpec 技能 / OpenSpec Skills
│   └── pr/                     # 7 个 PR 技能 / PR Skills
│
├── scripts/                    # 工具脚本 / Tool Scripts
│   ├── linter/                 # PRD Linter 工具链 / Toolchain
│   ├── cso-analyzer.js         # CSO 触发准确率分析 / Trigger Accuracy
│   ├── eval-runner.js          # Evals 测试运行器 / Test Runner
│   ├── i18n-checker.js         # 双语合规检查 / Bilingual Compliance
│   ├── token-analyzer.js       # Token 分析 / Analysis
│   └── windows-compat-check.js # Windows 兼容性检查 / Compatibility
│
├── docs/                       # 项目文档 / Documentation
│   ├── i18n-spec.md           # i18n 规范 / Specification
│   ├── lessons.md             # 经验教训 / Lessons Learned
│   ├── tasks.md               # 任务跟踪 / Task Tracking
│   ├── token-checklist.md     # Token 检查清单 / Checklist
│   └── vm-tasks.md            # VM 任务清单 / VM Tasks
│
├── templates/                  # 项目模板 / Project Templates
├── config/                     # 配置中心 / Configuration Center (Single Source of Truth)
│   ├── bug-patterns.yaml      # Bug模式库 / Bug Patterns (14个模式)
│   ├── prd-rules.yaml         # PRD检测规则 / PRD Rules (30条)
│   ├── gate-config.yaml       # 质量门控配置 / Quality Gates (4级)
│   ├── bpmn-rules.yaml        # BPMN校验规则 / BPMN Rules
│   ├── checkstyle.xml         # Java Checkstyle配置
│   ├── eslint.config.js       # ESLint配置
│   ├── pmd.xml                # PMD配置
│   ├── ruff.toml              # Python Ruff配置
│   └── sqlfluff.cfg           # SQL SQLFluff配置
├── hooks/                      # Hook 配置 / Hook Configuration
└── package.json                # v3.1.2
```

***

## 配置说明 / Configuration

### 全局配置文件 / Global Configuration

```bash
# 查看当前配置 / View current config
pdd config --list

# 设置配置项 / Set config
pdd config --set server.port=8080
pdd config --set cache.l1.maxSize=200
pdd config --set quality.threshold=B
```

### 配置优先级 / Configuration Priority

```
CLI 参数 / CLI Args > 环境变量 / Env Vars > .pddrc.local > .pddrc > defaults
```

### 关键配置项 / Key Configurations

| 分类 / Category | 配置项 / Config | 默认值 / Default | 说明 / Description |
| --------- | ------------------------ | ---------------- | ----------------- |
| **服务器 / Server** | server.port | 3000 | API 端口 / API Port |
| | server.cors | false | CORS 跨域 / Cross-origin |
| | server.rateLimit | 100/min | 限流阈值 / Rate limit |
| **缓存 / Cache** | cache.l1.enabled | true | L1 缓存开关 / L1 Cache |
| | cache.l1.maxSize | 100 | L1 容量 / Capacity |
| | cache.l3.dir | ./cache | L3 磁盘目录 / Disk directory |
| **Token** | budget.total | 100000 | 总预算 / Total budget |
| | budget.warnAt | 0.80 | 警告阈值 / Warning threshold |
| | budget.blockAt | 0.95 | 阻断阈值 / Block threshold |
| **质量 / Quality** | quality.grade | C | 最低通过等级 / Min pass grade |
| | iteration.maxRounds | 5 | 最大迭代轮次 / Max iterations |
| | iteration.convergence | 0.05 | 收敛阈值 / Convergence threshold |
| **插件 / Plugins** | plugins.dir | ./plugins | 插件目录 / Plugins directory |
| | sandbox.enabled | true | 沙箱开关 / Sandbox enabled |
| **★ VM** | vm.port | 3001 | Dashboard 端口 / Dashboard port |
| | vm.refreshInterval | 30 | 刷新间隔(秒) / Refresh interval (s) |
| | vm.theme | light | 主题 / Theme light/dark |
| | vm.autoOpen | true | 自动打开浏览器 / Auto open browser |
| | vm.maxSSEConnections | 100 | 最大SSE连接数 / Max SSE connections |
| | vm.tuiRefreshInterval | 5 | TUI 刷新间隔(秒) / TUI refresh (s) |
| **★ 脚手架 / Scaffold** | scaffold.defaultTemplate | python-fullstack | 默认模板 / Default template |
| | scaffold.outputDir | ./output | 输出目录 / Output directory |

***

## 开发指南 / Development Guide

### 贡献流程 / Contribution Process

1. Fork 本仓库 / Fork this repository
2. 创建特性分支 / Create feature branch: `git checkout -b feature/amazing`
3. 编写代码（遵循 ESM / JSDoc / 零依赖原则）/ Write code (follow ESM / JSDoc / zero-dependency principles)
4. 添加/更新 evals 测试 / Add/update evals tests
5. 运行 `pdd i18n` 和 `pdd cso` 确保合规 / Run `pdd i18n` and `pdd cso` for compliance
6. 提交 PR 并填写模板 / Submit PR with template

### 代码规范 / Code Standards

- **模块 / Modules**: ESM (`import`/`export`)
- **风格 / Style**: JSDoc 注释 + 中文注释 / JSDoc + Chinese comments
- **依赖 / Dependencies**: 仅 Node.js 内置模块（lib/ 下）/ Node.js built-in modules only
- **测试 / Tests**: evals 框架（`pdd eval -c your-category`）/ evals framework
- **i18n**: 新技能必须包含 🇨🇳/🇺🇸 双语章节 / New skills must include bilingual sections

### 技能开发模板 / Skill Development Template

详见 [开发者指南 / Developer Guide](docs/developer-guide/developer-guide.md) 或参考 `example-plugins/hello-world/`。

***

## 质量保障加固 / Quality Assurance Hardening

> 本节记录对 **质量门控（Quality Gates）** 与 **熵减扫描（Entropy Scan）** 两套度量体系的修复与升级。
>
> 二者护的是同一件事：**度量结论必须可信** —— 工具说「通过」时，必须是真的检查过并且真的没问题。

### 一、质量门控：修复 4 个静默失效缺陷 / Quality Gate Fixes

在演示门控输出时发现评分卡出现 `评分 100/100 · 等级 F` 的自相矛盾，顺藤查出四个缺陷。它们的共同特征是**不报错、不告警，被直接当作通过**：

| # | 缺陷 / Defect | 根因 / Root Cause | 影响 / Impact | 修复 / Fix |
| - | ------------- | ----------------- | ------------- | ---------- |
| ① | **等级恒为 F** | `gate-config.yaml` 的 `grade_thresholds` 键为**大写** `A/B/C/D`，而 YAML 解析器的键正则写作 `[a-z_]+` 只匹配小写 → 整块被解析成空对象 | 任何分数都判 F，`Grade: A~D` 分支永不生效 | 键正则放宽为 `[A-Za-z_]+` |
| ② | **22 / 26 条 PRD 规则从未执行**<br>（含 **7 / 7 个 Blocker 规则**） | 规则的 `pattern` 使用了 Python 内联标志 `(?i)`，而 JavaScript 的 `new RegExp('(?i)...')` 直接抛 `Invalid group`；`applyRule` 的 `catch { return [{ passed: true }] }` 把异常**静默判为通过** | **全部 7 条阻断规则集体失效** —— 缺 6 项必备章节的 PRD 仍得 `99/100` 并**通过门禁**（Blocker 计数为 0） | 新增 `normalizePattern()` 剥离 `(?i)`（大小写不敏感本就由 `gi` 标志保证）；正则异常不再静默通过 |
| ③ | **路径打错 → 假绿灯** | 未匹配到任何文件时无条件返回 `success: true` | 文件不存在、CI 变量为空时输出「`100/100` ✅ 通过门禁」——最危险的假阳性 | 区分两种「零文件」：显式指定却零匹配 → `skipped: true`，门控判为「未真正执行」；项目内本无 PRD → `applicable: false`，提示「不适用」而非伪装成通过 |
| ④ | **豁免白名单从未生效**<br>（`exclude_patterns`） | 拿去比对的目标是 `match[0]`，即**命中的关键词本身**（如「提升」两个字），却被用来匹配 `作为.*参考` / `示例` 这类上下文正则 —— 任何输入下都不可能命中 | 所有 `absence` 类规则的豁免名单形同虚设；且失败方式恰好是**静默少报**（本想豁免的没豁免），而「豁免了几处」也没有任何出口可查 | 比对对象改为**整行内容**；豁免命中不再静默跳过，而是作为 `suppressions` 随结果返回 —— 终端打印 `ℹ 已豁免: N 处`，报告单列《已豁免命中》章节 |

> **设计原则：豁免必须可见。** 豁免是「有意不报」，但它同样是「有东西被拦下」这一事实。若只让它静默消失，豁免机制本身就变成了又一个假绿灯出口 —— 与缺陷 ③ 属于同一类问题。因此本仓库要求：**凡是让问题减少的机制，都必须留下计数。**

**修复效果实测 / Measured Impact**

| 场景 / Scenario | 修复前 / Before | 修复后 / After |
| --------------- | --------------- | -------------- |
| 传入**不存在**的文件路径 | `100/100 **F**` ✅ **通过门禁**（路径根本没打开，却给出满分绿灯） | ❌ 门禁未真正执行，结果不具判定力 |
| 缺 6 项必备章节的 PRD | `99/100 **F**`，仅报 **1 条 Info**、**0 Blocker** ✅ **通过门禁** | **`0/100 F`** —— 6 Blocker + 2 Critical + 8 Warning + 4 Info，❌ **阻断** |
| 真实项目 PRD | `78/100 **F**`，10 条问题，✅ 通过门禁 | **`77/100 C`**，11 条问题 —— 等级恢复为有效档位 |
| 含黑名单词但带「示例 / 作为参考」上下文的行 | 照报 —— 豁免**从不生效**（实测 `0 处` 豁免） | 该行被真正豁免，摘要与报告均显示「已豁免 1 处」 |
| 舆情项目真实 PRD<br>（`YUQING-System-Project`，改文案前 / 后） | `77/100 **C**`，0 Blocker / **3 Warning** / 8 Info | `92/100 **A**`，0 Blocker / **0 Warning** / 8 Info，✅ 通过 |

> 注意「等级 F」在修复前是**恒定的** —— 无论 0 分还是 100 分都是 F，正是缺陷 ① 的直接表现。上表前两行修复前全部为 F，修复后 A~F 才真正随分数变化。

```bash
# 复现验证 / Reproduce
pdd linter -t prd -f ./my-feature.prd
```

### 二、熵减扫描：评分模型重构 + 检测能力扩展 / Entropy Scan Overhaul

`skills/core/pdd-entropy-reduction/scripts/entropy_scan.py` 原有三个问题：**评分口径与文档相反**、**只认 JavaScript**、**中大型项目必然撞底**。

#### 1. 评分口径对齐文档

代码原逻辑为「分数越低越好」（≤30 判绿），与 `SKILL.md` 定义的「**0-100，100 = 最有秩序**」正好相反。现统一为**高分 = 健康**，并明确五档分档：

| 区间 | 90-100 | 70-89 | 50-69 | 30-49 | 0-29 |
| ---- | ------ | ----- | ----- | ----- | ---- |
| 状态 | 🟢 优秀 | 🟢 良好 | 🟡 一般 | 🟠 警告 | 🔴 危急 |

#### 2. 阈值对齐黄金原则

单函数长度阈值 `100 → 50` 行，与 `golden-principles.md` 中 `function_length.healthy: < 50 lines` 的约定一致。

#### 3. 检测语言从 JS 扩展到 4 种

原正则 `^\s*(async\s+)?function\s+\w+` 漏掉箭头函数、类方法、Python `def`、Java 方法。现支持 **JavaScript / TypeScript / Python / Java**：

- `strip_line_noise()` —— 逐字符状态机剥离字符串与注释，避免把注释里的伪代码当真实代码
- `find_python_functions()` —— 依缩进判定函数边界（缩进型语言）
- `find_brace_functions()` —— 依 `{}` 配对判定（括号型语言）
- `is_block_open()` —— 用栈区分「逻辑块」与「对象 / 字典字面量」，避免字面量虚增嵌套深度

#### 4. 评分模型：从「绝对扣分」改为「密度归一化」

原公式 `维度评分 = 100 - 扣分累计` 用一把固定 0-100 的尺子去量任意规模的项目，导致中大型项目的「代码质量」维度**必然归 0** —— 既无区分度，也看不出「改一处能涨多少分」。

```
ratio    = (扣分累计 / KLOC) / 容忍密度        # 0 = 完美，1 = 扣满
维度评分 = 100 - 100 × sqrt(min(1, ratio))     # 规模地板 MIN_KLOC = 1 KLOC

容忍密度 = { 文档 6.0 / 架构 10.0 / 代码 45.0 / 债务 10.0 }
```

**设计取舍 / Design Rationale**

- **为什么按 KLOC 归一化** —— 度量的是**问题密度**。同样密度下，大项目不应比小项目更差；小项目里单条问题的影响则如实放大。
- **为什么用 sqrt 而非线性** —— 线性在低密度区间斜率过陡（密度 10/KLOC 就掉到 78 分），区分度全挤在高分区。sqrt 让 0~45 这一整段都能拉开差距，同时保留「密度达到容忍值即归 0」的上界语义。
- **容忍值如何标定** —— 由三个真实项目的实测扣分密度反推（若依 v6 / pdd-test-system / 本仓库），使三者落在「一般 ~ 良好」档，具备横向可比性。

**评分对比实测 / Before vs After**

> 「修复前」列由**同一份问题集 + 旧公式**复算得出，确保对比只反映评分模型的变化。

| 项目 / Project | 规模 / Size | 综合评分 / Total | 代码质量 / Code Quality |
| -------------- | ----------- | ---------------- | ----------------------- |
| RuoYi-Vue-Plus v6 | 131.4 KLOC | 70 → **87** 🟢 良好 | **0 → 67** 🟡 一般 |
| pdd-test-system | 16.2 KLOC | 75 → **76** 🟢 良好 | **0 → 4** 🔴 危急 |
| 本仓库 / This repo | 194.7 KLOC | 68 → **77** 🟢 良好 | **0 → 23** 🔴 危急 |

关键改善是**三者终于拉开差距**（67 / 4 / 23）：pdd-test-system 的长函数密度为 4.3 个/KLOC，是若依 v6（0.46 个/KLOC）的 9 倍，落入危急档符合实际观感。

#### 5. 顺带修复的隐藏缺陷

- **重复代码检测** —— 改为整块步进 + 按文件组聚合，全仓噪声从数千条降至数十条量级
- **重复块漏检** —— `range` 少一位导致最后一块永不参与比对
- **虚拟环境污染** —— `exclude_dirs` 补齐 `.venv` / `site-packages`，不再扫描第三方依赖
- **文档引用判定低效** —— `_is_doc_referenced` 改为索引缓存，避免逐条全文匹配
- **Python 函数长度虚高** —— 尾部空行被计入函数体
- **命名误报** —— `const __dirname` / `__filename` 被误判为命名违规

#### 6. 单测固化

新增 `scripts/test_entropy_scan.py`（**28 项断言，全部通过**），纯标准库实现，直接 `python` 运行、无需 pytest。覆盖三语言长函数边界、深嵌套、纯字面量不误报、Python 续行不虚高，以及评分模型性质（同密度跨规模同分、大项目不再归零、单调性、规模地板）。

```bash
# 运行单测 / Run tests
python skills/core/pdd-entropy-reduction/scripts/test_entropy_scan.py

# 扫描项目 / Scan a project
python skills/core/pdd-entropy-reduction/scripts/entropy_scan.py \
  --project /path/to/project --output entropy-report.md
```

### 三、两套体系的分工 / Division of Labor

修复过程中也厘清了一个常见混淆点：这两套体系**互不引用**，职责完全不同。

| | **质量门控 / Quality Gates** | **熵减技能 / Entropy Scan** |
| --- | --- | --- |
| 形态 | Node 工具链，有 CLI（`pdd linter`） | Agent 技能（Markdown 指令 + Python 脚本） |
| 入口 | `scripts/linter/run-linters.js` → `gate-engine.js` | `skills/core/pdd-entropy-reduction/` |
| 查什么 | **规范符合性**：Checkstyle / PMD / ESLint / Ruff、PRD 规则、SQLFluff、BPMN | **腐化度**：文档一致性、架构边界、复杂度 / 重复、技术债 |
| 评分 | 100 起扣：critical −15 / warning −5 / info −1；有 blocker 直接 0 | 密度归一化：`100 − 100 × sqrt(min(1, 扣分/KLOC ÷ 容忍密度))` |
| 判定 | **会阻断**（BLOCKER 必须修复才算通过） | **只度量**，从不阻断 |
| 用在何时 | PRD 写完 / 代码写完，卡在门禁上 | 定期体检、观察历史趋势 |

---

## 版本历史 / Version History

| 版本 / Version | 日期 / Date | 重要变更 / Major Changes |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v3.3.1** | 2026-10-19 | **设计规范消费闭环 / Design Spec Consumption Loop**: `pdd-implement-feature` 升级至 v2.1 —— 流程新增 **Step 2「读取界面设计规范」**：前端编码前必须读取 `ui/DESIGN.md`（颜色 token、状态色板、4px 间距密度、组件模式），并输出第 9 条铁律「设计规范对齐」与新红旗 EXEC-IMPL-007；`ui/DESIGN.md` 缺失时输出 WARN 提示先运行 `/pdd-design-spec`（不阻塞后端实现）。同时修正 README/package.json 中的技能计数（41+ → **49**，core 14 / expert 14），补全核心技能列表。详见 [界面设计规范](#-界面设计规范--design-spec-new-v330) |
| **v3.3.0** | 2026-10-19 | **★ 界面设计规范 / Design Spec**: 新增 `pdd-design-spec` 核心技能，在 PRD 与 specs 之后生成 `ui/DESIGN.md` —— 一份 AI 可读、可执行、可审计的设计契约。含 **12 章规范骨架**、**8 条铁律**、**12 项可判定审计清单**、**12 个可复用模式库**（提炼自 84 份真实站点设计系统分析）。两个确定性脚本：`gen-design-scaffold.js` 从 PRD/spec 抽取状态枚举、页面清单、渠道并自动配出合规色板；`check-design.js` 做 **色相 × 明度双重判定**的语义校验。关键设计主张：**状态优先于品牌**、**状态色只作圆点不作文字**（解决高明度色做小字对比度必然不足的问题）、**状态爆炸时收敛色族而非挤色相**。内置融媒体领域预设（11 态稿件状态机 / 8 渠道 / 内容分级）。详见 [界面设计规范](#-界面设计规范--design-spec-new-v330) |
| **v3.2.1** | 2026-09-30 | **★ 质量保障加固 / Quality Assurance Hardening**: 修复质量门控 **4 个静默失效缺陷**（等级恒为 F、**22/26 条 PRD 规则含 7/7 个 Blocker 从未执行**、路径打错返回假绿灯、**`exclude_patterns` 豁免白名单从未生效**且无出口可查）并新增静默失效防护（豁免次数在摘要与报告中显式计数）；熵减扫描评分模型重构为**密度归一化 + sqrt 压缩**（原绝对扣分导致中大型项目代码质量恒为 0），评分口径对齐文档（0-100 高分=健康）、函数长度阈值 100→50 行、检测语言由 JS 扩展至 **JS/TS/Python/Java**，新增 **28 项基于标准库的单测**。详见 [质量保障加固](#质量保障加固--quality-assurance-hardening) |
| **v3.2.0** | 2026-05-08 | **★ 测试用例系统发布 / Testcase System Release**: 新增 testcase-modeler（测试用例建模师）和 testcase-agent（自动化测试执行专家）两个核心 Skill，基于 Chrome DevTools MCP 实现零代码 E2E 测试自动化，支持自然语言转 YAML 用例、5条执行铁律、4级自愈策略、深度网络校验、专业 HTML 报告生成，总技能数增至 **43+** |
| **v3.1.2** | 2026-04-10 | **技能生态大扩展 / Skill Ecosystem Expansion**: 新增 7 个专家技能 / 7 new expert skills, 新增 4 个熵减技能 / 4 entropy skills, PR技能扩展至7个 / PR skills expanded to 7, 核心技能增至12个 / Core skills increased to 12, 总计41+技能 / Total 41+ skills |
| **v3.1.1** | 2026-04-08 | **Windows兼容性+项目结构优化 / Windows Compatibility + Structure Optimization**: 添加 Windows 终端兼容支持 / Windows terminal support, 优化项目初始化流程 / Optimize init process |
| **v3.1.0** | 2026-04-05 | **智能能力+生态集成 / Intelligence + Ecosystem**: Bug模式库集中化 / Centralized bug patterns, PRD Linter扩展 / Extended PRD linter, 4级门控引擎 / 4-level gate engine, OpenAPI契约同步 / OpenAPI sync, PRD感知动态模板 / PRD-aware templates, MVP分层交付策略 / MVP delivery, expert-ruoyi+expert-activiti专家技能 / Expert skills |
| **v3.0.1** | 2026-04-07 | **PDD Visual Manager 发布 / PDD Visual Manager Release**: Web Dashboard + Terminal TUI 双形态可视化监控 / Dual-mode visualization, 11个REST API端点 / 11 REST endpoints, SSE实时推送 / SSE push, Canvas图表引擎 / Canvas charts, ANSI TUI组件库 / ANSI TUI components |
| **v3.0.0** | 2026-04-05 | **正式发布版 / Official Release**: 6大Phase全部完成 / 6 Phases completed + 插件系统 / Plugin system + OpenClaw + gRPC + Python SDK |
| v2.x | 2026-03 | 内部迭代版本 / Internal iteration: MCP/SDK/缓存/Token/质量/迭代 / Cache/Token/Quality/Iteration |
| v1.x | 2025-12 | 初始版本 / Initial version: 基础设施 + 核心技能 + Linter / Infrastructure + Core skills + Linter |

***

## 致谢 / Acknowledgments

- **Claude / Anthropic** — AI 原生开发的理想伙伴 / Ideal partner for AI-native development
- **Node.js 社区 / Node.js Community** — 提供卓越的内置模块 / Providing excellent built-in modules
- **开源社区 / Open Source Community** — 所有灵感和最佳实践的来源 / Source of all inspiration and best practices

***

## 许可证 / License

[MIT](LICENSE) © PDD Team 2025-2026

***

<p align="center">
  <b>PDD-Skills v3.2.1 — 让 AI 成为你的全职结对编程伙伴 🤖</b>
  <br>
  <b>Let AI be your full-time pair programming partner 🤖</b>
</p>

<p align="center">
  <sub>43+ Skills ✅ · 14 Bug Patterns ✅ · 30 PRD Rules ✅ · 4-Level Gate ✅ · 4 Entropy Skills ✅ · ★ Testcase System ✅</sub>
</p>
