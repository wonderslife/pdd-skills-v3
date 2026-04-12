"""
Data Permission Configuration Constants
"""

DATA_PERMISSION_CONFIG = {
    "enabled": True,
    "mode": "hybrid",  # global / annotation / hybrid
    
    "delegation": {
        "enabled": True,
        "max_concurrent": 3,
        "max_duration_days": 365,
        "require_approval": True,
    },
    
    "defaults": {
        "superuser_bypass": True,
        "safe_fallback_column": "org_id",
        "log_sql_conditions": False,  # 开发环境可开启调试
    },
}
