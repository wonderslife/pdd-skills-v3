"""AI Test Framework - 通用工具函数

归集跨模块共享的工具函数，消除重复定义。
"""
import json


def safe_json_dumps(obj, **kwargs):
    """JSON序列化，自动处理非标准类型（date/datetime/bytes等）"""
    def _default(o):
        if hasattr(o, 'isoformat'):
            return o.isoformat()
        if isinstance(o, (bytes, bytearray)):
            return o.decode('utf-8', errors='replace')
        if hasattr(o, '__dict__'):
            return o.__dict__
        return str(o)
    try:
        return json.dumps(obj, **kwargs)
    except (TypeError, ValueError):
        return json.dumps(obj, default=_default, **kwargs)
