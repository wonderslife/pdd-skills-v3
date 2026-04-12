"""
Workflow Data Models - SQLAlchemy ORM models for workflow engine
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey,
    Text, Boolean, Enum as SAEnum, JSON,
)
from sqlalchemy.orm import relationship

from app.database.database import Base


class WorkflowDef(Base):
    """流程定义表"""
    __tablename__ = "workflow_defs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, comment="流程名称")
    code = Column(String(50), unique=True, nullable=False, index=True, comment="流程编码")
    version = Column(Integer, default=1, comment="版本号")
    category = Column(String(50), comment="分类")
    config = Column(JSON, nullable=True, comment="流程配置JSON")
    is_active = Column(Boolean, default=True, comment="是否启用")
    created_at = Column(DateTime, default=datetime.utcnow)

    instances = relationship("WorkflowInstance", back_populates="definition")

    def __repr__(self):
        return f"<WorkflowDef(id={self.id}, name={self.name}, code={self.code})>"


class WorkflowInstance(Base):
    """流程实例表"""
    __tablename__ = "workflow_instances"

    id = Column(Integer, primary_key=True, autoincrement=True)
    def_id = Column(Integer, ForeignKey("workflow_defs.id"), nullable=False, comment="流程定义ID")
    business_key = Column(String(100), nullable=False, index=True, comment="业务单号")
    business_type = Column(String(50), comment="业务类型")

    current_state = Column(String(30), default="draft", comment="当前状态")
    previous_state = Column(String(30), comment="上一状态")

    started_at = Column(DateTime, nullable=True, comment="开始时间")
    finished_at = Column(DateTime, nullable=True, comment="结束时间")
    status = Column(String(20), default="running", comment="状态: running/completed/cancelled")
    result = Column(JSON, nullable=True, comment="结果数据")
    variables = Column(JSON, nullable=True, comment="流程变量")

    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, comment="发起人")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    definition = relationship("WorkflowDef", back_populates="instances")
    tasks = relationship("WorkflowTask", back_populates="instance", cascade="all, delete-orphan")
    logs = relationship("WorkflowLog", back_populates="instance", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<WorkflowInstance(id={self.id}, business_key={self.business_key}, state={self.current_state})>"


class WorkflowTask(Base):
    """待办任务表"""
    __tablename__ = "workflow_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    instance_id = Column(Integer, ForeignKey("workflow_instances.id"), nullable=False, index=True)

    node_key = Column(String(50), nullable=False, comment="节点标识")
    node_name = Column(String(100), comment="节点名称")
    node_type = Column(String(20), default="approve", comment="节点类型")

    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True, comment="审批人ID")
    assignee_role = Column(String(50), nullable=True, comment="审批角色")
    assignee_dept = Column(Integer, nullable=True, comment="审批部门")

    sign_strategy = Column(String(20), nullable=True, comment="会签策略")
    sign_ratio = Column(Integer, nullable=True, comment="通过比例(%)")
    total_signers = Column(Integer, default=1, comment="总会签人数")
    signed_count = Column(Integer, default=0, comment="已签人数")

    status = Column(String(20), default="pending", comment="任务状态")
    result = Column(String(20), nullable=True, comment="结果: approved/rejected/abstained")
    opinion = Column(Text, nullable=True, comment="审批意见")
    comment = Column(Text, nullable=True, comment="备注")

    created_at = Column(DateTime, default=datetime.utcnow)
    claimed_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    due_at = Column(DateTime, nullable=True, comment="截止时间")

    instance = relationship("WorkflowInstance", back_populates="tasks")
    signs = relationship("TaskSign", back_populates="task", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<WorkflowTask(id={self.id}, node={self.node_name}, status={self.status})>"


class TaskSign(Base):
    """会签记录表"""
    __tablename__ = "task_signs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("workflow_tasks.id"), nullable=False, comment="任务ID")
    signer_id = Column(Integer, ForeignKey("users.id"), nullable=False, comment="签署人ID")
    result = Column(String(20), nullable=False, comment="approved/rejected/abstained")
    opinion = Column(Text, nullable=True, comment="意见")
    signed_at = Column(DateTime, nullable=True, comment="签署时间")

    task = relationship("WorkflowTask", back_populates="signs")

    def __repr__(self):
        return f"<TaskSign(task_id={self.task_id}, signer_id={self.signer_id}, result={self.result})>"


class WorkflowLog(Base):
    """执行日志表"""
    __tablename__ = "workflow_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    instance_id = Column(Integer, ForeignKey("workflow_instances.id"), nullable=False, index=True)
    action = Column(String(30), nullable=False, comment="动作: submit/approve/reject/return/revoke")
    from_state = Column(String(30), nullable=True, comment="源状态")
    to_state = Column(String(30), nullable=True, comment="目标状态")
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=True, comment="操作人")
    operator_name = Column(String(50), nullable=True, comment="操作人姓名")
    opinion = Column(Text, nullable=True, comment="操作意见")
    timestamp = Column(DateTime, default=datetime.utcnow, comment="操作时间")

    instance = relationship("WorkflowInstance", back_populates="logs")

    def __repr__(self):
        return f"<WorkflowLog(instance_id={self.instance_id}, action={self.action})>"
