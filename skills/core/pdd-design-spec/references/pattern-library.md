# 可复用模式库

> 从 `awesome-design-md`（84 份真实站点设计系统分析）中提炼，剥离品牌外观，只保留**可迁移的结构性模式**。
> 每条给出：原始出处 → 原始用法 → 后台场景映射 → 实现要点 → 可抄的规则。
>
> 读法：先看"后台场景映射"判断用不用得上，再看"可抄的规则"直接落进 DESIGN.md 的 Do's。

---

## 一、实时态子系统（Live Apparatus）

**出处**：`aljazeera` — 全球新闻台的实时新闻语言

**原始用法**：把"正在发生"做成一套独立于品牌色的子系统，三个组件：

- `live-badge`：14px / 900 字重的 LIVE 标签，红底小圆角块
- `breaking-band`：整幅红色通栏 + 白字标题
- `live-strip-item`：时间轴上的红点 + 银色竖线 + 时间戳 + 正文

**后台场景映射**：
- 直播管理页的"直播中"标识
- 大屏/指挥中心的实时数据流
- 审核队列里"正在被他人审核"的锁标识

**实现要点**：

```html
<!-- 三段式：色块 + 图标 + 文案 -->
<span class="live-badge">
  <i class="dot-pulse"></i>直播中
</span>
```

```css
.live-badge {
  color: var(--live);
  background: var(--live-bg);
  border-radius: 2px;
  padding: 1px 8px;
  font-size: 12px;
  font-weight: 500;
}
.dot-pulse {
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--live);
  animation: pulse 1.6s ease-in-out infinite;
}
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
```

**可抄的规则**：
> `live` 只用于"正在发生"——徽标、通栏、时间轴点。不用它做装饰。如果不是实时，就不是 live 色。

**为什么重要**：一旦"实时红"可以随便用，"加急/置顶/驳回/失败"就全都变红，红色彻底失去信息量。这是融媒体平台最常见的色板崩坏方式。

---

## 二、栏目签名（Section Eyebrow Lockup）

**出处**：`aljazeera`

**原始用法**：一个 8px 宽的品牌色竖条 + 300 字重全大写栏目名。每个编辑栏目都以它开头。

**后台场景映射**：
- 栏目管理：每个栏目分配一个色条，前台栏目页与后台稿件归属标签**共用同一套映射**
- 详情页区块标题（"基本信息""流转记录""分发状态"）

**实现要点**：

```html
<h2 class="section-eyebrow"><span class="bar"></span>时政要闻</h2>
```
```css
.section-eyebrow {
  display: flex; align-items: center; gap: 8px;
  font-size: 16px; font-weight: 600; color: var(--ink);
}
.section-eyebrow .bar {
  width: 3px; height: 16px;
  background: var(--channel-color);  /* 按栏目取色 */
  border-radius: 2px;
}
```

**可抄的规则**：
> 每个栏目一个固定色，存在栏目表里（`channel.color`），前后台共用。新增栏目必须分配色，不允许默认色。

**价值**：成本极低、辨识度极高，而且天然可配置——一套视觉语言贯穿前后台。

---

## 三、排行榜（Ranked List）

**出处**：`aljazeera` 的 `most-popular-row` + `popular-numeral`

**原始用法**：超大号序号数字（32px / 700 / 灰色）+ 细分隔线 + 小号标题。无卡片、无阴影、纯排版。

**后台场景映射**：
- 数据看板的"热稿榜""阅读排行"
- 分发效果榜（各渠道 Top N）
- 稿件列表按优先级排序时的视觉强化

**实现要点**：

```html
<li class="rank-row">
  <span class="rank-num">01</span>
  <div class="rank-body">
    <a class="rank-title">标题…</a>
    <span class="rank-meta">12,438 阅读 · 网站</span>
  </div>
</li>
```
```css
.rank-row { display:flex; gap:12px; padding:12px 0; border-bottom:1px solid var(--hairline); }
.rank-num { font-size:24px; font-weight:700; color:var(--ink-tertiary);
            font-variant-numeric: tabular-nums; min-width:32px; }
```

**可抄的规则**：
> 排行榜用排版而非卡片。序号用等宽数字，前三名可加粗但不换色（换色会与状态色冲突）。

---

## 四、无边框卡片（Borderless Card）

**出处**：`aljazeera` 的 `news-card` —— 明确写着"无填充、无边框，靠位置和字重定义卡片"

**后台场景映射**：
- 稿库列表（信息密度极高，加卡片就少一屏）
- 任何超过 20 行的列表

**对比**：

| 做法 | 1080p 一屏 | 视觉噪音 |
|------|-----------|---------|
| 卡片列表（圆角+底色+阴影） | 5-6 条 | 高：每张卡 3 层视觉边界 |
| 分隔线列表 | 15-20 条 | 低：只有 1 条 1px 线 |

**实现要点**：列表项之间只用 `border-bottom: 1px solid var(--hairline)`，hover 时背景变 `--surface-2`，不加阴影、不改圆角。

**可抄的规则**：
> 列表页用分隔线，不用卡片。卡片只用于"每个条目本身是独立对象且需要被单独感知"的场景（如素材库的图片）。

---

## 五、极性切换（Polarity Shift）

**出处**：`aljazeera` —— 新闻区纯白纸面，品牌区近黑画布。同一系统，两套极性。

**后台场景映射**：
- **生产端（后台）浅色 + 消费端（前台）深色**，或反过来
- 大屏/指挥中心用深色，日常操作用浅色

**关键**：这不是"暗色模式"。暗色模式是用户可切换的同一套语义；极性切换是**两种不同的使用情境，各自有独立的设计决策**。

**可抄的规则**：
> 极性切换时，token 名不变，值变。`--canvas` 在后台是 #F7F8FA，在大屏是 #1D2129，但组件一律引 `{colors.canvas}`，不写死。

**实现要点**：

```css
:root { --canvas:#F7F8FA; --surface-1:#FFF; --ink:#1D2129; }
[data-polarity="dark"] { --canvas:#1D2129; --surface-1:#25282E; --ink:#F2F3F5; }
```

---

## 六、流转时间线（StoryStream）

**出处**：`theverge` —— 左侧 1px 时间轴竖线 + 等宽大写时间戳 + 圆角内容卡，纵向堆叠

**原始用法**：新闻流不做网格，而是像 git log 一样挂在一条竖线上。

**后台场景映射**（这是最有价值的一条）：
- 稿件审核流转记录（提交 → 一审 → 二审 → 签发）
- 稿件版本历史
- 多渠道分发记录（网站 ✓ / App ✓ / 微信 ✗）
- 操作审计日志

**实现要点**：

```html
<ul class="flow">
  <li class="flow-item is-done">
    <time class="flow-time">10-19 09:12</time>
    <div class="flow-card">
      <div class="flow-title">提交审核 <span class="who">张三</span></div>
      <p class="flow-desc">已提交至一审</p>
    </div>
  </li>
</ul>
```
```css
.flow { position: relative; padding-left: 88px; }
.flow::before {                      /* 竖线 */
  content:''; position:absolute; left:76px; top:0; bottom:0;
  width:1px; background: var(--hairline);
}
.flow-item { position: relative; margin-bottom: 12px; }
.flow-item::before {                 /* 节点 */
  content:''; position:absolute; left:-16px; top:12px;
  width:8px; height:8px; border-radius:50%;
  background: var(--state-draft); border:2px solid var(--surface-1);
}
.flow-item.is-done::before { background: var(--state-approved); }
.flow-time { position:absolute; left:-88px; top:10px; width:72px;
             text-align:right; font-size:12px; color:var(--ink-subtle);
             font-variant-numeric: tabular-nums; }
```

**可抄的规则**：
> 时间轴节点颜色 = 该步骤的业务状态色，不额外引入"完成/未完成"两套色。已完成用 `state-approved`，进行中用 `state-reviewing`，驳回用 `state-rejected`。

**配套规则（同样来自 theverge）**：
> hover 只变文字颜色，不做位移/缩放/图片放大。列表高频点击，任何位移都会造成视觉抖动。

---

## 七、表面阶梯（Surface Ladder）

**出处**：`linear` —— `surface-1` 到 `surface-4` + 三级 hairline

**原始用法**：近黑画布上，用极小的明度差区分容器层级，几乎不用阴影。

**后台场景映射**：后台天然需要多层嵌套——页面 → 列表 → 卡片 → 抽屉 → 弹层 → 气泡。用表面阶梯而不是阴影，好处是：

- 深色/浅色都能用（阴影在深色上几乎不可见）
- 不会因为多层阴影叠加而变脏
- 打印/截图时层级仍然存在

**实现要点**：

| 层级 | 浅色主题 | 深色主题 | 用在哪 |
|------|---------|---------|--------|
| canvas | #F7F8FA | #1D2129 | 页面底 |
| surface-1 | #FFFFFF | #25282E | 卡片、表格 |
| surface-2 | #F2F3F5 | #2E3138 | 次级区块、表头 |
| surface-3 | #FFFFFF + 投影 | #35383F | 抽屉、弹窗 |

**可抄的规则**：
> 层级差优先用底色差（明度差 3-5%），其次用 1px 描边，最后才用投影。投影只允许出现在 surface-3 及以上。

---

## 八、统一聚焦环（Unified Focus Ring）

**出处**：`linear`（`primary-focus`）/ `sanity`（所有 hover 统一到 electric blue）

**原始用法**：所有交互元素的 hover/focus 收敛到同一个颜色。

**后台场景映射**：后台表单密集、键盘操作多（Tab 走完一个表单是常态）。focus 不可见是硬伤，而每个组件自己定 focus 色会导致"这到底是焦点还是选中"。

**实现要点**：

```css
:focus-visible {
  outline: 2px solid var(--hairline-focus);
  outline-offset: 2px;
  border-radius: inherit;
}
/* 不要用 :focus，避免鼠标点击也出现焦点环 */
```

**可抄的规则**：
> 全局只有一个 focus 环颜色（= `primary`），且用 `:focus-visible` 而非 `:focus`。

---

## 九、等宽技术标签（Mono Technical Labels）

**出处**：`sanity`（IBM Plex Mono）/ `theverge`（PolySans Mono 全大写）/ `wired`

**原始用法**：所有技术性、标识性、状态性的短标签用等宽字体，且全大写 + 加大字距。

**后台场景映射**：
- 稿件 ID / 批次号 / 流水号
- 时间戳
- 渠道标识（WEB / APP / WECHAT / WEIBO）
- 接口状态码
- 版本号

**实现要点**：

```css
.mono-tag {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}
```

**可抄的规则**：
> 凡是"要逐个字符比对"的内容（ID、时间、渠道码），必须用等宽字体。中文不用等宽——中文本身是方块字，等宽无收益。

---

## 十、字体三分工（Three-Typeface Division）

**出处**：`wired` —— 定制衬线 display + 人文学衬线正文 + 无衬线元数据

**后台场景映射**：
- **稿件预览**：预览区必须接近最终发布效果，正文需要阅读排版（衬线或长文优化无衬线）
- **编辑区**：必须用 UI 字体（无衬线），保证长时间输入不疲劳
- **元数据**：等宽

**关键机制**：编辑态与预览态**字体切换**，而不是同一套字体套两种场景。

**可抄的规则**：
> 编辑区用 UI 字体，预览区切发布字体。这个切换点要写进规范，否则实现者会用同一套字体做预览，导致"预览和发布不一样"。

---

## 十一、十个通用界面验收法（Kit-Mirror）

**出处**：`awesome-design-md` 每份文件末尾的 `ex-*` 组件组——不管什么品牌，都拿同一组通用界面来验证设计系统够不够用。

**原始清单**：pricing / app shell / data table / auth / modal / empty state / toast / cart / product selector

**后台版清单（建议直接采用）**：

| # | 界面 | 验证什么 |
|---|------|---------|
| 1 | 列表页（筛选 + 批量 + 分页） | 密度、状态列、操作列、空态 |
| 2 | 表单页 / 抽屉（新建 + 编辑） | 组件选型、校验、必填标记 |
| 3 | 详情页（多区块） | 表面阶梯、区块标题、长文本 |
| 4 | 流转时间线 | 状态色一致性、时间格式 |
| 5 | 确认弹窗（危险操作） | danger 色、二次确认、按钮层级 |
| 6 | 看板（图表 + 指标卡） | 图表配色、数字等宽 |
| 7 | 上传/素材库 | 网格、缩略图、进度态 |
| 8 | 权限/角色配置表 | 密集复选框、表头分组 |
| 9 | 空态 / 加载 / 错误 三件套 | 最容易被漏掉的一组 |
| 10 | 登录 + 二次验证 | 品牌感、错误提示 |

**用法**：这 10 个界面跑通，系统就基本一致了。任何一个跑不通，说明 DESIGN.md 缺对应的章节。

---

## 十二、可机器判定的护栏（Machine-Checkable Guardrails）

**出处**：`theverge` 的 "Iteration Guide" —— 7 条可以逐条打勾的审计项

**原始写法**：
> 1. 审计画布。如果首页出现浅色背景，压平为 #131313。
> 2. 审计圆角。每个矩形必须落在 2/3/4/20/24/30/40px 或 50%。
> 3. 审计阴影。删除所有非 1px 内阴影的 box-shadow。

**关键洞察**：护栏必须是**可判定的**（"删除所有 X"可以判定；"要美观"不可判定）。

**后台版护栏（建议直接采用）**：

| # | 审计项 | 判定方法 |
|---|--------|---------|
| 1 | 品牌色是否被用作状态 | 搜索 `primary` 是否出现在任何 `state-*` 场景 |
| 2 | 状态是否双编码 | 每个状态标签是否有图标 + 文案 |
| 3 | 是否有裸 hex | 搜索组件文件里的 `#[0-9a-f]{6}` |
| 4 | 一屏行数是否达标 | 1366×768 截图数行 |
| 5 | 操作列是否 ≤3 | 数按钮 |
| 6 | 是否有两个 primary 按钮 | 每页数一次 |
| 7 | 数字列是否等宽 | 检查 `tabular-nums` |
| 8 | 是否有 focus 环 | Tab 走一遍 |
| 9 | 空/错/加载三态是否齐 | 断网 + 清空数据各试一次 |
| 10 | 圆角是否落在刻度上 | 搜索 `border-radius` 值 |
| 11 | 间距是否落在刻度上 | 搜索 `padding`/`margin` 非刻度值 |
| 12 | 深色/极性切换是否仍有层级 | 切到大屏模式看一遍 |

---

## 附：模式选用建议

不是每条都要用。按项目阶段选：

| 阶段 | 必用 | 可选 |
|------|------|------|
| MVP 起步 | 表面阶梯、统一聚焦环、无边框列表、十个通用界面 | 其他 |
| 有一致性问题 | 状态色板、可机器判定护栏、等宽技术标签 | 栏目签名、排行榜 |
| 有实时/直播场景 | 实时态子系统、流转时间线 | 极性切换 |
| 有前台展示 | 极性切换、字体三分工、栏目签名 | 排行榜 |
