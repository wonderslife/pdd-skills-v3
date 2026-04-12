"""
API v1 Router - Aggregates all API sub-routers
"""
from fastapi import APIRouter

api_router = APIRouter()

from app.api.v1 import auth, users

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
