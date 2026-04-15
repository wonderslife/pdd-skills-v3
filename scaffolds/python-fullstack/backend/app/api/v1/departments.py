"""
Department API - CRUD + Options endpoint for organization/department data
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.auth.dependencies import get_current_active_user
from app.database.database import get_db
from app.schemas.common import ResponseModel, PaginatedResponse, PaginationParams
from app.schemas.department import DepartmentResponse, DepartmentOption
from app.models.org import Org
from app.api.v1.deps import get_pagination

router = APIRouter(prefix="/departments", tags=["Departments"])


@router.get("/options", response_model=ResponseModel[List[DepartmentOption]])
async def get_department_options(
    level: Optional[int] = Query(None, description="组织层级筛选: 1=集团 2=子公司 3=部门"),
    is_active: Optional[bool] = Query(True, description="是否只返回启用的"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
):
    """获取部门下拉选项（轻量数据，用于Select组件）"""
    query = select(Org)
    if level is not None:
        query = query.where(Org.level >= level)
    if is_active is not None:
        query = query.where(Org.is_active == is_active)
    query = query.order_by(Org.sort_order, Org.id)

    result = await db.execute(query)
    orgs = result.scalars().all()
    return ResponseModel(data=[DepartmentOption.model_validate(o) for o in orgs])


@router.get("", response_model=ResponseModel[PaginatedResponse[DepartmentResponse]])
async def list_departments(
    pagination: PaginationParams = Depends(get_pagination),
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    level: Optional[int] = Query(None, description="组织层级筛选"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
):
    """部门列表（分页）"""
    from sqlalchemy import func

    query = select(Org)
    count_query = select(func.count(Org.id))

    if keyword:
        filter_expr = Org.name.ilike(f"%{keyword}%") | Org.code.ilike(f"%{keyword}%")
        query = query.where(filter_expr)
        count_query = count_query.where(filter_expr)
    if level is not None:
        query = query.where(Org.level == level)
        count_query = count_query.where(Org.level == level)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.order_by(Org.sort_order, Org.id).offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(query)
    orgs = result.scalars().all()

    return ResponseModel(data=PaginatedResponse(
        items=[DepartmentResponse.model_validate(o) for o in orgs],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=(total + pagination.page_size - 1) // pagination.page_size if total > 0 else 0,
    ))


@router.get("/{department_id}", response_model=ResponseModel[DepartmentResponse])
async def get_department(
    department_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
):
    """获取部门详情"""
    from app.exceptions import NotFoundError

    result = await db.execute(select(Org).where(Org.id == department_id))
    org = result.scalar_one_or_none()
    if not org:
        raise NotFoundError(message=f"部门 {department_id} 不存在")
    return ResponseModel(data=DepartmentResponse.model_validate(org))
