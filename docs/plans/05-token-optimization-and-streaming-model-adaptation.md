# pdd-skills-v3 Token 优化与流式模型适配架构设计

> 版本：v1.0 | 日期：2026-11-24 | 状态：设计评审中
> 目标版本：pdd-skills 3.5.0
> 性质：**纯设计文档，不改动任何现有源码与功能实现**（§0 红线声明）
> 前置文档：[03-token-cost-optimization.md](03-token-cost-optimization.md)（内容层优化）、[04-kotlin-android-capability-enhancement.md](04-kotlin-android-capability-enhancement.md)

---

## 0. 范围声明与设计红线

### 0.1 本文档要解决的三个问题

| # | 问题 | 现状证据 |
|---|---|---|
| 1 | **Token 消耗结构性偏高** | 全量技能加载 description 即 ~13,700 tokens；SKILL.md 合计 ~201,500 tokens；装配策略缺失导致"技能未触发也在上下文" |
| 2 | **流式模型适配缺位** | [api-server.js](../../lib/api-server.js) / [mcp-server.js](../../lib/mcp-server.js) 均为请求体整包累积（`req.on('data', chunk => body += chunk)`），无流式响应通道；技能内容对不同模型供应商（OpenAI/Anthropic/Gemini/DeepSeek/Qwen/GLM/Kimi/Doubao 等）的 tokenizer 差异无感知 |
| 3 | **Token 预算与流式执行脱节** | [budget-manager.js](../../lib/token/budget-manager.js) 按 5 阶段分配（20/15/40/15/10），但仅是"事后记账"；无流式中途软熔断、无 per-model tokenizer 校准 |

### 0.2 设计红线（本阶段不可违反）

1. **不改源码**：本阶段仅产出设计规范与接口定义，所有 `lib/`、`skills/`、`scripts/`、`tests/` 现有文件保持字节不变。
2. **功能逻辑零变更**：53 个技能的触发语义、7 大 Phase 流程、4 级质量门控、插件钩子契约全部不变。
3. **协议向后兼容**：现有 REST 17 端点、MCP 协议版本、JS/Python SDK 的请求/响应结构不变；新增能力一律走"新增可选字段/新增端点/新增 header"路径。
4. **实现路径中的 3.5.x 代码变更**（§6 路线图）必须在独立分支按本规范执行，且每步通过"既有用例回归零差异"验证。

---

## 1. 现状架构诊断

### 1.1 上下文装配链路（Token 消耗的真正发生地）

pdd-skills-v3 是**技能/提示词资产平台**，自身不调用 LLM。技能被宿主 Agent（Trae / Claude Code / 其他 MCP Client）装配进 LLM 上下文后才产生 token 成本：

```
宿主 Agent                    LLM 供应商
    │ ①拉取技能清单/正文            ▲
    │   (MCP / REST / SDK)         │ ③全量上下文计费
    ▼                              │
 pdd-skills-v3 ──②SKILL.md + 参考物料──┘
    （无装配策略控制权 → 只能靠内容瘦身，
      无法控制"何时装、装多少、按什么顺序装"）
```

**结构性缺陷**：装配决策权完全在宿主侧，平台只能做"被动瘦身"（doc 03 的 Layer 0–3），无法做"主动装配"（按阶段/按任务/按模型动态决定注入内容）。

### 1.2 Token 相关现有资产盘点

| 资产 | 位置 | 现状能力 | 缺口 |
|---|---|---|---|
| 预算管理器 | `lib/token/budget-manager.js` | 5 阶段比例分配、预警、阻断 | 无真实 usage 回填、无模型 tokenizer 校准、无流式软停 |
| 预算告警 | `lib/token/budget-alert.js` | 阈值告警事件 | 与流式事件未打通 |
| 三级缓存 | `lib/cache/system-cache.js` | 系统级缓存 | 缓存的是**产物**而非**上下文**，不省 token |
| 质量评分 | `lib/quality/scorer.js` | 4 级门控 | 评分不感知成本 |
| 技能列表 | `lib/list.js`（读 SKILL.md front matter） | 列举 53 技能 | 无 tier 分层元数据、无 per-skill token 报价 |
| MCP/REST | `lib/mcp-server.js` / `lib/api-server.js` + `api-routes.js` | 整包请求/响应 | 无 SSE/Streamable HTTP 输出、无 `usage` 上报通道 |
| 内容优化 | doc 03（Layer 0–3） | SKILL.md 瘦身规范 | 已覆盖"内容层"，未覆盖"装配层/运行时层" |

### 1.3 主流流式模型适配矩阵（2026 现状）

| 模型家族 | 代表型号 | 流式协议 | 流式工具调用 | 推理 token 流 | Token 计数特性 |
|---|---|---|---|---|---|
| OpenAI | GPT-4o / o3 / GPT-5 | SSE（Chat Completions / Responses） | `tool_calls` 增量（arguments JSON delta） | reasoning delta | usage 在末 chunk（`stream_options.include_usage`） |
| Anthropic | Claude 4.x Sonnet/Opus | SSE（Messages API） | `content_block` type=`tool_use` 增量 | thinking delta（交错思考） | `message_start` 给 input_tokens，`message_delta` 给 output |
| Google | Gemini 2.x | SSE（generateContent） | functionCall（部分聚合） | thought parts | `usageMetadata` 随流更新 |
| DeepSeek | V3.x / R1 | OpenAI 兼容 SSE | 兼容 `tool_calls` | **`reasoning_content` 独立通道** | usage 末 chunk；中文 token 比英文省 |
| 阿里 Qwen | Qwen3 | OpenAI 兼容 + DashScope 双协议 | 兼容；DashScope 原生格式不同 | `enable_thinking` 开关 + thinking 块 | 中英混合 tokenizer 独立 |
| 智谱 GLM | GLM-4.x / GLM-5 | OpenAI 兼容 SSE | 兼容 | thinking 字段 | 国产模型中中文密度最优之一 |
| Moonshot Kimi | Kimi + 长上下文 | OpenAI 兼容 SSE | 兼容 | 部分型号支持 | 128K–1M 窗口，长文计费分档 |
| 字节豆包 | Doubao 1.5+ | 火山方舟 OpenAI 兼容 SSE | 兼容 | reasoning 模式开关 | 方舟额外返回方舟 usage 字段 |
| 百度文心 | ERNIE 4.5+ | 原生 + OpenAI 兼容双模式 | 双模式行为有差异 | 部分支持 | 原生模式 usage 命名不同 |
| MiniMax / xAI | abab / Grok | OpenAI 兼容为主 | 基本兼容 | 各有差异 | 各自 usage 语义略有出入 |

**诊断结论**：① 全部主流家族收敛于 **SSE + OpenAI 风格增量事件**，差异集中在"推理通道字段名、工具调用事件粒度、usage 语义"三处 → 统一抽象可行；② 中文 tokenizer 差异使同一 SKILL.md 在不同家族间 token 计数浮动 ±15–25% → 预算系统必须 per-model 校准。

---

## 2. 目标架构总览（3.5.0）

### 2.1 架构图

```
┌────────────────────────────────────────────────────────────────┐
│                      宿主 Agent（Trae 等 MCP Client）             │
└───────────┬──────────────────────────┬───────────────────────────┘
            │ MCP (Streamable HTTP)     │ REST/SDK（既有通道，零变更）
            ▼                           ▼
┌────────────────────────────────────────────────────────────────┐
│                      pdd-skills-v3 服务边界                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ① CAG 上下文装配网关（Context Assembly Gateway）★新        │   │
│  │    tier 装配 / 按需加载 / 前缀稳定化 / 装配报价单             │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ② PSE 统一流式事件层（PDD Stream Event）★新                │   │
│  │    message_start / content_delta / tool_delta /            │   │
│  │    reasoning_delta / usage / soft_stop / done / error      │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ③ MSSA 模型流式适配 SPI（Model-Streaming Service Adapter）★新│   │
│  │    provider profile / 协议映射 / tokenizer 校准 / 降级链     │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  ④ 既有资产（零变更，仅"接线点"预留）                              │   │
│     budget-manager(5阶段) · cache · quality · 53技能 · 插件hooks │   │
└────────────────────────────────────────────────────────────────┘
```

三个新组件全部是**新增模块**（规划路径 `lib/context-assembly/`、`lib/streaming/`），通过"接线点"与既有资产交互；现有模块的调用点在 §6 路线图中列出但本阶段不实现。

### 2.2 与既有体系的关系

| 既有体系 | 关系 | 交互方式（3.5.0 设计） |
|---|---|---|
| doc 03 内容层优化 | **互补**：doc 03 瘦身"单个技能"，CAG 决定"装不装、装几层" | CAG 以 doc 03 产物（≤200 字符 description、分层 references）为 tier 元数据输入 |
| budget-manager | **升级消费方**：PSE `usage` 事件回填真实消耗 | 新增可选事件订阅，不改类本身 |
| 质量门控 | **成本维度接入**：评分新增 cost 子项（可选） | scorer 输入新增字段，缺省不启用 |
| 插件系统 | **复用机制**：MSSA 适配器按插件规范打包 | `plugin.json` 声明 `provides: "mssa-adapter"` |
| Android 链路(3.4.0) | **同构受益**：CAG 装配报价同样适用于 expert-kotlin 等 4 技能 | 无专属改动 |

---

## 3. Token 优化策略设计

> 分四层递进：L-A 装配层（新增，本设计核心）、L-B 内容层（引用 doc 03，不重复展开）、L-C 运行时层、L-D 模型感知层。四层正交，可独立实施。

### 3.1 L-A 装配层：CAG（Context Assembly Gateway）

#### 3.1.1 四层装配模型（Tier Assembly）

技能内容按"可见性×触发深度"切四层，**默认只装 Tier 0**：

| Tier | 内容 | 加载时机 | 装配方式 | 53 技能估算规模 |
|---|---|---|---|---|
| **Tier 0 索引层** | name + 精简 description + 触发词（doc 03 Layer 0 产物） | 会话开始，常驻 | 全量注入 | ~7,000 tokens（vs 现 13,700，**-49%**） |
| **Tier 1 核心层** | SKILL.md 正文（doc 03 Layer 1/2 产物：核心流程 ≤2,000 tokens） | 触发词命中，按需 | 单技能注入 | 单次 +2,000 |
| **Tier 2 参考层** | `references/*.md`（规则表/大示例） | 技能内步骤显式声明需要时 | 按需懒注入 | 单次 +500~3,000 |
| **Tier 3 工件层** | 运行时产物（契约报告/体检报告/路由清单） | 工具调用返回后按需截取 | **摘要化注入**（见 3.1.3） | 单次 ≤800 |

#### 3.1.2 阶段感知装配（Phase-Aware）

复用 budget-manager 的 PHASES 枚举（ANALYSIS/DESIGN/IMPL/REVIEW/VERIFY），装配白名单：

| 阶段 | 默认可装配技能类别 | 明确排除 |
|---|---|---|
| ANALYSIS | core 拆解类 + BA | pr 类、expert 实现类 |
| DESIGN | pdd-design-spec、架构专家 | testcase 类 |
| IMPL | 当前栈 expert（探测器结果决定：ruoyi/kotlin/android...）+ pdd-implement-feature | 全量 expert（**关键：探测器命中哪栈才装哪栈**） |
| REVIEW | pdd-code-reviewer + bug 模式 | BA/spec 类 |
| VERIFY | pdd-verify-feature + 对应测试 expert | 设计类 |

**收益估算**：以 IMPL 阶段 RuoYi 工程为例，expert 池从 18 个收敛到 3–4 个（expert-ruoyi/expert-ruoyi-permission/expert-mysql/expert-bug-fixer），Tier 1 装配量 -70%。

#### 3.1.3 工件摘要化规范（Artifact Digesting）

规则（按优先级）：
1. 结构化报告注入前先过 **Digest Profile**：JSON 报告 → 仅注入 `summary + top-N 异常项`（N≤10）；表格报告 → 仅注入评分行与 ERROR 行。
2. 超限工件（>800 tokens）降级为"文件路径 + 一句话说明 + 取用指令"，由模型决定是否发工具调用取全文。
3. **截断永不破坏结构化边界**：按条目/行截断，禁止字符级硬截断（避免破坏 YAML/JSON 导致模型误读）。

#### 3.1.4 前缀稳定化规范（KV-Cache Friendly Ordering）

主流供应商的 prompt 前缀缓存（OpenAI automatic prefix caching / Anthropic prompt caching / DeepSeek context caching）都要求**前缀逐字节稳定**。装配顺序强制为：

```
[系统提示] → [Tier 0 索引（会话内不变）] → [Tier 1 已触发技能（只增不改）]
→ [对话历史] → [Tier 2/3 按需内容（放最末，随任务变化）]
```

配套纪律：
- 禁止在 Tier 0/1 区块内插入时间戳、随机 id 等易变内容；
- 技能一旦装配，会话内不回溯移除（保持前缀字节稳定）；
- Tier 3 工件全部放对话尾部。

**收益**：命中前缀缓存时，Tier 0+Tier 1 部分的**缓存命中价**（OpenAI 约 1/2、Anthropic 约 1/10、DeepSeek 约 1/10）替代全价，长会话综合节省 30–60%。

#### 3.1.5 装配报价单（Assembly Manifest）

每次装配输出机器可读清单（新增 MCP 资源 `pdd://context/manifest`）：

```jsonc
{
  "manifest_version": "1.0",
  "phase": "impl",
  "tiers": {
    "t0": { "skills": 53, "tokens_estimate": 7100 },
    "t1": { "skills": ["expert-ruoyi", "pdd-implement-feature"], "tokens_estimate": 4200 },
    "t2": { "references": ["expert-ruoyi/references/permission-rules.md"], "tokens_estimate": 1500 },
    "t3": { "artifacts": ["contract-report#digest"], "tokens_estimate": 620 }
  },
  "tokenizer_profile": "qwen",
  "total_estimate": 13420,
  "budget_state": { "phase_share": 40000, "consumed": 28500, "remaining": 11500 }
}
```

宿主 Agent 可据此在装配前**预检预算**，也可回传 manifest 供 budget-manager 记账。

### 3.2 L-B 内容层（引用 doc 03，规范不变）

doc 03 的 Layer 0–3（description ≤200 字符、双语去重、references 分层）是 CAG 的**数据前提**：Tier 模型直接消费其产物。本设计不重复其规范，仅追加一条 CAG 侧要求：

> **新增元数据要求（唯一增量）**：`_meta.json` / SKILL.md front matter 新增可选字段 `tier`（缺省按目录类别推导）与 `tokens_char`（可选，装配网关自测回填）。字段缺省不影响任何现有消费方——向后兼容红线满足。

### 3.3 L-C 运行时层：预算的流式闭环

#### 3.3.1 usage 双轨计数

| 轨 | 来源 | 用途 |
|---|---|---|
| 估算轨 | CAG 按字符×tokenizer 系数（见 3.4.2） | 装配前预检、软熔断预判 |
| 实测轨 | PSE `usage` 事件（供应商回传） | 回填 budget-manager、跨会话统计 |

实测优先，估算兜底（供应商不回 usage 时降级）。

#### 3.3.2 三级软熔断（Soft-Stop Ladder）

预算触发点从"阶段结束后才记账"升级为流式途中分级干预（由宿主 Agent 执行，PSE 只发建议事件，**平台不擅自中断**——红线：不改变功能语义）：

| 级别 | 触发条件（占阶段预算） | PSE 事件 | 建议动作 |
|---|---|---|---|
| L1 提示 | 70% | `budget.warning` | 模型收到一句话成本提示（不改变任务） |
| L2 收敛 | 85% | `budget.tighten` | 建议跳过 Tier 2 装配、工件摘要更激进（N≤5） |
| L3 阻断建议 | 100% | `budget.stop_suggested` | 建议终止本轮生成，产出已有部分结果 + 未完成清单 |

#### 3.3.3 多轮会话上下文压实（Context Compaction）

长会话（第 4 轮起且历史 > 阶段预算 50%）时，CAG 提供**历史摘要模板**（哪些保留：决策/契约/验收标准；哪些丢弃：中间探索/失败尝试原文），由宿主 Agent 决策执行。设计仅定义模板与触发建议，不自动改写历史——**功能语义零变更**。

### 3.4 L-D 模型感知层

#### 3.4.1 Tokenizer Profile（每模型家族一份）

```jsonc
// lib/streaming/profiles/qwen.json（设计示例；文件名 = family 枚举值）
{
  "family": "qwen",
  "ratios": { "zh_chars_per_token": 0.62, "en_words_per_token": 0.75, "code_lines_per_token": 9.5 },
  "usage_semantics": "openai-compatible-tail",
  "reasoning_channel": "thinking_block",
  "prefix_cache": { "supported": true, "billing": 0.1, "min_tokens": 1024 },
  "context_window": 131072,
  "stream_protocol": "sse-openai"
}
```

初始化阶段用新增的 `scripts/token-calibrate.js`（设计稿；token-analyzer.js 保持字节不变）对 53 技能 × 8 家族采样标定（路线图 T0），生成静态 profile 表；运行时按宿主声明的 `x-llm-family` header 选择。

#### 3.4.2 校准规则

- 同名内容跨家族计数差异 ±15–25% → **禁止用"字符数"直接报 token**，一切估算必须过 profile；
- 混合内容（中英+代码）按内容类型分段套系数后求和；
- 未登记家族降级用 `openai` profile 并在 manifest 标注 `tokenizer_profile: "openai(fallback)"`。

### 3.5 优化收益总账（目标值，T0 基线标定后修正）

| 措施 | 层 | 预估节省 | 依据 |
|---|---|---|---|
| Tier 0 索引化（13,700→7,000） | L-A | -49% 固定开销 | doc 03 description 合计数据折算 |
| 阶段感知装配（IMPL 案例专家池 18→3-4） | L-A | Tier1 -70% | 类别白名单表 |
| 工件摘要化 | L-A | 单报告 2,000+→≤800 | §3.1.3 |
| 前缀缓存命中 | L-A | 命中部分 -50%~-90% 计费 | 三家供应商缓存价目 |
| 流式 usage 实测回填 | L-C | 消除估算漂移 ~10% | §3.3.1 |
| **单会话综合目标** | — | **≥40%**（长会话 ≥55%） | 与 doc 03 Layer 优化叠加后保守取值 |

---

## 4. 流式模型适配架构设计

### 4.1 PSE 统一流式事件模型（PDD Stream Event）

新增 `Content-Type: text/event-stream` 输出通道（REST 新增端点 `/v1/stream`，MCP 采用 Streamable HTTP transport），事件规范：

| 事件 | payload（设计） | 对应各家原生事件（见 §4.3 映射） |
|---|---|---|
| `message_start` | `{ id, family, context_tokens }` | Anthropic message_start / OpenAI role delta / Gemini 第一块 |
| `content_delta` | `{ text }` | OpenAI content delta / Anthropic text_delta / Gemini text parts |
| `reasoning_delta` | `{ text, channel: "reasoning" }` | DeepSeek reasoning_content / Anthropic thinking_delta / Qwen thinking / OpenAI reasoning delta |
| `tool_delta` | `{ tool_id, name, args_fragment }` | OpenAI tool_calls delta / Anthropic input_json_delta / Gemini functionCall |
| `usage` | `{ input_tokens, output_tokens, cached_tokens?, source: "measured" }` | 各家 usage 语义归一 |
| `budget.*` | 见 §3.3.2 | 平台自有，无原生对应 |
| `done` | `{ finish_reason, usage_total }` | finish/stop_reason 归一 |
| `error` | `{ code, message, retryable }` | 归一错误分类（§4.5） |

**设计约束**：PSE 是**归一化事件流**，不承载模型生成内容本身的路由决策——生成仍发生在宿主 Agent 与供应商之间；PSE 流承载的是**平台侧产物**（报告、扫描结果、预算事件）的流式化输出 + **usage 遄测**。这样既让长报告输出从"整包 JSON"升级为边生成边推送，又完全不介入宿主的生成链路（红线 3）。

### 4.2 MSSA 适配器 SPI

每个模型家族一个适配器（按插件规范打包，`plugin.json` 声明 `provides: "mssa-adapter"`），SPI 接口（3.5.0 实现于 `lib/streaming/adapters/`）：

```ts
// 设计接口（TypeScript 表达，实现为 ESM JS）
interface MSSAAdapter {
  family: string;                    // "openai" | "anthropic" | "gemini" | "deepseek" | "qwen" | ...
  capabilities: AdapterCapabilities; // 声明式能力，见 4.4
  // 归一化：原生事件 → PSE 事件
  normalize(rawEvent: RawEvent): PSEEvent[];
  // 校准：token 估算
  estimateTokens(content: string, contentType: 'zh'|'en'|'code'): number;
  // 装配建议：该家族下的 tier 微调（如 Gemini 对超长 Tier0 敏感）
  assemblyHints(profile: TokenizerProfile): AssemblyHints;
}
```

### 4.3 协议映射总表（兼容规范核心）

| PSE 事件 | OpenAI | Anthropic | Gemini | DeepSeek | Qwen(DashScope) | GLM | Kimi | Doubao(方舟) |
|---|---|---|---|---|---|---|---|---|
| content_delta | choices[].delta.content | content_block_delta(text_delta) | candidates[].content.parts[].text | delta.content | output.text | delta.content | delta.content | delta.content |
| reasoning_delta | delta.reasoning(o系) | thinking_delta | thought parts | **delta.reasoning_content** | output.reasoning_content / thinking | delta.thinking | —(部分) | delta.reasoning_content |
| tool_delta | delta.tool_calls[].function.arguments | input_json_delta | functionCall(聚合) | 同 OpenAI | message.tool_calls | 同 OpenAI | 同 OpenAI | 同 OpenAI |
| usage | 末 chunk stream_options | message_start+message_delta | usageMetadata 随流 | 末 chunk usage | 末 usage | 末 usage | 末 usage | 末 usage+方舟扩展 |
| done | finish_reason=stop | message_delta(stop_reason) | finishReason=STOP | finish_reason | finish | finish | finish | finish |

**映射纪律**：
1. 适配器必须声明 `tested_at` 与 `upstream_version`，供应商 API 变更只改 adapter 文件，PSE 规范版本不变；
2. 未覆盖字段一律透传至 `PSEEvent.extra`，禁止丢弃（前向兼容）；
3. 每个适配器配契约测试夹具（录制真实 SSE 样本回放断言归一化结果）。

### 4.4 能力声明矩阵（AdapterCapabilities）

```jsonc
{
  "streaming": true,            // 是否支持流式输出
  "tool_call_streaming": "incremental" | "aggregated" | "none",
  "reasoning_channel": "dedicated_field" | "interleaved" | "none",
  "usage_reporting": "tail_chunk" | "start_and_delta" | "in_stream" | "unsupported",
  "prefix_cache": { "billing_multiplier": 0.5, "min_tokens": 1024 },
  "max_context": 131072,
  "sse_transport": "openai-style" | "mcp-streamable-http",
  "fallback_family": "openai"   // 异常时降级到哪个通用适配器
}
```

### 4.5 错误分类与降级链

| 类别 | 判定 | 策略 |
|---|---|---|
| 可重试流错误 | SSE 连接中断但已收到 content | `error{retryable:true}` + 断点续传建议（宿主决策） |
| 家族协议漂移 | 适配器归一化抛 UnknownEvent ≥ 阈值 | 自动降级 `fallback_family` 适配器，事件标 `degraded:true` |
| 不支持流式 | capabilities.streaming=false | 整包响应（**与 3.4.x 行为一致**——天然向后兼容） |
| usage 缺失 | 尾部无 usage | 估算轨接管，manifest 标 `source:"estimated"` |

### 4.6 与 MCP / REST 既有通道的关系

| 通道 | 3.4.x 行为 | 3.5.0 设计 | 兼容性 |
|---|---|---|---|
| REST `/api/*`（18 端点） | 整包 JSON | 不变；**新增** `/v1/stream`（SSE，PSE 事件） | 旧端点零变更 |
| MCP | stdio/HTTP 整包 | 声明支持 Streamable HTTP transport（MCP 规范内选项）+ 新增 resource `pdd://context/manifest` | 旧 client 按 `Negotiate` 自动回退 |
| SDK (JS/Python) | 整包 | 新增可选 `stream()` 方法；原方法签名不动 | 零破坏 |
| CLI (`bin/pdd.js`) | 同步输出 | 不变（CLI 产物天然"流式"到终端） | 零变更 |

---

## 5. 兼容性规范汇总（Compatibility Specification）

### 5.1 向后兼容承诺（3.4.x → 3.5.0）

| 项 | 承诺 | 验证方式 |
|---|---|---|
| 53 技能触发语义 | 不变 | 技能触发回归用例全绿 |
| REST 17 端点请求/响应 | 字节级不变 | 契约快照测试（现有 + 新增快照） |
| MCP 协议交互 | 旧版本 client 可用 | MCP 握手回退用例 |
| SDK 公开 API | 签名不变 | SDK 类型检查 + 既有示例编译通过 |
| `_meta.json` / front matter | 新字段全部可选，缺省行为同 3.4.x | schema 校验：无新字段时行为等价 |
| 插件 `plugin.json` | 现有插件（含 android-toolchain）照常加载 | 插件加载冒烟 |
| 预算管理器 | 类接口不变，新增订阅可选 | 既有调用点零改动编译通过 |
| npm 包 | 新模块计入 `files` 白名单；体积增幅 ≤10%（skills 不动，仅 lib 扩展，约 +80KB） | `npm pack` 体积断言 |

### 5.2 模型家族兼容矩阵（3.5.0 验收范围）

8 家族首期全量适配（OpenAI/Anthropic/Gemini/DeepSeek/Qwen/GLM/Kimi/Doubao），ERNIE/MiniMax/xAI 走 OpenAI 兼容降级链（T2 验证）。每家族三个验证维度：流式归一化契约测试、tokenizer 校准误差 ≤5%（对标准语料）、缓存命中行为确认。

### 5.3 版本化策略

- PSE 事件规范：`manifest_version` 语义化；新增事件不升 major，语义变更必须升 major 并双发 6 个月；
- 适配器：独立版本，`tested_at` + 上游 API 版本声明；
- tokenizer profile：静态表随包发布，T0 标定后哈希锁定。

---

## 6. 实施路线图（Roadmap）

> 本节为 3.5.x 的执行规划；**本文档阶段不写任何代码**（红线 3.1）。每阶段入口条件：上阶段验收全绿 + 既有功能回归零差异。

### T0 基线标定（1 个迭代）

| 任务 | 产出 | 验收 |
|---|---|---|
| 新增 scripts/token-calibrate.js 设计：8 家族采样标定脚本（设计稿；token-analyzer.js 保持字节不变） | 53 技能 × 8 家族 token 计数表 + 8 份 tokenizer profile 初版 | 校准误差 ≤5% |
| 会话级 token 消耗埋点方案（估算轨先行） | budget-manager 消费数据结构设计（不改类） | 5 阶段消耗分布报告 |
| 现状基线报告 | docs/reviews/ 评审报告：当前单会话 token 消耗模型 | 用户确认基线口径 |

### T1 CAG 装配层（1–2 个迭代）

| 任务 | 产出 | 验收 |
|---|---|---|
| Tier 元数据补全（`tier`/`tokens_char` 可选字段，53 技能） | 技能清单 tier 化 | 现有消费方零感知回归 |
| CAG 核心实现（Tier0–3 装配 + 报价单 manifest） | `lib/context-assembly/` 新模块 + MCP resource | 装配估算 vs 实测偏差 ≤10% |
| 工件摘要化 Digest Profile（契约/体检/路由三类报告先行） | 3 个 digest profile | 结构截断零破坏用例 |
| 前缀稳定化改造核对 | 装配顺序审计清单 | 缓存命中（Anthropic cache_creation/write 比例观测） |

### T2 PSE + MSSA 流式层（2 个迭代）

| 任务 | 产出 | 验收 |
|---|---|---|
| PSE 事件规范 v1 落地（`/v1/stream` + MCP Streamable HTTP） | `lib/streaming/` 新模块 | 事件契约测试全绿 |
| 8 家族适配器（含 SSE 样本回放夹具） | 8 个 adapter 插件 | 映射表逐项断言 |
| usage 实测轨回填 + 三级软熔断事件 | budget 订阅接线 | 预算事件触发用例 |
| 降级链（OpenAI 兼容兜底 + ERNIE/MiniMax/xAI 验证） | 降级路径 | 畸形流注入测试 |

### T3 智能调度与收尾（1 个迭代）

| 任务 | 产出 | 验收 |
|---|---|---|
| 阶段感知装配白名单全量接入 | PHASES × 技能类别矩阵 | 各阶段装配规模对比报告 |
| 会话压实模板 + 多轮优化 | compaction 模板库 | 第 4 轮起历史占用 -30% |
| 质量评分 cost 子项（可选开关） | scorer 扩展设计 | 缺省关闭时评分与 3.4.x 一致 |
| 3.5.0 发版（README/lessons/版本历史同步） | npm `pdd-skills@3.5.0` | §5.1 兼容承诺逐项核验 |

### 里程碑与量化目标

| 里程碑 | Token 目标 | 功能回归 | 适配覆盖 |
|---|---|---|---|
| M1（T1 完） | 单会话固定开销 -49% | 零差异 | — |
| M2（T2 完） | usage 记账误差 ≤5% | 零差异 | 8 家族 |
| M3（T3 完，3.5.0） | **综合 ≥40%，长会话 ≥55%** | 零差异 | 8+3 降级 |

---

## 7. 风险与对策

| 风险 | 概率 | 影响 | 对策 |
|---|---|---|---|
| 供应商 API 漂移导致适配器失效 | 高 | 中 | 适配器独立版本 + 样本回放契约测试 + 降级链兜底 |
| tokenizer 校准漂移（新模型发布） | 中 | 低 | profile 静态表季度复标；运行时以实测 usage 为准 |
| 宿主 Agent 不支持新 MCP resource/transport | 中 | 低 | 全部新能力有"整包回退"路径（4.6 表），旧 client 行为不变 |
| Tier 化装配改变触发时机引发功能争议 | 低 | 高 | 阶段白名单仅约束"注入顺序与默认深度"，触发词语义不变；M1 灰度并出对比报告 |
| 摘要化截断丢关键信息 | 中 | 中 | 摘要保留规则表 + 取全文指令双保险；截断边界结构化审计 |

---

## 8. 附录

### 附录 A：与 doc 03 的边界声明

doc 03 = 内容层（技能文件本身怎么写）；本文档 = 装配层/运行时层/模型层（上下文怎么组装、怎么计量、怎么流式）。两文档规范不冲突；本文档 §3.2 引用 doc 03 规范为其数据前提。

### 附录 B：PSE 事件 JSON Schema（设计稿）

```jsonc
{
  "event": "content_delta | reasoning_delta | tool_delta | usage | budget.warning | budget.tighten | budget.stop_suggested | done | error",
  "data": { /* 见 §4.1 payload 列 */ },
  "ts": "RFC3339",
  "degraded": false
}
```

### 附录 C：术语表

| 术语 | 全称 | 说明 |
|---|---|---|
| CAG | Context Assembly Gateway | 上下文装配网关（§3.1） |
| PSE | PDD Stream Event | 统一流式事件规范（§4.1） |
| MSSA | Model-Streaming Service Adapter | 模型流式适配器 SPI（§4.2） |
| Tier 0–3 | — | 四层装配模型（§3.1.1） |
| 前缀稳定化 | Prefix Stabilization | KV-cache 友好装配顺序（§3.1.4） |

> 本文档遵循 [project_rules.md](../../.trae/rules/project_rules.md) 文档规范；评审通过后按 §6 路线图在独立分支实施，实施期间本文档作为唯一设计依据，变更需回写本文档并升版本号。
