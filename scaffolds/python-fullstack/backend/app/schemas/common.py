"""
Pydantic Schemas - Common response models and base schemas
"""
from datetime import datetime, date
from typing import Any, Generic, List, Optional, TypeVar
from pydantic import BaseModel, field_serializer

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


class BaseAuditModel(BaseModel):
    """Base model with audit fields and datetime serialization.

    All response schemas that include datetime fields should inherit from this
    to ensure consistent ISO8601 serialization.

    Bug Pattern Prevention:
    - PATTERN-001: datetime fields auto-serialized to ISO8601 string
    - PATTERN-003: enum values use snake_case lowercase
    """
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_serializer("created_at", "updated_at")
    @classmethod
    def serialize_datetime(cls, v: Optional[datetime]) -> Optional[str]:
        if v is None:
            return None
        return v.isoformat()

    model_config = {"from_attributes": True}


class BaseOptionModel(BaseModel):
    """Base model for dropdown options (lightweight data for Select components).

    Bug Pattern Prevention:
    - PATTERN-006: Options API returns only id + display fields
    """
    id: int
    label: str
    value: str

    model_config = {"from_attributes": True}
