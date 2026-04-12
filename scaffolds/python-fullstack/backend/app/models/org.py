"""
Organization Model - Tree structure for org hierarchy
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.database.database import Base


class Org(Base):
    """组织架构表（支持树形结构）"""
    __tablename__ = "orgs"

    id = Column(Integer, primary_key=True, autoincrement=True, comment="组织ID")
    name = Column(String(100), nullable=False, comment="组织名称")
    code = Column(String(50), unique=True, nullable=False, index=True, comment="组织编码")
    parent_id = Column(Integer, ForeignKey("orgs.id"), nullable=True, comment="父组织ID")
    level = Column(Integer, default=1, comment="层级: 1=集团 2=子公司 3=部门")
    path = Column(String(500), default="/", comment="树路径: /1/2/5/")
    sort_order = Column(Integer, default=0, comment="排序")
    is_active = Column(Boolean, default=True, comment="是否启用")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")

    parent = relationship("Org", remote_side=[id], backref="children")
    users = relationship("User", back_populates="org", foreign_keys="User.org_id")

    @property
    def is_group(self) -> bool:
        return self.level == 1

    @property
    def is_subsidiary(self) -> bool:
        return self.level == 2

    @property
    def is_department(self) -> bool:
        return self.level >= 3

    def __repr__(self):
        return f"<Org(id={self.id}, name={self.name}, level={self.level})>"
