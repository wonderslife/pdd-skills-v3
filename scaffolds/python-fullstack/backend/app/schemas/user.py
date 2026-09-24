"""
User Schemas - Request/Response models for User API
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    """Base user fields"""
    username: str = Field(..., min_length=3, max_length=50)
    name: str = Field(..., max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)


class UserCreate(UserBase):
    """Schema for creating a new user"""
    password: str = Field(..., min_length=6, max_length=128)
    org_id: Optional[int] = None
    is_superuser: bool = False


class UserUpdate(BaseModel):
    """Schema for updating an existing user"""
    name: Optional[str] = Field(None, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    avatar: Optional[str] = None
    org_id: Optional[int] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    """Schema for user response (read)"""
    id: int
    avatar: str = ""
    is_active: bool = True
    is_superuser: bool = False
    org_id: Optional[int] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserInfo(BaseModel):
    """Minimal user info (for JWT payload / session)"""
    id: int
    username: str
    name: str
    avatar: str = ""
    is_active: bool = True
    is_superuser: bool = False
    org_id: Optional[int] = None

    model_config = {"from_attributes": True}


class ChangePassword(BaseModel):
    """Schema for changing password"""
    old_password: str
    new_password: str = Field(..., min_length=6, max_length=128)


class LoginRequest(BaseModel):
    """Login request schema"""
    username: str
    password: str


class LoginResponse(BaseModel):
    """Login response schema with token"""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int
    user: UserInfo
