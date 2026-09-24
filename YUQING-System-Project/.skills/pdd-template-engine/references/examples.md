# 模板引擎使用示例 (Template Engine Examples)

## 示例1: 生成简单CRUD代码

```yaml
输入:
  spec.md: |
    # 国有产权转让申请
    ## 数据模型
    实体: EquityTransferApply
    表名: equity_transfer_apply
    字段:
      - name: transferType
        type: string
        label: 转让方式
      - name: transferReason
        type: string
        label: 转让原因

执行:
  场景: crud
  模板: scenarios/crud

输出:
  - EquityTransferApplyController.java
  - IEquityTransferApplyService.java
  - EquityTransferApplyServiceImpl.java
  - EquityTransferApplyMapper.java
  - EquityTransferApplyMapper.xml
  - EquityTransferApply.java
  - equity_transfer_apply.sql
  - menu_equity_transfer_apply.sql
  - index.vue
  - form.vue
  - detail.vue
  - equity-transfer.js
```

## 示例2: 生成工作流代码

```yaml
输入:
  spec.md: |
    # 资产处置审批
    ## 数据模型
    实体: AssetDisposalApply
    表名: asset_disposal_apply
    ## 流程定义
    流程Key: asset-disposal-approval
    审批类型: multi-level
    ## 审批规则
    - 金额 >= 500万: 集团审批
    - 金额 >= 30万: 子公司审批
    - 金额 < 30万: 自动通过

执行:
  场景: workflow-crud
  模板: scenarios/workflow-crud

输出:
  后端:
    - AssetDisposalApplyController.java
    - IAssetDisposalApplyService.java
    - AssetDisposalApplyServiceImpl.java
    - AssetDisposalApplyMapper.java
    - AssetDisposalApplyMapper.xml
    - AssetDisposalApply.java
    - AssetDisposalApplyProcessService.java
    - AssetDisposalTaskListener.java
    - asset-disposal-approval.bpmn20.xml
  前端:
    - index.vue
    - form.vue
    - detail.vue
    - ApprovalPanel.vue
    - asset-disposal.js
  SQL:
    - asset_disposal_apply.sql
    - menu_asset_disposal_apply.sql
```

## PRD约定注入示例

```yaml
PRD约定提取:
  枚举编码约定:
    来源: PRD第5.3节
    注入: fields[].enumCase = "snake_case"
    效果: 枚举值自动转为snake_case小写
  类型映射约定:
    来源: PRD第5.4节
    注入: fields[].pythonType / fields[].javaType / fields[].tsType
    效果: 字段类型自动按映射表转换
  表单组件映射:
    来源: PRD第4.4节
    注入: fields[].component = "el-select" / "el-date-picker" / "el-input"
    效果: 前端表单自动使用正确组件
  Options API数据源:
    来源: PRD第4.5节
    注入: fields[].optionsApi = "/departments/options"
    效果: 下拉框自动关联Options API
```