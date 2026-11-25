# FP-TOKO-004 artifact-digesting 验收标准

## 业务验收标准

| 序号 | 验收项 | 预期结果 | 验证方法 |
|------|-------|---------|---------|
| B1 | 三类 Profile 齐备 | contract-report / health-report / route-table 三份 profile 定义产出 | 清单核对 |
| B2 | 摘要规模达标 | 单报告注入 ≤800 tokens（对照现状 2,000+） | 估算值比对（实现阶段实测） |
| B3 | 取全文指令保留 | 每个 digest/pointer 输出含取用指令 | 输出体检查 |

## 技术验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| T1 | 结构截断零破坏 | 摘要条目均为完整结构单元（对象/行），无字符级截断 | 边界用例：构造嵌套 JSON/YAML 验证 |
| T2 | pointer 降级路径 | 超 ceiling 工件降级为路径+说明+指令 | 降级用例 |
| T3 | 无 profile 行为确定 | 未登记工件类型一律 pointer，不自由摘要 | 未登记类型用例 |
| T4 | tighten 联动 | budget.tighten 事件下 max_items 收紧为 5 | 事件注入用例 |

## 集成验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| I1 | Tier 3 挂接 | digest 输出可进 CAG Tier 3 且 manifest.t3 计数正确 | FP-TOKO-003 联调用例 |
| I2 | 现有报告零改动 | 契约/体检/路由报告的**文件产物**不变（摘要只作用于注入层） | 产物 diff 审计 |

## 实现阶段验收记录（2026-11-25）

交付物：`lib/context-assembly/digest.js`（digest/listProfiles，keep_fields 三形式引擎：路径提取 / top_n 条目截断 / lines: 整行匹配）+ `lib/context-assembly/digest-profiles/{contract-report,health-report,route-table}.json`（§1.2 Schema，沿 FP-001 profile 目录模式）+ `tests/toko/artifact-digesting.test.js`（11 用例）。

| 序号 | 结果 | 证据 |
|------|------|------|
| B1 | ✅ 通过 | listProfiles 返回 3 份 profile，字段与 §1.2 Schema 一致（contract-report keep_fields=['summary','issues.top_n']、max_items=10） |
| B2 | ✅ 通过 | 100 条 issues 大报告摘要实测 ≤800 tokens（10 条条目级截断）；CEILING_BREACH 用例证明超限路径可达 |
| B3 | ✅ 通过 | digest 与 pointer 输出均含 fetch_instruction 且注入体共用同一字符串（"是否取回由模型决定"） |
| T1 | ✅ 通过 | top 10 条目与原工件深度相等、嵌套 detail 完整、summary 无字符截断、JSON 往返无损 |
| T2 | ✅ 通过 | 超大 summary（9000 行结构单元）→ pointer + notice=CEILING_BREACH，原工件 9000 行完好 |
| T3 | ✅ 通过 | unknown-type → pointer + notice=PROFILE_MISSING，注入体零内容泄露（R4） |
| T4 | ✅ 通过 | tighten:true → 5 条（TIGHTEN_MAX_ITEMS=5，FP-008 事件注入点）；显式 maxItems 优先 |
| I1 | ✅ 通过 | injection_text 经 assemble artifacts 进 Tier 3，manifest.t3.artifacts 计数/内容正确；FP-003 与 FP-004 同源估算 |
| I2 | ✅ 通过 | 报告文件内容与 mtime 零变化，内存对象零变化（纯函数变换） |

单测：`node --test tests/toko/artifact-digesting.test.js` → 11/11；TOKO 全量 63/63。

补充说明：降级路径按返回值 notice 标注（PROFILE_MISSING / CEILING_BREACH / DIGEST_EMPTY），不抛错——与 FP-002 ESTIMATE_WITHOUT_PROFILE 同风格；DIGEST_EMPTY 为 keep_fields 全落空（形状不符）时的兜底 pointer，遵循 R4 不做自由发挥；digest 自身估算默认家族 openai（可经 opts.family 覆盖，签名无 family 入参故取 FP-001 基线家族）；非 top_n 路径字段不做条目截断（结构单元完整保留，超限交给 CEILING_BREACH）。
