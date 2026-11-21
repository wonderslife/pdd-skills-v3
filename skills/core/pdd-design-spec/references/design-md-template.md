# DESIGN.md 完整模板（界面设计规范）

> 由 `pdd-design-spec` 技能生成时使用。本文件是**可复制的完整骨架**，含 front matter 与 12 章正文。
> 生成时按项目实际替换 `<>` 占位；无内容的章节标注"本项目不适用"而非删除（删除会让人以为漏了）。

---

## 使用说明

1. 复制下方代码块全文到 `项目根/ui/DESIGN.md`
2. 替换 front matter 中的颜色/字体/间距
3. 逐章替换正文
4. 跑 `audit-checklist.md` 的 12 项自检

**三个不要**：
- 不要把 PRD 第4章逐页复制进来
- 不要保留任何未替换的 `<>`
- 不要裸写 hex（正文示例除外），组件定义一律用 `{colors.x}`

---

## 模板全文

```markdown
---
version: 0.1
name: <项目名> Design System
description: <一句话说清性格。例：以信息密度为第一优先的编辑生产工具，前台报纸感、后台仪表感；近黑画布，单一蓝色强调，业务状态色独立成体系>

# ─────────────────────────────────────────────
# 1. 品牌与基础色（只做身份，不做状态）
# ─────────────────────────────────────────────
colors:
  primary: "#165DFF"          # 品牌主色：logo、选中态、主按钮
  primary-hover: "#4080FF"
  primary-active: "#0E42D2"
  primary-light: "#E8F3FF"    # 浅底：选中行、tag 背景
  on-primary: "#FFFFFF"

# ─────────────────────────────────────────────
# 2. 业务状态色（与品牌色严格隔离，一色一义）
#    每个状态必须同时具备：色 + 图标 + 文案
# ─────────────────────────────────────────────
  state-draft: "#86909C"        # 草稿      ○
  state-pending: "#FF7D00"      # 待处理    ◔
  state-reviewing: "#165DFF"    # 进行中    ◑
  state-approved: "#00B42A"     # 已通过    ✓
  state-rejected: "#F53F3F"     # 已驳回    ✕
  state-published: "#237804"    # 已发布    ●
  state-withdrawn: "#4E5969"    # 已撤回    ⊘
  state-failed: "#CB2634"       # 执行失败  ⚠
  state-disabled: "#C9CDD4"     # 已停用    —

# ─────────────────────────────────────────────
# 3. 实时态（独立命名空间，禁止与状态色混用）
# ─────────────────────────────────────────────
  live: "#E8352D"               # 直播/正在发生
  live-bg: "#FFF1F0"

# ─────────────────────────────────────────────
# 4. 表面阶梯（后台多层容器嵌套用）
# ─────────────────────────────────────────────
  canvas: "#F7F8FA"             # 页面底
  surface-1: "#FFFFFF"          # 卡片/表格
  surface-2: "#F2F3F5"          # 次级区块
  surface-3: "#FFFFFF"          # 抽屉/弹层
  surface-inverse: "#1D2129"    # 反色块（大屏/侧边栏）

# ─────────────────────────────────────────────
# 5. 描边（三级够用，不要更多）
# ─────────────────────────────────────────────
  hairline: "#E5E6EB"           # 常规分隔线
  hairline-strong: "#C9CDD4"    # 强调边框、输入框
  hairline-focus: "#165DFF"     # 聚焦环

# ─────────────────────────────────────────────
# 6. 文字
# ─────────────────────────────────────────────
  ink: "#1D2129"                # 主文字、标题
  ink-body: "#4E5969"           # 正文
  ink-subtle: "#86909C"         # 次要、说明
  ink-tertiary: "#C9CDD4"       # 占位符、禁用文字
  ink-inverse: "#FFFFFF"

typography:
  # 字体族：中文优先，数字必须等宽（表格对齐）
  font-sans: "PingFang SC, Microsoft YaHei, Source Han Sans SC, -apple-system, sans-serif"
  font-mono: "JetBrains Mono, SFMono-Regular, Consolas, monospace"
  font-number: "tabular-nums"     # 所有数字列必须启用

  display-lg:   { size: 28px, weight: 600, lineHeight: 1.4 }
  title-lg:     { size: 20px, weight: 600, lineHeight: 1.4 }
  title-md:     { size: 16px, weight: 600, lineHeight: 1.5 }
  body-md:      { size: 14px, weight: 400, lineHeight: 1.6 }   # 后台正文基准
  body-sm:      { size: 13px, weight: 400, lineHeight: 1.5 }
  label:        { size: 14px, weight: 500, lineHeight: 1.4 }   # 表单标签
  caption:      { size: 12px, weight: 400, lineHeight: 1.4 }   # 时间戳、辅助
  table-head:   { size: 14px, weight: 600, lineHeight: 1.4 }
  mono-tag:     { size: 12px, weight: 500, lineHeight: 1.2 }   # ID/时间戳/渠道码

spacing:
  # 4px 基准。后台不用 8px 基准——太粗，做不出紧凑布局
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  xxl: 24px
  xxxl: 32px

rounded:
  xs: 2px       # 标签、徽标
  sm: 4px       # 输入框、按钮（后台基准）
  md: 6px       # 卡片
  lg: 8px       # 弹层、抽屉
  full: 9999px  # 头像、胶囊

# ─────────────────────────────────────────────
# 7. 数据密度（后台项目必填，全部是可测数字）
# ─────────────────────────────────────────────
density:
  table-row-height: 40px          # default；compact 模式 32px
  table-header-height: 44px
  table-cell-padding: "8px 12px"
  table-min-rows-per-screen: 15   # 1080p 下不含分页
  table-column-min-width: 100px
  table-action-column-width: 140px  # 固定右侧
  toolbar-height: 48px
  form-label-width: 100px
  form-item-gap: 20px
  page-padding: 16px
  page-default-size: 20           # 分页默认条数
  page-size-options: [10, 20, 50, 100]
  text-truncate-lines: 1          # 表格内单行，hover 出 tooltip

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: "5px 16px"
    typography: "{typography.body-md}"
  button-secondary:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink-body}"
    borderColor: "{colors.hairline-strong}"
    rounded: "{rounded.sm}"
  button-danger:
    backgroundColor: "{colors.state-rejected}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
  button-text:
    textColor: "{colors.primary}"
    padding: "0 4px"
  status-tag:
    rounded: "{rounded.xs}"
    typography: "{typography.caption}"
    padding: "1px 8px"
  data-table:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink-body}"
    headerBackground: "{colors.surface-2}"
    headerTypography: "{typography.table-head}"
    rowBorder: "{colors.hairline}"
  filter-bar:
    backgroundColor: "{colors.surface-1}"
    padding: "{spacing.md} {spacing.lg}"
    rounded: "{rounded.md}"
  detail-panel:
    backgroundColor: "{colors.surface-1}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  drawer:
    backgroundColor: "{colors.surface-3}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xxl}"
  timeline-item:
    textColor: "{colors.ink-body}"
    railColor: "{colors.hairline}"
    dotColor: "{colors.primary}"
  empty-state:
    textColor: "{colors.ink-subtle}"
    padding: "{spacing.xxxl}"
  live-badge:
    textColor: "{colors.live}"
    backgroundColor: "{colors.live-bg}"
    typography: "{typography.mono-tag}"
    rounded: "{rounded.xs}"
  breaking-band:
    backgroundColor: "{colors.live}"
    textColor: "{colors.on-primary}"
    typography: "{typography.title-md}"
---

## 1. 视觉主题与气质

<200-400 字。回答三个问题：这是什么工具？给谁用？一整天用下来应该是什么感受？
例：这是一个编辑生产工具，不是营销官网。使用者一天要处理 200 条稿件，所以密度优先于呼吸感。
页面底色用浅灰而非纯白，让白色卡片浮起来；不用阴影做层级，用底色差和 1px 描边。>

**关键特征**（5-7 条，每条一句，可判定）：
- <例：页面底色 canvas 与卡片 surface-1 形成唯一层级差，全局不使用投影>
- <例：品牌蓝只出现在主按钮、选中态、链接，绝不用于任何状态标记>
- <例：所有状态标记 = 色块 + 图标 + 文案，缺一不可>

## 2. 颜色与角色

### 品牌色
| Token | 值 | 允许用在哪 | 禁止用在哪 |
|-------|----|-----------|-----------|
| `{colors.primary}` | #165DFF | 主按钮、选中态、链接、聚焦环 | 状态标签、图表任意系列、大面积背景 |

### 业务状态色
| 状态 | Token | 图标 | 文案 | 可编辑 | 谁可操作 |
|------|-------|------|------|--------|---------|
| <草稿> | `{colors.state-draft}` | ○ | 草稿 | 是 | 创建人 |

### 实时态
<若有直播/实时场景，在此声明 live 的独占性；无则写"本项目不适用">

### 表面与描边
<三级描边的使用边界：什么时候用 hairline，什么时候必须用 hairline-strong>

### 语义禁区
<明确列出"什么颜色绝不可以表示什么"。这一节比色板本身更重要>

## 3. 字体规则

### 字体族
<中文优先栈 + 等宽数字声明>

### 层级表
| Token | 字号 | 字重 | 行高 | 用途 |
|-------|------|------|------|------|

### 原则
- <例：表格内所有数字列启用 tabular-nums，否则小数点不对齐>
- <例：后台正文基准 14px，不用 16px——16px 会让一屏少 3 行>
- <例：标题与正文的字重差必须是 200（400 vs 600），不要用 500 vs 600>

## 4. 组件规范

> **每个组件必须写全 8 态**：rest / hover / active / focus / disabled / loading / error / 无权限。
> 缺任何一态，实现者就会自己发明一个。

### 按钮
| 类型 | 用途 | rest | hover | active | disabled |
|------|------|------|-------|--------|----------|
| primary | 一屏最多 1 个 | | | | |
| secondary | 常规操作 | | | | |
| danger | 删除/驳回/撤回 | | | | |
| text | 表格行内操作 | | | | |

**按钮层级规则**：
- 一个页面主操作 ≤ 1 个
- 表格操作列 ≤ 3 个文字按钮，超出收进"更多"
- 危险操作必须二次确认，且确认按钮为 danger 色

### 表格
<列定义策略、固定列、截断、排序、批量选择、空数据、加载骨架>

### 表单
<标签位置（右对齐/上对齐）、必填标记、校验时机（失焦 vs 提交）、错误文案位置、字段宽度策略>

### 状态标签
<色块 + 图标 + 文案的三段式结构，给出 HTML 结构示意>

### 空态 / 加载 / 错误
| 场景 | 表现 | 文案规范 |
|------|------|---------|
| 首次无数据 | 插画 + 一句话 + 主操作按钮 | "还没有<对象>，<引导动作>" |
| 筛选无结果 | 无插画，仅文字 + 清除筛选 | "没有符合条件的<对象>" |
| 加载中 | 骨架屏（列表用行骨架，不用转圈） | — |
| 加载失败 | 错误图标 + 原因 + 重试按钮 | "加载失败，<原因>，请重试" |

### 权限不足态
<隐藏 / 置灰 / 可见但点击提示——三选一并写死，不允许各模块自选>

## 5. 布局原则

### 间距系统
<4px 基准，列出各场景取值>

### 页面骨架
<列出归纳出的布局类型：列表页 / 表单页 / 详情页 / 看板页 / 配置页，每种给出结构描述>

### 栅格与容器
<最大宽度、栅格列数、断点>

### 留白哲学
<后台：留白是奢侈品，用底色和描边分隔，不用空白分隔>

## 6. 层级与深度

| 层级 | 表现 | 用在哪 |
|------|------|--------|
| L0 页面底 | `{colors.canvas}` | 全屏背景 |
| L1 卡片 | `{colors.surface-1}` + 1px 描边 | 表格、表单、详情块 |
| L2 浮层 | `{colors.surface-3}` + 投影 | 下拉、气泡、Popover |
| L3 抽屉/弹窗 | `{colors.surface-3}` + 遮罩 | 编辑抽屉、确认弹窗 |

**投影规则**：<只在 L2/L3 使用，L0/L1 禁止投影。给出具体投影值>

## 7. 数据密度

> 全部写成数字，禁止"紧凑/宽松"。

| 指标 | default | compact | 说明 |
|------|---------|---------|------|
| 表格行高 | 40px | 32px | |
| 一屏行数（1080p） | ≥15 | ≥20 | 不含分页栏 |
| 分页默认条数 | 20 | 50 | |
| 操作列宽度 | 140px | 120px | 固定右侧 |
| 文本截断 | 单行 + tooltip | 单行 + tooltip | |

**密度切换规则**：<用户可切 or 按页面类型固定？写死>

## 8. Do's and Don'ts

> 每条必须**可判定**。"要美观"不可判定，"禁止用 primary 填充状态标签"可判定。

### Do
- <例：状态标记必须 = 颜色 + 图标 + 文案三段式>
- <例：所有数字列启用 tabular-nums>
- <例：表格操作列固定右侧，≤3 个按钮>

### Don't
- <例：禁止用 primary 表示任何业务状态>
- <例：禁止在 L0/L1 使用投影>
- <例：禁止把 16px 作为后台正文基准>
- <例：禁止同一页面出现两个 primary 按钮>

## 9. 响应式与多端差异

### 断点
| 名称 | 宽度 | 关键变化 |
|------|------|---------|
| Desktop | ≥1440px | 完整侧边栏 + 内容区 |
| Laptop | 1024-1439px | 侧边栏折叠为图标 |
| Tablet | 768-1023px | 侧边栏抽屉化，表格横向滚动 |
| Mobile | <768px | 单列，表格转卡片列表 |

### 多端差异矩阵
| 组件 | PC 后台 | 移动端 | 大屏 |
|------|---------|--------|------|
| 表格 | 完整列 | 转卡片列表 | 只读大字号 |
| 操作按钮 | 行内文字按钮 | 底部固定操作栏 | 隐藏 |

## 10. 内容模型与模板映射

> 若项目有"不同类型的内容用不同字段/模板"的场景（CMS、稿件、商品、工单），必填本章。

| 内容类型 | 必填字段 | 专属字段 | 列表列 | 详情模板 |
|---------|---------|---------|--------|---------|

## 11. 组件库映射（技术栈相关）

> 技术栈为 RuoYi / Vue3 时必填。目的是让实现者知道"设计 token 怎么落到 Element Plus 变量上"。

```css
:root {
  --el-color-primary: <primary>;
  --el-color-success: <state-approved>;
  --el-color-warning: <state-pending>;
  --el-color-danger: <state-rejected>;
  --el-color-error: <state-failed>;
  --el-color-info: <state-draft>;
  --el-border-radius-base: <rounded.sm>;
  --el-font-size-base: <body-md.size>;
  --el-text-color-primary: <ink>;
  --el-text-color-regular: <ink-body>;
  --el-text-color-secondary: <ink-subtle>;
  --el-border-color: <hairline>;
  --el-border-color-light: <hairline>;
  --el-fill-color-blank: <surface-1>;
  --el-bg-color-page: <canvas>;
}
```

| 设计概念 | Element Plus 实现 | 注意 |
|---------|------------------|------|
| 状态标签 | `el-tag` + 自定义 color + 前置图标 | 不用 type 的默认红绿黄 |
| 数据表格 | `el-table` size=default | 行高由 cell padding 控制 |
| 表单 | `el-form` label-width=100px | 校验 trigger 统一 blur |
| 抽屉 | `el-drawer` size=40% | |
| 空态 | `el-empty` + 自定义文案 | 禁用默认图 |

## 12. Agent Prompt Guide

### 速查色板
- 主按钮：`primary` #165DFF
- 页面底：`canvas` #F7F8FA
- 卡片：`surface-1` #FFFFFF
- 主文字：`ink` #1D2129
- 正文：`ink-body` #4E5969
- 次要：`ink-subtle` #86909C
- 分隔线：`hairline` #E5E6EB

### 现成 Prompt
1. *"生成一个<列表页>：页面底 `{colors.canvas}`，顶部筛选条 `{colors.surface-1}` + `{rounded.md}`，表格行高 40px、表头 44px、操作列固定右侧 140px。状态列用三段式标签（色块+图标+文案），不用 el-tag 默认色。"*
2. *"生成一个<表单抽屉>：宽 40%，标题 20px/600，表单项标签右对齐 100px，间距 20px，主按钮在右下，取消在左。字段校验统一失焦触发。"*

### 迭代审计清单
> 生成或修改任何页面前后，逐条对照 `references/audit-checklist.md` 的 12 项。
```

---

## 生成后必查

- [ ] front matter 是合法 YAML（`node -e "require('js-yaml')"` 或在线校验）
- [ ] 所有 `<...>` 占位已替换
- [ ] 状态色数量与实际业务状态数一致
- [ ] 密度数字与目标分辨率匹配
- [ ] 组件清单覆盖 PRD 第4章出现过的全部组件类型
- [ ] 无裸 hex（正文举例除外）
