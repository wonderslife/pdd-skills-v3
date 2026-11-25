# Lessons Learned

## Guidelines

### Format

```markdown
## YYYY-MM-DD: Issue Title

### Problem
Description of the issue.

### Root Cause
Root cause analysis.

### Solution
How it was resolved.

### Prevention
How to prevent recurrence.
```

### How to Use

1. When encountering a new issue, create a new entry
2. When updating the solution, update with solution details
3. Before starting similar work, check this file for relevant lessons

---

## 2026-11-21: npm 发布记录与包名勘误

### Problem
发布时发现 lessons 中记录的包名 `pdd-skills-v3` 有误——npm registry 上实际发布的包名是 `pdd-skills`（maintainer: wonderqi）。旧 token 失效导致 E401，需重新配置。

### Solution
**npm Token**: 请通过项目根目录 `.npmrc` 的 `_authToken` 或 `npm config set //registry.npmjs.org/:_authToken <token>` 配置（勿明文记录）

**发布包名**: `pdd-skills`（⚠️ 不是 pdd-skills-v3，pdd-skills-v3 在 registry 上不存在）
**当前版本**: `3.4.0`（2026-11-21 发布：Kotlin 原生 Android 支持，53 个技能）

**发布命令**:
```bash
npm whoami        # 先验证 token 有效性
npm publish --access public
```

### Prevention
1. 发布前先 `npm whoami` 验证 token，再 `npm view <pkg> version` 核对包名与版本
2. 发布后更新 `package.json` 版本号遵循语义化版本；主版本迭代时同步更新 README 计数
3. 3.4.0 发布内容：Kotlin 原生 Android 全链路支持（探测器/lib/android 四模块/4专家技能/android-toolchain插件/ADB测试框架），详见 docs/plans/04-kotlin-android-capability-enhancement.md

---

## 2026-11-25: lib/quality 子树潜伏语法缺陷批量修复（3.5.0 发版核验期间发现）

### Problem
FP-TOKO-013（quality-cost-score）实现期间发现 `lib/quality/` 全子树自 3.4.x 起不可导入——4 处模块级 SyntaxError：
1. `scorer.js` `_loadRules` 非 async 方法内使用 `await`（`await import()`，顶层 await 不可用于类方法）
2. `rules/performance.js` L152-153 括号配平错误（多余闭括号使 `||` 落到语句级）+ 字符串引号残句
3. `rules/robustness.js` L396 正则中 `??` 未转义（`/\?\?/` 写成 `/??/` 解析失败）
4. `rules/security.js` L77 正则中 `knex(...)` 括号未转义（字符组内裸括号）

### Root Cause
与 2026-11-21 budget-alert.js 缺陷同根因：这些模块**无任何 importer、无测试覆盖**，语法错误从未在运行时暴露。3.4.x 发布时仅靠 `node --check` 也不足以拦截（部分缺陷在 check 通过的形态下仍存在——如引号残句恰构成合法表达式）。

### Solution
按已批准先例（budget-alert.js 同类缺陷循例修复）全部修复：scorer.js 规则集改静态导入+构造期同步载入（语义不变）；performance.js 括号/引号配平；robustness.js `??` 转义；security.js 括号转义。修复后 31 条内置规则首次实际加载，TOKO 全量回归 262/262 通过，发版核验 8 项承诺全绿。

### Prevention
1. 新增 lib/ 子树时至少配套一个 `node --check` 级冒烟测试（即使模块暂无 importer）
2. 发布前核验脚本应覆盖"全 lib 可导入性"而非仅既有调用链（本窗口 verify-release-350.js 已含关键模块动态导入核验）
3. 3.5.0 发布内容：Token 优化与流式模型适配（CAG/PSE/MSSA/预算闭环/质量 cost 子项），详见 docs/plans/05-token-optimization-and-streaming-model-adaptation.md
