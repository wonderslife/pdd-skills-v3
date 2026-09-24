# 数据权限 (Data Permission) 设计文档

> **PDD-Scaffold 脚手架 - 企业级数据权限模块**

**版本**: v1.0.0  
**日期**: 2026-04-12  
**状态**: 设计完成，待实现

---

## 目录

- [1. 功能概述](#1-功能概述)
- [2. 需求场景](#2-需求场景)
- [3. 技术架构](#3-技术架构)
- [4. 核心模型设计](#4-核心模型设计)
- [5. SQL 拦截器引擎](#5-sql-拦截器引擎)
- [6. 借调权限合并机制](#6-借调权限合并机制)
- [7. 前端权限配置](#7-前端权限配置)
- [8. 模板集成方案](#8-模板集成方案)
- [9. 实现计划](#9-实现计划)

---

## 1. 功能概述

### 1.1 什么是数据权限

数据权限（Data Permission）是指 **控制用户可以看到哪些数据** 的能力。与功能权限（能否访问某个接口）不同，数据权限关注的是 **同一接口返回的数据范围**。

### 1.2 典型场景

| 场景 | 描述 | 示例 |
|------|------|------|
| **组织隔离** | 子公司用户只能看本公司数据 | 子公司A的员工看不到子公司B的订单 |
| **部门隔离** | 部门员工只能看本部门数据 | 销售部只能看销售部的客户 |
| **个人隔离** | 普通员工只能看自己的数据 | 员工只能查看自己提交的请假单 |
| **借调/委派** | 临时获得其他组织的数据权限 | 子公司人员借调到集团期间可看到集团数据 |
| **跨级查看** | 管理员可看到下级所有数据 | 集团管理员可看到所有子公司的数据 |

### 1.3 设计目标

- ✅ **透明过滤** - 对业务代码几乎无侵入
- ✅ **灵活配置** - 支持多种粒度和组合策略
- ✅ **借调支持** - 支持临时权限授予和自动过期
- ✅ **高性能** - SQL 层面过滤，避免全量查询后再过滤
- ✅ **可调试** - 清晰的日志和上下文信息

---

## 2. 需求场景

### 2.1 核心业务场景

#### 场景 A：子公司数据隔离

```
集团总部
├── 子公司A（北京）
│   ├── 员工张三 → 只能看到北京公司的订单、客户等数据
│   └── 经理李四 → 可以看到北京公司全部数据 + 下属部门数据
├── 子公司B（上海）
│   └── 员工王五 → 只能看到上海公司的数据
└── 集团管理员 → 可以看到所有子公司的数据
```

#### 场景 B：借调权限叠加（关键需求）

```
时间线:
2026-04-01: 张三（子公司A）被借调到集团总部工作
2026-06-30: 借调结束

在此期间:
┌─────────────────────────────────────────────┐
│  张三的数据权限 = 基础权限 ∪ 借调权限        │
│                                             │
│  基础权限: org_id IN {子公司A}              │
│  借调权限: org_id IN {集团, 子公司B, C}     │
│                                             │
│  最终权限: org_id IN {A, 集团, B, C}       │
│  scope_type = "DELEGATED"                   │
└─────────────────────────────────────────────┘
```

### 2.2 功能需求清单

| 编号 | 需求 | 优先级 | 说明 |
|------|------|--------|------|
| DP-001 | 组织级数据隔离 | P0 | 按 org_id 过滤 |
| DP-002 | 部门级数据隔离 | P0 | 按 dept_id 过滤 |
| DP-003 | 个人级数据隔离 | P1 | 按 created_by 过滤 |
| DP-004 | 自定义数据范围 | P1 | 自定义 SQL 条件 |
| DP-005 | 借调/委派管理 | P0 | 临时权限授予 |
| DP-006 | 权限自动合并 | P0 | UNION 多个数据范围 |
| DP-007 | 权限到期自动失效 | P0 | 时间范围控制 |
| DP-008 | 权限可撤销 | P1 | 提前结束借调 |
| DP-009 | SQL 拦截器 | P0 | 透明过滤 |
| DP-010 | 注解覆盖 | P1 | 特殊场景自定义 |

---

## 3. 技术架构

### 3.1 架构选型：混合智能模式

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    数据权限架构总览                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    DataPermissionEngine (核心)                    │   │
│  │                                                                    │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │   │
│  │  │ ScopeResolver│  │ SqlBuilder   │  │ RuleRegistry │            │   │
│  │  │ 范围解析器    │  │ 条件构建器    │  │ 规则注册中心  │            │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│              ┌───────────────┼───────────────┐                          │
│              ▼               ▼               ▼                          │
│  ┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐           │
│  │ Session Events   │ │ @DataPerm    │ │ Config Rules     │           │
│  │ (SQLAlchemy事件)  │ │ 装饰器覆盖    │ │ 配置文件默认规则  │           │
│  └──────────────────┘ └──────────────┘ └──────────────────┘           │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    DelegationManager (借调管理)                    │   │
│  │                                                                    │   │
│  │  • 创建借调申请  • 审批流程  • 自动过期  • 权限合并               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 三种工作模式

| 模式 | 触发方式 | 适用场景 | 侵入性 |
|------|----------|----------|--------|
| **全局自动模式** | 配置文件定义规则 | 有 `org_id` 字段的表统一过滤 | 零侵入 |
| **注解覆盖模式** | `@DataPermission` 装饰器 | 特殊场景（统计、导出、自定义字段） | 低侵入 |
| **混合模式（默认）** | 以上两者结合 | 大多数企业应用 | 最优平衡 |

### 3.3 数据流图

```
用户请求 (带 JWT Token)
         ↓
   JWT 解析 → user_id
         ↓
┌─────────────────────────┐
│  构建 DataContext       │
│                         │
│  1. 获取用户基础信息     │
│  2. 查询角色默认范围     │
│  3. 查询活跃借调记录     │ ← 关键！
│  4. UNION 合并权限      │
│  5. 生成最终上下文       │
└───────────┬─────────────┘
            ↓
   注入到 SQLAlchemy Session
            ↓
┌─────────────────────────┐
│  SQL 执行时拦截          │
│                         │
│  判断是否需要过滤?       │
│    ├─ 是 → 追加 WHERE   │
│    └─ 否 → 原样执行     │
└───────────┬─────────────┘
            ↓
   返回过滤后的数据
```

---

## 4. 核心模型设计

### 4.1 ER 图

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Org (组织)   │──────<│   User (用户)  │>──────│  Role (角色)  │
│              │ 1:N  │              │ N:M  │              │
│ • id         │       │ • id         │       │ • id         │
│ • name       │       │ • username   │       │ • name       │
│ • code       │       │ • org_id(FK) │       │ • code       │
│ • parent_id  │       │ • is_active  │       │ • level      │
│ • level      │       │ • is_superuser│      └──────┬───────┘
│ • path       │       └──────┬───────┘              │
└──────────────┘              │                      │
          ▲                     ▼                      ▼
          │             ┌──────────────┐       ┌──────────────┐
          │             │ DataScope    │       │ Permission   │
          │             │ (数据范围)    │       │ (功能权限)    │
          └─────────────│              │       │              │
                        │ • id         │       │ • role_id    │
                        │ • user_id    │       │ • resource   │
                        │ • org_id     │       │ • action     │
                        │ • scope_type │       └──────────────┘
                        └──────┬───────┘
                               │
                               ▼
                   ┌──────────────────┐
                   │  UserDelegation  │  ← 借调/委派
                   │                  │
                   │ • id             │
                   │ • user_id        │  ← 被借调人
                   │ • delegate_to_id │  ← 借调目标
                   │ • org_id         │  ← 授权范围
                   │ • scope_type     │
                   │ • start_time     │
                   │ • end_time       │
                   │ • status         │
                   └──────────────────┘
```

### 4.2 Org 组织模型

```python
# backend/app/models/org.py

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Org(Base):
    """组织架构表（支持树形结构）"""
    __tablename__ = 'orgs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, comment="组织名称")
    code = Column(String(50), unique=True, nullable=False, comment="组织编码")
    parent_id = Column(Integer, ForeignKey('orgs.id'), nullable=True, comment="父组织ID")
    level = Column(Integer, default=1, comment="层级: 1=集团 2=子公司 3=部门")
    path = Column(String(500), default="/", comment="树路径: /1/2/5/")
    sort_order = Column(Integer, default=0, comment="排序")
    is_active = Column(Integer, default=1, comment="是否启用")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    parent = relationship("Org", remote_side=[id], backref="children")
    users = relationship("User", back_populates="org")
    
    @property
    def is_group(self) -> bool:
        return self.level == 1
    
    @property
    def is_subsidiary(self) -> bool:
        return self.level == 2
    
    @property
    def is_department(self) -> bool:
        return self.level >= 3
    
    def get_all_child_ids(self, db) -> list:
        """获取所有子组织ID（含自身）"""
        result = db.query(Org.id).filter(
            Org.path.like(f"{self.path}%")
        ).all()
        return [r[0] for r in result]
```

### 4.3 UserDelegation 借调模型

```python
# backend/app/models/delegation.py

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, 
    ForeignKey, Enum as SAEnum, Text
)
from sqlalchemy.orm import relationship
from enum import Enum
import json

from app.database import Base


class DelegationStatus(str, Enum):
    """借调状态"""
    PENDING = "pending"        # 待审批
    APPROVED = "approved"      # 已批准
    ACTIVE = "active"          # 进行中
    EXPIRED = "expired"        # 已过期
    REVOKED = "revoked"        # 已撤销
    REJECTED = "rejected"      # 已拒绝


class DelegationScope(str, Enum):
    """借调数据范围类型"""
    SAME_AS_TARGET = "same_as_target"   # 与目标组织相同
    CUSTOM = "custom"                   # 自定义范围
    SPECIFIC_ORGS = "specific_orgs"     # 指定组织列表


class UserDelegation(Base):
    """用户借调/委派记录"""
    __tablename__ = 'user_delegations'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # 被借调人
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    
    # 借调目标组织
    target_org_id = Column(Integer, ForeignKey('orgs.id'), nullable=False)
    
    # 数据访问范围配置
    scope_type = Column(SAEnum(DelegationScope), default=DelegationScope.SAME_AS_TARGET)
    
    # 自定义范围（JSON 数组格式存储）
    custom_org_ids = Column(Text, nullable=True, comment='[1,2,3]')
    custom_dept_ids = Column(Text, nullable=True)
    
    # 时间范围
    start_time = Column(DateTime, nullable=False, comment="开始时间")
    end_time = Column(DateTime, nullable=False, comment="结束时间")
    
    # 状态流转
    status = Column(SAEnum(DelegationStatus), default=DelegationStatus.PENDING)
    
    # 审批信息
    approved_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(String(500), nullable=True)
    
    # 业务信息
    reason = Column(String(500), nullable=True, comment="借调原因")
    created_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    user = relationship("User", foreign_keys=[user_id], back_populates="delegations")
    target_org = relationship("Org", foreign_keys=[target_org_id])
    approver = relationship("User", foreign_keys=[approved_by])
    
    @property
    def is_currently_active(self) -> bool:
        """判断借调是否当前有效"""
        now = datetime.utcnow()
        return (
            self.status == DelegationStatus.ACTIVE and 
            self.start_time <= now <= self.end_time
        )
    
    def get_custom_org_ids(self) -> list:
        """解析自定义组织ID列表"""
        if self.custom_org_ids:
            try:
                return json.loads(self.custom_org_ids)
            except:
                return []
        return []
    
    def get_custom_dept_ids(self) -> list:
        """解析自定义部门ID列表"""
        if self.custom_dept_ids:
            try:
                return json.loads(self.custom_dept_ids)
            except:
                return []
        return []
```

### 4.4 数据范围类型枚举

```python
# backend/app/core/data_permission/enums.py

from enum import Enum


class ScopeType(str, Enum):
    """
    数据范围类型
    
    决定 SQL WHERE 条件的生成方式
    """
    ALL = "ALL"                           # 全部数据（不过滤）
    DEPT = "DEPT"                         # 本部门
    DEPT_AND_CHILD = "DEPT_AND_CHILD"      # 本部门及下级
    DEPT_AND_PARENT = "DEPT_AND_PARENT"    # 本部门及上级
    SELF = "SELF"                          # 仅本人数据
    CUSTOM = "CUSTOM"                      # 自定义 SQL 条件
    DELEGATED = "DELEGATED"                # 借调合并（多个范围 UNION）


# 默认规则配置示例
DEFAULT_DATA_PERMISSION_RULES = {
    # 表名: { 权限字段, 权限类型 }
    "users": {"column": "org_id", "scope": "org"},
    "orders": {"column": "org_id", "scope": "org"},
    "customers": {"column": "org_id", "scope": "org"},
    "products": {"column": "org_id", "scope": "org"},
    "contracts": {"column": "dept_id", "scope": "dept"},
    "leave_requests": {"column": "created_by", "scope": "self"},
}
```

---

## 5. SQL 拦截器引擎

### 5.1 核心组件

```
backend/app/core/data_permission/
├── __init__.py              # 导出
├── engine.py                 # DataPermissionEngine 主引擎
├── context.py                # DataContext 数据上下文
├── enums.py                  # 枚举定义
├── scope_resolver.py         # 权限范围解析器
├── sql_builder.py            # SQL 条件构建器
├── decorator.py              # @DataPermission 装饰器
├── events.py                 # SQLAlchemy 事件监听
└── config.py                 # 配置常量
```

### 5.2 DataContext 数据上下文

```python
# backend/app/core/data_permission/context.py

from dataclasses import dataclass, field
from typing import Optional, Set, List
from .enums import ScopeType


@dataclass
class DataContext:
    """
    数据权限上下文
    
    每次请求构建一次，包含当前用户的完整数据权限信息。
    通过 SQLAlchemy Session 传递给拦截器使用。
    """
    
    # ===== 用户身份 =====
    user_id: int
    username: str = ""
    
    # ===== 组织权限（核心）=====
    primary_org_id: Optional[int] = None      # 主组织ID
    org_ids: Set[int] = field(default_factory=set)  # 可访问的组织ID集合
    
    # ===== 部门权限 =====
    primary_dept_id: Optional[int] = None
    dept_ids: Set[int] = field(default_factory=set)
    
    # ===== 权限范围类型 =====
    scope_type: ScopeType = ScopeType.SELF
    
    # ===== 借调状态 =====
    is_delegated: bool = False                    # 是否有活跃借调
    delegation_sources: List[str] = field(default_factory=list)  # 借调来源描述
    
    # ===== 自定义条件 =====
    custom_sql: Optional[str] = None             # 自定义SQL片段
    
    # ===== 特殊标记 =====
    is_superuser: bool = False                   # 超级管理员（跳过所有过滤）
    bypass_filter: bool = False                 # 本次请求跳过过滤
    
    # ========== 方法 ==========
    
    def get_org_filter_sql(self, column: str = "org_id") -> str:
        """
        生成组织级别的 WHERE 条件
        
        Returns:
            SQL 条件字符串，如 "org_id IN (1,2,3)"
            空字符串表示不需要过滤
        """
        if self.is_superuser or self.scope_type == ScopeType.ALL:
            return ""
        
        if self.bypass_filter:
            return ""
        
        if self.scope_type == ScopeType.CUSTOM:
            return self.custom_sql or ""
        
        if self.org_ids:
            ids = ",".join(str(id) for id in sorted(self.org_ids))
            return f"{column} IN ({ids})"
        
        # 无权限时返回不可能的条件（安全兜底）
        return f"{column} = -1"
    
    def get_dept_filter_sql(self, column: str = "dept_id") -> str:
        """生成部门级别的 WHERE 条件"""
        if not self.dept_ids:
            return f"{column} = -1"
        ids = ",".join(str(id) for id in sorted(self.dept_ids))
        return f"{column} IN ({ids})"
    
    def get_self_filter_sql(self, column: str = "created_by") -> str:
        """生成本人数据的 WHERE 条件"""
        return f"{column} = {self.user_id}"
    
    def to_dict(self) -> dict:
        """转换为字典（用于日志和调试）"""
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
```

### 5.3 DataPermissionEngine 主引擎

```python
# backend/app/core/data_permission/engine.py

import logging
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session, Query
from sqlalchemy.sql import text

from .context import DataContext
from .enums import ScopeType
from .config import DEFAULT_DATA_PERMISSION_RULES

logger = logging.getLogger(__name__)


class DataPermissionEngine:
    """
    数据权限引擎
    
    三种工作模式:
    1. 全局自动模式 - 根据配置自动拦截有权限字段的表
    2. 注解覆盖模式 - 使用 @DataPermission 装饰器显式控制
    3. 混合模式 (默认) - 以上两种结合
    """
    
    def __init__(self, session: Session):
        self.session = session
        self.context: Optional[DataContext] = None
        
        # 规则注册表
        self.rule_registry: Dict[str, Dict[str, str]] = {}
        
        # 当前请求的注解覆盖
        self._annotation_override: Optional[Dict[str, Any]] = None
        
        # 加载默认规则
        self.register_rules_from_config(DEFAULT_DATA_PERMISSION_RULES)
    
    # ========== 上下文管理 ==========
    
    def set_context(self, context: DataContext):
        """设置当前请求的数据权限上下文"""
        self.context = context
        logger.debug(f"数据权限上下文已设置: {context.to_dict()}")
    
    def set_annotation_override(self, override: Dict[str, Any]):
        """设置来自装饰器的覆盖配置"""
        self._annotation_override = override
    
    def clear(self):
        """清理上下文和覆盖"""
        self.context = None
        self._annotation_override = None
    
    # ========== 规则注册 ==========
    
    def register_rule(self, table_name: str, column: str = "org_id", 
                       scope: str = "org"):
        """注册单个表的数据权限规则"""
        self.rule_registry[table_name.lower()] = {
            "column": column,
            "scope": scope
        }
    
    def register_rules_from_config(self, config: Dict[str, Dict[str, str]]):
        """从配置批量注册规则"""
        for table_name, rule in config.items():
            self.register_rule(
                table_name=table_name,
                column=rule.get("column", "org_id"),
                scope=rule.get("scope", "org")
            )
    
    # ========== 核心拦截逻辑 ==========
    
    def should_intercept(self, query: Query) -> bool:
        """
        判断是否应该拦截此查询
        
        拦截条件:
        1. 有有效的权限上下文
        2. 不是超级管理员
        3. 未设置 bypass
        4. 查询涉及的表在规则中 或 有注解覆盖
        5. 是 SELECT 操作
        """
        if not self.context:
            return False
        
        if self.context.is_superuser or self.context.bypass_filter:
            return False
        
        # 注解覆盖优先
        if self._annotation_override:
            return True
        
        # 检查查询涉及的实体
        from sqlalchemy import inspect
        try:
            for entity_desc in query._entities:
                if hasattr(entity_desc, 'entity_zero_class'):
                    mapper = inspect(entity_desc.entity_zero_class)
                    if mapper and mapper.tables:
                        table_name = mapper.tables[0].name.lower()
                        if table_name in self.rule_registry:
                            return True
        except Exception as e:
            logger.warning(f"检查查询实体失败: {e}")
        
        return False
    
    def apply_data_permission(self, query: Query) -> Query:
        """
        对查询应用数据权限过滤
        
        这是核心方法，在每次 SELECT 查询时调用
        """
        if not self.should_intercept(query):
            return query
        
        # 确定生效的规则
        rule = self._get_effective_rule(query)
        if not rule:
            return query
        
        column_name = rule["column"]
        scope_type = rule["scope"]
        
        # 构建过滤条件
        condition_sql = self._build_condition(column_name, scope_type)
        
        if condition_sql:
            logger.debug(f"追加数据权限过滤: {condition_sql}")
            query = query.filter(text(condition_sql))
        
        return query
    
    def _get_effective_rule(self, query: Query) -> Optional[Dict[str, str]]:
        """获取生效的规则（注解 > 配置）"""
        if self._annotation_override:
            return {
                "column": self._annotation_override.get("column", "org_id"),
                "scope": self._annotation_override.get("scope", "org")
            }
        
        from sqlalchemy import inspect
        for entity_desc in query._entities:
            if hasattr(entity_desc, 'entity_zero_class'):
                mapper = inspect(entity_desc.entity_zero_class)
                if mapper and mapper.tables:
                    table_name = mapper.tables[0].name.lower()
                    if table_name in self.rule_registry:
                        return self.rule_registry[table_name]
        return None
    
    def _build_condition(self, column: str, scope: str) -> str:
        """根据范围类型构建 SQL 条件"""
        if scope == "org":
            return self.context.get_org_filter_sql(column)
        elif scope == "dept":
            return self.context.get_dept_filter_sql(column)
        elif scope == "self":
            return self.context.get_self_filter_sql(column)
        elif scope == "custom":
            return self.context.custom_sql or ""
        return ""
```

### 5.4 @DataPermission 装饰器

```python
# backend/app/core/data_permission/decorator.py

from functools import wraps
from typing import Optional, List


def DataPermission(
    column: str = "org_id",
    scope: str = "org",
    enabled: bool = True,
    merge_strategy: str = "union",
    exclude_tables: Optional[List[str]] = None
):
    """
    数据权限装饰器
    
    用于在特定接口上显式控制数据权限行为
    
    参数:
        column: 过滤字段名 (如 org_id, dept_id, created_by)
        scope: 权限类型 (org/dept/self/custom)
        enabled: 是否启用数据权限（设为 False 可跳过过滤）
        merge_strategy: 合并策略 (union/intersect)
        exclude_tables: 排除的表名列表
    
    用法示例:
    
    @DataPermission()  # 使用默认配置 (org_id 过滤)
    async def get_order_list(db: Session):
        return await crud.order.get_multi(db)
    
    
    @DataPermission(column="created_by", scope="self")
    async def get_my_tasks(db: Session):
        # 只返回当前用户创建的任务
        return await crud.task.get_multi(db)
    
    
    @DataPermission(enabled=False)
    async def get_dashboard_stats(db: Session):
        # 统计接口不过滤，返回全部数据
        return ...
    
    
    @DataPermission(scope="custom", custom_sql="org_id IN (SELECT org_id FROM manager_orgs WHERE manager_id = :uid)")
    async def get_managed_orders(db: Session):
        # 自定义复杂条件
        ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            db = kwargs.get('db')
            
            if db and enabled:
                dp_engine = getattr(db, '_dp_engine', None)
                if dp_engine:
                    override = {
                        "column": column,
                        "scope": scope,
                        "merge_strategy": merge_strategy,
                        "exclude_tables": exclude_tables or [],
                        "enabled": True
                    }
                    dp_engine.set_annotation_override(override)
            
            try:
                result = await func(*args, **kwargs)
                return result
            finally:
                if db and enabled:
                    dp_engine = getattr(db, '_dp_engine', None)
                    if dp_engine:
                        dp_engine.set_annotation_override(None)
        
        return wrapper
    return decorator
```

### 5.5 Session 工厂集成

```python
# backend/app/core/data_permission/session_factory.py

from sqlalchemy.orm import Session
from sqlalchemy.engine import Engine
from .engine import DataPermissionEngine
from .context import DataContext
from .scope_resolver import ScopeResolver


async def create_dp_session(engine: Engine, user_id: int) -> Session:
    """
    创建带数据权限的 Session
    
    在依赖注入中使用:
    
    async def get_db(request: Request):
        user_id = request.state.user_id
        return await create_dp_session(engine, user_id)
    """
    from sqlalchemy.orm import sessionmaker
    
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    
    # 创建数据权限引擎
    dp_engine = DataPermissionEngine(session)
    
    # 解析用户权限上下文
    resolver = ScopeResolver(session)
    context = await resolver.resolve(user_id)
    
    # 设置上下文
    dp_engine.set_context(context)
    
    # 绑定到 session
    session._dp_engine = dp_engine
    
    return session
```

---

## 6. 借调权限合并机制

### 6.1 借调流程状态机

```
                    ┌─────────────┐
                    │   PENDING   │ (待审批)
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌──────────┐  ┌──────────┐  ┌──────────┐
       │ APPROVED │  │ REJECTED │  │ REVOKED  │
       │(已批准)  │  │(已拒绝)  │  │(已撤销)  │
       └────┬─────┘  └──────────┘  └──────────┘
            │
            ▼ (到达 start_time)
       ┌──────────┐
       │  ACTIVE  │ ◄────── 进行中
       │(进行中)  │
       └────┬─────┘
            │
            ▼ (超过 end_time)
       ┌──────────┐
       │  EXPIRED │ (已过期)
       └──────────┘
```

### 6.2 ScopeResolver 权限解析器

```python
# backend/app/core/data_permission/scope_resolver.py

from typing import List, Set, Optional
from datetime import datetime
import json
import logging

from sqlalchemy.orm import Session

from app.models.delegation import UserDelegation, DelegationStatus, DelegationScope
from app.models.org import Org
from .context import DataContext, ScopeType

logger = logging.getLogger(__name__)


class ScopeResolver:
    """
    数据权限范围解析器
    
    负责:
    1. 解析用户的基础权限（来自角色和组织归属）
    2. 解析活跃的借调/委派权限
    3. 合并生成最终的 DataContext
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    async def resolve(self, user_id: int) -> DataContext:
        """
        解析入口 - 返回完整的 DataContext
        
        Args:
            user_id: 用户 ID
            
        Returns:
            DataContext 包含完整的数据权限信息
        """
        from app.models.user import User
        
        # 1. 获取用户基础信息
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")
        
        # 2. 构建基础上下文
        context = DataContext(
            user_id=user.id,
            username=user.username,
            primary_org_id=user.org_id,
            is_superuser=user.is_superuser if hasattr(user, 'is_superuser') else False,
        )
        
        # 超级管理员直接返回
        if context.is_superuser:
            context.scope_type = ScopeType.ALL
            return context
        
        # 3. 添加基础组织权限
        if user.org_id:
            context.org_ids.add(user.org_id)
            
            # 同时添加该组织的所有上级（可选）
            parent_orgs = self._get_parent_orgs(user.org_id)
            context.org_ids.update(parent_orgs)
        
        # 4. 获取角色的默认数据范围
        role_scope = self._resolve_role_scope(user_id)
        
        # 5. 【关键】解析活跃的借调权限
        active_delegations = self._get_active_delegations(user_id)
        
        if active_delegations:
            # 有借调：合并权限
            self._merge_delegation_permissions(context, active_delegations)
        else:
            # 无借调：使用角色默认范围
            context.scope_type = role_scope or ScopeType.DEPT
        
        logger.info(
            f"用户 {user_id} 数据权限解析完成: "
            f"org_ids={context.org_ids}, "
            f"scope={context.scope_type.value}, "
            f"is_delegated={context.is_delegated}"
        )
        
        return context
    
    def _resolve_role_scope(self, user_id: int) -> Optional[ScopeType]:
        """
        根据用户的最高级别角色确定默认数据范围
        
        规则:
        - 超级管理员 / 集团管理员 → ALL
        - 子公司经理 → DEPT_AND_CHILD
        - 部门主管 → DEPT
        - 普通员工 → SELF
        """
        # TODO: 实现基于角色的范围映射
        # 这里可以查询 user_roles 表，根据角色的 data_scope 字段确定
        return ScopeType.DEPT
    
    def _get_active_delegations(self, user_id: int) -> List[UserDelegation]:
        """
        获取当前用户所有活跃且未过期的借调记录
        
        条件:
        - status = ACTIVE
        - 当前时间在 [start_time, end_time] 区间内
        """
        now = datetime.utcnow()
        
        return self.db.query(UserDelegation).filter(
            UserDelegation.user_id == user_id,
            UserDelegation.status == DelegationStatus.ACTIVE,
            UserDelegation.start_time <= now,
            UserDelegation.end_time >= now
        ).all()
    
    def _merge_delegation_permissions(
        self, 
        context: DataContext, 
        delegations: List[UserDelegation]
    ):
        """
        合并借调权限到上下文
        
        合并策略: UNION (取并集)
        最终权限 = 基础权限 ∪ 所有借调授权的范围
        """
        context.is_delegated = True
        context.delegation_sources = []
        
        for delegation in delegations:
            source_desc = f"借调至:org_{delegation.target_org_id}"
            context.delegation_sources.append(source_desc)
            
            # 根据借调范围类型处理
            if delegation.scope_type == DelegationScope.SAME_AS_TARGET:
                # 与目标组织相同：获取目标组织及其所有子组织
                child_org_ids = self._get_org_tree(delegation.target_org_id)
                context.org_ids.update(child_org_ids)
                
            elif delegation.scope_type == DelegationScope.SPECIFIC_ORGS:
                # 指定的组织列表
                custom_orgs = delegation.get_custom_org_ids()
                context.org_ids.update(custom_orgs)
            
            elif delegation.scope_type == DelegationScope.CUSTOM:
                # 完全自定义（可能同时有组织和部门）
                custom_orgs = delegation.get_custom_org_ids()
                custom_depts = delegation.get_custom_dept_ids()
                
                if custom_orgs:
                    context.org_ids.update(custom_orgs)
                if custom_depts:
                    context.dept_ids.update(custom_depts)
        
        # 设置最终范围类型为借调合并
        context.scope_type = ScopeType.DELEGATED
    
    def _get_parent_orgs(self, org_id: int) -> Set[int]:
        """获取指定组织的所有祖先组织 ID"""
        org = self.db.query(Org).filter(Org.id == org_id).first()
        if not org or not org.path:
            return set()
        
        # path 格式: /1/2/5/
        # 提取路径中的所有 ID
        path_parts = [p for p in org.path.split('/') if p.isdigit()]
        return set(int(p) for p in path_parts)
    
    def _get_org_tree(self, org_id: int) -> Set[int]:
        """获取指定组织及其所有子孙组织的 ID"""
        org = self.db.query(Org).filter(Org.id == org_id).first()
        if not org:
            return {org_id}
        
        children = self.db.query(Org.id).filter(
            Org.path.like(f"{org.path}%")
        ).all()
        
        return {child[0] for child in children}
```

### 6.3 借调管理 Service

```python
# backend/app/services/delegation_service.py

from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.delegation import (
    UserDelegation, 
    DelegationStatus, 
    DelegationScope
)
from app.schemas.delegation import DelegationCreate, DelegationApprove


class DelegationService:
    """借调管理服务"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def create(self, data: DelegationCreate, created_by: int) -> UserDelegation:
        """创建借调申请"""
        
        # 校验时间范围
        if data.start_time >= data.end_time:
            raise ValueError("结束时间必须晚于开始时间")
        
        # 校验是否存在重叠的活跃借调
        existing = self.db.query(UserDelegation).filter(
            UserDelegation.user_id == data.user_id,
            UserDelegation.status.in_([DelegationStatus.ACTIVE, DelegationStatus.PENDING]),
            UserDelegation.end_time >= data.start_time
        ).first()
        
        if existing:
            raise ValueError("该用户存在时间重叠的有效借调记录")
        
        delegation = UserDelegation(
            user_id=data.user_id,
            target_org_id=data.target_org_id,
            scope_type=data.scope_type or DelegationScope.SAME_AS_TARGET,
            custom_org_ids=data.custom_org_ids,
            custom_dept_ids=data.custom_dept_ids,
            start_time=data.start_time,
            end_time=data.end_time,
            reason=data.reason,
            status=DelegationStatus.PENDING,
            created_by=created_by
        )
        
        self.db.add(delegation)
        self.db.commit()
        self.db.refresh(delegation)
        
        return delegation
    
    async def approve(self, delegation_id: int, approver_id: int) -> UserDelegation:
        """审批通过借调申请"""
        delegation = self.db.query(UserDelegation).filter(
            UserDelegation.id == delegation_id
        ).first()
        
        if not delegation:
            raise ValueError("借调记录不存在")
        
        if delegation.status != DelegationStatus.PENDING:
            raise ValueError(f"当前状态 {delegation.status.value} 无法审批")
        
        delegation.status = DelegationStatus.APPROVED
        delegation.approved_by = approver_id
        delegation.approved_at = datetime.utcnow()
        
        # 如果开始时间已到，立即激活
        if datetime.utcnow() >= delegation.start_time:
            delegation.status = DelegationStatus.ACTIVE
        
        self.db.commit()
        self.db.refresh(delegation)
        
        return delegation
    
    async def reject(self, delegation_id: int, reject_reason: str, approver_id: int):
        """拒绝借调申请"""
        delegation = self.db.query(UserDelegation).filter(
            UserDelegation.id == delegation_id
        ).first()
        
        if not delegation:
            raise ValueError("借调记录不存在")
        
        delegation.status = DelegationStatus.REJECTED
        delegation.rejection_reason = reject_reason
        delegation.approved_by = approver_id
        delegation.approved_at = datetime.utcnow()
        
        self.db.commit()
    
    async def revoke(self, delegation_id: int, revoked_by: int):
        """提前撤销借调"""
        delegation = self.db.query(UserDelegation).filter(
            UserDelegation.id == delegation_id
        ).first()
        
        if not delegation:
            raise ValueError("借调记录不存在")
        
        if delegation.status != DelegationStatus.ACTIVE:
            raise ValueError("只有进行中的借调可以撤销")
        
        delegation.status = DelegationStatus.REVOKED
        delegation.updated_at = datetime.utcnow()
        
        self.db.commit()
    
    async def get_user_delegations(
        self, 
        user_id: int, 
        include_expired: bool = False
    ) -> List[UserDelegation]:
        """获取用户的借调列表"""
        query = self.db.query(UserDelegation).filter(
            UserDelegation.user_id == user_id
        )
        
        if not include_expired:
            query = query.filter(
                UserDelegation.status != DelegationStatus.EXPIRED
            )
        
        return query.order_by(UserDelegation.created_at.desc()).all()
    
    async def check_and_expire_delegations(self):
        """
        定期任务：检查并过期超时的借调记录
        
        应由定时任务调用（如 Celery beat 或 APScheduler）
        """
        now = datetime.utcnow()
        
        expired = self.db.query(UserDelegation).filter(
            UserDelegation.status == DelegationStatus.ACTIVE,
            UserDelegation.end_time < now
        ).all()
        
        count = 0
        for d in expired:
            d.status = DelegationStatus.EXPIRED
            count += 1
        
        if count > 0:
            self.db.commit()
            logger.info(f"已过期 {count} 条借调记录")
        
        return count
```

---

## 7. 前端权限配置

### 7.1 借调管理页面

```
frontend/src/views/system/delegation/
├── list.vue              # 借调列表页
├── form.vue              # 申请/编辑表单
├── detail.vue            # 详情页
└── components/
    ├── StatusTag.vue     # 状态标签
    └── Timeline.vue      # 状态时间线
```

### 7.2 我的借调组件

```vue
<!-- frontend/src/components/business/MyDelegationBadge.vue -->
<template>
  <el-badge :value="activeCount" :hidden="activeCount === 0" type="warning">
    <el-popover trigger="hover" placement="bottom-end" width="350">
      <template #reference>
        <el-button :icon="Switch" circle size="small" />
      </template>
      
      <div class="delegation-popover">
        <h4>🔄 当前借调</h4>
        
        <div v-for="item in activeDelegations" :key="item.id" class="delegation-item">
          <div class="target-org">
            <el-tag size="small">{{ item.target_org_name }}</el-tag>
            <span class="time">{{ item.start_time }} ~ {{ item.end_time }}</span>
          </div>
          <p class="reason">{{ item.reason }}</p>
          <el-progress 
            :percentage="progress(item)" 
            :status="progress(item) > 90 ? 'warning' : ''"
            :show-text="false"
          />
        </div>
        
        <el-button 
          type="primary" 
          link 
          size="small"
          @click="$router.push('/my-delegations')"
        >
          查看全部 →
        </el-button>
      </div>
    </el-popover>
  </el-badge>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Switch } from '@element-plus/icons-vue'
import { getActiveDelegations } from '@/api/modules/delegation'

const activeDelegations = ref([])
const activeCount = computed(() => activeDelegations.value.length)

onMounted(async () => {
  const res = await getActiveDelegations()
  activeDelegations.value = res.data
})

function progress(item: any): number {
  const total = new Date(item.end_time).getTime() - new Date(item.start_time).getTime()
  const elapsed = Date.now() - new Date(item.start_time).getTime()
  return Math.round((elapsed / total) * 100)
}
</script>
```

### 7.3 权限指示器（页面级别）

```vue
<!-- 在页面头部显示当前数据权限范围 -->
<template>
  <div class="data-permission-indicator">
    <el-tooltip content="当前数据访问范围">
      <el-tag 
        :type="permissionTag.type" 
        size="small" 
        effect="plain"
      >
        <el-icon><Lock /></el-icon>
        {{ permissionTag.label }}
      </el-tag>
    </el-tooltip>
    
    <!-- 如果是借调状态，显示额外提示 -->
    <el-tag 
      v-if="isDelegated" 
      type="warning" 
      size="small" 
      effect="plain"
      class="ml-1"
    >
      🔄 借调中
    </el-tag>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUserStore } from '@/stores/modules/user'
import { Lock } from '@element-plus/icons-vue'

const userStore = useUserStore()

const permissionTag = computed(() => {
  const ctx = userStore.dataContext
  
  switch (ctx?.scope_type) {
    case 'ALL': return { type: 'danger', label: '全部数据' }
    case 'DEPT_AND_CHILD': return { type: '', label: '本部门及下级' }
    case 'DEPT': return { type: 'info', label: '本部门' }
    case 'SELF': return { type: 'info', label: '仅本人' }
    case 'DELEGATED': return { type: 'warning', label: '借调合并' }
    default: return { type: 'info', label: '默认' }
  }
})

const isDelegated = computed(() => userStore.dataContext?.is_delegated)
</script>
```

---

## 8. 模板集成方案

### 8.1 脚手架初始化选项扩展

```bash
$ pdd scaffold:init my-project

? 是否启用数据权限功能: Yes (推荐)
? 数据权限模式: 混合智能 (推荐)
? 是否支持借调/委派: Yes (推荐)
? 默认权限字段: org_id
```

生成的额外文件：

```
backend/app/
├── core/
│   └── data_permission/        # ★ 新增：数据权限模块
│       ├── __init__.py
│       ├── engine.py
│       ├── context.py
│       ├── enums.py
│       ├── scope_resolver.py
│       ├── sql_builder.py
│       ├── decorator.py
│       ├── events.py
│       └── config.py
│
├── models/
│   ├── org.py                   # ★ 新增：组织模型
│   └── delegation.py            # ★ 新增：借调模型
│
├── api/v1/
│   ├── orgs.py                 # ★ 新增：组织管理 API
│   └── delegations.py          # ★ 新增：借调管理 API
│
├── schemas/
│   ├── org.py                  # ★ 新增
│   └── delegation.py           # ★ 新增
│
└── services/
    └── delegation_service.py   # ★ 新增


frontend/src/
├── views/system/
│   └── delegation/             # ★ 新增：借调管理页面
│       ├── list.vue
│       └── form.vue
│
├── components/business/
│   ├── MyDelegationBadge.vue   # ★ 新增：借调状态徽章
│   └── DataPermissionIndicator.vue  # ★ 新增：权限指示器
│
└── stores/modules/
    └── data-permission.ts      # ★ 新增：数据权限状态
```

### 8.2 CRUD 代码生成增强

生成的 CRUD 代码会自动：

1. **Model 层** - 自动添加 `org_id`, `dept_id`, `created_by` 字段
2. **Schema 层** - 这些字段设为只读（后端自动填充）
3. **Router 层** - 默认启用数据权限过滤
4. **前端列表** - 显示数据权限指示器
5. **前端表单** - 不显示权限字段（自动填充）

### 8.3 配置文件模板

```yaml
# .pdd-scaffold/config.yaml 新增部分

data_permission:
  enabled: true
  mode: hybrid  # global / annotation / hybrid
  
  default_rules:
    users:
      column: org_id
      scope: org
    orders:
      column: org_id
      scope: org
    contracts:
      column: dept_id
      scope: dept
    leave_requests:
      column: created_by
      scope: self
  
  delegation:
    enabled: true
    max_concurrent: 3  # 最大同时借调数
    max_duration_days: 365  # 最长借调天数
    require_approval: true  # 是否需要审批
```

---

## 9. 实现计划

### 9.1 开发阶段

| 阶段 | 内容 | 预计工作量 |
|------|------|-----------|
| **Phase D1** | 数据模型 + Org/Delegation 表 + Alembic 迁移 | 1 天 |
| **Phase D2** | DataContext + ScopeResolver 核心 | 1.5 天 |
| **Phase D3** | DataPermissionEngine + SQL 拦截器 | 2 天 |
| **Phase D4** | @DataPermission 装饰器 + Session 集成 | 1 天 |
| **Phase D5** | 借调管理 API + Service | 1.5 天 |
| **Phase D6** | 前端借调管理页面 + 权限指示器 | 1.5 天 |
| **Phase D7** | 测试 + 文档 + 脚手架模板集成 | 1 天 |
| **合计** | | **9.5 天** |

### 9.2 里程碑

| 里程碑 | 内容 | 验收标准 |
|--------|------|----------|
| **M-D1** | 核心模型就绪 | Org/UserDeigration 表可用 |
| **M-D2** | 权限解析器就绪 | 能正确解析用户数据权限 |
| **M-D3** | SQL 拦截器就绪 | 查询自动追加 WHERE 条件 |
| **M-D4** | 借调流程就绪 | 支持完整的借调生命周期 |
| **M-D5** | 前端管理界面 | 可视化管理借调和权限 |

### 9.3 技术风险

| 风险 | 影响 | 应对策略 |
|------|------|----------|
| 性能影响 | 每次 SELECT 都要判断 | 缓存 DataContext；批量查询优化 |
| 复杂查询兼容性 | JOIN/子查询可能出错 | 提供白名单机制；支持禁用 |
| 借调并发冲突 | 同一用户多重叠借调 | 应用层校验；数据库唯一约束 |
| 调试困难 | SQL 自动修改不易排查 | 详细日志；开发环境显示实际 SQL |

---

## 附录

### A. API 接口清单

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/v1/delegations` | 创建借调申请 | admin |
| GET | `/api/v1/delegations` | 借调列表（管理） | admin |
| GET | `/api/v1/delegations/my` | 我的借调列表 | authenticated |
| GET | `/api/v1/delegations/active` | 当前生效借调 | authenticated |
| PUT | `/api/v1/delegations/{id}/approve` | 审批通过 | admin |
| PUT | `/api/v1/delegations/{id}/reject` | 审批拒绝 | admin |
| PUT | `/api/v1/delegations/{id}/revoke` | 撤销借调 | admin/self |
| GET | `/api/v1/orgs/tree` | 组织架构树 | authenticated |
| GET | `/api/v1/orgs/{id}/children` | 子组织列表 | authenticated |

### B. 数据库变更脚本

```sql
-- 组织表
CREATE TABLE orgs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '组织名称',
    code VARCHAR(50) NOT NULL UNIQUE COMMENT '组织编码',
    parent_id INT NULL COMMENT '父组织ID',
    level INT DEFAULT 1 COMMENT '层级',
    path VARCHAR(500) DEFAULT '/' COMMENT '树路径',
    sort_order INT DEFAULT 0,
    is_active TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES orgs(id),
    INDEX idx_code (code),
    INDEX idx_parent (parent_id),
    INDEX idx_path (path(100))
) ENGINE=InnoDB COMMENT='组织架构表';

-- 借调记录表
CREATE TABLE user_delegations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '被借调人',
    target_org_id INT NOT NULL COMMENT '目标组织',
    scope_type ENUM('same_as_target','custom','specific_orgs') DEFAULT 'same_as_target',
    custom_org_ids TEXT NULL COMMENT '自定义组织IDs JSON',
    custom_dept_ids TEXT NULL COMMENT '自定义部门IDs JSON',
    start_time DATETIME NOT NULL COMMENT '开始时间',
    end_time DATETIME NOT NULL COMMENT '结束时间',
    status ENUM('pending','approved','active','expired','revoked','rejected') DEFAULT 'pending',
    approved_by INT NULL COMMENT '审批人',
    approved_at DATETIME NULL,
    rejection_reason VARCHAR(500) NULL,
    reason VARCHAR(500) NULL COMMENT '借调原因',
    created_by INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (target_org_id) REFERENCES orgs(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_user_status (user_id, status),
    INDEX idx_time_range (start_time, end_time)
) ENGINE=InnoDB COMMENT='用户借调记录表';
```

### C. 参考实现

- [Apache Shiro Data Permission](https://shiro.apache.org/)
- [RuoYi-Vue 数据权限](https://gitee.com/y_project/RuoYi-Vue)
- [Sa-Token 数据权限](https://sa-token.cc/doc.html#/plugin/data-permission)
- [MyBatis-Plus DataPermission](https://baomidou.com/pages/plugins/data-permission/)

---

**文档版本**: v1.0.0  
**最后更新**: 2026-04-12  
**关联文档**: [01-pdd-scaffold-design.md](./01-pdd-scaffold-design.md)
