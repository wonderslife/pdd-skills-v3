"""
FastAPI Application Entry Point
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings


def create_app() -> FastAPI:
    """
    Application Factory - Creates and configures the FastAPI app
    """
    settings = get_settings()
    
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        debug=settings.DEBUG,
        openapi_url="/openapi.json" if settings.DEBUG else None,
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
    )
    
    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Register routers
    _register_routers(app)
    
    # Register exception handlers
    _register_exception_handlers(app)
    
    # Startup / Shutdown events
    @app.on_event("startup")
    async def startup():
        from .database.database import init_db
        await init_db()

    @app.on_event("shutdown")
    async def shutdown():
        from .database.database import dispose_db
        await dispose_db()

    return app


def _register_routers(app: FastAPI):
    """Register API routers"""
    from app.api.v1.router import api_router
    app.include_router(api_router, prefix="/api/v1")


def _register_exception_handlers(app: FastAPI):
    """Register global exception handlers"""
    from fastapi import Request
    from fastapi.responses import JSONResponse
    
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        settings = get_settings()
        return JSONResponse(
            status_code=500,
            content={
                "code": 500,
                "message": "Internal Server Error" if not settings.DEBUG else str(exc),
                "detail": None if not settings.DEBUG else getattr(exc, "detail", None),
            }
        )
