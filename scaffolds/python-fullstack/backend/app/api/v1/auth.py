"""
Authentication API - Login, Register, OAuth callback, Token refresh
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.auth.jwt import create_access_token, decode_access_token
from app.core.auth.security import verify_password, get_password_hash
from app.core.auth.dependencies import get_optional_user
from app.database.database import get_db
from app.schemas.auth import (
    LoginRequest, LoginResponse, TokenResponse,
    OAuthCallbackRequest, SDKLoginRequest,
    RefreshTokenRequest, AuthProviderInfo,
)
from app.schemas.common import ResponseModel
from app.schemas.user import UserInfo, UserCreate
from app.models.user import User
from app.config import get_settings
from datetime import timedelta

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/providers", response_model=ResponseModel[list[AuthProviderInfo]])
async def list_auth_providers():
    """列出可用的登录方式"""
    settings = get_settings()
    providers = []
    
    oauth_providers = getattr(settings, 'OAUTH_PROVIDERS', {}) or {}
    for name, config in oauth_providers.items():
        providers.append(AuthProviderInfo(
            name=name,
            display_name=config.get("display_name", name),
            icon=config.get("icon", ""),
            enabled=True,
        ))
    
    return ResponseModel(data=providers)


@router.post("/login", response_model=ResponseModel[LoginResponse])
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """用户名+密码登录"""
    result = await db.execute(
        select(User).where(User.username == body.username)
    )
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )
    
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账户已禁用")
    
    settings = get_settings()
    access_token = create_access_token(user_id=user.id)
    
    return ResponseModel(data=LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserInfo.model_validate(user),
    ))


@router.post("/register", response_model=ResponseModel[UserInfo], status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)):
    """注册新用户"""
    existing = await db.execute(
        select(User).where((User.username == body.username) | (User.email == body.email))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="用户名或邮箱已存在",
        )
    
    user = User(
        username=body.username,
        name=body.name,
        email=body.email,
        phone=body.phone,
        password_hash=get_password_hash(body.password),
        org_id=body.org_id,
        is_superuser=body.is_superuser,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return ResponseModel(data=UserInfo.model_validate(user))


@router.post("/refresh", response_model=ResponseModel[TokenResponse])
async def refresh_token(body: RefreshTokenRequest):
    """刷新 Access Token"""
    payload = decode_access_token(body.refresh_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的 refresh token",
        )
    
    settings = get_settings()
    new_token = create_access_token(
        user_id=payload.sub,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    
    return ResponseModel(data=TokenResponse(
        access_token=new_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={"id": payload.sub},
        is_new_user=False,
    ))


@router.post("/change-password", response_model=ResponseModel)
async def change_password(
    body: ... ,
    current_user: dict = Depends(get_current_user),
):
    """修改密码"""
    pass


# ===== OAuth Callback Endpoints (placeholder - full implementation in Phase 4) =====

@router.post("/{provider}/callback", response_model=ResponseModel[TokenResponse])
async def oauth_callback(
    provider: str,
    body: OAuthCallbackRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    OAuth 回调处理
    
    支持的 provider: wecom, dingtalk, feishu, wechat_open, oidc
    完整实现见 Phase 4 (core/oauth 模块)
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=f"Provider '{provider}' OAuth callback - 待 Phase 4 实现",
    )


@router.post("/sdk-login", response_model=ResponseModel[TokenResponse])
async def sdk_login(
    body: SDKLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    SDK 免登 (企微/钉钉/飞书 内嵌 H5)
    
    完整实现见 Phase 4 (core/oauth 模块)
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="SDK Login - 待 Phase 4 实现",
    )


@router.get("/me", response_model=ResponseModel[UserInfo])
async def get_auth_user(current_user: dict = Depends(get_current_user)):
    """获取当前认证用户信息"""
    return ResponseModel(data=UserInfo(**current_user))


@router.post("/logout", response_model=ResponseModel)
async def logout():
    """登出（客户端清除 Token）"""
    return ResponseModel(message="登出成功")
