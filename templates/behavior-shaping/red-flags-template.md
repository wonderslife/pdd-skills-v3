# Red Flags Template - 三层防御体系

> 本模板定义了三层Red Flags检测机制，用于在技能执行过程中
> 即时捕获和阻止危险行为。

---

## Red Flags 三层防御

### Layer 1: 输入层 Red Flags (Input Guard)

在接收输入时立即检查，拒绝非法输入。

| Flag ID | 检测条件 | 严重度 | 处理方式 |
|--------|---------|--------|---------|
| INPUT-001 | 输入文件不存在或为空 | 🔴 CRITICAL | 立即终止，报错提示 |
| INPUT-002 | 输入格式不符合预期(非MD/YAML/JSON) | 🔴 CRITICAL | 终止并提示支持的格式 |
| INPUT-003 | 路径包含危险字符(`..`, `$()`, `\``) | 🔴 CRITICAL | 拒绝执行，安全警告 |
| INPUT-004 | 文件大小超过安全阈值(>5MB) | 🟡 WARN | 警告确认后继续 |
| INPUT-005 | 编码检测失败(非UTF-8) | 🟡 WARN | 尝试转码，失败则报错 |

### Layer 2: 执行层 Red Flags (Execution Guard)

在执行过程中持续监控，拦截危险操作。

| Flag ID | 检测条件 | 严重度 | 处理方式 |
|--------|---------|--------|---------|
| EXEC-001 | 尝试删除非目标目录下的文件 | 🔴 CRITICAL | 阻止操作，安全警报 |
| EXEC-002 | 尝试修改 `.git/` 目录内容 | 🔴 CRITICAL | 阻止操作，Git完整性保护 |
| EXEC-003 | 生成的代码包含硬编码密钥/密码 | 🔴 CRITICAL | 阻止输出，安全审计提示 |
| EXEC-004 | 生成SQL包含字符串拼接的用户输入 | 🔴 CRITICAL | 阻止输出，SQL注入警告 |
| EXEC-005 | 循环依赖检测(A→B→A) | 🟡 WARN | 打断循环，报告依赖图 |
| EXEC-006 | 单文件超过500行 | 🟡 WARN | 建议拆分，记录技术债务 |
| EXEC-007 | 函数圈复杂度超过15 | 🟡 WARN | 建议重构，标记需审查 |
| EXEC-008 | 未处理的异常被catch后吞掉 | 🟡 WARN | 要求至少log记录 |

### Layer 3: 输出层 Red Flags (Output Guard)

在输出结果前进行最终校验。

| Flag ID | 检测条件 | 严重度 | 处理方式 |
|--------|---------|--------|---------|
| OUTPUT-001 | 输出内容为空 | 🔴 CRITICAL | 不写入文件，报错重试 |
| OUTPUT-002 | 输出路径超出项目根目录 | 🔴 CRITICAL | 阻止写入，路径越界保护 |
| OUTPUT-003 | Markdown格式解析失败(表头不匹配等) | 🟡 WARN | 修复格式后重新输出 |
| OUTPUT-004 | 产出的代码有语法错误(可通过lint检测) | 🟡 WARN | 自动修复或标记需人工审查 |
| OUTPUT-005 | 产物缺少必需的元数据(header/version) | 🔵 INFO | 补充默认元数据 |

---

## 如何在SKILL.md中使用

```markdown
## Red Flags

### Layer 1: 输入检查
- [INPUT-XXX] [本技能特有的输入检查规则]

### Layer 2: 执行检查
- [EXEC-XXX] [本技能特有的执行检查规则]

### Layer 3: 输出检查
- [OUTPUT-XXX] [本技能特有的输出检查规则]

### 触发Red Flag时的处理流程

1. 🔴 CRITICAL → 立即停止，向用户报告问题，等待指示
2. 🟡 WARN → 记录警告，继续执行，在报告中标注
3. 🔵 INFO → 记录信息，正常继续
```
