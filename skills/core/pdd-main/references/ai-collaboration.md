# AI协作模式与复杂度策略

> 本文件为 pdd-main 的参考资料，按需加载。

## 复杂度与AI角色

根据功能复杂度自动选择AI角色：

| 复杂度 | AI角色 | 人工参与度 | 适用场景 |
|-------|--------|-----------|---------|
| P0 | 协作者+架构师+专家 | 高 | 核心业务流程/复杂状态转换 |
| P1 | 协作者+架构师 | 中 | 重要功能/中等复杂度 |
| P2 | 主导者+工程师 | 低 | 简单功能/辅助功能 |

## 复杂度与技能调用策略

**P0（核心业务）**: pdd-main + pdd-ba + pdd-generate-spec → 架构咨询(system-architect + software-architect) → pdd-implement-feature + software-engineer + expert-ruoyi/expert-mysql → pdd-code-reviewer + software-architect → pdd-verify-feature

**P1（重要功能）**: pdd-main + pdd-extract + pdd-generate-spec → 按需咨询software-architect → pdd-implement-feature + software-engineer + expert-xxx(按需) → pdd-code-reviewer → pdd-verify-feature

**P2（辅助功能）**: pdd-main + pdd-generate-spec → pdd-implement-feature + software-engineer(主导) → pdd-code-reviewer(简化版) → pdd-verify-feature