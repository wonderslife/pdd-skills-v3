给你一份**9 个技能的使用手册*。

## 第一步：让技能生效（关键）

技能在**新开的对话**里才会加载。打开 WorkBuddy → 新建对话，你会看到侧边栏技能列表里出现这 9 个（或直接 `@` 引用）。

## 9 个技能使用清单

### 🎯 入口类（1 个，最重要）

| 技能 | 怎么用 | 触发语示例 |
|------|--------|-----------|
| **pdd-main** | 总入口，你说需求它自动编排全流程 | `@pdd-main 用若依开发预售商城` |
| | | `搞个功能：商品管理` |
| | | `修复订单列表 500 报错`（走维护模式） |

### 🔄 流程类（5 个，pdd-main 内部自动调，也可单独用）

| 技能 | 单独使用场景 | 触发语示例 |
|------|-------------|-----------|
| **pdd-ba** | 只要业务分析（需求拆解/用例） | `@pdd-ba 分析预售下单流程` |
| **pdd-generate-spec** | 只要生成开发规格文档 | `@pdd-generate-spec 生成定金支付的规格` |
| **pdd-implement-feature** | 只要实现某个功能点代码 | `@pdd-implement-feature 实现 F-101` |
| **pdd-verify-feature** | 只要验证功能实现 | `@pdd-verify-feature 验证预售商品管理` |
| **pdd-code-reviewer** | 只要审查代码质量 | `@pdd-code-reviewer 审查 ruoyi-code 的 Controller` |

### 🧠 专家类（3 个，技术问答直接找他们）

| 技能 | 什么时候用 | 触发语示例 |
|------|-----------|-----------|
| **expert-ruoyi** | 若依相关问题（权限/菜单/代码生成） | `@expert-ruoyi 若依按钮权限不显示` |
| **expert-mysql** | SQL/索引/慢查询问题 | `@expert-mysql 这个订单查询怎么优化` |
| **software-engineer** | 写业务代码/改代码 | `@software-engineer 写个幂等下单函数` |

## 完整演示：一条消息走完流程

**新对话里，你说：**

> @pdd-main 用若依开发预售商城，功能点见 dev-specs 目录

**它会自动：**
```
① pdd-ba 分析需求 → 输出业务文档 → ⏸ 等你说"可以"
② 生成规格 spec.md + checklist → ⏸ 等你说"可以"
③ pdd-implement-feature + expert-ruoyi 生成 Java 代码
④ pdd-code-reviewer 审查
⑤ pdd-verify-feature 验证
⑥ 输出验收报告
```

## 两个实用技巧

1. **不想走全流程**：直接 `@expert-ruoyi` 只问技术问题，或 `@pdd-implement-feature` 只写代码——不用每次从分析开始
2. **技能不响应时**：检查是不是**旧会话**（技能列表里没有 pdd-main 等）——新开会话即可

## ⚠️ 关于你当前这个对话

这个会话是技能导入**之前**开的，列表里没有这 9 个（之前 gen-ruoyi.mjs、verify 修复都是这么做的）。
比如：
> "用若依实现 F-101 预售商品管理，要完整业务字段"