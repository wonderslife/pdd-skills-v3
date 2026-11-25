# FP-TOKO-005 prefix-stabilization 验收标准

## 业务验收标准

| 序号 | 验收项 | 预期结果 | 验证方法 |
|------|-------|---------|---------|
| B1 | 装配顺序规范成文 | §1.2 五区块顺序在规格中强制并可审计 | 规格评审 |
| B2 | 审计清单产出 | stability-audit 报告可在任意装配计划上运行 | 报告生成用例 |

## 技术验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| T1 | 顺序违规检出 | Tier 3 内容置于历史之前的计划被标记 ORDER_VIOLATION | 构造违规计划用例 |
| T2 | 易变内容检出 | Tier 0/1 含时间戳/uuid 的计划被标记 VOLATILE_CONTENT | 构造混入用例 |
| T3 | 前缀逐字节稳定 | 相同 phase 的连续两次装配，Tier 0/1 区块哈希一致 | 区块哈希比对 |
| T4 | 只增不改 | 会话中第二次触发技能仅追加 Tier 1，不重写已装内容 | 会话序列用例 |
| T5 | 缓存命中可观测 | cache read/write 用量比有观测值且随会话轮次提升 | 供应商用量报表（实现阶段） |

## 集成验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| I1 | CAG 挂接 | auditOrder 嵌入 assemble 主流程，违规必退回 | FP-TOKO-003 联调 |
| I2 | 白名单联动 | FP-TOKO-011 阶段白名单装配同样通过本审计 | 联调用例 |

## 实现阶段验收记录（2026-11-25）

交付物：`lib/context-assembly/prefix-stability.js`（getAssemblyOrder / auditOrder / scanVolatileContent / observeCacheUsage / getCacheStats / clearSession + CANONICAL_ORDER / VOLATILE_PATTERNS 常量）+ `lib/context-assembly/index.js` I1 门禁嵌入（additive +8 行，返回前审计）+ `scripts/prefix-stability-audit.js`（B2 报告脚本，--plan/--live 双模式）+ `tests/toko/prefix-stability.test.js`（21 用例）。

| 序号 | 结果 | 证据 |
|------|------|------|
| B1 | ✅ 通过 | getAssemblyOrder 对 5 个合法 phase 返回 §1.2 五区块（position 0–4 + §2.1 稳定性标注）；非法 phase 抛 PHASE_UNKNOWN |
| B2 | ✅ 通过 | --plan 审计任意计划文件（落盘 JSON 报告）；--live 实时装配审计 pass；违规计划 AUDIT_FAILED 非零退出 |
| T1 | ✅ 通过 | tier3 先于 history → ORDER_VIOLATION CRITICAL@tier3（R3 置尾语义，标记尾部区块本身）；通用回退（history→tier1）标记 tier1 |
| T2 | ✅ 通过 | t0 混 uuid / t1 混 RFC3339 / blocks tier1 混 generated_at → VOLATILE_CONTENT HIGH；裸日期与 {timestamp} 占位符不误伤（R1 口径用例锚定 skills/ 全树实测结论） |
| T3 | ✅ 通过 | 相同 phase 连续两次装配 tier0/tier1 sha256 哈希一致 |
| T4 | ✅ 通过 | 会话第二次触发仅追加 Tier 1，先前载荷逐字节不变，追加后审计仍通过 |
| T5 | ✅ 通过 | observeCacheUsage 三轮 hit_ratio 0→0.5→0.9，getCacheStats.improved=true；RECORD_MALFORMED 非法记录拒绝；clearSession 清理 |
| I1 | ✅ 通过 | assemble 返回前嵌入 auditOrder（§3.3 违规必退回）：fixture 技能 description 含 uuid → 抛 VOLATILE_CONTENT 阻断下发；正常装配通过 |
| I2 | ✅ 通过 | whitelist 拦截后 t1 空装配通过本审计（FP-TOKO-011 注入点联动就绪） |

单测：`node --test tests/toko/prefix-stability.test.js` → 21/21；TOKO 全量 84/84。

补充说明：auditOrder 支持双形态——形态 A（FP-003 CAG plan，顺序由构造序保证，做 R1 扫描 + tier0/tier1 哈希）与形态 B（宿主 blocks 序列，按 §2.1 序位校验，含别名归一）；R1 易变内容模式经 skills/ 全树实测确认零误伤（命中均在 references/ Tier 2 或 `{timestamp}` 占位符形式，均不在扫描范围）；block_hashes 形态 A 为 {tier0,tier1}、形态 B 为 {sequence}；plan.generated_at 属计划元数据非载荷区块，不参与前缀哈希。
