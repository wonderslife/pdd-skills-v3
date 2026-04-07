"""
PDD SDK 事件系统

提供发布-订阅模式的事件发射器，用于 SDK 内部状态通知和用户自定义监听。
支持同步/异步回调、一次性事件监听和错误处理。
"""

import asyncio
from typing import Callable, Any, Dict, List, Optional, Set
from datetime import datetime
from functools import wraps
import threading


# ==================== 预定义事件常量 ====================

class Events:
    """
    预定义事件类型常量

    所有 SDK 内部事件的统一命名空间，避免字符串硬编码导致的拼写错误。
    """

    # 请求生命周期
    REQUEST_START = "request:start"
    """请求开始发送"""
    REQUEST_END = "request:end"
    """请求成功完成"""
    REQUEST_ERROR = "request:error"
    """请求发生错误"""

    # 重试机制
    RETRY = "retry"
    """正在重试请求"""
    RETRY_EXHAUSTED = "retry:exhausted"
    """重试次数耗尽"""

    # 缓存
    CACHE_HIT = "cache:hit"
    """缓存命中"""
    CACHE_MISS = "cache:miss"
    """缓存未命中"""
    CACHE_EXPIRED = "cache:expired"
    """缓存过期"""

    # 批量操作
    BATCH_START = "batch:start"
    """批量操作开始"""
    BATCH_PROGRESS = "batch:progress"
    """批量操作进度更新"""
    BATCH_COMPLETE = "batch:complete"
    """批量操作完成"""

    # 会话管理
    SESSION_CREATED = "session:created"
    """会话创建成功"""
    SESSION_UPDATED = "session:updated"
    """会话信息更新"""


# 类型别名，便于使用
EventHandler = Callable[..., Any]
"""事件处理器函数类型"""


class EventEmitter:
    """
    事件发射器

    实现发布-订阅模式，支持同步和异步回调函数注册。

    Attributes:
        _listeners: 事件名到处理器列表的映射
        _once_listeners: 一次性事件处理器映射
        _max_listeners: 单个事件最大监听器数量（防止内存泄漏）
        _lock: 线程安全锁

    Example:
        >>> emitter = EventEmitter()
        >>> def on_request(data):
        ...     print(f"请求完成: {data}")
        >>> emitter.on("request:end", on_request)
        >>> emitter.emit("request:end", {"method": "GET", "path": "/api/status"})
        请求完成: {'method': 'GET', 'path': '/api/status'}
    """

    DEFAULT_MAX_LISTENERS = 10
    """默认最大监听器数量"""

    def __init__(self, max_listeners: int = DEFAULT_MAX_LISTENERS):
        """
        初始化事件发射器

        Args:
            max_listeners: 每个事件允许的最大监听器数量，
                          超过此数量会发出警告（默认 10）
        """
        self._listeners: Dict[str, List[EventHandler]] = {}
        self._once_listeners: Dict[str, List[EventHandler]] = {}
        self._max_listeners = max_listeners
        self._lock = threading.Lock()
        self._event_history: List[Dict[str, Any]] = []
        self._history_max_size = 100

    def on(self, event: str, callback: EventHandler) -> "EventEmitter":
        """
        注册事件监听器

        Args:
            event: 事件名称
            callback: 回调函数，接收事件数据作为参数

        Returns:
            自身，支持链式调用

        Raises:
            TypeError: 如果回调不是可调用对象
            ValueError: 如果监听器数量超过限制

        Example:
            >>> emitter.on("request:end", lambda e: print(e))
        """
        if not callable(callback):
            raise TypeError(f"事件处理器必须是可调用对象，收到: {type(callback)}")

        with self._lock:
            if event not in self._listeners:
                self._listeners[event] = []

            current_count = len(self._listeners[event]) + len(
                self._once_listeners.get(event, [])
            )
            if current_count >= self._max_listeners:
                import warnings
                warnings.warn(
                    f"事件 '{event}' 的监听器数量 ({current_count}) "
                    f"可能超过限制 ({self._max_listeners})",
                    RuntimeWarning
                )

            self._listeners[event].append(callback)

        return self

    def off(self, event: str, callback: Optional[EventHandler] = None) -> "EventEmitter":
        """
        移除事件监听器

        Args:
            event: 事件名称
            callback: 要移除的回调函数。如果为 None，则移除该事件的所有监听器。

        Returns:
            自身，支持链式调用

        Example:
            >>> emitter.off("request:end", my_handler)
            >>> emitter.off("request:end")  # 移除所有监听器
        """
        with self._lock:
            if callback is None:
                # 移除该事件的所有监听器
                self._listeners.pop(event, None)
                self._once_listeners.pop(event, None)
            else:
                if event in self._listeners:
                    self._listeners[event] = [
                        cb for cb in self._listeners[event] if cb != callback
                    ]
                    # 清理空列表
                    if not self._listeners[event]:
                        del self._listeners[event]

                if event in self._once_listeners:
                    self._once_listeners[event] = [
                        cb for cb in self._once_listeners[event] if cb != callback
                    ]
                    if not self._once_listeners[event]:
                        del self._once_listeners[event]

        return self

    def once(self, event: str, callback: EventHandler) -> "EventEmitter":
        """
        注册一次性事件监听器

        该监听器在首次触发后自动移除。

        Args:
            event: 事件名称
            callback: 回调函数

        Returns:
            自身，支持链式调用

        Example:
            >>> emitter.once("session:created", lambda e: print(f"新会话: {e}"))
        """
        if not callable(callback):
            raise TypeError(f"事件处理器必须是可调用对象，收到: {type(callback)}")

        with self._lock:
            if event not in self._once_listeners:
                self._once_listeners[event] = []
            self._once_listeners[event].append(callback)

        return self

    def emit(self, event: str, *args: Any, **kwargs: Any) -> None:
        """
        触发事件

        同步调用所有已注册的监听器。

        Args:
            event: 事件名称
            *args: 位置参数传递给监听器
            **kwargs: 关键字参数传递给监听器

        Note:
            - 监听器执行异常不会影响其他监听器的执行
            - 一次性监听器在触发后自动移除
        """
        # 记录事件历史
        self._record_event(event, args, kwargs)

        # 收集要执行的监听器
        listeners_to_call: List[EventHandler] = []
        once_listeners_to_remove: List[EventHandler] = []

        with self._lock:
            # 常规监听器
            if event in self._listeners:
                listeners_to_call.extend(self._listeners[event])

            # 一次性监听器
            if event in self._once_listeners:
                listeners_to_call.extend(self._once_listeners[event])
                once_listeners_to_remove.extend(self._once_listeners[event])

        # 执行常规监听器
        for listener in listeners_to_call:
            try:
                listener(*args, **kwargs)
            except Exception as e:
                # 监听器异常不应影响其他监听器和主流程
                self._handle_listener_error(event, listener, e)

        # 移除已触发的一次性监听器
        if once_listeners_to_remove:
            with self._lock:
                for cb in once_listeners_to_remove:
                    if event in self._once_listeners and cb in self._once_listeners[event]:
                        self._once_listeners[event].remove(cb)
                if event in self._once_listeners and not self._once_listeners[event]:
                    del self._once_listeners[event]

    async def async_emit(self, event: str, *args: Any, **kwargs: Any) -> None:
        """
        异步触发事件

        支持异步回调函数的并发执行。

        Args:
            event: 事件名称
            *args: 位置参数
            **kwargs: 关键字参数
        """
        # 记录事件历史
        self._record_event(event, args, kwargs)

        # 收集要执行的监听器
        listeners_to_call: List[EventHandler] = []
        once_listeners_to_remove: List[EventHandler] = []

        with self._lock:
            if event in self._listeners:
                listeners_to_call.extend(self._listeners[event])
            if event in self._once_listeners:
                listeners_to_call.extend(self._once_listeners[event])
                once_listeners_to_remove.extend(self._once_listeners[event])

        # 并发执行所有监听器
        tasks = []
        for listener in listeners_to_call:
            try:
                result = listener(*args, **kwargs)
                if asyncio.iscoroutine(result):
                    tasks.append(result)
                else:
                    # 同步函数直接等待完成
                    pass
            except Exception as e:
                self._handle_listener_error(event, listener, e)

        # 并发执行异步任务
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        # 清理一次性监听器
        if once_listeners_to_remove:
            with self._lock:
                for cb in once_listeners_to_remove:
                    if event in self._once_listeners and cb in self._once_listeners[event]:
                        self._once_listeners[event].remove(cb)
                if event in self._once_listeners and not self._once_listeners[event]:
                    del self._once_listeners[event]

    def listener_count(self, event: str) -> int:
        """
        获取指定事件的监听器数量

        Args:
            event: 事件名称

        Returns:
            监听器总数（包括一次性监听器）
        """
        with self._lock:
            count = len(self._listeners.get(event, []))
            count += len(self._once_listeners.get(event, []))
            return count

    def event_names(self) -> List[str]:
        """
        获取所有已注册的事件名称

        Returns:
            事件名称列表
        """
        with self._lock:
            names = set(self._listeners.keys()) | set(self._once_listeners.keys())
            return list(names)

    def remove_all_listeners(self, event: Optional[str] = None) -> "EventEmitter":
        """
        移除所有监听器

        Args:
            event: 如果指定，只移除该事件的监听器；
                   如果为 None，移除所有事件的所有监听器。

        Returns:
            自身，支持链式调用
        """
        with self._lock:
            if event is None:
                self._listeners.clear()
                self._once_listeners.clear()
            else:
                self._listeners.pop(event, None)
                self._once_listeners.pop(event, None)
        return self

    def get_event_history(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        获取最近的事件历史记录

        Args:
            limit: 返回的最大记录数

        Returns:
            事件记录列表
        """
        with self._lock:
            return list(reversed(self._event_history[-limit:]))

    def clear_history(self) -> None:
        """清空事件历史记录"""
        with self._lock:
            self._event_history.clear()

    def _record_event(self, event: str, args: tuple, kwargs: dict) -> None:
        """内部方法：记录事件到历史"""
        record = {
            "event": event,
            "timestamp": datetime.now().isoformat(),
            "args_count": len(args),
            "kwargs_keys": list(kwargs.keys())
        }
        with self._lock:
            self._event_history.append(record)
            # 限制历史大小
            if len(self._event_history) > self._history_max_size:
                self._event_history = self._event_history[-self._history_max_size:]

    @staticmethod
    def _handle_listener_error(event: str, listener: EventHandler, error: Exception) -> None:
        """内部方法：处理监听器执行错误"""
        # 使用简单的 stderr 输出，避免循环依赖
        import sys
        print(
            f"[PDD SDK Event] 监听器在事件 '{event}' 中抛出异常: {error}",
            file=sys.stderr
        )


# ==================== 便捷装饰器 ====================


def event_handler(emitter: EventEmitter, event: str):
    """
    事件处理器装饰器

    将普通函数注册为指定事件的处理器。

    Args:
        emitter: 事件发射器实例
        event: 要监听的事件名称

    Example:
        >>> emitter = EventEmitter()
        >>> @event_handler(emitter, "request:end")
        ... def log_request(data):
        ...     print(f"请求完成: {data['path']}")
    """
    def decorator(func: EventHandler) -> EventHandler:
        emitter.on(event, func)
        @wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)
        return wrapper
    return decorator
