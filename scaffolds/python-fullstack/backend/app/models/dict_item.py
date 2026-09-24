"""
Dict Item Model - Dictionary data for dropdowns and enums
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship

from app.database.database import Base


class DictType(Base):
    """字典类型表"""
    __tablename__ = "dict_types"

    id = Column(Integer, primary_key=True, autoincrement=True, comment="字典类型ID")
    code = Column(String(50), unique=True, nullable=False, index=True, comment="字典编码(如asset_category)")
    name = Column(String(100), nullable=False, comment="字典名称(如资产类别)")
    description = Column(Text, nullable=True, comment="描述")
    is_active = Column(Boolean, default=True, comment="是否启用")
    sort_order = Column(Integer, default=0, comment="排序")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), comment="创建时间")

    items = relationship("DictItem", back_populates="dict_type", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<DictType(id={self.id}, code={self.code}, name={self.name})>"


class DictItem(Base):
    """字典数据项表"""
    __tablename__ = "dict_items"

    id = Column(Integer, primary_key=True, autoincrement=True, comment="字典项ID")
    dict_type_id = Column(Integer, nullable=False, index=True, comment="字典类型ID")
    label = Column(String(100), nullable=False, comment="显示名称(中文)")
    value = Column(String(50), nullable=False, comment="编码值(英文snake_case)")
    sort_order = Column(Integer, default=0, comment="排序")
    is_active = Column(Boolean, default=True, comment="是否启用")
    description = Column(Text, nullable=True, comment="描述")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), comment="创建时间")

    dict_type = relationship("DictType", back_populates="items")

    def __repr__(self):
        return f"<DictItem(id={self.id}, label={self.label}, value={self.value})>"
