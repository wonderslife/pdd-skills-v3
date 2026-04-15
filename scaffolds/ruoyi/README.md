# RuoYi Framework Scaffold

## 概述

若依框架脚手架模板，用于 `pdd init -t ruoyi` 初始化若依风格项目。

## 使用方式

```bash
pdd init -t ruoyi
```

## 包含内容

- 种子数据SQL (`sql/seed_base_data.sql`)
  - 12个部门（多层级组织架构）
  - 5个测试用户（每个角色至少1个）
  - 5个字典类型 + 19个字典数据项
  - 5个角色 + 用户角色关联

## 种子数据使用

```bash
mysql -u root -p asset_ruoyi < sql/seed_base_data.sql
```

## 注意事项

- 若依框架主代码需从 [RuoYi-Vue](https://gitee.com/y_project/RuoYi-Vue) 获取
- 种子数据SQL基于若依标准表结构（sys_dept, sys_dict_type, sys_dict_data, sys_user, sys_role）
- 执行种子SQL前请确保若依基础表已创建
- 修改菜单/权限后必须清除Redis缓存
