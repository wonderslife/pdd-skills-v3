# 本地模型 AI 测试框架设计文档 (v2.1)

> **目标**: 构建高成功率、模块化、专门针对本地模型（7B-32B）优化的 AI 测试执行框架。
> **相关技能**: `testcase-modeler` (用例生成), `testcase-agent` (测试执行)
> **版本**: v2.1 (Modular) | **状态**: ✅ 已实现，待 E2E 验证
> **代码位置**: `asset-eval-analysis/testcases/runner/`

---

## 一、 背景与痛点分析

在早期的 `testcase-ai.py`（单体 ~2300 行）尝试中，暴露出以下问题：

| # | 痛点 | 影响 | v2.0 解决方案 |
|---|------|------|---------------|
| 1 | DOM 解析脆弱 — 正则暴力解析 MCP 快照文本 | 前端框架属性变化即崩溃 | DOM Pruner 剪枝引擎 |
| 2 | 本地模型上下文溢出 — 50K tokens 原始 DOM | 截断、注意力分散、幻觉 | 50K → ~1K tokens 压缩 |
| 3 | 架构单体化 — 单文件 2000+ 行 | 难以维护和扩展 | 9 文件模块化架构 |
| 4 | 与 Agent 技能割裂 — 不兼容 testcase-modeler YAML | 无法复用生成的用例 | 完整 YAML 解析器 |

---

## 二、 核心设计理念

### 2.1 混合执行模式 (Hybrid Execution)

明确能力边界，避免让 LLM 做它不擅长的事：

```
┌─────────────────────────────────────────────────────┐
│                    执行决策层                        │
│                                                     │
│  ┌──────────────┐         ┌──────────────┐          │
│  │  算法负责     │         │  LLM 负责     │          │
│  │              │         │              │          │
│  │ • DOM 提取   │         │ • 意图推理    │          │
│  │ • 元素坐标   │    ←→   │ • 目标选择    │          │
│  │ • 点击/输入  │         │ • 断言判断    │          │
│  │ • 重试策略   │         │ • 自愈修复    │          │
│  └──────────────┘         └──────────────┘          │
│                                                     │
│  确定性逻辑 = 零幻觉        概率性推理 = 创造力      │
└─────────────────────────────────────────────────────┘
```

**原则**: 凡是能用算法确定的（DOM 结构提取、元素定位、操作执行），绝不交给 LLM。LLM 只做"语义理解"这一件事。

### 2.2 DOM 剪枝 (DOM Pruning)

不再发送整个页面的 HTML 或 CDP 原始快照。通过 MCP 的 `take_snapshot` 接口获取 a11y 树后，在 Python 端过滤：

| 过滤规则 | 说明 |
|---------|------|
| **保留** | INTERACTIVE_ROLES: button, link, textbox, input, combobox, select, checkbox, radio, menuitem, tab, treeitem |
| **保留** | SEMANTIC_ROLES: heading, listbox, option, slider, spinbutton, searchbox |
| **忽略** | IGNORE_ROLES: graphic, document, group, generic, img, separator, presentation, text (纯文本节点) |
| **截断** | 每个元素的 text/name 超过 80 字符时截断 |

**效果**: 典型企业级前端页面从 ~50,000 tokens 降至 ~1,000 tokens。

### 2.3 本地模型专项适配

兼容 OpenAI Chat Completions API 格式，支持所有提供 `/v1/chat/completions` 端点的本地服务：

| 服务 | 示例配置 |
|------|---------|
| vLLM | `LLM_BASE_URL=http://host:8005/v1`, `LLM_MODEL=gemma-4-26B-A4B-it` |
| Ollama | `LLM_BASE_URL=http://localhost:11434/v1`, `LLM_MODEL=qwen2.5:32b` |
| LM Studio | `LLM_BASE_URL=http://localhost:1234/v1`, `LLM_MODEL=local-model` |

---

## 三、 模块化架构设计

### 3.1 目录结构

```
testcases/runner/                          # 框架根目录
├── __init__.py                            # 包初始化 + 统一导出
├── main.py                                # CLI 入口（命令行调度）
├── config.py                              # 配置管理（4 个 dataclass）
├── yaml_parser.py                         # YAML 解析器（testcase-modeler 兼容）
├── mcp_client.py                          # Chrome DevTools MCP 通信封装
├── dom_pruner.py                          # [核心] DOM 剪枝引擎
├── llm_engine.py                          # [核心] LLM 引擎（JSON + Pydantic）
├── executor.py                            # [核心] 执行引擎（五条铁律编排）
└── reporter.py                            # Markdown 报告生成器
```

> **v2.0 vs v2.1 差异**: v2.0 设计文档只列了 7 个文件，实际实现新增了 `executor.py`（五条铁律的实际编排者，~550 行）和 `__init__.py`（包初始化），共 **9 个文件**。

### 3.2 模块职责与依赖关系

```
                    ┌─────────┐
                    │ main.py │  ← CLI 入口，参数解析，批量调度
                    └────┬────┘
                         │ 调用
            ┌────────────┼────────────┐
            ▼            ▼            ▼
     ┌──────────┐  ┌──────────┐  ┌──────────┐
     │executor.py│  │yaml_     │  │reporter.py│
     │(执行引擎) │  │parser.py │  │(报告生成) │
     └────┬─────┘  └────▲─────┘  └────▲─────┘
          │             │              │
    ┌─────┼─────┐       │              │
    ▼     ▼     ▼       │              │
┌──────┐┌────┐┌──────┐  │              │
│mcp_  ││dom_││llm_  │  │              │
│client││prun││engine│  │              │
└──────┘└────┘└──────┘  │              │
    ▲     ▲            │              │
    └─────┴────────────┘              │
          │                           │
     ┌────┴────┐                      │
     │config.py│◄─────────────────────┘
     └─────────┘   所有模块读取配置
```

**数据流向**:

```
YAML文件 → yaml_parser → ParsedTestCase → executor → [dom_pruner + llm_engine + mcp_client]
                                                              ↓
                                                         TestCaseReport → reporter → Markdown
```

### 3.3 各模块详细说明

#### `config.py` — 配置管理

集中管理所有可配置项，支持环境变量覆盖。

| 配置类 | 职责 | 关键字段数 |
|--------|------|-----------|
| `FrameworkConfig` | 顶层配置容器 | 聚合 4 个子配置 |
| `LLMConfig` | LLM 模型连接参数 | 10 字段 |
| `MCPConfig` | Chrome DevTools MCP 连接 | 5 字段 |
| `ExecutionConfig` | 执行策略控制 | 8 字段 |
| `PathConfig` | 文件路径管理 | 6 字段 |

完整字段列表见[第六章：配置参数](#六配置参数)。

#### `mcp_client.py` — MCP 通信封装

封装与 Chrome DevTools MCP 的 Stdio 通信，提供类型安全的工具调用接口。

**核心类**: `MCPClient`（异步上下文管理器）

```python
async with MCPClient() as client:
    snapshot = await client.take_snapshot()
    result = await client.click(uid="15")
```

**工具方法分类**（共 30+ 方法）:

| 分类 | 方法 | 说明 |
|------|------|------|
| 页面导航 | `new_page()`, `navigate_page()` | 打开/导航页面 |
| 快照截图 | `take_snapshot()`, `take_screenshot()` | 获取 a11y 树 / 截图 |
| 元素交互 | `click()`, `fill()`, `fill_form()`, `hover()`, `drag()` | 点击/输入/悬停/拖拽 |
| 键盘输入 | `press_key()`, `type_text()` | 按键/打字模拟 |
| 等待检测 | `wait_for()`, `evaluate_script()` | 等待文本 / 执行 JS |
| 页面管理 | `list_pages()`, `select_page()`, `close_page()` | 多页面切换 |
| 网络请求 | `list_network_requests()`, `get_network_request()` | 网络监控 |

**返回值**: 统一使用 `ToolCallResult` dataclass：

```python
@dataclass
class ToolCallResult:
    success: bool           # 调用是否成功
    content: str = ""       # 返回内容
    error: str = ""         # 错误信息
    tool_name: str = ""     # 工具名称
    args: Dict = None       # 调用参数
    duration_ms: int = 0    # 耗时(ms)

    @property
    def has_error(self) -> bool:  # 自动检测内容中的错误标识
```

#### `dom_pruner.py` — DOM 剪枝引擎

**核心类**: `DomPruner`

将原始 MCP snapshot（~50K tokens）压缩为精简的交互元素列表（~1K tokens）。

**输出数据结构**:

```python
@dataclass
class PrunedElement:
    uid: str               # 元素唯一标识（来自 a11y 树）
    role: str              # ARIA 角色 (button/input/...)
    text: str              # 可见文本（截断至 80 字符）
    name: str = ""         # name 属性（label/placeholder）
    value: str = ""        # 当前值（input 的 value）
    description: str = ""  # aria-description
    parent_uid: str = ""   # 父元素 uid（用于层级关系）
    index: int = 0         # 在同级中的位置

@dataclass
class PruningResult:
    elements: List[PrunedElement]
    total_raw: int = 0          # 原始快照总元素数
    total_kept: int = 0         # 保留元素数
    compression_ratio: float = 0.0  # 压缩比
    raw_text_preview: str = ""  # 原始快照预览（前 500 字符）
    pruned_json: str = ""       # JSON 格式的剪枝结果
    pruned_llm_format: str = "" # LLM 友好格式
```

**三种输出格式**:

| 格式 | 用途 | 方法 |
|------|------|------|
| `.to_json()` | 结构化存储 / 调试 | 标准 JSON 数组 |
| `.to_llm_context()` | 发送给 LLM 的上下文 | 精简每元素一行 |
| `.to_llm_format()` | Prompt 中嵌入 | 带序号的格式化列表 |

#### `llm_engine.py` — LLM 引擎

**核心类**: `LLMEngine`

与本地大模型交互的核心模块，负责：
- Pre-Think（执行前思考）：选择目标元素 uid
- Post-Think（执行后反思）：判断断言是否通过
- Rerank（自愈重试）：根据错误信息重新选择元素

**Pydantic 数据模型**（用于强制结构化输出）:

```python
class TargetElement(BaseModel):
    uid: str
    confidence: float = 0.8        # 置信度 0-1
    reasoning: str = ""            # 选择理由

class RiskLevel(str, Enum):
    LOW = "low"                    # 低风险 - 操作明确
    MEDIUM = "medium"              # 中风险 - 存在歧义
    HIGH = "high"                  # 高风险 - 可能选错

class PreThinkResult(BaseModel):
    target: TargetElement           # 选定的目标元素
    intent_summary: str             # 对意图的理解摘要
    risk_level: RiskLevel           # 风险等级
    potential_issues: List[str]     # 潜在问题
    expected_outcome: str           # 预期结果

class PostThinkResult(BaseModel):
    passed: bool                   # 断言是否通过
    reason: str                    # 判断理由
    confidence: float = 0.8        # 判断置信度
    suggestions: List[str] = []    # 改进建议
    next_action_hint: str = ""     # 下一步建议
```

**三种 Prompt 模板**详见[第五章：Prompt 工程](#五prompt-工程规范)。

**JSON 解析多策略 fallback**:

```
LLM 原始输出
    ↓
Strategy 1: 直接 json.loads()
    ↓ 失败
Strategy 2: 提取 ```json ... ``` 代码块
    ↓ 失败
Strategy 3: 正则提取最外层 { ... }
    ↓ 失败
返回 None（触发降级到算法模式）
```

**降级策略**: 当 LLM 不可用时（未安装 openai 库、连接失败、连续 JSON 解析失败），自动降级为纯算法匹配模式，不影响基本执行功能。

#### `yaml_parser.py` — YAML 解析器

**核心类**: `YamlParser`

完全兼容 `testcase-modeler` 生成的 YAML 格式。

**支持的动作类型** (`SUPPORTED_ACTIONS`):

```python
SUPPORTED_ACTIONS = {
    "navigate", "click", "fill", "select_option",
    "hover", "press_key", "type_text", "scroll",
    "upload_file", "drag", "wait_for", "evaluate_script",
    "screenshot", "assert_text", "assert_visible",
    "assert_url", "assert_value", "assert_element_count",
    "switch_to_page", "close_page",
}
```

**支持的断言类型** (`ASSERTION_TYPES`):

```python
ASSERTION_TYPES = {
    "text_contains", "text_equals", "element_visible",
    "element_not_visible", "url_contains", "url_equals",
    "value_equals", "value_contains", "element_count",
    "page_title_contains", "custom_js",
}
```

**数据模型**:

```python
@dataclass
class TestStep:
    step_num: int                 # 步骤编号
    action: str                   # 动作类型
    desc: str                     # 步骤描述
    params: Dict[str, Any]        # 动作参数
    assertions: List[AssertionConfig]  # 断言列表
    timeout: int = 10000          # 超时时间(ms)
    optional: bool = False        # 是否可选步骤
    retry_on_fail: bool = True    # 失败时是否重试
    preconditions: List[str] = None  # 前置条件

@dataclass
class AssertionConfig:
    assert_type: str              # 断言类型
    expected: Any                 # 预期值
    actual: Any = None            # 实际值（执行后填充）
    passed: bool = None           # 是否通过（执行后填充）
    detail: str = ""              # 详情

@dataclass
class ContextCheck:
    check_type: str               # 检查类型: logged_in / url_pattern / custom
    params: Dict[str, Any]        # 检查参数

@dataclass
class ParsedTestCase:
    test_id: str                  # 用例 ID（如 ASSET-EVAL-001-apply-normal）
    title: str                    # 用例标题
    priority: str                 # 优先级: P0/P1/P2/P3
    config: Dict                  # 用例级别配置
    context_check: ContextCheck   # 前置条件检查
    steps: List[TestStep]         # 步骤列表
    teardown: List[TestStep]      # 清理步骤
    variants: List[Dict]          # 变体配置
    yaml_file: str = ""           # 源文件路径
```

**环境变量解析**: 支持 `${VAR}` 和 `${VAR:-default}` 语法。

#### `executor.py` — 执行引擎 ⭐

**核心类**: `TestExecutor`

这是框架的心脏，负责编排其他所有模块，实现**五条铁律**的完整执行流。

**执行上下文**:

```python
@dataclass
class ExecutionContext:
    testcase: ParsedTestCase           # 当前执行的用例
    current_step_idx: int = 0          # 当前步骤索引
    total_steps: int = 0               # 总步骤数
    steps_passed: int = 0              # 已通过步骤数
    steps_failed: int = 0              # 已失败步骤数
    start_time: float = 0.0            # 开始时间
    llm_available: bool = False        # LLM 是否可用
    think_enabled: bool = False        # 思维链开关
    think_deep: bool = False           # 深度思维开关
    screenshots: List[str] = None      # 截图路径列表
    report_items: List[StepReportItem] = None  # 报告项列表
```

**动作→MCP 映射表** (`ACTION_MCP_MAP`):

| YAML action | MCP tool | 参数构建方式 |
|-------------|----------|-------------|
| `navigate` | `new_page` | `{url}` |
| `click` | `click` | `{uid}` (需 LLM/算法选择) |
| `fill` | `fill` | `{uid, value}` |
| `select_option` | `fill` | `{uid, value}` |
| `hover` | `hover` | `{uid}` |
| `press_key` | `press_key` | `{key}` |
| `type_text` | `type_text` | `{text}` |
| `scroll` | `evaluate_script` | JS scrollBy |
| `screenshot` | `take_screenshot` | `{filePath}` |
| `wait_for` | `wait_for` | `{text[]}` |
| `evaluate_script` | `evaluate_script` | `{function}` |
| `upload_file` | `upload_file` | `{uid, filePath}` |
| `drag` | `drag` | `{from_uid, to_uid}` |
| `switch_to_page` | `select_page` | `{pageId}` |
| `close_page` | `close_page` | `{pageId}` |

**双模式元素匹配**:

```
需要 uid 的动作 (click/fill/hover/select/upload/drag)
    │
    ├── LLM 可用? ──YES──→ Pre-Think → target.uid (AI 选择)
    │
    └── LLM 不可用 ──NO──→ 算法匹配 → 最佳 uid (规则匹配)
                           ├─ 1. text/desc 精确匹配
                           ├─ 2. placeholder 匹配 (fill 场景)
                           ├─ 3. 包含匹配 (fuzzy)
                           └─ 4. 角色兜底 (找第一个 button/input)
```

#### `reporter.py` — 报告生成器

**核心类**: `Reporter`

生成 Markdown 格式的测试报告，包含汇总报告和每个用例的详细报告。

**输出目录结构**:

```
test-result/
└── run-20260512-143000/              # 时间戳命名的运行目录
    ├── report-20260512-143000.md     # 总报告（汇总表格 + 各用例概览）
    ├── ASSET-EVAL-001-detail.md      # 用例详细报告（含思维链）
    └── *.png                         # 截图文件
```

**报告数据模型**:

```python
@dataclass
class StepReportItem:
    step_num: int
    desc: str
    action: str
    status: StepStatus               # SUCCESS/FAILED/FAILED_ASSERT/SKIPPED/ERROR
    duration_ms: int = 0
    retry_count: int = 0
    error: str = ""
    mcp_tool: str = ""
    output_preview: str = ""
    assertions: List[Dict] = []       # 断言结果
    thinking_pre: str = ""           # LLM 执行前思考
    thinking_post: str = ""          # LLM 执行后反思
    llm_confidence: float = 0.0      # LLM 置信度

@dataclass
class TestCaseReport:
    test_id: str
    title: str
    priority: str
    yaml_file: str
    timestamp: str
    steps: List[StepReportItem]
    screenshots: List[str]

    @property
    def pass_rate(self) -> float: ...
    @property
    def overall_status(self) -> str:  # PASS / PARTIAL / FAIL

@dataclass
class ExecutionSummary:
    total_testcases: int = 0
    total_steps: int = 0
    passed_steps: int = 0
    failed_steps: int = 0
    skipped_steps: int = 0
    total_duration_ms: int = 0
    framework_version: str = "v2.0"
    report_path: str = ""
    report_dir: str = ""

    @property
    def overall_pass_rate(self) -> float: ...
    @property
    def overall_status(self) -> str:  # ALL PASS / PARTIAL / ALL FAIL
```

#### `main.py` — CLI 入口

命令行界面，支持多种调用方式。

**用法**:

```bash
# 列出可用用例
python -m testcases.runner.main

# 运行单个文件
python -m testcases.runner.main testcases/tc2-zccz/asset-eval-apply.yaml

# 运行目录下所有用例
python -m testcases.runner.main tc2-zccz

# 运行全部用例
python -m testcases.runner.main --all

# 启用 LLM 思维链
python -m testcases.runner.main --think <yaml>

# 深度思维模式（更详细的 CoT 输出）
python -m testcases.runner.main --think-deep <yaml>
```

---

## 四、核心执行流与五条铁律

### 4.1 五条铁律定义

| # | 铁律 | 实现位置 | 核心逻辑 |
|---|------|---------|---------|
| **1** | **状态感知前置检测** | `executor._check_preconditions()` | 执行前确认登录态、URL 正确性 |
| **2** | **思维链环绕** | `executor._pre_think()` + `_post_think()` | 每步前后都经过 LLM 推理 |
| **3** | **原子化执行** | `executor._execute_step()` | 单步独立，失败不影响其他步（除非 stop_on_error） |
| **4** | **错误自愈重试** | `executor._execute_step_with_retry()` | 失败后将错误信息发给 LLM 要求重新选择 |
| **5** | **报告自动生成** | `reporter.generate()` | 执行完毕自动输出 Markdown 报告 |

### 4.2 完整执行流程时序

```
main.py
  │
  ├─ 1. 解析 CLI 参数 → targets[], think_enabled, think_deep
  │
  ├─ 2. for each target:
  │     │
  │     ├─ 2a. yaml_parser.parse(yaml_path) → ParsedTestCase
  │     │
  │     ├─ 2b. async with MCPClient() as client:
  │     │     │
  │     │     ├─ 【铁律1】_check_preconditions()
  │     │     │     ├─ 检查登录状态 (context_check.logged_in)
  │     │     │     └─ 检查 URL 模式 (context_check.url_pattern)
  │     │     │
  │     │     ├─ 2c. for each step in testcase.steps:
  │     │     │     │
  │     │     │     ├─ 【铁律2-Pre】_pre_think(ctx, step, pruned_elements)
  │     │     │     │     ├─ if LLM available && think_enabled:
  │     │     │     │     │     └─ llm_engine.pre_think(context) → PreThinkResult
  │     │     │     │     │           → target.uid + confidence + risk_level
  │     │     │     │     └─ else: 使用算法匹配 → best_uid
  │     │     │     │
  │     │     │     ├─ 【铁律3】_execute_action(step, uid, client)
  │     │     │     │     ├─ ACTION_MCP_MAP[action] → (tool_name, args_builder)
  │     │     │     │     └─ mcp_client.call_tool(tool_name, args) → ToolCallResult
  │     │     │     │
  │     │     │     ├─ 【铁律4】if failed && retries < max_retries:
  │     │     │     │     └─ _retry_with_healing():
  │     │     │     │           ├─ llm_engine.rerank_with_error(error_msg) → new_uid
  │     │     │     │           └─ 重新执行 _execute_action(new_uid)
  │     │     │     │
  │     │     │     ├─ 【铁律2-Post】_post_think(ctx, step, result)
  │     │     │     │     └─ llm_engine.post_think(context) → PostThinkResult
  │     │     │     │           → passed + reason + suggestions
  │     │     │     │
  │     │     │     └─ 构建 StepReportItem → 加入 ctx.report_items
  │     │     │
  │     │     └─ 2d. return TestCaseReport
  │     │
  │     └─ 2e. reporter.generate(all_results) → ExecutionSummary
  │
  └─ 3. 输出汇总: 通过率、耗时、报告路径
```

### 4.3 自愈重试详细流程（铁律 4）

```
步骤执行失败
    │
    ▼
retry_count < max_retries?
    │
    ├── NO → 标记 FAILED，记录错误，继续下一步
    │
    └── YES → LLM 可用?
         │
         ├── YES → 调用 rerank_with_error():
         │         │
         │         ├── 构建 RerankContext:
         │         │   ├── 原始剪枝元素列表
         │         │   ├── 当前步骤意图
         │         │   ├── 上次选择的 uid
         │         │   └── 错误信息 ("ElementClickInterceptedError: ...")
         │         │
         │         ├── LLM 返回新的 target_uid
         │         │
         │         └── 用新 uid 重新执行 Action
         │
         └── NO → 算法 fallback:
                   ├── 尝试备选 uid（同角色其他元素）
                   └─ 或跳过该步骤（如果 optional=True）
```

---

## 五、Prompt 工程规范

### 5.1 设计原则

针对本地模型（7B-32B）的输出不稳定性，采用以下策略：

1. **强结构化约束**: System Prompt 明确要求只输出 JSON
2. **Pydantic 双重校验**: JSON 解析后再用 Pydantic model_validate() 校验
3. **少样本示例**: 每个 Prompt 都包含 1-2 个 input-output 示例
4. **输出 Schema 内嵌**: 将期望的 JSON 结构直接写入 Prompt
5. **分而治之**: 不要求一次输出全部信息，Pre-Think/Post-Think 分开调用

### 5.2 Pre-Think Prompt（执行前思考）

**触发时机**: 每个需要 uid 的步骤执行前

**输入**:
- `pruned_elements`: 剪枝后的页面元素列表（~1K tokens）
- `step.desc`: 步骤自然语言描述（如"输入用户名"）
- `step.action`: 动作类型（如 fill）
- `step.params`: 动作参数（如 value="admin"）

**输出**: `PreThinkResult` (JSON)

**Prompt 模板要点**:
```
System: 你是一个 UI 自动化测试的 AI 助手。你的任务是根据用户意图，
       从给定的页面元素中选择最合适的操作目标。

       你必须且只能返回 JSON 格式，不要输出任何其他内容。

User:   当前页面可用元素:
       {pruned_elements}

       当前操作意图: "{desc}"
       动作类型: {action}
       参数: {params}

       请分析并返回要操作的元素 uid，以及你的推理过程。

Output Schema:
{
  "target": {"uid": "...", "confidence": 0.9, "reasoning": "..."},
  "intent_summary": "...",
  "risk_level": "low|medium|high",
  "potential_issues": ["..."],
  "expected_outcome": "..."
}
```

### 5.3 Post-Think Prompt（执行后反思）

**触发时机**: 每个步骤执行完成后

**输入**:
- 执行前的 PreThink 结果
- `ToolCallResult`（success/content/error）
- 该步骤的断言配置 (`AssertionConfig` 列表)
- 执行后的最新快照（可选）

**输出**: `PostThinkResult` (JSON)

**Prompt 模板要点**:
```
System: 你是一个 UI 测试结果分析助手。根据执行结果和预期断言，
       判断当前步骤是否通过。

User:   操作意图: "{desc}"
       执行动作: {action}
       执行结果: {success}/{error_content}
       预期断言: {assertions}

       请判断此步骤是否通过，并给出理由。

Output Schema:
{
  "passed": true/false,
  "reason": "...",
  "confidence": 0.9,
  "suggestions": ["..."],
  "next_action_hint": "..."
}
```

### 5.4 Rerank Prompt（自愈重试）

**触发时机**: 步骤失败且需要重试时

**输入**:
- 原始剪枝元素列表
- 上次选择的 uid（已证明是错的）
- 错误信息（如 "Element not interactable"）
- 原始步骤意图

**输出**: 新的 `target.uid`

**Prompt 模板要点**:
```
System: 上一次操作失败了。请分析错误原因，重新选择一个更合适的目标元素。

User:   页面元素: {elements}
       上次选择的 uid: {failed_uid}（已失败）
       错误信息: "{error_msg}"
       操作意图: "{desc}"

       请重新选择一个不同的 uid，并解释为什么上次的选择会失败。
```

### 5.5 深度思维模式 (--think-deep)

当启用 `--think-deep` 时，额外的行为：

| 特性 | --think | --think-deep |
|------|---------|-------------|
| Pre-Think | ✅ 基础版 | ✅ 完整版（含 potential_issues 详细分析） |
| Post-Think | ✅ 基础版 | ✅ 完整版（含 suggestions + next_action_hint） |
| 截图频率 | 仅失败时 | **每步都截** |
| 日志级别 | INFO | DEBUG（含完整 LLM request/response） |
| 重试上限 | 3 次 | 5 次 |

---

## 六、配置参数

### 6.1 环境变量一览

#### LLM 相关

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `LLM_BASE_URL` | `http://10.0.11.6:8005/v1` | OpenAI 兼容 API 地址 |
| `LLM_API_KEY` | `""` | API 密钥（本地服务通常不需要） |
| `LLM_MODEL` | `gemma-4-26B-A4B-it` | 模型名称 |
| `LLM_TEMPERATURE` | `0.1` | 温度参数（低温度=更确定性输出） |
| `LLM_MAX_TOKENS` | `2048` | 最大输出 token 数 |
| `LLM_TIMEOUT` | `30` | 请求超时（秒） |
| `LLM_ENABLED` | `true` | 是否启用 LLM（设为 false 则纯算法模式） |
| `LLM_THINK_MODE` | `off` | 思维链模式: off/light/deep |

#### MCP 相关

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `MCP_COMMAND` | `npx` | MCP 启动命令 |
| `MCP_ARGS` | `-y @anthropic/mcp-chrome-devtools` | MCP 参数 |
| `MCP_TIMEOUT` | `120` | MCP 连接超时（秒） |

#### 执行策略

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `EXECUTION_MAX_RETRIES` | `3` | 每步最大重试次数 |
| `EXECUTION_DEFAULT_TIMEOUT` | `15000` | 默认单步超时（ms） |
| `EXECUTION_LLM_THINK_ENABLED` | `false` | 是否默认启用思维链 |
| `EXECUTION_LLM_THINK_DEEP` | `false` | 是否默认深度思维 |
| `EXECUTION_STOP_ON_ERROR` | `false` | 首步失败是否终止整个用例 |
| `EXECUTION_SCREENSHOT_ON_ERROR` | `true` | 失败时是否自动截图 |

#### 路径配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PATH_PROJECT_ROOT` | 自动检测 | 项目根目录 |
| `PATH_TESTCASE_ROOT` | `<root>/testcases` | 测试用例搜索根目录 |
| `PATH_RESULT_DIR` | `<root>/testcases/test-result` | 报告输出目录 |
| `PATH_SNAPSHOT_DIR` | `<root>/testcases/test-result/snapshots` | 快照存储目录 |

#### 测试环境

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `TEST_USER` | `yuanye` | 测试账号用户名 |
| `TEST_PASS` | `yuanye` | 测试账号密码 |
| `TEST_PROJECT_NAME` | `AI自动测试项目-001` | 测试项目名称 |
| `TEST_AMOUNT` | `1000000` | 测试金额（资产评估场景） |

### 6.2 FrameworkConfig 数据类定义

```python
@dataclass
class FrameworkConfig:
    llm: LLMConfig           # LLM 连接与模型配置
    mcp: MCPConfig           # Chrome DevTools MCP 配置
    execution: ExecutionConfig  # 执行策略配置
    paths: PathConfig        # 文件路径配置

    @classmethod
    def from_env(cls) -> 'FrameworkConfig':
        """从环境变量创建配置实例"""
```

---

## 七、错误处理与降级策略

### 7.1 分层容错体系

```
Layer 1: LLM 引擎层
├── openai 未安装 → is_available=False, 全程算法模式
├── 连接超时 → 记录警告, 降级算法模式
├── JSON 解析失败 → 3 策略 fallback (直接/代码块/正则)
└── Pydantic 校验失败 → 使用默认值, 降低 confidence

Layer 2: 执行引擎层
├── 元素未找到 → 自愈重试 (最多 N 次, 每次换 uid)
├── 操作被拦截 (ClickIntercepted) → Rerank 选新元素
├── 元素不可交互 (NotInteractable) → Rerank 或 skip
├── 页面超时 → wait_for 重试
└── 断言失败 → Post-Thinking 标记 FAILED_ASSERT

Layer 3: MCP 通信层
├── 连接失败 → ToolCallResult(success=False), 报告 ERROR
├── 工具不存在 → 返回错误, 不崩溃
├── 返回内容含错误标识 → has_error=True, 触发重试
└── 会话异常 → 安全断连, 清理资源

Layer 4: YAML 解析层
├── 文件不存在 → 明确报错, 退出码 1
├── 格式错误 → 打印具体行号和原因
├── 环境变量未定义 → ${VAR} 保持原样或取 default
└── 必填字段缺失 → 使用合理默认值 + 警告日志
```

### 7.2 降级模式矩阵

| LLM 状态 | 思维链开关 | 实际行为 |
|----------|-----------|---------|
| ✅ 可用 | `--think` | 完整 Pre-Think + Post-Think |
| ✅ 可用 | `--think-deep` | 深度思维 + 每步截图 + Debug 日志 |
| ✅ 可用 | 无开关 | **不调用 LLM**，纯算法匹配（最快） |
| ❌ 不可用 | `--think` | 打印警告，降级为算法模式 |
| ❌ 不可用 | 无开关 | 静默降级，纯算法模式 |

**关键设计**: 即使没有 LLM，框架也能正常运行（退化为传统的基于规则的自动化测试）。LLM 是增强而非依赖。

---

## 八、版本历史

| 版本 | 日期 | 变更说明 |
|------|------|---------|
| v1.0 | - | 单体 `testcase-ai.py` (~2300 行) |
| v2.0 | 2026-05 | Gemini 生成初始设计文档 (73 行)，定义核心理念和模块划分 |
| **v2.1** | **2026-05-12** | **基于实现补全：数据模型、Prompt 规范、五条铁律详解、错误处理、配置参数、CLI 用法** |

---

## 九、附录

### A. 状态枚举定义

```python
class StepStatus(str, Enum):
    SUCCESS = "success"           # 成功
    FAILED = "failed"             # 失败（操作错误）
    FAILED_ASSERT = "failed_assert"  # 失败（断言不通过）
    SKIPPED = "skipped"           # 跳过
    ERROR = "error"               # 异常（非预期错误）
```

### B. 文件大小参考

| 文件 | 大约行数 | 职责复杂度 |
|------|---------|-----------|
| `__init__.py` | ~60 | 导出定义 |
| `config.py` | ~130 | 配置数据类 |
| `mcp_client.py` | ~280 | MCP 协议封装 |
| `dom_pruner.py` | ~380 | DOM 过滤算法 |
| `llm_engine.py` | ~380 | LLM 交互 + Pydantic |
| `yaml_parser.py` | ~300 | YAML 解析 + 环境变量 |
| `executor.py` | ~550 | **核心编排逻辑** |
| `reporter.py` | ~220 | 报告模板渲染 |
| `main.py` | ~220 | CLI 参数处理 |
| **合计** | **~2520** | |

### C. 依赖清单

| 依赖包 | 用途 | 必须 |
|--------|------|------|
| `mcp` | MCP 协议客户端 SDK | ✅ |
| `pyyaml` | YAML 文件解析 | ✅ |
| `openai` | LLM API 调用 | 🔸 LLM 功能需要 |
| `pydantic` | 结构化输出校验 | 🔸 LLM 功能需要（无则跳过校验） |
