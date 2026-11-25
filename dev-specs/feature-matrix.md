# TOKO 功能点矩阵（feature-matrix）

> 模块：TOKO（Token Optimization 能力增强，对应 pdd-skills 3.5.0）
> 来源：[docs/plans/05-token-optimization-and-streaming-model-adaptation.md](../docs/plans/05-token-optimization-and-streaming-model-adaptation.md)
> 日期：2026-11-24 | 状态：已确认（审核门跳过，按推荐默认执行）
> 范围红线：**仅产出规格，不实现**；技能文件与 lib 源码零改动（doc 05 §0.2）

## 功能点清单

| FP ID | 名称 | 来源章节 | 阶段 | 优先级 | 核心交付 | 前置依赖 |
|---|---|---|---|---|---|---|
| FP-TOKO-001 | tokenizer-profiles | §3.4、§6-T0 | T0 | P0 | 8 家族 tokenizer profile 标定脚本设计 + profile 静态表（校准误差≤5%） | 无 |
| FP-TOKO-002 | budget-estimation-track | §3.3.1、§6-T0 | T0 | P0 | 估算轨数据结构（budget-manager 不改类）+ 5 阶段消耗分布 | 001 |
| FP-TOKO-003 | cag-tier-assembly | §3.1.1、§3.1.5、§6-T1 | T1 | P0 | CAG 核心：Tier0-3 装配 + `pdd://context/manifest` 报价单 | 001/002/009 |
| FP-TOKO-004 | artifact-digesting | §3.1.3、§6-T1 | T1 | P0 | Digest Profile×3（契约/体检/路由），结构截断零破坏 | 003 |
| FP-TOKO-005 | prefix-stabilization | §3.1.4、§6-T1 | T1 | P0 | KV-cache 友好装配顺序规范 + 命中率审计 | 003 |
| FP-TOKO-006 | pse-stream-endpoint | §4.1、§4.6、附录 B | T2 | P0 | `/v1/stream` SSE + MCP Streamable HTTP，PSE 事件全集（budget.*×3 + compaction.suggested） | 002 |
| FP-TOKO-007 | mssa-adapters | §4.2、§4.3、§4.4、§6-T2 | T2 | P0 | 8 家族适配器 SPI + SSE 样本回放契约测试 | 001/006 |
| FP-TOKO-008 | budget-streaming-closure | §3.3.2、§6-T2 | T2 | P0 | usage 实测回填 + 三级软熔断（70/85/100%） | 002/004/006/007 |
| FP-TOKO-009 | tier-metadata | §3.2、§6-T1 | T1 | P0 | `tier`/`tokens_char` 可选元数据（53 技能，缺省零感知） | 无 |
| FP-TOKO-010 | fallback-chain | §4.5、§5.2、§6-T2 | T2 | P1 | 降级链：OpenAI 兼容兜底 + ERNIE/MiniMax/xAI 验证 | 006/007 |
| FP-TOKO-011 | phase-aware-assembly | §3.1.2、§6-T3 | T3 | P1 | PHASES×技能类别白名单矩阵 | 003/009 |
| FP-TOKO-012 | compaction-templates | §3.3.3、§6-T3 | T3 | P1 | 多轮会话压实模板库（保留决策/契约/验收，弃中间过程） | 003/008 |
| FP-TOKO-013 | quality-cost-score | §6-T3、§2.2 | T3 | P2 | 质量评分 cost 子项（默认关闭） | 002 |
| FP-TOKO-014 | release-350 | §5.1、§5.3、§6-T3 | T3 | P2 | 3.5.0 发版：兼容承诺逐项核验 | 全部 |

## 测试策略总则

- 每个新增模块独立单元测试 + 契约测试（SSE 样本回放，不执行下载文件）；
- 兼容性回归：现有 REST 17 端点契约快照零差异、MCP 旧 client 回退、53 技能触发语义不变（doc 05 §5.1）；
- 量化指标：tokenizer 校准误差≤5%、装配估算偏差≤10%、单会话综合节省≥40%（T0 基线标定后修正）。

## AI 角色分配（按 PDD 协作模式）

| 优先级 | 策略 |
|---|---|
| P0 | 协作者 + system-architect（架构决策）+ expert-code-quality（实现审查） |
| P1 | 协作者 + software-architect（模块设计） |
| P2 | 主导者 + software-engineer |
