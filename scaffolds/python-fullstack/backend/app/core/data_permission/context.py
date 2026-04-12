"""
DataContext - Data permission context for each request

每次请求构建一次，包含当前用户的完整数据权限信息。
通过 SQLAlchemy Session 传递给拦截器使用。
"""
from dataclasses import dataclass, field
from typing import Optional, Set, List
from .enums import ScopeType


@dataclass
class DataContext:
    """数据权限上下文"""

    user_id: int
    username: str = ""

    primary_org_id: Optional[int] = None
    org_ids: Set[int] = field(default_factory=set)

    primary_dept_id: Optional[int] = None
    dept_ids: Set[int] = field(default_factory=set)

    scope_type: ScopeType = ScopeType.SELF

    is_delegated: bool = False
    delegation_sources: List[str] = field(default_factory=list)

    custom_sql: Optional[str] = None

    is_superuser: bool = False
    bypass_filter: bool = False

    def get_org_filter_sql(self, column: str = "org_id") -> str:
        if self.is_superuser or self.scope_type == ScopeType.ALL:
            return ""
        if self.bypass_filter:
            return ""
        if self.scope_type == ScopeType.CUSTOM:
            return self.custom_sql or ""
        if self.org_ids:
            ids = ",".join(str(i) for i in sorted(self.org_ids))
            return f"{column} IN ({ids})"
        return f"{column} = -1"

    def get_dept_filter_sql(self, column: str = "dept_id") -> str:
        if not self.dept_ids:
            return f"{column} = -1"
        ids = ",".join(str(i) for i in sorted(self.dept_ids))
        return f"{column} IN ({ids})"

    def get_self_filter_sql(self, column: str = "created_by") -> str:
        return f"{column} = {self.user_id}"

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "username": self.username,
            "primary_org_id": self.primary_org_id,
            "org_ids": list(self.org_ids),
            "dept_ids": list(self.dept_ids),
            "scope_type": self.scope_type.value,
            "is_delegated": self.is_delegated,
            "delegation_sources": self.delegation_sources,
            "is_superuser": self.is_superuser,
        }
