# 移动端支持 + OAuth2 单点登录设计文档

> **PDD-Scaffold 脚手架 - 响应式多端 + 统一认证**

**版本**: v1.0.0  
**日期**: 2026-04-12  
**状态**: 设计完成，待实现

---

## 目录

- [1. 功能概述](#1-功能概述)
- [2. 需求分析](#2-需求分析)
- [3. OAuth2 统一认证架构](#3-oauth2-统一认证架构)
- [4. BaseOAuthProvider 设计](#4-baseoauthprovider-设计)
- [5. 各平台 Provider 实现](#5-各平台-provider-实现)
- [6. OIDC/IdP 标准协议支持](#6-oidcidp-标准协议支持)
- [7. 用户绑定与统一身份](#7-用户绑定与统一身份)
- [8. 移动端响应式适配方案](#8-移动端响应式适配方案)
- [9. API 接口设计](#9-api-接口设计)
- [10. 模板集成方案](#10-模板集成方案)
- [11. 实现计划](#11-实现计划)

---

## 1. 功能概述

### 1.1 两大核心能力

| 能力 | 说明 | 目标 |
|------|------|------|
| **OAuth2 SSO** | 统一对接企业微信、钉钉、飞书、微信、Keycloak 等平台 | 一套代码，多平台登录 |
| **移动端适配** | Vue3 + Vite 一套代码同时适配 PC 和移动端 (H5) | 响应式布局 + 交互优化 |

### 1.2 支持的 OAuth 平台

| 平台 | 类型 | 场景 |
|------|------|------|
| **企业微信** | OAuth2 | PC 扫码 / H5 内嵌免登 / 小程序 |
| **钉钉** | OAuth2 | PC 扫码 / H5 免登 / 小程序 |
| **飞书** | OAuth2 | PC 扫码 / H5 免登 / 小程序 |
| **微信开放平台** | OAuth2 | PC 扫码登录 |
| **微信小程序** | wx.login() | 小程序原生登录 |
| **OIDC (Keycloak/Authing)** | OpenID Connect | 企业 IdP 标准协议 |

### 1.3 设计目标

- ✅ **统一接口** - 前端只需切换 `provider` 参数
- ✅ **可扩展** - 新增平台只需实现 `BaseOAuthProvider`
- ✅ **自动绑定** - 同一用户跨平台自动关联
- ✅ **安全合规** - PKCE、state 防重放、token 刷新
- ✅ **响应式** - PC/H5/小程序 全覆盖

---

## 2. 需求分析

### 2.1 OAuth2 登录流程

```
用户点击"XX登录" → 跳转授权页面 → 用户确认 → 回调 → 换取Token → 获取用户信息 → 绑定/创建用户 → 签发JWT → 登录完成
```

### 2.2 移动端特殊场景

| 场景 | 处理方式 |
|------|----------|
| 企业微信内嵌 H5 | JS-SDK 免登 (`wx.qy.login`) |
| 钉钉内嵌 H5 | SDK 免登 (`dd.runtime.permission.requestAuthCode`) |
| 飞书内嵌 H5 | SDK 免登 (`tt.login`) |
| 微信小程序 | `wx.login()` 获取 code |
| 独立浏览器 H5 | 与 PC 相同 OAuth 流程 |

### 2.3 功能需求清单

| 编号 | 需求 | 优先级 |
|------|------|--------|
| MO-001 | 统一 OAuth Provider 抽象层 | P0 |
| MO-002 | 企业微信扫码+内嵌登录 | P0 |
| MO-003 | 钉钉扫码+免登 | P0 |
| MO-004 | 飞书扫码+免登 | P0 |
| MO-005 | 微信开放平台/小程序登录 | P0 |
| MO-006 | OIDC (Keycloak) 标准协议 | P0 |
| MO-007 | 用户自动绑定（手机号/unionid 匹配） | P0 |
| MO-008 | Token 自动刷新机制 | P1 |
| MO-009 | PC 端响应式基础适配 | P0 |
| MO-010 | 移动端专属交互优化 | P1 |
| MO-011 | 底部导航 + 手势操作 | P1 |
| MO-012 | 多端登录状态同步 | P2 |

---

## 3. OAuth2 统一认证架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OAuth2 + 移动端 完整架构                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ═════════════════════════════════════════════════════════════════    │
│                         客户端层 (多端)                                │
│  ═════════════════════════════════════════════════════════════════    │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │   PC Web     │  │   H5 移动端   │  │  微信小程序   │  │ 企业微信   │ │
│  │ (Vue3+Vite)  │  │ (响应式)      │  │ (uni-app)    │  │ (内嵌H5)  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬─────┘ │
│         └────────────────┼────────────────┼──────────────────┘         │
│                          ▼                  ▼                          │
│                 ┌──────────────────────────────────┐                    │
│                 │      前端 Auth Service            │                    │
│                 │  • provider 选择                 │                    │
│                 │  • Token 存储                     │                    │
│                 │  • 自动刷新                       │                    │
│                 └─────────────────┬────────────────┘                    │
│                                   │                                     │
│  ══════════════════════════════╪════════════════════════════════    │
│                           API 层 (FastAPI)                              │
│  ══════════════════════════════╪════════════════════════════════    │
│                                   │                                     │
│           ┌───────────────────────┼───────────────────────┐              │
│           ▼                       ▼                       ▼              │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────┐   │
│  │ /auth/{provider}│  │ /auth/callback   │  │ /auth/userinfo        │   │
│  │ (获取授权URL)    │  │ (OAuth回调)      │  │ (获取当前用户信息)     │   │
│  └────────┬────────┘  └────────┬─────────┘  └──────────────────────┘   │
│           │                     │                                        │
│           ▼                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    OAuthProviderRegistry                        │   │
│  │                                                                  │   │
│  │   registry = {                                                  │   │
│  │     "wechat_open": WeChatOpenProvider,                          │   │
│  │     "wechat_mini": WeChatMiniProvider,                          │   │
│  │     "wecom": WeComProvider,                                    │   │
│  │     "dingtalk": DingTalkProvider,                              │   │
│  │     "feishu": FeiShuProvider,                                  │   │
│  │     "oidc": OIDCProvider                                       │   │
│  │   }                                                             │   │
│  └────────────────────────────┬────────────────────────────────────┘   │
│                               │                                           │
│          ┌────────────────────┼────────────────────┐                   │
│          ▼                    ▼                    ▼                   │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐             │
│  │ WeChat       │   │ FeiShu       │   │ DingTalk     │             │
│  │ Providers    │   │ Provider     │   │ Provider     │             │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘             │
│         │                  │                  │                     │
│         └──────────────────┼──────────────────┘                     │
│                            ▼                                         │
│               ┌────────────────────────┐                             │
│               │   BaseOAuthProvider    │ ◀── 抽象基类              │
│               │                        │                             │
│               │ • get_auth_url()      │                             │
│               │ • exchange_code()    │                             │
│               │ • get_user_info()    │                             │
│               │ • normalize_user()   │ ← 统一用户格式              │
│               └───────────┬────────────┘                             │
│                           │                                          │
│                           ▼                                          │
│               ┌────────────────────────┐                             │
│               │   UserBindingService   │                             │
│               │   (用户绑定/自动匹配)   │                             │
│               └───────────┬────────────┘                             │
│                           │                                          │
│                           ▼                                          │
│               ┌────────────────────────┐                             │
│               │   JWT Token 签发        │                             │
│               └────────────────────────┘                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 认证时序图

```
┌──────┐     ┌──────────┐     ┌──────────────┐     ┌──────────┐     ┌──────────┐
│ 前端  │     │ FastAPI  │     │ OAuthProvider│     │ 第三方平台 │     │  数据库  │
└──┬───┘     └────┬─────┘     └──────┬───────┘     └─────┬────┘     └────┬─────┘
   │              │                  │                   │               │
   │ ① GET        │                  │                   │               │
   │ /auth/wecom/url?redirect=...                │               │
   │─────────────▶│                  │                   │               │
   │              │ ② get_auth_url() │                   │               │
   │              │─────────────────▶│                   │               │
   │              │  返回授权 URL     │                   │               │
   │◀─────────────│                  │                   │               │
   │              │                  │                   │               │
   │ ③ 跳转到企业微信授权页                                    │               │
   │──────────────────────────────────────────────────▶│               │
   │              │                  │                   │ ④ 用户确认授权  │
   │              │                  │                   │               │
   │ ⑤ 重定向回调: callback?code=xxx&state=yyy         │               │
   │◀──────────────────────────────────────────────────│               │
   │              │                  │                   │               │
   │ ⑥ POST /auth/wecom/callback {code, state}          │               │
   │─────────────▶│                  │                   │               │
   │              │ ⑦ exchange_code()│                   │               │
   │              │─────────────────▶│                   │               │
   │              │                  │ ⑧ 用 code 换 token  │               │
   │              │                  │──────────────────▶│               │
   │              │                  │                   │ 返回 token    │
   │              │                  │◀──────────────────│               │
   │              │                  │                   │               │
   │              │ ⑨ get_user_info()│                   │               │
   │              │─────────────────▶│                   │               │
   │              │                  │ ⑩ 获取用户详情      │               │
   │              │                  │──────────────────▶│               │
   │              │                  │                   │ 返回用户信息   │
   │              │                  │◀──────────────────│               │
   │              │                  │                   │               │
   │              │ ⑪ normalize_user()→ 统一格式                      │
   │              │ ⑪ UserBindingService.bind_or_create()           │
   │              │ ⑪ JWT Token 签发                                 │
   │              │                  │                   │               │
   │◀─────────────│ 返回 {access_token, user, is_new_user}          │
   │              │                  │                   │               │
   │ ⑫ 存储 Token，后续请求携带 Authorization header               │
   │              │                  │                   │               │
```

---

## 4. BaseOAuthProvider 设计

### 4.1 核心数据结构

```python
# backend/app/core/oauth/base.py

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
    """
    标准化的第三方用户信息
    
    所有 Provider 必须将原始数据转换为此格式
    """
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
    """
    OAuth Provider 抽象基类
    
    所有第三方 OAuth 必须继承此类并实现:
    - get_auth_url()
    - exchange_code()
    - get_user_info()
    - normalize_user()
    """
    
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
    async def get_auth_url(self, redirect_uri, state=None, **kwargs) -> AuthURLResult: pass
    
    @abstractmethod
    async def exchange_code(self, code, redirect_uri=None, **kwargs) -> TokenResult: pass
    
    @abstractmethod
    async def get_user_info(self, access_token, open_id=None, **kwargs) -> OAuthUser: pass
    
    async def handle_callback(self, code, state=None, redirect_uri=None, **kwargs) -> CallbackResult:
        """封装完整的回调处理链路"""
        try:
            token_result = await self.exchange_code(code, redirect_uri, **kwargs)
            user = await self.get_user_info(token_result.access_token, **kwargs)
            return CallbackResult(success=True, user=user, token_result=token_result)
        except Exception as e:
            return CallbackResult(success=False, error=str(e))
    
    async def refresh_token(self, refresh_token: str) -> TokenResult:
        raise NotImplementedError
```

### 4.2 Provider 注册表

```python
# backend/app/core/oauth/registry.py

class OAuthProviderRegistry:
    _providers: Dict[str, Type[BaseOAuthProvider]] = {}
    _instances: Dict[str, BaseOAuthProvider] = {}
    
    @classmethod
    def register(cls, provider_class: Type[BaseOAuthProvider]):
        instance = provider_class(cls._get_config(provider_class.name))
        cls._instances[provider_class.name] = instance
        return instance
    
    @classmethod
    def get(cls, name: str) -> Optional[BaseOAuthProvider]:
        return cls._instances.get(name)
    
    @classmethod
    def get_all_names(cls) -> list: return list(cls._instances.keys())
    
    @classmethod
    def get_available_providers(cls) -> list:
        return [{"name": n, "display_name": getattr(i, 'display_name', n),
                 "icon": getattr(i, '', ''), "enabled": True}
                for n, i in cls._instances.items()]
    
    @staticmethod
    def _get_config(provider_name: str) -> dict:
        from app.core.config import settings
        return (settings.OAUTH_PROVIDERS or {}).get(provider_name, {})
```

---

## 5. 各平台 Provider 实现

### 5.1 目录结构

```
backend/app/core/oauth/
├── __init__.py                 # 导出 + init 函数
├── base.py                     # 抽象基类 + 数据结构
├── registry.py                 # 注册表
├── exceptions.py              # 异常定义
├── providers/
│   ├── __init__.py
│   ├── wechat_open.py          # 微信开放平台
│   ├── wechat_mini.py          # 微信小程序
│   ├── wecom.py                # 企业微信
│   ├── dingtalk.py            # 钉钉
│   ├── feishu.py               # 飞书
│   └── oidc.py                 # OIDC 标准
└── services/
    └── user_binding_service.py # 用户绑定服务
```

### 5.2 企业微信 Provider (完整实现)

```python
# backend/app/core/oauth/providers/wecom.py

import hashlib
import time
import httpx
from typing import Dict, Any

from ..base import (
    BaseOAuthProvider, OAuthProviderType,
    OAuthUser, AuthURLResult, TokenResult
)


class WeComProvider(BaseOAuthProvider):
    """
    企业微信 OAuth Provider
    
    支持模式:
    - web: PC 扫码登录 (网页应用)
    - embed: 内嵌 H5 免登 (企业微信内)
    """
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.provider_type = OAuthProviderType.WECOM
        self.corp_id = config.get("corp_id", "")
        self.agent_id = config.get("agent_id", "")
        self._client = httpx.AsyncClient(timeout=10.0)
    
    @property
    def name(self) -> str: return "wecom"
    @property
    def display_name(self) -> str: return "企业微信"
    
    async def get_auth_url(
        self, redirect_uri: str, state: str = None,
        mode: str = "web", **kwargs
    ) -> AuthURLResult:
        if not state:
            state = self._gen_state()
        
        base_url = "https://open.weixin.com/connect/oauth2/authorize"
        params = {
            "appid": self.app_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": kwargs.get("scope", "snsapi_base"),
            "state": state,
        }
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{base_url}?{qs}#wechat_redirect"
        
        return AuthURLResult(url=url, state=state)
    
    async def exchange_code(self, code, redirect_uri=None, **kwargs) -> TokenResult:
        url = "https://qyapi.weixin.qq.com/cgi-bin/gettoken"
        resp = await self._client.get(url, params={
            "corpid": self.corp_id, "corpsecret": self.app_secret
        })
        data = resp.json()
        if data.get("errcode", 0) != 0:
            raise Exception(f"获取token失败: {data.get('errmsg')}")
        
        access_token = data["access_token"]
        
        user_resp = await self._client.get(
            "https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo",
            params={"access_token": access_token, "code": code}
        )
        user_data = user_resp.json()
        if user_data.get("errcode", 0) != 0:
            raise Exception(f"获取用户失败: {user_data.get('errmsg')}")
        
        return TokenResult(
            access_token=access_token,
            expires_in=data.get("expires_in", 7200),
            raw=user_data
        )
    
    async def get_user_info(self, access_token, userid=None, **kwargs) -> OAuthUser:
        raw = kwargs.get("raw", {})
        userid = userid or raw.get("userid") or raw.get("UserId")
        
        if not userid:
            open_userid = raw.get("open_userid") or raw.get("OpenId")
            return OAuthUser(provider=self.name, open_id=open_userid or "",
                            name="外部联系人")
        
        resp = await self._client.get(
            "https://qyapi.weixin.qq.com/cgi-bin/user/get",
            params={"access_token": access_token, "userid": userid}
        )
        info = resp.json()
        if info.get("errcode", 0) != 0:
            raise Exception(f"成员详情失败: {info.get('errmsg')}")
        
        return OAuthUser(
            provider=self.name,
            open_id=info.get("userid", ""),
            name=info.get("name", ""),
            avatar=info.get("avatar", ""),
            mobile=info.get("mobile"),
            email=info.get("email"),
            phone=info.get("mobile"),
            department_ids=info.get("department", []),
            is_admin=info.get("isleader", 0) == 1,
            raw_data=info
        )
    
    def _gen_state(self):
        raw = f"wecom:{time.time()}:{self.app_id}"
        return hashlib.sha256(raw.encode()).hexdigest()[:32]
```

### 5.3 飞书 Provider (精简版)

```python
# backend/app/core/oauth/providers/feishu.py

import httpx, secrets
from .base import BaseOAuthProvider, OAuthProviderType, OAuthUser, AuthURLResult, TokenResult


class FeiShuProvider(BaseOAuthProvider):
    def __init__(self, config):
        super().__init__(config)
        self.provider_type = OAuthProviderType.FEISHU
        self._client = httpx.AsyncClient(timeout=10.0)
    
    @property
    def name(self): return "feishu"
    
    async def get_auth_url(self, redirect_uri, state=None, **kwargs) -> AuthURLResult:
        state = state or secrets.token_urlsafe(32)
        url = (
            f"https://open.feishu.cn/open-apis/authen/v1/authorize?"
            f"app_id={self.app_id}&redirect_uri={redirect_uri}&state={state}"
        )
        return AuthURLResult(url=url, state=state)
    
    async def exchange_code(self, code, **kwargs) -> TokenResult:
        resp = await self._client.post(
            "https://open.feishu/open-apis/authen/v1/access_token",
            json={"app_id": self.app_id, "app_secret": self.app_secret,
                   "grant_type": "authorization_code", "code": code}
        )
        data = resp.json()
        if data.get("code") != 0:
            raise Exception(f"飞书token失败: {data.get('msg')}")
        return TokenResult(access_token=data["access_token"],
                          refresh_token=data.get("refresh_token"),
                          expires_in=data.get("expire", 7200), raw=data)
    
    async def get_user_info(self, access_token, **kwargs) -> OAuthUser:
        headers = {"Authorization": f"Bearer {access_token}"}
        resp = await self._client.get(
            "https://open.feishu/open-apis/authen/v1/user_info",
            headers=headers
        )
        data = resp.json()
        if data.get("code") != 0:
            raise Exception(f"飞书用户失败: {data.get('msg')}")
        sub = data.get("data", {})
        return OAuthUser(provider=self.name, open_id=sub.get("open_id", ""),
                        union_id=sub.get("union_id"), name=sub.get("name", ""),
                        avatar=sub.get("avatar_url"), email=sub.get("email"),
                        phone=sub.get("mobile"), raw_data=sub)
```

### 5.4 钉钉 Provider (关键点)

```python
# 钉钉特有: 使用 authCode 换取用户信息 (无需先换 token)

async def exchange_code(self, code, **kwargs) -> TokenResult:
    resp = await self._client.post(
        "https://oapi.dingtalk.com/topapi/v2/user/getuserinfo",
        data={"code": code}
    )
    data = resp.json()
    # 钉钉直接返回用户信息，无需额外请求 userinfo
    return TokenResult(
        access_token="dingtalk_direct",
        raw=data  # 包含 nick, openid, unionId, mobile 等
    )

async def get_user_info(self, access_token, **kwargs) -> OAuthUser:
    raw = kwargs.get("raw", {})
    return OAuthUser(
        provider=self.name,
        open_id=raw.get("openid", ""),
        union_id=raw.get("unionId"),
        name=raw.get("nick", ""),
        avatar=raw.get("avatarUrl", ""),
        phone=raw.get("mobile"),
        raw_data=raw
    )
```

---

## 6. OIDC/IdP 标准协议支持

### 6.1 OIDC Provider 设计要点

```python
# backend/app/core/oauth/providers/oidc.py

class OIDCProvider(BaseOAuthProvider):
    """
    标准 OIDC / OpenID Connect Provider
    
    兼容: Keycloak / Authing / Auth0 / 任何标准 IdP
    """
    
    # OIDC 标准端点
    authorization_endpoint  # /protocol/openid-connect/auth
    token_endpoint          # /protocol/openid-connect/token
    userinfo_endpoint      # /protocol/openid-connect/userinfo
    jwks_endpoint          # /protocol/openid-connect/certs (可选)
    
    # PKCE 支持 (推荐用于 SPA/H5)
    pkce_enabled: bool = True
    code_challenge_method = "S256"
    
    async def get_auth_url(self, redirect_uri, state=None, **kwargs) -> AuthURLResult:
        # 构建 OIDC 授权 URL
        # 支持 PKCE: 生成 code_verifier → code_challenge
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "scope": kwargs.get("scope", "openid profile email phone"),
            "state": state,
            "nonce": secrets.token_urlsafe(16),
        }
        if self.pkce_enabled:
            verifier = secrets.token_urlsafe(64)
            challenge = self._s256(verifier)
            params["code_challenge"] = challenge
            params["code_challenge_method"] = "S256"
            # verifier 存入 session 或返回给前端
        
        url = f"{self.authorization_endpoint}?{urlencode(params)}"
        result = AuthURLResult(url=url, state=state)
        result.pkce_code_verifier = verifier
        return result
    
    async def exchange_code(self, code, redirect_uri=None, 
                              code_verifier=None, **kwargs) -> TokenResult:
        data = {
            "grant_type": "authorization_code_with_pkce" if code_verifier else "authorization_code",
            "code": code,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }
        if code_verifier:
            data["code_verifier"] = code_verifier
        
        resp = await self._client.post(self.token_endpoint, data=data)
        token_data = resp.json()
        return TokenResult(
            access_token=token_data["access_token"],
            refresh_token=token_data.get("refresh_token"),
            id_token=token_data.get("id_token"),  # JWT 格式
            raw=token_data
        )
    
    async def get_user_info(self, access_token, id_token=None, **kwargs) -> OAuthUser:
        headers = {"Authorization": f"Bearer {access_token}"}
        resp = await self._client.get(self.userinfo_endpoint, headers=headers)
        userinfo = resp.json()
        
        id_claims = self._decode_id_token(id_token) if id_token else {}
        
        return OAuthUser(
            provider=self.name,
            open_id=userinfo.get("sub") or id_claims.get("sub", ""),
            union_id=id_claims.get("unionid") or userinfo.get("preferred_username"),
            name=userinfo.get("name") or id_claims.get("name", ""),
            avatar=userinfo.get("picture"),
            email=userinfo.get("email"),
            phone=userinfo.get("phone_number"),
            role_codes=self._extract_roles(userinfo, id_claims),
            is_admin=self._check_admin(userinfo, id_claims),
            raw_data={**userinfo, "id_claims": id_claims}
        )
    
    @staticmethod
    def _s256(verifier: str) -> str:
        import base64, hashlib
        digest = hashlib.sha256(verifier.encode()).digest()
        return base64.urlsafe_b64encode(digest).rstrip(b'=').decode()
    
    @staticmethod
    def _decode_id_token(id_token: str) -> Optional[dict]:
        try:
            parts = id_token.split('.')
            if len(parts) >= 2:
                payload = parts[1]
                padding = 4 - len(payload) % 4
                if padding != 4: payload += '=' * padding
                import json, base64
                return json.loads(base64.urlsafe_b64decode(payload))
        except: pass
        return None
```

### 6.2 Keycloak 配置示例

```yaml
oauth.providers.oidc:
  display_name: "统一认证"
  icon: "keycloak"
  issuer_url: "https://keycloak.example.com/realms/myorg"
  client_id: "my-app-client"
  client_secret: "${KEYCLOAK_CLIENT_SECRET}"
  default_scope: "openid profile email phone"
  pkce_enabled: true
  
  # 如需自定义端点（覆盖自动拼接）
  # authorization_endpoint: "https://keycloak.example.com/..."
  # token_endpoint: "https://keycloak.example.com/..."
  # userinfo_endpoint: "https://keycloak.example.com/..."
```

---

## 7. 用户绑定与统一身份

### 7.1 数据模型

```sql
-- 主用户表 (已有 users 表增加字段)
ALTER TABLE users ADD COLUMN phone VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN union_id VARCHAR(64);

-- OAuth 绑定关系表
CREATE TABLE oauth_bindings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '系统用户ID',
    provider VARCHAR(30) NOT NULL COMMENT 'wechat/wecom/dingtalk/feishu/oidc',
    open_id VARCHAR(128) NOT NULL COMMENT '平台唯一标识',
    union_id VARCHAR(128) COMMENT '跨应用统一标识',
    nickname VARCHAR(100),
    avatar_url VARCHAR(500),
    raw_data JSON COMMENT '原始数据备份',
    bound_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '绑定时间',
    last_login_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status TINYINT DEFAULT 1 COMMENT '1=正常 0=解绑',
    
    UNIQUE KEY uk_provider_openid (provider, open_id),
    INDEX idx_user_id (user_id),
    INDEX idx_union_id (union_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB COMMENT='OAuth 绑定关系表';
```

### 7.2 UserBindingService

```python
# backend/app/services/user_binding_service.py

class UserBindingService:
    """用户绑定服务"""
    
    async def bind_or_create(self, oauth_user: OAuthUser) -> tuple[User, bool]:
        """
        绑定或创建用户
        
        Returns:
            (user, is_new_user)
            
        绑定策略 (按优先级):
        1. 已有 open_id + provider 的直接绑定 → 返回已存在用户
        2. 有 union_id 且匹配其他绑定的 union_id → 关联到同一用户
        3. 有手机号且系统中存在该手机号的用户 → 关联
        4. 以上都不匹配 → 创建新用户 + 新绑定
        """
        
        # Step 1: 查找已有绑定
        binding = self.db.query(OAuthBinding).filter(
            OAuthBinding.provider == oauth_user.provider,
            OAuthBinding.open_id == oauth_user.open_id,
            OAuthBinding.status == 1
        ).first()
        
        if binding:
            user = self.db.query(User).get(binding.user_id)
            self._update_login_time(binding)
            return user, False
        
        # Step 2: 尝试 union_id 匹配
        if oauth_user.union_id:
            existing_binding = self.db.query(OAuthBinding).filter(
                OAuthBinding.union_id == oauth_user.union_id,
                OAuthBinding.status == 1
            ).first()
            
            if existing_binding:
                new_binding = OAuthBinding(
                    user_id=existing_binding.user_id,
                    provider=oauth_user.provider,
                    open_id=oauth_user.open_id,
                    union_id=oauth_user.union_id,
                    nickname=oauth_user.name,
                    avatar_url=oauth_user.avatar
                )
                self.db.add(new_binding)
                self.db.commit()
                
                user = self.db.query(User).get(existing_binding.user_id)
                return user, False
        
        # Step 3: 尝试手机号匹配
        if oauth_user.phone:
            existing_user = self.db.query(User).filter(
                User.phone == oauth_user.phone
            ).first()
            
            if existing_user:
                binding = OAuthBinding(
                    user_id=existing_user.id,
                    provider=oauth_user.provider,
                    open_id=oauth_user.open_id,
                    union_id=oauth_user.union_id
                )
                self.db.add(binding)
                self.db.commit()
                return existing_user, False
        
        # Step 4: 创建新用户
        user = User(
            username=f"{oauth_user.provider}_{oauth_user.open_id}",
            name=oauth_user.name,
            avatar=oauth_user.avatar,
            phone=oauth_user.phone,
            email=oauth_user.email,
            is_active=True
        )
        self.db.add(user)
        self.db.flush()
        
        binding = OAuthBinding(
            user_id=user.id,
            provider=oauth_user.provider,
            open_id=oauth_user.open_id,
            union_id=oauth_user.union_id
        )
        self.db.add(binding)
        self.db.commit()
        
        return user, True
```

---

## 8. 移动端响应式适配方案

### 8.1 分层架构

```
Layer 1: 基础设施层
├── PostCSS + postcss-pxtorem (px → rem)
├── amfe-flexible (动态根字体大小)
└── 断点系统: xs/sm/md/lg/xl/xxl

Layer 2: 组件库适配
├── PC: Element Plus (完整)
├── 移动: Element Plus (按需) + 移动增强组件
└── 可选: Vant 3 / NutUI (纯移动场景)

Layer 3: 布局适配
├── PC: Sidebar + Header + Main
└── Mobile: Header + Full Content + Bottom Nav

Layer 4: 业务页面
├── views/shared/ (自动适配)
├── views/pc/ (桌面优化)
└── views/mobile/ (移动优化)
```

### 8.2 断点系统

```scss
$breakpoints: (
  'xs': 0,        // 手机竖屏 (< 576px)
  'sm': 576px,    // 手机横屏
  'md': 768px,    // 平板竖屏  ← PC/Mobile 分界线
  'lg': 992px,    // 平板横屏
  'xl': 1200px,   // 桌面
  'xxl': 1600px   // 大屏
);
```

### 8.3 useResponsive Composable

```typescript
export function useResponsive() {
  const windowWidth = ref(window.innerWidth)
  
  const breakpoint = computed(() => {
    if (windowWidth.value < 576) return 'xs'
    if (windowWidth.value < 768) return 'sm'
    if (windowWidth.value < 992) return 'md'
    if (windowWidth.value < 1200) return 'lg'
    if (windowWidth.value < 1600) return 'xl'
    return 'xxl'
  })
  
  const isMobile = computed(() => ['xs', 'sm', 'md'].includes(breakpoint.value))
  const isDesktop = computed(() => !isMobile.value)
  
  return { windowWidth, breakpoint, isMobile, isDesktop }
}
```

### 8.4 组件适配策略

| 组件 | PC | 移动端 | 方式 |
|------|-----|--------|------|
| 导航 | Sidebar | BottomTabBar | 条件渲染 |
| 表格 | el-table | 卡片列表 / 横向滚动 | isMobile 切换 |
| 表单 | Dialog 弹窗 | 全屏页面 / ActionSheet | 组件切换 |
| 分页 | Pagination | Infinite Scroll | 行为替换 |
| 菜单 | Dropdown | Popup | 交互替换 |

---

## 9. API 接口设计

### 9.1 认证 API

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/auth/providers` | 列出可用登录方式 | - |
| GET | `/auth/{provider}/url` | 获取授权 URL | redirect_uri, state |
| POST | `/auth/{provider}/callback` | OAuth 回调 | code, state |
| POST | `/auth/{provider}/mini-login` | 小程序登录 | code |
| POST | `/auth/sdk-login` | SDK 免登 (企微/钉钉/飞书内嵌) | authCode, provider |
| GET | `/auth/user/me` | 当前用户信息 | Authorization header |
| POST | `/auth/refresh` | 刷新 Token | refresh_token |
| POST | `/auth/logout` | 登出 | - |
| POST | `/auth/bind-phone` | 绑定手机号 | phone, code |
| GET | `/auth/bindings/list` | 我的绑定列表 | - |
| DELETE | `/auth/bindings/{id}` | 解除绑定 | - |

### 9.2 请求/响应示例

```json
// POST /api/v1/auth/wecom/callback
// Request:
{
  "code": "xxxxxxxxxxxx",
  "state": "abc123def456"
}

// Response (成功):
{
  "code": 200,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "expires_in": 86400,
    "user": {
      "id": 1001,
      "username": "zhangsan",
      "name": "张三",
      "avatar": "https://...",
      "phone": "138****8888"
    },
    "is_new_user": false,
    "provider": "wecom"
  }
}

// Response (新用户需完善信息):
{
  "is_new_user": true,
  "need_complete_profile": true,
  "temp_token": "eyJ..."  // 临时 token，仅用于完善信息
}
```

---

## 10. 模板集成方案

### 10.1 脚手架初始化选项

```bash
$ pdd scaffold:init my-project

? 启用 OAuth2 SSO: Yes
? 支持的登录方式: (多选)
  ☑ 企业微信
  ☑ 钉钉
  ☑ 飞书
  ☑ 微信
  ☑ OIDC (Keycloak)
? 启用移动端响应式: Yes
? 默认登录方式: wecom
```

### 10.2 生成的文件

```
backend/app/
├── core/
│   └── oauth/                    # ★ OAuth 模块 (~12个文件)
│       ├── __init__.py
│       ├── base.py
│       ├── registry.py
│       ├── exceptions.py
│       ├── providers/
│       │   ├── __init__.py
│       │   ├── wechat_open.py
│       │   ├── wechat_mini.py
│       │   ├── wecom.py
│       │   ├── dingtalk.py
│       │   ├── feishu.py
│       │   └── oidc.py
│       └── services/
│           └── user_binding_service.py
├── models/
│   └── oauth_binding.py           # ★ OAuth 绑定模型
├── api/v1/
│   └── auth.py                    # ★ 认证 API
└── schemas/
    └── auth.py                     # ★ 认证 Schema

frontend/src/
├── composables/
│   └── useResponsive.ts          # ★ 响应式 Hook
├── styles/
│   ├── breakpoints.scss           # ★ 断点变量
│   ├── responsive.scss           # ★ 响应式 mixin
│   └── mobile.scss               # ★ 移动端样式
├── layouts/
│   ├── DefaultLayout.vue          # ★ PC 布局
│   └── MobileLayout.vue          # ★ 移动端布局
├── views/
│   └── auth/
│       ├── Login.vue              # ★ 登录页 (含多平台选择)
│       ├── BindPhone.vue          # ★ 绑定手机号
│       └── ProfileComplete.vue    # ★ 新用户完善信息
└── components/
    ├── auth/
    │   ├── LoginProviderList.vue   # ★ 登录方式列表
    │   ├── QRCodeLogin.vue        # ★ 二维码扫码组件
    │   └── BindingStatus.vue      # ★ 绑定状态展示
    └── mobile/
        ├── BottomNav.vue           # ★ 底部导航
        ├── PullRefresh.vue        # ★ 下拉刷新
        └── InfiniteScroll.vue     # ★ 无限滚动
```

---

## 11. 实现计划

### 11.1 开发阶段

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| **MO-P1** | BaseOAuthProvider + Registry + 数据模型 | 1.5 天 |
| **MO-P2** | 企业微信 + 钉钉 + 飞书 Provider | 2 天 |
| **MO-P3** | 微信开放平台 + 小程序 Provider | 1 天 |
| **MO-P4** | OIDC Provider (PKCE + ID Token) | 1.5 天 |
| **MO-P5** | UserBindingService + 绑定逻辑 | 1 天 |
| **MO-P6** | 认证 API 层 + JWT 集成 | 1.5 天 |
| **MO-P7** | 响应式基础设施 (断点/mixin/useResponsive) | 1 天 |
| **MO-P8** | 移动端布局 + 组件适配 | 1.5 天 |
| **MO-P9** | 前端登录页 + 多平台选择 UI | 1.5 天 |
| **MO-P10** | 测试 + 文档 + 脚手架集成 | 1.5 天 |
| **合计** | | **15 天** |

### 11.2 里程碑

| 里程碑 | 内容 | 验收标准 |
|--------|------|----------|
| **M-MO1** | OAuth 引擎就绪 | 能通过任一平台登录并签发 JWT |
| **M-MO2** | 6 大平台全覆盖 | 企业微信/钉钉/飞书/微信/OIDC 全部可用 |
| **M-MO3** | 用户绑定正常 | 跨平台登录能识别同一用户 |
| **M-MO4** | 移动端适配完成 | H5 在各 App 内嵌正常使用 |
| **M-MO5** | 前端完整 | 登录页 + 绑定管理 + 响应式全部 OK |

---

## 附录

### A. 安全注意事项

| 项目 | 措施 |
|------|------|
| **CSRF 防护** | state 参数 + 验证回调 |
| **PKCE** | SPA/H5 强制启用 (S256) |
| **Token 安全** | httpOnly Cookie + Short TTL + Refresh Token |
| **Scope 最小化** | 只申请必要权限 |
| **HTTPS** | 所有 OAuth 端点强制 HTTPS |
| **日志脱敏** | 不记录 code/token/app_secret |

### B. 配置模板完整版

```yaml
# app/core/config.py 或 .env

OAUTH_ENABLED: true
DEFAULT_PROVIDER: wecom

OAUTH_PROVIDERS:
  wecom:
    display_name: "企业微信"
    icon: "wecom"
    app_id: "${WECOM_APP_ID}"
    app_secret: "${WECOM_APP_SECRET}"
    corp_id: "${WECOM_CORP_ID}"
    agent_id: "${WECOM_AGENT_ID}"

  dingtalk:
    display_name: "钉钉"
    icon: "dingtalk"
    app_id: "${DINGTALK_APP_KEY}"
    app_secret: "${DINGTALK_APP_SECRET}"

  feishu:
    display_name: "飞书"
    icon: "feishu"
    app_id: "${FEISHU_APP_ID}"
    app_secret: "${FEISHU_APP_SECRET}"

  wechat_open:
    display_name: "微信"
    icon: "wechat"
    app_id: "${WX_OPEN_APP_ID}"
    app_secret: "${WX_OPEN_APP_SECRET}"

  wechat_mini:
    display_name: "微信小程序"
    icon: "wechat-mini"
    app_id: "${WX_MINI_APP_ID}"
    app_secret: "${WX_MINI_APP_SECRET}"

  oidc:
    display_name: "统一认证"
    icon: "keycloak"
    issuer_url: "${OIDC_ISSUER_URL}"
    client_id: "${OIDC_CLIENT_ID}"
    client_secret: "${OIDC_CLIENT_SECRET}"
    default_scope: "openid profile email phone"
    pkce_enabled: true
```

### C. 参考文档

- [RFC 6749 - OAuth 2.0](https://tools.ietf.org/html/rfc6749)
- [RFC 7636 - Proof Key for Code Exchange (PKCE)](https://tools.ietf.org/html/rfc7636)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [企业微信开发文档](https://developer.work.weixin.qq.com/document/path/91036)
- [钉钉开放平台](https://open.dingtalk.com/document/orgapp/)
- [飞书开放平台](https://open.feishu.cn/document/)
- [Keycloak 文档](https://www.keycloak.org/documentation)

---

**文档版本**: v1.0.0  
**最后更新**: 2026-04-12  
**关联文档**: 
- [01-pdd-scaffold-design.md](./01-pdd-scaffold-design.md)
- [02-data-permission-design.md](./02-data-permission-design.md)
- [03-workflow-engine-design.md](./03-workflow-engine-design.md)
