"""
PDD SDK 工具函数模块

提供重试机制、日志工具、缓存装饰器和格式化输出等通用功能。
所有功能均基于 Python 标准库实现，无第三方依赖。
"""

import functools
import hashlib
import json
import logging
import sys
import time
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Type, Tuple, Union


# ==================== 日志工具 ====================

# ANSI 颜色代码（用于控制台彩色输出）
class Colors:
    """终端颜色常量"""
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN = "\033[96m"
    WHITE = "\033[97m"

    # 检测是否支持颜色输出
    @staticmethod
    def supports_color() -> bool:
        """检测当前终端是否支持彩色输出"""
        # Windows 需要特殊处理
        if sys.platform == "win32":
            try:
                import ctypes
                kernel32 = ctypes.windll.kernel32
                return kernel32.GetStdHandle(-11) != 0
            except Exception:
                return False
        # Unix-like 系统：检查是否为 TTY
        return hasattr(sys.stdout, "isatty") and sys.stdout.isatty()


class ColoredFormatter(logging.Formatter):
    """
    彩色日志格式化器

    根据日志级别自动选择不同的颜色输出。
    """

    # 级别到颜色的映射
    LEVEL_COLORS = {
        logging.DEBUG: Colors.DIM,
        logging.INFO: Colors.GREEN,
        logging.WARNING: Colors.YELLOW,
        logging.ERROR: Colors.RED,
        logging.CRITICAL: Colors.BOLD + Colors.RED,
    }

    def __init__(self, fmt: Optional[str] = None, datefmt: Optional[str] = None):
        """
        初始化格式化器

        Args:
            fmt: 日志格式字符串
            datefmt: 时间格式字符串
        """
        super().__init__(fmt=fmt, datefmt=datefmt)
        self._use_color = Colors.supports_color()

    def format(self, record: logging.LogRecord) -> str:
        """
        格式化日志记录

        Args:
            record: 日志记录对象

        Returns:
            格式化后的字符串
        """
        if self._use_color:
            color = self.LEVEL_COLORS.get(record.levelno, Colors.RESET)
            record.levelname = f"{color}{record.levelname}{Colors.RESET}"

            # 为不同级别添加图标前缀
            icons = {
                logging.DEBUG: "[DEBUG]",
                logging.INFO: "[INFO]",
                logging.WARNING: "[WARN]",
                logging.ERROR: "[ERROR]",
                logging.CRITICAL: "[FATAL]",
            }
            icon = icons.get(record.levelno, "")
            record.msg = f"{icon} {record.msg}"

        return super().format(record)


def get_logger(
    name: str = "pdd_sdk",
    level: int = logging.INFO,
    enable_color: bool = True
) -> logging.Logger:
    """
    获取配置好的日志器实例

    创建或返回已存在的日志器，支持彩色控制台输出。

    Args:
        name: 日志器名称，通常使用模块名
        level: 日志级别 (DEBUG=10, INFO=20, WARNING=30, ERROR=40, CRITICAL=50)
        enable_color: 是否启用彩色输出

    Returns:
        配置完成的 Logger 实例

    Example:
        >>> logger = get_logger("my_module", level=logging.DEBUG)
        >>> logger.info("这是一条信息")
        [INFO] 这是一条信息
        >>> logger.error("出错了")
        [ERROR] 出错了
    """
    logger = logging.getLogger(name)

    # 避免重复添加处理器
    if logger.handlers:
        logger.setLevel(level)
        return logger

    logger.setLevel(level)

    # 控制台处理器
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)

    # 设置格式化器
    log_format = "%(asctime)s | %(levelname)-18s | %(message)s"
    date_format = "%H:%M:%S"

    if enable_color and Colors.supports_color():
        formatter = ColoredFormatter(fmt=log_format, datefmt=date_format)
    else:
        formatter = logging.Formatter(fmt=log_format, datefmt=date_format)

    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # 不向上传播，避免重复输出
    logger.propagate = False

    return logger


# ==================== 重试装饰器 ====================

def retry(
    max_retries: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    on_retry: Optional[Callable[[int, Exception], None]] = None,
    jitter: bool = True
):
    """
    重试装饰器

    在函数执行失败时自动重试，支持指数退避策略。

    Args:
        max_retries: 最大重试次数（不包括首次尝试）
        delay: 初始延迟时间（秒）
        backoff: 退避倍数，每次重试延迟乘以此值
        exceptions: 需要重试的异常类型元组
        on_retry: 重试时的回调函数，接收(尝试次数, 异常)参数
        jitter: 是否在延迟中添加随机抖动，避免惊群效应

    Example:
        >>> @retry(max_retries=3, delay=1.0, backoff=2.0, exceptions=(ConnectionError,))
        ... async def fetch_data():
        ...     # 可能失败的网络请求
        ...     pass
    """
    import random

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            last_exception = None
            current_delay = delay

            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e

                    if attempt < max_retries:
                        # 调用重试回调
                        if on_retry:
                            on_retry(attempt + 1, e)

                        # 计算带抖动的延迟
                        actual_delay = current_delay
                        if jitter:
                            actual_delay += random.uniform(0, current_delay * 0.1)

                        # 等待后重试
                        await _async_sleep(actual_delay)

                        # 指数退避
                        current_delay *= backoff
                    else:
                        raise

            raise last_exception

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            last_exception = None
            current_delay = delay

            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e

                    if attempt < max_retries:
                        if on_retry:
                            on_retry(attempt + 1, e)

                        actual_delay = current_delay
                        if jitter:
                            actual_delay += random.uniform(0, current_delay * 0.1)

                        time.sleep(actual_delay)
                        current_delay *= backoff
                    else:
                        raise

            raise last_exception

        # 自动检测函数是同步还是异步
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


async def _async_sleep(seconds: float) -> None:
    """异步睡眠辅助函数"""
    import asyncio
    await asyncio.sleep(seconds)


# ==================== 缓存装饰器 ====================

class _CacheEntry:
    """缓存条目内部类"""
    __slots__ = ("value", "expires_at")

    def __init__(self, value: Any, expires_at: float):
        self.value = value
        self.expires_at = expires_at

    @property
    def is_expired(self) -> bool:
        return time.time() > self.expires_at


class MemoryCache:
    """
    内存缓存管理器

    基于 TTL 的简单内存缓存实现，线程安全。

    Attributes:
        _cache: 缓存存储字典
        _default_ttl: 默认过期时间（秒）
        _max_size: 最大缓存条目数
    """

    def __init__(self, default_ttl: int = 300, max_size: int = 1000):
        """
        初始化缓存

        Args:
            default_ttl: 默认 TTL（秒），默认 5 分钟
            max_size: 最大缓存条目数，防止内存泄漏
        """
        self._cache: Dict[str, _CacheEntry] = {}
        self._default_ttl = default_ttl
        self._max_size = max_size
        self._lock = __import__("threading").Lock()
        self._hits = 0
        self._misses = 0

    def get(self, key: str) -> Optional[Any]:
        """
        获取缓存值

        Args:
            key: 缓存键

        Returns:
            缓存的值，如果不存在或已过期则返回 None
        """
        with self._lock:
            entry = self._cache.get(key)

            if entry is None:
                self._misses += 1
                return None

            if entry.is_expired:
                del self._cache[key]
                self._misses += 1
                return None

            self._hits += 1
            return entry.value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """
        设置缓存值

        Args:
            key: 缓存键
            value: 要缓存的值
            ttl: 过期时间（秒），None 则使用默认值
        """
        with self._lock:
            # 如果超过最大容量，清理最旧的条目
            if len(self._cache) >= self._max_size and key not in self._cache:
                self._evict_oldest()

            expiration = ttl or self._default_ttl
            self._cache[key] = _CacheEntry(value, time.time() + expiration)

    def delete(self, key: str) -> bool:
        """
        删除缓存条目

        Args:
            key: 要删除的键

        Returns:
            是否成功删除
        """
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    def clear(self) -> None:
        """清空所有缓存"""
        with self._lock:
            self._cache.clear()

    def has(self, key: str) -> bool:
        """
        检查键是否存在且未过期

        Args:
            key: 缓存键

        Returns:
            是否存在有效缓存
        """
        with self._lock:
            entry = self._cache.get(key)
            if entry is None or entry.is_expired:
                return False
            return True

    @property
    def size(self) -> int:
        """返回当前缓存条目数"""
        with self._lock:
            return len(self._cache)

    @property
    def stats(self) -> Dict[str, Any]:
        """返回缓存统计信息"""
        total = self._hits + self._misses
        hit_rate = (self._hits / total * 100) if total > 0 else 0
        return {
            "size": self.size,
            "max_size": self._max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": f"{hit_rate:.2f}%"
        }

    def _evict_oldest(self) -> None:
        """淘汰最早的缓存条目"""
        if not self._cache:
            return
        oldest_key = min(
            self._cache.keys(),
            key=lambda k: self._cache[k].expires_at
        )
        del self._cache[oldest_key]

    def cleanup_expired(self) -> int:
        """
        清理所有过期的缓存条目

        Returns:
            清理的条目数量
        """
        with self._lock:
            expired_keys = [
                k for k, v in self._cache.items() if v.is_expired
            ]
            for key in expired_keys:
                del self._cache[key]
            return len(expired_keys)


# 全局默认缓存实例
_default_cache = MemoryCache()


def cache(ttl: int = 300, key_fn: Optional[Callable] = None):
    """
    缓存装饰器

    基于函数参数和 TTL 的结果缓存。

    Args:
        ttl: 缓存有效期（秒），默认 5 分钟
        key_fn: 自定义缓存键生成函数，接收(*args, **kwargs)，返回字符串

    Example:
        >>> @cache(ttl=60)
        ... async def get_user(user_id: str) -> dict:
        ...     # 数据库查询...
        ...     return {"id": user_id, "name": "test"}
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            # 生成缓存键
            cache_key = _make_cache_key(func.__name__, args, kwargs, key_fn)

            # 尝试从缓存获取
            cached = _default_cache.get(cache_key)
            if cached is not None:
                return cached

            # 执行函数并缓存结果
            result = await func(*args, **kwargs)
            _default_cache.set(cache_key, result, ttl)
            return result

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            cache_key = _make_cache_key(func.__name__, args, kwargs, key_fn)

            cached = _default_cache.get(cache_key)
            if cached is not None:
                return cached

            result = func(*args, **kwargs)
            _default_cache.set(cache_key, result, ttl)
            return result

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


def _make_cache_key(
    func_name: str,
    args: tuple,
    kwargs: dict,
    key_fn: Optional[Callable] = None
) -> str:
    """
    生成缓存键

    Args:
        func_name: 函数名
        args: 位置参数
        kwargs: 关键字参数
        key_fn: 自定义键生成函数

    Returns:
        缓存键字符串
    """
    if key_fn:
        custom_key = key_fn(*args, **kwargs)
        if isinstance(custom_key, str):
            return custom_key

    # 默认键生成方式：哈希参数
    key_data = {
        "func": func_name,
        "args": str(args),
        "kwargs": str(sorted(kwargs.items()))
    }
    key_string = json.dumps(key_data, sort_keys=True, ensure_ascii=False)
    return hashlib.md5(key_string.encode()).hexdigest()


# ==================== 格式化输出工具 ====================


def format_table(
    data: List[Dict[str, Any]],
    columns: Optional[List[str]] = None,
    title: Optional[str] = None,
    show_index: bool = True
) -> str:
    """
    将数据格式化为对齐的表格字符串

    Args:
        data: 字典列表，每个字典代表一行数据
        columns: 要显示的列名列表，None 则显示所有列
        title: 表格标题（可选）
        show_index: 是否显示行号

    Returns:
        格式化的表格字符串

    Example:
        >>> data = [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]
        >>> print(format_table(data))
        #   | name  | age
        # ---+-------+-----
        #  0 | Alice |  30
        #  1 | Bob   |  25
    """
    if not data:
        return "(空表格)"

    # 确定要显示的列
    if columns is None:
        columns = list(data[0].keys())

    # 计算每列宽度
    col_widths: Dict[str, int] = {}
    for col in col_name in columns:
        header_len = len(str(col))
        max_value_len = max(len(str(row.get(col, ""))) for row in data)
        col_widths[col] = max(header_len, max_value_len)

    # 如果显示行号，增加索引列宽度
    index_width = len(str(len(data))) if show_index else 0

    lines = []

    # 标题
    if title:
        lines.append(title)
        total_width = index_width + sum(col_widths.values()) + len(columns) * 3 + (1 if show_index else 0)
        lines.append("=" * total_width)

    # 表头
    header_parts = []
    if show_index:
        header_parts.append(f"{'#' :^{index_width}}")
    for col in columns:
        header_parts.append(f" {str(col):^{col_widths[col]}} ")
    lines.append("|".join(header_parts))

    # 分隔线
    sep_parts = []
    if show_index:
        sep_parts.append("-" * index_width)
    for col in columns:
        sep_parts.append("-" * (col_widths[col] + 2))
    lines.append("+".join(sep_parts))

    # 数据行
    for idx, row in enumerate(data):
        row_parts = []
        if show_index:
            row_parts.append(f"{idx :>{index_width}}")
        for col in columns:
            value = row.get(col, "")
            row_parts.append(f" {str(value):>{col_widths[col]}} ")
        lines.append("|".join(row_parts))

    return "\n".join(lines)


def format_json(
    data: Any,
    indent: int = 2,
    ensure_ascii: bool = False,
    sort_keys: bool = False
) -> str:
    """
    JSON 美化输出

    Args:
        data: 要序列化的数据
        indent: 缩进空格数
        ensure_ascii: 是否转义非 ASCII 字符
        sort_keys: 是否排序键

    Returns:
        格式化的 JSON 字符串
    """
    return json.dumps(
        data,
        indent=indent,
        ensure_ascii=ensure_ascii,
        sort_keys=sort_keys,
        default=str
    )


def format_duration(ms: int) -> str:
    """
    格式化持续时间

    将毫秒数转换为人类可读的时间字符串。

    Args:
        ms: 持续时间（毫秒）

    Returns:
        格式化的时间字符串

    Example:
        >>> format_duration(1500)
        '1.50s'
        >>> format_duration(500)
        '500ms'
        >>> format_duration(65000)
        '1m 5s'
    """
    if ms < 1000:
        return f"{ms}ms"
    elif ms < 60000:
        return f"{ms / 1000:.2f}s"
    else:
        minutes = ms // 60000
        seconds = (ms % 60000) / 1000
        return f"{minutes}m {seconds:.0f}s"


def format_bytes(size: int) -> str:
    """
    格式化字节数

    将字节转换为人类可读的大小表示。

    Args:
        size: 字节数

    Returns:
        格式化的大小字符串

    Example:
        >>> format_bytes(1024)
        '1.00 KB'
        >>> format_bytes(1048576)
        '1.00 MB'
    """
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if abs(size) < 1024.0:
            return f"{size:.2f} {unit}"
        size /= 1024.0
    return f"{size:.2f} PB"


def truncate(text: str, max_length: int = 80, suffix: str = "...") -> str:
    """
    截断文本

    如果文本超过指定长度，截断并添加后缀。

    Args:
        text: 原始文本
        max_length: 最大长度
        suffix: 截断后缀

    Returns:
        处理后的文本
    """
    if len(text) <= max_length:
        return text
    return text[:max_length - len(suffix)] + suffix


# ==================== 验证工具 ====================


def validate_endpoint(endpoint: str) -> str:
    """
    验证并规范化 API 端点 URL

    Args:
        endpoint: 输入的端点 URL

    Returns:
        规范化后的 URL

    Raises:
        ValueError: 如果 URL 格式无效
    """
    from urllib.parse import urlparse

    endpoint = endpoint.strip().rstrip("/")

    parsed = urlparse(endpoint)
    if not all([parsed.scheme, parsed.netloc]):
        raise ValueError(
            f"无效的端点 URL: '{endpoint}'。"
            f"请提供完整的 URL，如 'http://localhost:3000'"
        )

    if parsed.scheme not in ("http", "https"):
        raise ValueError(
            f"不支持的协议 '{parsed.scheme}'，仅支持 http 和 https"
        )

    return endpoint


def validate_api_key(api_key: str) -> str:
    """
    验证 API Key

    Args:
        api_key: API Key 字符串

    Returns:
        去除首尾空白的 API Key

    Raises:
        ValueError: 如果 API Key 为空或仅包含空白字符
    """
    api_key = api_key.strip()
    if not api_key:
        raise ValueError("API Key 不能为空")
    return api_key


# 导入 asyncio 用于检测协程函数
import asyncio
