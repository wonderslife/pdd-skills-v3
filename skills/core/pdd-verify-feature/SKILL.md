---
name: pdd-verify-feature
description: 验证功能点实现是否符合开发规格和验收标准，采用三维验证模型（完整性、正确性、一致性）。触发：验证功能、功能验收、验收检查、PDD验证、verify feature。
license: MIT
compatibility: 需要功能点代码和验收标准
metadata:
  author: "neuqik@hotmail.com"
  version: "4.1"
  parent: pdd-main
  triggers:
    - "验证功能" | "验收" | "/verify"
    - "功能点验收" | "checklist验证"
---

# PDD-Verify Feature - 功能点验证技能

验证功能点实现是否符合开发规格和验收标准，采用**三维验证模型**：

| 维度 | 定义 | 验证要点 |
|------|------|---------|
| Completeness 完整性 | 规格要求的功能是否都实现 | 接口完整/字段齐全/业务规则覆盖 |
| Correctness 正确性 | 实现是否符合规格 | 逻辑正确/数据处理准确/规则正确 |
| Coherence 一致性 | 前后端、文档与代码一致 | 接口一致/文档代码一致/命名统一 |

**问题分级**：🔴 Critical（必须修复，否则验收不通过）| 🟡 Warning（建议修复）| 🔵 Suggestion（可选优化）。

## 验证流程
1. **收集材料**：后端(Controller/Service/Mapper)、前端(Vue/API)、SQL；spec.md、checklist.md、PRD
2. **Completeness**：接口完整性（路径/方法/参数/响应/错误码）、字段完整性、业务规则覆盖
3. **Correctness**：接口逻辑、业务规则（边界/异常）、数据处理
4. **Coherence**：前后端接口定义、文档与代码、命名规范
5. **契约一致性**：用 `openapi-contract-sync.js` 检查 ①前端每个URL是否有后端端点 ②后端datetime→前端string(ISO8601) ③PRD声明的下拉数据源是否有 /options 端点 ④枚举值符合 snake_case
6. **Bug模式库验证**：对照 `config/bug-patterns.yaml` 检查已知模式

**Bug模式要点**：PATTERN-001 datetime=datetime非str🔴 | 002 /options在/{id}前🔴 | 003 枚举编码🟡 | 004 safeAlert非原生alert🟡 | 005 my-tasks查询条件完整🔴 | 007 编号生成验证已存在🔴 | R001 @PreAuthorize🔴 | R002 sys_menu🔴 | R003 @DataScope🔴

## 验证检查清单
- **接口**：路径/方法/参数/响应结构/错误码
- **业务逻辑**：状态转换/规则执行/校验/异常处理
- **数据**：字段类型/长度/必填/格式
- **权限**：权限注解/数据权限/按钮权限
- **一致性**：接口路径/字段名/数据类型/校验规则
- **契约**：端点覆盖/datetime映射/Options完整性/枚举snake_case/Bug模式PATTERN-001~007及R001~R007全部通过

## 输出规范
生成验收报告（含基本信息、三维度结果、问题清单、验收结论、签名）。
- 验收结论：✅通过（Critical全修复）| 有条件通过（Critical已记录待修复）| ❌不通过（存在未修复Critical）
- 每问题需含：文件+行号+现象+预期+实际+建议（五要素）

## 启发式检查
- 常见遗漏：分页/排序/导入导出/批量操作
- 常见错误：空指针/数组越界/类型转换/日期格式/数字精度
- 降级：无法完整验证时→代码审查降级、核心功能优先、记录未验证项与风险

## 与其他技能协作
pdd-code-reviewer(顺序，审查报告→问题列表) | pdd-implement-feature(循环，验收不通过→修复) | pdd-main(顺序，验收报告→交付确认)

## 断点续传与错误处理
- 状态文件 `.pdd-state.json`；"继续执行"触发
- 重试限制：同一功能点最多3次，超限暂停等人工决策
- 失败记录：`dev-specs/FP-{模块}-{序号}/review-report.md`
- 质量改进任务：模块完成后统一处理，输出 `improvement-tasks.md`

## Iron Law 铁律
1. **三维验证不可缺省**：必须完整执行 Completeness/Correctness/Coherence，不得因时间压力跳过。
2. **Critical 一票否决**：存在未修复 Critical 即验收不通过。
3. **证据驱动**：每个结论须有证据（代码位置/规格引用/测试结果），不得模糊判断。
4. **不假设运行环境**：基于静态分析+规格对照，如需运行须说明环境依赖。
5. **报告可追溯**：问题精确到文件名、行号、规格引用。
- 违规：❌只查接口完整性就通过 ❌Critical说"不影响主流程"仍通过 ❌"基本正确"无位置 ❌假设数据库已配置 ❌"状态转换有问题"不指明哪个
- 合规：✅三维矩阵各维度明确判定 ✅Critical即判不通过并给修复建议 ✅标注"TransferApplyServiceImpl.java:142 缺底价校验，参考spec.md 4.3" ✅说明"数据层基于SQL语法分析未实际执行" ✅精确到行号与规则BR-001

## Rationalization 陷阱
- "宽松验收"：Critical>0 绝对不通过
- "模糊报告"：问题硬性要求五要素（文件/行号/现象/预期/实际）
- "单维验证"：用三维清单强制覆盖全部维度
- "乐观假设"：明确标注验证前提与未验证项，不做隐含假设

## Red Flags 红旗
- **L1 输入**：INPUT-VER-001 代码缺失→🔴；002 spec/checklist 缺失→🔴；003 功能点ID不匹配→🟡
- **L2 执行**：EXEC-VER-001 跳过任一维度→🔴；002 有Critical仍判通过→🔴；003 问题不可追溯→🟡；004 前后端不一致未记录→🔴
- **L3 输出**：OUTPUT-VER-001 缺三维汇总→🔴；002 结论"通过"却有Critical→🔴；003 缺签名区→🟡
- 处理：🔴立即停止上报 | 🟡记录警告尝试修复 | 🔵记录正常继续