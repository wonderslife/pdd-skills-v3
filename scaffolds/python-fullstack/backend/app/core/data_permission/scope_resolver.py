"""
ScopeResolver - Resolves data permission scope for a given user

负责:
1. 解析用户的基础权限（来自角色和组织归属）
2. 解析活跃的借调/委派权限
3. 合并生成最终的 DataContext
"""
from typing import List, Set, Optional
from datetime import datetime
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.models.delegation import UserDelegation, DelegationStatus, DelegationScope
from app.models.org import Org
from .context import DataContext, ScopeType

logger = logging.getLogger(__name__)


class ScopeResolver:
    """数据权限范围解析器"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def resolve(self, user_id: int) -> DataContext:
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError(f"User {user_id} not found")

        context = DataContext(
            user_id=user.id,
            username=user.username,
            primary_org_id=user.org_id,
            is_superuser=getattr(user, 'is_superuser', False),
        )

        if context.is_superuser:
            context.scope_type = ScopeType.ALL
            return context

        if user.org_id:
            context.org_ids.add(user.org_id)
            parent_orgs = await self._get_parent_orgs(user.org_id)
            context.org_ids.update(parent_orgs)

        role_scope = await self._resolve_role_scope(user_id)
        active_delegations = await self._get_active_delegations(user_id)

        if active_delegations:
            await self._merge_delegation_permissions(context, active_delegations)
        else:
            context.scope_type = role_scope or ScopeType.DEPT

        logger.info(
            f"用户 {user_id} 数据权限解析完成: "
            f"org_ids={context.org_ids}, scope={context.scope_type.value}, "
            f"is_delegated={context.is_delegated}"
        )
        return context

    async def _resolve_role_scope(self, user_id: int) -> Optional[ScopeType]:
        from app.models.role import Role, user_roles
        
        result = await self.db.execute(
            select(Role).join(user_roles).where(
                user_roles.c.user_id == user_id,
                Role.is_active == True,
            ).order_by(Role.data_scope.desc()).limit(1)
        )
        role = result.scalar_one_or_none()

        if role and role.data_scope:
            try:
                return ScopeType(role.data_scope.upper())
            except ValueError:
                pass
        return ScopeType.DEPT

    async def _get_active_delegations(self, user_id: int) -> List[UserDelegation]:
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(UserDelegation).where(
                UserDelegation.user_id == user_id,
                UserDelegation.status == DelegationStatus.ACTIVE,
                UserDelegation.start_time <= now,
                UserDelegation.end_time >= now,
            )
        )
        return list(result.scalars().all())

    async def _merge_delegation_permissions(
        self, context: DataContext, delegations: List[UserDelegation]
    ):
        context.is_delegated = True
        context.delegation_sources = []

        for delegation in delegations:
            source_desc = f"借调至:org_{delegation.target_org_id}"
            context.delegation_sources.append(source_desc)

            if delegation.scope_type == DelegationScope.SAME_AS_TARGET:
                child_org_ids = await self._get_org_tree(delegation.target_org_id)
                context.org_ids.update(child_org_ids)
            elif delegation.scope_type == DelegationScope.SPECIFIC_ORGS:
                custom_orgs = delegation.get_custom_org_ids()
                context.org_ids.update(custom_orgs)
            elif delegation.scope_type == DelegationScope.CUSTOM:
                custom_orgs = delegation.get_custom_org_ids()
                custom_depts = delegation.get_custom_dept_ids()
                if custom_orgs:
                    context.org_ids.update(custom_orgs)
                if custom_depts:
                    context.dept_ids.update(custom_depts)

        context.scope_type = ScopeType.DELEGATED

    async def _get_parent_orgs(self, org_id: int) -> Set[int]:
        result = await self.db.execute(select(Org).where(Org.id == org_id))
        org = result.scalar_one_or_none()
        if not org or not org.path:
            return set()
        path_parts = [p for p in org.path.split('/') if p.isdigit()]
        return set(int(p) for p in path_parts)

    async def _get_org_tree(self, org_id: int) -> Set[int]:
        result = await self.db.execute(select(Org).where(Org.id == org_id))
        org = result.scalar_one_or_none()
        if not org:
            return {org_id}
        children_result = await self.db.execute(
            select(Org.id).where(Org.path.like(f"{org.path}%"))
        )
        return {row[0] for row in children_result.all()}
