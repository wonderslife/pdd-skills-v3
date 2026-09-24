"""
Workflow Engine Enumerations - States, Types, Strategies
"""
from enum import Enum


class WorkflowState(str, Enum):
    """工作流状态 (15 states)"""

    DRAFT = "draft"

    PENDING_EVAL = "pending_eval"
    EVALUATING = "evaluating"
    EVAL_RETURNED = "eval_returned"

    PENDING_APPROVE = "pending_approve"
    DEPT_APPROVING = "dept_approving"
    GROUP_APPROVING = "group_approving"
    APPROVE_RETURNED = "approve_returned"

    APPROVED = "approved"
    EXECUTING = "executing"
    EXEC_COMPLETED = "exec_completed"

    COMPLETED = "completed"
    REJECTED = "rejected"
    REVOKED = "revoked"
    CANCELLED = "cancelled"


class NodeType(str, Enum):
    """节点类型"""
    START = "start"
    END = "end"
    APPROVE = "approve"
    COUNTER_SIGN = "counter_sign"
    CONDITION = "condition"
    NOTIFY = "notify"


class SignStrategy(str, Enum):
    """会签策略"""
    ALL_PASS = "all_pass"
    ANY_PASS = "any_pass"
    RATIO_PASS = "ratio_pass"
    LEADER_PASS = "leader_pass"


class TaskStatus(str, Enum):
    """任务状态"""
    PENDING = "pending"
    CLAIMED = "claimed"
    COMPLETED = "completed"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"


class InstanceStatus(str, Enum):
    """实例状态"""
    RUNNING = "running"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
