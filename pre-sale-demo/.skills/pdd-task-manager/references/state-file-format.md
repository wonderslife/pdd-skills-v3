# 状态文件格式（.pdd/state-{moduleId}.json）

> 由 pdd-task-manager 技能引用。断点续传的状态文件完整示例。

```json
{
  "version": "2.0",
  "moduleId": "ZCCZ-1",
  "moduleName": "国有产权转让",
  "startedAt": "2026-03-31T09:00:00Z",
  "updatedAt": "2026-03-31T11:30:00Z",

  "currentPhase": "feature-loop",
  "currentFeature": "FP-ZCCZ1-002",
  "currentTaskGroup": "backend",
  "currentTask": "generate-service",

  "progress": {
    "totalFeatures": 5,
    "completedFeatures": 1,
    "skippedFeatures": 0,
    "failedFeatures": 0,
    "overallProgress": 25
  },

  "featureList": [
    { "id": "FP-ZCCZ1-001", "name": "转让申请", "priority": "P0", "status": "completed", "completedAt": "2026-03-31T10:30:00Z" },
    { "id": "FP-ZCCZ1-002", "name": "转让审批", "priority": "P0", "status": "in_progress", "startedAt": "2026-03-31T11:00:00Z", "progress": 45 },
    { "id": "FP-ZCCZ1-003", "name": "转让公告", "priority": "P1", "status": "pending" },
    { "id": "FP-ZCCZ1-004", "name": "转让成交", "priority": "P1", "status": "pending" },
    { "id": "FP-ZCCZ1-005", "name": "转让归档", "priority": "P2", "status": "pending" }
  ],

  "taskProgress": {
    "FP-ZCCZ1-001": {
      "status": "completed",
      "taskGroups": {
        "database": { "status": "completed", "tasks": { "create-table": "completed", "insert-dict-data": "completed" } },
        "backend": { "status": "completed", "tasks": { "generate-entity": "completed", "generate-mapper": "completed", "generate-service": "completed", "generate-controller": "completed" } },
        "frontend": { "status": "completed", "tasks": { "generate-api": "completed", "generate-list-page": "completed", "generate-form-page": "completed", "generate-detail-page": "completed" } },
        "menu": { "status": "completed", "tasks": { "config-menu": "completed" } },
        "test": { "status": "completed", "tasks": { "unit-test": "completed", "integration-test": "completed" } }
      }
    },
    "FP-ZCCZ1-002": {
      "status": "in_progress",
      "taskGroups": {
        "database": { "status": "completed", "tasks": { "create-table": "completed", "insert-dict-data": "completed" } },
        "backend": { "status": "in_progress", "tasks": { "generate-entity": "completed", "generate-mapper": "completed", "generate-service": "in_progress", "generate-controller": "pending" } },
        "frontend": { "status": "pending", "tasks": { "generate-api": "pending", "generate-list-page": "pending", "generate-form-page": "pending", "generate-detail-page": "pending" } },
        "menu": { "status": "pending", "tasks": { "config-menu": "pending" } },
        "test": { "status": "pending", "tasks": { "unit-test": "pending", "integration-test": "pending" } }
      }
    }
  },

  "retryHistory": [
    { "taskId": "FP-ZCCZ1-002/generate-service", "attempt": 1, "error": "缺少依赖接口定义", "timestamp": "2026-03-31T11:15:00Z", "resolved": true, "resolution": "补充接口定义后重试成功" }
  ],

  "checkpoints": [
    { "id": "cp-001", "timestamp": "2026-03-31T09:30:00Z", "phase": "business-analysis", "description": "业务分析完成" },
    { "id": "cp-002", "timestamp": "2026-03-31T10:00:00Z", "phase": "spec-generation", "description": "规格生成完成" },
    { "id": "cp-003", "timestamp": "2026-03-31T10:30:00Z", "phase": "feature-loop", "featureId": "FP-ZCCZ1-001", "description": "功能点FP-ZCCZ1-001完成" }
  ],

  "context": {
    "specPath": "docs/dev-specs/ZCCZ-1/spec.md",
    "outputPath": "Asset-Management-Platform/asset-equity",
    "templateVariables": {
      "package": "com.sjjk.equity.transfer",
      "moduleName": "equity-transfer",
      "permissionPrefix": "equity:transfer"
    }
  }
}
```