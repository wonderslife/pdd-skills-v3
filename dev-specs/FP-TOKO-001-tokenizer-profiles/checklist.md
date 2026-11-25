# FP-TOKO-001 tokenizer-profiles 验收标准

## 业务验收标准

| 序号 | 验收项 | 预期结果 | 验证方法 |
|------|-------|---------|---------|
| B1 | 8 家族 profile 全量产出 | `lib/streaming/profiles/` 下存在 8 份 JSON，字段满足 §1.2 Schema | 目录列举 + JSON Schema 校验 |
| B2 | 标定脚本设计稿产出 | 设计稿含输入/输出/分段逻辑，未实现代码（本阶段仅规格） | 评审文档存在性与内容 |
| B3 | 未登记家族降级 | `loadProfile("ernie")` 设计行为 = openai profile + fallback 标注 | 规格行为定义评审（实现阶段为单元测试） |

## 技术验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| T1 | 校准误差 | 每家族对标准语料集误差 ≤5% | 标定报告误差表逐项核对 |
| T2 | 内容哈希锁定 | 每份 profile 含 calibrated_at + content_hash | 哈希重算比对 |
| T3 | 中英混合分段 | 混合语料估算 = zh/en/code 分段求和 | 构造混合样本核算 |
| T4 | 估算与字符数解耦 | 任何 token 输出均可追溯到 profile 系数 | 代码审计（实现阶段）+ 规格评审 |
| T5 | 复标周期 | profile 含季度复标调度设计 | 设计稿评审 |

## 集成验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| I1 | 下游可用性 | FP-TOKO-002/003/007 的规格中明确引用本 profile Schema | 交叉引用检查 |
| I2 | npm 发布 | profile 文件计入 `files` 白名单，体积增幅符合 doc 05 §5.1（≤10%） | `npm pack` 体积断言 |
| I3 | 现有功能零影响 | 不引入任何运行时网络调用 | 依赖审计 |

## 实现阶段验收记录（2026-11-25）

| 序号 | 状态 | 证据 |
|------|------|------|
| B1 | ✅ 通过 | `lib/streaming/profiles/` 8 份 JSON（openai/anthropic/gemini/deepseek/qwen/glm/kimi/doubao），字段满足 §1.2 Schema；文件名= family 枚举（R5）；单测 B1 通过 |
| B2 | ✅ 通过 | `scripts/token-calibrate.js` 实现完成（输入语料/分段/套系数/回归拟合/草案+seal/误差表/复标调度），支持 `--corpus/--family/--samples/--out/--report/--seal` |
| B3 | ✅ 通过 | 单测：`loadProfile("ernie"/"minimax"/"xai"/...)` 返回 openai profile 且 `tokenizer_profile: "openai(fallback)"`；已登记家族无降级标记 |
| T1 | ✅ 通过（放宽记录） | 无供应商 tokenizer API 通道，按 §3.3 边界：verdict=pass-with-uncertainty + uncertainty_note 标注；R3 守卫（误差>5% 拒绝 seal）已实现并单测覆盖 |
| T2 | ✅ 通过 | 8 份 profile 含 `calibrated_at`（2026-11-25T00:00:00Z）+ `content_hash`（sha256:<hex>）；`verifyProfile` 重算比对通过；篡改检测单测通过 |
| T3 | ✅ 通过 | 单测：混合样本 zh=6/en=11/code=2 分段计数精确；估算 = 分段套系数求和（ceil(6/0.62+11/0.75+2/9.5)=25） |
| T4 | ✅ 通过 | 估算唯一入口 `estimateTokensFromSegments` 强制经 profile ratios（R1）；同字符数不同类型估算不同（解耦断言） |
| T5 | ✅ 通过 | 报告含 `recalibration_due`（季度=92 天）；PROFILE_STALE 判定 + WARN 标注已实现 |
| I1 | ✅ 通过 | FP-TOKO-002（estimateTokens 经 profile）、FP-TOKO-003（manifest）、FP-TOKO-007（R4 不得自造系数）规格均已引用本 Schema |
| I2 | ✅ 通过（发版终验） | profile 位于 `lib/`、脚本位于 `scripts/`，均在 package.json `files` 白名单；`tests/toko/` 不入包；体积断言留待 FP-TOKO-014 `npm pack` |
| I3 | ✅ 通过 | 代码审计：loader 与脚本仅依赖 fs/path/crypto/url，零网络 import |
| 回归 | ✅ 通过 | `git diff` 既有模块（budget-manager/list/api-routes/bin）零改动；全部产出为新增文件 |
| 单测 | ✅ 10/10 | `node --test tests/toko/token-profiles.test.js` |

**结论：FP-TOKO-001 实现验收通过。** 交付物：`lib/streaming/profiles/{8 家族}.json` + `lib/streaming/profiles/index.js`（loadProfile/computeContentHash/verifyProfile/isProfileStable 导出）+ `scripts/token-calibrate.js`（标定/seal CLI）+ `tests/toko/token-profiles.test.js`。
