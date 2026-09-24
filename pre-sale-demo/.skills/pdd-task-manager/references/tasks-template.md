# 功能点任务清单模板 (tasks.md)

> 由 pdd-task-manager 技能引用。为每个功能点生成任务清单时使用。

```markdown
# 功能点任务清单

## 功能点信息
- **功能点ID**: FP-ZCCZ1-001
- **功能名称**: 国有产权转让申请
- **复杂度**: P0
- **创建时间**: 2026-03-31 10:00:00

## 任务概览

| 任务组 | 任务数 | 已完成 | 进度 |
|--------|--------|--------|------|
| 数据库 | 2 | 2 | 100% |
| 后端 | 4 | 2 | 50% |
| 前端 | 4 | 0 | 0% |
| 菜单 | 1 | 0 | 0% |
| 测试 | 2 | 0 | 0% |

## 详细任务列表

### 1. 数据库任务组

#### 1.1 创建数据库表
- **状态**: ✅ 已完成
- **开始时间**: 2026-03-31 10:05:00
- **完成时间**: 2026-03-31 10:10:00
- **输出文件**: `sql/equity_transfer_apply.sql`
- **执行结果**: 成功创建表 equity_transfer_apply

#### 1.2 插入字典数据
- **状态**: ✅ 已完成
- **输出文件**: `sql/dict_data.sql`
- **执行结果**: 成功插入5条字典数据

### 2. 后端任务组
#### 2.1 生成实体类
- **状态**: ✅ 已完成 | **输出文件**: `EquityTransferApply.java`
#### 2.2 生成Mapper
- **状态**: ✅ 已完成 | **输出文件**: `EquityTransferApplyMapper.java` + `.xml`
#### 2.3 生成Service
- **状态**: 🔄 执行中 | **依赖**: 2.2 | **输出文件**: `IEquityTransferApplyService.java` + `EquityTransferApplyServiceImpl.java`
#### 2.4 生成Controller
- **状态**: ⏳ 待执行 | **依赖**: 2.3 | **输出文件**: `EquityTransferApplyController.java`

### 3. 前端任务组
#### 3.1 生成API接口 | ⏳ 待执行 | **依赖**: 2.4 | **输出文件**: `equity-transfer.js`
#### 3.2 生成列表页 | ⏳ 待执行 | **依赖**: 3.1 | **输出文件**: `index.vue`
#### 3.3 生成表单页 | ⏳ 待执行 | **依赖**: 3.1 | **输出文件**: `form.vue`
#### 3.4 生成详情页 | ⏳ 待执行 | **依赖**: 3.1 | **输出文件**: `detail.vue`

### 4. 菜单配置任务组
#### 4.1 配置菜单权限 | ⏳ 待执行 | **依赖**: 3.4 | **输出文件**: `menu_equity_transfer_apply.sql`

### 5. 测试任务组
#### 5.1 编写单元测试 | ⏳ 待执行 | **依赖**: 4.1 | **输出文件**: `EquityTransferApplyTest.java`
#### 5.2 编写集成测试 | ⏳ 待执行 | **依赖**: 5.1 | **输出文件**: `EquityTransferApplyIntegrationTest.java`

## 执行历史

| 时间 | 任务 | 操作 | 结果 |
|------|------|------|------|
| 10:05 | 1.1 创建数据库表 | 开始 | - |
| 10:10 | 1.1 创建数据库表 | 完成 | 成功 |
| 10:25 | 2.3 生成Service | 开始 | - |

## 重试记录

| 任务 | 尝试次数 | 最后错误 | 解决方案 |
|------|---------|---------|---------|
| - | - | - | - |

## 恢复点

**当前恢复点**: 2.3 生成Service

**恢复操作**:
1. 读取 spec.md 获取服务接口定义
2. 调用 pdd-template-engine 渲染 Service 模板
3. 输出 IEquityTransferApplyService.java
4. 输出 EquityTransferApplyServiceImpl.java
5. 更新任务状态为完成
6. 继续执行 2.4 生成Controller
```