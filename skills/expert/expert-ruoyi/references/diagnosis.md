# 若依框架诊断与常见问题解决方案

> 由 expert-ruoyi 技能引用。包含快速诊断模式和常见问题排查。

## 快速诊断模式

### 路由问题诊断（页面404）
```
问题: 点击菜单后页面404
诊断流程:
1. 检查 sys_menu 表配置
   SELECT * FROM sys_menu WHERE menu_name = 'XXX';
2. 检查 component 路径（相对 src/views，文件必须存在）
3. 检查 visible 字段（'0'=显示菜单，'1'=隐藏菜单）
4. 检查父菜单是否存在
   SELECT * FROM sys_menu WHERE menu_id = parent_id;
5. 检查角色权限分配
   SELECT * FROM sys_role_menu WHERE menu_id = menu_id;
```

### 权限问题诊断（@PreAuthorize 不生效）
```
问题: @PreAuthorize 注解不生效
诊断流程:
1. 检查注解是否正确
   @PreAuthorize("@ss.hasPermi('xxx:xxx:xxx')")
2. 检查 sys_menu 表中权限标识符（perms 字段必须与注解一致）
3. 检查角色菜单分配
   SELECT * FROM sys_role_menu WHERE menu_id IN
   (SELECT menu_id FROM sys_menu WHERE perms = 'xxx:xxx:xxx');
4. 检查用户角色
   SELECT * FROM sys_user_role WHERE user_id = user_id;
5. 清除Redis缓存
   FLUSHDB
```

## 常见问题解决方案

### 页面404问题
**排查步骤**:
```sql
-- Step 1: 检查菜单是否存在
SELECT * FROM sys_menu WHERE menu_name LIKE '%XXX%';
-- Step 2: 检查 component 路径是否正确（路径格式: module/path，相对src/views）
-- Step 3: 检查文件是否存在 src/views/<module>/<path>/index.vue
-- Step 4: 检查父菜单 SELECT * FROM sys_menu WHERE menu_id = parent_id;
-- Step 5: 检查角色权限 SELECT * FROM sys_role_menu WHERE menu_id = menu_id;
```
**解决方案**: 确认component路径正确 | 确认Vue文件存在 | 确认菜单已分配给用户角色 | 清除Redis缓存 | 重新登录

### 权限注解不生效
**排查步骤**:
```sql
-- Step 1: 检查权限标识符 SELECT perms FROM sys_menu WHERE menu_name = 'XXX';
-- Step 2: 检查角色菜单分配
SELECT r.role_name, m.menu_name FROM sys_role_menu rm
JOIN sys_menu m ON rm.menu_id = m.menu_id WHERE m.perms = 'xxx:xxx:xxx';
-- Step 3: 检查用户角色
SELECT u.user_name, r.role_name FROM sys_user_role ur
JOIN sys_role r ON ur.role_id = r.role_id WHERE ur.user_id = user_id;
```
**解决方案**: 确认注解权限标识符与sys_menu.perms一致 | 确认角色已分配对应菜单权限 | 确认用户已分配角色 | 清除Redis缓存 | 重新登录

### 数据范围过滤不生效
**排查步骤**:
```sql
-- Step 1: 检查用户所属部门
SELECT u.user_name, d.dept_name, d.dept_id FROM sys_user u
JOIN sys_dept d ON u.dept_id = d.dept_id WHERE u.user_id = user_id;
-- Step 2: 检查 Mapper XML 是否正确配置 ${params.dataScope}
-- Step 3: 检查 @DataScope 注解 deptAlias/userAlias 与 SQL 别名一致
```
**解决方案**: 确认@DataScope配置正确 | 确认Mapper XML表别名正确 | 确认sys_user.dept_id正确 | 重新登录

### 按钮权限不显示
**排查步骤**:
```javascript
// 检查前端是否有 v-hasPermi 指令
<el-button v-hasPermi="['asset:list:add']">新增</el-button>
// 检查权限标识符一致: 前端 asset:list:add / 后端 @PreAuthorize / 数据库 sys_menu.perms
```
**解决方案**: 确认按钮使用v-hasPermi | 确认权限标识符完全一致 | 确认按钮对应菜单权限已分配 | 清除浏览器缓存 | 重新登录