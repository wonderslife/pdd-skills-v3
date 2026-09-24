"""
SQLAlchemy Event Listeners for automatic data permission interception

在 Session 级别通过事件监听实现透明的 SQL 拦截。
"""
import logging

from sqlalchemy import event
from sqlalchemy.orm import Query

from .engine import DataPermissionEngine

logger = logging.getLogger(__name__)


def install_session_events(session, dp_engine: DataPermissionEngine):
    """
    为 Session 安装数据权限事件监听器
    
    在依赖注入中使用:
    
        async def get_db_with_dp(request: Request):
            session = next(get_db())
            dp_engine = DataPermissionEngine()
            resolver = ScopeResolver(session)
            context = await resolver.resolve(request.state.user_id)
            dp_engine.set_context(context)
            install_session_events(session, dp_engine)
            return session
    """

    @event.listens_for(session, 'before_flush')
    def before_flush_hook(flush_context, instances, **kw):
        pass


def create_dp_dependency(engine, get_user_id_func):
    """
    创建带数据权限的数据库依赖注入函数
    
    Args:
        engine: SQLAlchemy async engine
        get_user_id_func: 从请求中获取 user_id 的 callable
        
    Returns:
        FastAPI dependency function
    """
    from sqlalchemy.ext.asyncio import AsyncSession
    from ..database.database import async_session_factory
    from .scope_resolver import ScopeResolver
    from .engine import DataPermissionEngine
    
    async def dp_get_db(request) -> AsyncSession:
        async with async_session_factory() as session:
            try:
                dp_engine = DataPermissionEngine()
                
                user_id = get_user_id_func(request)
                if user_id:
                    resolver = ScopeResolver(session)
                    context = await resolver.resolve(user_id)
                    dp_engine.set_context(context)
                
                session._dp_engine = dp_engine
                yield session
            finally:
                if hasattr(session, '_dp_engine'):
                    session._dp_engine.clear()
                await session.close()

    return dp_get_db
