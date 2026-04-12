"""
OAuth Providers Package
"""
from .wecom import WeComProvider
from .dingtalk import DingTalkProvider
from .feishu import FeiShuProvider
from .wechat_open import WeChatOpenProvider
from .wechat_mini import WeChatMiniProvider
from .oidc import OIDCProvider

__all__ = [
    "WeComProvider",
    "DingTalkProvider",
    "FeiShuProvider",
    "WeChatOpenProvider",
    "WeChatMiniProvider",
    "OIDCProvider",
]
