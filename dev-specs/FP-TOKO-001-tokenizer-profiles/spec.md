# FP-TOKO-001 tokenizer-profiles 开发规格

## 基本信息

| 项目 | 内容 |
|------|------|
| 功能点ID | FP-TOKO-001 |
| 名称 | Tokenizer Profile 标定（T0 基线标定） |
| 版本 | v1.0 |
| 日期 | 2026-11-24 |
| 来源 | docs/plans/05 §3.4、§6-T0 |
| 优先级 | P0 |
| 范围 | 仅规格；本 FP 不实现 |

## 1. 接口定义

### 1.1 模块导出（设计约定）

| 导出 | 类型 | 说明 |
|------|------|------|
| `lib/streaming/profiles/{family}.json` | 静态表 | 每家族一份 tokenizer profile，随 npm 包发布 |
| `scripts/token-calibrate.js`（设计稿） | CLI | 采样标定脚本：输入技能语料 → 输出 profile JSON 草案 |
| `loadProfile(family)` | 函数 | 返回 profile；未登记家族返回 openai profile 并标记 `tokenizer_profile: "openai(fallback)"` |

### 1.2 Profile Schema（每家族一份）

```jsonc
{
  "family": "qwen",                      // openai|anthropic|gemini|deepseek|qwen|glm|kimi|doubao
  "ratios": {
    "zh_chars_per_token": 0.62,          // 中文 token 密度系数
    "en_words_per_token": 0.75,
    "code_lines_per_token": 9.5
  },
  "usage_semantics": "openai-compatible-tail",  // 见 FP-TOKO-007 §4.3 映射总表
  "reasoning_channel": "thinking_block",
  "prefix_cache": { "billing": 0.1, "min_tokens": 1024 },
  "context_window": 131072,
  "stream_protocol": "sse-openai",
  "calibrated_at": "RFC3339",            // T0 标定后哈希锁定
  "content_hash": "sha256(...)"
}
```

### 1.3 错误码

| 错误 | 触发 | 处理 |
|------|------|------|
| PROFILE_NOT_FOUND | family 未登记 | 降级 openai profile，manifest 标注 fallback |
| PROFILE_STALE | calibrated_at 超过季度复标周期 | WARN 记录，继续使用，报告中标注 |

## 2. 数据模型

### 2.1 标定样本集

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| skill_name | string | 是 | 53 技能名称 |
| segment_type | enum | 是 | `zh` / `en` / `code`（混合内容分段套系数后求和） |
| char_count | number | 是 | 字符数 |
| measured_tokens | number | 否 | 供应商实测值（有 API 时）；无则仅静态系数 |

### 2.2 枚举值定义

| 字段 | 值 | 含义 |
|------|-----|------|
| family | openai / anthropic / gemini / deepseek / qwen / glm / kimi / doubao | 3.5.0 首期 8 家族；ernie/minimax/xai 走降级链（FP-TOKO-010） |
| segment_type | zh / en / code | 内容类型分段 |

## 3. 业务逻辑

### 3.1 处理流程

1. 收集 53 技能语料（SKILL.md + references）→ 2. 按内容类型分段 → 3. 对 8 家族采样标定（供应商 tokenizer API 或实测 usage 反推）→ 4. 回归拟合 ratios → 5. 生成 profile JSON + content_hash 锁定 → 6. 校准误差验收（≤5%）→ 7. 季度复标调度

### 3.2 业务规则

| 规则ID | 规则描述 | 约束类型 | 优先级 |
|--------|---------|---------|--------|
| R1 | 禁止用字符数直接报 token，一切估算必须过 profile | 强制 | P0 |
| R2 | 混合内容按 zh/en/code 分段套系数求和 | 强制 | P0 |
| R3 | 校准误差 >5% 的家族 profile 不得锁定发布 | 强制 | P0 |
| R4 | profile 变更必须重跑 content_hash 并升 profile 小版本 | 强制 | P1 |
| R5 | profile 文件名与标识统一为 {family}.json（= family 枚举值），禁用 qwen3 等模型型号名；fallback 标识固定为 openai(fallback) | 强制 | P0 |

### 3.3 边界条件

- 供应商不提供 tokenizer API 时：以公开定价页/官方文档系数为准，误差验收放宽并记录（不确定度标注）；
- 新模型发布导致 ratios 漂移：季度复标 + 运行时以实测 usage 为准（FP-TOKO-008）。

## 4. 不适用章节说明

| 模板章节 | 判定 | 理由 |
|---|---|---|
| 前端页面设计 / 前端实现约定 / 关联数据源 / 路由注册 | N/A | 平台库能力，无 UI、无业务 CRUD |
| 权限与安全 | N/A | 进程内静态配置，无鉴权面；profile 文件随包分发 |

## 5. 依赖检查清单

| 方向 | 依赖 | 说明 |
|------|------|------|
| 前置 | 无 | T0 起点 |
| 后续 | FP-TOKO-002 / 003 / 007 / 010 | 估算轨、CAG、适配器、降级链均消费 profile |
| 外部 | 各家族 tokenizer/usage 实测通道 | 不引入运行时网络依赖，仅标定期使用 |
