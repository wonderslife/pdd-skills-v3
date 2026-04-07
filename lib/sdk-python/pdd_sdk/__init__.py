"""
PDD Python SDK - PRD 驱动开发工具包

一个纯标准库实现的 Python SDK，用于与 PDD (PRD-Driven Development) 服务端交互。
提供规格生成、代码生成、功能验证、代码审查等完整的开发工作流支持。

主要特性:
    - 零依赖: 仅使用 Python 标准库，无需安装第三方包
    - 异步优先: 所有核心 API 均为异步方法，基于 asyncio
    - 类型安全: 完整的 PEP 484 类型注解
    - 事件驱动: 内置事件系统，可监听请求生命周期
    - 自动重试: 可配置的指数退避重试机制
    - 内存缓存: 基于 TTL 的响应缓存

快速开始:
    >>> import asyncio
    >>> from pdd_sdk import PDDClient
    >>>
    >>> async def main():
    ...     client = PDDClient(endpoint="http://localhost:3000", debug=True)
    ...
    ...     # 从 PRD 生成开发规格
    ...     spec = await client.generate_spec(prd_path="./docs/requirements.prdx")
    ...     print(f"提取了 {spec.feature_count} 个功能点")
    ...
    ...     # 根据规格生成代码
    ...     for feature in spec.features[:3]:
    ...         code = await client.generate_code(
    ...             spec_path=spec.spec_path,
    ...             feature_id=feature["id"]
    ...         )
    ...         print(f"  生成 {code.file_count} 个文件")
    >>>
    >>> asyncio.run(main())

版本: 1.0.0
作者: PDD Skills Team
许可: MIT License
"""

__version__ = "1.0.0"
__author__ = "PDD Skills Team"
__license__ = "MIT"

# ==================== 主要导出 ====================

from .client import PDDClient
"""核心客户端类"""

from .models import (
    # 规格相关
    SpecResult,
    FeatureInfo,
    # 代码生成相关
    CodeResult,
    GeneratedFile,
    # 验证相关
    VerifyResult,
    VerifyIssue,
    VerifyCriterion,
    Severity,
    # 代码审查相关
    ReviewResult,
    ReviewFinding,
    # 技能相关
    SkillInfo,
    # 会话相关
    Session,
    TaskStatus,
    # 服务状态相关
    StatusResult,
    ServerInfo,
    # 批量操作相关
    BatchResult,
    # 事件数据
    EventData,
)
"""所有数据模型类"""

from .exceptions import (
    PDDError,
    ConnectionError as PDDConnectionError,
    AuthError,
    ValidationError,
    ServerError,
    TimeoutError as PDDTimeoutError,
    RateLimitError,
)
"""异常类体系（注意: ConnectionError 和 TimeoutError 加了前缀避免与内置冲突）"""

from .events import (
    EventEmitter,
    Events,
    EventHandler,
    event_handler,
)
"""事件系统组件"""

from .utils import (
    get_logger,
    retry,
    cache,
    format_table,
    format_json,
    format_duration,
    format_bytes,
    MemoryCache,
    validate_endpoint,
    validate_api_key,
)
"""工具函数和装饰器"""

# ==================== 公共 API 列表 ====================

__all__ = [
    # 核心客户端
    "PDDClient",

    # 数据模型 - 规格
    "SpecResult",
    "FeatureInfo",

    # 数据模型 - 代码
    "CodeResult",
    "GeneratedFile",

    # 数据模型 - 验证
    "VerifyResult",
    "VerifyIssue",
    "VerifyCriterion",
    "Severity",

    # 数据模型 - 审查
    "ReviewResult",
    "ReviewFinding",

    # 数据模型 - 技能
    "SkillInfo",

    # 数据模型 - 会话
    "Session",
    "TaskStatus",

    # 数据模型 - 状态
    "StatusResult",
    "ServerInfo",

    # 数据模型 - 批量
    "BatchResult",

    # 数据模型 - 事件
    "EventData",

    # 异常
    "PDDError",
    "PDDConnectionError",
    "AuthError",
    "ValidationError",
    "ServerError",
    "PDDTimeoutError",
    "RateLimitError",

    # 事件系统
    "EventEmitter",
    "Events",
    "EventHandler",
    "event_handler",

    # 工具函数
    "get_logger",
    "retry",
    "cache",
    "format_table",
    "format_json",
    "format_duration",
    "format_bytes",
    "MemoryCache",
    "validate_endpoint",
    "validate_api_key",
]
