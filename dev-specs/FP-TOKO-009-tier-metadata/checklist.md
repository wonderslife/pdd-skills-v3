# FP-TOKO-009 tier-metadata 验收标准

## 业务验收标准

| 序号 | 验收项 | 预期结果 | 验证方法 |
|------|-------|---------|---------|
| B1 | 53 技能 tier 全覆盖 | 每个技能有显式或推导的 tier 值 | 清单核对 |
| B2 | 推导映射表成文 | §2.1 映射表覆盖全部目录类别 | 表格核对 |
| B3 | schema 校验设计 | 含新字段/不含新字段两种技能均可通过校验 | Schema 双态用例 |

## 技术验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| T1 | 缺省零感知 | 无新字段的技能在 lib/list.js、MCP、CLI 输出与 3.4.x 一致 | 输出快照比对 |
| T2 | 冲突裁决 | front matter 与 _meta.json 冲突时以前者为准 + WARN | 冲突用例 |
| T3 | 非法值回退 | tier=5 回退为推导值且不中断 | 非法值用例 |
| T4 | 现有键零污染 | 不修改/不删除既有 front matter 键 | diff 审计 |
| T5 | tokens_char 自动回填 | CAG 启动自测回填，无需手工维护 | 自动化设计评审 |

## 集成验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| I1 | CAG 消费 | FP-TOKO-003 assemble 可按 tier 过滤 | 装配联调 |
| I2 | 白名单消费 | FP-TOKO-011 白名单按 tier+类别双维过滤 | 联调用例 |

## 实现阶段验收记录（2026-11-25）

交付物：`lib/streaming/tier-metadata.js`（新，纯只读解析层）、`tests/toko/tier-metadata.test.js`（10 用例）。

| 序号 | 结果 | 证据 |
|------|------|------|
| B1 | ✅ 通过 | buildTierManifest 实测 total=53，全部技能 tier∈{0..3}，tier_distribution 求和=53 |
| B2 | ✅ 通过 | TIER_DERIVATION_MAP 成文：core/expert/pr/openspec→1、entropy→2；每类别真实技能抽查（pdd-main/expert-arch-enforcer/openspec-ff-change/pdd-pr-create） |
| B3 | ✅ 通过 | 双态用例：无标注（推导）/front matter 标注/_meta.json 标注三种形态均可解析 |
| T1 | ✅ 通过 | 本 FP 零改写任何文件（用例断言清单前后文件集合一致）；lib/list.js/MCP/CLI 未触碰，输出与 3.4.x 等价（git diff 审计） |
| T2 | ✅ 通过 | META_CONFLICT 用例：fm=2 vs meta=1 → tier=2 + WARN；一致时不告警 |
| T3 | ✅ 通过 | TIER_INVALID 用例：5/'abc'/1.5/4/-1 全部回退推导值不中断；fm 非法 + meta 合法 → meta 生效 |
| T4 | ✅ 通过 | git diff 审计：skills/ 零改动，既有 front matter 键零污染 |
| T5 | ✅ 通过 | tokens_char 启动时自动计算 = SKILL.md 全文字符数（与实际文件长度断言相等） |
| I1 | ✅ 预埋 | 清单含 tier/tier_source/tokens_char/description/references，FP-003 可按 tier 过滤（装配实现时复核） |
| I2 | ✅ 预埋 | 清单含 name/category 双维，FP-011 白名单可按 tier+类别过滤（FP-011 实现时复核） |

单测：`node --test tests/toko/tier-metadata.test.js` → 10/10 通过；TOKO 全量 36/36 通过。

补充：未登记目录类别兜底 TIER_CATEGORY_UNKNOWN → 保守 tier=2（R2 保证 53 技能全有确定 tier）；references/ 文件归入 tier 2 并回填 tokens_char（§2.1）；front matter YAML 解析失败回退推导不中断。
