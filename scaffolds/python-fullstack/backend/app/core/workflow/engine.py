"""
Workflow Engine Core - State machine driven workflow engine
"""
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .enums import WorkflowState, SignStrategy, TaskStatus, InstanceStatus
from .models import (
    WorkflowDef, WorkflowInstance, WorkflowTask,
    TaskSign, WorkflowLog,
)
from .transition_rule import TransitionRule
from .exceptions import (
    InvalidTransitionError, TaskAlreadyCompletedError,
    InstanceNotFoundError, WorkflowDefNotFoundError,
)

logger = logging.getLogger(__name__)


class WorkflowEngine:
    """工作流引擎核心"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.transitions: Dict[str, TransitionRule] = {}
        self._register_default_transitions()

    def _register_default_transitions(self):
        self.register_transition(TransitionRule(
            action="submit",
            from_states=[WorkflowState.DRAFT.value, WorkflowState.EVAL_RETURNED.value],
            to_state=WorkflowState.PENDING_EVAL.value,
            create_task=True,
            task_config={"node_key": "assign_evaluator", "node_name": "分配评估"},
        ))
        
        self.register_transition(TransitionRule(
            action="start_eval",
            from_states=[WorkflowState.PENDING_EVAL.value],
            to_state=WorkflowState.EVALUATING.value,
            create_task=True,
            task_config={"node_key": "evaluate_asset", "node_name": "资产估值"},
        ))
        
        self.register_transition(TransitionRule(
            action="eval_complete",
            from_states=[WorkflowState.EVALUATING.value],
            to_state=WorkflowState.PENDING_APPROVE.value,
        ))
        
        self.register_transition(TransitionRule(
            action="eval_return",
            from_states=[WorkflowState.EVALUATING.value],
            to_state=WorkflowState.EVAL_RETURNED.value,
        ))

        self.register_transition(TransitionRule(
            action="dept_approve",
            from_states=[WorkflowState.PENDING_APPROVE.value],
            to_state=WorkflowState.DEPT_APPROVING.value,
            condition=lambda v: float(v.get("amount", 0) or 0) < 500000,
            condition_name="金额 < 50万",
            create_task=True,
            task_config={"node_key": "dept_approve", "node_name": "部门审批"},
        ))

        self.register_transition(TransitionRule(
            action="group_approve",
            from_states=[WorkflowState.PENDING_APPROVE.value],
            to_state=WorkflowState.GROUP_APPROVING.value,
            condition=lambda v: float(v.get("amount", 0) or 0) >= 500000,
            condition_name="金额 >= 50万",
            create_task=True,
            task_config={
                "node_key": "group_approve",
                "node_name": "集团审批",
                "sign_strategy": SignStrategy.ALL_PASS.value,
            },
        ))

        self.register_transition(TransitionRule(
            action="approve",
            from_states=[
                WorkflowState.DEPT_APPROVING.value,
                WorkflowState.GROUP_APPROVING.value,
            ],
            to_state=WorkflowState.APPROVED.value,
        ))

        self.register_transition(TransitionRule(
            action="approve_return",
            from_states=[
                WorkflowState.DEPT_APPROVING.value,
                WorkflowState.GROUP_APPROVING.value,
            ],
            to_state=WorkflowState.APPROVE_RETURNED.value,
        ))

        self.register_transition(TransitionRule(
            action="reject",
            from_states=[
                WorkflowState.DEPT_APPROVING.value,
                WorkflowState.GROUP_APPROVING.value,
                WorkflowState.PENDING_APPROVE.value,
            ],
            to_state=WorkflowState.REJECTED.value,
        ))

        self.register_transition(TransitionRule(
            action="start_execute",
            from_states=[WorkflowState.APPROVED.value],
            to_state=WorkflowState.EXECUTING.value,
            create_task=True,
            task_config={"node_key": "execute_disposal", "node_name": "执行处置"},
        ))

        self.register_transition(TransitionRule(
            action="execute_complete",
            from_states=[WorkflowState.EXECUTING.value],
            to_state=WorkflowState.EXEC_COMPLETED.value,
        ))

        self.register_transition(TransitionRule(
            action="complete",
            from_states=[WorkflowState.EXEC_COMPLETED.value],
            to_state=WorkflowState.COMPLETED.value,
        ))

        self.register_transition(TransitionRule(
            action="revoke",
            from_states=[
                WorkflowState.DRAFT.value,
                WorkflowState.PENDING_EVAL.value,
                WorkflowState.EVALUATING.value,
                WorkflowState.PENDING_APPROVE.value,
                WorkflowState.DEPT_APPROVING.value,
                WorkflowState.GROUP_APPROVING.value,
                WorkflowState.APPROVED.value,
            ],
            to_state=WorkflowState.REVOKED.value,
        ))

        self.register_transition(TransitionRule(
            action="cancel",
            from_states=[WorkflowState.DRAFT.value, WorkflowState.REJECTED.value],
            to_state=WorkflowState.CANCELLED.value,
        ))

    def register_transition(self, rule: TransitionRule):
        self.transitions[rule.action] = rule

    async def start_workflow(
        self,
        def_code: str,
        business_key: str,
        business_type: str,
        creator_id: int,
        variables: Optional[dict] = None,
    ) -> WorkflowInstance:
        result = await self.db.execute(
            select(WorkflowDef).where(
                WorkflowDef.code == def_code,
                WorkflowDef.is_active == True,
            )
        )
        wf_def = result.scalar_one_or_none()
        if not wf_def:
            raise WorkflowDefNotFoundError(f"流程定义 {def_code} 不存在")

        now = datetime.now(timezone.utc)
        instance = WorkflowInstance(
            def_id=wf_def.id,
            business_key=business_key,
            business_type=business_type,
            current_state=WorkflowState.DRAFT.value,
            status=InstanceStatus.RUNNING.value,
            variables=variables or {},
            created_by=creator_id,
            started_at=now,
        )
        self.db.add(instance)
        await self.db.flush()

        log = WorkflowLog(
            instance_id=instance.id,
            action="create",
            from_state=None,
            to_state=WorkflowState.DRAFT.value,
            operator_id=creator_id,
            timestamp=now,
        )
        self.db.add(log)
        await self.db.commit()
        await self.db.refresh(instance)
        return instance

    async def execute_action(
        self,
        instance: WorkflowInstance,
        action: str,
        operator_id: int,
        operator_name: str = "",
        opinion: Optional[str] = None,
        **kwargs,
    ) -> WorkflowInstance:
        rule = self.transitions.get(action)
        if not rule:
            raise InvalidTransitionError(f"未知动作: {action}")

        if instance.current_state not in rule.from_states:
            raise InvalidTransitionError(
                f"状态 '{instance.current_state}' 不允许执行 '{action}' 动作"
            )

        if rule.condition and not rule.check_condition(instance.variables or {}):
            raise InvalidTransitionError(f"条件不满足: {rule.condition_name}")

        old_state = instance.current_state
        instance.current_state = rule.to_state
        instance.previous_state = old_state
        
        if rule.to_state in (WorkflowState.COMPLETED.value, WorkflowState.REJECTED.value,
                              WorkflowState.REVOKED.value, WorkflowState.CANCELLED.value):
            instance.status = InstanceStatus.COMPLETED.value
            instance.finished_at = datetime.now(timezone.utc)

        log = WorkflowLog(
            instance_id=instance.id,
            action=action,
            from_state=old_state,
            to_state=rule.to_state,
            operator_id=operator_id,
            operator_name=operator_name,
            opinion=opinion,
            timestamp=datetime.now(timezone.utc),
        )
        self.db.add(log)

        if rule.create_task and rule.to_state not in (
            WorkflowState.APPROVED.value, WorkflowState.REJECTED.value,
            WorkflowState.COMPLETED.value,
        ):
            task = await self._create_task(instance, rule, **kwargs)
            await self.db.commit()
            await self.db.refresh(instance)
            return instance

        await self.db.commit()
        await self.db.refresh(instance)
        return instance

    async def approve_task(
        self,
        task: WorkflowTask,
        signer_id: int,
        operator_id: int,
        opinion: Optional[str] = None,
    ) -> WorkflowInstance:
        if task.status == TaskStatus.COMPLETED.value:
            raise TaskAlreadyCompletedError()

        sign = TaskSign(
            task_id=task.id,
            signer_id=signer_id,
            result="approved",
            opinion=opinion,
            signed_at=datetime.now(timezone.utc),
        )
        self.db.add(sign)
        task.signed_count += 1

        should_advance = await self._check_counter_sign(task)

        if should_advance:
            task.status = TaskStatus.COMPLETED.value
            task.result = "approved"
            task.completed_at = datetime.now(timezone.utc)
            
            instance = await self._get_instance(task.instance_id)
            return await self.execute_action(
                instance, "approve",
                operator_id=operator_id,
                opinion=opinion,
            )

        await self.db.commit()
        await self.db.refresh(task)
        return await self._get_instance(task.instance_id)

    async def reject_task(
        self,
        task: WorkflowTask,
        signer_id: int,
        operator_id: int,
        reason: Optional[str] = None,
    ) -> WorkflowInstance:
        if task.status == TaskStatus.COMPLETED.value:
            raise TaskAlreadyCompletedError()

        sign = TaskSign(
            task_id=task.id,
            signer_id=signer_id,
            result="rejected",
            opinion=reason,
            signed_at=datetime.now(timezone.utc),
        )
        self.db.add(sign)
        task.status = TaskStatus.COMPLETED.value
        task.result = "rejected"
        task.completed_at = datetime.now(timezone.utc)

        instance = await self._get_instance(task.instance_id)
        return await self.execute_action(
            instance, "reject",
            operator_id=operator_id,
            opinion=reason,
        )

    async def return_task(
        self,
        task: WorkflowTask,
        target_node: str,
        operator_id: int,
        reason: Optional[str] = None,
    ) -> WorkflowInstance:
        if task.status == TaskStatus.COMPLETED.value:
            raise TaskAlreadyCompletedError()

        task.status = TaskStatus.COMPLETED.value
        task.result = "returned"
        task.opinion = reason
        task.completed_at = datetime.now(timezone.utc)

        instance = await self._get_instance(task.instance_id)
        return await self.execute_action(
            instance, "approve_return",
            operator_id=operator_id,
            opinion=f"退回至: {target_node}. 原因: {reason}",
        )

    async def claim_task(self, task: WorkflowTask, user_id: int) -> WorkflowTask:
        if task.status != TaskStatus.PENDING.value:
            raise InvalidTransitionError("任务状态不允许认领")
        task.status = TaskStatus.CLAIMED.value
        task.assignee_id = user_id
        task.claimed_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def get_pending_tasks(self, user_id: int) -> List[WorkflowTask]:
        result = await self.db.execute(
            select(WorkflowTask).where(
                WorkflowTask.assignee_id == user_id,
                WorkflowTask.status.in_([TaskStatus.PENDING.value, TaskStatus.CLAIMED.value]),
            ).order_by(WorkflowTask.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_completed_tasks(self, user_id: int) -> List[WorkflowTask]:
        result = await self.db.execute(
            select(WorkflowTask).where(
                WorkflowTask.assignee_id == user_id,
                WorkflowTask.status == TaskStatus.COMPLETED.value,
            ).order_by(WorkflowTask.completed_at.desc())
        )
        return list(result.scalars().all())

    async def get_instance_timeline(self, instance_id: int) -> List[WorkflowLog]:
        result = await self.db.execute(
            select(WorkflowLog).where(
                WorkflowLog.instance_id == instance_id,
            ).order_by(WorkflowLog.timestamp.asc())
        )
        return list(result.scalars().all())

    async def _create_task(
        self, instance: WorkflowInstance, rule: TransitionRule, **kwargs
    ) -> WorkflowTask:
        config = rule.task_config
        task = WorkflowTask(
            instance_id=instance.id,
            node_key=config.get("node_key", ""),
            node_name=config.get("node_name", ""),
            node_type=config.get("node_type", "approve"),
            assignee_id=kwargs.get("assignee_id"),
            sign_strategy=config.get("sign_strategy"),
            total_signers=config.get("total_signers", 1),
            due_at=kwargs.get("due_at"),
            status=TaskStatus.PENDING.value,
        )
        self.db.add(task)
        await self.db.flush()
        return task

    async def _check_counter_sign(self, task: WorkflowTask) -> bool:
        strategy = task.sign_strategy
        if not strategy or strategy == SignStrategy.ALL_PASS.value:
            if task.signed_count >= task.total_signers:
                signs_result = await self.db.execute(
                    select(TaskSign).where(TaskSign.task_id == task.id)
                )
                signs = list(signs_result.scalars().all())
                return all(s.result == "approved" for s in signs)
            return False

        elif strategy == SignStrategy.ANY_PASS.value:
            approved = await self.db.execute(
                select(TaskSign).where(
                    TaskSign.task_id == task.id,
                    TaskSign.result == "approved",
                )
            )
            return len(list(approved.scalars().all())) > 0

        elif strategy == SignStrategy.RATIO_PASS.value:
            ratio = task.sign_ratio or 50
            required = max(1, (task.total_signers * ratio + 99) // 100)
            approved = await self.db.execute(
                select(TaskSign).where(
                    TaskSign.task_id == task.id,
                    TaskSign.result == "approved",
                )
            )
            return len(list(approved.scalars().all())) >= required

        elif strategy == SignStrategy.LEADER_PASS.value:
            if task.signed_count < task.total_signers:
                return False
            all_signed = await self.db.execute(
                select(TaskSign).where(TaskSign.task_id == task.id)
            )
            return len(list(all_signed.scalars().all())) > 0

        return task.signed_count >= task.total_signers

    async def _get_instance(self, instance_id: int) -> WorkflowInstance:
        result = await self.db.execute(
            select(WorkflowInstance).where(WorkflowInstance.id == instance_id)
        )
        instance = result.scalar_one_or_none()
        if not instance:
            raise InstanceNotFoundError()
        return instance
