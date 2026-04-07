---
name: pdd-template-engine
description: |
  PDD模板引擎技能，根据功能点规格自动选择和渲染代码模板。当用户需要生成代码、使用模板快速开发、自动生成代码、批量生成、脚手架、代码骨架、快速生成、模板生成、基础代码框架、生成脚手架等场景时自动触发。支持若依框架CRUD和Activiti工作流场景，可将代码有效率从50%提升至75%+。即使用户只说"生成代码"、"用模板"、"脚手架生成"、"生成脚手架"等简短表述，也应触发此Skill。
license: MIT
compatibility: 需要模板库 (.trae/templates/)
metadata:
  author: "neuqik@hotmail.com"
  version: "1.0"
---

# PDD模板引擎技能

## 技能描述

PDD模板引擎是一个代码生成工具，根据功能点规格自动选择和渲染代码模板，生成符合项目规范的代码文件。支持若依框架和Activiti工作流的代码生成。

## 触发条件

- 用户请求"生成代码"、"使用模板生成"等
- pdd-implement-feature技能调用
- 用户指定使用特定场景模板

## 核心能力

### 1. 模板选择

根据功能点特征自动选择合适的模板组合：

| 场景类型 | 判断条件 | 使用模板 |
|---------|---------|---------|
| 简单CRUD | 无审批流程 | scenarios/crud |
| 工作流+CRUD | 需要审批流程 | scenarios/workflow-crud |

### 2. 变量提取

从spec.md中提取模板变量：

```yaml
提取规则:
  基础变量:
    - entityName: 从数据模型中提取实体名称
    - tableName: 从数据模型中提取表名
    - businessName: 从功能描述中提取业务名称
    - moduleName: 根据模块编号转换
  
  字段变量:
    - fields: 从数据模型字段列表提取
    - searchFields: 从查询条件提取
    - formFields: 从表单设计提取
    - requiredFields: 从验证规则提取
  
  工作流变量:
    - processKey: 从流程设计提取
    - approvalRules: 从审批规则提取
    - processVariables: 从流程变量定义提取
```

### 3. 模板渲染

使用Handlebars语法渲染模板：

```yaml
渲染规则:
  变量替换: {{variableName}}
  条件渲染: {{#if condition}}...{{/if}}
  循环渲染: {{#each items}}...{{/each}}
  辅助函数:
    - pascalCase: 转换为PascalCase
    - camelCase: 转换为camelCase
    - kebabCase: 转换为kebab-case
    - snakeCase: 转换为snake_case
```

### 4. 代码生成

生成符合项目规范的代码文件：

```yaml
输出结构:
  后端:
    - Controller.java
    - Service.java / ServiceImpl.java
    - Mapper.java / Mapper.xml
    - Entity.java
    - SQL脚本
  
  前端:
    - Vue组件 (list/form/detail)
    - API接口文件
    - 工作流组件 (approval-panel)
  
  工作流:
    - BPMN流程定义文件
    - ProcessService.java
    - TaskListener.java
```

## 执行流程

```
输入: spec.md + feature-matrix.md
    │
    ▼
┌─────────────────────────────────┐
│   1. 解析规格文档               │
│   - 提取实体定义                │
│   - 提取字段列表                │
│   - 提取业务规则                │
│   - 提取流程定义                │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│   2. 选择场景模板               │
│   - 判断是否需要工作流          │
│   - 加载场景配置                │
│   - 确定模板列表                │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│   3. 构建变量字典               │
│   - 基础变量                    │
│   - 字段变量                    │
│   - 条件变量                    │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│   4. 渲染模板文件               │
│   - 读取模板内容                │
│   - 替换变量                    │
│   - 处理条件渲染                │
│   - 处理循环渲染                │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│   5. 输出代码文件               │
│   - 确定输出路径                │
│   - 写入文件                    │
│   - 记录生成日志                │
└─────────────────────────────────┘
    │
    ▼
输出: 生成的代码文件列表
```

## 模板变量参考

### 基础变量

| 变量名 | 说明 | 示例 |
|-------|------|------|
| package | 包路径 | com.sjjk.equity.transfer |
| entityName | 实体类名称 | EquityTransferApply |
| entityNameLower | 实体类名称(小写) | equityTransferApply |
| tableName | 数据库表名 | equity_transfer_apply |
| moduleName | 模块名称 | equity-transfer |
| businessName | 业务名称 | 国有产权转让申请 |
| permissionPrefix | 权限前缀 | equity:transfer |
| author | 作者 | sjjk |
| datetime | 日期时间 | 2026-03-31 |

### 字段变量

| 变量名 | 说明 | 类型 |
|-------|------|------|
| fields | 字段列表 | array |
| fields[].name | 字段名称 | string |
| fields[].type | 字段类型 | string |
| fields[].label | 字段标签 | string |
| fields[].comment | 字段注释 | string |
| fields[].required | 是否必填 | boolean |
| fields[].dictType | 字典类型 | string |

### 工作流变量

| 变量名 | 说明 | 示例 |
|-------|------|------|
| processKey | 流程定义Key | equity-transfer-approval |
| processName | 流程名称 | 国有产权转让审批流程 |
| candidateGroups | 候选组 | manager,leader |
| approvalRules | 审批规则 | array |
| processVariables | 流程变量 | array |

## 使用示例

### 示例1: 生成简单CRUD代码

```yaml
输入:
  spec.md: |
    # 国有产权转让申请
    
    ## 数据模型
    实体: EquityTransferApply
    表名: equity_transfer_apply
    
    字段:
      - name: transferType
        type: string
        label: 转让方式
      - name: transferReason
        type: string
        label: 转让原因

执行:
  场景: crud
  模板: scenarios/crud

输出:
  - EquityTransferApplyController.java
  - IEquityTransferApplyService.java
  - EquityTransferApplyServiceImpl.java
  - EquityTransferApplyMapper.java
  - EquityTransferApplyMapper.xml
  - EquityTransferApply.java
  - equity_transfer_apply.sql
  - menu_equity_transfer_apply.sql
  - index.vue
  - form.vue
  - detail.vue
  - equity-transfer.js
```

### 示例2: 生成工作流代码

```yaml
输入:
  spec.md: |
    # 资产处置审批
    
    ## 数据模型
    实体: AssetDisposalApply
    表名: asset_disposal_apply
    
    ## 流程定义
    流程Key: asset-disposal-approval
    审批类型: multi-level
    
    ## 审批规则
    - 金额 >= 500万: 集团审批
    - 金额 >= 30万: 子公司审批
    - 金额 < 30万: 自动通过

执行:
  场景: workflow-crud
  模板: scenarios/workflow-crud

输出:
  后端:
    - AssetDisposalApplyController.java
    - IAssetDisposalApplyService.java
    - AssetDisposalApplyServiceImpl.java
    - AssetDisposalApplyMapper.java
    - AssetDisposalApplyMapper.xml
    - AssetDisposalApply.java
    - AssetDisposalApplyProcessService.java
    - AssetDisposalTaskListener.java
    - asset-disposal-approval.bpmn20.xml
  
  前端:
    - index.vue
    - form.vue
    - detail.vue
    - ApprovalPanel.vue
    - asset-disposal.js
  
  SQL:
    - asset_disposal_apply.sql
    - menu_asset_disposal_apply.sql
```

## 协作关系

```yaml
被调用:
  - pdd-implement-feature: 实现功能点时调用

咨询:
  - expert-ruoyi: 若依框架规范验证
  - expert-activiti: 工作流规范验证

输出给:
  - pdd-code-reviewer: 生成的代码需要审查
```

## 注意事项

1. **变量完整性**: 确保所有必需变量都有值
2. **条件渲染**: 正确处理条件渲染逻辑
3. **输出路径**: 确保输出路径符合项目规范
4. **编码规范**: 生成的代码需符合项目编码规范
5. **安全检查**: 文本字段需要添加@Xss注解
6. **权限配置**: 菜单配置需要包含所有页面

## 错误处理

| 错误类型 | 处理方式 |
|---------|---------|
| 变量缺失 | 提示用户补充必需变量 |
| 模板不存在 | 检查模板路径，提示可用模板 |
| 渲染失败 | 记录错误日志，返回详细错误信息 |
| 文件已存在 | 提示用户确认是否覆盖 |
