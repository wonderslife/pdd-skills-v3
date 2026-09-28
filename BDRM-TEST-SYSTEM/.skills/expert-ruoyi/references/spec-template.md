# 若依Spec模板参考

> 由 expert-ruoyi 技能引用。当 pdd-generate-spec 为若依项目生成开发规格时提供。

## 若依Spec必须包含的章节

| 章节 | 内容 | 若依特有要求 |
|------|------|-------------|
| 数据模型 | 实体类定义 | 必须包含BaseEntity继承、@Data/@TableName注解 |
| 接口设计 | Controller/Service/Mapper | 必须包含@PreAuthorize权限注解、@Log操作日志 |
| 菜单配置 | sys_menu INSERT语句 | 必须包含目录(M)+菜单(C)+按钮(F)三层配置 |
| 权限矩阵 | 权限标识符列表 | 格式：`模块:功能:操作`(如asset:list:add) |
| 数据权限 | @DataScope配置 | 必须指定deptAlias和userAlias |
| 前端API | request封装 | 必须遵循listXxx/getXxx/addXxx/updateXxx/delXxx命名 |

## 若依Spec模板片段

```markdown
## 数据模型
### {EntityName} 实体
- 继承: BaseEntity
- 注解: @Data, @TableName("{table_name}")
- 字段:
  | 字段名 | 类型 | 注解 | 说明 |
  |--------|------|------|------|
  | {fieldName} | {type} | @Excel(name="{label}") | {desc} |

## 接口设计
### {EntityName}Controller
- 路径: @RequestMapping("/{module}/{feature}")
- 权限前缀: {module}:{feature}

| 方法 | 路径 | 权限标识 | 注解 |
|------|------|---------|------|
| list | GET / | {module}:{feature}:list | @PreAuthorize |
| getInfo | GET /{id} | {module}:{feature}:query | @PreAuthorize |
| add | POST / | {module}:{feature}:add | @PreAuthorize + @Log |
| edit | PUT / | {module}:{feature}:edit | @PreAuthorize + @Log |
| remove | DELETE /{ids} | {module}:{feature}:remove | @PreAuthorize + @Log |

## 菜单配置SQL
-- 目录(M)
INSERT INTO sys_menu (menu_name, parent_id, order_num, path, component, menu_type, visible, perms, icon)
VALUES ('{菜单名}', 0, {排序}, '{path}', NULL, 'M', '0', NULL, '{icon}');
-- 菜单(C) - 列表页
INSERT INTO sys_menu (menu_name, parent_id, order_num, path, component, menu_type, visible, perms)
VALUES ('{菜单名}列表', {parent_id}, 1, '{path}', '{module}/{feature}/index', 'C', '0', '{module}:{feature}:list');
-- 按钮(F) - 新增/修改/删除/导出
INSERT INTO sys_menu (menu_name, parent_id, order_num, path, component, menu_type, visible, perms)
VALUES ('{菜单名}新增', {menu_id}, 1, '', '', 'F', '0', '{module}:{feature}:add');
```