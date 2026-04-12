"""
Workflow Engine - State Machine + Approval Node workflow engine

核心能力:
- 多级顺序审批 (状态转换链)
- 会签/并行审批 (TaskSign + SignStrategy)
- 条件分支 (TransitionRule.condition)
- 退回与撤销 (return/revoke/cancel)
- 待办任务中心

设计理念:
- 状态机驱动: 当前状态 + 动作 → 新状态
- 规则可注册: 通过 register_transition() 注册转换规则
- 条件可插拔: 每个 rule 可以有 condition 函数
- 任务自动生成: 规则中配置 create_task=True 自动创建待办
"""
from .enums import (
    WorkflowState, NodeType, SignStrategy,
    TaskStatus, InstanceStatus,
)
from .engine import WorkflowEngine, TransitionRule
from .models import (
    WorkflowDef, WorkflowInstance, WorkflowTask,
    TaskSign, WorkflowLog,
)

__all__ = [
    "WorkflowState",
    "NodeType",
    "SignStrategy",
    "TaskStatus",
    "InstanceStatus",
    "WorkflowEngine",
    "TransitionRule",
    "WorkflowDef",
    "WorkflowInstance",
    "WorkflowTask",
    "TaskSign",
    "WorkflowLog",
]
