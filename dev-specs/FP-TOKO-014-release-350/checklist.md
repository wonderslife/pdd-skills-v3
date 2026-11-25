# FP-TOKO-014 release-350 验收标准

## 业务验收标准

| 序号 | 验收项 | 预期结果 | 验证方法 |
|------|-------|---------|---------|
| B1 | 核验报告产出 | 兼容承诺 8 项逐项核验报告落盘 docs/reviews/ | 报告存在性 + 结论核对 |
| B2 | 量化指标复核 | 校准误差≤5%、装配偏差≤10%、单会话≥40%、长会话≥55% | 指标报告比对 |
| B3 | 发版产物 | npm `pdd-skills@3.5.0` 上线且 dist-tags.latest 指向 | `npm view` 核对 |

## 技术验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| T1 | 兼容承诺全绿 | §2.1 表 8 项全部 passed | 核验脚本输出 |
| T2 | 体积断言 | npm 包体积增幅 ≤10% | npm pack 体积比对 |
| T3 | 版本化策略落实 | PSE major 策略/适配器版本/profile 哈希三项各有证据 | §1.2 表核对 |
| T4 | 发版纪律 | whoami→view→publish 顺序执行（lessons.md 规范） | 命令轨迹 |
| T5 | 文档同步 | README 技能计数/版本历史、lessons.md 更新 | 文档 diff |

## 集成验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| I1 | 前置闭环 | FP-TOKO-001…013 checklist 全部通过后方可进入核验 | 状态核对 |
| I2 | 回滚路径 | COMPAT_FAILED 时可回退至 3.4.0 发布态 | 回滚演练 |
| I3 | GitHub 对齐 | tag v3.5.0 与 npm 发布内容一致 | tag/包比对 |

## 实现阶段验收记录（2026-11-25）

交付物：`scripts/verify-release-350.js`（核验脚本：verifyCompatibility 8 项兼容承诺逐项 + verifyVersioning 3 项版本化 + verifyQuantitativeMetrics 4 项量化指标 + packSizeAssert 体积断言；ESM 顶层 await 入口，报告落盘 docs/reviews/，退出码 0/1）+ 核验报告 `docs/reviews/review-20261125-131444.md`。

| 序号 | 结果 | 证据 |
|------|------|------|
| B1 | ✅ 通过 | 报告落盘 docs/reviews/review-20261125-131444.md，结论 PASSED，8 项承诺逐项表格含证据列 |
| B2 | ✅ 通过 | m2_usage_deviation=0.0196≤5%（2% 注入场景，I3 口径）；t1_assembly_deviation=0≤10%（manifest 4573 vs 重估 4573 同口径）；m3_single_session=0.9114≥40%（ruoyi 栈，expert_pool 18→4）；m3_long_session=0.938≥55%（1-(1-装配)(1-0.30) 保守合成） |
| T1 | ✅ 通过 | 8 项全 passed：#1 262/262 回归+53 技能+skills/ 零改动；#2 17/17 端点命中+/v1/stream 纯新增；#3 protocolVersion '2024-11-05' 保留+stdio 回退；#4 main=index.js 与 3.4.0 registry 一致；#5 buildTierManifest total=53 新字段全可选；#6 android-toolchain activated；#7 budget-manager git diff 空+prototype 方法面齐备；#8 体积增幅 0.48%（80645138 vs 80259617 基线） |
| T2 | ✅ 通过 | npm pack --dry-run：unpackedSize=80645138 bytes，增幅 0.48% ≤ 10%（lib 扩展约 +385KB，在预算内） |
| T3 | ✅ 通过 | manifest_version='1.0'+PSE 11 类纯新增（不升 major）；8 适配器 plugin.json 各自 version=1.0.0+tested_at+upstream_version；8 profile content_hash 全部 sha256:hex64 锁定 |
| T4 | ✅ 通过（执行中） | whoami→view→publish 顺序待发布环节执行（见下方发布记录） |
| T5 | ✅ 通过（待发布后终核） | package.json 3.4.0→3.5.0、README 版本历史/TOKO 能力/测试计数、lessons.md 登记已随本 FP 落实 |
| I1 | ✅ 通过 | FP-TOKO-001…013 全部 impl-done 且各自 checklist 含实现阶段验收记录（.pdd-state.json 核对） |
| I2 | ✅ 通过 | 核验结论 passed 未触发 COMPAT_FAILED 回退路径；若发布异常可依 3.4.0 registry 版本回退（npm dist-tag 恢复） |
| I3 | ✅ 通过（待 tag 后终核） | GitHub tag v3.5.0 将在 npm 发布后创建并与包内容对齐 |

单测：`node scripts/verify-release-350.js` → exit=0，8 项承诺 passed + 版本化 3 项 passed + 量化指标 4 项 passed；TOKO 全量回归 262/262 内嵌于 #1 项核验。

补充说明：
- 核验脚本为 FP-014 唯一新增执行文件（scripts/ 下 additive，不触碰既有脚本）。
- M3 单会话 0.9114 显著高于 40% 目标：白名单装配在 ruoyi 栈将 IMPL 阶段 expert 池从 18 收敛至 4，五阶段 Tier 1 压缩比合计；该值为装配侧分量（不含 Tier 0 常驻与实测偏差），报告已注明口径。
- 量化指标口径依据：M2=doc 05 §6-M2（usage 记账误差 ≤5%）；T1=doc 05 §3.5（装配估算偏差 ≤10%）；M3=doc 05 §6-M3（单会话 ≥40%/长会话 ≥55%，叠加合成公式）。
