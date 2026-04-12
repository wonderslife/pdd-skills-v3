"""
Base OAuth Provider - Abstract base class & data structures

所有第三方 OAuth 必须继承此类并实现:
- get_auth_url()
- exchange_code()
- get_user_info()
- normalize_user()
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from enum import Enum


class OAuthProviderType(str, Enum):
    """OAuth 提供商类型"""
    WECHAT_OPEN = "wechat_open"
    WECHAT_MINI = "wechat_mini"
    WECOM = "wecom"
    DINGTALK = "dingtalk"
    FEISHU = "feishu"
    OIDC = "oidc"


@dataclass
class OAuthUser:
    """标准化的第三方用户信息"""
    provider: str
    open_id: str
    union_id: Optional[str] = None

    name: str = ""
    avatar: str = ""
    email: Optional[str] = None
    phone: Optional[str] = None

    raw_data: Dict[str, Any] = field(default_factory=dict)

    department_ids: list = field(default_factory=list)
    role_codes: list = field(default_factory=list)
    is_admin: bool = False
    is_manager: bool = False


@dataclass
class AuthURLResult:
    """获取授权 URL 的结果"""
    url: str
    state: str
    qr_code_url: Optional[str] = None


@dataclass
class TokenResult:
    """Token 交换结果"""
    access_token: str
    refresh_token: Optional[str] = None
    expires_in: int = 7200
    scope: str = ""
    id_token: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CallbackResult:
    """OAuth 回调处理最终结果"""
    success: bool
    user: Optional[OAuthUser] = None
    token_result: Optional[TokenResult] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    is_new_user: bool = False


class BaseOAuthProvider(ABC):
    """OAuth Provider 抽象基类"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.provider_type: OAuthProviderType = None

    @property
    @abstractmethod
    def name(self) -> str: pass

    @property
    def app_id(self) -> str: return self.config.get("app_id", "")
    @property
    def app_secret(self) -> str: return self.config.get("app_secret", "")

    @abstractmethod
    async def get_auth_url(
        self, redirect_uri: str, state=None, **kwargs
    ) -> AuthURLResult: pass

    @abstractmethod
    async def exchange_code(
        self, code, redirect_uri=None, **kwargs
    ) -> TokenResult: pass

    @abstractmethod
    async def get_user_info(
        self, access_token, open_id=None, **kwargs
    ) -> OAuthUser: pass

    async def handle_callback(
        self, code, state=None, redirect_uri=None, **kwargs
    ) -> CallbackResult:
        try:
            token_result = await self.exchange_code(code, redirect_uri, **kwargs)
            user = await self.get_user_info(token_result.access_token, **kwargs)
            return CallbackResult(success=True, user=user, token_result=token_result)
        except Exception as e:
            return CallbackResult(success=False, error=str(e))

    async def refresh_token(self, refresh_token: str) -> TokenResult:
        raise NotImplementedError
