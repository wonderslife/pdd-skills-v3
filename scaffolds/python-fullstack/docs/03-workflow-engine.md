# 工作流引擎设计文档

> **PDD-Scaffold 脚手架 - 状态机 + 审批节点工作流引擎**

**版本**: v1.0.0  
**日期**: 2026-04-12  
**状态**: 设计完成，待实现

---

## 目录

- [1. 功能概述](#1-功能概述)
- [2. 需求分析](#2-需求分析)
- [3. 技术架构](#3-技术架构)
- [4. 核心数据模型](#4-核心数据模型)
- [5. 引擎核心设计](#5-引擎核心设计)
- [6. 资产处置流程定义](#6-资产处置流程定义)
- [7. 会签机制](#7-会签机制)
- [8. 退回与撤销](#8-退回与撤销)
- [9. API 接口设计](#9-api-接口设计)
- [10. 前端组件设计](#10-前端组件设计)
- [11. 模板集成方案](#11-模板集成方案)
- [12. 实现计划](#12-实现计划)

---

## 1. 功能概述

### 1.1 定位

本工作流引擎是一个 **轻量级、可配置、通用** 的业务审批流引擎。采用 **状态机 + 审批节点** 架构，以资产处置审批为核心场景，同时具备复用为通用框架的能力。

### 1.2 核心能力

| 能力 | 说明 | 支持方式 |
|------|------|----------|
| **多级顺序审批** | 部门→子公司→集团逐级审批 | 状态转换链 |
| **会签/并行审批** | 多人同时审批（财务+法务+领导） | TaskSign + SignStrategy |
| **条件分支** | 根据金额走不同审批路径 | TransitionRule.condition |
| **退回与撤销** | 审批不通过可退回修改或终止 | return/revoke/cancel 动作 |
| **超时处理** | 任务超时自动提醒/升级 | due_at + 定时任务 |

### 1.3 设计原则

- **精简优先** - 核心概念只有：State（状态）+ Node（节点）+ Action（动作）
- **代码驱动** - 流程规则用 Python 代码/JSON 配置，无需可视化建模
- **业务解耦** - 引擎不关心业务内容，只管理状态流转和任务分配
- **可调试性** - 每次状态变更都有日志记录，状态清晰可见

---

## 2. 需求分析

### 2.1 资产处置流程场景

```
资产处置全生命周期:

1. 起草阶段
   └── 业务人员填写处置申请单 (DRAFT)

2. 评估阶段  
   ├── 分配评估人员 (PENDING_EVAL → EVALUATING)
   ├── 评估师进行资产估值
   ├── 评估完成 → 进入审批 (EVALUATING → PENDING_APPROVE)
   └── 评估不合格 → 退回修改 (EVALUATING → EVAL_RETURNED)

3. 审批阶段
   ├── 条件判断: 处置金额
   │   ├── < 50万: 部门审批 (DEPT_APPROVING)
   │   └── >= 50万: 集团审批 (GROUP_APPROVING, 含会签)
   ├── 审批通过 → 待执行 (APPROVED)
   ├── 审批退回 → 重新审批 (APPROVE_RETURNED → PENDING_APPROVE)
   └── 拒绝 → 终止 (REJECTED)

4. 执行阶段
   ├── 执行处置操作 (EXECUTING)
   └── 执行完成 (EXEC_COMPLETED)

5. 归档阶段
   └── 归档完成 (COMPLETED)

特殊操作:
- 撤销: 任何中间状态可撤销 (REVOKED)
- 取消: 草稿/拒绝状态可取消 (CANCELLED)
```

### 2.2 功能需求清单

| 编号 | 需求 | 优先级 | 说明 |
|------|------|--------|------|
| WF-001 | 流程实例创建与管理 | P0 | 启动/查询/删除流程实例 |
| WF-002 | 多级顺序审批 | P0 | 支持多层级依次审批 |
| WF-003 | 会签/并行审批 | P0 | 多人审批，支持多种策略 |
| WF-004 | 条件分支 | P0 | 根据业务变量走不同路径 |
| WF-005 | 退回到指定节点 | P0 | 审批退回修改后重新提交 |
| WF-006 | 撤销/取消 | P1 | 终止流程 |
| WF-007 | 待办任务中心 | P0 | 我的待办/已办列表 |
| WF-008 | 审批历史追踪 | P0 | 全程日志记录 |
| WF-009 | 超时提醒 | P2 | 任务到期自动通知 |
| WF-010 | 流程监控看板 | P2 | 可视化流程进度 |

---

## 3. 技术架构

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│              状态机 + 审批节点 工作流引擎                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  WorkflowEngine (核心)                │   │
│  │                                                     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │ State    │  │ Transition│  │ Condition│          │   │
│  │  │ Machine  │  │ Rules    │  │ Evaluator│          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │   │
│           ┌───────────────┼───────────────┐                 │   │
│           ▼               ▼               ▼                 │   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │   │
│  │ ApprovalNode │ │ CounterSign  │ │ ReturnHandler│       │   │
│  │ (审批节点)    │ │ (会签处理)   │ │ (退回处理)   │       │   │
│  └──────────────┘ └──────────────┘ └──────────────┘       │   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    API 层                             │   │
│  │  /api/v1/workflow/instances  - 流程实例管理          │   │
│  │  /api/v1/workflow/tasks      - 待办任务              │   │
│  │  /api/v1/workflow/logs        - 审批日志             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 技术选型

| 层级 | 技术 | 选型理由 |
|------|------|----------|
| **引擎核心** | Python 原生类 | 轻量、可控、无外部依赖 |
| **状态存储** | SQLAlchemy ORM | 与项目技术栈一致 |
| **条件判断** | Python Callable / JSONPath | 灵活的条件表达式 |
| **前端展示** | Vue 3 + Element Plus | 统一 UI 框架 |
| **流程图** | LogicFlow / 自定义 SVG | 可视化流程展示 |

---

## 4. 核心数据模型

### 4.1 ER 关系图

```
┌──────────────┐       ┌──────────────────┐
│ WorkflowDef  │ 1   N │ WorkflowInstance │
│ (流程定义)    │──────<│ (流程实例)        │
│              │       │                  │
│ • id         │       │ • id             │
│ • name       │       │ • def_id (FK)    │
│ • code       │       │ • business_key   │
│ • version    │       │ • current_state  │
│ • config     │       │ • variables      │
│ • is_active  │       │ • status         │
└──────────────┘       │ • started_at     │
                       │ • finished_at    │
                       └────────┬─────────┘
                                │ 1
                                ▼
                      ┌──────────────────┐
                      │ WorkflowTask     │
                      │ (待办任务)        │
                      │                  │
                      │ • id             │
                      │ • instance_id(FK)│
                      │ • node_key       │
                      │ • node_name      │
                      │ • assignee_id    │
                      │ • sign_strategy  │
                      │ • total_signers  │
                      │ • signed_count   │
                      │ • status         │
                      │ • result         │
                      │ • opinion        │
                      │ • due_at         │
                      └────────┬─────────┘
                               │ 1 N
                               ▼
                      ┌──────────────────┐
                      │ TaskSign         │
                      │ (会签记录)        │
                      │                  │
                      │ • id             │
                      │ • task_id (FK)   │
                      │ • signer_id      │
                      │ • result         │
                      │ • opinion        │
                      │ • signed_at      │
                      └──────────────────┘

┌──────────────────┐
│ WorkflowLog      │
│ (执行日志)        │
│                  │
│ • id             │
│ • instance_id(FK)│
│ • action         │
│ • from_state     │
│ • to_state       │
│ • operator_id    │
│ • opinion        │
│ • timestamp      │
└──────────────────┘
```

### 4.2 核心枚举

```python
class WorkflowState(str, Enum):
    """工作流状态"""
    
    # ===== 草稿阶段 =====
    DRAFT = "draft"
    
    # ===== 评估阶段 =====
    PENDING_EVAL = "pending_eval"
    EVALUATING = "evaluating"
    EVAL_RETURNED = "eval_returned"
    
    # ===== 审批阶段 =====
    PENDING_APPROVE = "pending_approve"
    DEPT_APPROVING = "dept_approving"
    GROUP_APPROVING = "group_approving"
    APPROVE_RETURNED = "approve_returned"
    
    # ===== 执行阶段 =====
    APPROVED = "approved"
    EXECUTING = "executing"
    EXEC_COMPLETED = "exec_completed"
    
    # ===== 终态 =====
    COMPLETED = "completed"
    REJECTED = "rejected"
    REVOKED = "revoked"
    CANCELLED = "cancelled"


class NodeType(str, Enum):
    """节点类型"""
    START = "start"
    END = "end"
    APPROVE = "approve"           # 单人审批
    COUNTER_SIGN = "counter_sign" # 会签
    CONDITION = "condition"       # 条件分支
    NOTIFY = "notify"             # 通知


class SignStrategy(str, Enum):
    """会签策略"""
    ALL_PASS = "all_pass"         # 全部通过
    ANY_PASS = "any_pass"         # 任一通过
    RATIO_PASS = "ratio_pass"      # 按比例
    LEADER_PASS = "leader_pass"    # 领导决定


class TaskStatus(str, Enum):
    """任务状态"""
    PENDING = "pending"            # 待处理
    CLAIMED = "claimed"            # 已认领
    COMPLETED = "completed"        # 已完成
    SKIPPED = "skipped"            # 已跳过
    CANCELLED = "cancelled"        # 已取消


class InstanceStatus(str, Enum):
    """实例状态"""
    RUNNING = "running"            # 运行中
    COMPLETED = "completed"        # 已结束
    CANCELLED = "cancelled"        # 已取消
```

---

## 5. 引擎核心设计

### 5.1 目录结构

```
backend/app/core/workflow/
├── __init__.py
├── engine.py                # WorkflowEngine 主引擎
├── models.py                # 数据模型 (ORM)
├── enums.py                 # 枚举定义
├── exceptions.py            # 异常定义
├── conditions.py            # 条件判断器
├── handlers/
│   ├── approval_handler.py  # 审批处理器
│   ├── counter_sign_handler.py  # 会签处理器
│   └── return_handler.py    # 退回处理器
└── services/
    └── workflow_service.py   # 对外服务层
```

### 5.2 WorkflowEngine 核心

```python
class WorkflowEngine:
    """
    工作流引擎核心
    
    设计理念:
    - 状态机驱动: 当前状态 + 动作 → 新状态
    - 规则可注册: 通过 register_transition() 注册转换规则
    - 条件可插拔: 每个 rule 可以有 condition 函数
    - 任务自动生成: 规则中配置 create_task=True 自动创建待办
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.transitions: Dict[str, TransitionRule] = {}
        self._register_default_transitions()
    
    # ========== 核心方法 ==========
    
    def start_workflow(self, def_id, business_key, business_type, 
                       creator_id, variables=None) -> WorkflowInstance:
        """启动流程实例 (初始状态 DRAFT)"""
        
    def execute_action(self, instance, action, operator_id, 
                       opinion=None, **kwargs) -> WorkflowInstance:
        """
        执行工作流动作 (核心入口)
        
        流程:
        1. 查找 action 对应的 TransitionRule
        2. 校验当前状态是否允许此 action
        3. 执行 condition 检查
        4. 更新实例状态
        5. 如果需要，创建待办任务
        6. 记录执行日志
        7. 提交事务
        """
        
    # ========== 任务操作 ==========
    
    def approve_task(self, task, signer_id, operator_id, 
                     opinion=None) -> WorkflowInstance:
        """审批通过"""
        
    def reject_task(self, task, signer_id, operator_id, 
                    reason=None) -> WorkflowInstance:
        """拒绝"""
        
    def return_task(self, task, target_state, operator_id, 
                    reason=None) -> WorkflowInstance:
        """退回到指定状态"""
        
    def claim_task(self, task, user_id) -> WorkflowTask:
        """认领任务"""
        
    # ========== 查询方法 ==========
    
    def get_pending_tasks(self, user_id) -> List[WorkflowTask]:
        """获取待办列表"""
        
    def get_completed_tasks(self, user_id) -> List[WorkflowTask]:
        """获取已办列表"""
        
    def get_instance_timeline(self, instance_id) -> List[WorkflowLog]:
        """获取流程时间线"""
```

### 5.3 TransitionRule 定义

```python
class TransitionRule:
    """状态转换规则"""
    
    def __init__(
        self,
        action: str,              # 动作名称: submit/approve/reject/return
        from_states: List[str],   # 允许的起始状态列表
        to_state: str,            # 目标状态
        condition=None,            # 条件函数 (可选)
        auto_execute=False,       # 是否自动执行（无需人工）
        create_task=False,        # 是否创建待办任务
        task_config=None          # 任务配置
    ):
        self.action = action
        self.from_states = from_states
        self.to_state = to_state
        self.condition = condition
        self.auto_execute = auto_execute
        self.create_task = create_task
        self.task_config = task_config or {}
```

---

## 6. 资产处置流程定义

### 6.1 状态转换完整规则表

| 动作 | 起始状态 | 目标状态 | 条件 | 创建任务 | 任务配置 |
|------|----------|----------|------|----------|----------|
| `submit` | DRAFT, EVAL_RETURNED | PENDING_EVAL | - | ✅ | 评估分配 |
| `start_eval` | PENDING_EVAL | EVALUATING | - | ✅ | 评估任务 |
| `eval_complete` | EVALUATING | PENDING_APPROVE | - | ❌ | - |
| `eval_return` | EVALUATING | EVAL_RETURNED | - | ❌ | - |
| `dept_approve` | PENDING_APPROVE | DEPT_APPROVING | amount < 50万 | ✅ | 部门审批(单人) |
| `group_approve` | PENDING_APPROVE | GROUP_APPROVING | amount >= 50万 | ✅ | 集团审批(会签) |
| `approve` | DEPT/GROUP_APPROVING | APPROVED | - | ❌ | - |
| `approve_return` | DEPT/GROUP_APPROVING | APPROVE_RETURNED | - | ❌ | - |
| `reject` | *APPROVING, PENDING_APPROVE | REJECTED | - | ❌ | - |
| `start_execute` | APPROVED | EXECUTING | ✅ | 执行任务 |
| `execute_complete` | EXECUTING | EXEC_COMPLETED | - | ❌ | - |
| `complete` | EXEC_COMPLETED | COMPLETED | - | ❌ | - |
| `revoke` | DRAFT~APPROVED | REVOKED | - | ❌ | - |
| `cancel` | DRAFT, REJECTED | CANCELLED | - | ❌ | - |

### 6.2 状态流转图 (ASCII)

```
                          ┌──────────────┐
                          │    DRAFT     │
                          └──────┬───────┘
                                 │ submit()
                                 ▼
                    ┌──────────────────────┐
                    │   PENDING_EVAL       │
                    └──────────┬───────────┘
                               │ start_eval()
                               ▼
                    ┌──────────────────────┐
                    │    EVALUATING        │
                    └──┬───────────┬───────┘
                       │           │
           eval_complete()    eval_return()
                       │           │
                       ▼           ▼
            ┌──────────────────┐ ┌──────────────┐
            │  PENDING_APPROVE  │ │EVAL_RETURNED │
            └────────┬─────────┘ └──────┬───────┘
                     │                   │ resubmit
                     │ 条件分支: amount   └──────────┘
              ┌──────┴──────┬───────────┐
              │  < 50万     │  >= 50万   │
              ▼             ▼            │
     ┌────────────────┐ ┌────────────────────┐
     │ DEPT_APPROVING │ │ GROUP_APPROVING     │
     └───────┬────────┘ └───────┬────────────┘
             │ approve/reject   │ approve/reject
             ├──────┬───────────┤
             ▼      ▼           ▼
       ┌────────┐ ┌────────┐ ┌────────────┐
       │APPROVED│ │RETURNED│ │  REJECTED  │
       └───┬────┘ └───┬────┘ └────────────┘
           │          │
           ▼          └──▶ PENDING_APPROVE
     ┌──────────────┐
     │   EXECUTING  │
     └──────┬───────┘
            │ execute_complete()
            ▼
     ┌──────────────┐
     │ EXEC_COMPLETED│
     └──────┬───────┘
            │ complete()
            ▼
     ┌──────────────┐
     │   COMPLETED  │
     └──────────────┘
     
     特殊: revoke() → REVOKED  (任意中间状态)
           cancel() → CANCELLED (DRAFT / REJECTED)
```

---

## 7. 会签机制

### 7.1 会签策略详解

| 策略 | 编码 | 规则 | 适用场景 |
|------|------|------|----------|
| **全部通过** | `ALL_PASS` | 所有人都同意才放行 | 重要决策（集团审批） |
| **任一通过** | `ANY_PASS` | 任一人同意即可 | 一般通知性会签 |
| **按比例通过** | `RATIO_PASS` | 如 3 人需 2 人同意 | 平衡效率与安全 |
| **领导决定** | `LEADER_PASS` | 领导最后签字生效 | 有明确决策链的场景 |

### 7.2 会签流程示例（集团审批）

```
集团审批 (GROUP_APPROVING)
├── 会签策略: ALL_PASS
├── 会签人: 
│   ├── 财务总监 (user_101)
│   ├── 法务总监 (user_102)  
│   └── 集团副总 (user_103) ← leader
├── 流程:
│   │
│   Step 1: 创建 Task + 3 个 TaskSign 记录
│   │
│   Step 2: 各会签人独立签署
│   │   ├── 财务总监: approved ✓ (2026-04-12 09:00)
│   │   ├── 法务总监: approved ✓ (2026-04-12 10:30)
│   │   └── 集团副总: pending...
│   │
│   Step 3: 集团副总签署
│   │   └── 集团副总: approved ✓ (2026-04-12 14:00)
│   │
│   └── Step 4: 检查会签条件
│       ├── signed_count (3) == total_signers (3) ✓
│       ├── all result == "approved" ✓
│       └── 推进到 APPROVED 状态
│
└── 结果: 审批通过 → 进入执行阶段
```

### 7.3 会签核心逻辑

```python
def _handle_counter_sign(self, task, signer_id, result, opinion=None) -> bool:
    """
    处理会签
    
    Returns:
        True  - 会签满足条件，推进流程
        False - 会签未完成，等待其他会签人
    """
    # 1. 记录本次签署
    sign = get_or_create_sign(task.id, signer_id)
    sign.result = result
    sign.opinion = opinion
    sign.signed_at = now()
    task.signed_count += 1
    
    # 2. 判断是否满足放行条件
    strategy = task.sign_strategy
    
    if strategy == SignStrategy.ALL_PASS:
        return (task.signed_count >= task.total_signers and 
                all_approved(task))
    
    elif strategy == SignStrategy.ANY_PASS:
        return has_any_approved(task)
    
    elif strategy == SignStrategy.RATIO_PASS:
        required = ceil(task.total_signers * task.ratio / 100)
        return approved_count(task) >= required
    
    elif strategy == SignStrategy.LEADER_PASS:
        return (leader_has_signed(task) and 
                task.signed_count >= task.total_signers)
    
    return False
```

---

## 8. 退回与撤销

### 8.1 退回机制

```
退回类型:

1. 上一步退回 (Return to Previous)
   审批人 → 退回到上一个环节
   例: 集团审批 → 退回到部门审批
   
2. 指定节点退回 (Return to Specific)
   退回到指定的任意历史节点
   例: 集团审批 → 直接退回到评估环节
   
3. 退回重提 (Return & Resubmit)
   退回后申请人修改并重新提交
   例: 审批退回 → PENDING_APPROVE/APPROVE_RETURNED → 重新提交
```

### 8.2 退回状态映射

| 当前状态 | 退回目标 | 退回动作 | 重新提交目标 |
|----------|----------|----------|-------------|
| EVALUATING | EVAL_RETURNED | eval_return | PENDING_EVAL |
| DEPT_APPROVING | APPROVE_RETURNED | approve_return | PENDING_APPROVE |
| GROUP_APPROVING | APPROVE_RETURNED | approve_return | PENDING_APPROVE |

### 8.3 撤销 vs 取消 vs 拒绝

| 操作 | 目标状态 | 可用范围 | 是否可恢复 |
|------|----------|----------|-----------|
| **revoke** | REVOKED | DRAFT ~ APPROVED | 不可恢复（需新建） |
| **cancel** | CANCELLED | DRAFT, REJECTED | 不可恢复 |
| **reject** | REJECTED | 审批中 | 可重新发起流程 |

---

## 9. API 接口设计

### 9.1 流程实例 API

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/v1/workflow/instances` | 发起流程 | authenticated |
| GET | `/api/v1/workflow/instances` | 流程列表 | authenticated |
| GET | `/api/v1/workflow/instances/{id}` | 流程详情 | authenticated |
| GET | `/api/v1/workflow/instances/{id}/timeline` | 时间线 | authenticated |
| PUT | `/api/v1/workflow/instances/{id}/revoke` | 撤销流程 | owner/admin |
| PUT | `/api/v1/workflow/instances/{id}/cancel` | 取消流程 | owner/admin |
| GET | `/api/v1/workflow/instances/{id}/state-diagram` | 状态图数据 | authenticated |

### 9.2 待办任务 API

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/workflow/tasks/pending` | 我的待办 | authenticated |
| GET | `/api/v1/workflow/tasks/completed` | 我的已办 | authenticated |
| GET | `/api/v1/workflow/tasks/{id}` | 任务详情 | assignee/owner |
| POST | `/api/v1/workflow/tasks/{id}/claim` | 认领任务 | assignee |
| POST | `/api/v1/workflow/tasks/{id}/approve` | 审批通过 | assignee |
| POST | `/api/v1/workflow/tasks/{id}/reject` | 拒绝 | assignee |
| POST | `/api/v1/workflow/tasks/{id}/return` | 退回 | assignee |
| GET | `/api/v1/workflow/tasks/{id}/signs` | 会签情况 | assignee/owner |

### 9.3 请求/响应示例

```python
# POST /api/v1/workflow/instances (发起流程)
Request:
{
    "def_code": "ASSET_DISPOSAL",
    "business_key": "AD-2026-0001",
    "variables": {
        "asset_name": "服务器设备一批",
        "asset_count": 20,
        "amount": 3500000,
        "disposal_method": "转让"
    }
}

Response:
{
    "code": 200,
    "data": {
        "instance": {
            "id": 1001,
            "business_key": "AD-2026-0001",
            "current_state": "draft",
            "status": "running",
            "created_at": "2026-04-12T10:00:00Z"
        },
        "next_actions": ["submit"]
    }
}


# POST /api/v1/workflow/tasks/{id}/approve (审批通过)
Request:
{
    "opinion": "同意处置，价格合理",
    "attachments": []
}

Response:
{
    "code": 200,
    "data": {
        "task_id": 5001,
        "result": "approved",
        "instance": {
            "current_state": "approved",
            "previous_state": "group_approving"
        },
        "next_actions": ["start_execute", "revoke"]
    }
}
```

---

## 10. 前端组件设计

### 10.1 页面结构

```
frontend/src/views/workflow/
├── index.vue                  # 工作流首页（我的待办统计）
├── instance/
│   ├── list.vue               # 我发起的流程列表
│   └── detail.vue             # 流程详情（含状态图）
├── task/
│   ├── pending-list.vue        # 待办任务列表
│   ├── completed-list.vue      # 已办任务列表
│   └── handle.vue              # 任务处理（审批/退回）
└── components/
    ├── WorkflowStateTag.vue    # 状态标签
    ├── TimelineViewer.vue      # 时间线组件
    ├── ApproveForm.vue         # 审批表单
    ├── CounterSignPanel.vue    # 会签面板
    └── StateDiagram.vue        # 状态图（SVG）
```

### 10.2 审批组件示例

```vue
<!-- frontend/src/views/workflow/task/handle.vue -->
<template>
  <div class="task-handle">
    <!-- 任务信息 -->
    <el-card class="task-info">
      <template #header>
        <div class="card-header">
          <WorkflowStateTag :state="task.instance.current_state" />
          <span>{{ task.node_name }}</span>
        </div>
      </template>
      
      <!-- 业务信息 -->
      <BusinessInfo :data="businessData" />
    </el-card>
    
    <!-- 会签面板 -->
    <CounterSignPanel 
      v-if="isCounterSign" 
      :task="task" 
      :signs="signs" 
    />
    
    <!-- 审批操作 -->
    <el-card class="action-card">
      <ApproveForm 
        @approve="handleApprove"
        @reject="handleReject"
        @return="handleReturn"
      />
    </el-card>
    
    <!-- 流程时间线 -->
    <TimelineViewer :logs="timelineLogs" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getTaskDetail, approveTask, rejectTask, returnTask } from '@/api/modules/workflow'

const route = useRoute()
const taskId = route.params.id

const task = ref({})
const signs = ref([])
const timelineLogs = ref([])

const isCounterSign = computed(() => {
  return task.value.total_signers > 1
})

onMounted(async () => {
  const res = await getTaskDetail(taskId)
  task.value = res.data.task
  signs.value = res.data.signs || []
  timelineLogs.value = res.data.timeline || []
})

async function handleApprove(data: { opinion: string }) {
  await approveTask(taskId, data)
  // 返回待办列表
}

async function handleReject(data: { reason: string }) {
  await rejectTask(taskId, data)
}

async function handleReturn(data: { target_node: string; reason: string }) {
  await returnTask(taskId, data)
}
</script>
```

### 10.3 状态图组件

```vue
<!-- frontend/src/components/workflow/StateDiagram.vue -->
<template>
  <div class="state-diagram">
    <svg :viewBox="viewBox" class="diagram-svg">
      <!-- 节点 -->
      <g v-for="node in nodes" :key="node.key">
        <rect
          :x="node.x" :y="node.y"
          :width="120" :height="40"
          rx="6"
          :fill="nodeColor(node)"
          :stroke="nodeStroke(node)"
          stroke-width="2"
        />
        <text :x="node.x + 60" :y="node.y + 25" text-anchor="middle">
          {{ node.label }}
        </text>
        
        <!-- 当前状态高亮 -->
        <circle v-if="node.key === currentState" cx="{{ node.x + 110 }}" cy="{{ node.y }}" r="8" fill="#67c23a" />
      </g>
      
      <!-- 连线 -->
      <path
        v-for="edge in edges" :key="edge.from + '-' + edge.to"
        :d="edge.path"
        stroke="#dcdfe6"
        stroke-width="2"
        fill="none"
        marker-end="url(#arrowhead)"
      />
    </svg>
  </div>
</template>
```

---

## 11. 模板集成方案

### 11.1 脚手架初始化选项

```bash
$ pdd scaffold:init my-project

? 是否启用工作流引擎: Yes (推荐)
? 工作流模式: 状态机+审批节点 (推荐)
? 是否需要会签功能: Yes
? 是否需要条件分支: Yes
? 默认流程模板: asset_disposal (资产处置)
```

### 11.2 生成的额外文件

```
backend/app/core/
└── workflow/                    # ★ 新增：工作流引擎模块 (~10个文件)
    ├── __init__.py
    ├── engine.py
    ├── models.py
    ├── enums.py
    ├── exceptions.py
    ├── conditions.py
    ├── handlers/
    │   ├── __init__.py
    │   ├── approval_handler.py
    │   ├── counter_sign_handler.py
    │   └── return_handler.py
    └── services/
        └── workflow_service.py

backend/app/api/v1/
└── workflow.py                   # ★ 新增：工作流 API

backend/app/schemas/
└── workflow.py                   # ★ 新增：请求/响应 Schema

frontend/src/views/
└── workflow/                     # ★ 新增：工作流页面
    ├── index.vue
    ├── instance/
    │   ├── list.vue
    │   └── detail.vue
    └── task/
        ├── pending-list.vue
        ├── completed-list.vue
        └── handle.vue

frontend/src/components/
└── workflow/                     # ★ 新增：工作流组件
    ├── WorkflowStateTag.vue
    ├── TimelineViewer.vue
    ├── ApproveForm.vue
    ├── CounterSignPanel.vue
    └── StateDiagram.vue
```

### 11.3 CRUD 代码生成增强

生成的业务模块代码会自动：

1. **Model 层** - 增加 `workflow_instance_id` 字段关联流程
2. **Service 层** - 在创建/更新时触发工作流动作
3. **API 层** - 包装工作流操作接口
4. **前端表单** - 集成流程状态展示和操作按钮

---

## 12. 实现计划

### 12.1 开发阶段

| 阶段 | 内容 | 预计工作量 |
|------|------|-----------|
| **WF-Phase 1** | 数据模型 + Alembic 迁移 | 1 天 |
| **WF-Phase 2** | WorkflowEngine 核心 + 状态转换 | 2 天 |
| **WF-Phase 3** | 会签机制 + CounterSignHandler | 1.5 天 |
| **WF-Phase 4** | 退回/撤销机制 + ReturnHandler | 1 天 |
| **WF-Phase 5** | API 层 + Service 层 | 1.5 天 |
| **WF-Phase 6** | 前端待办/已办/审批页面 | 2 天 |
| **WF-Phase 7** | 流程状态图 + 时间线组件 | 1 天 |
| **WF-Phase 8** | 测试 + 文档 + 脚手架集成 | 1 天 |
| **合计** | | **11 天** |

### 12.2 里程碑

| 里程碑 | 内容 | 验收标准 |
|--------|------|----------|
| **M-WF1** | 引擎核心就绪 | 能启动流程、推进状态 |
| **M-WF2** | 审批流程完整 | 单人会签均可正常审批 |
| **M-WF3** | 条件分支可用 | 金额阈值分支正确 |
| **M-WF4** | 退回撤销可用 | 退回后可重新提交 |
| **M-WF5** | 前端完整 | 待办/已办/详情页可用 |

### 12.3 技术风险

| 风险 | 影响 | 应对策略 |
|------|------|----------|
| 并发冲突 | 同一任务被多人同时处理 | 乐观锁 + DB 级别唯一约束 |
| 循环退回 | 无限退回导致死循环 | 限制最大退回次数（如 3 次） |
| 状态不一致 | 引擎状态与数据库不同步 | 事务保证原子性；定期校验脚本 |
| 性能瓶颈 | 大量并发流程实例 | 分表（按月）；缓存热点查询 |

---

## 附录

### A. 数据库变更脚本

```sql
-- 流程定义表
CREATE TABLE workflow_defs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '流程名称',
    code VARCHAR(50) NOT NULL UNIQUE COMMENT '流程编码',
    version INT DEFAULT 1,
    category VARCHAR(50),
    config JSON NULL,
    is_active TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_category (category)
) ENGINE=InnoDB COMMENT='流程定义表';

-- 流程实例表
CREATE TABLE workflow_instances (
    id INT PRIMARY KEY AUTO_INCREMENT,
    def_id INT NOT NULL COMMENT '流程定义ID',
    business_key VARCHAR(100) NOT NULL COMMENT '业务单号',
    business_type VARCHAR(50) COMMENT '业务类型',
    current_state VARCHAR(30) DEFAULT 'draft' COMMENT '当前状态',
    previous_state VARCHAR(30) COMMENT '上一状态',
    started_at DATETIME NULL,
    finished_at DATETIME NULL,
    status VARCHAR(20) DEFAULT 'running',
    result JSON NULL,
    variables JSON NULL COMMENT '流程变量',
    created_by INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (def_id) REFERENCES workflow_defs(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_business_key (business_key),
    INDEX idx_status (status),
    INDEX idx_current_state (current_state),
    INDEX idx_created_by (created_by)
) ENGINE=InnoDB COMMENT='流程实例表';

-- 待办任务表
CREATE TABLE workflow_tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    instance_id INT NOT NULL,
    node_key VARCHAR(50) NOT NULL,
    node_name VARCHAR(100),
    node_type VARCHAR(20) DEFAULT 'approve',
    assignee_id INT NULL,
    assignee_role VARCHAR(50) NULL,
    assignee_dept INT NULL,
    sign_strategy VARCHAR(20) NULL,
    sign_ratio INT NULL,
    total_signers INT DEFAULT 1,
    signed_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    result VARCHAR(20) NULL,
    opinion TEXT NULL,
    comment TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    claimed_at DATETIME NULL,
    completed_at DATETIME NULL,
    due_at DATETIME NULL,
    FOREIGN KEY (instance_id) REFERENCES workflow_instances(id),
    FOREIGN KEY (assignee_id) REFERENCES users(id),
    INDEX idx_instance (instance_id),
    INDEX idx_assignee (assignee_id),
    INDEX idx_status (status),
    INDEX idx_due_at (due_at)
) ENGINE=InnoDB COMMENT='待办任务表';

-- 会签记录表
CREATE TABLE task_signs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    signer_id INT NOT NULL,
    result VARCHAR(20) NOT NULL COMMENT 'approved/rejected/abstained',
    opinion TEXT NULL,
    signed_at DATETIME NULL,
    FOREIGN KEY (task_id) REFERENCES workflow_tasks(id),
    FOREIGN KEY (signer_id) REFERENCES users(id),
    UNIQUE KEY uk_task_signer (task_id, signer_id)
) ENGINE=InnoDB COMMENT='会签记录表';

-- 执行日志表
CREATE TABLE workflow_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    instance_id INT NOT NULL,
    action VARCHAR(30) NOT NULL,
    from_state VARCHAR(30) NULL,
    to_state VARCHAR(30) NULL,
    operator_id INT NULL,
    operator_name VARCHAR(50) NULL,
    opinion TEXT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instance_id) REFERENCES workflow_instances(id),
    INDEX idx_instance (instance_id),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB COMMENT='工作流执行日志表';
```

### B. 配置文件模板

```yaml
# .pdd-scaffold/config.yaml 新增部分

workflow:
  enabled: true
  engine_mode: state_machine  # state_machine / petri_net
  
  default_flow: ASSET_DISPOSAL
  
  settings:
    max_return_times: 3           # 最大退回次数
    auto_claim: false             # 是否自动认领
    notify_on_create: true        # 创建任务时通知
    notify_on_overdue: true       # 超时提醒
    overdue_hours: 48             # 超时阈值(小时)
  
  thresholds:
    dept_approve_max_amount: 500000   # 部门审批上限
  
  sign_strategies:
    group_approval:
      strategy: ALL_PASS
      roles:
        - group_finance
        - group_legal
        - group_leader
```

### C. 参考实现

- [Python-FSM](https://github.com/garage-collector/python-fsm) - Python 状态机库
- [SpiffWorkflow](https://github.com/knipknap/SpiffWorkflow) - BPMN 引擎
- [ViewFlow](https://github.com/simplejson/DjangoFlow) - Django 工作流框架
- [若依工作流](https://gitee.com/y_project/RuoYi-Vue) - 内置工作流实现

---

**文档版本**: v1.0.0  
**最后更新**: 2026-04-12  
**关联文档**: 
- [01-pdd-scaffold-design.md](./01-pdd-scaffold-design.md) (脚手架主设计)
- [02-data-permission-design.md](./02-data-permission-design.md) (数据权限设计)
