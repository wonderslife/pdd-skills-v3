# PDD-Skills 多语言规范 (i18n)

> 本文档定义了PDD-Skills的中英文双语支持框架。

---

## 设计原则

### 1. 双语共存策略

采用 **Single File Bilingual** 策略：每个 SKILL.md 同时包含中英文内容，通过结构化分区实现双语支持。

### 2. 语言区域划分

```markdown
---
name: pdd-main
description:
  zh: "PRD驱动开发的主入口技能"
  en: "Main entry Skill for PRD-Driven Development"
triggers:
  - "PDD开发"   # 中文触发词
  - "PRD driven development"  # 英文触发词
---

# PDD Main / PDD主入口

## 🇨🇳 中文说明
[中文详细内容]

## 🇺🇸 English Description
[English detailed content]
```

### 3. 触发词规则

| 规则 | 说明 |
|------|------|
| 每种语言至少3个触发词 | 确保中英文均可触发 |
| 触发词应包含技术术语 | 如 "PRD", "feature", "spec" 等通用术语 |
| 避免翻译专有名词 | 如 "PDD", "BPMN", "SQLFluff" 保持原样 |
| 中英文触发词分别列出 | 在 `_meta.json` 的 triggers 字段中混合排列 |

---

## 双语模板结构

```markdown
---
name: <skill-name>
version: "1.0.0"
category: core
description:
  zh: "<中文描述(20-200字)>"
  en: "<English description (20-200 chars)>"
triggers:
  - "<中文触发词1>"
  - "<english trigger 1>"
  - "<中文触发词2>"
  - "<english trigger 2>"
---

# <English Name> / <中文名称>

## Overview / 概述

### English
[English overview text]

### 中文
[中文概述文本]

---

## Workflow / 工作流程

### Step 1: <English Step Name> / 步骤一：<中文名称>

**English instruction:**
[英文指令]

**中文指令：**
[中文指令]

---

## Iron Law / 核心铁律

(双语铁律内容)

## Rationalization Table / 合理化防御表

(双语防御表)

## Red Flags / 三层防御

(双语Red Flags)
```

---

## 语言检测与切换

当AI Agent加载技能时：

1. **检测用户语言**: 分析最近3条用户消息的语言分布
2. **优先响应语言**: 以用户主要使用的语言为主输出
3. **术语保持原文**: 技术术语、代码、配置名不翻译
4. **双语回退**: 如果用户语言的内容不足，自动补充另一语言版本

---

## 实施检查清单

- [ ] `_meta.json` 的 description 包含 `zh` 和 `en` 字段
- [ ] `triggers` 包含至少3个中文和3个英文触发词
- [ ] SKILL.md 使用 `## 🇨🇳` 和 `## 🇺🇸` 分区标记
- [ ] 每个关键步骤都有中英文双语说明
- [ ] Iron Law / Rationalization / Red Flags 均有双语内容
- [ ] 代码示例注释使用双语
