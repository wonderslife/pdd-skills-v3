---
name: expert-ruoyi-permission
description: |
  若依(RuoYi)框架权限配置专家，专注于权限问题的诊断和解决。当用户遇到以下问题时自动触发：
  - 权限校验失败、Access Denied错误
  - 按钮/菜单不显示
  - @PreAuthorize权限标识不匹配
  - v-hasPermi权限值错误
  - sys_menu或sys_role_menu配置问题
  - 若依框架的权限系统相关问题
  - 开发新功能时的权限配置指导
  使用此skill可以帮助用户快速定位权限问题根源，提供标准化的权限配置方案。
---

# 若依框架权限配置专家

## 核心原则：四端一致

> **⚠️ 最重要原则**
>
> ```
> sys_menu.perms = 后端@PreAuthorize = 前端v-hasPermi = API权限标识
> ```
>
> 四个环节中任何一个不一致，就会出现权限问题！

## 一、权限配置完整链路

```
┌─────────────────────────────────────────────────────────────────┐
│  1. 数据库 sys_menu 表配置菜单/按钮权限                           │
│     - menu_name: 菜单名称                                        │
│     - perms: 权限标识符（唯一！）                                │
│     - menu_type: M=目录, C=菜单, F=按钮                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. sys_role_menu 表分配权限                                     │
│     - 将菜单ID 和 角色ID 关联                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. 后端 Controller 使用 @PreAuthorize                           │
│     - 必须与 sys_menu.perms 完全一致！                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. 前端 v-hasPermi 使用                                         │
│     - 必须与 sys_menu.perms 完全一致！                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. 清除缓存 + 重新登录                                          │
│     - Redis 缓存或用户权限缓存                                    │
└─────────────────────────────────────────────────────────────────┘
```

## 二、常见问题排查

### 2.1 权限校验失败 (Access Denied)

**错误信息**：`请求地址'/xxx'权限校验失败`

**排查步骤**：

```
1. 查询数据库 sys_menu 表的 perms 值
   SELECT menu_id, menu_name, perms FROM sys_menu WHERE perms LIKE '%关键词%';

2. 对比后端 Controller @PreAuthorize 值
   @PreAuthorize("@ss.hasPermi('perms值')")

3. 对比前端 v-hasPermi 值
   v-hasPermi="['perms值']"

4. 检查 sys_role_menu 是否分配
   SELECT * FROM sys_role_menu WHERE menu_id = ?;
```

### 2.2 按钮不显示

**排查步骤**：

```
1. 检查 sys_menu 表是否有 type='F' 的按钮记录
   SELECT * FROM sys_menu WHERE menu_type = 'F' AND perms LIKE '%关键词%';

2. 检查按钮 perms 与前端 v-hasPermi 是否一致

3. 检查按钮是否分配给用户角色
   SELECT r.role_name FROM sys_role_menu rm
   JOIN sys_role r ON rm.role_id = r.role_id
   WHERE rm.menu_id = (按钮的menu_id);
```

### 2.3 菜单不显示

**排查步骤**：

```
1. 检查 sys_menu 表配置
   - visible = '0' 表示显示
   - visible = '1' 表示隐藏

2. 检查角色是否有该菜单权限
   SELECT m.menu_name, r.role_name
   FROM sys_role_menu rm
   JOIN sys_menu m ON rm.menu_id = m.menu_id
   JOIN sys_role r ON rm.role_id = r.role_id
   WHERE m.perms = 'xxx';

3. 检查用户角色
   SELECT u.user_name, r.role_name
   FROM sys_user_role ur
   JOIN sys_user u ON ur.user_id = u.user_id
   JOIN sys_role r ON ur.role_id = r.role_id
   WHERE u.user_name = 'xxx';
```

## 三、SQL调试脚本

### 3.1 查看用户所有权限

```sql
SELECT m.menu_id, m.menu_name, m.perms, m.menu_type
FROM sys_user_role ur
JOIN sys_role_menu rm ON ur.role_id = rm.role_id
JOIN sys_menu m ON rm.menu_id = m.menu_id
WHERE ur.user_id = (SELECT user_id FROM sys_user WHERE user_name = 'xxx')
ORDER BY m.menu_id;
```

### 3.2 查看某菜单分配给了哪些角色

```sql
SELECT r.role_id, r.role_name, m.menu_name, m.perms
FROM sys_role_menu rm
JOIN sys_role r ON rm.role_id = r.role_id
JOIN sys_menu m ON rm.menu_id = m.menu_id
WHERE m.perms = 'evaluation:approval:apply:list';
```

### 3.3 批量分配菜单权限

```sql
-- 给多个角色分配同一菜单权限
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT role_id, 3001
FROM sys_role
WHERE role_id IN (1, 2, 100, 102);
```

## 四、标准配置示例

### 4.1 正确的完整配置流程

```sql
-- 1. 创建菜单（列表页）
INSERT INTO sys_menu (menu_name, parent_id, order_num, path, component,
                       menu_type, visible, perms, icon, create_time)
VALUES ('项目申请', 3000, 1, 'apply-list', 'asset-evaluation-approval/apply-list',
        'C', '0', 'evaluation:approval:apply:list', '#', NOW());

-- 2. 创建按钮权限（新增）
INSERT INTO sys_menu (menu_name, parent_id, order_num, path, component,
                       menu_type, visible, perms, icon, create_time)
VALUES ('项目申请新增', 3001, 1, '', '', 'F', '0',
        'evaluation:approval:apply:add', '#', NOW());

-- 3. 分配给角色
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT role_id, 3001 FROM sys_role WHERE role_id IN (1, 2);
```

```java
// 后端 Controller
@PreAuthorize("@ss.hasPermi('evaluation:approval:apply:list')")
@GetMapping("/projects")
public TableDataInfo list() { ... }

@PreAuthorize("@ss.hasPermi('evaluation:approval:apply:add')")
@PostMapping
public AjaxResult add() { ... }
```

```vue
<!-- 前端 -->
<el-button v-hasPermi="['evaluation:approval:apply:add']">新增</el-button>
```

## 五、命名规范

### 5.1 推荐格式

```
{模块}:{子模块}:{操作}:{具体操作}
```

**示例**：
| 权限标识 | 说明 |
|---------|------|
| `evaluation:approval:apply:list` | 资产评估-核准-申请-列表 |
| `evaluation:approval:apply:add` | 资产评估-核准-申请-新增 |
| `evaluation:approval:apply:edit` | 资产评估-核准-申请-编辑 |
| `evaluation:approval:apply:remove` | 资产评估-核准-申请-删除 |

### 5.2 命名检查清单

- [ ] 权限标识全小写
- [ ] 使用冒号 `:` 分隔层级
- [ ] 不含空格和特殊字符
- [ ] 具有唯一性（不与其它菜单重复）
- [ ] 前后端使用完全相同的字符串

## 六、开发检查清单

### 6.1 新增功能时

```
□ 1. 在 sys_menu 表添加菜单记录
□ 2. 设置正确的 perms 权限标识
□ 3. 在 sys_role_menu 表分配给相关角色
□ 4. 后端 Controller 添加 @PreAuthorize(perms值)
□ 5. 前端组件添加 v-hasPermi="[perms值]"
□ 6. 清除 Redis 缓存
□ 7. 重新登录测试
```

### 6.2 权限不生效时排查顺序

```
1. 数据库 perms 值是什么？
      ↓
2. 后端 @PreAuthorize 值是什么？
      ↓
3. 前端 v-hasPermi 值是什么？
      ↓
4. sys_role_menu 是否有分配？
      ↓
5. Redis 缓存是否过期？
      ↓
6. 用户是否重新登录？
```

## 七、数据库表结构

### sys_menu 表关键字段

| 字段 | 说明 | 注意事项 |
|------|------|---------|
| menu_id | 菜单ID | 主键 |
| menu_name | 菜单名称 | 显示用 |
| parent_id | 父菜单ID | 0=顶级 |
| order_num | 显示顺序 | 数字越小越靠前 |
| path | 路由路径 | 相对路径 |
| component | 组件路径 | 相对于 src/views |
| menu_type | 菜单类型 | M=目录,C=菜单,F=按钮 |
| visible | 显示状态 | 0=显示,1=隐藏 |
| status | 状态 | 0=正常,1=禁用 |
| perms | 权限标识 | **核心字段** |

### sys_role_menu 表

| 字段 | 说明 |
|------|------|
| role_id | 角色ID |
| menu_id | 菜单ID |

## 八、常见错误示例

### 错误1：权限标识微小差异

```java
// 数据库: evaluation:approval:apply:list
// 后端:   @PreAuthorize("@ss.hasPermi('evaluation:approval:list')")  // ❌ 少了 apply

// 正确写法
@PreAuthorize("@ss.hasPermi('evaluation:approval:apply:list')")  // ✓
```

### 错误2：前端权限标识错误

```vue
<!-- 数据库: evaluation:approval:apply:add -->
<!-- 前端:  v-hasPermi="['eval:approval:add']"  -->  <!-- ❌ 前缀错误，少了 apply -->

<!-- 正确写法 -->
<v-hasPermi="['evaluation:approval:apply:add']">  <!-- ✓ -->
```

### 错误3：菜单未分配权限

```sql
-- 菜单配置正确，但角色没有分配
INSERT INTO sys_menu (...) VALUES (...);  -- ✓ 菜单已创建
-- 但忘记执行：
INSERT INTO sys_role_menu (role_id, menu_id) VALUES (1, 3001);  -- ❌ 遗漏！
```

## 九、参考文档

详细文档请查看：`references/permission-guide.md`
