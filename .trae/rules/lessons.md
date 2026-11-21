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
