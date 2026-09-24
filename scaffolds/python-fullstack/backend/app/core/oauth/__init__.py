"""
OAuth2 Unified Authentication Module

支持平台:
- 企业微信 (WeCom)
- 钉钉 (DingTalk)
- 飞书 (FeiShu)
- 微信开放平台/小程序 (WeChat)
- OIDC 标准协议 (Keycloak/Authing)

核心组件:
- BaseOAuthProvider: 抽象基类，统一接口
- OAuthProviderRegistry: Provider 注册表
- 各平台 Provider 实现
- UserBindingService: 用户自动绑定服务
"""
from .base import (
    BaseOAuthProvider, OAuthProviderType,
    OAuthUser, AuthURLResult, TokenResult, CallbackResult,
)
from .registry import OAuthProviderRegistry

__all__ = [
    "BaseOAuthProvider",
    "OAuthProviderType",
    "OAuthUser",
    "AuthURLResult",
    "TokenResult",
    "CallbackResult",
    "OAuthProviderRegistry",
]
