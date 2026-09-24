"""
WeCom (企业微信) Provider - PC扫码 + 内嵌H5免登
"""
import hashlib
import time
import httpx
from typing import Dict, Any

from ..base import BaseOAuthProvider, OAuthProviderType, OAuthUser, AuthURLResult, TokenResult


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
        self, redirect_uri: str, state: str = None, mode: str = "web", **kwargs
    ) -> AuthURLResult:
        state = state or self._gen_state()
        scope = kwargs.get("scope", "snsapi_base")

        url = (
            f"https://open.weixin.qq.com/connect/oauth2/authorize?"
            f"appid={self.app_id}"
            f"&redirect_uri={redirect_uri}"
            f"&response_type=code"
            f"&scope={scope}"
            f"&state={state}#wechat_redirect"
        )
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
            raw=user_data,
        )

    async def get_user_info(self, access_token, userid=None, **kwargs) -> OAuthUser:
        raw = kwargs.get("raw", {})
        userid = userid or raw.get("userid") or raw.get("UserId")

        if not userid:
            open_userid = raw.get("open_userid") or raw.get("OpenId")
            return OAuthUser(provider=self.name, open_id=open_userid or "", name="外部联系人")

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
            raw_data=info,
        )

    def _gen_state(self) -> str:
        raw = f"wecom:{time.time()}:{self.app_id}"
        return hashlib.sha256(raw.encode()).hexdigest()[:32]
