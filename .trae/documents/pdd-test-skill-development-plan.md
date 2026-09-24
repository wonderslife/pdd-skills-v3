# PDD Test Skill 开发计划

> **基于文档**: [2026-05-08-pdd-test-skill-design.md](../docs/superpowers/specs/2026-05-08-pdd-test-skill-design.md)
> **评估报告**: 见用户提供的详细评估（综合评分 85%+）
> **策略选择**: 纯 Skill 模式优先落地（推荐方案 A）
> **预估工期**: Phase 1（2-3天）→ Phase 2（1周）→ Phase 3（持续优化）

***

## 一、核心决策

### ✅ 已确认的架构决策

| 决策项       | 选择                                  | 理由                                  |
| --------- | ----------------------------------- | ----------------------------------- |
| **实施路径**  | 纯 Skill 模式（方案 A）                    | 快速验证、低风险、AI 原生能力足够                  |
| **模块化程度** | 轻量级（仅 Skill + 配置 + 示例）              | 避免过度工程化，先验证可行性                      |
| **代码风格**  | ESM（与项目一致）                          | `package.json` 中 `"type": "module"` |
| **配置格式**  | YAML                                | 可读性好、支持注释、Git 友好                    |
| **结果目录**  | `test-results/`（独立于现有 `testcases/`） | 避免路径混淆                              |

### ⚠️ 关键技术约束

1. **ESM 兼容性**
2. **CDP MCP 工具集**：需要先在 Trae 中验证实际可用的 Chrome DevTools MCP 工具名和参数
3. **安全处理**：密码等敏感信息必须使用环境变量，禁止明文硬编码

***

## 二、开发阶段划分

### 📋 Phase 1：基础框架搭建（预计 2-3 天）

**目标**：创建最小可用版本（MVP），验证"对话 → YAML → 执行"全流程

#### 任务清单

##### Task 1.1：创建动作配置文件 ⭐⭐⭐

**优先级**: P0（最高）
**文件**: `config/test-actions.yaml`
**内容**:

- 从设计文档 §3.2 复制完整的 18 个内置动作定义
- 包含导航、表单操作、文件操作、断言验证、网络校验、等待、截图、滚动
- 每个 action 包含: display, patterns, mcp, params

**验收标准**:

- [ ] YAML 格式正确，可通过 `yaml.parse()` 解析
- [ ] 至少包含 15 个常用动作定义
- [ ] 每个 action 有清晰的 patterns 示例

***

##### Task 1.2：创建 testcase-modeler Skill ⭐⭐⭐

**优先级**: P0
**目录**: `skills/expert/testcase-modeler/`
**文件列表**:

```
skills/expert/testcase-modeler/
├── SKILL.md              # 主技能文档（6 条建模规则）
├── _meta.json            # 元数据
├── examples/             # 示例用例
│   ├── asset-eval-apply.yaml
│   └── login-flow.yaml
└── evals/
    └── default-evals.json
```

**SKILL.md 核心内容**:

1. **触发条件**: 用户描述测试需求时自动触发
2. **6 条建模规则**（来自 §六）:
   - 规则 1：结构完整性（必填字段）
   - 规则 2：智能意图提取（NLU 映射）
   - 规则 3：语义化选择器优先
   - 规则 4：断言注入（每步必须配对）
   - 规则 5：安全处理（环境变量）
   - 规则 6：生成后确认（展示摘要）
3. **输出规范**: 标准 YAML 格式（参考 §四）
4. **交互流程**: 对话式录入 → 实时预览 → 确认导出

**\_meta.json 配置**:

```json
{
  "name": "testcase-modeler",
  "version": "1.0.0",
  "category": "expert",
  "description": "测试用例建模师 - 自然语言转YAML测试用例",
  "triggers": [
    "测试用例", "录制测试", "生成测试", "帮我测试",
    "test case", "record test", "generate test"
  ],
  "configFiles": ["config/test-actions.yaml"]
}
```

**验收标准**:

- [ ] SKILL.md 包含完整的 6 条规则和示例
- [ ] \_meta.json 配置正确，能被 pdd-skills 识别
- [ ] 至少提供 2 个示例 YAML 文件

***

##### Task 1.3：创建 testcase-agent Skill ⭐⭐⭐

**优先级**: P0
**目录**: `skills/expert/testcase-agent/`
**文件列表**:

```
skills/expert/testcase-agent/
├── SKILL.md              # 主技能文档（5 条铁律）
├── _meta.json            # 元数据
├── templates/
│   └── report-template.html  # HTML 报告模板
└── evals/
    └── default-evals.json
```

**SKILL.md 核心内容**:

1. **触发条件**: 接收到 YAML 测试用例文件或路径时触发
2. **5 条 Iron Law**（来自 §五）:
   - 铁律 1：状态感知优先（context\_check）
   - 铁律 2：原子化执行（每步截图+记录）
   - 铁律 3：深度网络校验（verify\_network）
   - 铁律 4：自愈而非放弃（多策略降级）
   - 铁律 5：报告完整性（HTML 报告）
3. **执行流程**:
   ```
   加载 YAML → 加载 action 配置 → context_check 
   → 逐条执行 steps → 断言验证 → 自愈/重试 
   → 生成报告
   ```
4. **元素定位策略**（§七）:
   - UID 缓存 → 语义匹配 → 文本匹配 → AI 辅助
5. **错误处理**:
   - 元素未找到 → 启动自愈程序
   - 断言失败 → 记录诊断信息
   - 网络异常 → 重试 + 截图证据

**验收标准**:

- [ ] SKILL.md 包含完整的 5 条铁律和详细流程图
- [ ] HTML 报告模板结构完整
- [ ] 明确说明如何调用 CDP MCP 工具

***

##### Task 1.4：创建全局配置文件 ⭐⭐

**优先级**: P1
**文件**: `config/cdp-test-config.yaml`
**内容**（来自 §十一）:

```yaml
mcp:
  server_type: "Chrome DevTools MCP"

test_settings:
  screenshot_on_each_step: true
  screenshot_on_failure: true
  network_monitor: true
  self_healing: true
  report_format: "html"
  results_dir: "test-results"  # 注意：不是 testcases/

env_mapping:
  TEST_USER: "${TEST_USER}"    # 从系统环境变量读取
  TEST_PASS: "${TEST_PASS}"    # 禁止明文密码！
  BASE_URL: "${BASE_URL}"

retry:
  max_attempts: 3
  backoff: 1000ms
  self_heal_before_retry: true
```

**安全要求**:

- [ ] 所有敏感字段使用 `${VAR}` 占位符
- [ ] 提供默认值但标注为示例（非真实密码）
- [ ] 在文档中明确说明如何设置环境变量

***

##### Task 1.5：创建协同模式配置 ⭐

**优先级**: P2（可选，Phase 1.5 实现）
**文件**: `config/collab-config.yaml`
**内容**（来自 §3.5）:

- 监听配置（poll\_interval, snapshot\_diff\_threshold）
- 记录配置（auto\_infer\_intent, show\_step\_preview）
- UI 反馈配置（position, auto\_hide\_after, style）

**注意**: 此配置用于未来实现人机协同模式，Phase 1 可暂不实现功能。

***

##### Task 1.6：修复 ESM 兼容性问题 🔧

**问题**: 之前创建的 `lib/test-engine/*.js` 使用了 `require()`，与 ESM 不兼容
**解决方案**:

**选项 A（推荐）**: 删除或重命名为 `.cjs`，Phase 1 不依赖这些文件

```bash
# 如果保留作为参考，重命名
mv lib/test-engine/collaborative-recorder.js lib/test-engine/collaborative-recorder.cjs
mv lib/test-engine/intent-inferrer.js lib/test-engine/intent-inferrer.cjs
mv lib/test-engine/guided-executor.js lib/test-engine/guided-executor.cjs
```

**选项 B**: 转换为 ESM 语法（如果 Phase 2 需要）

```javascript
// 将 require 改为 import
import { EventEmitter } from 'events';
import readline from 'readline';
// ... 其他 import
export default class CollaborativeRecorder { ... }
```

**验收标准**:

- [ ] Phase 1 的所有文件都使用 ESM 语法
- [ ] 或明确标记 `.cjs` 文件为 CommonJS（仅供参考）
- [ ] 无 `require is not defined` 错误

***

### 📋 Phase 2：核心功能验证（预计 1 周）

**目标**: 用真实业务场景验证 MVP，收集反馈并迭代

#### Task 2.1：试点业务场景

**场景选择**:

1. **登录流程测试**（简单，适合首次验证）
   - 打开统一门户 → 输入凭据 → 登录 → 验证首页
2. **资产评估申请流程**（中等复杂度）
   - 登录 → 进入资产评估系统 → 导航到核准申请 → 新增申请 → 填写表单 → 提交

**验证点**:

- [ ] testcase-modeler 能否从对话生成正确的 YAML？
- [ ] testcase-agent 能否正确调用 CDP MCP 执行步骤？
- [ ] 断言是否准确？自愈机制是否生效？
- [ ] 生成的 HTML 报告是否可读？

#### Task 2.2：完善 CLI 入口（可选）

**命令**:

```bash
pdd test record -m <module> -n <name>     # 启动 modeler
pdd test replay <script.yaml>               # 启动 agent
pdd test actions list                       # 列出所有动作
pdd test report --input ./tests/ -o ./test-results/reports/
```

**实现方式**:

- 在 `bin/pdd.js` 中添加 `test` 子命令
- 或创建独立的入口脚本 `bin/pdd-test.js`

#### Task 2.3：HTML 报告模板优化

**内容**:

- 每步截图缩略图 + 点击放大
- 通过/失败状态图标
- 失败步骤的诊断建议
- 执行时间线视图
- 导出 PDF 功能（可选）

***

### 📋 Phase 3：高级特性与推广（持续）

#### Task 3.1：人机协同模式实现

**前提**: Phase 2 验证成功后
**内容**:

- 模式 A：用户操作 + AI 记录（CollaborativeRecorder）
- 模式 B：AI 引导 + 用户确认（GuidedExecutor）
- 模式 C：并行探索对比

**技术实现**:

- DOM 变化监听器（轮询或 MutationObserver）
- UID 自动缓存机制
- 智能推断引擎（IntentInferrer）
- 交互协议定义（UserMessage / AIMessage）

#### Task 3.2：CI/CD 集成

**集成点**:

- Jenkins/GitHub Actions 自动化运行
- 与 pdd-main verify-feature 阶段联动
- 测试结果通知（钉钉/企业微信/邮件）

#### Task 3.3：性能优化

- 批量执行多个 YAML 用例
- 并行执行（多标签页）
- 缓存机制（UID 缓存持久化）
- 增量执行（只跑变化的用例）

***

## 三、文件创建清单

### Phase 1 必须创建的文件

```
pdd-skills-v3/
├── config/
│   ├── test-actions.yaml          # ⭐ 动作配置（18 个内置动作）
│   ├── cdp-test-config.yaml       # 全局测试配置
│   └── collab-config.yaml         # 协同模式配置（预留）
│
├── skills/expert/
│   ├── testcase-modeler/          # ⭐ 测试用例建模 Skill
│   │   ├── SKILL.md
│   │   ├── _meta.json
│   │   ├── examples/
│   │   │   ├── asset-eval-apply.yaml
│   │   │   └── login-flow.yaml
│   │   └── evals/
│   │       └── default-evals.json
│   │
│   └── testcase-agent/            # ⭐ 自动化测试执行 Skill
│       ├── SKILL.md
│       ├── _meta.json
│       ├── templates/
│       │   └── report-template.html
│       └── evals/
│           └── default-evals.json
│
├── tests/                         # 测试用例存储（用户维护）
│   ├── README.md                  # 用例编写指南
│   └── _login-template.yaml      # 通用登录模板
│
└── test-results/                  # 测试结果输出（gitignore）
    ├── .gitkeep
    └── screenshots/
        └── .gitkeep
```

### Phase 1 可选修改的文件

```
# 更新 package.json 的 bin 字段（添加 pdd test 命令）
# 更新 .gitignore（添加 test-results/）
# 更新 docs/superpowers/specs/ 下的设计文档（如有必要）
```

***

## 四、关键技术要点

### 4.1 CDP MCP 工具映射表

**需要在 Trae 中验证的实际工具名**：

| 设计文档中的工具名               | 预期实际工具名                                         | 用途        |
| ----------------------- | ----------------------------------------------- | --------- |
| `navigate_page`         | `mcp_Chrome_DevTools_MCP_navigate_page`         | 页面导航      |
| `take_snapshot`         | `mcp_Chrome_DevTools_MCP_take_snapshot`         | 获取 DOM 快照 |
| `click`                 | `mcp_Chrome_DevTools_MCP_click`                 | 点击元素      |
| `fill`                  | `mcp_Chrome_DevTools_MCP_fill`                  | 填写输入框     |
| `select_option`         | `mcp_Chrome_DevTools_MCP_select_option`         | 下拉选择      |
| `upload_file`           | `mcp_Chrome_DevTools_MCP_upload_file`           | 文件上传      |
| `wait_for`              | `mcp_Chrome_DevTools_MCP_wait_for`              | 等待元素      |
| `take_screenshot`       | `mcp_Chrome_DevTools_MCP_take_screenshot`       | 截图        |
| `evaluate_script`       | `mcp_Chrome_DevTools_MCP_evaluate_script`       | 执行 JS     |
| `list_network_requests` | `mcp_Chrome_DevTools_MCP_list_network_requests` | 网络请求      |

**验证方法**:
在 Trae 中输入：`列出 Chrome DevTools MCP 提供的所有可用工具及参数`

### 4.2 YAML 用例标准模板

```yaml
# tests/{module}/{scene}.yaml
test_id: "{MODULE}-{NNN}"
title: "{人类可读标题}"
priority: "P0"  # P0/P1/P2
tags: ["{标签1}", "{标签2}"]
author: "通过对话录入"

context_check:
  login_url: "http://example.com/login"
  home_indicator: "首页特征文本"
  credentials:
    username: "${TEST_USER}"
    password: "${TEST_PASS}"

steps:
  - step: 1
    desc: "{步骤描述}"
    action: "{action_type}"
    target: "{目标元素}"
    value: "${value}"
    locator:
      uid_cache_key: "{cache_key}"
    assertion:
      type: "{assertion_type}"
      expected: "{expected_value}"

teardown:
  - action: screenshot
    name: "result-{timestamp}.png"
```

### 4.3 安全最佳实践

✅ **正确做法**:

```yaml
env_mapping:
  TEST_USER: "${TEST_USER}"  # 从环境变量读取
  TEST_PASS: "${TEST_PASS}"  # 禁止明文！
```

❌ **错误做法**:

```yaml
env_mapping:
  TEST_USER: "yuanye"       # ❌ 硬编码用户名
  TEST_PASS: "yuanye"       # ❌ 明文密码！绝对禁止！
```

***

## 五、风险缓解措施

### 🔴 高风险

| 风险                 | 影响   | 缓解措施                                      |
| ------------------ | ---- | ----------------------------------------- |
| **CDP MCP 工具集不匹配** | 无法执行 | Phase 1 前必须验证实际工具名；在 SKILL.md 中使用抽象层，便于调整 |
| **ESM 兼容性问题**      | 运行报错 | 统一使用 ESM 语法；删除旧的 CommonJS 文件或重命名为 .cjs    |

### 🟡 中风险

| 风险           | 影响     | 缓解措施                 |
| ------------ | ------ | -------------------- |
| **NLU 理解歧义** | 动作识别错误 | 未知动作引导机制（§3.4）；相似度推荐 |
| **页面结构变化**   | UID 失效 | 多策略降级 + 自愈引擎；定期更新缓存  |
| **实习生误操作**   | 生成错误用例 | 步骤预览 + 确认机制；撤销/重做功能  |

### 🟢 低风险

| 风险           | 影响    | 缓解措施                       |
| ------------ | ----- | -------------------------- |
| **配置文件格式错误** | 无法加载  | 启动时验证；友好的错误提示              |
| **报告样式不美观**  | 用户体验差 | 使用成熟模板库（如 Bootstrap）；允许自定义 |

***

## 六、成功指标（KPI）

### Phase 1 完成标志

- [ ] `config/test-actions.yaml` 创建完成，包含 ≥15 个动作
- [ ] `skills/expert/testcase-modeler/SKILL.md` 创建完成，包含 6 条规则
- [ ] `skills/expert/testcase-agent/SKILL.md` 创建完成，包含 5 条铁律
- [ ] 提供 ≥2 个示例 YAML 用例文件
- [ ] 无 ESM 兼容性错误（所有文件通过语法检查）
- [ ] 能在 Trae 中被识别为新 Skill（`pdd list` 可见）

### Phase 2 完成标志

- [ ] 成功用 testcase-modeler 生成 ≥1 个真实业务用例
- [ ] 成功用 testcase-agent 执行 ≥1 个 YAML 用例（端到端通过）
- [ ] 生成的 HTML 报告包含截图和断言结果
- [ ] 自愈机制至少触发 1 次（模拟选择器变化场景）

### 长期目标（Phase 3 后）

- [ ] 用例编写时间 ↓90%（从 30-60 分钟降至 3-5 分钟）
- [ ] 维护成本 ↓70-80%（UID 缓存 + 自愈）
- [ ] 测试覆盖率 ↑3-5 倍（所有测试人员都能贡献用例）
- [ ] 执行稳定性 ↑3-4 倍（误判率从 15-20% 降至 <5%）

***

## 七、下一步行动

### 立即执行（今天）

1. ✅ **验证 CDP MCP 工具集**
   - 在 Trae 中运行：`列出 Chrome DevTools MCP 的所有可用工具`
   - 记录实际工具名和参数格式
   - 更新 `config/test-actions.yaml` 中的 `mcp:` 字段
2. ✅ **创建 Phase 1 核心文件**
   - 按照本计划的 Task 1.1-1.4 顺序创建文件
   - 优先完成 `test-actions.yaml` 和两个 SKILL.md
3. ✅ **清理旧文件**
   - 删除或重命名 `lib/test-engine/*.js` 为 `.cjs`
   - 更新 `.gitignore` 添加 `test-results/`

### 本周内完成

1. 编写示例 YAML 用例（登录流程 + 资产评估申请）
2. 在 Trae 中测试 Skill 识别和加载
3. 用简单场景验证"对话 → YAML → 执行"流程

### 下周

1. 收集反馈，迭代优化 SKILL.md
2. 实现更多高级特性（如需要）

***

## 八、附录

### A. 参考文档

- [设计文档 v1.0](../docs/superpowers/specs/2026-05-08-pdd-test-skill-design.md)
- [Claude Opus v0.1 设计](../docs/cdp-testing-framework-design.md)
- [现有 Skill 示例](../skills/expert/expert-bug-fixer/SKILL.md)

### B. 相关 Issue/任务追踪

（待创建 GitHub Issues 或项目管理工具任务）

### C. 版本历史

| 版本   | 日期         | 作者           | 变更说明               |
| ---- | ---------- | ------------ | ------------------ |
| v1.0 | 2026-05-08 | AI Assistant | 初始版本，基于设计文档和评估报告生成 |

***

> **文档维护者**: 开发团队\
> **最后更新**: 2026-05-08\
> **状态**: 待审批

