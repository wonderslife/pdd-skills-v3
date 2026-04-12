"""
WeChat Open Platform Provider - PC扫码登录 / H5登录
"""
import hashlib
import time
import httpx
from typing import Dict, Any

from ..base import BaseOAuthProvider, OAuthProviderType, OAuthUser, AuthURLResult, TokenResult


class WeChatOpenProvider(BaseOAuthProvider):
    """微信开放平台 OAuth Provider"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.provider_type = OAuthProviderType.WECHAT_OPEN
        self._client = httpx.AsyncClient(timeout=10.0)

    @property
    def name(self) -> str: return "wechat_open"
    @property
    def display_name(self) -> str: return "微信"

    async def get_auth_url(self, redirect_uri, state=None, **kwargs) -> AuthURLResult:
        state = state or self._gen_state()
        scope = kwargs.get("scope", "snsapi_login")
        
        url = (
            f"https://open.weixin.qq.com/connect/qrconnect?"
            f"appid={self.app_id}"
            f"&redirect_uri={redirect_uri}"
            f"&response_type=code"
            f"&scope={scope}"
            f"&state={state}#wechat_redirect"
        )
        return AuthURLResult(url=url, state=state)

    async def exchange_code(self, code, redirect_uri=None, **kwargs) -> TokenResult:
        url = "https://api.weixin.qq.com/sns/oauth2/access_token"
        params = {
            "appid": self.app_id,
            "secret": self.app_secret,
            "code": code,
            "grant_type": "authorization_code",
        }
        resp = await self._client.get(url, params=params)
        data = resp.json()

        if "errcode" in data and data["errcode"] != 0:
            raise Exception(f"微信token失败: {data.get('errmsg')}")

        return TokenResult(
            access_token=data["access_token"],
            expires_in=data.get("expires_in", 7200),
            refresh_token=data.get("refresh_token"),
            raw=data,
        )

    async def get_user_info(self, access_token, open_id=None, **kwargs) -> OAuthUser:
        raw = kwargs.get("raw", {})
        openid = open_id or raw.get("openid")

        if not openid:
            return OAuthUser(provider=self.name, open_id="", name="未知用户")

        url = "https://api.weixin.qq.com/sns/userinfo"
        params = {"access_token": access_token, "openid": openid, "lang": "zh_CN"}
        resp = await self._client.get(url, params=params)
        data = resp.json()

        if "errcode" in data and data["errcode"] != 0:
            raise Exception(f"微信用户信息失败: {data.get('errmsg')}")

        return OAuthUser(
            provider=self.name,
            open_id=data.get("openid", ""),
            union_id=data.get("unionid"),
            name=data.get("nickname", ""),
            avatar=data.get("headimgurl", ""),
            raw_data=data,
        )

    def _gen_state(self) -> str:
        raw = f"wxopen:{time.time()}:{self.app_id}"
        return hashlib.sha256(raw.encode()).hexdigest()[:32]
