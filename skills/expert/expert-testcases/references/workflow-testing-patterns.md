# 工作流测试模式

## Activiti 7工作流测试要点

### 1. 流程启动测试

**验证点**:
- status=02时Controller自动调用startWorkflow
- processInstanceId非空且格式正确
- act_ru_task表存在对应待办任务
- 流程变量applicant正确设置

**源码模式**:
```java
// add Controller
if (rows > 0 && "02".equals(equityTransferManage.getStatus())) {
    equityTransferApplyService.startWorkflow(id, applyNo, variables);
}

// edit Controller - 防重复启动
if (rows > 0 && "02".equals(equityTransferManage.getStatus())) {
    if (equityTransferManage.getProcessInstanceId() == null) {
        equityTransferApplyService.startWorkflow(id, applyNo, variables);
    }
}
```

### 2. 节点→状态映射测试

**验证点**:
- 每个usertask节点审批通过后状态码正确
- reject统一设status=08
- 状态映射与determineStatusByNode方法一致

**标准映射表**:
| 流程节点 | 审批通过状态 | 含义 |
|---------|------------|------|
| usertask2 | 03 | 子公司审批通过 |
| usertask3 | 04 | 集团审核通过 |
| usertask4 | 05 | 集团审批通过 |
| usertask5 | 06 | 议案上传通过 |
| usertask6 | 07 | 决议上传通过 |
| usertask99 | 02 | 退回修改重新提交 |
| reject(任意) | 08 | 已驳回 |

### 3. 文件必传节点测试

**验证点**:
- usertask5: 议案文件(motionFiles)必传
- usertask6: 决议文件(resolutionFiles)必传
- 缺少时返回明确错误消息

**源码模式**:
```java
if (dto.getMotionFiles() != null && !dto.getMotionFiles().isEmpty()) {
    // 处理议案文件
} else if ("usertask5".equals(taskDefinitionKey)) {
    return AjaxResult.error("请至少上传一个类型的议案文件");
}
```

### 4. 驳回重提闭环测试

**完整流程**:
1. 提交申请 → status=02, processInstanceId非空
2. 审批驳回 → status=08
3. 编辑申请 → updateEquityTransferApply无状态校验
4. 重新提交 → status=02, processInstanceId=null
5. edit Controller检测status=02+pid=null → 自动启动新流程
6. 新processInstanceId非空

### 5. 流程异常测试

| 场景 | 预期行为 |
|------|---------|
| 流程定义未部署 | 记录入库但pid=null，返回"启动审批流程失败" |
| 流程已结束再审批 | 返回"当前没有待处理的任务" |
| 非审批人操作 | 返回403权限不足 |
| 并发审批同一任务 | 第一个成功，第二个返回"当前没有待处理的任务" |

### 6. 待办/已办数据一致性

**验证方法**:
```python
todo_before = len(api.get_todo_list(dept_manager_session).json()["rows"])
done_before = len(api.get_done_list(dept_manager_session).json()["rows"])

api.handle_approval(dept_manager_session, apply_id, "approve", "通过")

todo_after = len(api.get_todo_list(dept_manager_session).json()["rows"])
done_after = len(api.get_done_list(dept_manager_session).json()["rows"])

assert todo_after == todo_before - 1
assert done_after == done_before + 1
```
