"""
OAuth Provider Registry - Dynamic registration and lookup of providers
"""


class OAuthProviderRegistry:
    _providers: dict = {}
    _instances: dict = {}

    @classmethod
    def register(cls, provider_class):
        from app.core.config import get_settings
        settings = get_settings()
        config = (settings.OAUTH_PROVIDERS or {}).get(provider_class.name, {})

        instance = provider_class(config)
        cls._instances[provider_class.name] = instance
        cls._providers[provider_class.name] = provider_class
        return instance

    @classmethod
    def get(cls, name: str):
        return cls._instances.get(name)

    @classmethod
    def get_all_names(cls) -> list:
        return list(cls._instances.keys())

    @classmethod
    def get_available_providers(cls) -> list:
        return [
            {
                "name": n,
                "display_name": getattr(i, 'display_name', n),
                "icon": getattr(i, 'icon', ''),
                "enabled": True,
            }
            for n, i in cls._instances.items()
        ]

    @classmethod
    def is_registered(cls, name: str) -> bool:
        return name in cls._instances
