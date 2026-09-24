"""
DataPermissionEngine - Core SQL interceptor engine

三种工作模式:
1. 全局自动模式 - 根据配置自动拦截有权限字段的表
2. 注解覆盖模式 - 使用 @DataPermission 装饰器显式控制
3. 混合模式 (默认) - 以上两者结合
"""
import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Query
from sqlalchemy.sql import text

from .context import DataContext
from .enums import ScopeType
from .config import DEFAULT_DATA_PERMISSION_RULES

logger = logging.getLogger(__name__)


class DataPermissionEngine:
    """数据权限引擎"""

    def __init__(self):
        self.context: Optional[DataContext] = None
        self.rule_registry: Dict[str, Dict[str, str]] = {}
        self._annotation_override: Optional[Dict[str, Any]] = None
        self.register_rules_from_config(DEFAULT_DATA_PERMISSION_RULES)

    def set_context(self, context: DataContext):
        self.context = context
        logger.debug(f"数据权限上下文已设置: {context.to_dict()}")

    def set_annotation_override(self, override: Dict[str, Any]):
        self._annotation_override = override

    def clear(self):
        self.context = None
        self._annotation_override = None

    def register_rule(self, table_name: str, column: str = "org_id", scope: str = "org"):
        self.rule_registry[table_name.lower()] = {
            "column": column,
            "scope": scope
        }

    def register_rules_from_config(self, config: Dict[str, Dict[str, str]]):
        for table_name, rule in config.items():
            self.register_rule(
                table_name=table_name,
                column=rule.get("column", "org_id"),
                scope=rule.get("scope", "org")
            )

    def should_intercept(self, query: Query) -> bool:
        if not self.context:
            return False
        if self.context.is_superuser or self.context.bypass_filter:
            return False
        if self._annotation_override:
            return True
        
        try:
            from sqlalchemy import inspect
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
        if not self.should_intercept(query):
            return query
        
        rule = self._get_effective_rule(query)
        if not rule:
            return query

        column_name = rule["column"]
        scope_type = rule["scope"]
        condition_sql = self._build_condition(column_name, scope_type)

        if condition_sql:
            logger.debug(f"追加数据权限过滤: {condition_sql}")
            query = query.filter(text(condition_sql))

        return query

    def _get_effective_rule(self, query: Query) -> Optional[Dict[str, str]]:
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
        if scope == "org":
            return self.context.get_org_filter_sql(column)
        elif scope == "dept":
            return self.context.get_dept_filter_sql(column)
        elif scope == "self":
            return self.context.get_self_filter_sql(column)
        elif scope == "custom":
            return self.context.custom_sql or ""
        return ""
