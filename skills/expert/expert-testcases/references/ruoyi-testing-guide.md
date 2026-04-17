# 若依框架测试指南

## 框架特性对测试的影响

### 1. Spring Security + JWT认证

**测试要点**:
- 每个请求需携带`Authorization: Bearer {token}`头
- Token通过`POST /login`获取
- 无权限返回code=403
- Token过期返回code=401

**代码模式**:
```python
def _login(username, password):
    resp = requests.post(f"{BASE_URL}/login", json={"username": username, "password": password})
    return resp.json().get("token")

session = requests.Session()
session.headers.update({"Authorization": f"Bearer {token}"})
```

### 2. @PreAuthorize权限控制

**测试要点**:
- 每个API端点都有`@PreAuthorize("@ss.hasPermi('xxx:xxx:xxx')")`注解
- 权限标识格式: `{模块}:{业务}:{操作}`
- 若依权限操作: list/query/add/edit/remove/export/approval
- 无权限返回code=403

**权限矩阵构建**:
从Controller源码提取所有@PreAuthorize注解，与角色权限配置对比。

### 3. @DataScope数据权限

**测试要点**:
- 列表查询接口受@DataScope注解影响
- 同部门用户可见本部门数据
- 跨部门用户不可见其他部门数据
- 管理员可见全部数据

**测试方法**:
```python
# 以applicant(部门A)登录查询，验证仅返回部门A数据
resp = api.list_apply(applicant_session)
for row in resp.json()["rows"]:
    assert row["deptId"] == applicant_dept_id
```

### 4. Activiti工作流集成

**测试要点**:
- 提交申请(status=02)自动启动工作流
- processInstanceId关联业务记录与流程实例
- 审批通过按节点映射状态: usertask2→03, usertask3→04, ...
- 驳回统一设status=08
- 退回后编辑重新提交(status=02 + processInstanceId=null)启动新流程

**关键源码模式**:
```java
// Controller: edit方法中自动启动流程
if (rows > 0 && "02".equals(equityTransferManage.getStatus())) {
    if (equityTransferManage.getProcessInstanceId() == null) {
        equityTransferApplyService.startWorkflow(id, applyNo, variables);
    }
}
```

### 5. 统一响应格式

**若依AjaxResult格式**:
```json
{"code": 200, "msg": "操作成功", "data": {...}}
{"code": 500, "msg": "错误信息", "data": null}
{"code": 403, "msg": "权限不足", "data": null}
```

**TableDataInfo格式**:
```json
{"code": 200, "msg": "查询成功", "rows": [...], "total": 100}
```

### 6. Bug模式库（R001-R015）

| 模式ID | 检查项 | 测试影响 |
|--------|--------|---------|
| R001 | @PreAuthorize缺失 | 权限测试用例 |
| R002 | sys_menu配置缺失 | 菜单权限测试 |
| R013 | @DataScope缺失 | 数据权限隔离测试 |
| R014 | deptAlias/userAlias错误 | 数据权限SQL注入测试 |
| R015 | 数据权限绕过 | 越权访问测试 |

## 测试环境要求

| 组件 | 要求 |
|------|------|
| Spring Boot | 运行中 |
| MySQL | 数据库已初始化 |
| Redis | 缓存服务可用 |
| Activiti | 流程已部署 |
| 测试用户 | 5个角色账号已创建 |
