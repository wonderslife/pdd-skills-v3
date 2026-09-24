"""
Department Schemas - Request/Response models for Department API
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class DepartmentOption(BaseModel):
    """轻量部门选项（用于下拉Select组件）"""
    id: int
    name: str
    code: str
    level: int = 1
    parent_id: Optional[int] = None

    model_config = {"from_attributes": True}


class DepartmentResponse(BaseModel):
    """部门详情响应"""
    id: int
    name: str
    code: str
    parent_id: Optional[int] = None
    level: int = 1
    path: str = "/"
    sort_order: int = 0
    is_active: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}
