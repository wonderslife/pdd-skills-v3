"""
Dict Item Schemas - Request/Response models for Dict API
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class DictTypeOption(BaseModel):
    """字典类型选项"""
    id: int
    code: str
    name: str

    model_config = {"from_attributes": True}


class DictItemOption(BaseModel):
    """字典项选项（用于下拉Select组件）"""
    id: int
    dict_type_id: int
    label: str
    value: str

    model_config = {"from_attributes": True}


class DictItemGrouped(BaseModel):
    """按类型分组的字典数据"""
    code: str
    name: str
    items: List[DictItemOption]

    model_config = {"from_attributes": True}


class DictTypeResponse(BaseModel):
    """字典类型详情"""
    id: int
    code: str
    name: str
    description: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class DictItemResponse(BaseModel):
    """字典项详情"""
    id: int
    dict_type_id: int
    label: str
    value: str
    sort_order: int = 0
    is_active: bool = True
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
