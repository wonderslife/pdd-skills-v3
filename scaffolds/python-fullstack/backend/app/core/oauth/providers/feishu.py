"""
FeiShu (飞书) Provider - 扫码 + 内嵌免登
"""
import secrets
import httpx
from typing import Dict, Any

from ..base import BaseOAuthProvider, OAuthProviderType, OAuthUser, AuthURLResult, TokenResult


class FeiShuProvider(BaseOAuthProvider):
    """飞书 OAuth Provider"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.provider_type = OAuthProviderType.FEISHU
        self._client = httpx.AsyncClient(timeout=10.0)

    @property
    def name(self): return "feishu"
    @property
    def display_name(self): return "飞书"

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
            json={
                "app_id": self.app_id,
                "app_secret": self.app_secret,
                "grant_type": "authorization_code",
                "code": code,
            },
        )
        data = resp.json()
        if data.get("code") != 0:
            raise Exception(f"飞书token失败: {data.get('msg')}")
        return TokenResult(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token"),
            expires_in=data.get("expire", 7200),
            raw=data,
        )

    async def get_user_info(self, access_token, **kwargs) -> OAuthUser:
        headers = {"Authorization": f"Bearer {access_token}"}
        resp = await self._client.get(
            "https://open.feishu/open-apis/authen/v1/user_info",
            headers=headers,
        )
        data = resp.json()
        if data.get("code") != 0:
            raise Exception(f"飞书用户失败: {data.get('msg')}")
        sub = data.get("data", {})
        return OAuthUser(
            provider=self.name,
            open_id=sub.get("open_id", ""),
            union_id=sub.get("union_id"),
            name=sub.get("name", ""),
            avatar=sub.get("avatar_url"),
            email=sub.get("email"),
            phone=sub.get("mobile"),
            raw_data=sub,
        )
