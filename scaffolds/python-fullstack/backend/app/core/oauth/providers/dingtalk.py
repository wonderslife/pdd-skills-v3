"""
DingTalk (钉钉) Provider - 扫码 + authCode免登
"""
import httpx
from typing import Dict, Any

from ..base import BaseOAuthProvider, OAuthProviderType, OAuthUser, AuthURLResult, TokenResult


class DingTalkProvider(BaseOAuthProvider):
    """
    钉钉 OAuth Provider
    
    特点: 使用 authCode 直接换取用户信息 (无需先换 token)
    """

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.provider_type = OAuthProviderType.DINGTALK
        self._client = httpx.AsyncClient(timeout=10.0)

    @property
    def name(self) -> str: return "dingtalk"
    @property
    def display_name(self) -> str: return "钉钉"

    async def get_auth_url(
        self, redirect_uri: str, state: str = None, **kwargs
    ) -> AuthURLResult:
        import secrets
        state = state or secrets.token_urlsafe(32)
        
        url = (
            f"https://login.dingtalk.com/oauth2/auth?"
            f"redirect_uri={redirect_uri}"
            f"&response_type=code"
            f"&client_id={self.app_id}"
            f"&scope=openid corpid"
            f"&state={state}"
            f"&prompt=consent"
        )
        return AuthURLResult(url=url, state=state)

    async def exchange_code(self, code, **kwargs) -> TokenResult:
        resp = await self._client.post(
            "https://oapi.dingtalk.com/topapi/v2/user/getuserinfo",
            data={"code": code},
        )
        data = resp.json()
        if data.get("errcode", 0) != 0:
            raise Exception(f"钉钉用户信息失败: {data.get('errmsg')}")
        
        return TokenResult(
            access_token="dingtalk_direct",
            raw=data,
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
            raw_data=raw,
        )
