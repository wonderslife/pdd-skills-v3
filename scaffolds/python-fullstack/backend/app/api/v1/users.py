"""
User Management API - CRUD endpoints for users
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.auth.dependencies import get_current_active_user, get_current_user
from app.database.database import get_db
from app.schemas.common import PaginatedResponse, ResponseModel, PaginationParams
from app.schemas.user import (
    UserCreate, UserUpdate, UserResponse, UserInfo,
)
from app.models.user import User
from app.api.v1.deps import get_pagination
from app.core.auth.security import get_password_hash
from app.exceptions import NotFoundError, ConflictError

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=ResponseModel[UserInfo])
async def get_me(current_user: dict = Depends(get_current_active_user)):
    """获取当前登录用户信息"""
    return ResponseModel(data=current_user)


@router.get("", response_model=ResponseModel[PaginatedResponse[UserResponse]])
async def list_users(
    pagination: PaginationParams = Depends(get_pagination),
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
):
    """用户列表（分页）"""
    query = select(User)
    count_query = select(func.count(User.id))

    if keyword:
        filter_expr = (
            User.name.ilike(f"%{keyword}%") |
            User.username.ilike(f"%{keyword}%") |
            User.email.ilike(f"%{keyword}%")
        )
        query = query.where(filter_expr)
        count_query = count_query.where(filter_expr)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.order_by(User.created_at.desc()).offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(query)
    users = result.scalars().all()

    return ResponseModel(data=PaginatedResponse(
        items=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=(total + pagination.page_size - 1) // pagination.page_size if total > 0 else 0,
    ))


@router.get("/{user_id}", response_model=ResponseModel[UserResponse])
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
):
    """获取用户详情"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundError(message=f"用户 {user_id} 不存在")
    return ResponseModel(data=UserResponse.model_validate(user))


@router.post("", response_model=ResponseModel[UserResponse], status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """创建用户"""
    existing = await db.execute(
        select(User).where((User.username == body.username) | (User.email == body.email))
    )
    if existing.scalar_one_or_none():
        raise ConflictError(message="用户名或邮箱已存在")

    user = User(
        username=body.username,
        name=body.name,
        email=body.email,
        phone=body.phone,
        password_hash=get_password_hash(body.password),
        org_id=body.org_id,
        is_superuser=body.is_superuser,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return ResponseModel(data=UserResponse.model_validate(user))


@router.put("/{user_id}", response_model=ResponseModel[UserResponse])
async def update_user(
    user_id: int,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
):
    """更新用户"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundError(message=f"用户 {user_id} 不存在")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return ResponseModel(data=UserResponse.model_validate(user))


@router.delete("/{user_id}", response_model=ResponseModel)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """删除用户"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundError(message=f"用户 {user_id} 不存在")

    await db.delete(user)
    await db.commit()
    return ResponseModel(message="删除成功")
