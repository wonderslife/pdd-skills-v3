# 若依核心配置规范与代码生成器

> 由 expert-ruoyi 技能引用。包含菜单配置、权限注解、数据权限、代码生成器调整。

## 菜单配置规范

```sql
-- 目录类型 (M)
INSERT INTO sys_menu (menu_name, parent_id, order_num, path, component, menu_type, visible, perms, icon)
VALUES ('资产管理', 0, 1, 'asset', NULL, 'M', '0', NULL, 'asset');
-- 菜单类型 (C) - 列表页
INSERT INTO sys_menu (menu_name, parent_id, order_num, path, component, menu_type, visible, perms, icon)
VALUES ('资产列表', parent_id, 1, 'list', 'asset/index', 'C', '0', 'asset:list:list', 'list');
-- 菜单类型 (C) - 隐藏页面 (新增/编辑/详情)
INSERT INTO sys_menu (menu_name, parent_id, order_num, path, component, menu_type, visible, perms)
VALUES ('资产新增', parent_id, 10, 'add', 'asset/form', 'C', '1', 'asset:list:add');
-- 按钮类型 (F) - 权限控制
INSERT INTO sys_menu (menu_name, parent_id, order_num, path, component, menu_type, visible, perms)
VALUES ('资产新增按钮', menu_id, 1, '', '', 'F', '0', 'asset:list:add');
```

## 权限注解规范

```java
// Controller 层
@RestController
@RequestMapping("/asset/list")
public class AssetListController {
    @PreAuthorize("@ss.hasPermi('asset:list:list')")   // 列表查询
    @GetMapping
    public AjaxResult list() { }
    @PreAuthorize("@ss.hasPermi('asset:list:add')")    // 新增
    @PostMapping
    public AjaxResult add() { }
    @PreAuthorize("@ss.hasPermi('asset:list:edit')")   // 修改
    @PutMapping
    public AjaxResult edit() { }
    @PreAuthorize("@ss.hasPermi('asset:list:remove')") // 删除
    @DeleteMapping
    public AjaxResult remove() { }
    @PreAuthorize("@ss.hasPermi('asset:list:export')") // 导出
    @GetMapping("/export")
    public void export() { }
}
```

## 数据权限规范

```java
// Service 层
public interface IAssetService {
    @DataScope(deptAlias = "d", userAlias = "u")   // 添加 @DataScope 注解
    List<Asset> selectAssetList(Asset asset);
}
```
```xml
<!-- Mapper XML -->
<select id="selectAssetList" resultMap="AssetResult">
    SELECT a.*, d.dept_name
    FROM asset a
    LEFT JOIN sys_dept d ON a.dept_id = d.dept_id
    LEFT JOIN sys_user u ON a.create_by = u.user_name
    WHERE a.del_flag = '0'
    ${params.dataScope}
</select>
```

## 代码生成器使用

### 生成后必须调整项
| 调整项 | 原因 | 优先级 |
|--------|------|--------|
| 添加 @Validated 注解 | 参数校验 | P0 |
| 添加 @DataScope 注解 | 数据权限 | P0 |
| 添加 @Xss 注解 | XSS防护 | P0 |
| 配置 sys_menu 表 | 菜单路由 | P0 |
| 分配角色菜单权限 | 权限生效 | P0 |
| 清除Redis缓存 | 刷新权限缓存 | P0 |

### 代码调整示例
```java
// 调整前 (生成器默认)
@PostMapping
public AjaxResult add(Asset asset) {
    return AjaxResult.success(assetService.insertAsset(asset));
}
// 调整后 (添加参数校验)
@PreAuthorize("@ss.hasPermi('asset:list:add')")
@Log(title = "资产管理", businessType = BusinessType.INSERT)
@PostMapping
public AjaxResult add(@Validated @RequestBody Asset asset) {
    return AjaxResult.success(assetService.insertAsset(asset));
}
// 实体类添加 XSS 防护
@Excel(name = "资产名称")
@Xss
private String assetName;
// 列表查询添加数据权限
@DataScope(deptAlias = "d", userAlias = "u")
List<Asset> selectAssetList(Asset asset);
```

## API命名规范

```javascript
export function listAsset(query) { return request({ url: '/asset/list', method: 'get', params: query }); }
export function getAsset(assetId) { return request({ url: '/asset/' + assetId, method: 'get' }); }
export function addAsset(data) { return request({ url: '/asset', method: 'post', data }); }
export function updateAsset(data) { return request({ url: '/asset', method: 'put', data }); }
export function delAsset(assetId) { return request({ url: '/asset/' + assetId, method: 'delete' }); }
export function exportAsset(query) { return request({ url: '/asset/export', method: 'get', params: query }); }
```