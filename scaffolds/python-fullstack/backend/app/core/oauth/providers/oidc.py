"""
OIDC (OpenID Connect) Standard Protocol Provider

兼容: Keycloak / Authing / Auth0 / 任何标准 IdP

特性:
- PKCE S256 支持 (推荐用于 SPA/H5)
- ID Token 解码
- 标准 userinfo 端点
"""
import base64
import hashlib
import json
import secrets
from typing import Dict, Any, Optional
from urllib.parse import urlencode

import httpx

from ..base import BaseOAuthProvider, OAuthProviderType, OAuthUser, AuthURLResult, TokenResult


class OIDCProvider(BaseOAuthProvider):
    """
    标准 OIDC / OpenID Connect Provider
    """

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.provider_type = OAuthProviderType.OIDC
        
        issuer_url = config.get("issuer_url", "")
        self.client_id = config.get("client_id", "")
        self.client_secret = config.get("client_secret", "")
        
        self.pkce_enabled = config.get("pkce_enabled", True)
        
        self.authorization_endpoint = config.get(
            "authorization_endpoint",
            f"{issuer_url}/protocol/openid-connect/auth",
        )
        self.token_endpoint = config.get(
            "token_endpoint",
            f"{issuer_url}/protocol/openid-connect/token",
        )
        self.userinfo_endpoint = config.get(
            "userinfo_endpoint",
            f"{issuer_url}/protocol/openid-connect/userinfo",
        )
        
        self._client = httpx.AsyncClient(timeout=15.0)

    @property
    def name(self) -> str: return "oidc"
    @property
    def display_name(self) -> str: return self.config.get("display_name", "统一认证")

    async def get_auth_url(
        self, redirect_uri: str, state: str = None, **kwargs
    ) -> AuthURLResult:
        state = state or secrets.token_urlsafe(32)
        
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "scope": kwargs.get("scope", "openid profile email phone"),
            "state": state,
            "nonce": secrets.token_urlsafe(16),
        }

        verifier = None
        if self.pkce_enabled:
            verifier = secrets.token_urlsafe(64)
            challenge = self._s256(verifier)
            params["code_challenge"] = challenge
            params["code_challenge_method"] = "S256"

        url = f"{self.authorization_endpoint}?{urlencode(params)}"
        result = AuthURLResult(url=url, state=state)
        result.pkce_code_verifier = verifier
        return result

    async def exchange_code(
        self, code, redirect_uri=None, code_verifier=None, **kwargs
    ) -> TokenResult:
        data = {
            "grant_type": (
                "authorization_code_with_pkce" if code_verifier else "authorization_code"
            ),
            "code": code,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }
        if code_verifier:
            data["code_verifier"] = code_verifier

        resp = await self._client.post(self.token_endpoint, data=data)
        token_data = resp.json()

        if "error" in token_data:
            raise Exception(f"OIDC token失败: {token_data.get('error_description', token_data)}")

        return TokenResult(
            access_token=token_data.get("access_token", ""),
            refresh_token=token_data.get("refresh_token"),
            id_token=token_data.get("id_token"),
            expires_in=token_data.get("expires_in", 7200),
            raw=token_data,
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
            raw_data={**userinfo, "id_claims": id_claims},
        )

    @staticmethod
    def _s256(verifier: str) -> str:
        digest = hashlib.sha256(verifier.encode()).digest()
        return base64.urlsafe_b64encode(digest).rstrip(b'=').decode()

    @staticmethod
    def _decode_id_token(id_token: str) -> Optional[dict]:
        if not id_token:
            return None
        try:
            parts = id_token.split('.')
            if len(parts) >= 2:
                payload = parts[1]
                padding = 4 - len(payload) % 4
                if padding != 4:
                    payload += '=' * padding
                return json.loads(base64.urlsafe_b64decode(payload))
        except Exception:
            pass
        return None

    def _extract_roles(self, userinfo: dict, id_claims: dict) -> list:
        roles = []
        realm_access = id_claims.get("realm_access", {})
        roles.extend(realm_access.get("roles", []))
        resource_access = id_claims.get("resource_access", {})
        for client in resource_access.values():
            roles.extend(client.get("roles", []))
        return roles

    def _check_admin(self, userinfo: dict, id_claims: dict) -> bool:
        groups = id_claims.get("groups", [])
        return any(g.lower() in ("admin", "administrator", "superadmin") for g in groups)
