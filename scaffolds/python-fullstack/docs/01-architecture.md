# PDD-Scaffold 设计文档

> **Python FastAPI + Vue3 通用项目脚手架 (PDD 插件模式)**

**版本**: v1.0.0  
**日期**: 2026-04-12  
**状态**: 设计完成，待实现

---

## 目录

- [1. 项目概述](#1-项目概述)
- [2. 需求分析](#2-需求分析)
- [3. 技术架构](#3-技术架构)
- [4. 项目结构](#4-项目结构)
- [5. 核心功能设计](#5-核心功能设计)
- [6. 模板系统设计](#6-模板系统设计)
- [7. 插件接口规范](#7-插件接口规范)
- [8. 工程化配置](#8-工程化配置)
- [9. 实现计划](#9-实现计划)

---

## 1. 项目概述

### 1.1 项目定位

PDD-Scaffold 是一个基于 **PDD (PRD-Driven Development)** 工作流的通用项目脚手架工具。作为 **pdd-skills-v3 的插件**，它能够：

- 从 PRD 需求文档自动生成标准化的 Python FastAPI + Vue3 全栈项目
- 提供交互式项目初始化向导
- 基于规格文档自动生成 CRUD 代码
- 预置用户认证、权限管理等基础模块
- 内置 Docker、CI/CD 等工程化配置

### 1.2 核心价值

| 特性 | 传统方式 | PDD-Scaffold |
|------|---------|--------------|
| 项目搭建 | 手动复制粘贴，耗时数小时 | `pdd scaffold:init` 5分钟完成 |
| 代码一致性 | 依赖开发者经验 | 模板驱动，100% 一致 |
| 文档同步 | 容易过时 | PRD → Spec → Code 自动同步 |
| 最佳实践 | 需要学习总结 | 内置于模板中 |
| 团队协作 | 规范难以统一 | 统一的目录结构和编码规范 |

### 1.3 目标用户

- 使用 PDD 工作流进行开发的团队
- 需要 Python FastAPI + Vue3 技术栈的项目
- 追求开发效率和代码质量的团队

---

## 2. 需求分析

### 2.1 功能需求

#### FR-001: 项目初始化
- **优先级**: P0 (必须)
- **描述**: 通过交互式命令行向导快速生成项目骨架
- **验收标准**:
  - 支持配置项目名称、描述、作者等基本信息
  - 可选技术栈组件（认证、权限、国际化等）
  - 一次性生成前后端完整目录结构
  - 生成 Docker 和 CI/CD 配置文件

#### FR-002: 代码生成器
- **优先级**: P0 (必须)
- **描述**: 基于 PDD 规格文档自动生成 CRUD 代码
- **验收标准**:
  - 解析 spec.md 提取数据模型、API、页面定义
  - 生成后端 Model/Schema/Router/Service/CRUD
  - 生成前端 API/Views/Types/Components
  - 自动更新路由配置
  - 支持 Alembic 数据库迁移脚本生成

#### FR-003: 基础模块模板
- **优先级**: P0 (必须)
- **描述**: 预置通用的业务基础模块
- **验收标准**:
  - 用户认证模块（JWT + 登录注册）
  - RBAC 权限管理模块
  - 用户管理 CRUD 示例
  - 角色权限管理 CRUD

#### FR-004: 工程化配置
- **优先级**: P1 (重要)
- **描述**: 提供生产就绪的基础设施配置
- **验收标准**:
  - Docker Compose 编排（MySQL + Backend + Frontend + Nginx）
  - GitHub Actions / GitLab CI 配置
  - Nginx 反向代理配置
  - 环境变量模板 (.env.example)

### 2.2 非功能需求

| 需求 | 指标 |
|------|------|
| **性能** | 初始化时间 < 10s，代码生成 < 5s/模块 |
| **可扩展性** | 新增技术栈只需添加模板集 |
| **可维护性** | 模板与逻辑分离，清晰的模块划分 |
| **兼容性** | Node.js >= 18, Python >= 3.11 |

### 2.3 技术选型

| 层级 | 技术 | 选型理由 |
|------|------|----------|
| **插件框架** | pdd-skills v3.0 Plugin SDK | 复用现有 PRD→Spec 能力 |
| **模板引擎** | Jinja2 (Python) | 语法丰富，适合代码生成 |
| **后端技术栈** | FastAPI + SQLAlchemy + Alembic | 现代 Python Web 框架首选 |
| **前端技术栈** | Vue 3 + Vite + TypeScript + Element Plus | 企业级主流组合 |
| **数据库** | MySQL 8.0 | 生产环境广泛使用 |
| **容器化** | Docker + Docker Compose | 标准化部署 |
| **状态管理** | Pinia | Vue 3 官方推荐 |

---

## 3. 技术架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PDD-Scaffold 架构总览                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   PRD 文档   │───▶│ PDD-Skills  │───▶│  规格文档    │                 │
│  │  (.prdx)    │    │  核心引擎    │    │  (spec.md)  │                 │
│  └─────────────┘    └──────┬──────┘    └──────┬──────┘                 │
│                           │                   │                        │
│                           ▼                   ▼                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    ★ Scaffold 插件 (核心)                         │   │
│  │                                                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │   │
│  │  │ 模板渲染引擎  │  │ 代码生成器   │  │ 配置管理器   │            │   │
│  │  │ (Jinja2)     │  │ (CRUD)      │  │ (YAML/JSON) │            │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                           │                                           │
│           ┌───────────────┼───────────────┐                           │
│           ▼               ▼               ▼                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                    │
│  │  后端项目   │  │  前端项目   │  │  基础设施   │                    │
│  │ (FastAPI)   │  │ (Vue3+Vite) │  │(Docker等)  │                    │
│  └─────────────┘  └─────────────┘  └─────────────┘                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 与 PDD-Skills 集成

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    PDD-Scaffold 插件集成详情                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                    PDD-Skills v3.0 (已有)                         │    │
│  │                                                                    │    │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐            │    │
│  │  │ pdd-ba      │   │ pdd-extract │   │ pdd-generate│            │    │
│  │  │ 业务分析     │──▶│ 特征提取    │──▶│ 规格生成    │            │    │
│  │  └─────────────┘   └─────────────┘   └──────┬──────┘            │    │
│  │                                           │                      │    │
│  │  输出: spec.md (功能点规格文档)             │                      │    │
│  └───────────────────────────────────────────┼──────────────────────┘    │
│                                              │                          │
│                              ┌───────────────▼───────────────┐        │
│                              │    ★ Scaffold 插件 (新增)       │        │
│                              │                               │        │
│                              │  Hook: post-generate           │        │
│                              │  ┌─────────────────────────┐   │        │
│                              │  │ Spec Parser              │   │        │
│                              │  │ 解析 spec.md 提取:        │   │        │
│                              │  │ • 数据模型 (models)       │   │        │
│                              │  │ • API 端点 (routes)       │   │        │
│                              │  │ • 前端页面 (views)        │   │        │
│                              │  └───────────┬─────────────┘   │        │
│                              └──────────────┼────────────────┘        │
│                                             │                          │
│                     ┌───────────────────────┼───────────────────┐      │
│                     ▼                       ▼                   ▼      │
│          ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│          │ Backend Generator│  │ Frontend Generator│  │ Infra Config │ │
│          │                  │  │                  │  │              │ │
│          │ • FastAPI app.py │  │ • Vue3 项目结构  │  │ • Dockerfile │ │
│          │ • SQLAlchemy ORM │  │ • API 服务层     │  │ • docker-    │ │
│          │ • Router/Schema  │  │ • Element Plus   │  │   compose.yml│ │
│          │ • Service/CRUD   │  │ • Pinia Store    │  │ • CI/CD      │ │
│          │ • Alembic 迁移   │  │ • Vue Router     │  │ • .env 模板  │ │
│          └──────────────────┘  └──────────────────┘  └──────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.3 数据流

```
Step 1: 用户编写 PRD 文档 (.prdx)
    ↓
Step 2: pdd-ba 分析业务 → 产出领域模型
    ↓
Step 3: pdd-extract 提取功能点 → 产出 features.json
    ↓
Step 4: pdd-generate 生成规格 → 产出 spec.md
    ↓
Step 5: [Hook 触发] Scaffold 插件启动
    ↓
Step 6: Spec Parser 解析规格文档
    ↓
Step 7: 模板渲染引擎 (Jinja2) + 上下文数据 → 生成代码
    ↓
Step 8: 输出完整项目结构到目标目录
```

### 3.4 核心组件职责

| 组件 | 职责 | 技术实现 |
|------|------|----------|
| **Spec Parser** | 解析 PDD 规格文档，提取模型/API/页面定义 | 正则 + YAML 解析 |
| **Template Engine** | 渲染代码模板，支持变量/循环/条件 | Jinja2 |
| **Backend Generator** | 生成 FastAPI 后端代码 | 模板集合 |
| **Frontend Generator** | 生成 Vue3 前端代码 | 模板集合 |
| **Config Manager** | 管理脚手架配置和项目配置 | YAML/JSON |
| **Plugin SDK** | 实现 PDD 插件接口规范 | 继承 PluginBase |

---

## 4. 项目结构

### 4.1 脚手架工具目录 (pdd-scaffold/)

```
pdd-scaffold/                          # 脚手架插件根目录
├── plugin.json                        # 插件元数据配置
├── index.js                           # 插件入口 (PluginBase)
├── package.json                       # 依赖声明
│
├── core/                              # 核心模块
│   ├── spec-parser.js                 # 规格文档解析器
│   ├── template-engine.js             # Jinja2 模板引擎封装
│   ├── config-manager.js              # 配置管理器
│   └── utils/
│       ├── string-utils.js            # 字符串工具 (驼峰/蛇形转换)
│       └── file-utils.js              # 文件操作工具
│
├── generators/                        # 代码生成器
│   ├── backend-generator.js           # 后端生成器 (FastAPI)
│   ├── frontend-generator.js          # 前端生成器 (Vue3)
│   ├── infra-generator.js             # 基础设施生成器
│   └── base-generator.js              # 生成器基类
│
└── templates/                         # 代码模板库
    ├── backend/                       # FastAPI 后端模板
    │   ├── project/                   # 项目骨架
    │   │   ├── app/
    │   │   │   ├── __init__.py.j2
    │   │   │   ├── main.py.j2
    │   │   │   ├── config.py.j2
    │   │   │   ├── dependencies.py.j2
    │   │   │   └── exceptions.py.j2
    │   │   ├── models/
    │   │   │   └── model.py.j2
    │   │   ├── schemas/
    │   │   │   ├── schema.py.j2
    │   │   │   └── response.py.j2
    │   │   ├── api/
    │   │   │   ├── router.py.j2
    │   │   │   └── deps.py.j2
    │   │   ├── services/
    │   │   │   ├── crud.py.j2
    │   │   │   └── service.py.j2
    │   │   ├── core/
    │   │   │   ├── auth.py.j2
    │   │   │   ├── security.py.j2
    │   │   │   └── rbac.py.j2
    │   │   └── database/
    │   │       ├── database.py.j2
    │   │       └── session.py.j2
    │   └── modules/
    │       └── module/
    │           ├── models.py.j2
    │           ├── schemas.py.j2
    │           ├── router.py.j2
    │           ├── service.py.j2
    │           └── crud.py.j2
    │
    ├── frontend/                      # Vue3 前端模板
    │   ├── project/
    │   │   ├── package.json.j2
    │   │   ├── vite.config.ts.j2
    │   │   ├── tsconfig.json.j2
    │   │   ├── index.html.j2
    │   │   └── src/
    │   │       ├── main.ts.j2
    │   │       ├── App.vue.j2
    │   │       ├── router/index.ts.j2
    │   │       ├── stores/index.ts.j2
    │   │       ├── api/
    │   │       │   ├── index.ts.j2
    │   │       │   └── request.ts.j2
    │   │       ├── layouts/
    │   │       │   └── DefaultLayout.vue.j2
    │   │       ├── views/home/index.vue.j2
    │   │       ├── styles/
    │   │       │   ├── variables.scss.j2
    │   │       │   └── reset.scss.j2
    │   └── modules/
    │       └── module/
    │           ├── list.vue.j2
    │           ├── form.vue.j2
    │           ├── detail.vue.j2
    │           ├── components/SearchForm.vue.j2
    │           └── types/index.ts.j2
    │
    └── infra/                         # 基础设施模板
        ├── Dockerfile.j2
        ├── docker-compose.yml.j2
        ├── docker-compose.dev.yml.j2
        ├── .env.example.j2
        ├── .gitignore.j2
        ├── nginx.conf.j2
        ├── README.md.j2
        └── ci/
            ├── github-actions.yml.j2
            └── gitlab-ci.yml.j2
```

### 4.2 生成的目标项目结构 (my-project/)

```
my-project/                           # 脚手架生成的目标项目
│
├── 📁 backend/                       # FastAPI 后端
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # 应用入口 (Uvicorn)
│   │   ├── config.py                 # 配置管理 (Pydantic Settings)
│   │   ├── dependencies.py           # 依赖注入
│   │   └── exceptions.py             # 自定义异常
│   │
│   │   ├── core/                     # 核心模块
│   │   │   ├── auth.py               # JWT 认证
│   │   │   ├── security.py           # 密码哈希
│   │   │   └── rbac.py              # 基于角色的访问控制
│   │   │
│   │   ├── models/                   # SQLAlchemy ORM 模型
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   └── role.py
│   │   │
│   │   ├── schemas/                  # Pydantic Schema
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   └── common.py
│   │   │
│   │   ├── api/                      # API 路由层
│   │   │   ├── __init__.py
│   │   │   ├── deps.py
│   │   │   └── v1/
│   │   │       ├── router.py
│   │   │       └── users.py
│   │   │
│   │   ├── services/                 # 业务逻辑层
│   │   │   └── user_service.py
│   │   │
│   │   ├── crud/                     # 数据访问层
│   │   │   └── crud_user.py
│   │   │
│   │   └── database/                 # 数据库配置
│   │       ├── database.py
│   │       └── session.py
│   │
│   ├── alembic/                      # 数据库迁移
│   ├── tests/                        # 测试
│   ├── requirements.txt
│   ├── Dockerfile
│   └── pyproject.toml
│
├── 📁 frontend/                      # Vue3 前端
│   ├── src/
│   │   ├── api/                      # API 请求层
│   │   ├── components/               # 全局组件
│   │   ├── composables/              # 组合式函数
│   │   ├── layouts/                  # 布局组件
│   │   ├── router/                   # 路由配置
│   │   ├── stores/                   # Pinia 状态管理
│   │   ├── styles/                   # 全局样式
│   │   ├── utils/                    # 工具函数
│   │   ├── views/                    # 页面视图
│   │   ├── types/                    # TS 类型定义
│   │   ├── App.vue
│   │   └── main.ts
│   │
│   ├── package.json
│   ├── vite.config.ts
│   ├── Dockerfile
│   └── nginx.conf
│
├── 📁 infra/                         # 基础设施配置
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   └── scripts/
│
├── docs/                             # 项目文档
├── specs/features/                   # PDD 功能规格
├── .gitignore
└── README.md
```

---

## 5. 核心功能设计

### 5.1 项目初始化 (scaffold:init)

**命令格式：**
```bash
pdd scaffold:init <project-name> [options]
```

**选项：**

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `--description` | "" | 项目描述 |
| `--author` | Git 用户名 | 作者名称 |
| `--python` | "3.11" | Python 版本 |
| `--database` | "mysql" | 数据库类型 |
| `--auth` | true | 是否包含认证模块 |
| `--rbac` | true | 是否包含权限模块 |
| `--docker` | true | 是否生成 Docker 配置 |
| `--cicd` | "none" | CI/CD 类型 (github/gitlab/none) |
| `--i18n` | false | 是否支持国际化 |

**交互流程：**

```
$ pdd scaffold:init my-awesome-project

🏗️ PDD-Scaffold 项目初始化向导
═════════════════════════════════

? 项目名称: my-awesome-project
? 项目描述: 我的 awesome 项目
? 作者: Your Name
? Python 版本: 3.11 (推荐)
? 数据库: MySQL
? 是否需要用户认证模块: Yes (推荐)
? 是否需要 RBAC 权限管理: Yes (推荐)
? 前端是否需要国际化: No
? Docker 支持: Yes (推荐)
? CI/CD: GitHub Actions

✅ 配置已保存到 .pdd-scaffold/config.yaml

📦 正在生成项目骨架...
   ✓ 创建目录结构
   ✓ 生成后端代码 (FastAPI)
   ✓ 生成前端代码 (Vue3 + Vite)
   ✓ 生成基础设施配置
   ✓ 创建文档

🎉 项目初始化完成!

📋 下一步:
   cd my-awesome-project
   cp .env.example .env          # 配置环境变量
   docker-compose up -d           # 启动开发环境
```

**生成的配置文件 (.pdd-scaffold/config.yaml)：**

```yaml
project:
  name: my-awesome-project
  description: "我的 awesome 项目"
  author: Your Name
  version: "0.1.0"

backend:
  framework: fastapi
  python_version: "3.11"
  database:
    type: mysql
    host: localhost
    port: 3306
    name: my_awesome_db
    user: root
  auth:
    enabled: true
    jwt_secret: "${JWT_SECRET}"
    token_expire_hours: 24
  rbac:
    enabled: true

frontend:
  framework: vue3
  build_tool: vite
  language: typescript
  ui_library: element-plus
  state_management: pinia
  i18n: false

infra:
  docker: true
  ci_cd: github-actions
  nginx: true
```

### 5.2 代码生成器 (scaffold:generate)

**命令格式：**
```bash
pdd scaffold:generate --spec <spec-path> --target <output-dir>
```

**参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `--spec` | ✅ | PDD 规格文档路径 |
| `--target` | ✅ | 输出目录路径 |
| `--module` | 否 | 仅生成指定模块 (backend/frontend/infra) |
| `--force` | 否 | 强制覆盖已存在文件 |
| `--dry-run` | 否 | 预览模式，不实际写入文件 |

**执行示例：**

```
$ pdd scaffold:generate --spec ./specs/FP-USER-001-user/spec.md --target ./my-project

🔍 解析规格文档: FP-USER-001-user
   发现 2 个数据模型: User, Role
   发现 5 个 API 端点: Create, Read, Update, Delete, List
   发现 3 个前端页面: List, Form, Detail

🎨 开始渲染模板...

📁 后端代码生成:
   ✓ backend/app/models/user.py        (42 行)
   ✓ backend/app/models/role.py        (28 行)
   ✓ backend/app/schemas/user.py       (85 行)
   ✓ backend/app/api/v1/users.py      (156 行)
   ✓ backend/app/services/user_service.py (98 行)
   ✓ backend/app/crud/crud_user.py     (124 行)
   ✓ alembic/versions/001_user.py      (迁移脚本)

📁 前端代码生成:
   ✓ frontend/src/api/modules/user.ts    (65 行)
   ✓ frontend/src/views/users/list.vue   (234 行)
   ✓ frontend/src/views/users/form.vue   (189 行)
   ✓ frontend/src/views/users/detail.vue (145 行)
   ✓ frontend/src/types/user.d.ts        (45 行)

📁 路由更新:
   ✓ backend/app/api/v1/router.py       (添加 /users 路由)
   ✓ frontend/src/router/index.ts       (添加 /users 路由)

✅ 代码生成完成! 共生成 14 个文件，约 1261 行代码
```

**CRUD 生成矩阵：**

| API 操作 | 后端生成 | 前端生成 |
|---------|---------|---------|
| **Create** | POST router + create service + create schema | Form.vue + API call |
| **Read (List)** | GET router + list service + pagination schema | List.vue + Table + Pagination |
| **Read (Detail)** | GET /{id} router + get service | Detail.vue |
| **Update** | PUT /{id} router + update service | Form.vue (编辑模式) |
| **Delete** | DELETE /{id} router + delete service | ConfirmDialog + API call |

### 5.3 基础模块模板

#### 5.3.1 认证模块 (Auth Module)

**后端：**
```
├── core/auth.py              # JWT Token 创建/验证
├── core/security.py          # 密码哈希/验证 (bcrypt)
├── schemas/auth.py           # Login/Register Schema
├── api/v1/auth.py            # 登录/注册/刷新Token 接口
└── services/auth_service.py  # 认证业务逻辑
```

**前端：**
```
├── views/login/index.vue     # 登录页面
├── stores/modules/user.ts    # 用户状态 (Token/UserInfo)
├── utils/auth.ts             # Token 存取/清除
├── composables/useAuth.ts    # 认证组合函数
└── utils/permission.ts       # 权限指令 v-permission
```

#### 5.3.2 RBAC 权限模块

**后端：**
```
├── core/rbac.py              # 角色权限检查装饰器
├── models/role.py            # Role 模型
├── models/permission.py      # Permission 模型
└── api/v1/roles.py           # 角色管理 API
```

**前端：**
```
├── utils/permission.ts       # v-permission 指令
├── router/index.ts           # 路由守卫 (meta.requiresAuth)
└── layouts/components/Sidebar.vue  # 根据权限过滤菜单
```

---

## 6. 模板系统设计

### 6.1 模板语法规范

使用 **Jinja2** 模板语法，文件扩展名为 `.j2`。

**常用语法：**

```jinja2
{# 注释 #}
{{ 变量输出 }}
{% 控制语句 %}
{% 过滤器 %}
```

**内置变量：**

| 变量 | 说明 | 示例 |
|------|------|------|
| `project.name` | 项目名称 | `my_project` |
| `project.Name` | 项目名 (PascalCase) | `MyProject` |
| `model.name` | 模型名称 | `User` |
| `model.name_lower` | 模型名 (snake_case) | `user` |
| `model.fields` | 字段列表 | `[...]` |
| `apis` | API 端点列表 | `[...]` |
| `pages` | 页面列表 | `[...]` |

**内置过滤器：**

```jinja2
{{ 'user_name' | camelCase }}      → userName
{{ 'UserName' | snake_case }}     → user_name
{{ 'user' | pluralize }}          → users
{{ 'user' | upper }}              → USER
```

### 6.2 模板示例

#### 后端 Model 模板 (templates/backend/models/model.py.j2)

```jinja2
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Table, ForeignKey
from sqlalchemy.orm import relationship
from {{ project.name }}.database import Base


class {{ model.name }}(Base):
    """{{ model.name | docstring }} 模型"""
    __tablename__ = '{{ model.tableName }}'

    {%- for field in model.fields %}
    {{ field.name }} = Column(
        {{ field.type }}{% if field.length %}({{ field.length }}){% endif %},
        {%- if field.primaryKey %} primary_key=True{% endif -%}
        {%- if field.autoIncrement %}, autoincrement=True{%- endif -%}
        {%- if field.unique %}, unique=True{%- endif -%}
        {%- if not field.nullable %}, nullable=False{%- endif -%}
        {%- if field.defaultValue is defined %}, default={{ field.defaultValue }}{%- endif -%}
        {%- if field.autoNow %}, default=datetime.utcnow{%- endif %}
    )
    {%- endfor %}

    {%- for relation in model.relations | default([]) %}
    {%- if relation.type == 'ManyToMany' %}
    # Many-to-Many relationship with {{ relation.target }}
    {{ relation.through }} = Table(
        '{{ relation.through }}',
        Base.metadata,
        Column('{{ model.name | lower }}_id', ForeignKey('{{ model.tableName }}.id'), primary_key=True),
        Column('{{ relation.target | lower }}_id', ForeignKey('{{ relation.target | lower }}s.id'), primary_key=True)
    )
    {{ relation.target | lower }}s = relationship("{{ relation.target }}", secondary={{ relation.through }}, back_populates="{{ model.name | lower }}s")
    {%- endif %}
    {%- endfor %}

    def __repr__(self):
        return f"<{{ model.name }}(id={self.id})>"
```

#### 前端列表页模板 (templates/frontend/modules/list.vue.j2)

```vue
<template>
  <div class="{{ page.name | kebab_case }}-list">
    <!-- 搜索表单 -->
    <SearchForm
      :model="searchForm"
      @search="handleSearch"
      @reset="handleReset"
    />

    <!-- 数据表格 -->
    <el-table :data="tableData" v-loading="loading">
      {%- for field in model.listFields %}
      <el-table-column prop="{{ field.name }}" label="{{ field.label }}" />
      {%- endfor %}

      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button type="primary" link @click="handleView(row)">详情</el-button>
          <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
          <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <Pagination
      :current-page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      @change="handlePageChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { get{{ model.name }}List, delete{{ model.name }} } from '@/api/modules/{{ model.name | lower }}'
import SearchForm from './components/SearchForm.vue'
import Pagination from '@/components/common/Pagination.vue'
import type { {{ model.name }} } from './types'

// 状态
const loading = ref(false)
const tableData = ref<{{ model.name}}[]>([])
const searchForm = ref<Record<string, any>>({})
const pagination = ref({
  page: 1,
  pageSize: 10,
  total: 0
})

// 方法
const fetchData = async () => {
  loading.value = true
  try {
    const res = await get{{ model.name }}List({
      ...searchForm.value,
      ...pagination.value
    })
    tableData.value = res.data.items
    pagination.value.total = res.data.total
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.value.page = 1
  fetchData()
}

const handleDelete = async (row: {{ model.name }}) => {
  await ElMessageBox.confirm('确认删除该记录？', '提示')
  await delete{{ model.name }}(row.id)
  ElMessage.success('删除成功')
  fetchData()
}

onMounted(() => {
  fetchData()
})
</script>
```

---

## 7. 插件接口规范

### 7.1 插件元数据 (plugin.json)

```json
{
  "name": "pdd-scaffold",
  "version": "1.0.0",
  "description": "Python FastAPI + Vue3 项目脚手架生成器",
  "main": "index.js",
  "pdd": ">=3.0.0",
  "hooks": ["post-generate"],
  "permissions": {
    "filesystem": { "allowRead": true, "allowWrite": true },
    "network": false,
    "execution": { "allowSpawn": ["python", "node"] }
  },
  "commands": [
    { "name": "scaffold:init", "description": "初始化新项目" },
    { "name": "scaffold:generate", "description": "基于规格生成代码" },
    { "name": "scaffold:list-templates", "description": "列出可用模板" }
  ],
  "templates": {
    "backend": "fastapi-vue3",
    "frontend": "vue3-element-plus",
    "infra": "docker-mysql"
  }
}
```

### 7.2 插件入口 (index.js)

```javascript
import { PluginBase } from 'pdd-skills/lib/plugin/plugin-sdk.js';
import { SpecParser } from './core/spec-parser.js';
import { TemplateEngine } from './core/template-engine.js';
import { BackendGenerator } from './generators/backend-generator.js';
import { FrontendGenerator } from './generators/frontend-generator.js';
import { InfraGenerator } from './generators/infra-generator.js';

export default class ScaffoldPlugin extends PluginBase {
  constructor() {
    super();
    this.specParser = null;
    this.templateEngine = null;
  }

  async onActivate(context) {
    context.logger.info('🏗️ PDD-Scaffold 插件已激活');
    
    // 注册 Hook 处理器
    this.registerHook('post-generate', this.handlePostGenerate.bind(this));
    
    // 初始化核心组件
    this.specParser = new SpecParser();
    this.templateEngine = new TemplateEngine({
      templateDir: this.resolvePath('./templates')
    });
    
    // 注册自定义命令
    this.registerCommand('scaffold:init', {
      description: '初始化新项目',
      options: [
        { flags: '-d, --description <desc>', description: '项目描述' },
        { flags: '-a, --author <name>', description: '作者名称' },
        { flags: '--no-auth', description: '不包含认证模块' },
        { flags: '--no-docker', description: '不生成 Docker 配置' }
      ],
      handler: this.handleInit.bind(this)
    });
    
    this.registerCommand('scaffold:generate', {
      description: '基于规格生成代码',
      options: [
        { flags: '--spec <path>', description: '规格文档路径', required: true },
        { flags: '--target <dir>', description: '输出目录', required: true },
        { flags: '--module <type>', description: '仅生成指定模块' },
        { flags: '--dry-run', description: '预览模式' }
      ],
      handler: this.handleGenerate.bind(this)
    });

    this.registerCommand('scaffold:list-templates', {
      description: '列出可用模板',
      handler: this.handleListTemplates.bind(this)
    });
  }

  /**
   * 处理 post-generate Hook
   * 当 PDD 生成规格文档后自动触发
   */
  async handlePostGenerate(data) {
    const { specPath, outputPath } = data;
    this.context.logger.info(`📝 开始解析规格: ${specPath}`);
    
    const spec = await this.specParser.parse(specPath);
    
    this.context.logger.info(`📊 解析完成:`);
    this.context.logger.info(`   - 数据模型: ${spec.models.length} 个`);
    this.context.logger.info(`   - API 端点: ${spec.apis.length} 个`);
    this.context.logger.info(`   - 前端页面: ${spec.pages.length} 个`);
    
    const backendGen = new BackendGenerator(this.templateEngine);
    await backendGen.generate(spec, `${outputPath}/backend`);
    
    const frontendGen = new FrontendGenerator(this.templateEngine);
    await frontendGen.generate(spec, `${outputPath}/frontend`);
    
    const infraGen = new InfraGenerator(this.templateEngine);
    await infraGen.generate(spec, outputPath);
    
    this.context.logger.info('✅ 脚手架生成完成!');
  }

  /**
   * 处理 scaffold:init 命令
   */
  async handleInit(args, context) {
    const projectName = args[0];
    
    context.logger.info(`🏗️ 初始化项目: ${projectName}`);
    
    // 1. 交互式收集配置
    const config = await this.collectConfig(projectName, args);
    
    // 2. 保存配置
    await this.saveConfig(config, `${projectName}/.pdd-scaffold/config.yaml`);
    
    // 3. 生成项目骨架
    await this.generateSkeleton(config, projectName);
    
    context.logger.info(`🎉 项目 ${projectName} 初始化完成!`);
  }

  /**
   * 处理 scaffold:generate 命令
   */
  async handleGenerate(args, context) {
    const { spec, target, module, dryRun } = args;
    
    const parsedSpec = await this.specParser.parse(spec);
    
    if (dryRun) {
      return this.previewGeneration(parsedSpec, target);
    }
    
    const generators = this.selectGenerators(module);
    
    for (const gen of generators) {
      await gen.generate(parsedSpec, target);
    }
  }
}
```

### 7.3 规格解析结果结构

```javascript
// Spec Parser 输出的 JSON 结构
{
  "featureId": "FP-USER-001",
  "featureName": "用户管理模块",
  
  "models": [
    {
      "name": "User",
      "tableName": "users",
      "fields": [
        { "name": "id", "type": "Integer", "primaryKey": true, "autoIncrement": true },
        { "name": "username", "type": "String", "length": 50, "unique": true, "nullable": false },
        { "name": "email", "type": "String", "length": 100, "unique": true, "nullable": false },
        { "name": "password_hash", "type": "String", "length": 255, "nullable": false },
        { "name": "is_active", "type": "Boolean", "defaultValue": true },
        { "name": "created_at", "type": "DateTime", "autoNow": true }
      ],
      "relations": [
        { "type": "ManyToMany", "target": "Role", "through": "user_roles" }
      ],
      "listFields": ["id", "username", "email", "is_active", "created_at"]
    }
  ],
  
  "apis": [
    {
      "method": "POST",
      "path": "/api/v1/users",
      "operation": "create",
      "model": "User",
      "requestSchema": "UserCreateSchema",
      "responseSchema": "UserResponse",
      "permission": "admin"
    },
    {
      "method": "GET",
      "path": "/api/v1/users",
      "operation": "list",
      "model": "User",
      "pagination": true,
      "filters": ["keyword"],
      "permission": "authenticated"
    }
  ],
  
  "pages": [
    {
      "path": "/users",
      "component": "UserList.vue",
      "type": "list",
      "features": ["table", "search", "pagination", "batch-actions"]
    },
    {
      "path": "/users/create",
      "component": "UserForm.vue",
      "type": "form",
      "features": ["validation", "submit"]
    }
  ]
}
```

---

## 8. 工程化配置

### 8.1 Docker Compose 编排

```yaml
# docker-compose.yml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: mysql+pymysql://${DB_USER}:${DB_PASSWORD}@mysql:3306/${DB_NAME}
      JWT_SECRET: ${JWT_SECRET}
      APP_ENV: development
    depends_on:
      mysql:
        condition: service_healthy
    volumes:
      - ./backend:/app
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - backend

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - frontend
      - backend

volumes:
  mysql_data:
```

### 8.2 GitHub Actions CI/CD

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: test
          MYSQL_DATABASE: test_db
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r backend/requirements-dev.txt
      - run: cd backend && pytest tests/ -v --cov=app --cov-report=xml
      - uses: codecov/codecov-action@v3
        with:
          file: backend/coverage.xml

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint
      - run: cd frontend && npm run typecheck
      - run: cd frontend && npm run test:unit -- --coverage

  build-and-push:
    needs: [test-backend, test-frontend]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and push Docker images
        run: |
          docker build -t my-app-backend:${{ github.sha }} ./backend
          docker build -t my-app-frontend:${{ github.sha }} ./frontend
      - name: Deploy to staging
        run: echo "部署到测试环境..."
```

### 8.3 Nginx 配置

```nginx
# nginx/default.conf
upstream backend {
    server backend:8000;
}

server {
    listen 80;
    server_name localhost;

    # 前端静态资源
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API 文档
    location /docs {
        proxy_pass http://backend/docs;
    }

    location /openapi.json {
        proxy_pass http://backend/openapi.json;
    }
}
```

### 8.4 环境变量模板

```bash
# .env.example
# ===== 应用配置 =====
APP_NAME=my-app
APP_ENV=development
DEBUG=true

# ===== 数据库配置 =====
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=my_app_db

# ===== JWT 配置 =====
JWT_SECRET=your_jwt_secret_here_change_in_production
JWT_ALGORITHM=HS256
TOKEN_EXPIRE_HOURS=24

# ===== Redis 配置 (可选) =====
REDIS_URL=redis://localhost:6379/0
```

---

## 9. 实现计划

### 9.1 开发阶段

| 阶段 | 内容 | 预计工作量 |
|------|------|-----------|
| **Phase 1** | 插件框架搭建 + Spec Parser | 2 天 |
| **Phase 2** | 模板引擎封装 + 基础模板 | 3 天 |
| **Phase 3** | 后端代码生成器 | 2 天 |
| **Phase 4** | 前端代码生成器 | 2 天 |
| **Phase 5** | 基础设施生成器 + 工程化配置 | 1 天 |
| **Phase 6** | 测试 + 文档 + 发布 | 1 天 |
| **合计** | | **11 天** |

### 9.2 里程碑

- **M1**: 插件可加载，`pdd scaffold:init` 可运行
- **M2**: 完整的 FastAPI 后端模板 + CRUD 生成
- **M3**: 完整的 Vue3 前端模板 + 页面生成
- **M4**: Docker + CI/CD 配置生成
- **M5**: 发布 v1.0.0

### 9.3 技术风险与应对

| 风险 | 影响 | 应对策略 |
|------|------|----------|
| Jinja2 在 Node.js 中运行 | 需要子进程调用 | 使用 `python-shell` 或考虑换用 Nunjucks |
| 规格文档格式变化 | 解析失败 | 定义严格的 Schema，提供校验工具 |
| 模板复杂度失控 | 维护困难 | 分层设计，每层职责单一 |
| 生成代码质量 | 不符合最佳实践 | 大量预置最佳实践模板 |

---

## 附录

### A. 命令速查

```bash
# 初始化项目
pdd scaffold:init my-project [options]

# 基于规格生成代码
pdd scaffold:generate --spec ./specs/spec.md --target ./output

# 预览生成内容
pdd scaffold:generate --spec ./specs/spec.md --target ./output --dry-run

# 列出可用模板
pdd scaffold:list-templates

# 查看 PDD 版本
pdd version
```

### B. 文件命名约定

| 类型 | 格式 | 示例 |
|------|------|------|
| 模板文件 | `{name}.j2` | `model.py.j2` |
| 生成的 Python | `{name}.py` | `user.py` |
| 生成的 Vue | `{Name}.vue` | `UserList.vue` |
| 生成的 TS | `{name}.ts` | `user.ts` |
| 配置文件 | `{name}.yaml` | `config.yaml` |

### C. 参考资料

- [FastAPI 官方文档](https://fastapi.tiangolo.com/)
- [Vue 3 官方文档](https://cn.vuejs.org/)
- [Element Plus 组件库](https://element-plus.org/)
- [SQLAlchemy 文档](https://docs.sqlalchemy.org/)
- [PDD-Skills 文档](https://github.com/pdd-skills/pdd-skills)

---

**文档版本**: v1.0.0  
**最后更新**: 2026-04-12  
**作者**: AI Assistant (Brainstorming Session)
