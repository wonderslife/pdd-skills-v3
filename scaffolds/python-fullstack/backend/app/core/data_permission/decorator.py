"""
@DataPermission Decorator - Explicit control over data permission behavior

用法示例:

    @DataPermission()  # 使用默认配置 (org_id 过滤)
    async def get_order_list(db: Session):
        return await crud.order.get_multi(db)


    @DataPermission(column="created_by", scope="self")
    async def get_my_tasks(db: Session):
        # 只返回当前用户创建的任务
        return ...


    @DataPermission(enabled=False)
    async def get_dashboard_stats(db: Session):
        # 统计接口不过滤，返回全部数据
        return ...
"""
from functools import wraps
from typing import Optional, List


def DataPermission(
    column: str = "org_id",
    scope: str = "org",
    enabled: bool = True,
    merge_strategy: str = "union",
    exclude_tables: Optional[List[str]] = None,
):
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
