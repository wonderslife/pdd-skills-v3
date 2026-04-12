# PDD Scaffold Templates Registry

本目录存放所有 PDD 驱动的脚手架模板。

## 可用模板

| 模板 | 路径 | 技术栈 | 说明 |
|------|------|--------|------|
| python-fullstack | ./python-fullstack/ | FastAPI + Vue3 + MySQL | 全栈脚手架（含数据权限/OAuth/工作流） |

## 使用方式

```bash
# 通过 PDD CLI 初始化项目并选择模板
pdd init my-project --template python-fullstack

# 或在 .pdd/config.yaml 中指定默认模板
template: scaffolds/python-fullstack
```

## 添加新模板

1. 在此目录下创建新文件夹：`scaffolds/<template-name>/`
2. 添加 `template_config.yaml` 元数据文件
3. 添加代码模板文件
4. 更新此 README
