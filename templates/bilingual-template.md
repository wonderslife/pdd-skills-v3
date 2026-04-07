# Bilingual SKILL Template / 双语技能模板

> 本模板定义了PDD-Skills中英双语SKILL.md的标准格式。
> 参考: docs/i18n-spec.md (Single File Bilingual策略)

---

## Frontmatter 格式 / 元数据格式

```yaml
---
name: <skill-name>
version: "1.0.0"
category: core|expert|entropy|pr|openspec
description:
  zh: "<中文描述(20-200字)，包含触发关键词如'当用户/调用/触发'>"
  en: "<English description (20-200 chars), with trigger keywords like 'when/invoke/call'>"
license: MIT
compatibility: <依赖说明>
metadata:
  author: "<email>"
  version: "<semver>"
  parent: <parent-skill> (可选)
triggers:
  - "<中文触发词1>"    # 至少3个中文
  - "<english trigger 1>"  # 至少3个英文
  - "<中文触发词2>"
  - "<english trigger 2>"
---
```

## 文档结构 / Document Structure

```markdown
---
<frontmatter as above>
---

# <English Name> / <中文名称>

## Overview / 概述

### English
[English overview paragraph, 3-5 sentences]

### 中文
[中文概述段落, 3-5句]

---

## Workflow / 工作流程

### Step 1: <English Name> / 步骤一：<中文名>

**EN:** [English instruction, 2-3 sentences]

**中文：** [中文指令, 2-3句]

### Step 2: ...
[重复每个步骤]

---

## Iron Law / 核心铁律

### 🇨🇳 中文版
[中文铁律内容]

### 🇺🇸 English
[English Iron Law content]

---

## Rationalization Table / 合理化防御表

| # | 陷阱 (Trap) | 辩解 (Rationalization) | 反驳 (Rebuttal) |
|---|-------------|----------------------|-----------------|
| 1 | [CN] | [CN] | [CN] |
|   | [EN] | [EN] | [EN] |

---

## Red Flags / 三层防御体系

### Layer 1: Input Guards / 输入防护

**EN:** [English guard rules]

**中文：** [中文防护规则]

### Layer 2: Execution Guards / 执行防护

...

### Layer 3: Output Guards / 输出防护

...

**Trigger Handling / 触发处理流程:**
🔴 CRITICAL → Stop & Report | 🟡 WARN → Log & Auto-fix | 🔵 INFO → Continue

---

## Output / 输出规范

### English
[English output format specification]

### 中文
[中文输出格式规范]
```

## 关键规则 / Key Rules

### 1. 触发词规则 / Trigger Rules
- 每种语言至少 **3个触发词**
- 触发词包含技术术语: PRD, feature, spec, workflow, etc.
- 专有名词不翻译: PDD, BPMN, SQLFluff, RuoYi, etc.
- 中英文 triggers 在 `_meta.json` 中混合排列

### 2. 分区标记 / Section Markers
- `## 🇨🇳` 标记中文内容区块
- `## 🇺🇸` 标记英文内容区块
- 未标记的公共区域使用双语并列格式

### 3. 语言检测 / Language Detection
AI Agent 加载技能时:
1. 检测最近3条用户消息的语言分布
2. 以用户主要语言为主输出
3. 技术术语、代码、配置名保持原文
4. 内容不足时自动补充另一语言版本

### 4. 代码注释 / Code Comments
```javascript
// Extract features from PRD / 从PRD提取功能点
function extractFeatures(prdPath) {
  // Parse PRD document / 解析PRD文档
}
```
