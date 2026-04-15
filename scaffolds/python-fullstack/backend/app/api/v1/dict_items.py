"""
Dict Item API - CRUD + Options endpoint for dictionary data
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.auth.dependencies import get_current_active_user
from app.database.database import get_db
from app.schemas.common import ResponseModel
from app.schemas.dict_item import DictItemOption, DictItemGrouped, DictTypeOption
from app.models.dict_item import DictType, DictItem

router = APIRouter(prefix="/dict-items", tags=["Dictionary"])


@router.get("/options", response_model=ResponseModel[List[DictItemOption]])
async def get_dict_options(
    dict_type: Optional[str] = Query(None, description="字典类型编码筛选(如asset_category)"),
    is_active: Optional[bool] = Query(True, description="是否只返回启用的"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
):
    """获取字典项下拉选项（轻量数据，用于Select组件）"""
    query = select(DictItem)
    if is_active is not None:
        query = query.where(DictItem.is_active == is_active)
    if dict_type:
        dict_type_sub = select(DictType.id).where(DictType.code == dict_type)
        query = query.where(DictItem.dict_type_id.in_(dict_type_sub))
    query = query.order_by(DictItem.sort_order, DictItem.id)

    result = await db.execute(query)
    items = result.scalars().all()
    return ResponseModel(data=[DictItemOption.model_validate(i) for i in items])


@router.get("/grouped", response_model=ResponseModel[List[DictItemGrouped]])
async def get_dict_grouped(
    is_active: Optional[bool] = Query(True, description="是否只返回启用的"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
):
    """获取按类型分组的字典数据（一次请求获取所有字典）"""
    query = select(DictType).options(selectinload(DictType.items))
    if is_active is not None:
        query = query.where(DictType.is_active == is_active)
    query = query.order_by(DictType.sort_order, DictType.id)

    result = await db.execute(query)
    dict_types = result.scalars().all()

    grouped = []
    for dt in dict_types:
        items = [DictItemOption.model_validate(i) for i in dt.items if not is_active or i.is_active]
        grouped.append(DictItemGrouped(code=dt.code, name=dt.name, items=items))

    return ResponseModel(data=grouped)


@router.get("/types", response_model=ResponseModel[List[DictTypeOption]])
async def get_dict_types(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
):
    """获取字典类型列表"""
    query = select(DictType).where(DictType.is_active == True).order_by(DictType.sort_order)
    result = await db.execute(query)
    types = result.scalars().all()
    return ResponseModel(data=[DictTypeOption.model_validate(t) for t in types])
