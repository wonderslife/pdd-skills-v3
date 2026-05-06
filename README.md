# PDD-Skills v3.0

[![Version](https://img.shields.io/badge/version-3.1.2-blue.svg null)](https://github.com/pdd-skills/pdd-skills)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg null)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-orange.svg null)](LICENSE)
[![Patterns](https://img.shields.io/badge/bug_patterns-14-purple.svg null)](config/bug-patterns.yaml)
[![Gate](https://img.shields.io/badge/gate_rules-30-critical.svg null)](config/prd-rules.yaml)
[![Skills](https://img.shields.io/badge/skills-41+-brightgreen.svg null)](skills/)

> **PRD 驱动的 AI 原生软件开发工作流框架**
>
> 从需求文档到代码交付的全链路自动化平台 — **7 大 Phase**、**41+ 技能**、**14 个 Bug 模式**、**30 条 PRD 规则**、**4 级质量门控**

***

## 目录

- [什么是 PDD-Skills？](#什么是-pdd-skills)
- [核心特性](#核心特性)
- [快速开始](#快速开始)
- [CLI 命令大全](#cli-命令大全)
- [七大 Phase 架构](#七大-phase-架构)
  - [Phase 1: 基础设施建设](#phase-1-基础设施建设)
  - [Phase 2: 核心能力增强](#phase-2-核心能力增强)
  - [Phase 3: 专家系统扩展](#phase-3-专家系统扩展)
  - [Phase 4: 平台化建设](#phase-4-平台化建设)
  - [Phase 5: 智能化升级](#phase-5-智能化升级)
  - [Phase 6: 生态建设](#phase-6-生态建设)
  - [📊 Phase 7: PDD Visual Manager](#-phase-7-pdd-visual-manager)
- [技能系统](#技能系统)
- [配置中心](#配置中心)
- [API 层](#api-层)
- [MCP 协议集成](#mcp-协议集成)
- [SDK 使用指南](#sdk-使用指南)
- [智能引擎](#智能引擎)
- [插件系统](#插件系统)
- [OpenClaw 集成](#openclaw-集成)
- [项目结构](#项目结构)
- [配置说明](#配置说明)
- [开发指南](#开发指南)
- [版本历史](#版本历史)

***

## 什么是 PDD-Skills？

**PDD (PRD-Driven Development)** 是一种以 **产品需求文档 (PRD)** 为驱动的 AI 原生软件开发方法论。PDD-Skills 是该方法的完整工具链实现，覆盖从需求分析到代码交付的完整生命周期。

### 核心理念

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   PRD 文档   │───▶│  特征提取    │───▶│  规格生成    │───▶│  代码实现    │───▶│  验证报告    │
│             │    │             │    │             │    │             │    │             │
│ pdd-ba      │    │ pdd-extract │    │ pdd-generate│    │ pdd-implement│    │ pdd-verify  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       ▲                   ▲                   ▲                   ▲                   ▲
       │                   │                   │                   │                   │
  业务分析师            AI Agent           AI Agent          开发者              QA
```

### 为什么选择 PDD-Skills？

| 特性    | 传统开发 | TDD  | **PDD-Skills**             |
| ----- | ---- | ---- | -------------------------- |
| 驱动文档  | 无/弱  | 测试用例 | **PRD 需求文档**               |
| AI 原生 | ❌    | ❌    | ✅ **深度集成**                 |
| 双语支持  | ❌    | ❌    | ✅ **🇨🇳🇺🇸 中英双语**        |
| 行为塑造  | ❌    | ❌    | ✅ **Iron Law + Red Flags** |
| 质量门禁  | 弱    | 强    | ✅ **5维评分 + Linter**        |
| 可视化监控 | ❌    | ❌    | ✅ **PDD Visual Manager**   |
| 插件扩展  | 有限   | 有限   | ✅ **沙箱隔离插件系统**             |
| 多协议   | 单一   | 无    | ✅ **REST + MCP + gRPC**    |

***

## 核心特性

### 🎯 七大能力矩阵

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       PDD-Skills v3.0 能力全景图                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                        │
│  │ Phase 1  │  │ Phase 2  │  │ Phase 3  │  │ Phase 4  │                        │
│  │ 基础设施  │  │ 核心能力  │  │ 专家系统  │  │ 平台化    │                        │
│  │          │  │          │  │          │  │          │                        │
│  │ • npx安装 │  │ • 11核心  │  │ • 安全   │  │ • CLI    │                        │
│  │ • Linter  │  │   技能    │  │ • 性能   │  │ • API    │                        │
│  │ • Hook    │  │ • i18n   │  │   专家   │  │ • MCP    │                        │
│  │ • Evals  │  │ • CSO    │  │          │  │ • JS SDK │                        │
│  │          │  │ • Token  │  │          │  │ • Python│                        │
│  └──────────┘  │ • Evals  │  └──────────┘  │ • gRPC   │                        │
│                └──────────┘                └──────────┘                        │
│                                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                                      │
│  │ Phase 5  │  │ Phase 6  │  │ Phase 7  │                                      │
│  │ 智能化   │  │ 生态建设  │  │ VM可视化 │                                      │
│  │          │  │          │  │          │                                      │
│  │ • 三层缓存│  │ • 插件   │  │ • Web    │                                      │
│  │ • Token  │  │   系统   │  │ Dashboard│                                      │
│  │   预算   │  │ • OpenClaw│  │ • TUI    │                                      │
│  │ • 质量评分│  │ • 社区文档│  │ • SSE    │                                      │
│  │ • 迭代优化│  │          │  │ • Canvas │                                      │
│  └──────────┘  └──────────┘  └──────────┘                                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 🏗️ 脚手架系统

> **PDD-Skills v3.0.1+ 新增内置脚手架系统**,提供生产级全栈项目模板,支持从零到一的快速项目初始化。

#### 可用模板

| 模板名称            | 技术栈                                    | 适用场景           | 状态    |
| --------------- | --------------------------------------- | ------------- | ----- |
| **python-fullstack** | FastAPI + Vue3 + TypeScript + TailwindCSS | 企业级全栈 Web 应用 | ✅ 稳定版 |

#### 核心能力矩阵

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    python-fullstack 模板能力矩阵                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  data_permission │  │    oauth_sso     │  │ workflow_engine │             │
│  │   数据权限引擎    │  │  OAuth2 六平台认证 │  │   工作流状态机引擎  │             │
│  │                 │  │                 │  │                 │             │
│  │ • 组织级数据隔离  │  │ • 企业微信       │  │ • 15种状态定义     │             │
│  │ • 借调合并机制   │  │ • 钉钉          │  │ • 会签/或签      │             │
│  │ • 行级权限控制   │  │ • 飞书          │  │ • 条件分支路由     │             │
│  │                 │  │ • 微信公众号     │  │ • 回退/撤回      │             │
│  │                 │  │ • OIDC 通用     │  │ • 定时任务触发     │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │                  responsive_ui                          │               │
│  │                    响应式前端系统                          │               │
│  │                                                         │               │
│  │  PC端 (≥1280px) → 平板 (768-1279px) → 大屏手机 (≤767px)  │               │
│  │  6档断点自适应 · 组件级响应式 · 暗色模式支持               │               │
│  └─────────────────────────────────────────────────────────┘               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 技术栈详情

| 层面         | 技术选型                                   | 版本要求      |
| ---------- | ---------------------------------------- | --------- |
| **后端框架**   | Python FastAPI                           | 3.11+      |
| **ORM**     | SQLAlchemy [asyncio]                      | 2.x+       |
| **数据库**   | MySQL                                   | 8.0+       |
| **前端框架**   | Vue3 + Vite + TypeScript                  | 3.x+       |
| **UI 框架**  | TailwindCSS                             | 3.x+       |
| **容器化**   | Docker + docker-compose                  | 最新稳定版     |
| **CI/CD**   | GitHub Actions / GitLab CI               | -          |

#### 快速使用

```bash
# 1️⃣ 使用脚手架创建全栈项目
pdd scaffold init my-fullstack-app --template python-fullstack

# 2️⃣ 进入项目目录
cd my-fullstack-app

# 3️⃣ 查看模板配置
cat scaffolds/python-fullstack/template_config.yaml

# 4️⃣ 一键启动开发环境（含数据库）
docker-compose up -d

# 5️⃣ 启动后端服务
cd backend && uvicorn main:app --reload --port 8000

# 6️⃣ 启动前端服务
cd frontend && npm run dev
```

#### 模板目录结构预览

```
scaffolds/python-fullstack/
├── template_config.yaml          # 模板元数据 & Hooks 配置
├── README.md                     # 模板使用指南
├── docs/
│   ├── architecture-design.md    # 架构设计文档
│   ├── database-design.md        # 数据库设计文档
│   ├── api-design.md             # API 设计文档
│   └── deployment-guide.md       # 部署指南
├── backend/
│   ├── app/
│   │   ├── core/                # 核心模块 (data_permission/oauth_sso/workflow_engine)
│   │   ├── api/                 # API 路由层
│   │   ├── models/              # SQLAlchemy 数据模型
│   │   ├── schemas/             # Pydantic 请求/响应模型
│   │   └── services/            # 业务逻辑层
│   ├── alembic/                 # 数据库迁移
│   ├── tests/                   # 单元测试 & 集成测试
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── views/               # 页面组件 (响应式布局)
│   │   ├── components/          # UI 组件库
│   │   ├── stores/              # Pinia 状态管理
│   │   ├── api/                 # API 请求封装
│   │   └── utils/               # 工具函数
│   ├── tailwind.config.js       # 6档断点配置
│   └── vite.config.ts
├── docker-compose.yml           # 一键部署编排
├── .github/workflows/           # CI 流水线
└── config/                      # 环境配置文件
```

#### 质量保证

✅ 已通过 **4 项代码质量修复验证**:
- 数据库连接池配置优化
- 安全异常处理完善
- datetime 弃用 API 替换
- SQLAlchemy 异步 API 正确性校验

---

### 📊 关键数据

| 指标          | 数值                                            |
| ----------- | --------------------------------------------- |
| **版本**      | v3.1.2                                        |
| **核心技能**    | 12 个（全双语 🇨🇳🇺🇸）                            |
| **专家技能**    | 12 个（安全/性能/MySQL/若依/若依权限/Activiti/Vue3/微服务/Bug修复/测试/架构） |
| **熵减技能**    | 4 个（审计 + 架构约束 + 代码质量 + 自动重构）              |
| **OpenSpec技能**| 10 个（变更管理全生命周期）                         |
| **PR技能**    | 7 个（模板引擎 + 多轮审查 + PR创建/审查/合并/批量/任务管理）    |
| **Bug模式库**  | 14 个（7通用 + 7若依专用），集中式管理 `config/bug-patterns.yaml` |
| **PRD规则**   | 30 条（6大类），集中式管理 `config/prd-rules.yaml`      |
| **质量门控**    | 4级（Blocker/Critical/Warning/Info）+ 0-100评分    |
| **协议支持**    | RESTful + MCP + gRPC + SSE                    |
| **SDK 语言**  | JavaScript + Python                           |

***

## 快速开始

### 安装

```bash
# 全局安装（推荐）
npm install -g pdd-skills

# 或本地安装
npm install pdd-skills
```

<details>
<summary>⚙️ 环境要求</summary>

- **Node.js**: >= 18.0.0 (ESM 模块支持)
- **操作系统**: Windows / macOS / Linux
- **依赖**: commander ^12.0.0, chalk ^5.3.0, fs-extra ^11.2.0, yaml ^2.3.0

</details>

### 5 分钟上手

```bash
# 1️⃣ 初始化项目
pdd init my-project
cd my-project

# 2️⃣ 查看可用技能
pdd list --json

# 3️⃣ 编写你的 PRD 文档（或使用模板）
cp templates/prd-template.prdx ./my-feature.prdx

# 4️⃣ 提取功能特征
npx pdd-skills extract-features ./my-feature.prdx

# 5️⃣ 生成开发规格
npx pdd-skills generate-spec ./my-feature.prdx -o ./specs

# 6️⃣ 基于规格生成代码骨架
pdd generate -s ./specs/spec.md -o ./src --dry-run

# 7️⃣ 验证实现
pdd verify -s ./specs/spec.md -c ./src --json

# 8️⃣ 生成质量报告
pdd report -t html -o ./reports
```

<br />

```bash
```

***

## CLI 命令大全

PDD-Skills 提供丰富的 CLI 命令，覆盖完整的开发生命周期和可视化监控。

### 项目管理

```bash
pdd init [path]              # 初始化项目目录结构
pdd update [--version]        # 更新技能到最新版本
pdd list [-c category]       # 列出所有技能（core/expert/openspec）
pdd version                  # 显示版本信息
```

### 开发流程

```bash
# 规格与代码
pdd generate -s spec.md -o ./src --dry-run     # 代码生成（预览模式）
pdd verify -s spec.md -c ./src --json          # 功能验证
pdd report -t html|json|md -o ./reports         # 报告生成

# 质量门禁
pdd linter -t java|js|python|sql|prd|skill|all -f ./src
pdd eval -c core|expert                         # 运行评估测试
pdd token -f ./src                               # Token 效率分析

# 国际化
pdd i18n -c core|expert|all                     # 双语合规检查
pdd cso                                           # 触发准确率分析
```

### 🔥 PDD Visual Manager（新增）

```bash
# Web Dashboard
pdd dashboard              # 启动 Web Dashboard http://localhost:3001
pdd dashboard -p 8080      # 自定义端口

# Terminal TUI
pdd tui                    # 启动 Terminal TUI

# VM 数据查询
pdd vm status              # 项目状态摘要
pdd vm features            # 功能点列表
pdd vm export --format csv # 导出数据
```

### 🏗️ 脚手架命令（v3.0.1+）

```bash
# 初始化脚手架项目
pdd scaffold init <project-name> --template <template-name>

# 查看可用模板列表
pdd scaffold list

# 查看模板详情
pdd scaffold info <template-name>
```

### 服务端

```bash
# API 服务器
pdd api -p 3000 --cors                          # 启动 RESTful API
pdd api:dev                                      # 开发模式（CORS全开）

# OpenClaw 集成
pdd openclaw start [-p port] [-t token] [--daemon]
pdd openclaw stop
pdd openclaw status
pdd openclaw list-tools
pdd openclaw test [-n tool-name]
pdd openclaw logs [--tail]

# 配置管理
pdd config --list                                 # 查看配置
pdd config --set key=value                       # 设置配置项
pdd config --get key                              # 读取配置项
```

***

## 七大 Phase 架构

### Phase 1: 基础设施建设

提供项目脚手架、质量门禁和工具链基础能力。

| 组件            | 说明                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------- |
| **npx 安装机制**  | `npx pdd-skills init` 一键初始化                                                                    |
| **Linter 体系** | Java(Checkstyle+PMD) / JS(ESLint) / Python(Ruff) / SQL(SQLFluff) / Activiti(BPMN) / Skill(自定义) |
| **Hook 系统**   | 7 种事件钩子，可在流程节点注入自定义逻辑                                                                          |
| **Evals 框架**  | 结构/内容/质量/CSO 四种测试类型                                                                            |
| **Token 分析器** | 中英文混合 Token 计数与效率评级                                                                            |

### Phase 2: 核心能力增强

12 个核心技能 + 五大行为塑造机制。

#### 核心技能列表

| 技能名称                    | 用途          | 双语 |
| ----------------------- | ----------- | -- |
| `pdd-main`              | 主入口，协调全部子技能 | ✅  |
| `pdd-ba`                | 业务分析与需求建模   | ✅  |
| `pdd-extract-features`  | 从 PRD 提取功能点 | ✅  |
| `pdd-generate-spec`     | 生成开发规格文档    | ✅  |
| `pdd-implement-feature` | 基于规格实现代码    | ✅  |
| `pdd-verify-feature`    | 验证实现符合规格    | ✅  |
| `pdd-code-reviewer`     | 多维度代码审查     | ✅  |
| `pdd-doc-change`        | 变更文档管理      | ✅  |
| `pdd-doc-gardener`      | 文档清理与维护     | ✅  |
| `pdd-entropy-reduction` | 技术债务治理      | ✅  |
| `official-doc-writer`   | 党政机关公文生成    | ✅  |
| `pdd-vm`                | PDD Visual Manager 可视化监控 | ✅  |

#### 行为塑造三层防御

```
┌─────────────────────────────────────────────────┐
│              Layer 3: Red Flags (红旗警告)      │  ← "不要这样做"
│    • 安全反模式检测                             │
│    • 质量反模式检测                             │
│    • 流程反模式检测                             │
├─────────────────────────────────────────────────┤
│              Layer 2: Rationalization Table      │  ← "你可能想这样做，但..."
│    • "用户说很简单" → 实际需要深入分析          │
│    • "先做MVP" → 可能导致技术债务               │
│    • "复制粘贴" → 可能引入隐藏bug               │
├─────────────────────────────────────────────────┤
│              Layer 1: Iron Law (铁律)            │  ← "必须这样做"
│    • 铁律 1: 先理解再编码                      │
│    • 铁律 2: 每个功能必须有验收标准              │
│    • 铁律 3: 代码必须可审查                     │
└─────────────────────────────────────────────────┘
```

### Phase 3: 专家系统扩展

| 专家技能                   | 能力范围                                    | 特色                                     |
| ---------------------- | --------------------------------------- | -------------------------------------- |
| **expert-security**    | SQL注入 / XSS / CSRF / 命令注入 / 路径遍历 / SSRF | OWASP Top 10 2021 完整覆盖，8 条安全铁律         |
| **expert-performance** | CPU / 内存 / I/O / 网络 / 锁竞争诊断             | HikariCP / Redis多级缓存 / G1 GC调优 / P99指标 |
| **expert-mysql**       | SQL优化 / 索引设计 / 表结构分析 / 慢查询诊断         | MySQL官方文档参考，执行计划分析，索引优化建议          |
| **expert-ruoyi**       | 若依框架全流程开发 / 代码生成 / 权限配置 / 菜单管理          | 7个若依Bug模式(PATTERN-R001~R007) + Spec模板参考 |
| **expert-ruoyi-permission** | 若依框架权限配置 / 权限校验失败诊断 / 菜单按钮权限 | 四端一致原则 + @PreAuthorize + v-hasPermi |
| **expert-activiti**    | Activiti 7工作流引擎 / BPMN 2.0 / 流程部署管理      | 流程设计规范 + BPMN校验规则                       |
| **expert-vue3**        | Vue3 组件开发 / 状态管理 / 性能优化 / 组合式 API     | Vue3 生态最佳实践，响应式系统深度解析                 |
| **expert-springcloud** | 微服务架构 / 服务治理 / 配置中心 / 网关路由           | Spring Cloud Alibaba 全栈解决方案               |
| **expert-bug-fixer**   | Bug 根因分析 / 修复方案生成 / 回归测试建议           | 智能诊断 + 修复策略推荐                            |
| **expert-testcases**   | 测试用例设计 / 边界值分析 / 覆盖率优化              | 多维度测试策略，自动化测试生成                       |
| **software-architect** | 架构模式设计 / 技术选型 / 性能权衡 / 可扩展性规划       | 生产级架构设计，60+ 界面组件模式参考                  |
| **software-engineer**  | 代码实现 / 重构优化 / 设计模式应用 / 测试驱动开发       | 生产级代码，清洁架构，错误处理完善                    |
| **system-architect**   | 系统架构设计 / 模块化设计 / 安全最佳实践 / 代码规范      | PEP8/ESLint 标准，项目初始化，技术栈选择              |

### Phase 3.5: 熵减治理系统

> **对抗系统腐化，持续偿还技术债务**

PDD 熵减体系通过 4 个协同技能，实现从审计到重构的闭环治理：

| 熵减技能 | 职责 | 触发场景 |
|---------|------|---------|
| **expert-entropy-auditor** | 技术债务审计 / PRD一致性检查 / AI残渣检测 | 每周定时审计、PR合并后、代码提交后 |
| **expert-arch-enforcer** | 架构约束检查 / 依赖方向验证 / 模块边界监控 | 代码提交后自动触发、架构检查请求 |
| **expert-code-quality** | 代码审查 / 重构建议 / 设计模式应用 / SOLID原则 | 代码审查请求、质量改进需求 |
| **expert-auto-refactor** | 自动化重构 / 消除重复 / 简化复杂度 / 模式归集 | 熵减审计后、重构任务分配 |

**治理流程**:

```
entropy-auditor (审计发现) → arch-enforcer (约束检查) → code-quality (质量评估) → auto-refactor (自动修复)
        ↑                                                                            |
        └──────────────────────── 持续监控循环 ←──────────────────────────────────────┘
```
  
### Phase 4: 平台化建设

将核心能力暴露为标准化接口，支持远程调用和多语言接入。

#### 4.1 CLI 工具扩展

6 个新增子命令：`generate` / `verify` / `report` / `config` / `linter` / `api`

#### 4.2 RESTful API 层

基于 Node.js **零依赖 HTTP 服务器**（仅使用内置 `http` 模块）：

| 方法       | 端点                 | 说明      |
| -------- | ------------------ | ------- |
| GET      | `/api/v1/status`   | 服务状态    |
| GET      | `/api/v1/docs`     | API 文档  |
| GET      | `/api/v1/health`   | 健康检查    |
| GET/POST | `/api/v1/spec/*`   | 规格 CRUD |
| POST     | `/api/v1/generate` | 代码生成    |
| POST     | `/api/v1/verify`   | 功能验证    |
| POST     | `/api/v1/report`   | 报告生成    |
| GET/POST | `/api/v1/config/*` | 配置管理    |
| GET      | `/api/v1/skills`   | 技能列表    |

**特性**: Rate Limiting + CORS + Graceful Shutdown

#### 4.3 MCP Protocol

遵循 Model Context Protocol 标准，AI Agent 原生集成：

```
Tools (6个):
  ├── pdd_generate_spec     # 生成开发规格
  ├── pdd_generate_code     # 生成代码
  ├── pdd_verify_feature    # 验证功能
  ├── pdd_code_review       # 代码审查
  ├── pdd_list_skills       # 列出技能
  └── pdd_get_status        # 获取状态

Resources (4个):
  ├── pdd://specs           # 规格资源
  ├── pdd://features        # 功能资源
  ├── pdd://skills          # 技能资源
  └── pdd://config          # 配置资源
```

协议: JSON-RPC 2.0，零外部依赖。

#### 4.4 SDK

| SDK            | 文件                                  | 特性                                            |
| -------------- | ----------------------------------- | --------------------------------------------- |
| **JavaScript** | `lib/sdk-base.js` + `lib/sdk-js.js` | 重试 / 事件 / 缓存 / 批量 / 流式 / 链式 API               |
| **Python**     | `lib/sdk-python/pdd_sdk/` (8文件)     | async/await / dataclass / EventEmitter / 纯标准库 |

#### 4.5 gRPC 兼容层

基于 Node.js **http2** 内置模块的 Protocol Buffer 风格服务：

| Service       | Methods                            |
| ------------- | ---------------------------------- |
| SpecService   | GenerateSpec / GetSpec / ListSpecs |
| CodeService   | GenerateCode                       |
| VerifyService | VerifyFeature                      |
| ReportService | GenerateReport                     |
| SkillService  | ListSkills / GetSkillInfo          |
| HealthService | Check (标准 gRPC 健康协议)               |

包含: proto3 JSON 编解码器、拦截器链、反射服务。

### Phase 5: 智能化升级

#### 三级缓存系统

```
请求 → L1 Session Cache (LRU, 内存)
     → MISS → L2 Project Cache (LRU, 内存, 跨会话共享)
          → MISS → L3 Global Cache (LFU, 磁盘JSON持久化)
```

| 级别         | 策略  | 存储 | TTL   | 容量    |
| ---------- | --- | -- | ----- | ----- |
| L1 Session | LRU | 内存 | 5min  | 100条  |
| L2 Project | LRU | 内存 | 30min | 500条  |
| L3 Global  | LFU | 磁盘 | 2h    | 2000条 |

O(1) 时间复杂度操作，Write-Through 写入策略。

#### Token 预算管理

五阶段分配模型：

| 阶段             | 占比  | 说明     |
| -------------- | --- | ------ |
| analysis       | 15% | 需求分析阶段 |
| design         | 20% | 规格设计阶段 |
| implementation | 35% | 代码实现阶段 |
| review         | 20% | 代码审查阶段 |
| verify         | 10% | 验证确认阶段 |

阈值策略: **80% 警告** / **95% 阻断**

4 种预警策略: `LOG_ONLY` / `SOFT_BLOCK` / `HARD_BLOCK` / `AUTO_SCALE`

#### 代码质量评分 — 五维引擎

| 维度       | 权重  | 规则数 | 评级                                              |
| -------- | --- | --- | ----------------------------------------------- |
| **可读性**  | 20% | 7 条 | 命名规范 / 函数长度 / 行长度 / 圈复杂度 / 注释覆盖率 / 魔法数字 / 缩进一致性 |
| **可维护性** | 20% | 6 条 | 重复代码 / 模块内聚 / 耦合度 / 单一职责 / 死代码 / 依赖方向           |
| **健壮性**  | 25% | 6 条 | Null检查 / 错误处理 / 边界验证 / 异步错误 / 类型检查 / 资源清理       |
| **性能**   | 15% | 6 条 | 循环效率 / 内存分配 / I/O操作 / 字符串拼接 / 异步模式 / 数据结构       |
| **安全性**  | 20% | 6 条 | SQL注入 / XSS风险 / 硬编码密钥 / 输入验证 / 依赖安全 / 不安全配置     |

**评级**: S≥90 / A≥80 / B≥70 / C≥60 / D≥50 / F<50

#### 多轮迭代优化

```
Round 1: Review → Fix → Verify
                ↓ 收敛 < 5%
Round 2: Review → Fix → Verify
                ↓ 收敛 < 5%
...
Round N (max=5): 最终结果
```

- 自动审查: 集成 code-reviewer 逻辑
- 自动修复: **建议式修复**（不直接修改源码，安全原则）
- 收敛检测: 质量提升 < 5% 时自动终止

### Phase 6: 生态建设

#### 插件系统

```
PluginBase (抽象基类)
  ├── onInstall()      安装后执行一次
  ├── onActivate()     激活时调用
  ├── onDeactivate()   停用时调用
  ├── onUninstall()    卸载前清理
  └── onConfigChange() 配置变更响应
      │
      ├─ registerCommand(name, opts)    注册 CLI 命令
      ├─ registerHook(event, handler)   注册流程钩子
      ├─ registerTool(name, opts)      注册 MCP Tool
      └─ registerFormatter(type, fn)   注册输出格式化器
```

**安全沙箱**: Proxy 拦截 fs/net/process/env，四维策略控制（filesystem/network/execution/environment）

**3 个内置示例插件**: hello-world / code-stats / custom-linter

#### OpenClaw 集成

| 模块             | 能力                                                 |
| -------------- | -------------------------------------------------- |
| **Adapter**    | 连接管理 + 心跳30s + 指数退避重连 + 6 Tool 映射                  |
| **CLI**        | 7个子命令: start/stop/status/list-tools/test/logs/init |
| **API Bridge** | 5端点 + SSE流式 + 中间件链 + batchExecute                  |
| **Data Sync**  | push/pull/bidirectional 四类型同步 + 冲突解决 + 定时调度        |

#### 社区文档

| 文档                                                         | 内容                | 行数     |
| ---------------------------------------------------------- | ----------------- | ------ |
| [user-guide](docs/user-guide/user-guide.md)                | 快速开始 / 工作流 / FAQ  | ~1480 |
| [developer-guide](docs/developer-guide/developer-guide.md) | 架构 / 规范 / 贡献流程    | ~2960 |
| [api-reference](docs/api-reference/api-reference.md)       | 全模块 API / 错误码大全   | ~3948 |
| [operations](docs/operations/operations-guide.md)          | 部署 / 调优 / 监控 / 安全 | ~2018 |
| [plugin-market](docs/plugin-market/README.md)              | 发布流程 / 评分标准 / 审核  | ~400  |

***

## 📊 Phase 7: PDD Visual Manager

> **重要说明**: PDD Visual Manager 用于 **可视化监控使用 PDD 方法开发的业务项目的运行状态**，而非管理 PDD-Skills 自身的开发任务。

### 定位与目标

PDD Visual Manager (PDD-VM) 是 Phase 7 的核心交付物，提供 **双形态可视化监控** 能力：

- **Web Dashboard**: 基于 HTML/CSS/JS 的零依赖 SPA，通过浏览器实时查看项目状态
- **Terminal TUI**: 基于 Node.js ANSI 的终端 UI，适合 SSH 远程场景

两者共享同一数据模型和 API 层，可根据使用场景自由切换。

### 双形态架构图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        PDD Visual Manager Architecture                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         Data Layer (数据层)                              │   │
│  │                                                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │   │
│  │  │ Feature Store│  │ Config Store │  │ Cache Store  │  │ Event Bus  │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                           │
│                                    ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        Service Layer (服务层)                            │   │
│  │                                                                          │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────────┐   │   │
│  │  │  HTTP Server   │  │  SSE Server    │  │     REST API (11端点)     │   │   │
│  │  │  (server.js)   │  │  (sse.js)      │  │    (api-routes.js)        │   │   │
│  │  └────────────────┘  └────────────────┘  └──────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│              │                                    │                           │
│              ▼                                    ▼                           │
│  ┌─────────────────────────────┐    ┌─────────────────────────────────────┐   │
│  │      Presentation Layer     │    │       Presentation Layer            │   │
│  │                             │    │                                     │   │
│  │  ┌───────────────────────┐  │    │  ┌─────────────────────────────┐   │   │
│  │  │   Web Dashboard       │  │    │  │     Terminal TUI             │   │   │
│  │  │                       │  │    │  │                             │   │   │
│  │  │  ┌─────────────────┐  │  │    │  │  ┌───────────────────────┐  │   │   │
│  │  │  │ index.html (SPA)│  │  │    │  │  │ tui.js (主控制器)     │  │   │   │
│  │  │  ├─────────────────┤  │  │    │  │  ├───────────────────────┤  │   │   │
│  │  │  │ dashboard.css   │  │  │    │  │  │ renderer.js (ANSI渲染) │  │   │   │
│  │  │  ├─────────────────┤  │  │    │  │  ├───────────────────────┤  │   │   │
│  │  │  │ app.js (SPA框架)│  │  │    │  │  │ input.js (键盘输入)    │  │   │   │
│  │  │  └─────────────────┘  │  │    │  │  └───────────────────────┘  │   │   │
│  │  │                       │  │    │  │                             │   │   │
│  │  │  4 视图面板:           │  │    │  │  5 组件:                    │   │   │
│  │  │  • Pipeline (流水线)   │  │    │  │  progress-bar / table /    │   │   │
│  │  │  • Kanban (看板)       │  │    │  │  sparkline / status-light  │   │   │
│  │  │  • Quality (质量)      │  │    │  │  / card                    │   │   │
│  │  │  • System (系统)       │  │    │  │                             │   │   │
│  │  │                       │  │    │  │  4 屏幕 + 详情overlay:     │   │   │
│  │  │  Canvas 图表引擎:       │  │    │  │  overview / kanban /       │   │   │
│  │  │  radar/histogram/      │  │    │  │  quality / system         │   │   │
│  │  │  gauge/lineChart/      │  │    │  │                             │   │   │
│  │  │  horizontalBar         │  │    │  └─────────────────────────────┘   │   │
│  │  └───────────────────────┘  │    │                                     │   │
│  └─────────────────────────────┘                                             │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 数据流图

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│  PRD 文档   │     │  配置文件   │     │   运行时事件     │
│  (.prdx)    │     │  (.pddrc)   │     │  (Hook/Timer)   │
└──────┬──────┘     └──────┬──────┘     └────────┬────────┘
       │                   │                     │
       ▼                   ▼                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Data Aggregator                         │
│            (lib/vm/data-aggregator.js)                   │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                 State Manager                            │
│              (lib/vm/state-manager.js)                   │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │ Features   │  │ Pipeline   │  │ Quality    │        │
│  │ State      │  │ State      │  │ Metrics    │        │
│  └────────────┘  └────────────┘  └────────────┘        │
└─────────────────────────┬───────────────────────────────┘
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
    ┌──────────────┐ ┌──────────┐ ┌──────────────┐
    │ REST API     │ │ SSE Push │ │ Data Export  │
    │ (11 端点)    │ │ (实时)   │ │ (CSV/JSON)   │
    └──────┬───────┘ └────┬─────┘ └──────────────┘
           │              │
           ▼              ▼
    ┌──────────────┐ ┌──────────────┐
    │ Web Dashboard│ │ Terminal TUI │
    │ (HTTP Poll)  │ │ (Direct)     │
    └──────────────┘ └──────────────┘
```

### Web Dashboard — 4 大视图面板

#### 1. Pipeline View（流水线视图）

展示 PDD 开发流水线的各阶段状态和进度：

| 阶段             | 显示内容   | 交互     |
| -------------- | ------ | ------ |
| Analysis       | 需求分析进度 | 点击查看详情 |
| Design         | 规格生成状态 | 点击查看规格 |
| Implementation | 代码实现进度 | 点击查看代码 |
| Review         | 审查状态   | 点击查看问题 |
| Verify         | 验证结果   | 点击查看报告 |

**特色功能**:

- 实时进度条动画
- 阶段间依赖关系可视化
- 阻塞项高亮提示
- 历史趋势对比

#### 2. Kanban View（看板视图）

以看板形式展示功能点的开发状态：

```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│  BACKLOG    │  ANALYSIS   │  DESIGN     │  IMPLEMENT  │   VERIFY    │
│             │             │             │             │             │
│  ┌───────┐  │  ┌───────┐  │  ┌───────┐  │  ┌───────┐  │  ┌───────┐  │
│  │Feat A │  │  │Feat B │  │  │Feat C │  │  │Feat D │  │  │Feat E │  │
│  │ High  │  │  │ Med   │  │  │ Low   │  │  │ Done  │  │  │ Pass  │  │
│  └───────┘  │  └───────┘  │  └───────┘  │  └───────┘  │  └───────┘  │
│  ┌───────┐  │  ┌───────┐  │             │  ┌───────┐  │             │
│  │Feat F │  │  │Feat G │  │             │  │Feat H │  │             │
│  │ Med   │  │  │ Low   │  │             │  │ WIP   │  │             │
│  └───────┘  │  └───────┘  │             │  └───────┘  │             │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

**特色功能**:

- 拖拽排序（规划中）
- 优先级标签筛选
- 负责人分配显示
- WIP 限制警告

#### 3. Quality View（质量视图）

多维度展示代码质量指标：

| 指标类型      | 图表组件                 | 数据来源          |
| --------- | -------------------- | ------------- |
| 五维评分雷达图   | Canvas Radar Chart   | QualityScorer |
| 规则分布直方图   | Canvas Histogram     | Linter 结果     |
| 总体评分仪表盘   | Canvas Gauge         | 综合计算          |
| 趋势折线图     | Canvas LineChart     | 历史快照          |
| 问题分类横向条形图 | Canvas HorizontalBar | CodeReviewer  |

**特色功能**:

- 实时评分更新
- 阈值超标红色预警
- 下钻至具体规则
- 与基准对比

#### 4. System View（系统视图）

监控系统运行状态和资源使用：

| 监控项       | 显示方式     | 刷新频率 |
| --------- | -------- | ---- |
| 服务状态      | 状态灯      | 30s  |
| API 响应时间  | 数值 + 趋势  | 30s  |
| 缓存命中率     | 百分比 + 图表 | 30s  |
| Token 使用量 | 进度条 + 预警 | 30s  |
| 连接数       | 数值       | 30s  |
| 错误日志      | 滚动列表     | 实时   |

### Terminal TUI — 4 屏 + 快捷键

TUI 提供 4 个主要屏幕，支持丰富的键盘交互：

#### 4 个屏幕概览

| 屏幕       | 名称       | 主要内容                |
| -------- | -------- | ------------------- |
| Screen 1 | Overview | 项目总览：任务统计、进度摘要、关键指标 |
| Screen 2 | Kanban   | 功能点看板：按状态分列的功能卡片    |
| Screen 3 | Quality  | 质量仪表：评分、规则分布、趋势     |
| Screen 4 | System   | 系统监控：服务状态、资源使用、错误日志 |

#### TUI 快捷键一览表

| 按键             | 功能           | 适用场景       |
| -------------- | ------------ | ---------- |
| `Tab`          | 切换到下一个屏幕     | 所有屏幕       |
| `q` 或 `Ctrl+C` | 退出 TUI       | 所有屏幕       |
| `r` 或 `F5`     | 强制刷新当前屏幕     | 所有屏幕       |
| `p`            | 暂停/恢复自动刷新    | 所有屏幕       |
| `j` / `↓`      | 向下选择（移动光标）   | 列表/表格场景    |
| `k` / `↑`      | 向上选择（移动光标）   | 列表/表格场景    |
| `Enter`        | 查看选中项详情      | 列表/表格场景    |
| `Esc`          | 返回上一级 / 关闭详情 | 详情 overlay |
| `?`            | 显示帮助信息       | 所有屏幕       |
| `1` - `4`      | 直接跳转到指定屏幕    | 所有屏幕       |
| `/`            | 打开搜索框        | 支持搜索的屏幕    |
| `n`            | 跳转到下一个搜索结果   | 搜索激活时      |

#### TUI 组件库

```
lib/vm/tui/components/
├── progress-bar.js    # 彩色进度条 (████████░░░░ 80%)
├── table.js           # 对齐表格 (支持排序/高亮)
├── sparkline.js       # 迷你折线图 (▁▂▃▅▆▇█)
├── status-light.js    # 状态指示灯 (● ● ○)
└── card.js            # 信息卡片 (标题+内容+元数据)
```

### CLI 命令速查

```bash
# ========== Web Dashboard ==========
pdd dashboard                    # 启动 Dashboard (默认 http://localhost:3001)
pdd dashboard -p 8080            # 自定义端口
pdd dashboard --no-open          # 不自动打开浏览器

# ========== Terminal TUI ==========
pdd tui                          # 启动 TUI
pdd tui --refresh 3              # 自定义刷新间隔(秒)

# ========== VM 数据查询 ==========
pdd vm status                    # 项目状态摘要 (JSON 格式)
pdd vm features                  # 功能点列表 (含状态)
pdd vm features --status done    # 筛选已完成功能点
pdd vm export --format csv       # 导出为 CSV
pdd vm export --format json      # 导出为 JSON
pdd vm export -o report.csv      # 导出到指定文件
```

### Data Model 说明

PDD-VM 的数据模型围绕 **业务项目** 的 PDD 开发流程设计：

```
Project (业务项目)
├── metadata (元数据)
│   ├── name: string              # 项目名称
│   ├── version: string           # 项目版本
│   ├── createdAt: timestamp      # 创建时间
│   └── updatedAt: timestamp      # 更新时间
│
├── features (功能点列表)
│   ├── id: string                # 功能点 ID
│   ├── name: string              # 功能点名称
│   ├── status: enum              # backlog/analysis/design/implement/review/verify/done
│   ├── priority: enum            # critical/high/medium/low
│   ├── assignee?: string         # 负责人
│   ├── specPath?: string         # 规格文件路径
│   ├── sourceDir?: string        # 源码目录
│   └── metrics (度量指标)
│       ├── coveragePercent: number    # 覆盖率
│       ├── passRate: number           # 通过率
│       ├── qualityScore: number       # 质量评分
│       └── grade: string              # 等级 (S/A/B/C/D/F)
│
├── pipeline (流水线状态)
│   ├── phase: string             # 当前阶段
│   ├── progress: number          # 整体进度 (0-100)
│   ├── stages[] (各阶段详情)
│   │   ├── name: string
│   │   ├── status: enum          # pending/in-progress/completed/blocked
│   │   ├── progress: number
│   │   └── startedAt?: timestamp
│
├── quality (质量指标)
│   ├── overallScore: number      # 总分 (0-100)
│   ├── overallGrade: string      # 总等级
│   ├── dimensions (五维评分)
│   │   ├── readability: { score, grade }
│   │   ├── maintainability: { score, grade }
│   │   ├── robustness: { score, grade }
│   │   ├── performance: { score, grade }
│   │   └── security: { score, grade }
│   └── rulesViolated[] (违规规则列表)
│       ├── ruleId: string
│       ├── category: string
│       ├── severity: enum        # error/warning/info
│       └── count: number
│
└── system (系统状态)
    ├── apiStatus: enum           # online/degraded/offline
    ├── uptime: number            # 运行时长(秒)
    ├── requestsTotal: number     # 总请求数
    ├── cacheHitRate: number      # 缓存命中率
    ├── tokenUsage (Token 使用)
    │   ├── totalBudget: number
    │   ├── consumed: number
    │   ├── remaining: number
    │   └── percent: number
    └── errors[] (最近错误列表)
        ├── timestamp: timestamp
        ├── level: enum           # error/warn/info
        ├── message: string
        └── source: string
```

### Phase 7 文件清单

```
lib/vm/                          # PDD Visual Manager 核心目录 (~38 文件, ~6000 行)
├── index.js                     # VM 入口，导出全部模块
├── data-aggregator.js           # 数据聚合器
├── state-manager.js             # 状态管理器
├── event-bus.js                 # 事件总线
│
├── dashboard/                   # Web Dashboard 模块
│   ├── server.js                # HTTP 服务器 (零依赖)
│   ├── sse.js                   # SSE (Server-Sent Events) 推送服务
│   ├── api-routes.js            # 11 个 REST API 端点
│   ├── index.html               # SPA 主页面
│   ├── css/
│   │   └── dashboard.css        # 完整样式表 (响应式布局)
│   └── js/
│       ├── app.js               # SPA 应用框架 (路由/状态/组件)
│       ├── pipeline-view.js     # 流水线视图组件
│       ├── kanban-view.js       # 看板视图组件
│       ├── quality-view.js      # 质量视图组件
│       ├── system-view.js       # 系统视图组件
│       └── charts/
│           ├── canvas-engine.js # Canvas 图表引擎基类
│           ├── radar.js         # 雷达图
│           ├── histogram.js     # 直方图
│           ├── gauge.js         # 仪表盘
│           ├── line-chart.js    # 折线图
│           └── horizontal-bar.js # 横向条形图
│
├── tui/                         # Terminal TUI 模块
│   ├── tui.js                   # TUIApp 主控制器
│   ├── renderer.js              # ANSI 渲染引擎
│   ├── input.js                 # 键盘输入处理器 (raw mode)
│   ├── screens/
│   │   ├── overview-screen.js   # 总览屏幕
│   │   ├── kanban-screen.js     # 看板屏幕
│   │   ├── quality-screen.js    # 质量屏幕
│   │   └── system-screen.js     # 系统屏幕
│   ├── components/
│   │   ├── progress-bar.js      # 进度条组件
│   │   ├── table.js             # 表格组件
│   │   ├── sparkline.js         # 迷你折线图组件
│   │   ├── status-light.js      # 状态灯组件
│   │   └── card.js              # 卡片组件
│   └── overlays/
│       ├── detail-overlay.js    # 详情覆盖层
│       └── help-overlay.js      # 帮助覆盖层
│
└── hooks/                       # VM Hook 系统
    ├── vm-hooks.js              # Hook 定义与注册
    └── handlers/
        ├── on-feature-update.js # 功能点更新处理
        ├── on-phase-change.js   # 阶段变更处理
        └── on-quality-alert.js  # 质量预警处理
```

***

## 技能系统

### 如何使用技能

PDD-Skills 的技能通过 AI Agent（如 Claude、GPT 等）自动加载和使用。每个技能的 SKILL.md 包含：

1. **触发词** (`_meta.json` triggers) — AI 何时激活此技能
2. **行为塑造** — Iron Law / Rationalization / Red Flags
3. **详细指令** — 分层的 🇨🇳 中文 / 🇺🇸 英文指导

### 技能分类

```
skills/
├── core/                    # 11 个核心技能 (必装)
│   ├── pdd-main/           # 主协调器
│   ├── pdd-ba/             # 业务分析
│   ├── pdd-extract-features/
│   ├── pdd-generate-spec/
│   ├── pdd-implement-feature/  # 含上下文注入 + 微验证
│   ├── pdd-verify-feature/     # 含契约一致性验证
│   ├── pdd-code-reviewer/      # 含Bug模式库匹配 + UX一致性
│   ├── pdd-doc-change/
│   ├── pdd-doc-gardener/
│   ├── pdd-entropy-reduction/
│   └── official-doc-writer/
│
├── expert/                  # 专家技能 (12个，按需加载)
│   ├── expert-security/    # 安全审计专家
│   ├── expert-performance/ # 性能优化专家
│   ├── expert-mysql/       # MySQL数据库专家
│   ├── expert-ruoyi/       # 若依框架专家 (含Bug模式库R001~R007)
│   ├── expert-ruoyi-permission/ # 若依权限配置专家
│   ├── expert-activiti/    # Activiti工作流专家
│   ├── expert-vue3/        # Vue3前端专家
│   ├── expert-springcloud/ # SpringCloud微服务专家
│   ├── expert-bug-fixer/   # Bug修复专家
│   ├── expert-testcases/   # 测试用例专家
│   ├── software-architect/ # 软件架构师
│   ├── software-engineer/  # 软件工程师
│   └── system-architect/   # 系统架构师
│
├── entropy/                 # 熵减治理技能 (4个)
│   ├── expert-entropy-auditor/   # 技术债务审计
│   ├── expert-arch-enforcer/     # 架构约束强制
│   ├── expert-code-quality/      # 代码质量专家
│   └── expert-auto-refactor/     # 自动重构专家
│
├── pr/                      # PR与交付技能 (7个)
│   ├── pdd-template-engine/    # PRD感知动态模板引擎
│   ├── pdd-multi-review/       # 多轮代码审查
│   ├── pdd-pr-create/          # PR创建
│   ├── pdd-pr-review/          # PR审查
│   ├── pdd-pr-merge/           # PR合并
│   ├── pdd-pr-batch/           # 批量PR处理
│   └── pdd-task-manager/       # 任务管理
│
├── openspec/                # OpenSpec 协作技能
│   ├── openspec-explore/
│   ├── openspec-new-change/
│   ├── openspec-ff-change/
│   └── ... (10 个)
│
└── software/                # 通用软件工程技能
    ├── system-architect/
    ├── software-architect/
    └── software-engineer/
```

***

## 配置中心

> **Single Source of Truth 原则**：所有配置集中管理，技能和脚本通过引用获取，避免散落和不一致。

### 配置文件一览

| 配置文件 | 用途 | 消费方 |
|---------|------|--------|
| `config/bug-patterns.yaml` | Bug模式库（14个模式） | pdd-code-reviewer, pdd-verify-feature, pdd-implement-feature, pdd-template-engine, expert-ruoyi |
| `config/prd-rules.yaml` | PRD检测规则（30条，6大类） | pdd-linter, run-linters.js |
| `config/gate-config.yaml` | 质量门控配置（4级阻断+评分权重） | gate-engine.js |

### Bug模式库架构

```
config/bug-patterns.yaml          ← 唯一真相源
├── categories.general            # 通用模式 PATTERN-001~007
│   ├── PATTERN-001  datetime字段类型陷阱
│   ├── PATTERN-002  静态路由注册顺序错误
│   ├── PATTERN-003  枚举硬编码/编码不一致
│   ├── PATTERN-004  alert()未用safeAlert()包装
│   ├── PATTERN-005  my-tasks查询条件不完整
│   ├── PATTERN-006  Options接口路由顺序(同002)
│   └── PATTERN-007  编号生成未检查已存在记录
└── categories.ruoyi              # 若依专用 PATTERN-R001~R007
    ├── PATTERN-R001  权限注解缺失
    ├── PATTERN-R002  菜单配置不完整
    ├── PATTERN-R003  数据权限未配置
    ├── PATTERN-R004  Redis缓存未清除
    ├── PATTERN-R005  参数校验缺失
    ├── PATTERN-R006  XSS防护缺失
    └── PATTERN-R007  操作日志缺失
```

### PRD检测规则架构

```
config/prd-rules.yaml             ← 唯一真相源 (30条规则)
├── structure (7条)               # PRD结构完整性
├── content (8条)                 # 内容质量
├── uiux (6条)                    # UI/UX规范
│   ├── uiux-form-mapping-exists  # 表单控件映射表 (BLOCKER)
│   ├── uiux-no-uuid-input        # 禁止UUID输入 (BLOCKER)
│   ├── uiux-options-api-listed   # Options API声明 (BLOCKER)
│   ├── uiux-page-list            # 页面清单
│   ├── uiux-seed-data-declared   # 种子数据声明
│   └── uiux-wireframe-exists     # 线框图
├── data_model (4条)              # 数据模型规范
│   ├── dm-enum-convention        # 枚举编码约定 (BLOCKER)
│   ├── dm-permission-matrix      # 权限矩阵 (BLOCKER)
│   ├── dm-type-explicit          # 类型显式声明
│   └── dm-audit-fields           # 审计字段
└── api_design (3条)              # API设计规范
    ├── api-options-endpoint      # Options端点 (BLOCKER)
    ├── api-param-location        # 参数位置
    └── api-error-format          # 错误格式
```

### 质量门控流程

```
PRD文档 → prd-linter (30条规则) → gate-engine (4级门控) → 评分卡
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

### 更新流程

```bash
# 新增Bug模式 → 只需编辑一个文件
vim config/bug-patterns.yaml    # 各skill自动通过引用获取

# 修改BLOCKER规则 → 只需编辑一个文件
vim config/gate-config.yaml     # gate-engine.js自动读取

# 修改PRD检测规则 → 只需编辑一个文件
vim config/prd-rules.yaml       # run-linters.js自动读取
```

***

## API 层

### 启动 API 服务器

```bash
# 默认端口 3000
pdd api

# 自定义端口 + CORS
pdd api -p 8080 --cors
```

### 调用示例

```bash
# 生成规格
curl -X POST http://localhost:3000/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{"prd_path": "./prd.prdx", "template": "default"}'

# 验证功能
curl -X POST http://localhost:3000/api/v1/verify \
  -H "Content-Type: application/json" \
  -d '{"spec_path": "./spec.md", "source_dir": "./src"}'

# 列出技能
curl http://localhost:3000/api/v1/skills?category=core
```

### gRPC 调用示例

```bash
# 基于 HTTP/2 + Protobuf JSON 格式
curl -X POST http://localhost:50051/pdd.SkillService/ListSkills \
  -H "Content-Type: application/grpc+protojson" \
  -d '{}'
```

***

## MCP 协议集成

PDD-Skills 可作为 MCP Server 被 Claude Desktop / Cursor / Windsurf 等 AI IDE 直接调用：

### 配置 Claude Desktop

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

### 可用 Tools

AI Agent 可以直接调用以下工具：

| Tool                 | 参数                      | 返回值           |
| -------------------- | ----------------------- | ------------- |
| `pdd_generate_spec`  | prd\_path, template     | 生成的规格文件路径     |
| `pdd_generate_code`  | spec\_path, feature\_id | 生成的文件列表       |
| `pdd_verify_feature` | spec\_path, source\_dir | 验证结果（覆盖率/通过率） |
| `pdd_code_review`    | source\_dir, rules      | 审查报告（评分/问题列表） |
| `pdd_list_skills`    | category, language      | 技能列表          |
| `pdd_get_status`     | -                       | 系统状态          |

***

## SDK 使用指南

### JavaScript SDK

```javascript
import { PDDJS } from 'pdd-skills/lib/sdk-js.js';

const client = new PDDJS({
  endpoint: 'http://localhost:3000',
  apiKey: 'your-key',
  maxRetries: 3,
  enableCache: true
});

// 事件监听
client.on('success', ({ method, result }) => {
  console.log(`✅ ${method} 完成`);
});

// 完整工作流
const spec = await client.generateSpec({ prdPath: './prd.prdx' });
console.log(`提取了 ${spec.features.length} 个功能点`);

for (const feature of spec.features.slice(0, 3)) {
  const code = await client.generateCode({
    specPath: spec.specPath,
    featureId: feature.id
  });
  console.log(`  📄 ${feature.id}: ${code.filesGenerated.length} files`);
}

// 验证
const verifyResult = await client.verifyFeature({
  specPath: spec.specPath,
  sourceDir: './src'
});
console.log(`覆盖率: ${verifyResult.coveragePercent}%`);

await client.close();
```

### Python SDK

```python
import asyncio
from pdd_sdk import PDDClient

async def main():
    async with PDDClient(endpoint="http://localhost:3000", debug=True) as client:
        # 事件监听
        client.on("request:end", lambda e: print(f"✅ {e['method']} ({e['duration_ms']}ms)"))

        # 生成规格
        spec = await client.generate_spec(prd_path="./prd.prdx")
        print(f"生成 {len(spec.features)} 个功能点")

        # 批量生成代码
        results = await client.batch_generate_specs([
            {"spec_path": spec.spec_path, "feature_id": f["id"]}
            for f in spec.features[:3]
        ])

        # 验证
        verify = await client.verify_feature(spec_path=spec.spec_path, source_dir="./src")
        print(f"覆盖率: {verify.coverage_percent}%")
        print(f"等级: {verify.grade}")

if __name__ == "__main__":
    asyncio.run(main())
```

***

## 智能引擎

### 缓存使用

```javascript
import { createSystemCache } from 'pdd-skills/lib/cache/system-cache.js';

const cache = createSystemCache({
  l1: { maxSize: 100, ttl: 300000 },    // 5min
  l2: { maxSize: 500, ttl: 1800000 },   // 30min
  l3: { maxSize: 2000, ttl: 7200000, dir: './cache' } // 2h
});

// 自动三级穿透
await cache.set('spec:user-auth', specData);
const hit = await cache.get('spec:user-auth');  // L1 命中

// 命中统计
console.log(cache.stats());
// { l1: { hits: 95, misses: 5, rate: 0.95 }, ... }
```

### Token 预算

```javascript
import { TokenBudgetManager } from 'pdd-skills/lib/token/budget-manager.js';

const budget = new TokenBudgetManager({ totalTokens: 100000 });

budget.on('warning', ({ phase, percent }) => {
  console.log(`⚠️ ${phase} 阶段已使用 ${percent}%`);
});

budget.on('critical', ({ phase }) => {
  console.log(`🚫 ${phase} 阶段超预算!`);
});

// 在各阶段消费
budget.consume('analysis', 5000);
budget.consume('implementation', 35000);

// 生成报告
console.log(budget.generateReport());
```

### 质量评分

```javascript
import { QualityScorer } from 'pdd-skills/lib/quality/scorer.js';

const scorer = new QualityScorer();

// 评分单个文件
const result = await scorer.scoreFile('./src/user-service.js');
console.log(`${result.grade} (${result.score}/100)`);
// B (72/100) — readability: B, maintainability: A, robustness: C, ...

// 评分整个目录
const report = await scorer.scoreDirectory('./src', {
  format: 'table',  // table | json | markdown
  threshold: 'C'    // 低于此级别高亮显示
});
```

### 迭代优化

```javascript
import { IterationController } from 'pdd-skills/lib/iteration/controller.js';

const controller = new IterationController({
  maxRounds: 5,
  convergenceThreshold: 0.05,
  reviewer: autoReviewer,
  fixer: autoFixer
});

controller.on('round-complete', ({ round, score, improved }) => {
  console.log(`Round ${round}: score=${score.toFixed(1)}, improved=${improved ? 'yes' : 'no'}`);
});

const result = await controller.run({
  specPath: './specs/auth.md',
  sourceDir: './src'
});

console.log(`完成 ${result.roundsCompleted} 轮, 最终得分: ${result.finalScore}`);
```

***

## 插件系统

### 开发插件

最小可行插件只需 2 个文件：

**plugin.json**

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "我的插件",
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
    context.logger.info('MyPlugin 已激活!');

    this.registerCommand('greet', {
      description: '打个招呼',
      handler: (args) => `Hello, ${args.name || 'world'}!`
    });
  }

  async onDeactivate(context) {
    context.logger.info('MyPlugin 正在停用...');
  }
}
```

### 加载插件

```bash
# 复制到插件目录
cp -r my-plugin ~/.pdd-skills/plugins/

# 通过 PluginManager 加载
node -e "
import { PluginManager } from './lib/plugin/plugin-manager.js';
const mgr = new PluginManager({ pluginsDir: './plugins' });
await mgr.loadAll();
console.log(mgr.listPlugins());
"
```

***

## OpenClaw 集成

### 启动 OpenClaw 服务

```bash
# 启动服务（后台守护进程）
pdd openclaw start -p 5001 -t my-secret-token --daemon

# 查看状态
pdd openclaw status

# 列出已注册工具
pdd openclaw list-tools

# 测试工具调用
pdd openclaw test -n pdd_generate_spec

# 查看通信日志
pdd openclaw logs --tail
```

### 数据同步

```javascript
import { DataSyncManager, SyncScheduler } from 'pdd-skills/lib/openclaw/data-sync.js';

const sync = new DataSyncManager({
  direction: 'bidirectional',
  conflictStrategy: 'last-write-wins'
});

// 同步四种数据类型
await sync.syncSkills();
await sync.syncConfig();
await sync.syncCache();
await sync.syncReports();

// 定时同步（每5分钟）
const scheduler = new SyncScheduler(sync, { interval: 300000 });
scheduler.start();
```

***

## 项目结构

```
pdd-skills-v3/
├── bin/
│   └── pdd.js                  # CLI 入口 (20+ 子命令)
│
├── lib/                        # 核心库 (~80 个模块)
│   ├── api-server.js           # HTTP 服务器
│   ├── api-routes.js            # 18 个 RESTful 端点
│   ├── mcp-server.js           # MCP 协议服务器
│   ├── grpc/                   # gRPC 兼容层
│   │   ├── grpc-server.js      # HTTP/2 服务器
│   │   ├── proto-definitions.js # Proto3 编解码
│   │   └── grpc-routes.js      # 8 个方法路由
│   ├── sdk-base.js             # SDK 统一接口
│   ├── sdk-js.js               # JavaScript SDK
│   ├── sdk-python/             # Python SDK (8 文件)
│   ├── plugin/                 # 插件系统
│   │   ├── plugin-sdk.js       # PluginBase 基类
│   │   ├── plugin-manager.js   # 生命周期管理
│   │   ├── sandbox.js          # 安全沙箱
│   │   └── example-plugins/   # 3 个示例插件
│   ├── openclaw/               # OpenClaw 集成
│   │   ├── openclaw-adapter.js
│   │   ├── cli-integration.js
│   │   ├── api-integration.js
│   │   └── data-sync.js
│   ├── cache/                  # 三级缓存
│   │   ├── system-cache.js    # L1/L2/L3 缓存
│   │   └── cache-config.js    # 缓存配置
│   ├── token/                  # Token 预算
│   │   ├── budget-manager.js  # 预算管理器
│   │   └── budget-alert.js    # 预算预警
│   ├── quality/                # 质量评分
│   │   ├── scorer.js          # 五维引擎
│   │   └── rules/             # 31 条规则
│   │       ├── readability.js
│   │       ├── maintainability.js
│   │       ├── robustness.js
│   │       ├── performance.js
│   │       └── security.js
│   ├── iteration/             # 迭代优化
│   │   ├── controller.js      # 迭代控制器
│   │   ├── auto-reviewer.js   # 自动审查
│   │   └── auto-fixer.js      # 自动修复
│   │
│   └── vm/                    # ★ PDD Visual Manager (Phase 7 新增, ~38 文件)
│       ├── index.js           # VM 入口
│       ├── data-aggregator.js # 数据聚合器
│       ├── state-manager.js   # 状态管理器
│       ├── event-bus.js       # 事件总线
│       │
│       ├── dashboard/         # Web Dashboard (零依赖 SPA)
│       │   ├── server.js      # HTTP+SSE 服务器
│       │   ├── sse.js         # SSE 推送服务
│       │   ├── api-routes.js  # 11 个 REST API 端点
│       │   ├── index.html     # SPA 主页面
│       │   ├── css/
│       │   │   └── dashboard.css
│       │   └── js/
│       │       ├── app.js     # SPA 框架
│       │       ├── pipeline-view.js
│       │       ├── kanban-view.js
│       │       ├── quality-view.js
│       │       ├── system-view.js
│       │       └── charts/    # Canvas 图表引擎
│       │           ├── canvas-engine.js
│       │           ├── radar.js
│       │           ├── histogram.js
│       │           ├── gauge.js
│       │           ├── line-chart.js
│       │           └── horizontal-bar.js
│       │
│       ├── tui/               # Terminal TUI (零依赖 ANSI)
│       │   ├── tui.js         # 主控制器
│       │   ├── renderer.js    # ANSI 渲染引擎
│       │   ├── input.js       # 键盘输入处理
│       │   ├── screens/       # 4 个屏幕
│       │   │   ├── overview-screen.js
│       │   │   ├── kanban-screen.js
│       │   │   ├── quality-screen.js
│       │   │   └── system-screen.js
│       │   ├── components/    # 5 个组件
│       │   │   ├── progress-bar.js
│       │   │   ├── table.js
│       │   │   ├── sparkline.js
│       │   │   ├── status-light.js
│       │   │   └── card.js
│       │   └── overlays/      # 覆盖层
│       │       ├── detail-overlay.js
│       │       └── help-overlay.js
│       │
│       └── hooks/             # VM Hook 系统
│           ├── vm-hooks.js
│           └── handlers/
│               ├── on-feature-update.js
│               ├── on-phase-change.js
│               └── on-quality-alert.js
│
├── skills/                    # 技能文件 (41+ 个)
│   ├── core/                   # 12 个核心技能
│   ├── expert/                 # 11 个专家技能
│   ├── entropy/                # 4 个熵减技能
│   ├── openspec/               # 10 个 OpenSpec 技能
│   └── pr/                     # 7 个 PR 技能
│
├── scripts/                   # 工具脚本
│   ├── linter/                # PRD Linter 工具链
│   │   ├── prd-linter.js      # PRD Linter 引擎
│   │   ├── report-generator.js# 报告生成器
│   │   └── run-linters.js     # Linter运行器
│   ├── cso-analyzer.js        # CSO 触发准确率分析
│   ├── eval-runner.js         # Evals 测试运行器
│   ├── i18n-checker.js        # 双语合规检查
│   ├── token-analyzer.js      # Token 分析
│   └── windows-compat-check.js # Windows 兼容性检查
│
├── docs/                       # 项目文档
│   ├── i18n-spec.md           # i18n 规范
│   ├── lessons.md             # 经验教训
│   ├── tasks.md               # 任务跟踪
│   ├── token-checklist.md     # Token 检查清单
│   └── vm-tasks.md            # VM 任务清单
│
├── templates/                 # 项目模板
├── config/                    # 配置中心 (Single Source of Truth)
│   ├── bug-patterns.yaml      # Bug模式库 (14个模式, 唯一真相源)
│   ├── prd-rules.yaml         # PRD检测规则 (30条, 6大类)
│   ├── gate-config.yaml       # 质量门控配置 (4级阻断+评分权重)
│   ├── bpmn-rules.yaml        # BPMN校验规则
│   ├── checkstyle.xml         # Java Checkstyle配置
│   ├── eslint.config.js       # ESLint配置
│   ├── pmd.xml                # PMD配置
│   ├── ruff.toml              # Python Ruff配置
│   └── sqlfluff.cfg           # SQL SQLFluff配置
├── hooks/                     # Hook 配置
└── package.json               # v3.1.2
```

***

## 配置说明

### 全局配置文件

PDD-Skills 支持多层配置覆盖：

```bash
# 查看当前配置
pdd config --list

# 设置配置项
pdd config --set server.port=8080
pdd config --set cache.l1.maxSize=200
pdd config --set quality.threshold=B
```

### 配置优先级

```
CLI 参数 > 环境变量 > .pddrc.local > .pddrc > defaults
```

### 关键配置项

| 分类        | 配置项                   | 默认值       | 说明                |
| --------- | --------------------- | --------- | ----------------- |
| **服务器**   | server.port           | 3000      | API 端口            |
| <br />    | server.cors           | false     | CORS 跨域           |
| <br />    | server.rateLimit      | 100/min   | 限流阈值              |
| **缓存**    | cache.l1.enabled      | true      | L1 缓存开关           |
| <br />    | cache.l1.maxSize      | 100       | L1 容量             |
| <br />    | cache.l3.dir          | ./cache   | L3 磁盘目录           |
| **Token** | budget.total          | 100000    | 总预算               |
| <br />    | budget.warnAt         | 0.80      | 警告阈值              |
| <br />    | budget.blockAt        | 0.95      | 阻断阈值              |
| **质量**    | quality.grade         | C         | 最低通过等级            |
| <br />    | iteration.maxRounds   | 5         | 最大迭代轮次            |
| <br />    | iteration.convergence | 0.05      | 收敛阈值              |
| **插件**    | plugins.dir           | ./plugins | 插件目录              |
| <br />    | sandbox.enabled       | true      | 沙箱开关              |
| **★ VM**  | vm.port               | 3001      | Dashboard 端口      |
| <br />    | vm.refreshInterval    | 30        | Dashboard 刷新间隔(秒) |
| <br />    | vm.theme              | light     | 主题 light/dark     |
| <br />    | vm.autoOpen           | true      | 自动打开浏览器           |
| <br />    | vm.maxSSEConnections  | 100       | 最大SSE连接数          |
| <br />    | vm.tuiRefreshInterval | 5         | TUI 刷新间隔(秒)       |
| **★ 脚手架** | scaffold.defaultTemplate | python-fullstack | 默认模板名称      |
| <br />    | scaffold.outputDir    | ./output  | 输出目录              |

***

## 开发指南

### 贡献流程

1. Fork 本仓库
2. 创建特性分支: `git checkout -b feature/amazing`
3. 编写代码（遵循 ESM / JSDoc / 零依赖原则）
4. 添加/更新 evals 测试
5. 运行 `pdd i18n` 和 `pdd cso` 确保合规
6. 提交 PR 并填写模板

### 代码规范

- **模块**: ESM (`import`/`export`)
- **风格**: JSDoc 注释 + 中文注释
- **依赖**: 仅 Node.js 内置模块（lib/ 下）
- **测试**: evals 框架（`pdd eval -c your-category`）
- **i18n**: 新技能必须包含 🇨🇳/🇺🇸 双语章节

### 技能开发模板

详见 [开发者指南](docs/developer-guide/developer-guide.md) 或参考 `example-plugins/hello-world/`。

***

## 版本历史

| 版本         | 日期         | 重要变更                                                                                                                                            |
| ---------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **v3.1.2** | 2026-04-10 | **技能生态大扩展**: 新增 7 个专家技能(expert-mysql/expert-vue3/expert-springcloud/expert-bug-fixer/expert-testcases/software-architect/software-engineer/system-architect), 新增 4 个熵减技能(entropy-auditor/arch-enforcer/code-quality/auto-refactor), PR技能扩展至7个(新增pdd-pr-batch/pdd-task-manager), 核心技能增至12个(pdd-vm), 总计41+技能 |
| **v3.1.1** | 2026-04-08 | **Windows兼容性+项目结构优化**: 添加 Windows 终端兼容支持, 优化项目初始化流程, 更新目录结构规范, 完善 .npmignore 配置 |
| **v3.1.0** | 2026-04-05 | **智能能力+生态集成**: Bug模式库集中化(14模式), PRD Linter扩展(30规则6大类), 4级门控引擎(Blocker/Critical/Warning/Info), OpenAPI契约同步, PRD感知动态模板, MVP分层交付策略, 上下文注入+微验证, expert-ruoyi+expert-activiti专家技能, 若依RuoYi脚手架支持, 种子数据分层设计 |
| **v3.0.1** | 2026-04-07 | **PDD Visual Manager 发布**: Web Dashboard + Terminal TUI 双形态可视化监控, 11个REST API端点, SSE实时推送, Canvas图表引擎, ANSI TUI组件库 |
| **v3.0.0** | 2026-04-05 | **正式发布版**: 6大Phase全部完成 + 插件系统 + OpenClaw + gRPC + Python SDK + 暂缓清零                                                             |
| v2.x       | 2026-03    | 内部迭代版本: MCP/SDK/缓存/Token/质量/迭代                                                                                                                  |
| v1.x       | 2025-12    | 初始版本: 基础设施 + 核心技能 + Linter                                                                                                                      |

***

## 致谢

- **Claude / Anthropic** — AI 原生开发的理想伙伴
- **Node.js 社区** — 提供卓越的内置模块（http/http2/stream/events）
- **开源社区** — 所有灵感和最佳实践的来源

***

## 许可证

[MIT](LICENSE) © PDD Team 2025-2026

***

<p align="center">
  <b>PDD-Skills v3.1.2 — 让 AI 成为你的全职结对编程伙伴 🤖</b>
</p>

<p align="center">
  <sub>41+ Skills ✅ · 14 Bug Patterns ✅ · 30 PRD Rules ✅ · 4-Level Gate ✅ · 4 Entropy Skills ✅</sub>
</p>
