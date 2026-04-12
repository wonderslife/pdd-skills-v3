"""
WeChat Mini Program Provider - 小程序 wx.login() 登录
"""
import httpx
from typing import Dict, Any

from ..base import BaseOAuthProvider, OAuthProviderType, OAuthUser, AuthURLResult, TokenResult


class WeChatMiniProvider(BaseOAuthProvider):
    """微信小程序登录 Provider"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.provider_type = OAuthProviderType.WECHAT_MINI
        self._client = httpx.AsyncClient(timeout=10.0)

    @property
    def name(self) -> str: return "wechat_mini"

    async def get_auth_url(self, redirect_uri=None, state=None, **kwargs) -> AuthURLResult:
        raise NotImplementedError("小程序不需要获取授权URL")

    async def exchange_code(self, code, **kwargs) -> TokenResult:
        url = "https://api.weixin.qq.com/sns/jscode2session"
        params = {
            "appid": self.app_id,
            "secret": self.app_secret,
            "js_code": code,
            "grant_type": "authorization_code",
        }
        resp = await self._client.get(url, params=params)
        data = resp.json()

        if "errcode" in data and data["errcode"] != 0:
            raise Exception(f"小程序登录失败: {data.get('errmsg')}")

        return TokenResult(
            access_token=data.get("session_key", "mini_session"),
            raw={
                "openid": data.get("openid"),
                "unionid": data.get("unionid"),
                "session_key": data.get("session_key"),
            },
        )

    async def get_user_info(self, access_token, **kwargs) -> OAuthUser:
        raw = kwargs.get("raw", {})
        return OAuthUser(
            provider=self.name,
            open_id=raw.get("openid", ""),
            union_id=raw.get("unionid"),
            name="小程序用户",
            raw_data=raw,
        )
