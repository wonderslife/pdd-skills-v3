"""
User Binding Service - Auto-bind users across OAuth platforms

绑定策略 (按优先级):
1. 已有 open_id + provider 的直接绑定 → 返回已存在用户
2. 有 union_id 且匹配其他绑定的 union_id → 关联到同一用户
3. 有手机号且系统中存在该手机号的用户 → 关联
4. 以上都不匹配 → 创建新用户 + 新绑定
"""
from typing import Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.models.oauth_binding import OAuthBinding
from ..base import OAuthUser


class UserBindingService:
    """用户绑定服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def bind_or_create(self, oauth_user: OAuthUser) -> Tuple[User, bool]:
        """
        绑定或创建用户
        
        Returns:
            (user, is_new_user)
        """
        binding = await self._find_by_provider(oauth_user)
        if binding:
            user = await self.db.get(User, binding.user_id)
            await self._update_binding_time(binding)
            return user, False

        if oauth_user.union_id:
            existing_binding = await self._find_by_union_id(oauth_user.union_id)
            if existing_binding:
                new_binding = await self._create_binding(existing_binding.user_id, oauth_user)
                user = await self.db.get(User, existing_binding.user_id)
                return user, False

        if oauth_user.phone:
            existing_user = await self._find_by_phone(oauth_user.phone)
            if existing_user:
                await self._create_binding(existing_user.id, oauth_user)
                return existing_user, False

        user, new_binding = await self._create_new_user_and_binding(oauth_user)
        return user, True

    async def _find_by_provider(self, oauth_user: OAuthUser) -> OAuthBinding | None:
        result = await self.db.execute(
            select(OAuthBinding).where(
                OAuthBinding.provider == oauth_user.provider,
                OAuthBinding.open_id == oauth_user.open_id,
                OAuthBinding.status == True,
            )
        )
        return result.scalar_one_or_none()

    async def _find_by_union_id(self, union_id: str) -> OAuthBinding | None:
        result = await self.db.execute(
            select(OAuthBinding).where(
                OAuthBinding.union_id == union_id,
                OAuthBinding.status == True,
            )
        )
        return result.scalar_one_or_none()

    async def _find_by_phone(self, phone: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.phone == phone)
        )
        return result.scalar_one_or_none()

    async def _create_binding(self, user_id: int, oauth_user: OAuthUser) -> OAuthBinding:
        binding = OAuthBinding(
            user_id=user_id,
            provider=oauth_user.provider,
            open_id=oauth_user.open_id,
            union_id=oauth_user.union_id,
            nickname=oauth_user.name,
            avatar_url=oauth_user.avatar,
        )
        self.db.add(binding)
        await self.db.commit()
        return binding

    async def _update_binding_time(self, binding: OAuthBinding):
        from datetime import datetime
        binding.last_login_at = datetime.utcnow()
        await self.db.commit()

    async def _create_new_user_and_binding(self, oauth_user: OAuthUser) -> Tuple[User, OAuthBinding]:
        user = User(
            username=f"{oauth_user.provider}_{oauth_user.open_id}",
            name=oauth_user.name,
            avatar=oauth_user.avatar,
            phone=oauth_user.phone,
            email=oauth_user.email,
            is_active=True,
        )
        self.db.add(user)
        await self.db.flush()

        binding = await self._create_binding(user.id, oauth_user)
        await self.db.commit()
        return user, binding
