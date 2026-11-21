# 代码目录结构（Step 8.1 参考）

> 本文件为 pdd-main 的参考资料，按需加载。

## 重要原则

- **新业务功能应创建独立 Maven 模块**，不要放在 `asset-system` 中
- `asset-system` 是系统管理模块，只包含系统相关代码(用户/角色/菜单等)
- 业务模块命名规范: `asset-{business-domain}` (如 `asset-disposition`, `asset-equity`)

## 模块编号→代码路径映射

| 模块编号 | 功能名称 | Maven模块 | 后端包路径 | 前端路径 |
|---------|---------|----------|-----------|---------|
| ZCCZ-1 | 股权转让 | asset-equity | com.example.equity.transfer | equity-transfer |
| ZCCZ-2 | 资产移交 | asset-equity | com.example.equity.transfer | asset-transfer |
| ZCCZ-3 | 企业增资 | asset-equity | com.example.equity.capital | capital-increase |
| ZCCZ-4 | 股权无偿划转 | asset-equity | com.example.equity.allocation | equity-allocation |
| ZCCZ-5 | 资产租赁 | asset-lease | com.example.lease | asset-lease |
| ZCCZ-6 | 企业担保 | asset-guarantee | com.example.guarantee | enterprise-guarantee |
| ZCCZ-7 | 固定资产处置 | asset-disposition | com.example.disposition | fixed-asset-scrap |

## 后端模块目录结构

`asset-{business-domain}/` (独立Maven模块)

```
├── pom.xml
└── src/main/java/com/example/{module}/
    ├── controller/     # Controllers
    ├── domain/         # Entity classes + vo/
    ├── mapper/         # Mapper interfaces
    ├── service/        # Service interfaces + impl/
    ├── constant/       # Constant classes
    └── util/           # Utility classes
└── src/main/resources/mapper/{module}/  # Mapper XML
```

## 前端目录结构

```
asset-ui/src/api/{module}/{feature}.js    # API接口
asset-ui/src/views/{module}/              # 视图页面(camelCase)
    ├── index.vue   # 列表页
    ├── form.vue    # 表单页
    └── detail.vue  # 详情页
```

## 现有模块复用规则

- **asset-disposition**: 资产处置类(固定资产处置/资产报废等，已存在)
- **asset-equity**: 股权交易类(股权转让/企业增资等，需创建)
- **asset-admin**: 系统管理(Controller入口/配置等)
- **asset-system**: 系统功能(用户/角色/菜单等，**不要放业务代码**)

**错误示例**: ❌ 将业务代码放入 asset-system | ✅ 创建独立的业务模块