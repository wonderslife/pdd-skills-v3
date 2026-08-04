---
name: pdd-implement-feature
description: "根据开发规格实现功能点代码的核心Skill。涉及代码生成、功能开发时触发，自动调用pdd-template-engine生成框架，再委托software-engineer补业务逻辑。触发：实现功能点、编码实现、开始编码、功能开发、代码实现、PDD实现。"
license: MIT
compatibility: Requires specification generation to be completed first
metadata:
  author: neuqik@hotmail.com
  version: "2.0"
  parent: pdd-main
---

# Feature Point Implementation - 基于开发规格的功能点实现

**输入**: spec.md(开发规格) | checklist.md(验收标准) | test-cases.md(测试用例,可选)
**输出**: 代码文件 | 验收报告

## 技能集成
- **software-engineer**：代码实现、单元测试、重构、缺陷修复
- **专家（按需）**：expert-ruoyi（若依）、expert-activiti（工作流/BPMN）、expert-mysql（SQL）、expert-code-quality（质量）

## 流程步骤
1. **读取开发规格**：从 `dev-specs/FP-{序号}/spec.md` 读接口/数据模型/业务逻辑/测试用例
2. **上下文注入（关键）**：生成代码前扫描项目已有代码，避免孤岛效应——扫描 models/ 的Model、api/ 的路由、schemas/ 的Schema、`config/bug-patterns.yaml` 的Bug模式、PRD命名约定；建立{后端路径→前端调用文件}映射、{状态值→使用文件}映射。确保 new代码正确import、路由不冲突、Schema字段一致、前端API路径与后端Controller一致、新增状态值各映射文件同步（防 PATTERN-C4/C3/002/R008/R011）。
3. **读取验收标准**：checklist.md
4. **确定实现顺序**：数据模型→数据库脚本→后端接口→前端页面
5. **生成数据库脚本**：SQL 含审计字段 create_time/update_time/create_by/update_by/del_flag/status
6. **生成后端代码**（委托 software-engineer）：Domain(@Data/@TableName) | Mapper(@Mapper/BaseMapper) | Service(@Service/ServiceImpl) | Controller(@RestController/@RequestMapping)
7. **生成前端代码**（委托 software-engineer）：API(request封装) | Vue组件
8. **实现业务逻辑**：处理流程/校验规则/状态转换/异常处理
9. **微验证（关键）**：每完成一个功能点立即执行（约30秒）——①后端启动 `python -m uvicorn app.main:app --reload` 无报错 ②`GET /docs` 可见Swagger ③Schema创建+查询各1次确认datetime/Enum序列化 ④`npm run build` 无报错 ⑤`curl GET /{module}/options` 返回非空。失败必须立即修复，不得继续下一个功能点。
10. **运行完整测试**：单元/接口/集成测试
11. **更新验收状态**：更新 checklist.md
12. **生成验收报告**：业务验收/技术验收/问题日志/结论

## 代码标准
- 后端：类名PascalCase、方法camelCase、常量UPPER_SNAKE_CASE、Javadoc注释
- 前端：组件PascalCase、方法camelCase、CSS类kebab-case、ES6+
- software-engineer 标准：先读现有代码风格、错误处理优先、保持最小化、PR-ready

## PR管理提示（不自动调用）
功能点完成后提示用户可手动调用：`/pdd-pr-create {change-id}`、`/pdd-pr-review {change-id}`、`/pdd-pr-merge {change-id}`。**PDD框架不会自动调用 pdd-pr-* 技能，需用户手动决定。**

## 错误处理与回退
- 错误分级：Critical(阻塞)/Warning(非阻塞)/Suggestion(可选)
- 重试策略：每功能点最多3次，超限暂停等人工决策
- 回退：code-reviewer审查失败→返回重新实现；verify-feature验证失败→返回重新验证
- 失败记录：`dev-specs/FP-{模块}-{序号}/review-report.md`（时间/阶段/原因/次数/日志）

## Guardrails
- 代码符合项目标准；实现规格所有接口与异常；通过全部验收项才算完成；变更后同步更新规格文档
- 遇到技术问题必须咨询专家；代码实现遵循 software-engineer 标准；完成后提示PR管理但不自动调用

## Iron Law 铁律
1. **规格即法律**：严格遵循 spec.md，不擅自添加，不遗漏接口/字段。
2. **委托不替代**：框架特定问题必须调用对应 expert 技能。
3. **错误处理优先**：先做参数校验/异常/边界，不只写"快乐路径"。
4. **代码标准对齐**：风格与项目一致，先读同类模块现有代码。
5. **验收驱动开发**：每完成一个接口立即对照 checklist 自检。
6. **上下文感知生成**：生成前扫描已有 Model/Schema/路由，避免孤岛效应。
7. **微验证即时反馈**：每功能点必须微验证，不得跳过。
8. **Bug模式库约束**：遵守 `config/bug-patterns.yaml`，已知陷阱不重复触犯。
- 违规：❌功能蔓延 ❌不调expert-ruoyi ❌只写正常流程 ❌命名风格不一致 ❌写完才运行发现编译错 ❌不扫已有代码 ❌跳过微验证 ❌datetime声明为str(PATTERN-001) ❌/options在/{id}后(PATTERN-002)
- 合规：✅按spec接口列表逐一实现 ✅调expert-ruoyi ✅Service方法开头校验参数 ✅先读TransferApplyController保持风格 ✅逐个Controller方法测试 ✅生成前扫models/、schemas/ ✅每功能点微验证 ✅datetime用field_serializer ✅/options在/{id}前

## Rationalization 陷阱
- "规格偏离"：实现逐渐偏离规格→建立实现清单逐项打勾对照
- "框架硬扛"：反复尝试不求助→"3次尝试规则"，3次未解决必须调expert
- "快乐路径"：只实现正常流程→每个public方法必须有try-catch
- "风格割裂"：新代码与项目风格不一致→"先读后写"

## Red Flags 红旗
- **L1 输入**：INPUT-IMPL-001 spec/checklist 不存在→🔴；002 spec缺接口/数据模型→🔴；003 项目路径不可访问→🔴
- **L2 执行**：EXEC-IMPL-001 实现规格外接口→🟡；002 框架问题未调expert硬编码→🔴；003 空指针风险→🟡；004 SQL注入→🔴；005 未扫描已有代码(Step 1.5)→🔴；006 跳过微验证(Step 8)→🔴
- **L3 输出**：OUTPUT-IMPL-001 语法错误→🔴；002 规格接口未全实现→🔴；003 路径不符→🔴；004 datetime为str(PATTERN-001)→🔴；005 /options在/{id}后(PATTERN-002)→🔴
- 处理：🔴立即停止上报 | 🟡记录警告尝试修复 | 🔵记录正常继续