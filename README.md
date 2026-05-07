# PDD-Skills v3.0

> 从需求文档到代码交付的全链路自动化平台 — **7 大 Phase**、**41+ 技能**、**14 个 Bug 模式**、**30 条 PRD 规则**、**4 级质量门控**
>
> **English**: End-to-end automation platform from PRD to code delivery — **7 Phases**, **41+ Skills**, **14 Bug Patterns**, **30 PRD Rules**, **4-Level Quality Gates**

***

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
- [配置中心 / Configuration Center](#配置中心--configuration-center)
- [API 层 / API Layer](#api-层--api-layer)
- [MCP 协议集成 / MCP Protocol Integration](#mcp-协议集成--mcp-protocol-integration)
- [SDK 使用指南 / SDK Guide](#sdk-使用指南--sdk-guide)
- [智能引擎 / Intelligence Engine](#智能引擎--intelligence-engine)
- [插件系统 / Plugin System](#插件系统--plugin-system)
- [OpenClaw 集成 / OpenClaw Integration](#openclaw-集成--openclaw-integration)
- [项目结构 / Project Structure](#项目结构--project-structure)
- [配置说明 / Configuration](#配置说明--configuration)
- [开发指南 / Development Guide](#开发指南--development-guide)
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

> **English**: **PDD-Skills v3.0 Capability Panorama**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       PDD-Skills v3.0 能力全景图 / Capability Panorama            │
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
| **版本 / Version** | v3.1.2 |
| **核心技能 / Core Skills** | 12 个（全双语 / Full Bilingual 🇨🇳🇺🇸） |
| **专家技能 / Expert Skills** | 12 个（安全/性能/MySQL/若依/若依权限/Activiti/Vue3/微服务/Bug修复/测试/架构） |
| **熵减技能 / Entropy Skills** | 4 个（审计 + 架构约束 + 代码质量 + 自动重构） |
| **OpenSpec技能 / OpenSpec Skills** | 10 个（变更管理全生命周期 / Full Lifecycle） |
| **PR技能 / PR Skills** | 7 个（模板引擎 + 多轮审查 + PR创建/审查/合并/批量/任务管理） |
| **Bug模式库 / Bug Patterns** | 14 个（7通用 + 7若依专用），集中式管理 `config/bug-patterns.yaml` |
| **PRD规则 / PRD Rules** | 30 条（6大类 / 6 Categories），集中式管理 `config/prd-rules.yaml` |
| **质量门控 / Quality Gates** | 4级（Blocker/Critical/Warning/Info）+ 0-100评分 |
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

# 6️⃣ 基于规格生成代码骨架 / Generate code skeleton
pdd generate -s ./specs/spec.md -o ./src --dry-run

# 7️⃣ 验证实现 / Verify implementation
pdd verify -s ./specs/spec.md -c ./src --json

# 8️⃣ 生成质量报告 / Generate quality report
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
pdd linter -t java|js|python|sql|prd|skill|all -f ./src  # Linter检查
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

12 个核心技能 + 五大行为塑造机制。

> **English**: 12 core skills + 5 behavior shaping mechanisms.

#### 核心技能列表 / Core Skills List

| 技能名称 / Skill Name | 用途 / Purpose | 双语 / Bilingual |
| ----------------------- | ------------------------ | -- |
| `pdd-main` | 主入口，协调全部子技能 / Main coordinator | ✅ |
| `pdd-ba` | 业务分析与需求建模 / Business analysis | ✅ |
| `pdd-extract-features` | 从 PRD 提取功能点 / Extract features from PRD | ✅ |
| `pdd-generate-spec` | 生成开发规格文档 / Generate specifications | ✅ |
| `pdd-implement-feature` | 基于规格实现代码 / Implement code from spec | ✅ |
| `pdd-verify-feature` | 验证实现符合规格 / Verify implementation | ✅ |
| `pdd-code-reviewer` | 多维度代码审查 / Multi-dimensional code review | ✅ |
| `pdd-doc-change` | 变更文档管理 / Document change management | ✅ |
| `pdd-doc-gardener` | 文档清理与维护 / Document maintenance | ✅ |
| `pdd-entropy-reduction` | 技术债务治理 / Technical debt governance | ✅ |
| `official-doc-writer` | 党政机关公文生成 / Official document generation | ✅ |
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
| **expert-testcases** | 测试用例设计/边界值分析/覆盖率优化 | 多维度测试策略，自动化测试生成 |
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
├── core/                    # 11 个核心技能 / 11 Core Skills (必装 / Required)
│   ├── pdd-main/           # 主协调器 / Main coordinator
│   ├── pdd-ba/             # 业务分析 / Business analysis
│   ├── pdd-extract-features/   # 特征提取 / Feature extraction
│   ├── pdd-generate-spec/      # 规格生成 / Spec generation
│   ├── pdd-implement-feature/  # 代码实现 / Code implementation
│   ├── pdd-verify-feature/     # 功能验证 / Feature verification
│   ├── pdd-code-reviewer/      # 代码审查 / Code review
│   ├── pdd-doc-change/         # 变更文档 / Document change
│   ├── pdd-doc-gardener/       # 文档维护 / Document maintenance
│   ├── pdd-entropy-reduction/  # 技术债务 / Technical debt
│   ├── official-doc-writer/    # 公文生成 / Official documents
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
│   ├── expert-testcases/   # 测试用例 / Test cases
│   ├── software-architect/ # 软件架构 / Software architecture
│   ├── software-engineer/  # 软件工程 / Software engineering
│   └── system-architect/   # 系统架构 / System architecture
│
├── entropy/                 # 熵减治理 / Entropy reduction (4个)
├── pr/                      # PR与交付 / PR & Delivery (7个)
├── openspec/                # OpenSpec 协作 / Collaboration (10个)
└── software/                # 通用软件工程 / General software engineering
```

***

## 配置中心 / Configuration Center

> **Single Source of Truth 原则 / Principle**: 所有配置集中管理，技能和脚本通过引用获取，避免散落和不一致。
>
> **English**: All configurations are centrally managed; skills and scripts access them by reference to avoid scattering and inconsistency.

### 配置文件一览 / Configuration Files

| 配置文件 / Config File | 用途 / Purpose | 消费方 / Consumers |
| -------------------------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| `config/bug-patterns.yaml` | Bug模式库（14个模式 / 14 patterns） | pdd-code-reviewer, pdd-verify-feature, pdd-implement-feature, pdd-template-engine, expert-ruoyi |
| `config/prd-rules.yaml` | PRD检测规则（30条 / 30 rules） | pdd-linter, run-linters.js |
| `config/gate-config.yaml` | 质量门控配置（4级 / 4 levels） | gate-engine.js |

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

***

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
├── skills/                     # 技能文件 / Skill Files (41+ 个)
│   ├── core/                   # 12 个核心技能 / Core Skills
│   ├── expert/                 # 11 个专家技能 / Expert Skills
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

## 版本历史 / Version History

| 版本 / Version | 日期 / Date | 重要变更 / Major Changes |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
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
  <b>PDD-Skills v3.1.2 — 让 AI 成为你的全职结对编程伙伴 🤖</b>
  <br>
  <b>Let AI be your full-time pair programming partner 🤖</b>
</p>

<p align="center">
  <sub>41+ Skills ✅ · 14 Bug Patterns ✅ · 30 PRD Rules ✅ · 4-Level Gate ✅ · 4 Entropy Skills ✅</sub>
</p>
