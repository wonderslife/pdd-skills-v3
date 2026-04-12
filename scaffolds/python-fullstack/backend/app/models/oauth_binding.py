"""
OAuth Binding Model - Third-party auth binding relationships
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship

from app.database.database import Base


class OAuthBinding(Base):
    """OAuth 绑定关系表"""
    __tablename__ = "oauth_bindings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True, comment="系统用户ID")
    provider = Column(String(30), nullable=False, comment="wechat/wecom/dingtalk/feishu/oidc")
    open_id = Column(String(128), nullable=False, comment="平台唯一标识")
    union_id = Column(String(128), nullable=True, index=True, comment="跨应用统一标识")
    nickname = Column(String(100), default="")
    avatar_url = Column(String(500), default="")
    raw_data = Column(Text, nullable=True, comment="原始数据备份 JSON")
    bound_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), comment="绑定时间")
    last_login_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), comment="最后登录时间")
    status = Column(Boolean, default=True, comment="1=正常 0=解绑")

    # Relationship
    user = relationship("User", back_populates="oauth_bindings")

    __table_args__ = (
        {"comment": "OAuth绑定关系表"},
    )

    def __repr__(self):
        return f"<OAuthBinding(user_id={self.user_id}, provider={self.provider})>"
