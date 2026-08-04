---
name: pdd-entropy-reduction
description: "PDD熵减智能体，持续监控和偿还技术债务，防止系统腐化。触发：熵减、技术债务、代码清理、文档更新、架构对齐、垃圾回收、entropy reduction。"
license: MIT
metadata:
  author: neuqik@hotmail.com
  version: "2.0"
  parent: pdd-main
  triggers:
    - "熵减" | "清理技术债务" | "代码清理"
    - "文档更新" | "技术债务管理" | "架构对齐"
---

# PDD Entropy Reduction Agent - 熵减智能体

> "Technical debt is like a high-interest loan: better to repay in small amounts than let it accumulate." —— OpenAI Harness Engineering

**目标**：通过定期运行智能体发现文档不一致或架构违反，对抗系统熵增与衰减。

**熵增 vs 熵减**：代码腐化(重复/过长/命名)→重构；文档过时→同步；债务累积(TODO/临时方案)→偿还；架构漂移(依赖方向/边界)→对齐；测试不足→补充。

## 四大专业子技能
协调器(pdd-entropy-reduction)负责调度和聚合结果，不直接执行具体操作：
- **pdd-doc-gardener**：文档园丁，检测代码-文档不一致/注释过时/API不匹配，自动创建修复PR
- **expert-arch-enforcer**：架构约束强制，检测依赖方向违规/边界数据缺失/文件过大/命名违规，运行Linter
- **expert-entropy-auditor**：熵增审计，检测PRD-代码不一致/AI残渣/分散工具类，归集到共享工具包
- **expert-auto-refactor**：自动化重构，检测重复代码/复杂逻辑/命名优化，定期发起重构PR

## 工作流程
触发(手动/定时/事件) → 扫描(文档/代码/架构) → 分析(熵评分/分类/优先级) → 执行(自动修复/创建PR/更新文档)

**熵评分系统**(0-100，100=最有秩序)：90-100优秀维持 | 70-89良好小幅改进 | 50-69一般计划清理 | 30-49警告优先处理 | 0-29危急紧急重构

## 执行指南
1. **熵增检测**：选择范围 全量/仅文档/仅架构/仅代码
2. **生成熵减报告**：用 `references/entropy-report-template.md`，含熵评分/问题列表(按优先级)/修复建议/预估工作量
3. **熵减执行**：简单修复(命名/格式)→自动修复提交；中等(文档更新)→创建PR；复杂(重构)→Issue+PR

## 黄金原则
1. 使用共享工具包，避免手写辅助函数
2. 验证边界数据，不猜测数据结构（API入口必须有Schema验证）
3. 保持代码简洁，优先可读性（单文件≤300行，单函数≤50行）
4. 文档即代码，保持同步（过时文档=技术债务）
5. 小额还贷，持续改进（每次commit都是改进机会）

## 配置文件（`entropy-config.yaml`）
```yaml
entropy_reduction:
  triggers: { schedule: "0 2 * * *", on_commit: false, on_pr_merge: true }
  detection:
    docs: { enabled: true, paths: ["docs/", "*.md"], max_age_days: 30 }
    architecture: { enabled: true, layers: ["types","config","repo","service","runtime","ui"] }
    code: { enabled: true, max_file_lines: 300, max_function_lines: 50 }
  execution: { auto_fix: true, create_pr: true, max_pr_per_run: 5 }
```

## 输出格式
每次执行后生成报告存到 `docs/entropy-reports/`：`# Entropy Reduction Report - YYYY-MM-DD` + 熵评分 + 问题列表(Critical/Warning/Info) + 修复建议与执行结果。

## 与PDD流程集成
PDD正向流程(PRD→功能提取→规格→实现→验收) ←→ PDD熵减流程(检测→报告→执行→自动修复→PR创建)

## Iron Law 铁律
1. **子技能协调不替代**：协调器只调度和聚合，不直接执行子技能具体操作。
2. **熵评分客观化**：基于可量化指标(代码重复率/文档过时率/架构违规数)，不得凭主观感觉。
3. **修复策略分级**：按问题类型和严重程度选策略(自动修复/PR/人工)，不一刀切。
4. **变更影响可控**：控制单次变更范围(如单次PR≤文件数)，避免大规模重构引风险。
5. **执行结果可度量**：每次前后有度量对比(熵分变化/修复数/新问题数)，无法度量=没做。
- 违规：❌直接写修复逻辑不调auto-refactor ❌"感觉代码质量不太好"模糊评分 ❌全自动修复 ❌一次提交50+文件 ❌只说"清理完成"无量化
- 合规：✅调doc-gardener、arch-enforcer ✅报告"文档过时15%、架构违规2处、重复率8%→72分" ✅Critical自动修复/Warning建PR/Suggestion待观察 ✅单次PR≤5文件 ✅"68→82分，修复Critical 3个"

## Rationalization 陷阱
- "全能选手"：协调器想自己完成所有→只负责调度/聚合/报告
- "模糊评分"：评分无量化依据→建立指标+权重+计算方法
- "暴力清洗"：一次性大规模修改→安全阈值(≤5文件/≤100行)
- "无闭环"：执行了未验证→报告含前后对比+回归验证

## Red Flags 红旗
- **L1 输入**：INPUT-ER-001 项目目录不可访问→🔴；002 config缺失→🔵默认；003 未指定范围→🔵默认全量
- **L2 执行**：EXEC-ER-001 协调器直接执行子技能→🟡；002 评分缺量化→🔴；003 单次修复超上限→🔴；004 自动修复未备份→🟡
- **L3 输出**：OUTPUT-ER-001 缺前后对比→🔴；002 缺行动计划→🟡；003 声明"已修复"缺证据→🔴
- 处理：🔴立即停止上报 | 🟡记录警告尝试修复 | 🔵记录正常继续