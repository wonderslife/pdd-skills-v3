# PDD-Skills v3 新手入门指南 — Step by Step

> **版本**: v3.0.1 | **更新日期**: 2026-04-12 | **面向对象**: 完全不懂 PDD 的新手开发者
>
> 本指南将手把手带你从零开始，完成一个**资产评估管理系统**的 PRD 到代码全流程。

---

## 目录

- [第1章：认识 PDD-Skills](#第1章认识-pdd-skills)
  - [1.1 什么是 PDD（PRD-Driven Development）？](#11-什么是-pddprd-driven-development)
  - [1.2 PDD-Skills 是什么？能做什么？](#12-pdd-skills-是什么能做什么)
  - [1.3 与 TDD/BDD/DDD 的对比](#13与-tddbddddd-的对比)
  - [1.4 适用场景与不适用场景](#14-适用场景与不适用场景)
  - [1.5 一张图看懂 PDD 工作流](#15-一张图看懂-pdd-工作流)
- [第2章：环境准备](#第2章环境准备)
  - [2.1 系统要求](#21-系统要求)
  - [2.2 安装 Node.js 和 npm](#22-安装-nodejs-和-npm)
  - [2.3 安装 Python 和 pip](#23-安装-python-和-pip)
  - [2.4 安装 MySQL](#24-安装-mysql)
  - [2.5 安装 PDD-Skills](#25-安装-pdd-skills)
  - [2.6 验证安装](#26-验证安装)
  - [2.7 常见环境问题排查](#27-常见环境问题排查-faq)
- [第3章：第一个项目 — 资产评估管理系统](#第3章第一个项目--资产评估管理系统)
  - [3.1 项目背景介绍](#31-项目背景介绍)
  - [3.2 初始化项目](#32-初始化项目)
  - [3.3 项目结构浏览](#33-项目结构浏览)
  - [3.4 配置文件详解](#34-配置文件详解)
- [第4章：编写 PRD 文档](#第4章编写-prd-文档)
  - [4.1 PRD 模板介绍](#41-prd-模板介绍)
  - [4.2 编写资产评估系统的 PRD](#42-编写资产评估系统的-prd)
  - [4.3 PRD 编写最佳实践](#43-prd-编写最佳实践)
  - [4.4 将 PRD 保存到项目中](#44-将-prd-保存到项目中)
- [第5章：PDD 工作流实战](#第5章pdd-工作流实战)
  - [5.1 Phase 1: 业务分析](#51-phase-1-业务分析)
  - [5.2 Phase 2: 特征提取](#52-phase-2-特征提取)
  - [5.3 Phase 3: 规格生成](#53-phase-3-规格生成)
  - [5.4 Phase 4: 代码实现](#54-phase-4-代码实现)
  - [5.5 Phase 5: 代码审查](#55-phase-5-代码审查)
  - [5.6 Phase 6: 验证确认](#56-phase-6-验证确认)
- [第6章：核心功能演示](#第6章核心功能演示)
  - [6.1 启动后端服务](#61-启动后端服务)
  - [6.2 启动前端服务](#62-启动前端服务)
  - [6.3 使用 Swagger UI 测试 API](#63-使用-swagger-ui-测试-api)
  - [6.4 演示数据权限效果](#64-演示数据权限效果)
  - [6.5 演示工作流审批流程](#65-演示工作流审批流程)
  - [6.6 演示 OAuth 登录](#66-演示-oauth-登录)
- [第7章：进阶技巧](#第7章进阶技巧)
  - [7.1 自定义技能开发](#71-自定义技能开发)
  - [7.2 添加新的脚手架模板](#72-添加新的脚手架模板)
  - [7.3 配置 CI/CD 流水线](#73-配置-cicd-流水线)
  - [7.4 使用 PDD Visual Manager 监控项目](#74-使用-pdd-visual-manager-监控项目)
  - [7.5 性能优化建议](#75-性能优化建议)
- [第8章：常见问题解答 (FAQ)](#第8章常见问题解答-faq)
- [附录](#附录)
  - [A: 命令速查表](a-命令速查表)
  - [B: 文件结构速查表](b-文件结构速查表)
  - [C: 错误码参考](c-错误码参考)
  - [D: 术语表](d-术语表)

---

## 第1章：认识 PDD-Skills

### 1.1 什么是 PDD（PRD-Driven Development）？

**PDD (PRD-Driven Development)** 是一种以 **产品需求文档 (Product Requirements Document, PRD)** 为驱动的 AI 原生软件开发方法论。

#### 核心理念

传统开发模式中，需求文档往往在项目初期写完后就"沉睡"在文档库中，开发过程中需求变更靠口头沟通，导致：

- 需求理解偏差
- 交付物与预期不符
- 变更无法追溯
- 测试验收缺乏依据

**PDD 的解决思路**：让 PRD 文档成为开发的**唯一真相来源 (Single Source of Truth)**，从 PRD 出发，经过结构化分析、功能点提取、规格生成、代码实现、验证报告的完整链路，确保每一步都可追溯到原始需求。

```
┌─────────────────────────────────────────────────────────────┐
│                    传统开发模式的问题                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PRD 文档 ──→ (被遗忘) ──→ 口头需求 ──→ 代码实现 ──→ ???    │
│     │                                                           │
│     └── 开发者从未读过完整 PRD                                   │
│         需求变更无记录                                           │
│         测试无据可依                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    PDD 模式的解决方案                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PRD 文档 ──→ 业务分析 ──→ 功能提取 ──→ 规格生成             │
│     │           │           │            │                  │
│     │           ▼           ▼            ▼                  │
│     │      分析报告   功能点矩阵    开发规格                 │
│     │           │           │            │                  │
│     └───────────┴───────────┴────────────┘                  │
│                         │                                    │
│                         ▼                                    │
│                   代码实现 ──→ 验证报告                       │
│                      │          │                           │
│                      ▼          ▼                           │
│                  可运行系统   通过率/覆盖率                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 PDD-Skills 是什么？能做什么？

**PDD-Skills** 是 PDD 方法论的完整工具链实现，版本号为 **v3.0.1**。它覆盖从需求分析到代码交付的完整生命周期。

#### 核心能力矩阵

| 能力域 | 具体能力 | 说明 |
|--------|---------|------|
| **需求分析** | 5W1H 分析、MECE 原则、CRUD 矩阵 | 结构化业务分析 |
| **功能提取** | 用例识别、操作分类、依赖分析 | 从 PRD 提取可执行的功能点 |
| **规格生成** | 接口定义、数据模型、验收标准 | 生成开发者可直接使用的规格文档 |
| **代码实现** | 脚手架模板、CRUD 生成 | 基于规格自动/半自动生成代码 |
| **质量保障** | 五维评分、Linter 检查、迭代优化 | 多维度代码质量门禁 |
| **可视化监控** | Web Dashboard、Terminal TUI | 实时监控项目状态 |
| **协作能力** | REST API、MCP 协议、gRPC、SDK | 支持多语言、多平台接入 |

#### 七大 Phase 架构总览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       PDD-Skills v3.0 能力全景图                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                        │
│  │ Phase 1  │  │ Phase 2  │  │ Phase 3  │  │ Phase 4  │                        │
│  │ 基础设施  │  │ 核心能力  │  │ 专家系统  │  │ 平台化    │                        │
│  │          │  │          │  │          │  │          │                        │
│  │ • CLI    │  │ • 11核心  │  │ • 安全   │  │ • API    │                        │
│  │ • Linter │  │   技能    │  │ • 性能   │  │ • MCP    │                        │
│  │ • Hook   │  │ • i18n   │  │   专家   │  │ • SDK    │                        │
│  │ • Evals  │  │ • Token  │  │          │  │ • gRPC   │                        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                        │
│                                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                                      │
│  │ Phase 5  │  │ Phase 6  │  │ Phase 7  │                                      │
│  │ 智能化   │  │ 生态建设  │  │ VM可视化 │                                      │
│  │          │  │          │  │          │                                      │
│  │ • 缓存   │  │ • 插件   │  │ • Web    │                                      │
│  │ • Token  │  │   系统   │  │ Dashboard│                                      │
│  │ • 质量   │  │ • OpenClaw│  │ • TUI    │                                      │
│  │ • 迭代   │  │          │  │ • SSE    │                                      │
│  └──────────┘  └──────────┘  └──────────┘                                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 与 TDD/BDD/DDD 的对比

| 对比维度 | **TDD (测试驱动)** | **BDD (行为驱动)** | **DDD (领域驱动)** | **PDD (需求驱动)** |
|---------|-------------------|-------------------|-------------------|-------------------|
| **驱动文档** | 单元测试用例 | 行为规范 (Gherkin) | 领域模型 | **PRD 需求文档** |
| **关注点** | 代码正确性 | 用户行为验证 | 业务领域建模 | **端到端需求追溯** |
| **AI 原生** | ❌ | ❌ | ❌ | ✅ **深度集成** |
| **适用阶段** | 编码阶段 | 需求+编码 | 架构设计 | **全生命周期** |
| **输出产物** | 测试代码 | Feature 文件 | 领域对象 | **规格+代码+报告** |
| **新手友好度** | 中等 | 较高 | 较低 | ✅ **最高** |
| **企业级特性** | 弱 | 中等 | 强 | ✅ **强 (权限/工作流/OAuth)** |

**一句话总结**：TDD 关注"代码对不对"，BDD 关注"行为对不对"，DDD 关注"模型对不对"，而 **PDD 关注"做的东西对不对"——从用户需求出发，确保最终交付符合预期。

### 1.4 适用场景与不适用场景

#### ✅ 适用场景

| 场景 | 说明 | 推荐理由 |
|------|------|---------|
| **企业管理系统** | OA、ERP、CRM、资产管理 | 内置数据权限、工作流引擎、OAuth 认证 |
| **政府信息化项目** | 需要正式公文、合规审计 | 内置公文生成技能、完整的文档链路 |
| **快速原型开发** | MVP 验证、概念证明 | 脚手架一键生成，快速出活 |
| **团队协作开发** | 多人参与的大型项目 | 标准化的工作流和文档规范 |
| **AI 辅助开发** | 使用 Claude/GPT 等 AI 工具 | MCP 协议原生支持，AI Agent 直接调用 |

#### ❌ 不适用场景

| 场景 | 原因 | 替代方案 |
|------|------|---------|
| **纯算法项目** | 无明确业务流程 | TDD + 数学证明 |
| **实时游戏开发** | 性能优先，流程固定 | 游戏引擎 + ECS 架构 |
| **极小型脚本** | 复杂度不值得 | 直接编码 |
| **遗留系统改造** | 已有大量历史债务 | 先重构再引入 PDD |
| **硬件嵌入式** | 资源极度受限 | 传统瀑布模型 |

### 1.5 一张图看懂 PDD 工作流

```
                              ╔══════════════════════════════════════════╗
                              ║        PDD 完整工作流 (6 个 Phase)       ║
                              ╚══════════════════════════════════════════╝

  ┌─────────────┐
  │  PRD 文档   │ ◄━━━━━━━━ 用户编写的需求文档 (.prdx)
  └──────┬──────┘
         │
         ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Phase 1: 业务分析 (pdd-ba)                                         │
  │  ─────────────────────────────────────────────────────────────────  │
  │  输入: PRD 文档                                                      │
  │  处理: 5W1H 分析 → 用例建模 → 流程图 → 状态机 → CRUD 矩阵            │
  │  输出: business-analysis-report.md                                  │
  │  耗时: 30-60 分钟                                                    │
  └────────────────────────────────┬────────────────────────────────────┘
                                   │
                                   ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Phase 2: 特征提取 (pdd-extract-features)                            │
  │  ─────────────────────────────────────────────────────────────────  │
  │  输入: 业务分析报告 + PRD 文档                                        │
  │  处理: 识别用例 → 分类操作 → 评估复杂度 → 建立依赖关系                │
  │  输出: feature-matrix.md (FP-ZCPG-xxx 格式)                         │
  │  耗时: 20-40 分钟                                                    │
  └────────────────────────────────┬────────────────────────────────────┘
                                   │
                                   ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Phase 3: 规格生成 (pdd-generate-spec)                               │
  │  ─────────────────────────────────────────────────────────────────  │
  │  输入: 功能点矩阵                                                     │
  │  处理: 接口定义 → 数据模型 → 业务逻辑 → 验收标准                     │
  │  输出: specs/features/FP-xxx/spec.md                                │
  │  耗时: 15-30 分钟/每个功能点                                          │
  └────────────────────────────────┬────────────────────────────────────┘
                                   │
                                   ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Phase 4: 代码实现 (pdd-implement-feature)                            │
  │  ─────────────────────────────────────────────────────────────────  │
  │  输入: 开发规格 + 脚手架模板                                          │
  │  处理: 选择模板 → 生成骨架 → 补充业务逻辑                             │
  │  输出: 可运行的源代码 (Python/Vue/Java)                              │
  │  耗时: 1-3 天/每个功能点                                              │
  └────────────────────────────────┬────────────────────────────────────┘
                                   │
                                   ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Phase 5: 代码审查 (pdd-code-reviewer)                               │
  │  ─────────────────────────────────────────────────────────────────  │
  │  输入: 源代码 + 开发规格                                             │
  │  处理: 五维评分(读/维/健/性/安) → 问题识别 → 改进建议                 │
  │  输出: review-report.md (S/A/B/C/D/F 评级)                          │
  │  耗时: 30-60 分钟                                                    │
  └────────────────────────────────┬────────────────────────────────────┘
                                   │
                                   ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Phase 6: 验证确认 (pdd-verify-feature)                              │
  │  ─────────────────────────────────────────────────────────────────  │
  │  输入: 源代码 + 开发规格                                             │
  │  处理: 覆盖率检查 → 通过率验证 → 验收标准匹配                         │
  │  输出: verify-report.json (覆盖率%/通过率%)                          │
  │  耗时: 15-30 分钟                                                    │
  └────────────────────────────────┬────────────────────────────────────┘
                                   │
                                   ▼
                          ┌────────────────┐
                          │   交付上线 🚀   │
                          └────────────────┘
```

---

## 第2章：环境准备

### 2.1 系统要求

在开始之前，请确保你的开发环境满足以下最低要求：

| 组件 | 最低版本 | 推荐版本 | 用途说明 |
|------|---------|---------|---------|
| **Node.js** | >= 18.0.0 | >= 20.x LTS | 运行 PDD-Skills CLI 和前端构建 |
| **npm** | >= 9.0.0 | >= 10.x | Node.js 包管理器 |
| **Python** | >= 3.11 | >= 3.12 | 后端脚手架 (FastAPI) |
| **pip** | >= 23.0 | 最新版 | Python 包管理器 |
| **MySQL** | >= 8.0 | >= 8.2 | 关系型数据库 |
| **Git** | >= 2.30 | >= 2.40 | 版本控制 |
| **操作系统** | Windows 10+/macOS 12+/Ubuntu 20.04+ | 最新稳定版 | 开发环境 |

#### 硬件建议

| 资源 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 2 核 2GHz | 4 核+ 3GHz |
| 内存 | 8 GB | 16 GB+ |
| 硬盘 | 10 GB 可用空间 | 50 GB SSD |

### 2.2 安装 Node.js 和 npm

Node.js 是 PDD-Skills 的运行基础。以下是各平台的安装方法：

#### Windows 系统

```powershell
# 方法一：使用 winget (推荐，Windows 10 1709+)
winget install OpenJS.NodeJS.LTS

# 方法二：使用 scoop
scoop install nodejs-lts

# 方法三：手动下载安装
# 1. 访问 https://nodejs.org/
# 2. 下载 LTS 版本 (长期支持版)
# 3. 运行安装程序，一路 Next 即可
```

安装完成后，**重新打开终端**（重要！），然后验证：

```bash
node --version    # 应输出 v18.x.x 或更高
npm --version     # 应输出 9.x.x 或更高
```

#### macOS 系统

```bash
# 使用 Homebrew (推荐)
brew install node@20

# 或者使用 nvm (Node Version Manager，可管理多版本)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install --lts
nvm use --lts
```

#### Linux 系统 (Ubuntu/Debian)

```bash
# 使用 NodeSource 仓库 (推荐)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

> **提示**：如果你在国内网络环境下安装速度慢，可以配置 npm 镜像源：
> ```bash
> npm config set registry https://registry.npmmirror.com
> ```

### 2.3 安装 Python 和 pip

Python 用于运行后端脚手架生成的 FastAPI 应用。

#### Windows 系统

```powershell
# 方法一：使用 winget
winget install Python.Python.3.12

# 方法二：从官网下载
# 1. 访问 https://www.python.org/downloads/
# 2. 下载 Python 3.12.x
# 3. 安装时务必勾选 "Add Python to PATH"

# 验证安装
python --version      # 应输出 Python 3.12.x
pip --version         # 应输出 pip 24.x.x
```

#### macOS 系统

```bash
# 使用 Homebrew
brew install python@3.12

# 验证
python3 --version
pip3 --version
```

#### Linux 系统

```bash
# Ubuntu/Debian 通常已预装 Python3
sudo apt update
sudo apt install python3 python3-pip python3-venv

# 验证
python3 --version
pip3 --version
```

#### 推荐：使用虚拟环境 (Virtual Environment)

虚拟环境可以隔离项目依赖，避免全局污染。强烈推荐使用：

```bash
# 创建虚拟环境 (在项目目录下执行)
python -m venv .venv

# 激活虚拟环境
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# 激成功后，终端提示符会显示 (.venv)
# 现在安装的包都只在这个环境中生效

# 退出虚拟环境
deactivate
```

### 2.4 安装 MySQL

MySQL 用于存储应用数据。这里提供两种安装方式：

#### 方式一：Docker 快速启动 (推荐用于开发)

```bash
# 确保 Docker 已安装并运行
docker run -d \
  --name pdd-mysql \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root123456 \
  -e MYSQL_DATABASE=asset_eval \
  mysql:8.0 \
  --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_unicode_ci

# 验证容器是否运行
docker ps | grep pdd-mysql

# 连接测试 (可选，安装 mysql-client 后)
mysql -h 127.0.0.1 -u root -proot123456 asset_eval
```

#### 方式二：本地安装

**Windows**:

```powershell
# 使用 Chocolatey
choco install mysql -y

# 或从官网下载 MSI 安装包
# https://dev.mysql.com/downloads/installer/
```

**macOS**:

```bash
brew install mysql@8.0
brew services start mysql@8.0
```

**Linux (Ubuntu)**:

```bash
sudo apt update
sudo apt install mysql-server mysql-client
sudo systemctl start mysql
sudo systemctl enable mysql
```

安装后，建议创建专用数据库：

```sql
-- 登录 MySQL
mysql -u root -p

-- 创建数据库
CREATE DATABASE asset_eval DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建专用用户 (安全最佳实践)
CREATE USER 'dev_user'@'localhost' IDENTIFIED BY 'dev_password';
GRANT ALL PRIVILEGES ON asset_eval.* TO 'dev_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2.5 安装 PDD-Skills

现在安装 PDD-Skills 工具本身：

```bash
# 全局安装 (推荐，可在任意目录使用 pdd 命令)
npm install -g pdd-skills

# 或者本地安装 (仅在当前项目中可用)
# cd your-project
# npm install pdd-skills
```

安装过程中你会看到类似输出：

```
added 153 packages, and audited 154 packages in 15s

42 packages are looking for funding
  run `npm fund` for details
found 0 vulnerabilities
```

> **国内用户注意**：如果 `npm install` 很慢，可以先设置镜像：
> ```bash
> npm config set registry https://registry.npmmirror.com
> npm install -g pdd-skills
> ```

### 2.6 验证安装

安装完成后，通过以下命令验证一切正常：

```bash
# 1. 查看 PDD-Skills 版本
pdd version
# 预期输出: 3.0.1

# 2. 列出所有可用技能 (JSON 格式，方便查看)
pdd list --json
# 预期输出: 包含 core/expert/openspec 等分类的技能列表

# 3. 查看帮助信息
pdd --help
# 预期输出: 所有可用命令列表
```

**`pdd version` 正常输出示例**：

```
╔═══════════════════════════════════════════════════════════╗
║              PDD-Skills v3.0.1                           ║
║              PRD Driven Development Skills               ║
╠═══════════════════════════════════════════════════════════╣
║  Node.js:  v20.11.0                                     ║
║  Platform: win32 (x64)                                  ║
║  Install:  Global (/usr/local/lib/node_modules/)        ║
║  Skills:  33 loaded (11 core + 10 expert + 12 openspec)  ║
╚═══════════════════════════════════════════════════════════╝
```

**`pdd list` 输出示例 (部分)**：

```
Core Skills (11):
  ★ pdd-main              主入口，协调全部子技能
  ★ pdd-ba                业务分析与需求建模
  ★ pdd-extract-features  从 PRD 提取功能点
  ★ pdd-generate-spec     生成开发规格文档
  ★ pdd-implement-feature 基于规格实现代码
  ★ pdd-verify-feature    验证实现符合规格
  ★ pdd-code-reviewer     多维度代码审查
  ...

Expert Skills (2):
  ◆ expert-security       安全审计专家 (OWASP Top 10)
  ◆ expert-performance    性能优化专家

OpenSpec Skills (10):
  ◇ openspec-new-change   创建新变更
  ◇ openspec-apply-change 实施变更
  ...
```

### 2.7 常见环境问题排查 (FAQ)

| 问题现象 | 可能原因 | 解决方案 |
|---------|---------|---------|
| **`pdd: command not found`** | 未全局安装或 PATH 未刷新 | 执行 `npm install -g pdd-skills`，然后重启终端 |
| **`node --version` 显示旧版本** | 系统有多个 Node 版本冲突 | 使用 nvm 切换版本：`nvm use 20` |
| **`npm install` 卡住不动** | 网络问题或镜像源慢 | 切换淘宝镜像：`npm config set registry https://registry.npmmirror.com` |
| **`EACCES permission denied`** | 权限不足 (Linux/macOS) | 使用 sudo 或修改 npm 全局目录权限 |
| **MySQL 连接失败 (Connection refused)** | MySQL 服务未启动 | 执行 `sudo systemctl start mysql` 或检查 Docker 容器状态 |
| **Python 虚拟环境激活失败** | PowerShell 执行策略限制 | 以管理员身份运行：`Set-ExecutionPolicy RemoteSigned` |
| **端口 3000/3001 被占用** | 其他服务占用了默认端口 | 使用 `-p` 参数指定其他端口：`pdd api -p 8080` |
| **pip 安装包报 SSL 错误** | 公司网络代理或证书问题 | 使用信任主机：`pip install --trusted-host pypi.org ...` |
| **Docker 容器启动失败** | 端口冲突或内存不足 | 检查端口占用：`netstat -an \| grep 3306`，释放端口后重试 |

---

## 第3章：第一个项目 — 资产评估管理系统

### 3.1 项目背景介绍

#### 业务场景

某大型国有企业集团（以下简称"集团"）拥有大量固定资产，包括办公设备、生产机械、车辆、房产等。随着企业发展，部分资产因技术更新换代、业务调整等原因处于闲置状态。

集团管理层决定建立一套**资产评估处置管理系统**，对闲置资产进行规范化管理，包括：

1. **资产登记**：将闲置资产信息录入系统
2. **评估任务分配**：委托专业评估机构进行价值评估
3. **评估报告管理**：收集和审核评估报告
4. **处置审批流程**：多级审批处置方案
5. **处置执行跟踪**：监督处置过程和结果归档

#### 项目目标

| 目标维度 | 具体指标 | SMART 原则检验 |
|---------|---------|--------------|
| **效率提升** | 资产处置周期从平均 60 天缩短至 30 天 | Specific + Measurable |
| **合规性** | 100% 的处置流程留痕，可审计 | Achievable + Relevant |
| **数字化率** | 线上完成率 > 90%，减少纸质流转 | Time-bound (3个月内) |
| **用户体验** | 操作步骤不超过 5 步即可完成一次申请 | Measurable |

#### 涉及角色

| 角色 | 职责描述 | 典型人员 |
|------|---------|---------|
| **资产管理员** | 发起资产登记、维护资产信息、提交处置申请 | 各部门行政专员 |
| **评估师** | 接收评估任务、录入评估结果、上传评估报告 | 外部评估机构人员 |
| **审批人** | 审批处置方案、签署意见 | 部门经理/分管领导 |
| **系统管理员** | 配置系统参数、管理用户权限、查看统计报表 | IT 部门人员 |

### 3.2 初始化项目

使用 PDD-Skills 的 `init` 命令初始化项目：

```bash
# 在你希望创建项目的父目录下执行
cd ~/projects  # 或你的工作目录

# 初始化项目，使用 Python 全栈模板
pdd init asset-eval-project --template python-fullstack
```

命令执行后，你会看到如下输出：

```
✨ Initializing PDD project: asset-eval-project
📦 Template: python-fullstack (Python FastAPI + Vue3)
🔧 Configuring project structure...

✅ Project initialized successfully!
📍 Location: /home/user/projects/asset-eval-project

📋 Next steps:
   1. cd asset-eval-project
   2. Review .pdd/config.yaml
   3. Write your PRD document
   4. Run: pdd list --json to see available skills
```

进入项目目录：

```bash
cd asset-eval-project
```

### 3.3 项目结构浏览

初始化后的项目结构如下（附带每个目录的用途说明）：

```
asset-eval-project/
├── .pdd/                          # 🔧 PDD 配置目录
│   ├── config.yaml                # 主配置文件 (技能路径、命名规则等)
│   └── hooks.yaml                 # Hook 配置 (事件钩子)
│
├── admin/                         # 📦 后端主应用 (若依框架风格)
│   └── (由脚手架生成)
│
├── backend/                       # ⚙️ Python 后端 (FastAPI)
│   ├── app/
│   │   ├── api/v1/                # API 路由层
│   │   │   ├── auth.py            #   认证相关接口
│   │   │   ├── router.py          #   路由注册
│   │   │   └── users.py           #   用户接口示例
│   │   ├── core/                  # 核心模块
│   │   │   ├── auth/              #   JWT 认证
│   │   │   ├── data_permission/   #   数据权限引擎 (组织隔离)
│   │   │   ├── oauth/             #   OAuth2 SSO (企微/钉钉/飞书...)
│   │   │   └── workflow/          #   工作流引擎 (状态机)
│   │   ├── database/              # 数据库连接
│   │   ├── models/                # SQLAlchemy ORM 模型
│   │   ├── schemas/               # Pydantic 请求/响应模型
│   │   ├── config.py              # 应用配置
│   │   └── main.py                # FastAPI 入口
│   ├── pyproject.toml             # Python 项目配置
│   └── requirements.txt           # Python 依赖列表
│
├── frontend/                      # 🎨 Vue3 前端
│   ├── src/
│   │   ├── api/                   # API 客户端
│   │   ├── views/                 # 页面组件
│   │   ├── stores/                # Pinia 状态管理
│   │   ├── composables/           # 组合式函数
│   │   ├── router/                # Vue Router
│   │   └── styles/                # 全局样式
│   ├── package.json               # 前端依赖配置
│   └── vite.config.ts             # Vite 构建配置
│
├── docs/                          # 📚 项目文档
│   ├── reviews/                   #   Code Review 报告
│   └── plans/                     #   设计文档
│
├── specs/features/                # 📋 功能规格 (PDD 产出物)
│   └── README.md
│
├── openspec/                      # 🔄 变更管理
│   ├── changes/                   #   活跃变更
│   └── archive/                   #   归档变更
│
├── scaffolds/                     # 🏗️ 脚手架模板 (本例为 python-fullstack)
│   └── python-fullstack/          #   模板源码
│
├── scripts/                       # 🔧 工具脚本
│   └── linter/                    #   代码检查工具
│
├── testcases/                     # 🧪 测试用例
│   ├── backend/                   #   后端测试
│   ├── frontend/                  #   前端测试
│   └── reports/                   #   测试报告
│
├── templates/                     # 📝 PDD 模板
│   ├── prd-template.prdx          #   PRD 文档模板
│   └── behavior-shaping/          #   行为塑造模板
│
├── skills/                        # 🤖 技能定义 (SKILL.md)
│   ├── core/                      #   11 个核心技能
│   ├── expert/                    #   专家技能
│   └── openspec/                  #   OpenSpec 协作技能
│
├── hooks/                         # 🔗 Hook 实现
├── lib/                           # 📦 PDD 核心库 (CLI/API/MCP/SDK...)
├── config/                        # ⚙️ Linter 配置
├── .gitignore                     # Git 忽略规则
├── package.json                   # PDD-Skills 项目配置
└── README.md                      # 项目说明
```

### 3.4 配置文件详解

`.pdd/config.yaml` 是 PDD 项目的核心配置文件。以下是每个字段的详细解释：

```yaml
# ============================================
# PDD Configuration - 配置文件详解
# ============================================

project:
  name: ""                          # 项目名称 (留空则使用目录名)
  version: "1.0.0"                  # 项目版本号
  description: ""                   # 项目描述
  template: ruoyi                   # 使用的脚手架模板类型
                                    # 可选值: python-fullstack / java / frontend / default

ide:
  type: trae                        # IDE 类型 (影响技能加载路径)
  skills_dir: .trae/skills          # 技能存放目录
  rules_dir: .trae/rules            # 规则文件目录

pdd:
  features:
    output_dir: specs/features      # 功能点输出目录
    naming_pattern: "FP-{module}-{id}-{name}"  # 功能点命名模式
                                    # 示例: FP-ZCPG1-001-asset-register
  spec:
    output_dir: specs               # 规格文档输出目录
    template: default               # 规格模板类型
    include_tests: true             # 是否包含测试用例生成
  verify:
    dimensions:                     # 验证维度
      - completeness                #   完整性
      - correctness                 #   正确性
      - consistency                 #   一致性
    auto_fix: false                 # 是否自动修复发现的问题

linter:
  enabled: true                     # 是否启用 Linter
  types:                            # 要检查的类型
    - code                          #   代码质量
    - prd                           #   PRD 文档规范
    - sql                           #   SQL 规范
    - activiti                      #   BPMN 流程规范
  fail_on_error: false              # 发现错误时是否终止
  report_format: markdown           # 报告输出格式

hooks:
  enabled: true                     # 是否启用 Hook 系统
  events:                           # 监听的事件
    - session_start                 #   会话开始时
    - pre_feature                   #   功能点处理前
    - post_feature                  #   功能点处理后

cache:
  enabled: true                     # 是否启用缓存
  ttl: 3600                         # 缓存过期时间 (秒)
  max_size: 100                     # 最大缓存条目数

logging:
  level: info                       # 日志级别: debug / info / warn / error
```

#### 如何自定义配置

根据你的项目需求，可能需要修改以下关键配置：

```bash
# 修改项目名称
pdd config --set project.name="资产评估处置管理系统"

# 修改功能点命名前缀 (ZCPG = 资产评估)
pdd config --set pdd.features.naming_pattern="FP-ZCPG-{id}-{name}"

# 启用自动修复
pdd config --set pdd.verify.auto_fix=true

# 查看当前所有配置
pdd config --list
```

---

## 第4章：编写 PRD 文档

### 4.1 PRD 模板介绍

PDD-Skills 提供了标准的 PRD 文档模板，位于 `templates/prd-template.prdx`。该模板采用 `.prdx` 扩展名（PRD XML 的缩写，实际是 Markdown 格式）。

#### 模板结构概览

```
prd-template.prdx
├── 1. 项目概述
│   ├── 1.1 项目背景
│   ├── 1.2 项目目标 (SMART原则)
│   ├── 1.3 目标用户
│   └── 1.4 项目范围 (In Scope / Out of Scope)
│
├── 2. 功能需求
│   └── 模块列表 (需求ID/功能描述/用户故事/验收标准/优先级)
│
├── 3. 非功能需求
│   ├── 3.1 性能要求
│   ├── 3.2 安全要求
│   └── 3.3 兼容性要求
│
├── 4. 界面原型
│   ├── 4.1 页面列表
│   └── 4.2 页面说明
│
├── 5. 数据模型
│   ├── 5.1 实体关系
│   └── 5.2 数据字典
│
├── 6. 接口需求
│   ├── 6.1 外部接口
│   └── 6.2 内部接口
│
└── 7. 附录
    ├── 7.1 术语表
    ├── 7.2 参考资料
    └── 7.3 变更记录
```

### 4.2 编写资产评估系统的 PRD

以下是一份完整的**最小可行 PRD (Minimum Viable PRD)** 示例，基于第 3.1 节的业务场景。你可以直接复制使用，并根据实际情况调整。

```markdown
# 产品需求文档 (PRD) — 资产评估处置管理系统

**版本**: v1.0.0
**日期**: 2026-04-12
**作者**: 产品经理
**状态**: 草稿

---

## 1. 项目概述

### 1.1 项目背景

某大型国有企业集团拥有大量闲置固定资产（设备、车辆、房产等）。当前资产管理存在以下痛点：
- 资产信息分散在各 Excel 表格中，难以统一查询和统计
- 评估处置流程依赖纸质流转，周期长（平均 60 天）、效率低
- 处置过程缺少留痕，审计困难
- 各部门信息孤岛，无法协同工作

### 1.2 项目目标

| 目标 | 具体指标 | 衡量方式 |
|------|---------|---------|
| 效率提升 | 处置周期缩短至 30 天以内 | 系统日志统计 |
| 数字化 | 线上完成率 ≥ 90% | 流程节点线上比例 |
| 合规性 | 100% 流程留痕可追溯 | 审计日志完整性 |
| 易用性 | 核心操作 ≤ 5 步完成 | 用户操作路径分析 |

### 1.3 目标用户

| 角色 | 描述 | 主要职责 |
|------|------|---------|
| 资产管理员 | 各部门行政专员 | 资产登记、信息维护、发起处置申请 |
| 评估师 | 外部评估机构人员 | 接收评估任务、录入评估结果、上传报告 |
| 审批人 | 部门经理/分管领导 | 审批处置方案、签署意见 |
| 系统管理员 | IT 部门人员 | 系统配置、用户管理、报表查看 |

### 1.4 项目范围

#### 1.4.1 范围内 (In Scope)

- 资产基本信息管理 (CRUD)
- 评估任务分配与管理
- 评估报告上传与审核
- 处置申请与多级审批流程
- 处置执行跟踪与归档
- 用户权限与数据隔离
- 基础统计报表

#### 1.4.2 范围外 (Out of Scope)

- 移动端 APP (本期仅支持响应式 H5)
- 与财务系统集成对接
- 资产折旧计算
- 电子签章/CA 认证
- 地理位置定位功能

## 2. 功能需求

### 2.1 功能模块列表

#### 模块 1: 资产登记管理

**需求ID**: REQ-001
**功能描述**: 实现闲置资产的登记、编辑、查询和删除功能

**用户故事**:
- 作为资产管理员，我希望能够录入闲置资产的基本信息（名称、类别、原值、购置日期、现状描述等），以便统一管理
- 作为资产管理员，我希望能够按条件筛选和搜索资产，以便快速定位目标资产
- 作为系统管理员，我希望能够批量导入资产数据，以便快速初始化系统

**验收标准**:
- [ ] 支持单个资产新增，必填字段校验（资产名称、类别、原值）
- [ ] 支持资产信息编辑，保留修改历史
- [ ] 支持按资产名称、类别、状态等多条件组合查询
- [ ] 支持 Excel 模板批量导入，导入结果反馈（成功/失败数）
- [ ] 资产删除需软删除，保留审计轨迹

**优先级**: High (P0)

---

#### 模块 2: 评估任务管理

**需求ID**: REQ-002
**功能描述**: 实现评估任务的创建、分配、接收和进度跟踪

**用户故事**:
- 作为资产管理员，我希望能够为选中的资产创建评估任务并指派给评估师，以便启动评估流程
- 作为评估师，我希望能够查看分配给我的待办任务列表，以便合理安排工作时间
- 作为评估师，我希望能够在任务中录入初步评估结果，以便及时反馈进展

**验收标准**:
- [ ] 支持选择资产后批量创建评估任务
- [ ] 支持指定评估机构和评估师
- [ ] 评估师登录后能看到个人待办任务（仅限本人）
- [ ] 任务状态流转：待接收 → 进行中 → 已完成 → 已审核
- [ ] 任务超时提醒（超过设定天数未完成）

**优先级**: High (P0)

---

#### 模块 3: 评估报告管理

**需求ID**: REQ-003
**功能描述**: 实现评估报告的上传、审核和归档

**用户故事**:
- 作为评估师，我希望能够上传评估报告附件（PDF/Word），以便提交正式评估结论
- 作为资产管理员，我希望能够审核评估报告的内容和数据准确性，以便作为处置依据
- 作为审批人，我希望能够在线预览评估报告，以便做出审批决策

**验收标准**:
- [ ] 支持上传 PDF/Word 格式报告，单文件 ≤ 50MB
- [ ] 报告元数据录入（评估基准日、评估方法、评估价值）
- [ ] 报告审核流程：待审核 → 通过 / 驳回（附驳回原因）
- [ ] 已通过的报告锁定不可修改
- [ ] 支持在线预览 PDF（浏览器原生）

**优先级**: High (P0)

---

#### 模块 4: 审批流程管理

**需求ID**: REQ-004
**功能描述**: 实现资产处置申请的多级审批工作流

**用户故事**:
- 作为资产管理员，我希望能够基于评估报告提交处置申请（含处置方式、底价建议），以便进入审批流程
- 作为部门经理，我希望能够审批本部门的处置申请，以便把控风险
- 作为分管领导，我希望能够审批大额处置申请（≥ 50万），以便履行监管职责

**验收标准**:
- [ ] 支持两种处置方式：公开拍卖 / 协议转让
- [ ] 审批流程：< 50 万（部门经理 → 归口部门）；≥ 50 万（加分管领导）
- [ ] 审批人可填写审批意见（同意/驳回/退回修改）
- [ ] 驳回时必须填写原因
- [ ] 审批历史时间线展示
- [ ] 超时未审批自动催办（3 天）

**优先级**: High (P0)

---

#### 模块 5: 处置执行管理

**需求ID**: REQ-005
**功能描述**: 实现处置过程的执行跟踪和结果归档

**用户故事**:
- 作为资产管理员，我希望能够记录处置实施情况（成交价格、受让方、交割日期），以便闭环管理
- 作为系统管理员，我希望能够查看处置统计报表（按月/季度/类别），以便决策分析
- 作为审计人员，我希望能够导出完整的处置档案（申请+评估+审批+执行），以便审计核查

**验收标准**:
- [ ] 支持录入处置执行信息（成交价、受让方、交割日期、凭证编号）
- [ ] 处置完成后资产状态变更为"已处置"
- [ ] 支持按时间段、资产类别、处置方式多维统计
- [ ] 支持导出 Excel 格式报表
- [ ] 完整处置档案一键打包下载

**优先级**: Medium (P1)

## 3. 非功能需求

### 3.1 性能要求

| 指标 | 要求 | 说明 |
|------|------|------|
| 页面响应时间 | < 2 秒 (95th percentile) | 首屏加载 |
| API 响应时间 | < 500ms (95th percentile) | 一般查询接口 |
| 并发用户数 | 支持 100+ 同时在线 | 内部系统规模 |
| 数据量支持 | 资产记录 10 万+ | 5 年内预估 |

### 3.2 安全要求

| 要求项 | 具体措施 |
|--------|---------|
| 身份认证 | OAuth2 SSO (企微/钉钉/飞书) + JWT Token |
| 权限控制 | RBAC (基于角色的访问控制) + 数据权限隔离 |
| 数据传输 | HTTPS/TLS 1.3 加密 |
| 操作审计 | 关键操作全程日志记录 |
| 密码策略 | 最小 8 位，含大小写字母+数字+特殊字符 |

### 3.3 兼容性要求

| 平台 | 要求 |
|------|------|
| 浏览器 | Chrome 90+, Firefox 88+, Edge 90+, Safari 14+ |
| 分辨率 | 最低 1280×720，推荐 1920×1080 |
| 移动端 | 响应式布局，适配主流手机浏览器 |

## 4. 数据模型概览

### 4.1 核心实体关系

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    Asset     │       │  Evaluation  │       │   Approval   │
│   (资产)     │ 1:N   │  (评估任务)  │ 1:N   │   (审批)     │
├──────────────┤───────├──────────────┤───────├──────────────┤
│ id           │       │ id           │       │ id           │
│ asset_no     │◄──────│ asset_id     │◄──────│ evaluation_id│
│ name         │       │ evaluator_id │       │ applicant_id │
│ category     │       │ status       │       │ approver_id  │
│ original_value│      │ result_value │       │ decision     │
│ current_status│      │ report_url   │       │ opinion      │
│ created_at   │       │ created_at   │       │ created_at   │
└──────────────┘       └──────────────┘       └──────────────┘
         │                                           │
         │ 1:N                                       │ 1:N
         ▼                                           ▼
┌──────────────┐                             ┌──────────────┐
│   Disposal   │                             │  Attachment  │
│  (处置记录)  │                             │   (附件)     │
├──────────────┤                             ├──────────────┤
│ id           │                             │ id           │
│ asset_id     │                             │ entity_type  │
│ approval_id  │                             │ entity_id    │
│ method       │                             │ file_name    │
│ deal_price   │                             │ file_url     │
│ buyer_name   │                             │ file_size    │
│ completed_at │                             │ uploaded_at  │
└──────────────┘                             └──────────────┘
```

### 4.2 核心实体字段说明

#### Asset (资产)

| 字段名 | 类型 | 必填 | 说明 | 示例 |
|-------|------|------|------|------|
| id | UUID | 是 | 主键 | "a1b2c3d4-..." |
| asset_no | String(32) | 是 | 资产编号 | "ZC-2026-0001" |
| name | String(200) | 是 | 资产名称 | "戴尔服务器 R750" |
| category | Enum | 是 | 资产类别 | equipment / vehicle / property |
| original_value | Decimal(12,2) | 是 | 原值(元) | 85000.00 |
| purchase_date | Date | 是 | 购置日期 | "2020-06-15" |
| department_id | UUID | 是 | 所属部门 | "dept-001" |
| current_status | Enum | 是 | 当前状态 | idle / evaluating / disposing / disposed |
| description | Text | 否 | 状况描述 | "正常使用，略有磨损" |
| created_by | UUID | 是 | 创建人 | "user-001" |
| created_at | DateTime | 是 | 创建时间 | "2026-04-12T10:30:00" |

#### Evaluation (评估任务)

| 字段名 | 类型 | 必填 | 说明 | 示例 |
|-------|------|------|------|------|
| id | UUID | 是 | 主键 | "e1f2g3h4-..." |
| asset_id | UUID | 是 | 关联资产 | (Asset.id) |
| task_no | String(32) | 是 | 任务编号 | "PG-2026-0001" |
| evaluator_id | UUID | 是 | 评估师 | "eval-001" |
| org_name | String(200) | 是 | 评估机构 | "XX资产评估有限公司" |
| status | Enum | 是 | 任务状态 | pending / in_progress / completed / reviewed |
| evaluate_method | String(50) | 否 | 评估方法 | "市场法" / "成本法" / "收益法" |
| result_value | Decimal(12,2) | 否 | 评估价值(元) | 62000.00 |
| base_date | Date | 否 | 评估基准日 | "2026-03-31" |
| deadline | Date | 是 | 截止日期 | "2026-05-12" |
| report_url | String(500) | 否 | 报告地址 | "/uploads/reports/pg001.pdf" |

#### Approval (审批记录)

| 字段名 | 类型 | 必填 | 说明 | 示例 |
|-------|------|------|------|------|
| id | UUID | 是 | 主键 | "p1q2r3s4-..." |
| evaluation_id | UUID | 是 | 关联评估 | (Evaluation.id) |
| process_instance_id | String(64) | 是 | 流程实例ID | "proc-001" |
| current_node | String(50) | 是 | 当前节点 | "dept_manager" / "leader" |
| disposal_method | Enum | 是 | 处置方式 | auction / agreement_transfer |
| reserve_price | Decimal(12,2) | 是 | 底价(元) | 55000.00 |
| decision | Enum | 否 | 审批决定 | approved / rejected / returned |
| opinion | Text | 否 | 审批意见 | "同意，建议加快推进" |
| approved_by | UUID | 否 | 审批人 | "mgr-001" |
| approved_at | DateTime | 否 | 审批时间 | "2026-04-15T14:20:00" |

#### Disposal (处置记录)

| 字段名 | 类型 | 必填 | 说明 | 示例 |
|-------|------|------|------|------|
| id | UUID | 是 | 主键 | "d1u2z3i4-..." |
| asset_id | UUID | 是 | 关联资产 | (Asset.id) |
| approval_id | UUID | 是 | 关联审批 | (Approval.id) |
| disposal_method | Enum | 是 | 处置方式 | auction / agreement_transfer |
| deal_price | Decimal(12,2) | 是 | 成交价(元) | 58000.00 |
| buyer_name | String(200) | 是 | 受让方 | "XX科技有限公司" |
| delivery_date | Date | 否 | 交割日期 | "2026-05-20" |
| voucher_no | String(50) | 否 | 凭证编号 | "CZ-2026-0042" |
| archive_status | Enum | 是 | 归档状态 | pending / archived |

## 5. 接口需求 (摘要)

### 5.1 核心 API 列表

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 资产管理 | POST | `/api/v1/assets` | 新增资产 |
| 资产管理 | GET | `/api/v1/assets` | 资产列表(分页) |
| 资产管理 | GET | `/api/v1/assets/{id}` | 资产详情 |
| 资产管理 | PUT | `/api/v1/assets/{id}` | 更新资产 |
| 评估任务 | POST | `/api/v1/evaluations` | 创建评估任务 |
| 评估任务 | GET | `/api/v1/evaluations/my-tasks` | 我的任务列表 |
| 评估任务 | PUT | `/api/v1/evaluations/{id}/result` | 提交评估结果 |
| 审批流程 | POST | `/api/v1/approvals` | 提交处置申请 |
| 审批流程 | POST | `/api/v1/approvals/{id}/approve` | 审批操作 |
| 处置管理 | POST | `/api/v1/disposals` | 录入处置结果 |
| 通用 | POST | `/api/v1/upload` | 文件上传 |

## 6. 附录

### 6.1 术语表

| 术语 | 定义 |
|------|------|
| PRD | Product Requirements Document，产品需求文档 |
| PDD | PRD-Driven Development，PRD 驱动开发 |
| FP | Feature Point，功能点 |
| CRUD | Create/Read/Update/Delete，增删改查 |
| OAuth | Open Authorization，开放授权协议 |
| SSO | Single Sign-On，单点登录 |
| RBAC | Role-Based Access Control，基于角色的访问控制 |

### 6.2 参考资料

- 《国有资产评估管理办法》
- 《企业会计准则——固定资产》
- 集团《资产管理制度》(内部文件 V2026.01)

### 6.3 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0.0 | 2026-04-12 | 初始版本 | 产品经理 |
```

### 4.3 PRD 编写最佳实践

以下 5 条铁律来自 PDD-Skills 的行为塑造机制 (Behavior Shaping)，遵循它们可以让你的 PRD 更专业、更易于被 AI 技能处理：

#### 铁律 1: 需求必须可量化 (Measurable)

```markdown
# ❌ 错误写法
系统应该响应很快

# ✅ 正确写法
API 接口 95% 分位响应时间 < 500ms
页面首屏加载时间 < 2 秒
```

#### 铁律 2: 每个功能必须有验收标准 (Acceptance Criteria)

```markdown
# ❌ 错误写法
REQ-001: 用户登录功能

# ✅ 正确写法
REQ-001: 用户登录功能
验收标准:
- [ ] 支持用户名+密码登录
- [ ] 密码错误 5 次锁定账户 30 分钟
- [ ] 登录成功后返回 JWT Token (有效期 24h)
- [ ] 支持记住我功能 (7 天免登录)
```

#### 铁律 3: 用户故事格式要完整 (User Story Template)

```markdown
# 标准 As-A-I-Want-To-So-That 格式

作为 [角色],
我希望 [功能],
以便 [价值]。

示例:
作为资产管理员,
我希望能够按资产类别筛选列表,
以便快速找到同类资产进行批量操作。
```

#### 铁律 4: 明确边界 (Scope Boundary)

```markdown
# 一定要声明什么不做！

范围内:
- ✅ 资产 CRUD
- ✅ 评估任务管理
- ✅ 审批流程

范围外:
- ❌ 移动端 APP (本期只做响应式 H5)
- ❌ 与 ERP 财务模块对接
- ❌ 电子签章
```

#### 铁律 5: 数据模型先行 (Data Model First)

```markdown
# 在写功能之前，先定义核心实体和字段
# 这会让后续的功能提取和代码生成更准确

核心实体:
- Asset (资产): id, name, category, value, status...
- Evaluation (评估): id, asset_id, value, method, status...
- Approval (审批): id, eval_id, decision, opinion...
```

### 4.4 将 PRD 保存到项目中

将上面编写好的 PRD 内容保存到项目中：

```bash
# 在项目根目录下创建 docs 目录 (如果不存在)
mkdir -p docs/prd

# 将 PRD 内容保存为文件
# 你可以使用任何文本编辑器 (VS Code / 记事本 / Vim)
# 文件路径: docs/prd/asset-eval-system.prdx
```

保存后的目录结构：

```
asset-eval-project/
├── docs/
│   ├── prd/
│   │   └── asset-eval-system.prdx   ← 你的 PRD 文件在这里
│   ├── reviews/
│   └── plans/
├── .pdd/
│   └── config.yaml
└── ...
```

---

## 第5章：PDD 工作流实战

本章将带你走完 PDD 的完整工作流，从业务分析到验证确认。

### 5.1 Phase 1: 业务分析 (pdd-ba)

业务分析是 PDD 工作流的第一步，目标是深入理解 PRD 中的业务需求，输出结构化的分析报告。

#### 触发方式

在 AI Agent 环境（如 Claude Desktop / Trae IDE）中，你可以通过以下方式触发 `pdd-ba` 技能：

```bash
# 方式一: 使用触发词
/analyze docs/prd/asset-eval-system.prdx

# 方式二: 自然语言触发
"请帮我分析这个资产评估系统的 PRD"
"对这个需求文档进行业务分析和建模"
```

#### 分析过程 (5W1H 方法论)

`pdd-ba` 技能会按照以下步骤进行分析：

**Step 1: 需求收集**

从 PRD 中提取原始需求清单：
- 资产登记 (REQ-001)
- 评估任务 (REQ-002)
- 评估报告 (REQ-003)
- 审批流程 (REQ-004)
- 处置执行 (REQ-005)

**Step 2: 5W1H 六维分析**

对每个需求进行深度分析：

| 维度 | 资产登记 (REQ-001) | 审批流程 (REQ-004) |
|------|-------------------|-------------------|
| **Why** | 统一管理分散的资产信息 | 合规管控，防范资产流失风险 |
| **What** | 资产的增删改查、批量导入 | 多级审批、意见签署、超时催办 |
| **Who** | 资产管理员(主)、系统管理员(辅) | 资产管理员(发起)、部门经理/领导(审批) |
| **When** | 资产生成时、定期盘点 | 提交申请后、审批人收到通知时 |
| **Where** | PC 浏览器、H5 移动端 | 办公电脑、移动审批 |
| **How** | 表单录入 + Excel 导入 | 工作流引擎驱动状态转换 |

**Step 3: 业务建模**

##### a. 用例图 (Use Case Diagram)

```
                    ┌─────────────┐
                    │   系统边界   │
                    │             │
  ┌─────────┐       │  ┌───────┐  │       ┌──────────┐
  │资产管理员│──────▶│  │UC-001 │  │       │ 评估师   │
  └─────────┘       │  │资产登记│  │◀──────└──────────┘
                    │  └───┬───┘  │
                    │      │      │
                    │  ┌───▼───┐  │       ┌──────────┐
                    │  │UC-002 │  │◀──────│审批人    │
                    │  │评估任务│  │       └──────────┘
                    │  └───┬───┘  │
                    │      │      │
                    │  ┌───▼───┐  │       ┌──────────┐
                    │  │UC-003 │  │◀──────│系统管理员│
                    │  │审批流程│  │       └──────────┘
                    │  └───┬───┘  │
                    │      │      │
                    │  ┌───▼───┐  │
                    │  │UC-004 │  │
                    │  │处置执行│  │
                    │  └───────┘  │
                    └─────────────┘
```

##### b. 状态机 (State Machine)

**资产状态机**:

| 状态 | 代码 | 含义 | 可转入下一状态 | 触发条件 |
|------|------|------|---------------|---------|
| 闲置 | IDLE | 初始状态，等待评估 | EVALUATING | 创建评估任务 |
| 评估中 | EVALUATING | 正在进行评估 | DISPOSING / IDLE | 评估完成/取消 |
| 处置中 | DISPOSING | 审批或执行中 | DISPOSED / IDLE | 处置完成/驳回 |
| 已处置 | DISPOSED | 处置完成，已归档 | - | 终态 |

**审批状态机**:

| 状态 | 代码 | 含义 | 可转入 | 触发条件 |
|------|------|------|--------|---------|
| 待提交 | DRAFT | 申请草稿 | SUBMITTED | 提交申请 |
| 已提交 | SUBMITTED | 等待审批 | APPROVED/REJECTED/RETURNED | 进入审批流 |
| 已批准 | APPROVED | 审批通过 | COMPLETED | 开始执行 |
| 已驳回 | REJECTED | 审批拒绝 | DRAFT | 修改后重提 |
| 已退回 | RETURNED | 退回修改 | SUBMITTED | 修改后重提 |
| 已完成 | COMPLETED | 处置归档 | - | 终态 |

**Step 4: CRUD 矩阵**

| 实体 | Create | Read | Update | Delete | List | Export |
|------|--------|------|--------|-------|------|--------|
| Asset | ✅ | ✅ | ✅ | 软删除 | ✅(分页) | ✅ Excel |
| Evaluation | ✅ | ✅ | ✅(结果) | ❌ | ✅(我的) | ✅ |
| Approval | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Disposal | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Attachment | ✅(上传) | ✅(下载) | ❌ | ❌ | ✅ | ❌ |

**Step 5: 业务规则提取**

| 规则ID | 规则描述 | 约束类型 | 优先级 |
|--------|---------|---------|--------|
| BR-001 | 资产编号全局唯一 | 硬性规则 | P0 |
| BR-002 | 评估任务截止日期不得早于创建日期+7天 | 硬性规则 | P0 |
| BR-003 | 处置底价不得超过评估价值的 90% | 软性规则 | P1 |
| BR-004 | ≥ 50万的处置需增加分管领导审批节点 | 硬性规则 | P0 |
| BR-005 | 审批超时 3 天自动催办 | 软性规则 | P1 |

#### 输出产物

Phase 1 完成后，会生成 `business-analysis-report.md`，保存在 `docs/plans/` 目录下：

```
docs/plans/
└── business-analysis-report.md    ← 业务分析报告 (约 200-400 行)
```

报告结构：

```markdown
# 资产评估处置管理系统 — 业务分析报告

## 1. 概述
- 文档信息: BA-ZCPG-20260412-v1.0
- 业务背景: ...
- 目标与价值: ...

## 2. 5W1H 分析
- REQ-001: 资产登记管理 (详细六维分析)
- REQ-002: 评估任务管理
- ...

## 3. 用例分析
- UC-001: 资产登记 (参与者/前置条件/基本流程/异常流程)
- UC-002: 创建评估任务
- ...

## 4. 流程分析
- 资产处置主流程图 (Mermaid 语法)
- 异常分支处理

## 5. 状态分析
- 资产状态机
- 评估任务状态机
- 审批流程状态机

## 6. CRUD 矩阵
- (详见上表)

## 7. 业务规则
- (详见上表)

## 8. 风险与假设
- 风险: RISK-001 ~ RISK-005
- 假设: ASSUMPTION-001 ~ ASSUMPTION-003
```

### 5.2 Phase 2: 特征提取 (pdd-extract-features)

特征提取的目标是从业务分析报告和 PRD 中提取出**可独立开发和验收的功能点**。

#### 触发方式

```bash
# 触发词
/extract-features docs/prd/asset-eval-system.prdx

# 或自然语言
"从这个 PRD 中提取功能点"
"生成功能点矩阵"
```

#### 提取过程

**Step 1: 分析业务用例**

从 Phase 1 的分析报告中提取用例清单。

**Step 2: 识别功能操作**

对每个用例拆解为具体的原子操作，并分类标记：

| 操作类型 | 代码 | 说明 | 示例 |
|---------|------|------|------|
| C (Create) | C | 新建 | 新增资产、创建任务 |
| R (Read) | R | 查看/详情 | 查看资产详情 |
| U (Update) | U | 修改 | 编辑资产信息 |
| D (Delete) | D | 删除 | 删除资产(软删) |
| B (Batch) | B | 批量 | 批量导入资产 |
| A (Approve) | A | 审批 | 审批处置申请 |
| E (Export) | E | 导出 | 导出 Excel 报表 |
| F (Flow) | F | 状态流转 | 提交/撤回/驳回 |

**Step 3: 评估复杂度**

| 复杂度 | 代码 | 判断标准 | 预估工时 |
|--------|------|---------|---------|
| **P0 核心** | P0 | 涉及审批流/外部集成/核心业务规则 | 3-5 天 |
| **P1 重要** | P1 | 重要功能，有替代方案 | 1-2 天 |
| **P2 辅助** | P2 | 辅助功能，简单 CRUD | 0.5 天 |

**Step 4: 生成功能点矩阵**

#### 实际输出示例

以下是资产评估系统提取出的功能点矩阵（节选前 8 个）：

```markdown
# 资产评估处置管理系统 — 功能点矩阵

## 矩阵信息
| 项目 | 值 |
|------|-----|
| 模块编号 | ZCPG (资产评估) |
| 模块名称 | 资产评估处置管理 |
| 生成日期 | 2026-04-12 |
| 版本 | v1.0 |
| PRD 来源 | docs/prd/asset-eval-system.prdx |

## 功能点汇总表

### 按复杂度统计: P0 (8个) | P1 (6个) | P2 (4个) | 总计: 18个
### 按操作类型统计: C(4) R(4) U(3) D(1) A(3) B(1) E(1) F(1)

## 详细功能点列表

| 功能点ID | 功能名称 | 页面/接口 | 操作 | 复杂度 | AI角色 | 依赖 | 测试策略 |
|---------|---------|----------|------|--------|--------|------|---------|
| FP-ZCPG1-001 | 新增资产登记 | assets.vue | C | P0 | AI-C | - | 正向+字段校验+重复检测 |
| FP-ZCPG1-002 | 资产列表查询 | assets.vue | R | P1 | AI-L | - | 分页+排序+筛选 |
| FP-ZCPG1-003 | 资产详情查看 | asset-detail.vue | R | P1 | AI-L | 001 | 权限+关联数据展示 |
| FP-ZCPG1-004 | 编辑资产信息 | asset-form.vue | U | P1 | AI-C | 001 | 修改历史+并发控制 |
| FP-ZCPG1-005 | 批量导入资产 | import-dialog.vue | B | P2 | AI-C | - | 格式校验+错误反馈 |
| FP-ZCPG1-006 | 创建评估任务 | evaluations.vue | C | P0 | AI-C | 001 | 资产状态校验 |
| FP-ZCPG1-007 | 我的评估任务 | my-tasks.vue | R | P1 | AI-L | 006 | 数据权限过滤 |
| FP-ZCPG1-008 | 提交评估结果 | eval-result.vue | U | P0 | AI-C | 007 | 金额校验+附件上传 |
| FP-ZCPG1-009 | 上传评估报告 | upload.vue | C | P0 | AI-C | 008 | 文件类型+大小限制 |
| FP-ZCPG1-010 | 审核评估报告 | review-dialog.vue | A | P1 | AI-C | 009 | 通过/驳回流程 |
| FP-ZCPG1-011 | 提交处置申请 | apply-disposal.vue | C | P0 | AI-C | 010 | 底价规则校验 |
| FP-ZCPG1-012 | 审批处置申请 | approve-dialog.vue | A | P0 | AI-C | 011 | 多级审批路由 |
| FP-ZCPG1-013 | 录入处置结果 | disposal-form.vue | C | P1 | AI-C | 012 | 成交价校验 |
| FP-ZCPG1-004 | 处置统计报表 | stats-dashboard.vue | R | P2 | AI-L | 013 | 图表渲染+数据聚合 |
| FP-ZCPG1-015 | 导出处置档案 | export-btn.vue | E | P2 | AI-L | 013 | PDF 打包生成 |
| FP-ZCPG1-016 | 资产状态流转 | asset-actions.vue | F | P1 | AI-C | 001 | 状态机校验 |
| FP-ZCPG1-017 | 审批催办提醒 | notification.vue | F | P2 | AI-L | 012 | 定时任务+消息推送 |
| FP-ZCPG1-018 | 软删除资产 | asset-list.vue | D | P2 | AI-R | 001 | 审计日志记录 |
```

#### P0 功能点详情示例

以 `FP-ZCPG1-012` (审批处置申请) 为例：

```markdown
### FP-ZCPG1-012: 审批处置申请

**基本信息**
- 功能点ID: FP-ZCPG1-012
- 功能名称: 审批处置申请
- 所属用例: UC-003 (审批流程管理)
- 操作类型: A (Approve 审批)
- 复杂度: P0 (核心业务)
- AI角色: AI-C (AI与人工协作)

**功能描述**
实现资产处置申请的多级审批功能。支持审批人在待办列表中查看申请详情，进行同意/驳回/退回修改操作，并填写审批意见。系统根据处置金额自动路由到正确的审批层级。

**前置条件**
- 处置申请已提交且状态为 SUBMITTED
- 当前用户具有审批权限 (RBAC 角色: dept_manager / leader)
- 评估报告已审核通过

**后置条件**
- 审批记录写入数据库
- 申请状态更新 (APPROVED / REJECTED / RETURNED)
- 如全部节点通过，触发处置执行阶段
- 发送通知给申请人

**输入字段**
| 字段名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| approval_id | UUID | 是 | 审批记录ID |
| decision | Enum | 是 | 决定: approved / rejected / returned |
| opinion | Text | 条件必填 | 审批意见 (驳回时必填) |

**输出信息**
- 审批结果 (success/fail)
- 下一步操作指引
- 流程当前状态

**业务规则**
| 规则ID | 规则描述 | 约束类型 | 优先级 |
|--------|---------|---------|--------|
| BR-004 | ≥ 50万需增加分管领导审批 | 硬性规则 | P0 |
| BR-005 | 驳回必须填写原因 | 硬性规则 | P0 |
| BR-006 | 审批人不能审批自己发起的申请 | 硬性规则 | P0 |

**测试策略**
- **正向场景**: 正常审批通过，状态正确流转
- **异常场景**: 金额阈值边界测试 (49.9万 vs 50.1万)
- **异常场景**: 缺少审批意见时提交驳回
- **异常场景**: 自己审批自己的申请
- **异常场景**: 并发审批 (两人同时操作)
```

#### 输出产物

```
specs/features/
├── feature-matrix.md              ← 功能点矩阵汇总
├── FP-ZCPG1-001-asset-register/   ← 每个功能点的独立目录
│   └── (Phase 3 生成的 spec.md)
├── FP-ZCPG1-002-asset-list/
├── ...
└── FP-ZCPG1-018-asset-delete/
```

### 5.3 Phase 3: 规格生成 (pdd-generate-spec)

规格生成是将功能点转化为**开发者可以直接使用的详细技术规格**，包括接口定义、数据模型、业务逻辑伪代码和验收标准。

#### 触发方式

```bash
# 为单个功能点生成规格
/generate-spec FP-ZCPG1-012

# 或批量生成
"为所有 P0 功能点生成开发规格"
```

#### 规格文档结构

每个功能点会生成独立的 `spec.md` 文件：

```markdown
# FP-ZCPG1-012: 审批处置申请 — 开发规格

## 1. 基本信息
- 功能点ID: FP-ZCPG1-012
- 模块: ZCPG (资产评估)
- 复杂度: P0
- 技术栈: Python FastAPI + Vue3 + MySQL

## 2. 接口定义

### 2.1 API 端点

POST /api/v1/approvals/{approval_id}/approve

### 2.2 请求参数

{
  "decision": "approved",        // Enum: approved | rejected | returned
  "opinion": "同意，建议尽快执行" // Text, required when decision=rejected/returned
}

### 2.3 响应格式

// 成功 (200)
{
  "code": 0,
  "message": "审批成功",
  "data": {
    "approval_id": "uuid",
    "status": "approved",
    "next_node": null,           // null 表示流程结束
    "process_completed": true
  }
}

// 业务错误 (400)
{
  "code": 40001,
  "message": "审批意见不能为空",
  "data": null
}

## 3. 数据模型

### 3.1 Approval Model (SQLAlchemy)

class Approval(Base):
    __tablename__ = "approvals"

    id = Column(UUID, primary_key=True, default=uuid4)
    evaluation_id = Column(UUID, ForeignKey("evaluations.id"), nullable=False)
    process_instance_id = Column(String(64), nullable=False)
    current_node = Column(String(50), nullable=False)  # dept_manager / leader
    disposal_method = Column(Enum("auction", "agreement_transfer"), nullable=False)
    reserve_price = Column(Numeric(12,2), nullable=False)
    decision = Column(Enum("approved","rejected","returned"), nullable=True)
    opinion = Column(Text, nullable=True)
    approved_by = Column(UUID, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)

### 3.2 Pydantic Schema

class ApproveRequest(BaseModel):
    decision: Literal["approved", "rejected", "returned"]
    opinion: Optional[str] = None

    @validator('opinion')
    def validate_opinion(cls, v, values):
        if values.get('decision') in ('rejected', 'returned') and not v:
            raise ValueError('驳回/退回时必须填写审批意见')
        return v

## 4. 业务逻辑

### 4.1 审批处理伪代码

async def handle_approval(approval_id: UUID, user: User, req: ApproveRequest):
    # 1. 获取审批记录
    approval = await get_approval(approval_id)
    if not approval:
        raise NotFound("审批记录不存在")

    # 2. 校验状态
    if approval.status != "submitted":
        raise BadRequest("当前状态不允许审批")

    # 3. 权限校验: 审批人不能审批自己发起的申请
    evaluation = await get_evaluation(approval.evaluation_id)
    if evaluation.created_by == user.id:
        raise Forbidden("不能审批自己发起的申请")

    # 4. 金额阈值判断: ≥ 50万需要分管领导审批
    if approval.reserve_price >= 500000 and approval.current_node != "leader":
        raise Forbidden("大额处置需分管领导审批")

    # 5. 意见校验
    if req.decision in ('rejected', 'returned') and not req.opinion:
        raise BadRequest("驳回/退回时必须填写审批意见")

    # 6. 更新审批记录
    approval.decision = req.decision
    approval.opinion = req.opinion
    approval.approved_by = user.id
    approval.approved_at = datetime.now()
    await save(approval)

    # 7. 触发工作流下一步
    if req.decision == "approved":
        await workflow_engine.advance(approval.process_instance_id)
    else:
        await workflow_engine.return_to_previous(approval.process_instance_id)

    # 8. 发送通知
    await notify_applicant(evaluation.created_by, req.decision)

    return {"status": req.decision}

## 5. 验收标准

### 5.1 功能验收
- [ ] AC-001: 正常审批通过，状态变为 approved
- [ ] AC-002: 驳回时必须填写意见，否则报错
- [ ] AC-003: ≥ 50万非领导角色审批时返回 403
- [ ] AC-004: 不能审批自己发起的申请
- [ ] AC-005: 审批历史时间线正确显示

### 5.2 性能验收
- [ ] AP-001: 审批接口响应时间 < 500ms (P95)
- [ ] AP-002: 支持 50 QPS 并发审批

### 5.3 安全验收
- [ ] SEC-001: 未认证用户返回 401
- [ ] SEC-002: 无权限用户返回 403
- [ ] SEC-003: 审批意见防 XSS 注入

## 6. 测试用例

### 6.1 单元测试 (pytest)

@pytest.mark.asyncio
async def test_approve_success():
    """正常审批通过"""
    approval = create_test_approval(reserve_price=30000)
    req = ApproveRequest(decision="approved", opinion="同意")
    result = await handle_approval(approval.id, manager_user, req)
    assert result["status"] == "approved"

@pytest.mark.asyncio
async def test_approve_reject_without_opinion():
    """驳回缺少意见"""
    approval = create_test_approval()
    req = ApproveRequest(decision="rejected")
    with pytest.raises(BadRequest, match="必须填写"):
        await handle_approval(approval.id, manager_user, req)

### 6.2 集成测试
- 使用 TestClient 测试完整 HTTP 请求/响应
- 验证数据库状态变化
- 验证通知发送
```

### 5.4 Phase 4: 代码实现 (pdd-implement-feature)

有了详细的开发规格后，就可以开始写代码了。PDD-Skills 提供了脚手架模板来加速这一步。

#### 触发方式

```bash
# 实现单个功能点
/implement FP-ZCPG1-012

# 或使用脚手架模板批量生成
pdd generate -s specs/features/FP-ZCPG1-012/spec.md -o ./src --template python-fullstack
```

#### 代码生成过程

**Step 1: 选择模板**

本项目使用 `python-fullstack` 模板，它会生成：

```
backend/app/api/v1/approvals.py      # API 路由
backend/app/schemas/approval.py      # Pydantic Schema
backend/app/models/approval.py       # ORM Model
backend/app/services/approval_svc.py # 业务逻辑层
frontend/src/views/ApproveDialog.vue # 前端组件
```

**Step 2: 基于规格填充代码**

脚手架会生成代码骨架，你需要根据 spec.md 中的业务逻辑伪代码填充具体实现。

**Step 3: 生成的代码结构示例**

```python
# backend/app/api/v1/approvals.py (由脚手架生成 + AI 补充)

from fastapi import APIRouter, Depends, HTTPException
from ..deps import get_current_user, get_db
from ...schemas.approval import ApproveRequest, ApproveResponse
from ...services.approval_svc import ApprovalService

router = APIRouter(prefix="/approvals", tags=["审批管理"])

@router.post("/{approval_id}/approve", response_model=ApproveResponse)
async def approve_disposal(
    approval_id: str,
    req: ApproveRequest,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    审批处置申请

    - **approval_id**: 审批记录 ID
    - **decision**: 审批决定 (approved/rejected/returned)
    - **opinion**: 审批意见 (驳回时必填)
    """
    service = ApprovalService(db)
    try:
        result = await service.handle_approval(
            approval_id=approval_id,
            user=current_user,
            request=req
        )
        return ApproveResponse(code=0, message="审批成功", data=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
```

```vue
<!-- frontend/src/views/ApproveDialog.vue (由脚手架生成 + AI 补充) -->

<template>
  <el-dialog :visible.sync="visible" title="审批处置申请" width="600px">
    <el-descriptions :column="2" border>
      <el-descriptions-item label="资产名称">{{ approval.assetName }}</el-descriptions-item>
      <el-descriptions-item label="处置方式">{{ disposalMethodLabel }}</el-descriptions-item>
      <el-descriptions-item label="底价">¥{{ approval.reservePrice?.toLocaleString() }}</el-descriptions-item>
      <el-descriptions-item label="评估价值">¥{{ approval.evalValue?.toLocaleString() }}</el-descriptions-item>
    </el-descriptions>

    <el-form ref="form" :model="form" :rules="rules" style="margin-top: 20px">
      <el-form-item label="审批决定" prop="decision">
        <el-radio-group v-model="form.decision">
          <el-radio-button label="approved">同意</el-radio-button>
          <el-radio-button label="rejected">驳回</el-radio-button>
          <el-radio-button label="returned">退回修改</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item
        v-if="form.decision !== 'approved'"
        label="审批意见"
        prop="opinion"
        :rules="[{ required: true, message: '请填写审批意见', trigger: 'blur' }]"
      >
        <el-input
          v-model="form.opinion"
          type="textarea"
          :rows="4"
          placeholder="请输入审批意见..."
        />
      </el-form-item>
    </el-form>

    <span slot="footer">
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        确认提交
      </el-button>
    </span>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { approveDisposal } from '@/api/approvals'

const props = defineProps({
  approval: { type: Object, required: true }
})

const emit = defineEmits(['success'])
const visible = defineModel('visible')
const submitting = ref(false)

const form = ref({
  decision: 'approved',
  opinion: ''
})

const rules = {
  decision: [{ required: true, message: '请选择审批决定', trigger: 'change' }]
}

const disposalMethodLabel = computed(() => {
  const map = { auction: '公开拍卖', agreement_transfer: '协议转让' }
  return map[props.approval.disposalMethod]
})

async function handleSubmit() {
  submitting.value = true
  try {
    await approveDisposal(props.approval.id, form.value)
    ElMessage.success('审批成功')
    visible.value = false
    emit('success')
  } catch (error) {
    ElMessage.error(error.message || '审批失败')
  } finally {
    submitting.value = false
  }
}
</script>
```

### 5.5 Phase 5: 代码审查 (pdd-code-reviewer)

代码实现完成后，需要进行质量审查。

#### 触发方式

```bash
/code-review backend/app/api/v1/approvals.py

# 或审查整个目录
"审查 backend/app 目录下的所有代码"
```

#### 审查维度 (五维评分引擎)

| 维度 | 权重 | 评审要点 | 评级标准 |
|------|------|---------|---------|
| **可读性** (Readability) | 20% | 命名规范、函数长度、注释覆盖率 | S≥90 / A≥80 / B≥70 / C≥60 / D≥50 / F<50 |
| **可维护性** (Maintainability) | 20% | 重复代码、模块内聚、耦合度 | 同上 |
| **健壮性** (Robustness) | 25% | Null检查、错误处理、边界验证 | 同上 |
| **性能** (Performance) | 15% | 循环效率、内存分配、I/O操作 | 同上 |
| **安全性** (Security) | 20% | SQL注入、XSS、输入验证 | 同上 |

#### 审查报告示例

```markdown
# Code Review Report — approvals.py

**文件**: backend/app/api/v1/approvals.py
**审查时间**: 2026-04-12 15:30:00
**审查者**: pdd-code-reviewer (AI)

## 总分: 82/100 (Grade: B)

| 维度 | 得分 | 等级 | 主要问题 |
|------|------|------|---------|
| 可读性 | 85 | B | 函数略长(45行)，建议拆分 |
| 可维护性 | 88 | B | Service 层耦合度适中 |
| 健壮性 | 78 | C | 缺少部分边界校验 |
| 性能 | 90 | A | 无性能问题 |
| 安全性 | 75 | C | 建议 input 增加 sanitize |

## 问题列表

### 🔴 Critical (1)
| # | 位置 | 问题描述 | 建议 |
|---|------|---------|------|
| C1 | L42 | SQL 拼接存在注入风险 | 使用参数化查询 |

### 🟡 Warning (3)
| # | 位置 | 问题描述 | 建议 |
|---|------|---------|------|
| W1 | L28 | 函数过长 (>40行) | 拆分为 validate + execute + notify |
| W2 | L35 | 缺少并发控制 | 添加分布式锁 |
| W3 | L55 | 错误信息暴露内部细节 | 统一错误码 |

### ℹ️ Info (2)
| # | 位置 | 问题描述 | 建议 |
|---|------|---------|------|
| I1 | L15 | 缺少 JSDoc 注释 | 补充函数说明 |
| I2 | L50 | 日志级别不规范 | debug → info |

## 修复建议优先级
1. **立即修复**: C1 (SQL 注入)
2. **本次迭代修复**: W1, W2, W3
3. **后续优化**: I1, I2
```

### 5.6 Phase 6: 验证确认 (pdd-verify-feature)

最后一步是验证实现的代码是否符合规格要求。

#### 触发方式

```bash
/verify FP-ZCPG1-012

# 或命令行
pdd verify -s specs/features/FP-ZCPG1-012/spec.md -c ./backend/app --json
```

#### 验证维度

| 维度 | 说明 | 通过标准 |
|------|------|---------|
| **完整性** (Completeness) | 规格中的所有接口/字段/规则是否都已实现 | 100% 覆盖 |
| **正确性** (Correctness) | 实现是否符合规格描述的行为 | 所有测试用例通过 |
| **一致性** (Consistency) | 代码与规格、前后端之间是否一致 | 无矛盾 |

#### 验证报告示例

```json
{
  "feature_id": "FP-ZCPG1-012",
  "feature_name": "审批处置申请",
  "verify_time": "2026-04-12T16:00:00Z",
  "overall_result": "PASS",

  "coverage": {
    "total_requirements": 15,
    "covered": 14,
    "coverage_percent": 93.3,
    "uncovered": ["AP-002: 50 QPS 并发测试 (性能测试环境未就绪)"]
  },

  "test_results": {
    "total_cases": 12,
    "passed": 11,
    "failed": 1,
    "skipped": 0,
    "pass_rate": 91.7,

    "failed_case": {
      "name": "test_concurrent_approval",
      "error": "AssertionError: Expected 200, got 429 (Too Many Requests)",
      "suggestion": "需要在测试环境配置 rate limiter 阈值"
    }
  },

  "consistency_check": {
    "api_spec_match": true,
    "model_schema_match": true,
    "frontend_backend_match": true,
    "issues": []
  },

  "grade": "A",
  "verdict": "CONDITIONAL_PASS",
  "next_step": "修复 1 个失败测试用例后可标记为 DONE"
}
```

---

## 第6章：核心功能演示

本章演示如何启动和运行资产评估系统。

### 6.1 启动后端服务

```bash
# 1. 进入后端目录
cd asset-eval-project/backend

# 2. 创建并激活虚拟环境 (如果还没做)
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# 3. 安装 Python 依赖
pip install -r requirements.txt

# 4. 配置数据库连接 (编辑 backend/app/core/database.py)
# 设置 MySQL 连接字符串:
# DATABASE_URL = "mysql+aiomysql://dev_user:dev_password@localhost:3306/asset_eval"

# 5. 执行数据库迁移 (首次)
alembic upgrade head

# 6. 启动后端服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

启动成功后，你会看到：

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345]
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### 6.2 启动前端服务

```bash
# 新开一个终端窗口

# 1. 进入前端目录
cd asset-eval-project/frontend

# 2. 安装 npm 依赖
npm ci

# 3. 启动开发服务器
npm run dev
```

启动成功后：

```
VITE v5.4.0  ready in 450 ms

➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.100:5173/
➜  press h + enter to show help
```

打开浏览器访问 `http://localhost:5173/`，你应该能看到系统首页。

### 6.3 使用 Swagger UI 测试 API

FastAPI 自动提供了交互式 API 文档 (Swagger UI)：

1. 打开浏览器访问: `http://localhost:8000/docs`
2. 你会看到所有 API 端点的列表
3. 点击任意端点可以查看详细参数
4. 点击 "Try it out" 可以直接测试接口

**测试资产列表接口示例**：

```
GET /api/v1/assets?page=1&page_size=10&category=equipment

Response 200:
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [...],
    "total": 42,
    "page": 1,
    "page_size": 10
  }
}
```

### 6.4 演示数据权限效果

PDD-Skills 的 python-fullstack 脚手架内置了**数据权限引擎**，可以实现组织级别的数据隔离。

#### 场景设置

假设有以下组织架构：

```
集团总部
├── 财务部 (dept_finance)
│   ├── 张三 (资产管理员)
│   └── 李四 (部门经理)
├── 信息中心 (dept_it)
│   ├── 王五 (资产管理员)
│   └── 赵六 (部门经理)
└── 行政部 (dept_admin)
    └── 孙七 (系统管理员)
```

#### 权限效果演示

| 用户 | 操作 | 结果 |
|------|------|------|
| 张三 (财务部) | 查询资产列表 | 只看到财务部的资产 (10条) |
| 王五 (信息中心) | 查询资产列表 | 只看到信息中心的资产 (8条) |
| 李四 (财务部经理) | 查询资产列表 | 看到财务部 + 下属数据 (10条) |
| 孙七 (管理员) | 查询资产列表 | 看到全部资产 (42条) |

#### 数据权限配置

在 `backend/app/core/data_permission/config.py` 中配置：

```python
DATA_PERMISSION_CONFIG = {
    "mode": "hybrid",           # hybrid = 组织隔离 + 借调合并
    "scope_resolver": "org_tree", # 基于组织树解析
    "rules": [
        {
            "entity": "Asset",
            "scope": "department",  # 按部门隔离
            "field": "department_id"
        },
        {
            "entity": "Evaluation",
            "scope": "assigned_to", # 评估师只能看自己的任务
            "field": "evaluator_id"
        }
    ]
}
```

### 6.5 演示工作流审批流程

脚手架内置的工作流引擎支持状态机驱动的审批流程。

#### 审批流程配置

```python
# backend/app/core/workflow/engine.py

DISPOSAL_APPROVAL_FLOW = {
    "name": "资产处置审批流程",
    "initial_state": "draft",
    "states": ["draft", "submitted", "dept_approved", "leader_approved", "completed", "rejected"],
    "transitions": [
        {"from": "draft", "to": "submitted", "trigger": "submit", "actor": "applicant"},
        {"from": "submitted", "to": "dept_approved", "trigger": "approve_dept", "actor": "dept_manager"},
        {"from": "submitted", "to": "leader_review", "trigger": "approve_dept", "condition": "reserve_price >= 500000"},
        {"from": "leader_review", "to": "leader_approved", "trigger": "approve_leader", "actor": "leader"},
        {"from": "dept_approved/leader_approved", "to": "completed", "trigger": "start_disposal", "actor": "admin"},
        {"from": "*", "to": "rejected", "trigger": "reject", "actor": "any_approver"},
    ],
    "sign_strategies": {
        "dept_manager": "all_pass",   # 部门经理一人通过即可
        "leader": "all_pass"          # 分管领导一人通过即可
    }
}
```

#### 流程演示步骤

```
1. 资产管理员张三:
   → 登录系统
   → 选择闲置资产 (服务器一台)
   → 创建评估任务 → 指派给评估师

2. 评估师:
   → 接收任务
   → 录入评估结果 (评估价值: 6.2万)
   → 上传评估报告 (PDF)

3. 资产管理员张三:
   → 基于评估报告提交处置申请
   → 处置方式: 公开拍卖
   → 底价: 5.5万 (< 50万，只需部门经理审批)

4. 部门经理李四:
   → 收到审批通知
   → 查看申请详情 (资产信息+评估报告)
   → 填写审批意见: "同意"
   → 点击"同意"

5. 系统:
   → 审批通过 (因为 < 50万，无需领导审批)
   → 状态变为 "待执行"
   → 通知资产管理员

6. 资产管理员张三:
   → 录入处置结果 (成交价: 5.8万, 受让方: XX科技)
   → 上交凭证
   → 完成归档

7. 最终状态: 资产 → "已处置" ✅
```

### 6.6 演示 OAuth 登录

脚手架支持多种 OAuth2 登录方式。这里以模拟登录为例（开发环境常用）：

#### 配置 OAuth 提供商

```python
# backend/app/core/oauth/providers/dingtalk.py (钉钉示例)

class DingTalkOAuthProvider(OAuthBaseProvider):
    """钉钉 OAuth2 登录"""

    provider_name = "dingtalk"
    authorize_url = "https://oapi.dingtalk.com/connect/authorize"
    token_url = "https://oapi.dingtalk.com/gettoken"
    userinfo_url = "https://oapi.dingtalk.com/topapi/v2/user/get"

    async def get_user_info(self, access_token: str, code: str) -> UserInfo:
        # 调用钉钉 API 获取用户信息
        user_data = await self.call_api(access_token, code)
        return UserInfo(
            openid=user_data["openid"],
            unionid=user_data.get("unionid"),
            name=user_data["name"],
            email=user_data.get("email"),
            department_ids=user_data.get("department", []),
            avatar=user_data.get("avatarUrl")
        )
```

#### 模拟登录 (开发环境)

开发环境下，可以使用模拟登录跳过真实 OAuth 流程：

```python
# backend/app/api/v1/auth.py

@router.post("/dev-login")
async def dev_login(request: DevLoginRequest):
    """
    开发环境模拟登录 (仅限 DEBUG 模式)
    生产环境此接口会被移除
    """
    if not settings.DEBUG:
        raise HTTPException(404, "Not found")

    # 模拟查找或创建用户
    user = await get_or_create_dev_user(request.username, request.role)
    token = create_jwt_token(user)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "role": user.role,
            "department": user.department.name
        }
    }
```

**调用示例**：

```bash
curl -X POST http://localhost:8000/api/v1/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"username": "zhangsan", "role": "asset_admin"}'

# 返回:
# {
#   "access_token": "eyJhbGciOiJIUzI1NiIs...",
#   "token_type": "bearer",
#   "user": { "id": "...", "name": "张三", "role": "asset_admin" }
# }
```

---

## 第7章：进阶技巧

### 7.1 自定义技能开发

PDD-Skills 支持自定义技能扩展。每个技能本质上是一个包含 `SKILL.md` 的文件夹。

#### SKILL.md 结构说明

```markdown
---
name: my-custom-skill                    # 技能名称 (唯一标识)
description: "我的自定义技能描述"        # 技能描述 (用于触发匹配)
license: MIT
compatibility: 需要的前置条件
metadata:
  author: "your@email.com"
  version: "1.0"
  parent: pdd-main                       # 父技能 (可选)
  triggers:                              # 触发词列表
    - "我的技能关键词1" | "skill keyword 1"
    - "我的技能关键词2" | "skill keyword 2"
---

# 技能标题

## Core Concept / 核心概念

### 🇨🇳 中文描述
技能的核心功能和适用场景

### 🇺🇸 English Description
English description for bilingual support

## 方法论 / Methodology
(你的专业技能方法论)

## 输出规范 / Output Specification
(期望的输出格式)

## Iron Law / 核心铁律
(必须遵守的规则，至少 3 条)

## Rationalization Table / 合理化防御表
(常见陷阱和应对策略)

## Red Flags / 红旗警告
(输入/执行/输出三层防护)

## Guardrails / 安全护栏
(必须遵守和避免的事项)
```

#### 创建自定义技能

```bash
# 1. 在 skills 目录下创建新技能
mkdir -p skills/custom/my-skill

# 2. 创建 SKILL.md (参考上面的模板)

# 3. 创建 _meta.json (元数据)
cat > skills/custom/my-skill/_meta.json << 'EOF'
{
  "name": "my-custom-skill",
  "version": "1.0.0",
  "category": "custom",
  "triggers": ["我的技能", "my skill"],
  "enabled": true
}
EOF

# 4. (可选) 创建 evals 测试
mkdir -p skills/custom/my-skill/evals
cat > skills/custom/my-skill/evals/default-evals.json << 'EOF'
{
  "tests": [
    {
      "name": "basic_functionality",
      "input": "使用我的技能处理 xxx",
      "expected_contains": ["输出结果"]
    }
  ]
}
EOF
```

### 7.2 添加新的脚手架模板

除了内置的 `python-fullstack` 模板，你也可以创建自定义模板：

```bash
# 1. 在 scaffolds 目录下创建新模板
mkdir -p scaffolds/my-template

# 2. 创建 template_config.yaml
cat > scaffolds/my-template/template_config.yaml << 'EOF'
name: my-template
display_name: "我的自定义模板"
version: "1.0.0"
description: "基于 XXX 技术栈的项目模板"
tech_stack:
  backend:
    language: "java"
    framework: "spring-boot"
  frontend:
    language: "typescript"
    framework: "react"
features:
  - name: "auth"
    display_name: "认证模块"
    enabled: true
directories:
  backend: "backend/"
  frontend: "frontend/"
hooks:
  post_generate:
    - step: "install_deps"
      command: "cd {{output_dir}} && mvn install"
templates:
  crud_module:
    source: "templates/crud/"
    output: "{{module_name}}/"
metadata:
  author: "Your Name"
  pdd_compatible_version: ">=3.0.0"
EOF

# 3. 创建模板源码目录结构
mkdir -p scaffolds/my-template/{backend,frontend,templates,docs}

# 4. 在模板目录中放置实际的模板文件
# (Jinja2 模板语法, 变量用 {{variable}} 引用)
```

### 7.3 配置 CI/CD 流水线

PDD-Skills 内置了 GitHub Actions 模板，位于脚手架的 `.github/workflows/ci.yml`：

```yaml
# .github/workflows/ci.yml (已内置在 python-fullstack 模板中)

name: PDD CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install PDD-Skills
        run: npm install -g pdd-skills

      - name: Run PDD Linter
        run: pdd linter -t all -f ./backend ./frontend

      - name: Run Backend Tests
        run: |
          cd backend
          pip install -r requirements-dev.txt
          pytest tests/ -v --cov=app

      - name: Run Frontend Tests
        run: |
          cd frontend
          npm ci
          npm run test:unit

      - name: PDD Verify
        run: pdd verify -s ./specs -c ./backend --json

      - name: Generate Quality Report
        run: pdd report -t html -o ./reports
        if: always()

      - name: Upload Reports
        uses: actions/upload-artifact@v4
        with:
          name: quality-reports
          path: ./reports/
        if: always()
```

### 7.4 使用 PDD Visual Manager 监控项目

PDD-Skills v3.0 引入了 **PDD Visual Manager (VM)**，提供双形态可视化监控能力。

#### Web Dashboard

```bash
# 启动 Web Dashboard
pdd dashboard

# 默认访问: http://localhost:3001
# 自定义端口:
pdd dashboard -p 8080
```

Dashboard 提供 4 大视图面板：

| 视图 | 功能 | 适用场景 |
|------|------|---------|
| **Pipeline View** | 开发流水线各阶段进度 | 项目经理查看整体进度 |
| **Kanban View** | 功能点看板 (Backlog/Analysis/Design/Implement/Verify) | 团队成员跟踪任务状态 |
| **Quality View** | 五维评分雷达图、规则分布直方图 | 技术负责人监控代码质量 |
| **System View** | 服务状态、API 响应时间、缓存命中率 | 运维人员监控系统健康 |

#### Terminal TUI

```bash
# 启动终端 UI (适合 SSH 远程场景)
pdd tui

# TUI 快捷键:
# Tab     - 切换屏幕
# q/Ctrl+C - 退出
# r/F5    - 强制刷新
# j/k     - 上下移动光标
# Enter   - 查看详情
# ?       - 显示帮助
```

#### VM 数据查询

```bash
# 项目状态摘要
pdd vm status

# 功能点列表
pdd vm features
pdd vm features --status done    # 只看已完成

# 导出数据
pdd vm export --format csv -o report.csv
pdd vm export --format json
```

### 7.5 性能优化建议

| 优化方向 | 具体措施 | 预期效果 |
|---------|---------|---------|
| **API 响应** | 启用 Redis 缓存热点数据 (资产列表/字典表) | P95 从 500ms 降至 50ms |
| **数据库** | 为高频查询字段添加索引 (department_id, status, category) | 查询速度提升 10x |
| **前端加载** | 启用路由懒加载 + 组件按需加载 | 首屏加载 < 2s |
| **文件上传** | 使用 OSS/S3 对象存储 + CDN 加速 | 上传速度提升 5x |
| **Token 管理** | 配置 Token 预算，避免超额消耗 | 成本降低 30% |

---

## 第8章：常见问题解答 (FAQ)

### 安装问题 (5个)

**Q1: `npm install -g pdd-skills` 报错 EACCES?**

A: 这是权限问题。解决方案：
- Linux/macOS: 使用 `sudo npm install -g pdd-skills` 或修改 npm 全局目录
- Windows: 以管理员身份运行 PowerShell

**Q2: Node.js 版本太旧怎么办?**

A: PDD-Skills 需要 Node.js >= 18。升级方法：
- 使用 nvm: `nvm install --lts && nvm use --lts`
- 直接从官网下载最新 LTS 版本: https://nodejs.org/

**Q3: pip 安装依赖很慢或超时?**

A: 使用国内镜像源：
```bash
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
```

**Q4: Docker 安装 MySQL 连接不上?**

A: 检查以下几点：
1. Docker 容器是否正在运行: `docker ps | grep mysql`
2. 端口映射是否正确: `docker port pdd-mysql`
3. 防火墙是否放行 3306 端口
4. 尝试重启容器: `docker restart pdd-mysql`

**Q5: Python 虚拟环境激活失败?**

A: Windows PowerShell 可能阻止脚本执行。解决方案：
```powershell
# 以管理员身份运行
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
# 然后再激活
.\.venv\Scripts\activate
```

### 使用问题 (5个)

**Q6: `pdd init` 报错 "template not found"?**

A: 检查模板名称是否正确。可用模板：
- `python-fullstack` (Python FastAPI + Vue3)
- `default` (基础模板)
- `java` (Spring Boot)
- `frontend` (纯前端)

查看所有模板: `pdd list --templates`

**Q7: 如何切换已有项目的模板?**

A: 编辑 `.pdd/config.yaml`:
```yaml
project:
  template: python-fullstack  # 修改为你想要的模板
```

**Q8: 技能没有被触发怎么办?**

A: 检查触发词是否正确：
1. 查看 `skills/<skill-name>/_meta.json` 中的 `triggers` 字段
2. 确保你的输入包含触发词或其同义词
3. 尝试使用更明确的指令: `/analyze`, `/extract-features` 等

**Q9: 如何查看某个技能的详细信息?**

A: 阅读 `skills/<skill-name>/SKILL.md` 文件，其中包含：
- 完整的方法论说明
- 输入/输出规范
- Iron Law (铁律)
- Red Flags (红旗警告)

**Q10: 生成的代码不符合预期?**

A: 可能的原因及解决方案：
1. PRD 写得不够详细 → 补充更多业务规则和字段说明
2. 功能点粒度不对 → 重新审视 FP 的拆分粒度
3. 规格不够具体 → 在 spec.md 中补充伪代码和边界条件
4. 手动调整 → 代码生成只是起点，需要人工完善

### 代码生成问题 (3个)

**Q11: 生成的 API 缺少某些接口?**

A: 检查功能点矩阵是否完整：
1. 确认 `feature-matrix.md` 包含了所有需要的操作 (CRUD)
2. 使用 MECE 原则检验是否有遗漏
3. 手动补充缺失的功能点到矩阵中

**Q12: 前后端字段不一致?**

A: 这是常见问题。解决方案：
1. 确认 `spec.md` 中的 Schema 定义同时覆盖了 Request 和 Response
2. 检查 Pydantic Model 和 TypeScript Interface 是否同步
3. 运行 `pdd verify` 会检测这类不一致问题

**Q13: 数据库迁移失败?**

A: 常见原因：
1. Model 定义与现有数据库结构冲突 → 使用 `alembic revision --autogenerate` 生成增量迁移
2. 外键约束违反 → 检查数据顺序和引用完整性
3. 字段类型不匹配 → 确认 SQLAlchemy 类型与 MySQL 类型的映射

### 性能问题 (2个)

**Q14: API 响应很慢?**

A: 排查步骤：
1. 检查是否有 N+1 查询问题 (使用 SQLAlchemy 的 `selectinload`)
2. 确认数据库索引是否建立
3. 检查是否启用了缓存 (`pdd config --set cache.enabled=true`)
4. 使用 `pdd token -f ./backend` 分析 Token 消耗是否合理

**Q15: 前端页面加载卡顿?**

A: 优化建议：
1. 启用 Vite 的代码分割: 使用动态 `import()`
2. 检查是否有大组件未做懒加载
3. 使用 Chrome DevTools Performance 面板分析瓶颈
4. 图片资源使用 CDN 或压缩

---

## 附录

### A: 命令速查表

| 命令 | 说明 | 示例 |
|------|------|------|
| `pdd version` | 显示版本号 | `pdd version` |
| `pdd init <name>` | 初始化项目 | `pdd init my-proj --template python-fullstack` |
| `pdd list` | 列出所有技能 | `pdd list --json` |
| `pdd generate` | 代码生成 | `pdd generate -s spec.md -o ./src --dry-run` |
| `pdd verify` | 功能验证 | `pdd verify -s spec.md -c ./src --json` |
| `pdd report` | 生成报告 | `pdd report -t html -o ./reports` |
| `pdd linter` | 代码检查 | `pdd linter -t code prd sql -f ./src` |
| `pdd config` | 配置管理 | `pdd config --list` / `pdd config --set key=value` |
| `pdd api` | 启动 API 服务 | `pdd api -p 3000 --cors` |
| `pdd dashboard` | Web Dashboard | `pdd dashboard -p 3001` |
| `pdd tui` | Terminal TUI | `pdd tui --refresh 3` |
| `pdd vm status` | 项目状态 | `pdd vm status` |
| `pdd vm features` | 功能点列表 | `pdd vm features --status done` |
| `pdd vm export` | 导出数据 | `pdd vm export --format csv` |
| `pdd update` | 更新技能 | `pdd update --version latest` |
| `pdd eval` | 运行评估测试 | `pdd eval -c core` |
| `pdd token` | Token 分析 | `pdd token -f ./src` |
| `pdd i18n` | 国际化检查 | `pdd i18n -c all` |

### B: 文件结构速查表

```
pdd-skills-v3/                          # PDD-Skills 工具本身
├── bin/pdd.js                           # CLI 入口
├── lib/                                 # 核心库 (~80 模块)
│   ├── api-server.js                    # REST API 服务器
│   ├── mcp-server.js                    # MCP 协议服务器
│   ├── sdk-js.js / sdk-python/          # SDK (JS/Python)
│   ├── cache/                           # 三级缓存系统
│   ├── quality/scorer.js                # 五维评分引擎
│   └── vm/                              # Visual Manager (~38 文件)
├── skills/                              # 技能定义
│   ├── core/ (11个)                     # 核心技能
│   ├── expert/ (2个)                    # 专家技能
│   └── openspec/ (10个)                 # OpenSpec 技能
├── templates/                           # 模板
│   └── prd-template.prdx               # PRD 模板
└── scaffolds/python-fullstack/          # Python 全栈脚手架


your-project/                           # 你的业务项目 (pdd init 生成)
├── .pdd/config.yaml                     # PDD 配置
├── docs/                                # 文档
│   ├── prd/                             # PRD 文档
│   ├── reviews/                         # Review 报告
│   └── plans/                           # 设计文档
├── specs/features/                      # 功能规格 (FP-xxx/spec.md)
├── backend/                             # Python 后端 (FastAPI)
├── frontend/                            # Vue3 前端
├── openspec/                            # 变更管理
└── testcases/                           # 测试用例
```

### C: 错误码参考

| 错误码 | 含义 | 常见原因 | 解决方案 |
|--------|------|---------|---------|
| **PDD-001** | 配置文件缺失 | `.pdd/config.yaml` 不存在 | 运行 `pdd init` 初始化 |
| **PDD-002** | 模板未找到 | 指定的模板名称无效 | 使用 `pdd list --templates` 查看可用模板 |
| **PDD-003** | PRD 解析失败 | PRD 格式不符合模板 | 对照 `prd-template.prdx` 检查格式 |
| **PDD-004** | 功能点 ID 冲突 | 两个功能点使用了相同 ID | 重新编号，保持唯一性 |
| **PDD-005** | 规格生成失败 | 功能点缺少必要信息 | 补充功能点详情 |
| **PDD-006** | 代码生成失败 | 脚手架模板缺失或损坏 | 重装模板或检查路径 |
| **PDD-007** | 验证失败 | 代码不符合规格 | 根据 verify 报告修复问题 |
| **PDD-008** | 权限不足 | 当前用户无权执行操作 | 检查 RBAC 配置 |
| **PDD-009** | 缓存错误 | 缓存服务异常 | 清除缓存: `rm -rf .cache/` |
| **PDD-010** | 网络超时 | API 请求超时 | 检查网络连接和防火墙 |
| **INPUT-\*-*** | 输入校验错误 | 输入数据不符合要求 | 参考 Red Flags 说明修正 |
| **EXEC-\*-*** | 执行过程错误 | 处理逻辑异常 | 检查数据和业务规则 |
| **OUTPUT-\*-*** | 输出校验错误 | 输出格式不符合规范 | 检查输出模板 |

### D: 术语表

| 术语 | 全称 | 定义 |
|------|------|------|
| **PRD** | Product Requirements Document | 产品需求文档，PDD 的驱动源头 |
| **PDD** | PRD-Driven Development | PRD 驱动开发，本框架的核心方法论 |
| **FP** | Feature Point | 功能点，最小的可验收工作单元 |
| **CRUD** | Create/Read/Update/Delete | 增删改查，基本数据操作 |
| **5W1H** | Who/What/When/Where/Why/How | 六维分析法，业务分析工具 |
| **MECE** | Mutually Exclusive Collectively Exhaustive | 相互独立完全穷尽，分类原则 |
| **Spec** | Specification | 开发规格，介于需求和代码之间的详细设计 |
| **SKILL.md** | Skill Definition File | 技能定义文件，包含触发词和行为塑造 |
| **Iron Law** | - | 铁律，必须遵守的硬性规则 |
| **Red Flag** | - | 红旗警告，三级防护机制 |
| **MCP** | Model Context Protocol | 模型上下文协议，AI Agent 通信标准 |
| **SDK** | Software Development Kit | 软件开发工具包 |
| **OAuth** | Open Authorization | 开放授权协议，SSO 标准 |
| **SSO** | Single Sign-On | 单点登录 |
| **RBAC** | Role-Based Access Control | 基于角色的访问控制 |
| **FastAPI** | - | 现代 Python Web 框架，异步高性能 |
| **Vue3** | - | 渐进式 JavaScript 框架 |
| **Pydantic** | - | Python 数据验证库，FastAPI 默认使用 |
| **SQLAlchemy** | - | Python ORM 框架 |
| **JWT** | JSON Web Token | 令牌认证标准 |
| **TUI** | Terminal User Interface | 终端用户界面 |
| **VM** | Visual Manager | 可视化管理器 (PDD-VM) |
| **CI/CD** | Continuous Integration/Deployment | 持续集成/部署 |
| **Linter** | - | 代码静态检查工具 |
| **Evals** | Evaluations | 评估测试框架 |

---

> **恭喜你完成了这份入门指南!** 🎉
>
> 现在你已经掌握了 PDD-Skills v3 的核心概念和完整工作流。接下来就是动手实践了 —— 从编写你的第一个 PRD 开始，逐步体验 PDD 带来的高效开发体验。
>
> **记住**: PDD 不是要取代你的思考，而是让你的思考更有结构、更有迹可循。
>
> Happy Coding! 💻

---

*文档版本: v1.0.0 | 最后更新: 2026-04-12 | 基于 PDD-Skills v3.0.1*
