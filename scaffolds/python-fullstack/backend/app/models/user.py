"""
User Model - Core user entity with org relationship
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, 
    ForeignKey, Text, Index
)
from sqlalchemy.orm import relationship

from app.database.database import Base


class User(Base):
    """用户表"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True, comment="用户ID")
    username = Column(String(50), unique=True, nullable=False, index=True, comment="登录名")
    name = Column(String(100), nullable=False, default="", comment="真实姓名")
    email = Column(String(255), unique=True, nullable=True, index=True, comment="邮箱")
    phone = Column(String(20), unique=True, nullable=True, index=True, comment="手机号")
    avatar = Column(String(500), default="", comment="头像URL")
    password_hash = Column(String(255), nullable=False, comment="密码哈希")

    is_active = Column(Boolean, default=True, comment="是否启用")
    is_superuser = Column(Boolean, default=False, comment="是否超级管理员")
    union_id = Column(String(64), nullable=True, index=True, comment="跨平台统一标识")

    org_id = Column(Integer, ForeignKey("orgs.id"), nullable=True, index=True, comment="所属组织ID")
    dept_id = Column(Integer, nullable=True, index=True, comment="所属部门ID")

    last_login_at = Column(DateTime, nullable=True, comment="最后登录时间")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    # Relationships
    org = relationship("Org", back_populates="users", foreign_keys=[org_id])
    delegations = relationship("UserDelegation", back_populates="user", foreign_keys="UserDelegation.user_id")
    oauth_bindings = relationship("OAuthBinding", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_username", "username"),
        Index("idx_phone", "phone"),
    )

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username}, name={self.name})>"
