# PDD Skills V3 质量改进设计文档

## 基本信息

| 项目 | 内容 |
|------|------|
| 设计文档ID | PDD-QI-001 |
| 版本 | v1.0 |
| 日期 | 2026-04-26 |
| 数据来源 | ZCPG-3 评估核准功能 Bug 修改记录 |

## 1. 背景与问题

### 1.1 问题来源

ZCPG-3 评估核准功能使用 pdd-skills-v3 从 PRD 生成代码后，在实际使用过程中产生了大量 Bug 修改。通过分析 `修改功能bug的对话.md`（517KB），识别出 20+ 个 Bug 模式，归纳为 7 大类。

### 1.2 Bug 分类统计

| 类别 | Bug数量 | 占比 | 可预防性 |
|------|---------|------|---------|
| A: 前后端接口不一致 | 5 | 25% | 高 |
| B: 状态逻辑错误 | 4 | 20% | 高 |
| C: 权限与配置缺失 | 3 | 15% | 中 |
| D: 数据查询逻辑错误 | 2 | 10% | 中 |
| E: 功能遗漏 | 3 | 15% | 中 |
| F: 代码风格与一致性 | 2 | 10% | 高 |
| G: 缓存与数据一致性 | 1 | 5% | 低 |

### 1.3 根因分析

**80% 的 Bug 根因指向 pdd-generate-spec 阶段**：

- spec.md 接口定义不够精确（缺少参数名、Content-Type、响应嵌套结构）
- spec.md 状态机定义模糊（缺少状态枚举表、转换规则、前端映射）
- spec.md 缺少框架适配章节（若依的注解要求、菜单配置等）

**20% 的 Bug 根因指向 pdd-implement-feature 阶段**：

- 上下文注入不完整（未扫描已有状态常量、前端映射方法）
- 缺乏契约一致性自检（生成代码后未对比 spec 定义）

## 2. 改进目标

### 2.1 量化目标

| 指标 | 当前值 | 目标值 |
|------|--------|--------|
| A+B 类 Bug 数量（每功能点） | ~9个 | ≤2个 |
| 前后端接口一致性 | ~60% | ≥95% |
| 状态映射完整性 | ~70% | 100% |
| 首次生成代码可运行率 | ~50% | ≥80% |

### 2.2 定性目标

1. spec.md 成为前后端开发的"唯一真相源"，消除歧义
2. 状态机定义从"隐式推断"变为"显式声明"
3. 若依框架特定问题通过适配层自动处理
4. 已知 Bug 模式通过模式库自动检测和预防

## 3. 改进方案

### 3.1 总体策略：融合分阶段

- **第一阶段**：Bug 模式库扩展 + 模式扫描（快速见效，1-2天）
- **第二阶段**：Spec 模板增强 + 契约自检（源头预防，3-5天）

### 3.2 技术栈适配策略：通用 + 若依适配层

- 核心规则保持通用（适用于 Python Fullstack / Java Spring 等）
- 若依框架特定规则通过 `config/ruoyi-spec-extensions.yaml` 配置激活
- 检测到若依框架特征时自动加载适配层

## 4. 第一阶段：Bug 模式库扩展 + 模式扫描

### 4.1 扩展 bug-patterns.yaml

#### 4.1.1 A组：前后端接口一致性模式

```yaml
PATTERN-R008:
  name: "前后端参数名不匹配"
  name_en: "Frontend-backend parameter name mismatch"
  description: "后端@RequestParam/@PathVariable参数名与前端API调用参数名不一致"
  trigger: "新增API接口或修改接口参数"
  prevention: "spec.md中明确定义每个参数的名称、类型、传输方式"
  severity: critical
  detection:
    - "后端@RequestParam('file')但前端FormData使用'files'"
    - "后端@PathVariable('projectId')但前端路径使用'{id}'"
  fix_example: |
    # ❌ 错误 - 后端
    @RequestParam MultipartFile file
    # 前端
    formData.append('files', file)
    # ✅ 正确 - 统一参数名
    @RequestParam MultipartFile file
    formData.append('file', file)
  related_rules: ["api-param-contract"]
  tags: ["ruoyi", "api", "parameter", "consistency"]

PATTERN-R009:
  name: "请求格式不匹配"
  name_en: "Request format mismatch"
  description: "后端@RequestParam接收但前端发送JSON body，或反之"
  trigger: "新增POST/PUT接口"
  prevention: "spec.md中明确定义Content-Type和传输方式"
  severity: critical
  detection:
    - "后端@RequestParam但前端Content-Type: application/json"
    - "后端@RequestBody但前端使用URLSearchParams"
  fix_example: |
    # ❌ 错误 - 后端用@RequestParam，前端发JSON
    public AjaxResult approve(@RequestParam String result, @RequestParam String opinion)
    # 前端
    request({ data: { result, opinion } })  // Content-Type: application/json
    # ✅ 正确 - 后端用@RequestBody
    public AjaxResult approve(@RequestBody DecisionRequest req)
  related_rules: ["api-content-type"]
  tags: ["ruoyi", "api", "content-type", "consistency"]

PATTERN-R010:
  name: "API路径不一致"
  name_en: "API path mismatch"
  description: "前端API调用路径与后端@RequestMapping完整路径不匹配"
  trigger: "新增前端API调用或后端Controller"
  prevention: "spec.md中定义完整路径（类级+方法级）"
  severity: critical
  detection:
    - "前端url与后端类级@RequestMapping+方法级@RequestMapping拼接结果不同"
    - "前端调用404错误"
  fix_example: |
    # ❌ 错误 - 前端
    url: '/evaluation/approval/review/' + projectId
    # 后端
    @RequestMapping("/evaluation/approval/review/manage")
    @GetMapping("/detail/{projectId}")
    # ✅ 正确 - 前端
    url: '/evaluation/approval/review/manage/detail/' + projectId
  related_rules: ["api-path-contract"]
  tags: ["ruoyi", "api", "path", "consistency"]

PATTERN-R011:
  name: "响应结构解析错误"
  name_en: "Response structure parsing error"
  description: "前端直接取response.data但后端返回嵌套结构"
  trigger: "新增前端数据加载逻辑"
  prevention: "spec.md中定义完整的响应嵌套结构"
  severity: critical
  detection:
    - "前端response.data.xxx但后端AjaxResult.data是{project: {...}, records: [...]}"
    - "页面数据不显示但接口返回200"
  fix_example: |
    # ❌ 错误 - 前端
    this.project = response.data
    # 后端返回 { code: 200, data: { project: {...}, approvalRecords: [...] } }
    # ✅ 正确 - 前端
    const data = response.data || {}
    this.project = data.project || {}
    this.approvalRecords = data.approvalRecords || []
  related_rules: ["api-response-contract"]
  tags: ["ruoyi", "api", "response", "consistency"]

PATTERN-R012:
  name: "@PathVariable缺少name属性"
  name_en: "@PathVariable missing name attribute"
  description: "Spring Boot编译未保留参数名时@PathVariable必须指定value"
  trigger: "新增@PathVariable参数"
  prevention: "所有@PathVariable必须指定value属性"
  severity: warning
  detection:
    - "@PathVariable Long projectId 未指定value"
    - "启动报错: Name for argument of type [java.lang.Long] not specified"
  fix_example: |
    # ❌ 错误
    @PathVariable Long projectId
    # ✅ 正确
    @PathVariable("projectId") Long projectId
  related_rules: ["ruoyi-pathvariable"]
  tags: ["ruoyi", "controller", "pathvariable"]
```

#### 4.1.2 B组：状态逻辑一致性模式

```yaml
PATTERN-R013:
  name: "状态映射不完整"
  name_en: "Incomplete status mapping"
  description: "前端状态映射方法缺少后端定义的某些状态值"
  trigger: "后端新增状态常量或前端新增状态映射方法"
  prevention: "spec.md中定义完整的状态枚举表和前端映射表"
  severity: critical
  detection:
    - "后端EvalStatusConstant中的状态值未在前端getStatusLabel/getRecordTagType中覆盖"
    - "前端显示英文状态值而非中文"
    - "审批记录时间线圆点颜色不正确"
  fix_example: |
    # ❌ 错误 - 前端映射缺少APPROVED
    getStatusTagType(status) {
      const typeMap = { DRAFT: 'info', REJECTED: 'danger' }
      return typeMap[status] || 'info'
    }
    # ✅ 正确 - 覆盖所有状态
    getStatusTagType(status) {
      const typeMap = { DRAFT: 'info', REJECTED: 'danger', APPROVED: 'success', ... }
      return typeMap[status] || 'info'
    }
  related_rules: ["status-enum-completeness"]
  tags: ["ruoyi", "status", "mapping", "consistency"]

PATTERN-R014:
  name: "状态判断逻辑不一致"
  name_en: "Inconsistent status determination logic"
  description: "多处代码使用不同逻辑判断同一状态"
  trigger: "实现列表查询、统计、详情等多个接口"
  prevention: "spec.md中明确定义每个状态的判断条件，代码中统一使用同一判断源"
  severity: critical
  detection:
    - "列表接口用expert_selection.status判断，统计接口用项目status判断"
    - "同一状态在不同页面显示不同"
  fix_example: |
    # ❌ 错误 - 两处不同逻辑判断"评审完成"
    # 列表: selection.getStatus() == "COMPLETED"
    # 统计: project.getStatus() == "APPROVED"
    # ✅ 正确 - 统一使用expert_selection.status
    # 列表: "COMPLETED".equals(selection.getStatus())
    # 统计: expertSelectionMapper.countByStatus("COMPLETED")
  related_rules: ["status-source-single"]
  tags: ["ruoyi", "status", "logic", "consistency"]
```

### 4.2 pdd-implement-feature 增加 Step 8.5：模式扫描

在 Step 8（微验证）之后增加 Step 8.5（Bug模式扫描）：

#### 4.2.1 扫描流程

```
Step 8.5: Bug模式扫描
1. 读取 config/bug-patterns.yaml（含新增的 PATTERN-R008~R014）
2. 识别项目技术栈（检测若依框架特征）
3. 扫描本次生成的代码文件：
   a. Controller 文件 → 检查 PATTERN-R001, R005, R007, R012
   b. Service 文件 → 检查 PATTERN-R003, R013, R014
   c. 前端 API 文件 → 检查 PATTERN-R008, R009, R010
   d. 前端 Vue 文件 → 检查 PATTERN-R011, R013
4. 发现违规时：
   - critical → 立即修复并报告
   - warning → 记录并提示用户
5. 输出扫描报告到 dev-specs/FP-{序号}/pattern-scan-report.md
```

#### 4.2.2 扫描检查项

| 检查项 | 对应模式 | 检查内容 | 自动修复 |
|--------|---------|---------|---------|
| Controller参数检查 | R012 | @PathVariable是否有value属性 | ✅ 自动添加 |
| 前后端路径一致性 | R010 | 前端API url vs 后端完整路径 | ❌ 报告 |
| 请求格式一致性 | R009 | @RequestParam vs 前端Content-Type | ❌ 报告 |
| 响应结构一致性 | R011 | 前端取值路径 vs 后端返回结构 | ❌ 报告 |
| 状态映射完整性 | R013 | 后端常量类 vs 前端映射方法 | ❌ 报告 |
| 状态判断一致性 | R014 | 多处状态判断逻辑是否统一 | ❌ 报告 |
| 权限注解完整性 | R001 | Controller方法是否有@PreAuthorize | ✅ 添加模板 |
| 参数校验完整性 | R005 | @RequestBody参数是否有@Validated | ✅ 自动添加 |
| 操作日志完整性 | R007 | CUD操作是否有@Log注解 | ✅ 自动添加 |

### 4.3 pdd-implement-feature SKILL.md 修改

在 Iron Law 中增加第 9 条：

```
9. **模式扫描不可跳过**: 每完成一个功能点的代码实现后，必须执行Bug模式扫描(Step 8.5)，
   扫描报告中的critical级别问题必须立即修复，不得继续下一个功能点。
```

在 Red Flags 中增加：

```
- EXEC-IMPL-007: 功能点完成后跳过Bug模式扫描(未执行Step 8.5) → 🔴 CRITICAL → 立即执行模式扫描
- EXEC-IMPL-008: 模式扫描发现critical级别问题但未修复 → 🔴 CRITICAL → 修复后才能继续
```

## 5. 第二阶段：Spec 模板增强 + 契约自检

### 5.1 pdd-generate-spec 增强 spec.md 模板

#### 5.1.1 新增章节：接口契约（替换原 1.2 接口详情）

原模板：
```markdown
### 1.2 接口详情
#### POST /api/{module}/create
**请求参数**: 字段名/类型/必填/说明
**响应结构**: code/msg/data
**错误码**: 错误码/描述/处理方式
```

新模板：
```markdown
### 1.2 接口契约

#### POST /api/{module}/create

**请求契约**:
| 参数名 | 类型 | 传输方式 | 必填 | 说明 |
|--------|------|---------|------|------|
| name | String | @RequestBody | 是 | 名称 |
| file | MultipartFile | @RequestParam("file") | 否 | 附件 |

**Content-Type**: multipart/form-data

**响应契约**:
| 字段路径 | 类型 | 说明 | 空值处理 |
|---------|------|------|---------|
| data | Object | 返回数据 | null时返回{} |
| data.id | Long | 新建记录ID | - |
| data.project | Object | 项目信息 | null时返回{} |
| data.approvalRecords | Array[Object] | 审批记录 | null时返回[] |

**错误码**:
| 错误码 | 描述 | 处理方式 |
|--------|------|---------|
| 400 | 参数校验失败 | 显示具体校验错误信息 |
| 403 | 无权限 | 提示联系管理员 |
| 500 | 服务器错误 | 提示稍后重试 |
```

**关键改进点**：
1. 参数增加"传输方式"列（@RequestParam/@RequestBody/@PathVariable）
2. 新增 Content-Type 行
3. 响应使用"字段路径"而非"字段名"（支持嵌套结构如 `data.project`）
4. 响应增加"空值处理"列

#### 5.1.2 新增章节：状态机定义

```markdown
## 3.4 状态机定义

### 3.4.1 状态枚举表
| 状态值 | 中文名 | 所属表/字段 | 判断条件 | 初始状态 | 终态 |
|--------|--------|-----------|---------|---------|------|
| DRAFT | 草稿 | eval_project.status | - | 是 | 否 |
| REVIEWING | 评审中 | eval_project.status | - | 否 | 否 |
| COMPLETED | 已完成 | expert_selection.status | conclusion_text IS NOT NULL OR conclusion_file_path IS NOT NULL | 否 | 是 |

### 3.4.2 状态转换规则
| 当前状态 | 触发事件 | 目标状态 | 前置条件 | 操作人 | 记录审批历史 |
|---------|---------|---------|---------|--------|------------|
| DRAFT | 提交申请 | DEPT_PENDING | 必填字段校验通过 | 申请人 | 是 |
| REVIEWING | 关闭评审 | STAMPED_PENDING | 有评审结论 | 集团经办人 | 是 |

### 3.4.3 前端状态映射
| 状态值 | 标签文本 | 标签类型(el-tag type) | 时间线圆点颜色 | 图标 |
|--------|---------|---------------------|--------------|------|
| DRAFT | 草稿 | info | #909399 | el-icon-edit |
| APPROVED | 已核准 | success | #67C23A | el-icon-check |
| REJECTED | 审批退回 | danger | #F56C6C | el-icon-close |

### 3.4.4 状态查询源
| 业务概念 | 查询源表 | 查询源字段 | 说明 |
|---------|---------|-----------|------|
| 评审状态 | expert_selection | status | COMPLETED=已完成, 其他=评审中 |
| 项目状态 | eval_project | status | 参见3.4.1状态枚举表 |
```

**关键改进点**：
1. 状态枚举表增加"所属表/字段"和"判断条件"列
2. 状态转换规则增加"记录审批历史"列
3. 前端映射表增加"标签类型"和"时间线圆点颜色"列
4. 新增"状态查询源"小节，明确每个业务概念的查询来源

#### 5.1.3 新增章节：若依框架适配（条件激活）

```markdown
## 10. 若依框架适配

> 本章节仅在检测到若依框架时激活

### 10.1 权限注解映射
| 接口路径 | HTTP方法 | 权限标识 | 角色要求 |
|---------|---------|---------|---------|
| /list | GET | eval:project:list | 所有授权用户 |
| / | POST | eval:project:add | 申请人 |
| /{id}/approve | PUT | eval:project:approve | 审批人 |

### 10.2 菜单配置
| 菜单名称 | 父菜单ID | 路由地址 | 组件路径 | 菜单类型(M/C/F) | 排序 | 权限标识 |
|---------|---------|---------|---------|----------------|------|---------|

### 10.3 数据权限
| Service方法 | @DataScope配置 | deptAlias | userAlias |
|------------|---------------|-----------|-----------|

### 10.4 框架特定要求
- @PathVariable 必须指定 value 属性（如 @PathVariable("projectId") Long projectId）
- @RequestBody 参数必须添加 @Validated 注解
- 文本字段必须添加 @Xss 注解
- CUD 操作必须添加 @Log 注解
- 列表查询 Service 方法必须添加 @DataScope 注解
- 新页面必须配置 sys_menu INSERT 语句
```

### 5.2 pdd-generate-spec SKILL.md 修改

#### 5.2.1 修改 Guardrails

增加：
```
**必须遵守**: 接口契约必须包含传输方式和Content-Type | 响应契约必须使用字段路径支持嵌套结构 |
状态枚举必须指定所属表和判断条件 | 状态转换规则必须指定是否记录审批历史 |
前端映射必须覆盖所有状态值 | 若依项目必须填写第10章
```

#### 5.2.2 修改 Red Flags

增加：
```
- EXEC-GS-008: 接口契约缺少传输方式或Content-Type → 🔴 CRITICAL → 补充完整的请求契约
- EXEC-GS-009: 响应契约使用扁平字段名而非字段路径 → 🔴 CRITICAL → 改为嵌套字段路径
- EXEC-GS-010: 状态枚举表缺少所属表/判断条件列 → 🔴 CRITICAL → 补充状态查询源
- EXEC-GS-011: 前端映射表未覆盖所有状态值 → 🔴 CRITICAL → 补充遗漏的状态映射
- EXEC-GS-012: 若依项目未填写第10章适配内容 → 🟡 WARN → 提示填写框架适配章节
```

### 5.3 pdd-implement-feature 增强 Step 1.5 上下文注入

#### 5.3.1 扩展扫描范围

| 扫描目标 | 提取内容 | 用途 |
|---------|---------|------|
| `*Constant.java` | 状态枚举值列表 | 确保新代码使用已有常量 |
| `*StatusConstant.java` | 状态转换规则 | 确保新代码遵循已有规则 |
| 前端 `*.vue` 中的 `getStatusLabel`/`getRecordTagType` | 已有状态映射 | 确保新映射与已有映射一致 |
| `*Controller.java` 的 `@RequestMapping` | API 路径前缀 | 确保新路径不冲突 |
| `*Mapper.xml` 的查询条件 | 已有查询逻辑 | 确保新查询不遗漏条件 |
| `*Service.java` 的 `@DataScope` | 数据权限配置 | 确保新查询有数据权限 |
| `router/index.js` | 已有路由配置 | 确保新路由不冲突 |

### 5.4 pdd-implement-feature 增加 Step 8.6：契约一致性自检

在 Step 8.5（模式扫描）之后增加 Step 8.6（契约一致性自检）：

```
Step 8.6: 契约一致性自检
1. 读取 spec.md 中的接口契约章节（1.2）
2. 对比生成的后端代码：
   a. Controller 参数名 vs spec 定义的参数名
   b. Controller @RequestMapping 路径 vs spec 定义的路径
   c. Controller 传输方式(@RequestParam/@RequestBody) vs spec 定义
3. 对比生成的前端代码：
   a. API 调用路径 vs 后端完整路径
   b. 响应取值路径 vs spec 定义的响应结构
   c. 状态映射方法 vs spec 定义的状态枚举表
4. 不一致时：
   - 参数名/路径不一致 → 🔴 CRITICAL → 自动修复或报告
   - 传输方式不一致 → 🔴 CRITICAL → 报告
   - 响应结构不一致 → 🔴 CRITICAL → 报告
   - 状态映射遗漏 → 🟡 WARN → 报告
5. 输出自检报告到 dev-specs/FP-{序号}/contract-check-report.md
```

### 5.5 新增配置文件

**`config/ruoyi-spec-extensions.yaml`**：

```yaml
framework: ruoyi
version: "1.0.0"
description: "若依框架的Spec扩展配置，当检测到若依框架时自动激活"

detection:
  file_patterns:
    - pattern: "pom.xml"
      content_contains: "ruoyi"
    - pattern: "application.yml"
      content_contains: "ruoyi"
  directory_patterns:
    - "src/main/java/com/**/controller/"
    - "src/main/resources/mapper/"

spec_extensions:
  chapter_10:
    title: "若依框架适配"
    required_sections:
      - permission_annotations
      - menu_configuration
      - data_scope
      - framework_requirements
    auto_fill:
      permission_prefix: "eval"  # 默认权限前缀
      menu_parent_id: 2000       # 默认父菜单ID

implement_extensions:
  context_scan:
    additional_patterns:
      - "*Constant.java"
      - "*StatusConstant.java"
      - "router/index.js"
      - "api/**/*.js"
  auto_fix:
    - pattern: PATTERN-R012
      action: "add_pathvariable_name"
      description: "自动为@PathVariable添加value属性"
    - pattern: PATTERN-R001
      action: "add_preauthorize_template"
      description: "自动添加@PreAuthorize注解模板"
    - pattern: PATTERN-R005
      action: "add_validated_annotation"
      description: "自动为@RequestBody参数添加@Validated"
    - pattern: PATTERN-R007
      action: "add_log_annotation"
      description: "自动为CUD操作添加@Log注解"
```

## 6. 实施计划

### 6.1 第一阶段（1-2天）

| 任务 | 修改文件 | 预计时间 |
|------|---------|---------|
| 扩展 bug-patterns.yaml | config/bug-patterns.yaml | 2h |
| 修改 pdd-implement-feature SKILL.md | skills/core/pdd-implement-feature/SKILL.md | 2h |
| 增加 Step 8.5 模式扫描描述 | skills/core/pdd-implement-feature/SKILL.md | 1h |
| 增加 Iron Law 第9条 | skills/core/pdd-implement-feature/SKILL.md | 0.5h |
| 增加 Red Flags | skills/core/pdd-implement-feature/SKILL.md | 0.5h |

### 6.2 第二阶段（3-5天）

| 任务 | 修改文件 | 预计时间 |
|------|---------|---------|
| 修改 spec.md 模板（接口契约） | skills/core/pdd-generate-spec/SKILL.md | 3h |
| 修改 spec.md 模板（状态机） | skills/core/pdd-generate-spec/SKILL.md | 2h |
| 新增 spec.md 模板（若依适配） | skills/core/pdd-generate-spec/SKILL.md | 2h |
| 修改 pdd-generate-spec Guardrails | skills/core/pdd-generate-spec/SKILL.md | 1h |
| 修改 pdd-generate-spec Red Flags | skills/core/pdd-generate-spec/SKILL.md | 1h |
| 增强 Step 1.5 上下文注入 | skills/core/pdd-implement-feature/SKILL.md | 2h |
| 增加 Step 8.6 契约自检 | skills/core/pdd-implement-feature/SKILL.md | 2h |
| 创建 ruoyi-spec-extensions.yaml | config/ruoyi-spec-extensions.yaml | 1h |
| 验证测试 | - | 4h |

## 7. 验证方法

### 7.1 第一阶段验证

使用 ZCPG-3 项目的 Bug 记录作为测试用例：

| Bug | 对应模式 | 验证方法 |
|-----|---------|---------|
| 参数名file vs files | PATTERN-R008 | 扫描生成的Controller，检查参数名一致性 |
| @RequestParam vs JSON body | PATTERN-R009 | 扫描Controller和前端API，检查Content-Type |
| API路径不一致 | PATTERN-R010 | 扫描前端url和后端@RequestMapping |
| 响应结构解析错误 | PATTERN-R011 | 扫描前端取值路径和后端返回结构 |
| @PathVariable缺name | PATTERN-R012 | 扫描Controller，自动添加value |
| 状态映射不完整 | PATTERN-R013 | 对比后端常量类和前端映射方法 |
| 状态判断不一致 | PATTERN-R014 | 检查多处状态判断逻辑 |

### 7.2 第二阶段验证

使用 ZCPG-3 项目的 PRD 重新生成 spec.md，检查：

1. 接口契约是否包含传输方式和 Content-Type
2. 响应契约是否使用字段路径
3. 状态枚举表是否包含所属表和判断条件
4. 前端映射表是否覆盖所有状态值
5. 若依适配章节是否自动填充

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| spec.md 文档变长，维护成本增加 | 中 | 采用分层详略策略，概览+详细表格 |
| 模式扫描误报 | 低 | 设置合理的检测阈值，warning级别不阻塞 |
| 若依适配层不完整 | 中 | 优先覆盖高频模式，持续积累 |
| 契约自检无法覆盖运行时问题 | 中 | 结合微验证（Step 8）进行运行时检查 |
