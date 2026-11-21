---
name: expert-ruoyi
description: 若依(RuoYi)框架开发专家，精通项目搭建、代码生成和架构优化。当用户涉及若依框架开发、权限配置或菜单路由配置时自动触发。支持中文触发：若依框架、RuoYi、SpringBoot后台、权限配置。
license: MIT
compatibility: 若依框架项目
metadata:
  author: "neuqik@hotmail.com"
  version: "3.0"
  triggers:
    - "/ruoyi" | "/若依"
    - "若依框架" | "RuoYi" | "权限配置" | "菜单路由"
    - "@PreAuthorize" | "@DataScope" | "sys_menu"
    - "代码生成器" | "代码生成" | "权限校验"
---

# 若依框架开发专家

## 1. 技能概述

```yaml
核心能力:
  - 项目搭建: SpringBoot + MyBatis + Shiro/Security
  - 代码生成: CRUD代码自动生成
  - 权限管理: 菜单权限、按钮权限、数据权限
  - 动态路由: 基于sys_menu表的动态路由
  - 最佳实践: 若依框架开发规范
适用场景:
  - 新功能开发遇到权限问题
  - 菜单配置后页面404
  - 代码生成器使用
  - 权限注解不生效
  - 数据范围过滤异常
```

### 与其他技能协作
| 协作技能 | 协作方式 | 传入数据 | 期望输出 |
|---------|---------|---------|---------|
| **pdd-implement-feature** | Consultation | 若依技术问题 | 解决方案 |
| **pdd-code-reviewer** | Reference | 发现若依问题 | 框架最佳实践 |
| **software-engineer** | Delegation | 代码实现任务 | 符合规范的代码 |

## 2. 问题分类索引

```yaml
问题类型:
  路由问题: [页面404, 菜单不显示, 路由404]
  权限问题: [权限注解不生效, 按钮不显示, 数据范围错误]
  代码生成问题: [生成代码报错, 生成后需要调整]
  配置问题: [数据库配置, Redis缓存, 会话管理]
```

**快速诊断流程**: 含路由/权限问题诊断步骤与常见问题排查（页面404、权限注解不生效、数据范围过滤、按钮权限显示），详见 `references/diagnosis.md`。

## 3. 核心配置规范

- **菜单配置规范**: 目录(M)+菜单(C)+按钮(F)三层 sys_menu INSERT
- **权限注解规范**: @PreAuthorize("@ss.hasPermi('模块:功能:操作')")
- **数据权限规范**: @DataScope(deptAlias, userAlias) + Mapper XML `${params.dataScope}`

完整 SQL/Java 示例见 `references/menu-config.md`。

## 4. 代码生成器使用

生成后必须调整项（均 P0）：添加 @Validated 参数校验 | 添加 @DataScope 数据权限 | 添加 @Xss XSS防护 | 配置 sys_menu 表 | 分配角色菜单权限 | 清除Redis缓存。

代码调整示例见 `references/menu-config.md`。

## 5. 若依Spec模板参考

当 pdd-generate-spec 为若依项目生成开发规格时，必须包含：数据模型（BaseEntity继承/@Data/@TableName）、接口设计（@PreAuthorize/@Log）、菜单配置（M/C/F三层）、权限矩阵（`模块:功能:操作`）、数据权限（@DataScope）、前端API（listXxx/getXxx/addXxx/updateXxx/delXxx命名）。

完整模板片段见 `references/spec-template.md`。

## 6. 若依Bug模式库

> 完整模式定义: `config/bug-patterns.yaml` (categories.ruoyi)。提供解决方案时，必须对照以下模式逐一检查。

| 模式 | 名称 | 典型表现 | 预防措施 |
|------|------|---------|---------|
| R001 | 权限注解缺失 | Controller方法缺@PreAuthorize | 每个接口方法必须配置权限注解 |
| R002 | 菜单配置不完整 | 新增页面404/按钮不显示 | 所有页面(含隐藏页)必须配置sys_menu |
| R003 | 数据权限未配置 | 用户看到跨部门数据 | Service方法添加@DataScope注解 |
| R004 | Redis缓存未清除 | 权限修改后不生效 | 修改权限/菜单后必须清除Redis |
| R005 | 参数校验缺失 | @RequestBody参数无@Validated | 所有@RequestBody参数添加@Validated |
| R006 | XSS防护缺失 | 文本字段未添加@Xss | 所有String文本字段添加@Xss |
| R007 | 操作日志缺失 | 增删改操作无@Log | 所有CUD操作添加@Log注解 |
| R008 | API路径拼接断层 | 前端请求404 | 前端API路径=类级@RequestMapping+方法级@XXXMapping |
| R009 | 附件入参类型错误 | 参数解析异常 | 通用上传后用List<String>接收URL，不用MultipartFile |
| R010 | 状态流转审批日志遗漏 | 审批历史缺记录 | 状态变更方法加@Transactional并同步插入审批记录 |
| R011 | 状态字典映射不完整 | 状态显示英文原文 | 新增状态值时全局搜索所有映射方法并同步 |
| R012 | MyBatis多参数@Param缺失 | 参数绑定异常 | 多参数Mapper方法每个参数加@Param |

**检查原则**: 每次提供若依相关建议，必须对照以上12个模式逐一检查。新增模式只需修改 `config/bug-patterns.yaml`。

## 7. 前后端契约 / 页面生命周期 / 状态流转规范

- **API路径拼接**: 前端API路径 = 类 `@RequestMapping` + 方法 `@XXXMapping`，编写前必须检查后端完整路径（防R008）
- **附件处理**: 业务表单附件默认用模式B（先调 `/common/upload` 获取URL，接口接收 `List<String>`）（防R009）
- **页面生命周期**: 列表页用 `this.$router.push()` 跳转；详情页提交后 `tagsView/delView` + `router.back()`；列表页必须实现 `activated()` 钩子
- **状态字典**: 禁止组件内硬编码 `getStatusLabel`，应抽离到 `src/utils/constants.js` 或使用 `dict.type.xxx`（防R011）
- **审批日志**: status 变更必须同事务记录审批日志（@Transactional）（防R010）
- **状态判断**: 禁止推断/计算实体状态，必须直接查询数据库字段

详细代码示例见 `references/contracts.md`。

## 8. Guardrails

**必须遵守**: 所有页面(含隐藏页)都必须在sys_menu配置 | 权限标识符与sys_menu.perms完全一致 | 数据权限配置${params.dataScope} | @RequestBody参数添加@Validated | 文本字段建议添加@Xss

**避免**: ❌ 硬编码权限标识符 | ❌ 跳过菜单配置直接访问页面 | ❌ 前端验证替代后端验证 | ❌ 忘记清除Redis缓存

## 9. 本地开发指南

优先参考项目规范与历史经验：
- **项目规则**: `.trae/rules/project_rules.md`（目录结构、命名规范、开发规范、API命名规范）
- **经验教训**: `.trae/rules/lessons.md`（历史问题和解决方案，含若依特定问题）
- **样式方案**: `docs/plans/若依框架样式修改方案.md`
- **数据库**: mysql6.sqlpub.com:3311/asset_ruoyi

历史问题参考：菜单路由配置问题(新增页面404→需在sys_menu配置) | API方法命名规范问题(前后端命名不一致→设计文档先行) | FP-ZCCZ1-001 Code Review(缺少参数校验/XSS/数据权限→添加@Validated/@Xss/@DataScope)。

## 10. 外部参考文档

- [若依官网](http://ruoyi.vip/) | [若依文档](http://doc.ruoyi.vip/)
- [RuoYi-Vue GitHub](https://github.com/yangzongzhuan/RuoYi-Vue) | [RuoYi-Vue Gitee](https://gitee.com/y_project/RuoYi-Vue)