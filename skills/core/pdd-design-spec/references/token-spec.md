# Token 规范

> 这份文件解决一个问题：**为什么别人的设计系统能改一处全局生效，而你的要全文搜索替换？**
> 答案全在 token 的命名与引用方式上。

---

## 一、三层 token 结构

```
原始值层 (primitive)   →   语义层 (semantic)    →   组件层 (component)
#165DFF                     colors.primary            button-primary.backgroundColor
#E5E6EB                     colors.hairline           data-table.rowBorder
```

**规则：组件层只能引用语义层，语义层才能引用原始值层。禁止跨层引用。**

```
✅ components.button-primary.backgroundColor: "{colors.primary}"
❌ components.button-primary.backgroundColor: "{colors.blue-500}"
❌ components.button-primary.backgroundColor: "#165DFF"
```

**为什么不能跨层**：语义层是唯一可替换的接口。当客户要求"把主色改成红色"，你只改 `colors.primary` 一行；如果组件直接引 `blue-500`，就要改 40 个地方，并且 `blue-500` 这个名字会变成谎言。

---

## 二、命名规则

### 规则 1：按角色命名，不按外观命名

| ❌ 外观命名 | ✅ 角色命名 | 理由 |
|-----------|-----------|------|
| `red` | `state-rejected` | 改成橙色时名字不用改 |
| `blue-500` | `primary` | 换品牌色时名字不用改 |
| `light-gray` | `canvas` / `surface-2` | 用途决定名字 |
| `big-font` | `title-lg` | 层级决定名字 |

### 规则 2：状态用 `state-*` 前缀，实时用 `live-*`，两者不混

```
state-draft / state-pending / state-reviewing / state-approved
state-rejected / state-published / state-withdrawn / state-failed

live / live-bg          ← 独立命名空间
```

**为什么必须分**：状态是"数据的状态"（持久化、可查询），实时是"时间的状态"（瞬时、会消失）。混在一起后，"红色"就无法区分"这条稿件被驳回了"还是"这个直播间正在播"。

### 规则 3：表面用数字阶梯，不用形容词

```
✅ surface-1 / surface-2 / surface-3 / surface-4
❌ surface-light / surface-lighter / surface-lightest
```

数字阶梯的好处：可以排序、可以循环、可以按层级推导（第 n 层 = surface-n）。

### 规则 4：描边只留三级

```
hairline          常规分隔（表格行、卡片边）
hairline-strong   强调边框（输入框、可聚焦容器）
hairline-focus    聚焦环（必须与 primary 一致）
```

超过三级说明你在用描边表达层级——那应该用表面阶梯，不是加描边。

### 规则 5：文字按重要度分四级，不多不少

```
ink           主文字（标题、关键数值）
ink-body      正文
ink-subtle    次要（说明、辅助信息）
ink-tertiary  最弱（占位符、禁用）
```

需要第五级时，说明你的信息层级没想清楚。

---

## 三、间距与尺寸

### 基准单位：后台用 4px，不用 8px

8px 基准适合营销站（留白即设计），**不适合后台**。后台需要 4px 才能做出：

- 紧凑表格（行高 40px = 8+24+8，用 4 的倍数才能精确控制）
- 标签与输入框的 4px 微调
- 图标与文字的 6px 视觉对齐

### 间距刻度（禁止自造）

```
xxs 2px   xs 4px   sm 8px   md 12px   lg 16px   xl 20px   xxl 24px   xxxl 32px
```

**禁止使用**：5px / 10px / 15px / 18px / 25px。出现这些值说明在凭感觉调，会导致像素级不齐。

### 圆角刻度

```
xs 2px    标签、徽标
sm 4px    输入框、按钮（后台基准）
md 6px    卡片
lg 8px    弹层、抽屉
full      头像、胶囊
```

后台不要用 12px 以上圆角——圆角越大，同样尺寸下内容区越小，密度越低。

---

## 四、字号

### 后台基准：14px

| 场景 | 字号 | 理由 |
|------|------|------|
| 后台正文 | 14px | 16px 会让 1080p 一屏少 3 行 |
| 表格内容 | 14px | 与正文一致，降低视线跳跃 |
| 表格表头 | 14px / 600 | 靠字重区分，不靠字号 |
| 辅助说明 | 12-13px | |
| 页面标题 | 20px | |
| 数据大屏数值 | 28-36px | 唯一允许大字号的地方 |

**前台/移动端**可回到 16px 基准——那里是阅读场景，不是操作场景。

### 数字必须等宽

```css
.table-cell-num { font-variant-numeric: tabular-nums; }
```

**为什么**：比例数字下，"1"比"8"窄，表格数字列的小数点会参差不齐，扫读时眼睛要重新定位。这一条是后台表格专业度的分水岭。

---

## 五、状态色的推导方法

不要凭感觉配色。按这个顺序推导：

### Step 1. 列全状态

从 PRD 功能需求 + spec 状态转换章节，把**所有**状态枚举列出来。遗漏状态是后期返工的头号原因。

### Step 2. 按语义分组

| 组 | 含义 | 色相建议 |
|----|------|---------|
| 流程态 | 数据还在流转中 | 中性灰 → 橙 → 蓝（进度感） |
| 终态-正 | 正常结束 | 绿系（深浅两级区分"通过"与"已生效"） |
| 终态-负 | 异常结束 | 红系（必须与品牌色色相差 ≥ 120°） |
| 暂停态 | 挂起/定时/撤回 | 紫 / 深灰 |
| 异常态 | 执行失败 | 红系 + ⚠ 图标 |

### Step 3. 同组内用明度/图标区分，不扩色相

"已通过"和"已发布"都是终态-正，用**同一色相两个明度**（#00B42A / #237804），不要引入第二个绿色相。色相数量是有限资源。

### Step 4. 检查冲突

三个必须检查的冲突：

1. **品牌色 vs 状态色**：色相差 < 60° 且明度接近 → 冲突
2. **两个状态色**：色相差 < 30° → 视觉上不可区分
3. **任何状态色 vs 背景**：对比度 < 3:1 → 不合格

### Step 5. 补第二编码维度

**颜色不能是唯一编码。** 每个状态必须再加一项：

- 图标（○ ◔ ◑ ✓ ✕ ● ⊘ ⚠ —）
- 形状（实心 / 空心 / 描边 / 虚线）
- 文案（必须，且不能只是颜色名）

**理由**：8% 男性有色觉障碍；黑白打印的场景真实存在（评审会打印、公文归档）。

---

## 六、验证方法

生成 front matter 后，用这段脚本自检。**注意判定规则不是"色相必须拉开"那么简单**：

- 低饱和色（S < 20%，即灰阶）色相无意义，**跳过色相比较**
- 色相接近但**明度差 ≥ 18** 属于"同族色"，是合法设计（靠明度 + 图标区分），**不算冲突**
- 只有"色相接近 **且** 明度也接近"才是真冲突

```js
// 用法：node check-design.js DESIGN.md
const fs = require('fs');
const YAML = require('yaml');   // 框架内已安装

const doc = fs.readFileSync(process.argv[2] || 'DESIGN.md', 'utf8');
const fm = doc.match(/^---\r?\n([\s\S]*?)\r?\n---/);
if (!fm) throw new Error('缺少 front matter');
const t = YAML.parse(fm[1]);

const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hsl = h => {
  const [r, g, b] = rgb(h);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let hue = 0;
  if (d) {
    hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
  }
  const s = mx === 0 ? 0 : d / mx;
  return { hue, s };
};
const lightness = h => {
  const [r, g, b] = rgb(h).map(lin);
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
};

// ── 1. 组件是否只引用已定义 token / 是否有裸 hex ──
const colors = Object.keys(t.colors || {});
let problems = 0;
for (const [name, def] of Object.entries(t.components || {})) {
  for (const [k, v] of Object.entries(def)) {
    if (typeof v !== 'string') continue;
    if (/^#[0-9a-fA-F]{3,8}$/.test(v)) {
      console.error(`[裸hex] components.${name}.${k} = ${v}`); problems++;
    }
    for (const m of v.matchAll(/\{(colors|typography|spacing|rounded)\.([\w.-]+)\}/g)) {
      if (!t[m[1]] || !(m[2] in t[m[1]])) {
        console.error(`[引用失效] components.${name}.${k} → ${m[0]}`); problems++;
      }
    }
  }
}

// ── 2. 状态色数量 ──
const states = colors.filter(c => c.startsWith('state-'));
console.log(`状态色 ${states.length} 个：${states.join(', ')}`);
if (states.length > 9) console.warn('[超量] 状态色 > 9，应收敛色族 + 用明度/图标细分');

// ── 3. 色相 × 明度 双重判定 ──
const S_MIN = 0.20;   // 低于此为灰阶，跳过色相比较
const HUE_MIN = 25;   // 色相距离阈值
const L_MIN = 18;     // 明度差阈值（L* 单位）

const check = (aName, a, bName, b) => {
  if (!a || !b || !a.startsWith('#') || !b.startsWith('#')) return;
  const A = hsl(a), B = hsl(b);
  if (A.s < S_MIN || B.s < S_MIN) return;          // 灰阶豁免
  let dh = Math.abs(A.hue - B.hue); if (dh > 180) dh = 360 - dh;
  const dl = Math.abs(lightness(a) - lightness(b));
  if (dh < HUE_MIN && dl < L_MIN) {
    console.warn(`[冲突] ${aName}(${a}) vs ${bName}(${b})：色相差 ${dh.toFixed(0)}°，明度差 ${dl.toFixed(0)}（需 ≥${L_MIN}）`);
    problems++;
  } else if (dh < HUE_MIN) {
    console.log(`[同族-可接受] ${aName} vs ${bName}：色相差 ${dh.toFixed(0)}°，明度差 ${dl.toFixed(0)}`);
  }
};

if (t.colors.primary) states.forEach(s => check('primary', t.colors.primary, s, t.colors[s]));
for (let i = 0; i < states.length; i++)
  for (let j = i + 1; j < states.length; j++)
    check(states[i], t.colors[states[i]], states[j], t.colors[states[j]]);

// ── 4. 文字色对比度（状态色作 12px 标签文字，需 ≥3:1）──
const contrast = (a, b) => {
  const L = h => { const [r, g, bl] = rgb(h).map(lin);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const [x, y] = [L(a), L(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
states.forEach(s => {
  const c = t.colors[s];
  if (typeof c !== 'string' || !c.startsWith('#')) return;
  const cr = contrast(c, '#FFFFFF');
  if (cr < 3) console.warn(`[对比度不足] ${s}(${c}) 在白底对比度 ${cr.toFixed(2)}:1，低于 3:1`);
});

console.log(problems ? `\n共 ${problems} 处问题` : '\n全部通过');
```

### 判定规则说明

| 情形 | 判定 | 理由 |
|------|------|------|
| 两色色相差 < 25°，明度差 < 18 | ❌ 冲突 | 视觉上不可区分 |
| 两色色相差 < 25°，明度差 ≥ 18 | ✅ 同族可接受 | 靠明度 + 图标区分，是 11 态收敛到 8 族的正确手段 |
| 任一色 S < 20%（灰阶） | ✅ 跳过 | 灰阶的色相无感知意义 |
| 状态色在白底对比度 < 3:1 | ⚠️ 警告 | 12px 小字不可读，需加深 |

---

## 七、常见错误对照

| 错误 | 症状 | 修法 |
|------|------|------|
| 组件直接写 hex | 改主色要搜 40 处 | 全部改引用 |
| 状态色用 Tailwind 色卡名 | `bg-red-500` 在不同页面对应不同红 | 自定义语义名 |
| 品牌色兼任状态色 | 主色蓝同时表示"进行中"，按钮和标签撞色 | 状态色独立命名空间 |
| 状态色只有背景色 | 色盲不可用、打印不可用 | 加图标 + 文案 |
| 用 8px 基准做后台 | 行高只能 40/48，做不出 36 | 改 4px 基准 |
| 圆角用 12px+ | 卡片内容区被吃掉，密度下降 | 后台用 4-6px |
| 数字用比例字体 | 表格小数点不对齐 | `tabular-nums` |
| 描边五级 | 层级靠加边框表达，越加越乱 | 只留三级，其余用表面阶梯 |
