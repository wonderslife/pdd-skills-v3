# 若依框架权限配置指南

## 一、问题回顾

### 1.1 本次遇到的问题

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 权限校验失败 | 后端 Controller 权限标识与数据库不一致 | 统一前后端权限标识 |
| 按钮不显示 | 前端权限标识与数据库不匹配 | 修正前端 v-hasPermi 值 |
| 菜单不显示 | 菜单权限未分配给角色 | 执行角色菜单关联 |
| 项目不存在 | 前端提交时 projectId=0 | 修复提交逻辑，先保存再提交 |

### 1.2 根本原因

```
前端权限标识 → v-hasPermi="['evaluation:approval:apply:add']"
       ↓
数据库权限   → perms='evaluation:approval:apply:add' (sys_menu表)
       ↓
后端权限标识 → @PreAuthorize("@ss.hasPermi('evaluation:approval:list')")
       ↑
       ↑
     不匹配！
```

## 二、权限配置核心流程

### 2.1 完整配置链路

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

### 2.2 关键原则

> **⚠️ 核心原则：四端一致**
>
> ```
> sys_menu.perms = 后端@PreAuthorize = 前端v-hasPermi = API权限标识
> ```
>
> 任何一个环节不一致，就会出现权限问题！

## 三、权限标识命名规范

### 3.1 推荐格式

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
| `evaluation:approval:apply:export` | 资产评估-核准-申请-导出 |
| `evaluation:approval:apply:query` | 资产评估-核准-申请-查询 |

### 3.2 命名检查清单

- [ ] 权限标识全小写
- [ ] 使用冒号 `:` 分隔层级
- [ ] 不含空格和特殊字符
- [ ] 具有唯一性（不与其它菜单重复）
- [ ] 前后端使用完全相同的字符串

## 四、数据库表结构

### 4.1 sys_menu 表关键字段

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
| icon | 图标 | # = 无图标 |

### 4.2 sys_role_menu 表

| 字段 | 说明 |
|------|------|
| role_id | 角色ID |
| menu_id | 菜单ID |

## 五、开发检查清单

### 5.1 新增功能时

```
□ 1. 在 sys_menu 表添加菜单记录
□ 2. 设置正确的 perms 权限标识
□ 3. 在 sys_role_menu 表分配给相关角色
□ 4. 后端 Controller 添加 @PreAuthorize(perms值)
□ 5. 前端组件添加 v-hasPermi="[perms值]"
□ 6. 清除 Redis 缓存
□ 7. 重新登录测试
```

### 5.2 权限不生效时排查

```
□ 1. 检查 sys_menu 表 perms 值
□ 2. 对比后端 @PreAuthorize 值是否一致
□ 3. 对比前端 v-hasPermi 值是否一致
□ 4. 检查 sys_role_menu 是否有该菜单ID
□ 5. 清除 Redis: FLUSHDB
□ 6. 重新登录获取最新权限
□ 7. 检查用户当前角色是否有该菜单权限
```

### 5.3 按钮权限不显示排查

```
□ 1. 检查 sys_menu 表是否有 type=F 的按钮记录
□ 2. 按钮的 perms 是否与前端 v-hasPermi 一致
□ 3. 检查该按钮是否分配给了用户角色
□ 4. 清除缓存并重新登录
□ 5. 检查用户角色状态是否正常
```

## 六、常见错误示例

### 6.1 错误1：权限标识微小差异

```java
// 数据库: evaluation:approval:apply:list
// 后端:   @PreAuthorize("@ss.hasPermi('evaluation:approval:list')")  // ❌ 少了 apply

// 正确写法
@PreAuthorize("@ss.hasPermi('evaluation:approval:apply:list')")  // ✓
```

### 6.2 错误2：前端权限标识错误

```vue
<!-- 数据库: evaluation:approval:apply:add -->
<!-- 前端:  v-hasPermi="['eval:approval:add']"  -->  <!-- ❌ 前缀错误，少了 apply -->

<!-- 正确写法 -->
<v-hasPermi="['evaluation:approval:apply:add']">  <!-- ✓ -->
```

### 6.3 错误3：菜单未分配权限

```sql
-- 菜单配置正确，但角色没有分配
INSERT INTO sys_menu (...) VALUES (...);  -- ✓ 菜单已创建
-- 但忘记执行：
INSERT INTO sys_role_menu (role_id, menu_id) VALUES (1, 3001);  -- ❌ 遗漏！
```

## 七、调试技巧

### 7.1 SQL查询用户权限

```sql
-- 查看用户所有权限
SELECT m.menu_id, m.menu_name, m.perms
FROM sys_user_role ur
JOIN sys_role_menu rm ON ur.role_id = rm.role_id
JOIN sys_menu m ON rm.menu_id = m.menu_id
WHERE ur.user_id = (SELECT user_id FROM sys_user WHERE user_name = 'xxx')
ORDER BY m.menu_id;
```

### 7.2 查看菜单权限分配

```sql
-- 查看某菜单分配给了哪些角色
SELECT r.role_id, r.role_name, m.menu_name, m.perms
FROM sys_role_menu rm
JOIN sys_role r ON rm.role_id = r.role_id
JOIN sys_menu m ON rm.menu_id = m.menu_id
WHERE m.perms = 'evaluation:approval:apply:list';
```

### 7.3 Redis 缓存清除

```sql
-- 查看缓存键
SELECT * FROM sys_cache WHERE cache_key LIKE '%login%';

-- 清除登录缓存（需要重启生效）
DELETE FROM sys_cache;
```

## 八、最佳实践

### 8.1 开发规范

1. **先定义权限标识，再写代码**
   - 在设计阶段就确定 `perms` 值
   - 前后端严格使用同一个值

2. **建立权限标识对照表**

   | 功能 | 权限标识 | 后端Controller | 前端v-hasPermi |
   |------|---------|---------------|---------------|
   | 列表 | xxx:list | ✓ | ✓ |
   | 新增 | xxx:add | ✓ | ✓ |
   | 编辑 | xxx:edit | ✓ | ✓ |
   | 删除 | xxx:remove | ✓ | ✓ |

3. **批量分配权限脚本**

   ```sql
   -- 给多个角色分配同一菜单权限
   INSERT INTO sys_role_menu (role_id, menu_id)
   SELECT role_id, 3001
   FROM sys_role
   WHERE role_id IN (1, 2, 100, 102);
   ```

### 8.2 配置示例

**正确的完整配置流程**：

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

## 九、总结

**避免权限问题的关键**：

1. ✅ **统一命名**：权限标识四端完全一致
2. ✅ **及时分配**：创建菜单后立即分配给角色
3. ✅ **充分测试**：测试不同角色、不同用户的权限
4. ✅ **记录变更**：修改权限后记录变更日志
5. ✅ **文档维护**：维护权限标识对照表

**遇到权限问题时**，按以下顺序排查：

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

---

*本文档基于若依框架 v4.7+ 版本编写*
