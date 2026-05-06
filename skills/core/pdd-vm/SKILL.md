---
name: pdd-vm
description: "PDD Visual Manager 可视化监控技能。当用户需要查看项目状态、启动Dashboard、使用TUI终端界面、监控流水线进度、查看质量评分、导出项目数据时自动触发。支持中文触发：可视化监控、Dashboard、看板、TUI、项目状态、流水线、质量评分、pdd vm。"
license: MIT
compatibility: PDD-Skills v3.0+ 项目
metadata:
  author: "PDD Team"
  version: "1.0"
  triggers:
    - "/vm" | "/dashboard" | "/tui"
    - "可视化监控" | "Dashboard" | "看板" | "TUI"
    - "项目状态" | "流水线" | "质量评分" | "pdd vm"
    - "Web Dashboard" | "Terminal TUI" | "SSE"
---

# PDD Visual Manager / PDD 可视化监控

## 1. 技能概述 / Overview

### 🇨🇳 定位

PDD Visual Manager (PDD-VM) 提供双形态可视化监控能力，用于监控使用 PDD 方法开发的业务项目的运行状态。

**双形态架构**:
- **Web Dashboard**: 基于 HTML/CSS/JS 的零依赖 SPA，通过浏览器实时查看项目状态
- **Terminal TUI**: 基于 Node.js ANSI 的终端 UI，适合 SSH 远程场景

**核心能力**:
- Pipeline 流水线视图 — 展示 PDD 开发流水线各阶段状态和进度
- Kanban 看板视图 — 以看板形式展示功能点的开发状态
- Quality 质量视图 — 多维度展示代码质量指标（五维评分雷达图）
- System 系统视图 — 监控系统运行状态和资源使用
- SSE 实时推送 — Server-Sent Events 实时数据更新
- 数据导出 — 支持 CSV/JSON 格式导出

### 🇺🇸 Positioning

PDD Visual Manager provides dual-form visualization monitoring for PDD-driven business projects, offering both Web Dashboard and Terminal TUI interfaces.

## 2. CLI 命令 / CLI Commands

### Web Dashboard

```bash
pdd dashboard                    # 启动 Dashboard (默认 http://localhost:3001)
pdd dashboard -p 8080            # 自定义端口
pdd dashboard --no-open          # 不自动打开浏览器
```

### Terminal TUI

```bash
pdd tui                          # 启动 TUI
pdd tui --refresh 3              # 自定义刷新间隔(秒)
```

### VM 数据查询

```bash
pdd vm status                    # 项目状态摘要 (JSON 格式)
pdd vm features                  # 功能点列表 (含状态)
pdd vm features --status done    # 筛选已完成功能点
pdd vm export --format csv       # 导出为 CSV
pdd vm export --format json      # 导出为 JSON
pdd vm export -o report.csv      # 导出到指定文件
```

## 3. TUI 快捷键 / TUI Keyboard Shortcuts

| 按键 | 功能 | 适用场景 |
|------|------|----------|
| `Tab` | 切换到下一个屏幕 | 所有屏幕 |
| `q` / `Ctrl+C` | 退出 TUI | 所有屏幕 |
| `r` / `F5` | 强制刷新当前屏幕 | 所有屏幕 |
| `p` | 暂停/恢复自动刷新 | 所有屏幕 |
| `j` / `↓` | 向下选择 | 列表/表格 |
| `k` / `↑` | 向上选择 | 列表/表格 |
| `Enter` | 查看选中项详情 | 列表/表格 |
| `Esc` | 返回上一级 | 详情 overlay |
| `?` | 显示帮助信息 | 所有屏幕 |
| `1`-`4` | 直接跳转到指定屏幕 | 所有屏幕 |

## 4. 数据模型 / Data Model

```
Project (业务项目)
├── metadata (元数据: name, version, createdAt, updatedAt)
├── features (功能点列表: id, name, status, priority, metrics)
├── pipeline (流水线状态: phase, progress, stages[])
├── quality (质量指标: overallScore, dimensions, rulesViolated[])
└── system (系统状态: apiStatus, cacheHitRate, tokenUsage, errors[])
```

功能点状态流转: `backlog → analysis → design → implement → review → verify → done`

## 5. 配置项 / Configuration

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| vm.port | 3001 | Dashboard 端口 |
| vm.refreshInterval | 30 | Dashboard 刷新间隔(秒) |
| vm.theme | light | 主题 light/dark |
| vm.autoOpen | true | 自动打开浏览器 |
| vm.maxSSEConnections | 100 | 最大SSE连接数 |
| vm.tuiRefreshInterval | 5 | TUI 刷新间隔(秒) |

## 6. 重要说明 / Important Notes

> PDD Visual Manager 用于可视化监控使用 PDD 方法开发的**业务项目**的运行状态，而非管理 PDD-Skills 自身的开发任务。

Web Dashboard 和 Terminal TUI 共享同一数据模型和 API 层，可根据使用场景自由切换。
