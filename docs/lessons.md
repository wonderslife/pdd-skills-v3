# PDD-Skills 开发教训记录 (Lessons Learned)

## 教训 #001: Windows PowerShell 终端中文和Emoji乱码问题

### 问题描述

在 Windows PowerShell 终端运行 `pdd-skills` 命令时，中文字符和 Emoji 符号显示为乱码：

```
馃搵 PDD-Skills 鎶€鑳藉垪琛?
鏍稿績鎶€鑳?(core)
[v] pdd-main
```

### 问题根因

1. **编码不匹配**: Node.js 子进程的 stdout/stderr 默认使用系统 ANSI 编码（Windows 中文系统通常是 GBK/GB2312），而 pdd-skills 源码使用 UTF-8 编码
2. **chalk + Emoji 组合问题**: chalk ^5.3.0 生成的 ANSI 颜色代码与 Unicode Emoji 字符混合输出时，在 PowerShell 中的渲染行为不一致
3. **Windows 控制台限制**: PowerShell 5.x 对 UTF-8 Emoji 字符（如 📋, ✅, ⚠️ 等）的渲染支持有限

### 解决方案

#### 最终方案：改为纯英文输出

为彻底解决乱码问题，将所有 CLI 输出改为纯英文：

```javascript
// init.js
console.log(chalk.blue('\n>> Initializing PDD project...\n'));
console.log(chalk.green('\n[OK] PDD project initialized!'));

// list.js
console.log(chalk.blue.bold('\n[LIST] PDD-Skills\n'));
console.log(chalk.green(`  Total: ${totalSkills} skills, ${skills.length} categories`));
```

#### Emoji 替换映射表

| 原字符 | 替换为 |
|--------|--------|
| ✅ | [OK] |
| ❌ | [X] |
| ⚠️ | [!] |
| 🚀 | >> |
| 📋 | [] |
| ✓ | [v] |
| ✗ | [x] |
| · | [.] |

### Prevention Measures

#### Auto-trigger Checklist

Before committing code, automatically check:

```bash
# Check for Chinese + emoji combinations
grep -rE "[\u{1F300}-\u{1F9FF}].*[\u4e00-\u9fff]|[\u4e00-\u9fff}].*[\u{1F300}-\u{1F9FF}]" lib/ scripts/
```

#### Code Standards

1. **Prefer ASCII symbols**: Avoid Unicode Emoji in CLI output
2. **Use English for all CLI messages**: Avoid Chinese text in user-facing output
3. **Detect terminal type**: Use `os.platform()` to detect Windows and enable compatibility mode

### Trigger Keywords

Auto-trigger this lesson check when:
- Using `chalk` library
- Outputting Emoji characters
- Windows platform compatibility handling
- Chinese text in CLI output

### Related Files

- `lib/utils/console.js` - Console compatibility utilities (new)
- `lib/list.js` - Applied Emoji replacement example
- `lib/init.js` - Changed Chinese output to English
- `bin/pdd.js` - Console compatibility layer initialization

### Lesson Summary

- **Problem**: Windows PowerShell terminal Chinese and Emoji garbled text
- **Cause**: Encoding mismatch + chalk/Emoji combination rendering issues
- **Solution**: Created `console.js` utility, Emoji to ASCII conversion, and English-only output
- **Prevention**: Code review + auto-detection script

---

## Lesson #002: pdd init only copies core skills, causing other category skills to be missing

### Problem Description

When running `pdd init` command to initialize a project, only 12 skills in `skills/core` directory were copied, leaving entropy, expert, openspec, pr and other category skills uncopied.

### Root Cause

The `copyCoreSkills()` function in `lib/init.js` was hardcoded to only copy from `skills/core`:

```javascript
async function copyCoreSkills(skillsDir) {
  const coreSkillsSource = path.join(__dirname, '../skills/core');  // Only copies core!
  // ...
}
```

### Solution

Modified `copyCoreSkills()` to iterate through all skill categories:

```javascript
async function copyCoreSkills(skillsDir) {
  const categories = ['core', 'entropy', 'expert', 'openspec', 'pr'];
  const skillsSource = path.join(__dirname, '../skills');

  for (const cat of categories) {
    const catSource = path.join(skillsSource, cat);
    if (!fs.existsSync(catSource)) continue;

    const skillDirs = fs.readdirSync(catSource).filter(f =>
      fs.statSync(path.join(catSource, f)).isDirectory()
    );

    for (const skill of skillDirs) {
      const src = path.join(catSource, skill);
      const dest = path.join(skillsDir, skill);
      await fs.copy(src, dest);
    }
  }
}
```

### Verification Result

After fix, `pdd init` copies all **42 skills**:
- core: 12
- entropy: 4
- expert: 8
- openspec: 9
- pr: 7

### Prevention Measures

- **Code Review**: Check if initialization logic covers all resource categories
- **Integration Test**: Verify all skills are correctly copied after `pdd init`

### Related Files

- `lib/init.js` - Fixed `copyCoreSkills()` function

### Lesson Summary

- **Problem**: `pdd init` only copies core skills
- **Cause**: `copyCoreSkills()` hardcoded to copy only `skills/core`
- **Solution**: Iterate through all skill category directories
- **Verification**: All 42 skills are now copied

---

## Bug Pattern Library / Bug模式库

> ⚠️ **此章节已迁移至 `config/bug-patterns.yaml`**
>
> 本章节保留作为历史参考，但不再作为唯一真相源。
> 所有技能(SKILL.md)和脚本现在统一引用 `config/bug-patterns.yaml`。
>
> **更新流程**: 新增或修改Bug模式时，只需修改 `config/bug-patterns.yaml`，
> 各skill通过引用自动获取最新模式，无需逐个文件同步。
>
> 以下为 `config/bug-patterns.yaml` 的摘要快照(截至 2026-04-15):

### 通用模式 (Python Fullstack) — PATTERN-001~007

| 模式ID | 模式描述 | 严重级别 |
|--------|---------|---------|
| PATTERN-001 | datetime字段类型陷阱 | critical |
| PATTERN-002 | 静态路由注册顺序错误 | critical |
| PATTERN-003 | 枚举硬编码/编码不一致 | warning |
| PATTERN-004 | alert()未用safeAlert()包装 | warning |
| PATTERN-005 | my-tasks查询条件不完整 | critical |
| PATTERN-006 | Options接口路由顺序(同PATTERN-002) | critical |
| PATTERN-007 | 编号生成未检查已存在记录 | critical |

### 若依专用模式 (RuoYi) — PATTERN-R001~R007

| 模式ID | 模式描述 | 严重级别 |
|--------|---------|---------|
| PATTERN-R001 | 权限注解缺失 | critical |
| PATTERN-R002 | 菜单配置不完整 | critical |
| PATTERN-R003 | 数据权限未配置 | critical |
| PATTERN-R004 | Redis缓存未清除 | warning |
| PATTERN-R005 | 参数校验缺失 | warning |
| PATTERN-R006 | XSS防护缺失 | warning |
| PATTERN-R007 | 操作日志缺失 | info |

---

*Last Updated: 2026-04-15*
*Lesson Number: LESSON-002 + Bug Pattern Library v1.0*
*Trigger Condition: pdd init command execution / pdd-implement-feature code generation*