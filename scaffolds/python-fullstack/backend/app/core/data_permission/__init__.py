"""
Data Permission Module - Enterprise-level data isolation engine

核心能力:
- 组织级数据隔离 (org_id 过滤)
- 部门级数据隔离 (dept_id 过滤)
- 个人数据隔离 (created_by 过滤)
- 借调/委派权限合并 (UNION 策略)
- SQL 拦截器透明过滤
- @DataPermission 装饰器覆盖
"""
from .enums import ScopeType, DEFAULT_DATA_PERMISSION_RULES
from .context import DataContext
from .engine import DataPermissionEngine
from .scope_resolver import ScopeResolver
from .decorator import DataPermission
from .config import DATA_PERMISSION_CONFIG

__all__ = [
    "ScopeType",
    "DataContext",
    "DataPermissionEngine",
    "ScopeResolver",
    "DataPermission",
    "DEFAULT_DATA_PERMISSION_RULES",
    "DATA_PERMISSION_CONFIG",
]
