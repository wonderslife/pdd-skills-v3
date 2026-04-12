"""
Authentication Dependencies for FastAPI
"""
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.jwt import decode_access_token
from app.database.database import get_db
from app.exceptions import UnauthorizedError

security_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Get current authenticated user from JWT token
    
    Returns:
        dict with user info: {id, username, is_active, is_superuser, org_id}
        
    Raises:
        HTTPException 401 if not authenticated
    """
    from sqlalchemy import select
    from app.models.user import User
    
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_access_token(credentials.credentials)
    if payload is None or not hasattr(payload, 'sub'):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.sub
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return {
        "id": user.id,
        "username": user.username,
        "name": user.name,
        "email": user.email,
        "is_active": user.is_active,
        "is_superuser": getattr(user, 'is_superuser', False),
        "org_id": getattr(user, 'org_id', None),
    }


async def get_current_active_user(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Ensure the current user is active"""
    if not current_user.get("is_active"):
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
) -> Optional[dict]:
    """Get current user if authenticated, otherwise return None"""
    if not credentials or not credentials.credentials:
        return None
    
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        return None
    
    return {"id": payload.sub}
