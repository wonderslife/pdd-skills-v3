---
name: expert-code-quality
description: "代码质量专家，整合Martin Fowler重构技术和GoF设计模式，系统提升代码质量。触发：代码审查、重构、设计模式、代码异味、SOLID原则、架构改进、code review、refactoring、design patterns。"
license: "MIT"
author: "neuqik@hotmail.com"
version: "2.0"
---

# Code Quality Expert 代码质量专家

整合两大软件工程学科：**重构(Refactoring)**（不改变行为改进结构）+ **设计模式(Design Patterns)**（常见设计问题的成熟方案），帮助编写整洁、可维护、可扩展的代码。

**参考文档**: `references/` 下按需加载（refactoring-catalog / design-patterns / code-smells / solid-principles）

## 触发条件
- 询问代码质量问题 / 识别代码异味 / 推荐设计模式 / 执行重构 / 评估SOLID合规
- 手动命令: `/code-quality` `/refactor` `/pattern`

## 核心能力

### 1. 代码异味检测 (22种)
**方法级**: Long Method(>20行)🔴 | Duplicated Code(重复代码)🔴 | Long Parameter List(>4参数)🟡 | Switch Statements(大switch)🟡
**类级**: Large Class(>300行或>10字段)🔴 | Divergent Change(多种原因修改)🔴 | Shotgun Surgery(一处改多处)🔴 | Feature Envy(多用他类数据)🟡
**关系级**: Inappropriate Intimacy(访问私有)🟡 | Message Chains(链式调用)🟡 | Middle Man(仅委托)🟢 | Data Clumps(数据聚合)🟡

**检测清单**: [ ]方法>20行 [ ]重复代码 [ ]类>10字段 [ ]switch可多态化 [ ]方法>4参数 [ ]继承>3层 [ ]类多原因变更 [ ]消息链>3 [ ]纯数据类 [ ]惰性类

### 2. 重构技术
**两顶帽子原则(Kent Beck)**: 增加功能(不改旧代码) vs 重构(不加新功能)，绝不同时戴两顶。
**重构节奏**: Test → 小改动 → Test → 小改动 → Test

**关键重构**:
- 组合方法: Extract Method(方法过长) | Inline Method(方法体清晰) | Replace Temp with Query(临时变量) | Replace Method with Method Object(临时变量过多)
- 搬移特性: Move Method(多用他类) | Extract Class(类过多职责) | Hide Delegate(隐藏委托链)
- 简化条件: Decompose Conditional(复杂条件) | Consolidate Conditional(合并条件) | Replace Nested Conditional with Guard Clauses(嵌套if) | Replace Conditional with Polymorphism(类型switch)

**重构决策树**: 有测试? 无→先写测试 | 理解代码? 无→先重构理解 | 方法过长→Extract Method | 重复代码→Extract/Pull Up | 类过大→Extract Class | 参数过长→Parameter Object | switch→Polymorphism | 复杂条件→Decompose/Guard Clauses

### 3. 设计模式
**SOLID原则**: S单一职责 | O开闭(扩展开放/修改关闭) | L里氏替换(子类可替换) | I接口隔离(小聚焦接口) | D依赖倒置(依赖抽象)

**按问题选择**:
| 问题 | 模式 |
|------|------|
| 需单实例 | Singleton |
| 灵活创建对象 | Factory Method |
| 一族对象 | Abstract Factory |
| 复杂对象构建 | Builder |
| 接口不兼容 | Adapter |
| 动态加职责 | Decorator |
| 控制访问 | Proxy |
| 简化复杂系统 | Facade |
| 树结构 | Composite |
| 切换算法 | Strategy |
| 事件通知 | Observer |
| 封装请求 | Command |
| 状态依赖行为 | State |

**按代码异味选择**: 大switch→State/Strategy | 多重条件→Strategy/State/Null Object | 紧耦合→Observer/Mediator/Facade | 对象创建难→Factory/Builder | 类难扩展→Decorator/Adapter | 复杂子系统→Facade | 算法变化→Strategy/Template Method

**模式速查**: 创建型(Singleton/Factory/Abstract Factory/Builder/Prototype) | 结构型(Adapter/Decorator/Proxy/Facade/Composite/Flyweight/Bridge) | 行为型(Strategy/Observer/Command/State/Template Method/Iterator/Mediator/Memento/Chain of Resp/Visitor)

### 4. 集成工作流
**代码质量改进流程**: 1.IDENTIFY识别异味(清单+分级) → 2.DIAGNOSE诊断根因 → 3.PLAN选重构/模式(考虑依赖/估算影响) → 4.PREPARE保证测试 → 5.EXECUTE小步改动(每步测试) → 6.VERIFY全集测试+查新异味

**异味→重构→模式流**: 方法级→Extract Method | 类级→Extract Class | 关系级→Move/Hide Delegate | 否则→选最佳模式(创建型/结构型/行为型)

### 5. 协作
| 协作技能 | 方式 | 说明 |
|---------|------|------|
| test-driven-development | 顺序 | 重构前先写测试 |
| systematic-debugging | 咨询 | 修复前找根因 |
| requesting-code-review | 参考 | 重构后获取反馈 |
| pdd-code-reviewer | 参考 | PDD项目代码审查 |
| software-engineer | 委托 | 代码实现后质量检查 |

### 6. 快速决策矩阵
重复代码/方法过长→Extract Method | 类过大→Extract Class | 参数过长→Parameter Object | 类型switch→Polymorphism | 单实例→Singleton | 灵活创建→Factory/Builder | 接口不兼容→Adapter | 加行为→Decorator | 复杂子系统→Facade | 算法变化→Strategy | 事件通知→Observer

### 7. 反模式
**重构反模式**: Big Bang(一次全重写)→小步增量 | 无测试重构→先写测试 | 过度重构→清晰即停 | 重构成瘾→平衡功能 | 随机重构→先识别异味
**模式反模式**: Pattern Obsession(到处用模式)→按需 | Singleton滥用→真需要才用 | Factory过度→多产品才用 | Decorator嵌套过深→限制深度 | Premature Pattern(过早用模式)→重构中自然浮现

### 8. 实践清单
**代码审查清单**: [ ]无关键异味 [ ]方法<20行 [ ]类单一职责 [ ]无重复代码 [ ]条件清晰 [ ]命名有意义 [ ]测试存在且通过 [ ]符合SOLID [ ]模式用得恰当
**重构安全清单**: [ ]所有测试通过 [ ]测试覆盖目标 [ ]理解功能 [ ]有回滚方案 [ ]小步改动 [ ]每步测试
**模式应用清单**: [ ]问题匹配模式意图 [ ]解决真实问题 [ ]团队理解 [ ]不过度复杂化 [ ]考虑替代方案 [ ]符合项目上下文

## Guardrails
- 基于Martin Fowler重构目录和GoF设计模式给建议
- 重构建议需具体代码转换示例
- 模式应用需权衡利弊，不盲目推荐
- 代码审查需具体指出问题和改进建议
- 不确定的问题明确说明，避免误导

## 版本历史
| 版本 | 日期 | 变更 |
|------|------|------|
| 2.0 | 2026-03-21 | 统一中文描述，增加协作表，增强决策矩阵 |
| 1.0 | 早期 | 基础质量检测/重构目录/模式参考 |

> 记住: 好代码的关键是清晰而非聪明。重构和模式是达成清晰的手段，而非目的本身。