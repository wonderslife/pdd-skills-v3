"""
Auth Schemas - OAuth login & authentication request/response models
"""
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class OAuthCallbackRequest(BaseModel):
    """OAuth callback request"""
    code: str = Field(..., description="Authorization code from provider")
    state: Optional[str] = None


class SDKLoginRequest(BaseModel):
    """SDK embedded login (企微/钉钉/飞书内嵌免登)"""
    auth_code: str = Field(..., description="AuthCode from SDK")
    provider: str = Field(..., description="wecom/dingtalk/feishu")


class MiniProgramLoginRequest(BaseModel):
    """WeChat mini program login"""
    code: str = Field(..., description="wx.login() code")


class AuthProviderInfo(BaseModel):
    """Available auth provider info"""
    name: str
    display_name: str
    icon: str = ""
    enabled: bool = True


class BindPhoneRequest(BaseModel):
    """Bind phone number"""
    phone: str = Field(..., pattern=r"^1[3-9]\d{9}$")
    sms_code: str = Field(..., min_length=4, max_length=8)


class RefreshTokenRequest(BaseModel):
    """Refresh token request"""
    refresh_token: str


class TokenResponse(BaseModel):
    """Token response after successful auth"""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int
    user: Dict[str, Any]
    is_new_user: bool = False
    provider: Optional[str] = None
    need_complete_profile: bool = False
    temp_token: Optional[str] = None
