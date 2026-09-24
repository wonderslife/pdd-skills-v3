"""
OAuth Module Exceptions
"""


class OAuthError(Exception):
    """Base OAuth exception"""

    def __init__(self, message: str, provider: str = "", error_code: str = ""):
        self.message = message
        self.provider = provider
        self.error_code = error_code
        super().__init__(self.message)


class OAuthTokenError(OAuthError):
    """Token exchange failed"""
    pass


class OAuthUserInfoError(OAuthError):
    """Failed to get user info"""
    pass


class OAuthProviderNotFoundError(OAuthError):
    """Provider not registered"""
    pass


class OAuthBindingError(OAuthError):
    """User binding failed"""
    pass
