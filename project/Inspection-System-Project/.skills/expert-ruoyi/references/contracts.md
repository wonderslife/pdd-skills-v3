# 若依前后端契约、页面生命周期与状态流转规范

> 由 expert-ruoyi 技能引用。防止常见 Bug 模式（PATTERN-R008~R012）。

## 前后端契约规范

### 1. API 路径拼接规则
- 前端 API 路径 = Controller 类 `@RequestMapping` + 方法 `@XXXMapping`
- **编写前端 API 前，必须检查后端 Controller 类上的完整路径**
- 防止：PATTERN-R008（API路径404）

```javascript
// 后端: @RequestMapping("/evaluation/approval") + @GetMapping("/review/manage/detail/{id}")
// ❌ 错误: 遗漏类级路径
request({ url: '/review/manage/detail/' + id })
// ✅ 正确: 完整拼接
request({ url: '/evaluation/approval/review/manage/detail/' + id })
```

### 2. 附件处理标准模式
- **模式A（直传）**: 后端接收 `MultipartFile`，适用于单文件简单上传
- **模式B（先传后存）**: 前端先调 `/common/upload` 获取 URL，业务接口统一接收 `List<String>`
- **若依项目中，业务表单附件必须默认使用模式B**
- 防止：PATTERN-R009（参数类型不匹配）

### 3. 响应数据解析约定
- 后端返回嵌套结构时，前端取值路径必须与后端一致
- **修改后端返回结构后，必须同步检查所有前端取值路径**

## 页面生命周期规范

### 列表页 → 详情页 → 返回列表的标准流程
1. 列表页使用 `this.$router.push()` 跳转到详情/处理页
2. 详情页提交成功后：
   - 调用 `this.$store.dispatch('tagsView/delView', this.$route)` 关闭标签
   - 调用 `this.$router.back()` 返回列表
3. **列表页必须实现 `activated()` 钩子**，在 keep-alive 激活时刷新数据

```javascript
// 列表页 index.vue
activated() {
  this.getList();
}
// 详情页 form.vue - 提交成功后
this.$store.dispatch('tagsView/delView', this.$route).then(() => {
  this.$router.back();
});
```

### 状态字典管理
- **禁止**在单个 Vue 组件中硬编码 `getStatusLabel` / `getNodeLabel` 等大段映射
- 必须抽离到 `src/utils/constants.js` 或使用若依字典管理 `dict.type.xxx`
- 防止：PATTERN-R011（状态映射不完整/横向不一致）

## 状态流转规范

### 审批日志强制记录
- 任何涉及 `status` 字段变更的操作，**必须**在同一事务中记录审批日志
- 使用 `@Transactional` 确保原子性
- 防止：PATTERN-R010（审批历史遗漏）

### 状态判断优先查表
- **禁止**通过推断/计算获取实体状态，必须直接查询数据库字段

```java
// ❌ 错误: 通过推断获取状态
if (project.getApprovalRecords().size() >= requiredApprovals) {
    // 推断为已通过
}
// ✅ 正确: 直接查询数据库状态字段
String status = projectMapper.selectStatusById(id);
if ("approved".equals(status)) { ... }
```