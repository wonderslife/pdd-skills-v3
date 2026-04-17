# ZCCZ-1 股权转让 - 输入快照

> 本文件记录了 expert-testcases 技能生成 ZCCZ-1 测试用例集时的输入条件

---

## 一、模块基本信息

| 属性 | 值 |
|------|-----|
| 模块名称 | 股权转让 |
| 模块编码 | ZCCZ-1 |
| 后端框架 | RuoYi 3.9.1 (Spring Boot 2.5.15) |
| 前端框架 | Vue2 + Element UI |
| 工作流引擎 | Activiti 7.1.0.M6 |
| 后端模块 | asset-equity-transfer |
| 前端模块 | equity-transfer-new |

---

## 二、源码分析结果

### 2.1 Controller端点

| 编号 | 方法 | 路径 | 权限 | 描述 |
|------|------|------|------|------|
| A01 | GET | /list | equity:transfer:new:list | 查询转让申请列表 |
| A02 | GET | /{id} | equity:transfer:new:query | 查看申请详情 |
| A03 | POST | / | equity:transfer:new:add | 新增转让申请 |
| A04 | PUT | / | equity:transfer:new:edit | 修改转让申请 |
| A05 | DELETE | /{ids} | equity:transfer:new:remove | 删除转让申请 |
| A06 | GET | /getInfo | equity:transfer:new:query | 获取申请信息 |
| A07 | POST | /submit | equity:transfer:new:edit | 提交申请 |
| A08 | POST | /terminate | equity:transfer:new:edit | 终止申请 |
| A09 | POST | /handleApproval | equity:transfer:new:approval | 审批操作 |
| A10 | GET | /getApprovalHistory | equity:transfer:new:query | 获取审批历史 |
| A11 | GET | /getMotionFiles | equity:transfer:new:query | 获取议案文件 |
| A12 | POST | /saveMotionFiles | equity:transfer:new:edit | 保存议案文件 |
| A13 | GET | /export | equity:transfer:new:export | 导出转让申请 |

### 2.2 状态码定义

| 状态码 | 含义 |
|--------|------|
| 00 | 初始 |
| 01 | 待提交 |
| 02 | 已提交/审批中 |
| 03 | 子公司审批通过 |
| 04 | 集团审核通过 |
| 05 | 集团审批通过 |
| 06 | 议案上传通过 |
| 07 | 决议上传通过 |
| 08 | 已驳回 |
| 09 | 已终止 |

### 2.3 工作流节点

| 节点ID | 节点名称 | 处理人 |
|--------|---------|--------|
| usertask2 | 子公司审批 | dept_manager_role |
| usertask3 | 子公司办理 | dept_manager_role |
| usertask4 | 集团接收 | leader_role |
| usertask5 | 集团审批（议案） | leader_role |
| usertask6 | 集团决策（决议） | leader_role |

### 2.4 测试用户

| 角色 | 用户名 | 部门 | dept_id |
|------|--------|------|---------|
| 申请人 | yuanye | 盛京智造资产管理部 | 235 |
| 子公司审批人 | dongbo | 盛京智造资产管理部 | 235 |
| 集团审批人 | hechuntian | 金控集团运营管理部 | 281 |
| 管理员 | sunbo | 金控集团运营管理部 | 281 |
| 跨部门用户 | lianglisha | 金控集团运营管理部 | 281 |

---

## 三、关键发现

| 编号 | 发现项 | 影响 |
|------|--------|------|
| F01 | handleApproval方法含usertask2-6分支逻辑 | 需覆盖每个分支 |
| F02 | 列表查询使用@DataScope注解 | 需验证数据权限隔离 |
| F03 | 提交操作触发Activiti流程 | 需验证流程启动和节点流转 |
| F04 | 议案/决议文件上传有类型限制 | 需验证非法文件类型 |
| F05 | 底价低于评估价无前端校验 | 需验证后端是否校验 |
| F06 | 驳回后可重新提交 | 需验证状态回退 |
| F07 | 终止操作仅限草稿状态 | 需验证非草稿状态终止 |
| F08 | 审批意见为null时后端行为 | 需验证空意见处理 |
| F09 | 并发审批同一申请 | 需验证竞态条件 |
| F10 | 导出功能含数据权限过滤 | 需验证跨部门导出 |
