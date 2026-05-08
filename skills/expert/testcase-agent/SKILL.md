# Testcase Agent Skill - 自动化测试执行专家

> **版本**: 1.0.1
> **分类**: Expert Skill
> **作者**: PDD Team
> **最后更新**: 2026-05-08
> **文档结构**: 主文件 (本文件) + references/ (详细参考)

---

## 📌 技能概述

**Testcase Agent** 是一个基于 Chrome DevTools MCP 的 E2E 测试自动化执行引擎。它读取由 Testcase Modeler 生成的 YAML 测试用例，通过 CDP 协议直接操控浏览器，完成测试执行、断言验证、错误自愈和报告生成的全流程。

### 核心能力

- ✅ **YAML 驱动执行**：零代码运行结构化测试用例
- ✅ **5 条铁律保障质量**：确保每步都有截图、验证和诊断
- ✅ **智能元素定位**：UID 缓存 + 语义匹配 + AI 辅助（4 级降级）
- ✅ **自愈机制**：选择器失效时自动修复并记录
- ✅ **深度网络校验**：不只看 UI，还验证底层 API 调用
- ✅ **专业报告生成**：HTML 报告含截图、时间线、诊断建议

### 与 Modeler 的关系

```
Testcase Modeler (建模)          Testcase Agent (执行)
┌─────────────────────┐           ┌─────────────────────┐
│ 用户自然语言描述     │  ───YAML──▶  │ 读取 YAML 用例        │
│ ↓                    │           │ ↓                    │
│ 智能意图提取         │           │ context_check 状态感知  │
│ ↓                    │           │ ↓                    │
│ 生成标准 YAML 用例   │           │ 逐条执行 steps         │
│ ↓                    │           │ ↓                    │
│ 安全处理 + 断言注入   │           │ 每步: 截图 + 验证       │
└─────────────────────┘           │ ↓                    │
                                   │ 自愈/重试              │
                                   │ ↓                    │
                                   │ 生成 HTML 报告        │
                                   └─────────────────────┘
```

---

## 🎯 触发条件（v1.0.1 增强）

**⚡ 主动触发原则**：当用户提到以下任何关键词或场景时，即使没有明确说"执行测试"，也应主动使用本技能运行测试并生成报告。

### 🇨🇳 中文触发词（口语化 + 正式 + 高级用法）

#### 核心执行类（必识别）
- "执行这个测试用例" / "执行测试"
- "运行 tests/xxx.yaml" / "运行yaml文件"
- "回放刚才录制的测试" / "重放刚才的测试"
- "帮我跑一下这个 YAML" / "跑一下这个yaml"
- "开始自动化测试" / "开始自动化"

#### 调试与报告类（新增）
- "单步调试" / "带截图执行"
- "生成测试报告" / "查看测试报告"
- "调试测试用例" / "验证测试结果"

#### 批量与集成类（新增）
- "批量执行测试" / "并行测试"
- "CI/CD集成" / "Jenkins执行"
- "夜间回归" / "自动化回归"

### 📄 文件触发（自动检测）

当用户提供以下内容时，**立即触发**：

1. **YAML 文件路径**：`pdd test replay ./tests/login/portal-login.yaml`
2. **YAML 内容粘贴**：包含 `test_id:`, `steps:`, `action:` 的文本
3. **Modeler 输出引用**："将刚才生成的用例执行一下"

---

## ⚖️ 五条 Iron Law（铁律）摘要

> ⚠️ **必须严格遵守以下 5 条规则**，确保测试执行的可靠性和可追溯性。
> 
> 💡 **完整实现细节请参阅** [references/iron-rules-detail.md](./references/iron-rules-detail.md)

### 铁律 1：状态感知优先（Context Check First）

**核心**：在执行任何 steps 之前，必须先检查当前浏览器是否已登录。

**执行逻辑**：
1. 读取 YAML 的 `context_check` 配置
2. 获取当前页面 URL 和快照
3. 判断登录状态（通过 `home_indicator` 特征文本检测）
4. 已登录 → 跳过登录步骤；未登录 → 自动执行登录流程
5. 特殊处理：Session 过期、多标签页、SSO 跳转、验证码拦截

**强制要求**：
- [ ] 必须在第一个 step 前调用状态检测
- [ ] 必记录检测结果到日志
- [ ] Session 过期时必须立即停止

📖 **详细说明** → [铁律1完整实现](./references/iron-rules-detail.md#铁律-1状态感知优先context-check-first)

---

### 铁律 2：原子化执行（Atomic Execution）

**核心**：每完成一个 step，必须立即进行三项操作：截图保存、记录响应数据、评估断言结果。

**三项强制操作**：
1. **截图保存**（操作后强制）：`step_{N}_{action}_{timestamp}.png`
2. **记录响应数据**：MCP 工具调用参数、返回值、耗时
3. **评估断言结果**：断言类型、期望值、实际值、通过/失败

**示例输出**：
```json
{
  "step": 3,
  "action": "fill",
  "target": "用户名输入框",
  "duration_ms": 245,
  "screenshot": "step_3_fill_20260508_143052.png",
  "assertion_result": { "type": "field_filled", "passed": true }
}
```

📖 **详细说明** → [铁律2完整实现](./references/iron-rules-detail.md#铁律-2原子化执行atomic-execution)

---

### 铁律 3：深度网络校验（Deep Network Verification）

**核心**：凡是涉及提交/保存/删除等改变数据的操作，必须通过网络工具监控 API 调用。

**触发场景**：
| 操作类型 | 必须校验 |
|---------|---------|
| 表单提交 | POST /api/save |
| 删除操作 | DELETE /api/{id} |
| 文件上传 | POST /api/upload |
| 导出下载 | GET /api/export |

**假阳性识别**：UI 显示"成功"但 API 未调用或失败 → 标记为 FAILED

```yaml
# 示例：提交按钮的双重断言
assertions:
  - type: toast_visible        # UI层
    expected: "保存成功"
  - type: network_called       # 网络层（强制！）
    url_pattern: "/api/apply*"
    method: POST
    response_code: 200
```

📖 **详细说明** → [铁律3完整实现](./references/iron-rules-detail.md#铁律-3深度网络校验deep-network-verification)

---

### 铁律 4：自愈而非放弃（Self-Healing, Not Give Up）

**核心**：当按照 target 描述找不到元素时，禁止直接报错终止。必须启动 4 级降级自愈程序。

**4 级降级策略**：
```
Level 1: UID 缓存查找   (<1ms, 命中率~95%复用时)
  ↓ 失败
Level 2: 精确语义匹配   (~50ms, 命中率~80%)
  ↓ 失败
Level 3: 模糊匹配       (~100ms, 命中率~65%)
  ↓ 失败
Level 4: AI 辅助        (~500ms-2s, 命中率~55%, 兜底)
```

**整体自愈成功率目标 > 65%**

**自愈成功示例**：
```
目标: "资产评估核准"
→ Level 2 未找到精确匹配
→ Level 3 发现 <span>资产评估核准管理</span> (相似度87%)
✓ 使用模糊匹配结果，更新缓存
```

📖 **完整实现** → [references/self-healing-strategy.md](./references/self-healing-strategy.md) （独立文档，约500行）

---

### 铁律 5：报告完整性（Report Completeness）

**核心**：执行完毕后，必须生成完整的 HTML 测试报告。

**报告必须包含**：
- ✅ 基本信息（ID、标题、时间、版本）
- ✅ 执行摘要（总步骤、通过率、状态）
- ✅ 每步详细记录（描述、动作、目标、耗时、截图、断言）
- ✅ 失败步骤的详细诊断和建议
- ✅ 统计图表（饼图、柱状图）
- ✅ 附录（环境变量使用、网络日志、UID缓存变更）

**输出位置**：`test-results/reports/{test_id}_report_{timestamp}.html`

📖 **详细说明** → [铁律5完整实现](./references/iron-rules-detail.md#铁律-5报告完整性report-completeness)

---

## 🔧 执行流程概览

### 完整执行流水线（5个阶段）

```
1️⃣  初始化阶段 (Initialization)
   ├── 加载 YAML 用例文件
   ├── 解析并验证 YAML 结构
   ├── 加载 config/test-actions.yaml 动作配置
   ├── 加载 config/cdp-test-config.yaml 全局配置
   ├── 初始化环境变量（从 env_mapping）
   └── 创建输出目录结构

2️⃣  状态检测阶段 (Context Check) 【铁律 1】
   ├── 获取当前浏览器状态
   ├── 检测登录状态
   ├── 如未登录 → 执行登录流程
   └── 如已登录 → 记录状态，准备执行

3️⃣  步骤执行阶段 (Step Execution)
   │   FOR EACH step IN yaml.steps:
   │   ├── 3.1 动作解析与参数验证
   │   ├── 3.2 元素定位 【铁律 4】(4级降级)
   │   ├── 3.3 执行动作 (MCP工具调用)
   │   ├── 3.4 截图与记录 【铁律 2】(强制)
   │   ├── 3.5 断言验证 (UI + 网络【铁律 3】)
   │   └── 3.6 结果汇总 (PASS/FAIL/SKIP/ERROR)
   └── END FOR

4️⃣  清理阶段 (Teardown)
   ├── 执行 YAML 的 teardown 部分
   ├── 最终截图
   └── 收集网络日志和控制台日志

5️⃣  报告生成阶段 (Reporting) 【铁律 5】
   ├── 汇总所有步骤结果
   ├── 生成统计信息和图表
   ├── 组装 HTML 报告
   └── 输出到 test-results/reports/
```

---

## 🚀 快速开始指南

### 场景 1：执行单个测试用例

```bash
# 基础执行
pdd test replay tests/login/portal-login.yaml

# 调试模式（单步执行）
pdd test replay tests/login/portal-login.yaml --debug

# 指定环境变量
pdd test replay tests/login/portal-login.yaml \
  --env TEST_USER=admin \
  --env TEST_PASS=password123
```

### 场景 2：批量执行

```bash
# 执行目录下所有用例
pdd test replay ./tests/asset-eval/

# 并行执行（最多3个标签页）
pdd test replay tests/*.yaml --parallel --max-tabs=3

# 只执行失败的用例
pdd test replay ./tests/ --rerun-failed
```

### 场景 3：在对话中使用

当用户说：
> "执行这个 login-flow.yaml"

Agent 应该：
1. 读取 YAML 文件并解析
2. 按照 5 条铁律依次执行
3. 实时展示进度和结果
4. 生成 HTML 报告并提供预览链接

---

## 📚 参考文档索引

本技能采用三层文档结构，详细信息存储在 `references/` 目录中：

| 文档 | 内容 | 行数 | 适用场景 |
|------|------|------|---------|
| **[iron-rules-detail.md](./references/iron-rules-detail.md)** | 5条铁律的完整实现细节、代码示例、验收清单 | ~600行 | 深入理解执行规则、自定义行为 |
| **[self-healing-strategy.md](./references/self-healing-strategy.md)** | 4级降级策略详解、UID缓存机制、成功/失败案例 | ~500行 | 排查元素定位问题、优化自愈率 |
| **[error-handling.md](./references/error-handling.md)** | 错误分类体系、重试策略配置、处理流程图 | ~450行 | 配置错误处理、分析失败原因 |
| **[cli-reference.md](./references/cli-reference.md)** | 所有CLI命令、选项、参数、CI/CD集成示例 | ~550行 | 命令行使用、自动化脚本编写 |

### 何时阅读参考文档？

**日常使用（只需主文件）**：
- 了解基本概念和触发条件
- 查看铁律摘要
- 执行标准测试用例

**需要深入时（阅读references/）**：
- 自定义错误处理策略 → error-handling.md
- 排查元素定位问题 → self-healing-strategy.md
- 编写CI/CD脚本 → cli-reference.md
- 理解某个铁律的实现细节 → iron-rules-detail.md

---

## 🔗 相关资源

### 上游依赖
- **[Testcase Modeler SKILL](../testcase-modeler/SKILL.md)** - 生成 YAML 测试用例

### 配置文件
- **[config/test-actions.yaml](../../config/test-actions.yaml)** - 所有可用动作定义
- **[config/cdp-test-config.yaml](../../config/cdp-test-config.yaml)** - 全局测试框架配置

### 报告模板
- **[templates/report-template.html](./templates/report-template.html)** - HTML 报告结构和样式

### 设计文档
- **[设计文档 v1.0](../../../docs/superpowers/specs/2026-05-08-pdd-test-skill-design.md)** - 完整的设计方案

---

## ❓ 常见问题（FAQ）

**Q1: 如何在对话中使用本技能？**
A: 当你提供 YAML 文件路径、粘贴 YAML 内容，或说"执行/运行/回放测试"时自动触发。

**Q2: 执行失败时如何排查？**
A: 查看 HTML 报告中的失败步骤详情，包含诊断信息和修复建议。也可使用 `--debug` 模式单步执行。

**Q3: 如何提高自愈成功率？**
A: 确保 YAML 中的 target 描述准确且稳定。定期更新 UID 缓存。参见 [self-healing-strategy.md](./references/self-healing-strategy.md) 的优化建议。

**Q4: 支持哪些浏览器？**
A: 通过 Chrome DevTools MCP，支持 Chromium 内核的所有浏览器（Chrome、Edge、Brave 等）。需确保浏览器开启了远程调试端口。

**Q5: 如何集成到 CI/CD？**
A: 使用 CLI 命令配合 JUnit XML 输出格式。详见 [cli-reference.md](./references/cli-reference.md) 的 Jenkins/GitHub Actions 示例。

---

> **版本历史**
> - v1.0.0 (2026-05-08): 初始版本，包含完整的774行SKILL.md
> - v1.0.1 (2026-05-08): 重构为三层结构，主文件精简至<300行，详细内容移至references/
>
> **维护者**: PDD Team  
> **许可证**: MIT
