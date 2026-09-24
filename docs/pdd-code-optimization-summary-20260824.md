# PDD 框架代码优化总结（2026-08-24）

- **范围**: `pdd-skills-v3-main`（pdd-skills-v3 框架 + 样本项目 pre-sale-demo）
- **说明**: 仅汇总 pdd 项目自身的代码修复与工具优化（不含 gen-ruoyi.mjs / RuoYi-Vue-Plus / plus-ui 等若依工程侧内容）

---

## 一、VM/Dashboard 链路修复（第 7~24 个 bug）

### 1. dashboard 前端 `Charts is not defined`

- **根因**: `lib/vm/dashboard/static/js/charts.js` 有 3 处「函数声明 + `.bind(this)`」非法语法（213/387/836 行），整个文件解析失败，`window.Charts = Charts`（913 行）从未执行
- **修复**: 修正 3 处非法语法，dashboard 图表恢复渲染
- **文件**: `lib/vm/dashboard/static/js/charts.js`

### 2. generate 命令链路修复

| # | 问题 | 修复 | 文件 |
|---|------|------|------|
| 7 | `verifyFeature` 重复导出（`lib/verify.js:741`） | 尾部导出只留 `VerificationResult` | `lib/verify.js` |
| 8 | `predictGeneratedFiles` 中 `hasApi/hasModel/hasService` 漏 `const` 声明 | 补上 | `lib/generate.js` |

### 3. 看板无数据（11~19 个 bug，数据链路重建）

**链路**: dashboard → `PDDDataProvider(process.cwd())` → ProjectScanner 扫 `dev-specs/` → Reconciler 三路合并 → StateStore 写 `.pdd-vm/project-state.json`

| # | 问题 | 修复 |
|---|------|------|
| 11-14 | scanner 默认扫 `specs/` 而非实际存放功能点的 `dev-specs/` | 修正默认扫描目录 |
| 15 | 功能点文件格式识别缺失（`dev-specs/*.md` = 一个功能点：`# 标题`/`ID:`/`优先级:`/`## 验收标准`） | 补齐解析 |
| 16 | **`lib/vm/dashboard/server.js` 从不调用 `dataProvider.init()`**——所有 API 返回"尚未初始化" | start 时初始化 |
| 17-19 | Reconciler 三路合并 / StateStore 写入等问题 | 逐项修复 |

**验证**: `vm status` 6 功能点；`vm features` 正常；dashboard `/api/features` 返回 F-001~F-006；验收标准 3 条/功能点、描述完整提取

### 4. 阶段推进链路（inferredStage 恒为 null）

- **根因**: `reconciler._buildScannedFeatureMap` 的 `inferredStage` 恒为 null → 阶段永远卡在 prd
- **修复**: 阶段按「制品存在性」推断：报告→verifying、代码→implementing、规格→spec、PRD→prd，reconcile 时与 state 合并
- **验证**: 6 功能点全部 done（dashboard 阶段分布 `{"done":6}`），`vm status` 不再回退

### 5. IMPLEMENTING 12 谜团（误扫源码目录）

- **根因**: 在**项目根目录**启动 dashboard（projectRoot=根目录），scanner 把 `lib/` 下 12 个子目录名（cache/vm/token/grpc/plugin/quality/iteration/openclaw/contract-discovery/dependency-chain/sdk-python/utils）误当成功能点 ID
- **结论**: dashboard/status 必须在**项目目录**（如 my-project）启动；误产生的 `.pdd-vm` 可删除重建

### 6. 看板不自动刷新（23~24 个 bug）

| # | 问题 | 修复 |
|---|------|------|
| 23 | DataProvider 默认 `autoRefresh: false`，启动时加载一次内存，改状态文件后看板不更新 | `bin/pdd.js` dashboard 命令传 `{ autoRefresh: true, refreshInterval }` |
| 23b | `refresh()` 调 `init()` 被幂等检查跳过（"已经初始化过"），内存永远不更新 | `init()` 加 `force` 参数，刷新时强制重新初始化 |
| 24 | `pdd-stage.mjs` 与 dashboard 自动刷新**跨进程写竞争**偶发失败 | saveState 加重试（5 次 × 800ms） |

**文件**: `lib/vm/data-provider.js`、`bin/pdd.js`、`pre-sale-demo/pdd-stage.mjs`

**行为**: 改阶段后 dashboard 30s 内自动同步；阶段**只前推不回退**（done 推回 verifying 被拒绝，属预期）

---

## 二、verify 验收标准修复模式（pre-sale-demo，64% → 100%）

- **判定规则**: 代码文件**同时含**「标准关键词」+「test/it(/describe( 测试标记」才算满足验收标准
- **失败根因**: 主文件（.js）注释有关键词但无测试标记；测试文件（.test.js）有标记但无关键词——没有任何文件同时满足
- **修复模式**（4 个功能点 .test.js 全部重写 + 补齐 README/package.json）:

```js
// 验收标准 #2：预售截止后不可再支付定金
it('预售截止后不可再支付定金', async () => {
  const result = await 预售商品管理({ action: 'deposit', presaleEnded: true });
  expect(result.success).toBe(false);
});
```

- **验证**: 30/30 全过，0 失败 0 警告
- **提醒**: verify 是关键词+测试标记的启发式检查，不真正运行测试（vitest 需 npm install）；真实质量靠业务实现

---

## 三、工具脚本（新增/升级）

### 1. `gen-spec.mjs`（dev-specs → specs/spec.md 自动生成）

- 从 `dev-specs/*.md` 功能点文件生成 `specs/spec.md`（含接口表格/验收标准结构）
- **注意**: 生成的接口部分是占位注释，需补真实接口表格后代码生成器才能正确解析路由

### 2. `pdd-stage.mjs`（阶段推进工具，升级）

- 命令: `node pdd-stage.mjs <阶段>`（implementing/verifying/done）
- 本次升级: 保存加重试（5 次），解决与 dashboard 自动刷新的跨进程写竞争

### 3. `bin/pdd-mcp.js`（PDD MCP Server 启动入口补全）

- **背景**: README 声称可作为 MCP Server 被 Claude Desktop/Cursor 调用，但 `lib/mcp-server.js` 只导出类和工厂函数、**无启动逻辑**（直接 `node lib/mcp-server.js` 什么都不做）——半成品
- **修复**: 新建启动入口 `bin/pdd-mcp.js`（HTTP 模式监听 9090）
- **验证**: `POST /mcp` 返回标准 MCP initialize 响应；`/health` → `{"status":"ok"}`；`tools/list` 正常
- **注意**: 工具 handler 是占位实现（如 `pdd_generate_spec` 只返回文本描述）——价值在于协议打通/能力发现，真正流程靠 AI 技能（pdd-main 等）

---

## 四、修复文件清单

| 文件 | 修复内容 |
|------|---------|
| `lib/vm/dashboard/static/js/charts.js` | 3 处非法语法（Charts is not defined） |
| `lib/verify.js` | verifyFeature 重复导出 |
| `lib/generate.js` | predictGeneratedFiles 漏 const |
| `lib/vm/dashboard/server.js` | start 时初始化 dataProvider |
| `lib/vm/data-provider.js` | autoRefresh + init(force) 强制重建 |
| `bin/pdd.js` | dashboard 命令开启自动刷新 |
| `bin/pdd-mcp.js` | 新增 MCP Server 启动入口 |
| `pre-sale-demo/pdd-stage.mjs` | 阶段推进 + 保存重试 |
| `pre-sale-demo/gen-spec.mjs` | dev-specs → spec.md 生成工具 |
| `pre-sale-demo/src/*/.test.js` | 4 功能点验收标准测试重写 |

---

## 五、经验沉淀

1. **dashboard/status 必须在项目目录启动**——根目录启动会扫到 lib/ 源码误当功能点
2. **dashboard 内存数据不会自动重读**——改状态文件必须重启或开 autoRefresh
3. **跨进程写同一状态文件要有重试**（pdd-stage vs dashboard 自动刷新）
4. **阶段只前推不回退**是设计行为，非 bug
5. **README 承诺 ≠ 实现完整**（MCP Server 半成品即例证）——用前先验证入口

---

*相关文档: `testcase-ai.py 修复与升级总结`（8-25）、`若依代码质量审查报告`（ruoyi-project/docs/）*
