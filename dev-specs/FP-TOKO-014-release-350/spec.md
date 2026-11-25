# FP-TOKO-014 release-350 开发规格

## 基本信息

| 项目 | 内容 |
|------|------|
| 功能点ID | FP-TOKO-014 |
| 名称 | 3.5.0 发版核验（T3 收尾） |
| 版本 | v1.0 |
| 日期 | 2026-11-24 |
| 来源 | docs/plans/05 §5.1、§5.3、§6-T3 |
| 优先级 | P2 |
| 范围 | 仅规格；本 FP 不实现 |

## 1. 接口定义

### 1.1 核验清单执行（设计约定）

| 导出 | 类型 | 说明 |
|------|------|------|
| `verifyCompatibility()` | 核验脚本 | 对 §2.1 兼容承诺表逐项执行并输出核验报告（docs/reviews/ 惯例） |
| `packSizeAssert()` | 断言 | npm 包体积增幅 ≤10%（skills 不动，仅 lib 扩展约 +80KB） |

### 1.2 版本化核验项（doc 05 §5.3）

| 项 | 标准 |
|----|------|
| PSE manifest_version | 语义化策略落实：新增事件不升 major；语义变更升 major 并双发 6 个月 |
| 适配器版本 | 独立版本 + tested_at + upstream_version 声明 |
| tokenizer profile | content_hash 锁定（FP-TOKO-001） |

### 1.3 错误码

| 错误 | 触发 | 处理 |
|------|------|------|
| COMPAT_FAILED | 任一承诺项核验失败 | 不发版，回退修复后重跑 |
| SIZE_BREACH | 包体积增幅 >10% | 检查误入 files 的产物 |

## 2. 数据模型

### 2.1 兼容承诺核验表（逐项硬指标，源自 doc 05 §5.1）

| # | 承诺 | 验证方式 |
|---|------|---------|
| 1 | 53 技能触发语义不变 | 触发回归全绿 |
| 2 | REST 既有端点请求/响应字节级不变 | 契约快照测试 |
| 3 | MCP 旧版本 client 可用 | MCP 握手回退用例 |
| 4 | SDK 公开 API 签名不变 | 类型检查 + 示例编译 |
| 5 | _meta.json/front matter 新字段全可选 | 无新字段时行为等价校验 |
| 6 | 现有插件（含 android-toolchain）照常加载 | 插件加载冒烟 |
| 7 | budget-manager 类接口不变 | 既有调用点零改动编译通过 |
| 8 | npm 包体积增幅 ≤10% | npm pack 体积断言 |

### 2.2 枚举值定义

| 字段 | 值 | 含义 |
|------|-----|------|
| 核验结论 | passed / failed | 任一 failed → 不发版 |

## 3. 业务逻辑

### 3.1 处理流程

1. 全 FP 实现完成 → 2. 按 §2.1 表逐项执行核验 → 3. 量化指标复核（校准误差≤5%/装配偏差≤10%/单会话≥40%、长会话≥55%）→ 4. 全部 passed → 走 3.4.0 既有发版流程（npm whoami → npm publish --access public）→ 5. README/lessons/版本历史同步

### 3.2 业务规则

| 规则ID | 规则描述 | 约束类型 | 优先级 |
|--------|---------|---------|--------|
| R1 | 任一承诺项 failed 不得发版 | 强制 | P0 |
| R2 | 发版前先 `npm whoami` 验证 token，再 `npm view pdd-skills version` 核对包名与版本（lessons.md 既有规范） | 强制 | P0 |
| R3 | 包名为 `pdd-skills`（非 pdd-skills-v3） | 强制 | P0 |
| R4 | 发版后同步更新 package.json/README/lessons.md 版本记录 | 强制 | P1 |

### 3.3 状态转换

pre-release → 核验 passed → published；任一 failed → blocked（回退修复循环）。

## 4. 不适用章节说明

前端页面/前端实现约定/关联数据源/权限与安全：N/A（发版治理能力；npm 凭据走 .npmrc，勿明文记录——lessons.md 既有规范）。

## 5. 依赖检查清单

| 方向 | 依赖 | 说明 |
|------|------|------|
| 前置 | FP-TOKO-001…013 全部完成且各自 checklist 通过 | — |
| 后续 | 无（3.5.0 终点） | — |
| 外部 | npm registry / GitHub release | 沿用既有发布链路 |
