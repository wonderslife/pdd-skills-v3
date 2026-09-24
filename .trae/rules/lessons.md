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

## 2026-06-16: npm 发布 Token 记录

### Problem
发布 pdd-skills-v3 到 npm registry 需要认证 token。

### Solution
**npm Token**: `<YOUR_NPM_TOKEN>`（请通过 `npm config set` 或环境变量安全配置，勿明文记录）

**发布包名**: `pdd-skills-v3`
**当前版本**: `3.2.3`

**发布命令**:
```bash
cd pdd-skills-v3
npm publish --access public --token $env:NPM_TOKEN
```

或先配置 token:
```bash
npm config set //registry.npmjs.org/:_authToken $env:NPM_TOKEN
npm publish --access public
```

### Prevention
1. Token 已记录在此文件，发布前直接引用
2. 发布后记得更新 `package.json` 中的版本号（遵循语义化版本）
3. 本次发布内容：修复 20 个 skill 的 description 调用说明缺失问题
