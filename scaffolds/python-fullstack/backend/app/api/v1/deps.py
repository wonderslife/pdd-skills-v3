"""
API Dependencies - Shared dependencies for API layer
"""
from typing import Optional
from fastapi import Query
from app.schemas.common import PaginationParams


def get_pagination(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
) -> PaginationParams:
    """Extract pagination parameters from query string"""
    return PaginationParams(page=page, page_size=page_size)
