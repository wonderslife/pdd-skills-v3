# AI Test Framework - 测试框架核心

本目录包含 AI 自动化测试框架的核心 Python 代码。

## 文件说明

| 文件 | 用途 |
|------|------|
| `testcase-ai.py` | 主执行入口，YAML 驱动的测试用例执行引擎 |
| `login_manager.py` | 登录状态管理器，智能检测/跳过/切换用户登录 |
| `.env.test` | 环境变量配置（用户名、密码、MCP 配置等） |

## 快速开始

```bash
# 1. 配置环境变量（编辑 .env.test）
vim .env.test

# 2. 执行测试用例
python testcase-ai.py ../testcases/login-flow.yaml

# 3. 查看结果
# 结果自动输出到 ../test-result/run-时间戳/
```

## 核心能力

- **YAML 驱动**: 用声明式 YAML 编写测试步骤，无需写代码
- **MCP 浏览器自动化**: 通过 Chrome DevTools MCP 控制浏览器
- **智能登录管理**: 自动检测已登录状态，支持用户切换
- **多层级错误检测**: 4 层错误识别，避免假阳性报告
- **SPA 渲染等待**: 自动检测页面渲染完成，处理新标签页切换
- **本地 LLM 集成**: 可选接入本地模型进行元素语义匹配

## 架构概览

```
tests/
├── testcase-ai.py      # 主引擎 (ActionExecutor + 断言系统)
├── login_manager.py    # 登录管理 (LoginManager)
└── .env.test           # 运行时配置
```

## 依赖

- Python 3.10+
- `mcp` 包 (Model Context Protocol 客户端)
- Chrome DevTools MCP Server (`npx chrome-devtools-mcp`)
