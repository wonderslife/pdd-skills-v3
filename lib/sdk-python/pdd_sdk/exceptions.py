"""
PDD SDK 自定义异常体系

提供层次化的异常类，用于精确捕获和处理不同类型的错误。
所有异常都继承自 PDDError 基类，便于统一处理。
"""

from typing import Optional, Any, Dict


class PDDError(Exception):
    """
    PDD SDK 基础异常类

    所有 PDD SDK 异常的基类，包含通用的错误信息和元数据。

    Attributes:
        message: 错误描述信息
        code: 错误代码（可选）
        details: 额外的错误详情（可选）
    """

    def __init__(
        self,
        message: str = "PDD SDK 发生未知错误",
        code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}

    def __str__(self) -> str:
        """返回格式化的错误信息"""
        parts = [self.message]
        if self.code:
            parts.append(f"[{self.code}]")
        if self.details:
            detail_str = ", ".join(f"{k}={v}" for k, v in self.details.items())
            parts.append(f"({detail_str})")
        return " ".join(parts)

    def to_dict(self) -> Dict[str, Any]:
        """
        将异常转换为字典格式

        Returns:
            包含异常信息的字典
        """
        return {
            "type": self.__class__.__name__,
            "message": self.message,
            "code": self.code,
            "details": self.details
        }


class ConnectionError(PDDError):
    """
    连接失败异常

    当无法连接到 PDD 服务端时抛出。

    Example:
        >>> raise ConnectionError(
        ...     message="无法连接到服务端",
        ...     details={"endpoint": "http://localhost:3000", "reason": "Connection refused"}
        ... )
    """

    def __init__(self, message: str = "无法连接到 PDD 服务端", **kwargs):
        super().__init__(message=message, code="CONNECTION_ERROR", **kwargs)


class AuthError(PDDError):
    """
    认证失败异常

    当 API Key 无效或缺失时抛出。

    Example:
        >>> raise AuthError(
        ...     message="API Key 无效",
        ...     details={"status_code": 401}
        ... )
    """

    def __init__(self, message: str = "认证失败，请检查 API Key", **kwargs):
        super().__init__(message=message, code="AUTH_ERROR", **kwargs)


class ValidationError(PDDError):
    """
    参数验证失败异常

    当请求参数不符合要求时抛出。

    Example:
        >>> raise ValidationError(
        ...     message="参数验证失败",
        ...     details={"field": "prd_path", "reason": "文件不存在"}
        ... )
    """

    def __init__(self, message: str = "请求参数验证失败", **kwargs):
        super().__init__(message=message, code="VALIDATION_ERROR", **kwargs)


class ServerError(PDDError):
    """
    服务端错误异常

    当服务端返回 5xx 错误时抛出。

    Example:
        >>> raise ServerError(
        ...     message="服务器内部错误",
        ...     details={"status_code": 500, "request_id": "abc123"}
        ... )
    """

    def __init__(self, message: str = "PDD 服务端发生内部错误", **kwargs):
        super().__init__(message=message, code="SERVER_ERROR", **kwargs)


class TimeoutError(PDDError):
    """
    超时异常

    当请求超过设定的时间限制时抛出。

    Example:
        >>> raise TimeoutError(
        ...     message="请求超时",
        ...     details={"timeout": 30, "elapsed": 35}
        ... )
    """

    def __init__(self, message: str = "请求超时，请稍后重试", **kwargs):
        super().__init__(message=message, code="TIMEOUT_ERROR", **kwargs)


class RateLimitError(PDDError):
    """
    限流异常

    当请求频率超过限制时抛出。

    Example:
        >>> raise RateLimitError(
        ...     message="请求过于频繁",
        ...     details={"retry_after": 60, "limit": 100}
        ... )
    """

    def __init__(self, message: str = "请求频率超限，请稍后重试", **kwargs):
        super().__init__(message=message, code="RATE_LIMIT_ERROR", **kwargs)
