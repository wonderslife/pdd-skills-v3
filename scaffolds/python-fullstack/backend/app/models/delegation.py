"""
User Delegation Model - Temporary permission delegation (借调/委派)
"""
from datetime import datetime, timezone
from enum import Enum as SAEnum
from sqlalchemy import (
    Column, Integer, String, DateTime, 
    ForeignKey, SAEnum as SqlSAEnum, Text
)
from sqlalchemy.orm import relationship
import json

from app.database.database import Base


class DelegationStatus(str, Enum):
    """借调状态枚举"""
    PENDING = "pending"
    APPROVED = "approved"
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"
    REJECTED = "rejected"


class DelegationScope(str, Enum):
    """借调数据范围类型"""
    SAME_AS_TARGET = "same_as_target"
    CUSTOM = "custom"
    SPECIFIC_ORGS = "specific_orgs"


class UserDelegation(Base):
    """用户借调/委派记录"""
    __tablename__ = "user_delegations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True, comment="被借调人")
    target_org_id = Column(Integer, ForeignKey("orgs.id"), nullable=False, comment="目标组织")

    scope_type = Column(SqlSAEnum(DelegationScope), default=DelegationScope.SAME_AS_TARGET, comment="范围类型")
    custom_org_ids = Column(Text, nullable=True, comment='自定义组织IDs JSON')
    custom_dept_ids = Column(Text, nullable=True, comment='自定义部门IDs JSON')

    start_time = Column(DateTime, nullable=False, comment="开始时间")
    end_time = Column(DateTime, nullable=False, comment="结束时间")

    status = Column(SqlSAEnum(DelegationStatus), default=DelegationStatus.PENDING, comment="状态")
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True, comment="审批人")
    approved_at = Column(DateTime, nullable=True, comment="审批时间")
    rejection_reason = Column(String(500), nullable=True, comment="拒绝原因")
    reason = Column(String(500), nullable=True, comment="借调原因")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, comment="创建人")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), comment="创建时间")
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), comment="更新时间")

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="delegations")
    target_org = relationship("Org", foreign_keys=[target_org_id])
    approver = relationship("User", foreign_keys=[approved_by])

    @property
    def is_currently_active(self) -> bool:
        now = datetime.now(timezone.utc)
        return (
            self.status == DelegationStatus.ACTIVE and
            self.start_time <= now <= self.end_time
        )

    def get_custom_org_ids(self) -> list:
        if self.custom_org_ids:
            try:
                return json.loads(self.custom_org_ids)
            except (json.JSONDecodeError, TypeError):
                return []
        return []

    def get_custom_dept_ids(self) -> list:
        if self.custom_dept_ids:
            try:
                return json.loads(self.custom_dept_ids)
            except (json.JSONDecodeError, TypeError):
                return []
        return []

    def __repr__(self):
        return f"<UserDelegation(id={self.id}, user_id={self.user_id}, status={self.status.value})>"
