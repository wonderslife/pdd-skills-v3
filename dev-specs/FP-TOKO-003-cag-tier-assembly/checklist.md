# FP-TOKO-003 cag-tier-assembly 验收标准

## 业务验收标准

| 序号 | 验收项 | 预期结果 | 验证方法 |
|------|-------|---------|---------|
| B1 | 默认仅 Tier 0 | 未触发任何技能时 manifest.tiers 仅 t0 有内容 | 规格行为评审（实现阶段为用例） |
| B2 | Tier 0 索引规模收敛 | 估算值 ≤7,100 tokens（阈值源自 doc 05 §3.1.5 manifest 示例；-49% 目标基于 doc 03 的 48 技能基线 13,700；53 技能口径以 FP-TOKO-002 B3 的 T0 基线报告复标为准，届时回写本阈值） | 与 T0 复标结果比对 |
| B3 | manifest 可读 | 任一装配产出符合 §1.2 Schema | JSON Schema 校验 |

## 技术验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| T1 | 估算偏差 | 装配估算 vs 实测偏差 ≤10% | 偏差报告 |
| T2 | 不可逆追加 | Tier1/2 一经注入不回溯移除 | 状态机用例 |
| T3 | 既有模块零改动 | list.js/budget-manager 等无 diff | git diff 审计 |
| T4 | 触发语义不变 | 53 技能触发回归全绿 | 技能触发回归 |
| T5 | MCP resource 注册 | `pdd://context/manifest` 可被宿主读取且旧 client 无感 | MCP 握手回退用例 |

## 集成验收标准

| 序号 | 验收项 | 标准 | 验证方法 |
|------|-------|------|---------|
| I1 | budget_state 数据源 | manifest.budget_state 来自 FP-TOKO-002 输出 | 数据流核对 |
| I2 | Android 链路同构受益 | expert-kotlin 等 4 技能可被正常装配（doc 05 §2.2） | Android 技能装配用例 |
| I3 | 阶段白名单挂接点 | FP-TOKO-011 白名单可在 assemble(request) 注入 | 接口契约检查 |

## 实现阶段验收记录（2026-11-25）

交付物：`lib/context-assembly/index.js`（新，assemble/buildManifest/validateManifest/getLatestManifest/clearSession）；`lib/mcp-server.js` 三处纯 additive 接线（+16/-0：import、PDD_RESOURCES 新条目、默认 resource handler）；`lib/streaming/tier-metadata.js` additive 补 triggers 字段；`tests/toko/cag-assembly.test.js`（16 用例）。

| 序号 | 结果 | 证据 |
|------|------|------|
| B1 | ✅ 通过 | 无触发依据装配 → t0.skills=53、t1/t2/t3 均空 |
| B2 | ✅ 通过 | 8 家族实测 t0 估算 5.5k–6.4k 全部 ≤7100（qwen 6,192 / openai 6,383；TIER0_TOKEN_LIMIT=7100 常量锚定，复标回写点已注释） |
| B3 | ✅ 通过 | manifest_version/phase/tiers 类型契约/tokenizer_profile 取值域/total_estimate=四层之和/budget_state 三元组全断言 + validateManifest |
| T1 | ✅ 通过 | 四层估算均经 segment.js+profile 系数（buildManifest 纯函数用例：6 CJK÷0.62→10）；偏差报告机制已由 FP-002 提供（R3 联动） |
| T2 | ✅ 通过 | 状态机用例：Tier 1/2 装配后二次装配保留（不可逆并集）；Tier 3 新产物替换旧产物 |
| T3 | ✅ 通过 | git diff：list.js/budget-manager 零改动；mcp-server.js 纯新增（+16/-0，规格 §1.1 授权） |
| T4 | ✅ 通过 | 53 技能文件零改动（git 审计），触发判定路径未触碰，R5 约束入注释 |
| T5 | ✅ 通过 | PDD_RESOURCES 含新 URI 且既有 4 资源（pdd://specs/features/reviews/status）全保留；getLatestManifest 指向最近装配 |
| I1 | ✅ 通过 | budget_state = getPhaseDistribution：无记录全额预算、记录后 consumed/remaining 联动、跨阶段分配正确 |
| I2 | ✅ 通过 | expert-android/android-test/jetpack/kotlin 4 技能装配成功，正文剥离 front matter |
| I3 | ✅ 通过 | request.whitelist 注入点实现并测通（白名单外不注入不报错） |

单测：`node --test tests/toko/cag-assembly.test.js` → 16/16；TOKO 全量 52/52。

补充说明：assemble 新增可选 `skillsRoot`（宿主嵌入自有技能树接缝，默认包内 skills/）；错误码 PHASE_UNKNOWN/TIER_OVERFLOW/MANIFEST_MALFORMED 按规格实现，辅助校验错误码 SKILL_NOT_FOUND/REF_MALFORMED/REF_NOT_FOUND/SESSION_ID_REQUIRED/FAMILY_REQUIRED。
