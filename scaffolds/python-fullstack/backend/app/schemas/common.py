"""
Pydantic Schemas - Common response models and base schemas
"""
from typing import Any, Generic, List, Optional, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class ResponseModel(BaseModel, Generic[T]):
    """Standard API response wrapper"""
    code: int = 200
    message: str = "success"
    data: Optional[T] = None


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated response wrapper"""
    items: List[T]
    total: int
    page: int = 1
    page_size: int = 10
    total_pages: int = 0


class PaginationParams(BaseModel):
    """Pagination query parameters"""
    page: int = 1
    page_size: int = 10

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


class ErrorResponse(BaseModel):
    """Error response model"""
    code: int
    message: str
    detail: Optional[Any] = None
