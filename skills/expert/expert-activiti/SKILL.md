---
name: expert-activiti
description: Activiti工作流引擎专家，精通Activiti 7 Core/Cloud架构和BPMN 2.0规范。当用户涉及工作流设计或流程引擎开发时自动触发。支持中文触发：工作流设计、流程引擎、BPMN建模、Activiti开发。
license: MIT
compatibility: Activiti 7.x
metadata:
  author: "neuqik@hotmail.com"
  version: "2.0"
  triggers:
    - "/activiti" | "/bpmn" | "/workflow"
    - "工作流" | "流程设计" | "BPMN"
    - "流程部署" | "任务管理" | "Activiti"
---

# Activiti工作流引擎专家

## 1. 技能概述
**核心能力**: BPMN建模(BPMN 2.0) | 流程引擎(Activiti 7 Core/Cloud架构) | 流程部署(定义/版本管理) | 任务管理(用户任务/候选组/代理) | 表达式(UEL/脚本任务)

**适用场景**: 流程设计与建模 | 流程部署与版本管理 | 任务查询与办理 | 流程变量处理 | 事件与监听器配置

**协作**: pdd-implement-feature(咨询工作流问题) | software-architect(流程架构)

## 2. BPMN 2.0 核心元素
**流程元素**: 事件(Start/Intermediate/End) | 活动(Task/Service Task/Script Task/Call Activity/Subprocess) | 网关(Exclusive/Parallel/Inclusive/Event) | 序列流(Sequential/Default/Conditional)

**元素速查**:
| 元素 | XML标签 | 说明 |
|------|---------|------|
| 开始事件 | `<startEvent>` | 流程启动点 |
| 结束事件 | `<endEvent>` | 流程结束点 |
| 用户任务 | `<userTask>` | 人工处理 |
| 服务任务 | `<serviceTask>` | 自动处理 |
| 排他网关 | `<exclusiveGateway>` | 选一分支 |
| 并行网关 | `<parallelGateway>` | 并行执行 |
| 顺序流 | `<sequenceFlow>` | 连接元素 |

## 3. 快速诊断模式
**流程部署失败**: ①检查BPMN格式(.bpmn20.xml/.bpmn) ②流程定义ID唯一且无特殊字符 ③每个流程必须有唯一Start Event ④排他网关必须设条件 ⑤服务任务指向存在的Bean/类
**任务查询为空**: ①检查candidateUser/candidateGroup ②检查assignee是否签收 ③流程变量是否正确 ④权限配置

## 4. 核心配置规范
**流程部署**:
```java
@Deployment
public void deploymentTest() {
    repositoryService.createDeployment()
        .name("转让审批流程")
        .key("transfer-approval")
        .addClasspathResource("processes/TransferApproval.bpmn20.xml")
        .deploy();
}
```
**用户任务**:
```xml
<userTask id="approveTask" name="审批任务">
    <extensionElements>
        <activiti:potentialOwner>
            <resourceAssignmentExpression>
                <formalExpression>group(manager)</formalExpression>
            </resourceAssignmentExpression>
        </activiti:potentialOwner>
    </extensionElements>
    <activiti:taskListener event="create" delegateExpression="${taskListenerBean}"/>
</userTask>
```
**排他网关(XOR)**:
```xml
<exclusiveGateway id="approvalGateway" default="defaultFlow"/>
<sequenceFlow id="flowApproved" sourceRef="approvalGateway" targetRef="approvedTask">
    <conditionExpression xsi:type="tFormalExpression">${approved == true}</conditionExpression>
</sequenceFlow>
<sequenceFlow id="flowRejected" sourceRef="approvalGateway" targetRef="rejectedTask">
    <conditionExpression xsi:type="tFormalExpression">${approved == false}</conditionExpression>
</sequenceFlow>
```
**服务任务**: delegateExpression=`${myDelegateBean}` | class=`com.example.MyDelegate` | expression=`${orderService.process(order)}` | scriptTask(scriptFormat=javascript)

## 5. 常见问题解决方案
**5.1 部署失败**: 查XML语法 / Start-End Event / 网关条件 / 服务任务指向
**5.2 任务查询为空**:
```java
List<Task> candidateTasks = taskService.createTaskQuery()
    .taskCandidateUser("userId").taskCandidateGroup("groupId").list();
List<Task> assignedTasks = taskService.createTaskQuery().taskAssignee("userId").list();
```
**5.3 变量获取null**: 用 `delegateTask.getVariable()` / `delegateTask.getExecution().getVariable()`；确认变量范围(execution vs task)
**5.4 网关条件不生效**: 用 `${condition}` 语法；排他网关确保恰好一个条件为true；设置默认流；检查变量类型

## 6. 最佳实践清单
**建模规范**: [ ]流程唯一Start Event [ ]至少一个End Event [ ]用户任务配候选用户/组 [ ]排他网关设默认流 [ ]服务任务指向存在实现 [ ]流程Key用kebab-case [ ]流程ID唯一
**变量命名**: camelCase: transferAmount | 避免保留字(processInstanceId/taskId) | 前缀区分(biz_业务/sys_系统)
**异常处理**:
```java
// 边界事件捕获
<boundaryEvent id="errorBoundary" attachedToRef="serviceTask">
    <errorEventDefinition errorCode="SERVICE_ERROR"/>
</boundaryEvent>
try {
    // 业务逻辑
} catch (Exception e) {
    execution.setVariable("errorMessage", e.getMessage());
    execution.setVariable("errorCode", "BUSINESS_ERROR");
}
```

## 7. Guardrails
**必须遵守**: [ ]BPMN符合2.0规范 [ ]流程有Start和End Event [ ]排他网关设默认流 [ ]用户任务配候选人 [ ]服务任务实现类存在
**避免**: ❌硬编码候选人 ❌省略End Event ❌复杂嵌套网关 ❌流程中存大量数据

## 8. 本地开发指南
**规则文件**: `.trae/rules/project_rules.md`(目录/命名/开发规范) | `.trae/rules/lessons.md`(历史问题方案)
**本地文档**: `Asset-Management-Platform/docs/activiti7/` 下完整中文文档(README/01概述/02快速入门/03组件架构/04-BPMN支持/05常见问题)
**检查项**: [ ]查lessons.md [ ]遵循project_rules.md [ ]参考现有代码模式 [ ]确认数据库 mysql6.sqlpub.com:3311/asset_ruoyi

## 9. 参考文档
- 本地: [Activiti 7开发指南](Asset-Management-Platform/docs/activiti7/README.md) | [后端技术架构](Asset-Management-Platform/docs/architect/02-后端技术架构.md)
- 外部: [Activiti 7 Developers Guide](https://activiti.gitbook.io/activiti-7-developers-guide) | [BPMN 2.0 规范](https://www.omg.org/spec/BPMN/2.0/)

## 10. 版本历史
| 版本 | 日期 | 变更 |
|-----|------|------|
| 2.1 | 2026-03-22 | 添加本地开发指南和文档引用 |
| 2.0 | 2026-03-21 | 标准化结构，添加诊断模式，增强协作 |
| 1.0 | 早期 | 初始版本 |