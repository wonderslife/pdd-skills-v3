"""
Data Permission Enumerations & Default Configuration
"""
from enum import Enum


class ScopeType(str, Enum):
    """
    数据范围类型
    
    决定 SQL WHERE 条件的生成方式
    """
    ALL = "ALL"
    DEPT = "DEPT"
    DEPT_AND_CHILD = "DEPT_AND_CHILD"
    DEPT_AND_PARENT = "DEPT_AND_PARENT"
    SELF = "SELF"
    CUSTOM = "CUSTOM"
    DELEGATED = "DELEGATED"


# 默认规则配置 - 表名 -> {权限字段, 权限类型}
DEFAULT_DATA_PERMISSION_RULES = {
    "users": {"column": "org_id", "scope": "org"},
    "orders": {"column": "org_id", "scope": "org"},
    "customers": {"column": "org_id", "scope": "org"},
    "products": {"column": "org_id", "scope": "org"},
    "contracts": {"column": "dept_id", "scope": "dept"},
    "leave_requests": {"column": "created_by", "scope": "self"},
}
