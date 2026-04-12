"""
Database Configuration - Async SQLAlchemy Engine & Session Management
"""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from ..config import get_settings


settings = get_settings()

Base = DeclarativeBase()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=True,
)


@asynccontextmanager
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Async session dependency for FastAPI endpoints"""
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Initialize database tables (called on startup)"""
    from ..models import Base  # noqa: F401 - ensure models are imported
    async with engine.begin() as conn:
        await conn.run_sync_do(Base.metadata.create_all)
