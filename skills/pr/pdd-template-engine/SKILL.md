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

根据功能点规格自动选择和渲染代码模板，生成符合项目规范的代码文件。支持若依框架和Activiti工作流的代码生成。

## 触发条件
- 用户请求"生成代码"、"使用模板生成"等
- pdd-implement-feature技能调用
- 用户指定使用特定场景模板

## 核心能力

### 1. 模板选择
| 场景类型 | 判断条件 | 使用模板 |
|---------|---------|---------|
| 简单CRUD | 无审批流程 | scenarios/crud |
| 工作流+CRUD | 需要审批流程 | scenarios/workflow-crud |

### 2. 变量提取
- 基础变量: entityName/tableName/businessName/moduleName
- 字段变量: fields/searchFields/formFields/requiredFields
- 工作流变量: processKey/approvalRules/processVariables

### 3. 模板渲染 (Handlebars)
```
变量替换: {{variableName}}
条件渲染: {{#if condition}}...{{/if}}
循环渲染: {{#each items}}...{{/each}}
辅助函数: pascalCase / camelCase / kebabCase / snakeCase
```

### 4. 代码生成
- 后端: Controller/Service/ServiceImpl/Mapper/Mapper.xml/Entity/SQL
- 前端: Vue组件(list/form/detail)/API接口/工作流组件(approval-panel)
- 工作流: BPMN定义/ProcessService/TaskListener

## 执行流程
```
输入: spec.md + feature-matrix.md
1. 解析规格文档(实体/字段/业务规则/流程)
2. 选择场景模板(判断是否需要工作流/加载场景配置/确定模板列表)
3. 构建变量字典(基础/字段/条件变量)
4. 渲染模板文件(读取/替换/条件/循环)
5. 输出代码文件(确定路径/写入/记录日志)
输出: 生成的代码文件列表
```

## 模板变量参考
**基础变量**: package/entityName/entityNameLower/tableName/moduleName/businessName/permissionPrefix/author/datetime
**字段变量**: fields/fields[].name/type/label/comment/required/dictType
**工作流变量**: processKey/processName/candidateGroups/approvalRules/processVariables

## 使用示例
完整示例见 `references/examples.md`（简单CRUD生成、工作流生成、PRD约定注入）

## PRD感知动态模板

### 脚手架感知选择
| 脚手架类型 | 判断条件 | 模板集 |
|-----------|---------|--------|
| Python Fullstack | 含FastAPI/requirements.txt | scenarios/crud-python |
| 若依(RuoYi) | 含pom.xml/SpringBoot | scenarios/crud-ruoyi |

### PRD约定注入
从PRD提取约定注入模板变量: 枚举编码(snake_case) | 类型映射(pythonType/javaType/tsType) | 表单组件(el-select等) | Options API数据源

### Python Fullstack模板变量
modelName/schemaName/optionSchemaName/routerPrefix/fields[].saType/pydanticType/tsType

### 若依模板变量
packageName/entityName/mapperName/serviceName/controllerName/permissionPrefix/menuParentId/fields[].javaType/mybatisType/dictType

### Bug模式库防护
完整模式定义: `config/bug-patterns.yaml`
模板渲染后自动检查: datetime字段类型(PATTERN-001) | /options路由顺序(PATTERN-002) | 枚举编码(PATTERN-003) | safeAlert使用(PATTERN-004) | 若依权限注解(PATTERN-R001) | 若依菜单配置(PATTERN-R002)

## 错误处理
| 错误类型 | 处理方式 |
|---------|---------|
| 变量缺失 | 提示用户补充必需变量 |
| 模板不存在 | 检查模板路径，提示可用模板 |
| 渲染失败 | 记录错误日志，返回详细错误信息 |
| 文件已存在 | 提示用户确认是否覆盖 |

## 协作关系
- 被调用: pdd-implement-feature
- 咨询: expert-ruoyi(若依规范) / expert-activiti(工作流规范)
- 输出给: pdd-code-reviewer(生成的代码需审查)

## 注意事项
1. 变量完整性 2. 条件渲染 3. 输出路径符合项目规范 4. 编码规范 5. 文本字段加@Xss注解 6. 菜单配置包含所有页面