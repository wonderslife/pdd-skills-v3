# PDD-Scaffold: Python Fullstack Template

> PRD-Driven Development 全栈脚手架模板 — 基于 FastAPI + Vue3

## 快速开始

```bash
# 1. 使用 PDD CLI 初始化项目
pdd init my-project --template python-fullstack

# 2. 或手动复制
cp -r scaffolds/python-fullstack/ my-project/
cd my-project

# 3. 启动后端
cd backend
pip install -r requirements.txt
uvicorn app.main:create_app --reload --port 8000

# 4. 启动前端
cd frontend
npm install
npm run dev
```

## Docker 一键启动

```bash
docker-compose up -d
# 访问 http://localhost:3000 (前端)
# 访问 http://localhost:8000 (后端API)
```

## 项目结构

```
python-fullstack/
├── backend/                  # Python FastAPI 后端
│   ├── app/
│   │   ├── core/            # 核心模块
│   │   │   ├── auth/        # JWT + 密码认证
│   │   │   ├── data_permission/  # 数据权限引擎
│   │   │   ├── oauth/       # OAuth2 统一认证 (6平台)
│   │   │   └── workflow/    # 工作流状态机引擎
│   │   ├── models/          # SQLAlchemy ORM 模型
│   │   ├── schemas/         # Pydantic 数据校验
│   │   └── api/v1/          # REST API 端点
│   ├── pyproject.toml
│   └── requirements.txt
│
├── frontend/                 # Vue3 + Vite 前端
│   ├── src/
│   │   ├── views/           # 页面组件
│   │   ├── stores/          # Pinia 状态管理
│   │   ├── composables/     # 组合式函数 (useResponsive等)
│   │   └── api/             # Axios HTTP 客户端
│   ├── tailwind.config.js   # 响应式断点配置
│   └── postcss.config.js    # pxtorem 移动适配
│
├── Dockerfile                # 后端容器化
├── docker-compose.yml        # MySQL + Backend + Frontend
├── .github/workflows/ci.yml  # CI 流水线
├── template_config.yaml      # PDD 模板元数据
└── docs/                    # 设计文档 (4份)
```

## 核心能力

| 模块 | 说明 | 关键文件 |
|------|------|---------|
| **数据权限** | 组织级隔离 + 借调合并 | `core/data_permission/engine.py` |
| **OAuth2 SSO** | 企微/钉钉/飞书/微信/OIDC | `core/oauth/providers/*.py` |
| **工作流** | 状态机 + 会签 + 条件分支 | `core/workflow/engine.py` |
| **响应式UI** | PC/H5 自适应 6档断点 | `composables/useResponsive.ts` |

## 设计文档

1. [01-架构设计](docs/01-architecture.md) — 整体架构、目录规范、PDD集成方案
2. [02-数据权限](docs/02-data-permission.md) — ER图、SQL拦截器、借调合并策略
3. [03-工作流引擎](docs/03-workflow-engine.md) — 15状态枚举、TransitionRule、会签策略
4. [04-OAuth+移动端](docs/04-mobile-oauth.md) — 6平台Provider、PKCE、响应式方案

## 与 PDD 集成

本脚手架作为 `pdd-skills-v3` 的模板输出目标，通过 `post_generate` hook 自动调用：

```yaml
# .pdd/hooks.yaml
hooks:
  post_generate:
    - template: scaffolds/python-fullstack
      output_dir: "{{project_name}}/"
      variables:
        project_name: "{{name}}"
```
