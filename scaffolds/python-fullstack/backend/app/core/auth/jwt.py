"""
JWT Token Creation & Validation
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt, JWTError

from app.config import get_settings


class TokenPayload:
    """JWT Token payload"""

    def __init__(self, sub: int, exp: datetime, iat: datetime, **extra):
        self.sub = sub
        self.exp = exp
        self.iat = iat
        self.extra = extra


def create_access_token(
    user_id: int,
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[dict] = None,
) -> str:
    """
    Create a new JWT access token
    
    Args:
        user_id: User ID to encode in token
        expires_delta: Custom expiration time
        extra_claims: Additional claims to include
        
    Returns:
        Encoded JWT string
    """
    settings = get_settings()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode = {
        "sub": user_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        **(extra_claims or {}),
    }
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


def decode_access_token(token: str) -> Optional[TokenPayload]:
    """
    Decode and validate a JWT access token
    
    Args:
        token: JWT token string
        
    Returns:
        TokenPayload if valid, None if invalid
    """
    settings = get_settings()
    
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return TokenPayload(**payload)
    except JWTError:
        return None
    except Exception:
        return None
