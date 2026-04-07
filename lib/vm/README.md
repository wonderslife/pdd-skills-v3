# PDD Visual Manager (PDD-VM)

PDD-Skills v3 的可视化监控扩展模块。

## 快速开始

```bash
# Web Dashboard
pdd dashboard          # 启动 http://localhost:3001
pdd dashboard -p 8080  # 指定端口
pdd dashboard --no-browser  # 不打开浏览器

# Terminal TUI
pdd tui                # 启动终端界面
pdd tui -r 10          # 10秒刷新间隔

# 状态查询
pdd vm status          # 项目状态摘要
pdd vm features        # 功能点列表
pdd vm export --format csv  # 导出数据
```

## 视图说明

### Web Dashboard (4个面板)
1. **流水线总览** - PRD→Done 六阶段可视化 + 进度环 + 汇总卡
2. **看板视图** - 6列看板 + Feature详情Modal + 筛选搜索排序
3. **质量监控** - 五维雷达图 + 评分分布 + Token仪表盘 + 缓存效率 + 迭代曲线
4. **系统管理** - 服务状态 + 资产浏览器 + 操作按钮 + 日志流

### Terminal TUI (4个屏幕)
1. **Overview** - 项目概览 + Pipeline + 指标卡 + 最近活动
2. **Kanban** - 6列紧凑看板 + 键盘导航 + Detail Overlay
3. **Quality** - Token/缓存/质量矩阵/Top Issues
4. **System** - 服务状态 + 资产目录 + 操作菜单

TUI 快捷键:
| 按键 | 功能 |
|------|------|
| Tab / Shift+Tab | 切换屏幕 |
| q / Ctrl+C | 退出 |
| r | 手动刷新 |
| p | 暂停/恢复刷新 |
| j/k 或 ↑/↓ | 选择功能点 |
| Enter | 查看详情 |
| Esc | 返回/关闭详情 |
| / | 搜索 |
| ? | 帮助 |
| 1-4 | 直接跳转屏幕 |

## 配置选项

可通过 pdd config 管理:
- `vm.port` - Dashboard 端口 (默认 3001)
- `vm.refreshInterval` - Dashboard 刷新间隔秒数 (默认 30)
- `vm.theme` - 主题 light/dark (默认 light)
- `vm.autoOpen` - 是否自动打开浏览器 (默认 true)
- `vm.tuiRefreshInterval` - TUI 刷新间隔秒数 (默认 5)

## 架构

```
lib/vm/
├── models.js           # 数据模型 (Feature/StageEnum/QualityMetrics...)
├── state-schema.js     # JSON Schema + 校验 + 迁移
├── state-store.js      # 状态文件原子读写 + 备份
├── scanner.js          # 文件系统扫描引擎
├── reconciler.js       # 三路数据合并 + 孤儿检测
├── hooks/              # 命令 Hook 系统
│   ├── hook-interface.js
│   ├── generate-hook.js
│   ├── verify-hook.js
│   ├── extract-hook.js
│   └── report-hook.js
├── data-provider.js    # 数据聚合层 + 引擎桥接 + 导出
├── event-bus.js        # 事件总线 (EventEmitter + SSE订阅源)
├── dashboard/          # Web Dashboard
│   ├── server.js       # HTTP+SSE 服务
│   ├── sse.js          # SSE 推送管理
│   ├── api-routes.js   # REST API (11端点)
│   └── static/         # 纯原生前端
│       ├── index.html
│       ├── css/dashboard.css
│       └── js/         # app/pipeline/kanban/quality/system/charts
└── tui/               # Terminal TUI
    ├── tui.js          # 主控制器
    ├── renderer.js     # ANSI 渲染引擎
    ├── input.js        # 键盘输入处理
    ├── components/     # 进度条/表格/火花线/状态灯/卡片
    └── screens/        # overview/kanban/quality/system
```

## 技术特性

- 零外部依赖 (纯 Node.js 内置模块 + 原生 HTML/CSS/JS)
- ESM 模块化 (import/export)
- 双形态产品 (Web Dashboard + Terminal TUI)
- 混合数据采集 (Hook自动记录 + 文件扫描补全 + SSE实时推送)
- 亮色/暗色双主题
- 响应式设计 (375px ~ 1440px+)
- 完整键盘导航 (TUI)
- 多格式导出 (JSON/Markdown/CSV)
