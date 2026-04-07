"""
PDD Python SDK 核心客户端

提供与 PDD 服务端交互的所有 API，包括规格生成、代码生成、
功能验证、代码审查等功能。基于 Python 标准库实现异步 HTTP 通信。
"""

import asyncio
import json
import time
from typing import Any, Callable, Dict, List, Optional, Union
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

# 导入内部模块
from .exceptions import (
    PDDError,
    ConnectionError as PDDConnectionError,
    AuthError,
    ValidationError,
    ServerError,
    TimeoutError as PDDTimeoutError,
    RateLimitError,
)
from .models import (
    SpecResult,
    CodeResult,
    VerifyResult,
    ReviewResult,
    SkillInfo,
    Session,
    StatusResult,
    ServerInfo,
    BatchResult,
    FeatureInfo,
    GeneratedFile,
    VerifyIssue,
    VerifyCriterion,
    ReviewFinding,
    Severity,
    TaskStatus,
    EventData,
)
from .events import EventEmitter, Events, EventHandler
from .utils import (
    get_logger,
    format_duration,
    validate_endpoint,
    validate_api_key,
    retry,
)

# 模块级日志器
logger = get_logger("pdd_sdk.client")


class PDDClient:
    """
    PDD SDK 核心客户端类

    提供完整的 PDD API 交互能力，包括：
    - 规格生成（从 PRD 提取功能点）
    - 代码生成（根据规格生成实现代码）
    - 功能验证（验证代码是否符合验收标准）
    - 代码审查（静态代码分析）
    - 批量操作（批量生成/验证）
    - 会话管理（开发会话生命周期）
    - 事件系统（请求生命周期监听）

    所有核心 API 方法都是异步的（async），使用 asyncio 和标准库实现。

    Attributes:
        endpoint: API 服务端地址
        api_key: 认证密钥
        timeout: 请求超时时间（秒）
        debug: 调试模式开关
        max_retries: 最大重试次数
        retry_delay: 重试初始延迟（秒）
        enable_cache: 是否启用内存缓存
        cache_ttl: 缓存有效期（秒）

    Example:
        >>> import asyncio
        >>> from pdd_sdk import PDDClient
        >>>
        >>> async def main():
        ...     client = PDDClient(
        ...         endpoint="http://localhost:3000",
        ...         api_key="your-api-key",
        ...         debug=True
        ...     )
        ...
        ...     # 监听事件
        ...     client.on("request:end", lambda e: print(f"完成: {e['path']}"))
        ...
        ...     # 生成规格
        ...     result = await client.generate_spec(prd_path="./docs/prd.prdx")
        ...     print(f"提取了 {result.feature_count} 个功能点")
        >>>
        >>> asyncio.run(main())
    """

    # 默认配置常量
    DEFAULT_ENDPOINT = "http://localhost:3000"
    """默认 API 端点"""
    DEFAULT_TIMEOUT = 30
    """默认超时时间（秒）"""
    DEFAULT_MAX_RETRIES = 3
    """默认最大重试次数"""
    DEFAULT_RETRY_DELAY = 1.0
    """默认重试延迟（秒）"""
    DEFAULT_CACHE_TTL = 300
    """默认缓存有效期（秒）"""

    def __init__(
        self,
        endpoint: str = DEFAULT_ENDPOINT,
        api_key: str = "",
        timeout: int = DEFAULT_TIMEOUT,
        debug: bool = False,
        max_retries: int = DEFAULT_MAX_RETRIES,
        retry_delay: float = DEFAULT_RETRY_DELAY,
        enable_cache: bool = True,
        cache_ttl: int = DEFAULT_CACHE_TTL,
    ):
        """
        初始化 PDD 客户端

        Args:
            endpoint: PDD 服务端 URL 地址（如 http://localhost:3000）
            api_key: API 认证密钥
            timeout: HTTP 请求超时时间（秒），默认 30 秒
            debug: 是否启用调试模式（输出详细日志）
            max_retries: 失败时的最大自动重试次数
            retry_delay: 重试之间的初始延迟时间（秒）
            enable_cache: 是否启用响应缓存
            cache_ttl: 缓存有效期（秒）

        Raises:
            ValueError: 如果 endpoint 或 api_key 格式无效
        """
        # 验证并存储配置
        self.endpoint = validate_endpoint(endpoint)
        self.api_key = validate_api_key(api_key) if api_key else ""
        self.timeout = timeout
        self.debug = debug
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.enable_cache = enable_cache
        self.cache_ttl = cache_ttl

        # 初始化日志级别
        if debug:
            self._logger = get_logger("pdd_sdk.client", level=10)  # DEBUG
        else:
            self._logger = logger

        # 初始化事件发射器
        self._events = EventEmitter()

        # 内部状态
        self._session_id: Optional[str] = None
        self._request_count = 0
        self._last_request_time: Optional[float] = None

        self._logger.info(
            f"PDD 客户端初始化完成 | 端点: {self.endpoint} | "
            f"超时: {timeout}s | 重试: {max_retries}次 | 缓存: {'开启' if enable_cache else '关闭'}"
        )

    # ==================== 事件系统代理方法 ====================

    def on(self, event: str, callback: EventHandler) -> "PDDClient":
        """
        注册事件监听器

        Args:
            event: 事件名称（使用 Events 常量或自定义字符串）
            callback: 回调函数

        Returns:
            自身，支持链式调用

        Example:
            >>> client.on(Events.REQUEST_END, lambda e: print(e))
        """
        self._events.on(event, callback)
        return self

    def off(self, event: str, callback: Optional[EventHandler] = None) -> "PDDClient":
        """
        移除事件监听器

        Args:
            event: 事件名称
            callback: 要移除的回调，None 表示移除所有

        Returns:
            自身，支持链式调用
        """
        self._events.off(event, callback)
        return self

    async def emit(self, event: str, **data: Any) -> None:
        """
        异步触发事件

        Args:
            event: 事件名称
            **data: 事件负载数据
        """
        await self._events.async_emit(event, **data)

    @property
    def events(self) -> EventEmitter:
        """获取事件发射器实例"""
        return self._events

    # ==================== 核心 API 方法 ====================

    async def generate_spec(
        self,
        prd_path: str,
        template: Optional[str] = None,
        output_dir: Optional[str] = None,
        dry_run: bool = False,
    ) -> SpecResult:
        """
        从 PRD 文档生成开发规格

        解析 PRD 文档，提取功能点矩阵，生成结构化的开发规格文档。

        Args:
            prd_path: PRD 文档路径（支持 .prdx, .md, .docx 等格式）
            template: 可选的规格模板名称
            output_dir: 输出目录（可选）
            dry_run: 是否仅预览不实际生成文件

        Returns:
            SpecResult 包含生成的规格信息、功能点列表等

        Raises:
            ValidationError: 如果 PRD 路径无效或格式不支持
            PDDConnectionError: 如果无法连接到服务端
            AuthError: 如果认证失败
            ServerError: 如果服务端处理出错

        Example:
            >>> result = await client.generate_spec(
            ...     prd_path="./requirements/user-system.prdx",
            ...     template="standard",
            ...     output_dir="./specs"
            ... )
            >>> print(f"成功提取 {result.feature_count} 个功能点")
        """
        start_time = time.time()
        method = "POST"
        path = "/api/v1/specs/generate"

        payload = {
            "prd_path": prd_path,
            "dry_run": dry_run,
        }
        if template:
            payload["template"] = template
        if output_dir:
            payload["output_dir"] = output_dir

        try:
            await self._emit_event(Events.REQUEST_START, {
                "method": method, "path": path, "payload": payload
            })

            response = await self._request(method, path, payload)
            result = self._parse_spec_result(response)

            duration_ms = int((time.time() - start_time) * 1000)
            result.duration_ms = duration_ms

            await self._emit_event(Events.REQUEST_END, {
                "method": method,
                "path": path,
                "duration_ms": duration_ms,
                "success": result.success,
            })

            self._logger.info(
                f"规格生成完成 | 功能点数: {result.feature_count} | "
                f"耗时: {format_duration(duration_ms)}"
            )

            return result

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            await self._emit_event(Events.REQUEST_ERROR, {
                "method": method, "path": path, "error": str(e),
                "duration_ms": duration_ms
            })
            raise

    async def generate_code(
        self,
        spec_path: str,
        feature_id: Optional[str] = None,
        output_dir: Optional[str] = None,
        dry_run: bool = False,
    ) -> CodeResult:
        """
        根据开发规格生成代码

        将规格中的功能点转化为可执行的代码实现。

        Args:
            spec_path: 开发规格文件路径
            feature_id: 指定要生成的功能点 ID（None 则生成全部）
            output_dir: 代码输出目录
            dry_run: 是否仅预览

        Returns:
            CodeResult 包含生成的文件列表、代码行数等信息

        Raises:
            ValidationError: 如果规格路径无效
            PDDConnectionError: 连接失败
            ServerError: 服务端错误

        Example:
            >>> result = await client.generate_code(
            ...     spec_path="./specs/user-system.spec.json",
            ...     feature_id="F001",
            ...     output_dir="./src"
            ... )
            >>> print(f"生成了 {result.file_count} 个文件")
        """
        start_time = time.time()
        method = "POST"
        path = "/api/v1/code/generate"

        payload = {
            "spec_path": spec_path,
            "dry_run": dry_run,
        }
        if feature_id:
            payload["feature_id"] = feature_id
        if output_dir:
            payload["output_dir"] = output_dir

        try:
            await self._emit_event(Events.REQUEST_START, {
                "method": method, "path": path, "payload": payload
            })

            response = await self._request(method, path, payload)
            result = self._parse_code_result(response)

            duration_ms = int((time.time() - start_time) * 1000)
            result.duration_ms = duration_ms

            await self._emit_event(Events.REQUEST_END, {
                "method": method,
                "path": path,
                "duration_ms": duration_ms,
                "success": result.success,
            })

            self._logger.info(
                f"代码生成完成 | 功能点: {result.feature_id} | "
                f"文件数: {result.file_count} | 代码行数: {result.lines_of_code}"
            )

            return result

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            await self._emit_event(Events.REQUEST_ERROR, {
                "method": method, "path": path, "error": str(e),
                "duration_ms": duration_ms
            })
            raise

    async def verify_feature(
        self,
        spec_path: str,
        source_dir: str = "./src",
        format: str = "json",
    ) -> VerifyResult:
        """
        验证功能实现是否符合开发规格

        对比源代码和规格定义的验收标准，检查覆盖率。

        Args:
            spec_path: 开发规格文件路径
            source_dir: 源代码目录
            format: 输出格式 (json/table/markdown)

        Returns:
            VerifyResult 包含覆盖率、通过/未通过的标准列表等

        Raises:
            ValidationError: 参数验证失败
            PDDConnectionError: 连接失败

        Example:
            >>> result = await client.verify_feature(
            ...     spec_path="./specs/user-system.spec.json",
            ...     source_dir="./src"
            ... )
            >>> print(f"覆盖率: {result.coverage_percent}%")
        """
        start_time = time.time()
        method = "POST"
        path = "/api/v1/verify"

        payload = {
            "spec_path": spec_path,
            "source_dir": source_dir,
            "format": format,
        }

        try:
            await self._emit_event(Events.REQUEST_START, {
                "method": method, "path": path, "payload": payload
            })

            response = await self._request(method, path, payload)
            result = self._parse_verify_result(response)

            duration_ms = int((time.time() - start_time) * 1000)
            result.duration_ms = duration_ms

            await self._emit_event(Events.REQUEST_END, {
                "method": method,
                "path": path,
                "duration_ms": duration_ms,
                "success": result.success,
            })

            self._logger.info(
                f"功能验证完成 | 覆盖率: {result.coverage_percent}% | "
                f"通过: {len(result.criteria_passed)} | 未通过: {len(result.criteria_failed)}"
            )

            return result

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            await self._emit_event(Events.REQUEST_ERROR, {
                "method": method, "path": path, "error": str(e),
                "duration_ms": duration_ms
            })
            raise

    async def code_review(
        self,
        source_dir: str = "./src",
        rules: Optional[List[str]] = None,
        format: str = "table",
    ) -> ReviewResult:
        """
        执行代码审查

        对源代码进行静态分析和质量评估。

        Args:
            source_dir: 待审查的源代码目录
            rules: 指定应用的规则集（None 使用默认规则）
            format: 输出格式 (json/table/markdown)

        Returns:
            ReviewResult 包含评分、等级、问题列表等

        Raises:
            ValidationError: 参数验证失败
            PDDConnectionError: 连接失败

        Example:
            >>> result = await client.code_review(source_dir="./src")
            >>> print(f"评分: {result.score}/100 | 等级: {result.grade}")
        """
        start_time = time.time()
        method = "POST"
        path = "/api/v1/review"

        payload = {"source_dir": source_dir, "format": format}
        if rules:
            payload["rules"] = rules

        try:
            await self._emit_event(Events.REQUEST_START, {
                "method": method, "path": path, "payload": payload
            })

            response = await self._request(method, path, payload)
            result = self._parse_review_result(response)

            duration_ms = int((time.time() - start_time) * 1000)
            result.duration_ms = duration_ms

            await self._emit_event(Events.REQUEST_END, {
                "method": method,
                "path": path,
                "duration_ms": duration_ms,
                "success": result.success,
            })

            self._logger.info(
                f"代码审查完成 | 评分: {result.score}/100 | "
                f"等级: {result.grade} | 问题数: {result.finding_count}"
            )

            return result

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            await self._emit_event(Events.REQUEST_ERROR, {
                "method": method, "path": path, "error": str(e),
                "duration_ms": duration_ms
            })
            raise

    async def list_skills(
        self,
        category: Optional[str] = None,
        language: Optional[str] = None,
    ) -> List[SkillInfo]:
        """
        获取可用技能列表

        查询当前 PDD 实例中注册的所有技能信息。

        Args:
            category: 技能分类过滤（可选）
            language: 编程语言过滤（可选）

        Returns:
            技能信息列表

        Example:
            >>> skills = await client.list_skills(category="analysis")
            >>> for skill in skills:
            ...     print(f"{skill.name}: {skill.description}")
        """
        params: Dict[str, str] = {}
        if category:
            params["category"] = category
        if language:
            params["language"] = language

        query_string = urlencode(params) if params else ""
        path = f"/api/v1/skills{('?'+query_string) if query_string else ''}"

        response = await self._request("GET", path)
        return self._parse_skills_list(response)

    async def get_status(self) -> StatusResult:
        """
        获取服务状态

        检查 PDD 服务端的健康状态和运行信息。

        Returns:
            StatusResult 包含健康状态、版本信息等

        Example:
            >>> status = await client.get_status()
            >>> print(f"服务{'正常' if status.healthy else '异常'}")
        """
        start_time = time.time()
        path = "/api/v1/status"

        try:
            response = await self._request("GET", path)
            server_info = self._parse_server_info(response.get("server", {}))

            duration_ms = int((time.time() - start_time) * 1000)

            return StatusResult(
                healthy=response.get("healthy", False),
                server_info=server_info,
                response_time_ms=duration_ms,
            )

        except Exception:
            return StatusResult(
                healthy=False,
                response_time_ms=int((time.time() - start_time) * 1000),
            )

    # ==================== 批量操作 ====================

    async def batch_generate_specs(
        self, specs_list: List[Dict[str, Any]]
    ) -> List[SpecResult]:
        """
        批量生成多个规格

        并发执行多个规格生成任务。

        Args:
            specs_list: 规格参数列表，每个元素包含 generate_spec 所需参数

        Returns:
            规格结果列表，顺序与输入一致

        Example:
            >>> specs = [
            ...     {"prd_path": "./prd1.prdx"},
            ...     {"prd_path": "./prd2.prdx"},
            ... ]
            >>> results = await client.batch_generate_specs(specs)
        """
        total_start = time.time()
        await self._emit_event(Events.BATCH_START, {
            "total": len(specs_list), "type": "generate_spec"
        })

        tasks = [self.generate_spec(**params) for params in specs_list]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append(SpecResult(
                    success=False,
                    spec_id="",
                    spec_path="",
                    errors=[str(result)]
                ))
            else:
                processed_results.append(result)

            await self._emit_event(Events.BATCH_PROGRESS, {
                "current": i + 1,
                "total": len(specs_list),
            })

        total_duration = int((time.time() - total_start) * 1000)
        await self._emit_event(Events.BATCH_COMPLETE, {
            "total": len(specs_list),
            "duration_ms": total_duration,
        })

        return processed_results

    async def batch_verify(self, features_list: List[Dict[str, Any]]) -> List[VerifyResult]:
        """
        批量验证多个功能

        并发执行多个功能验证任务。

        Args:
            features_list: 验证参数列表

        Returns:
            验证结果列表
        """
        tasks = [
            self.verify_feature(**params) for params in features_list
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        processed_results = []
        for result in results:
            if isinstance(result, Exception):
                processed_results.append(VerifyResult(
                    success=False,
                    errors=[str(result)]
                ))
            else:
                processed_results.append(result)

        return processed_results

    # ==================== 会话管理 ====================

    async def create_session(self, name: Optional[str] = None) -> Session:
        """
        创建新的开发会话

        会话用于组织相关的规格和代码生成任务。

        Args:
            name: 会话名称（可选，自动生成唯一名称）

        Returns:
            新创建的会话对象

        Example:
            >>> session = await client.create_session(name="用户模块开发")
            >>> print(f"会话ID: {session.session_id}")
        """
        payload: Dict[str, Any] = {}
        if name:
            payload["name"] = name

        response = await self._request("POST", "/api/v1/sessions", payload)
        session_data = response.get("session", {})
        session = self._parse_session(session_data)

        await self._emit_event(Events.SESSION_CREATED, {
            "session_id": session.session_id,
            "name": session.name,
        })

        self._session_id = session.session_id
        return session

    async def get_session(self, session_id: str) -> Session:
        """
        获取会话详情

        Args:
            session_id: 会话 ID

        Returns:
            会话对象

        Raises:
            PDDError: 如果会话不存在
        """
        response = await self._request("GET", f"/api/v1/sessions/{session_id}")
        return self._parse_session(response.get("session", {}))

    async def list_sessions(self) -> List[Session]:
        """
        列出所有会话

        Returns:
            会话列表
        """
        response = await self._request("GET", "/api/v1/sessions")
        sessions_data = response.get("sessions", [])
        return [self._parse_session(s) for s in sessions_data]

    # ==================== 工具方法 ====================

    def health_check(self) -> bool:
        """
        同步健康检查

        快速检测服务端是否可达。此方法是同步的，适合在非异步上下文中使用。

        Returns:
            True 如果服务端健康，False 否则

        Example:
            >>> if client.health_check():
            ...     print("服务可用")
        """
        try:
            url = f"{self.endpoint}/health"
            req = Request(url, method="GET")

            with urlopen(req, timeout=min(self.timeout, 5)) as resp:
                data = json.loads(resp.read().decode())
                return data.get("status") == "ok"
        except Exception as e:
            self._logger.debug(f"健康检查失败: {e}")
            return False

    async def async_health_check(self) -> bool:
        """
        异步健康检查

        Returns:
            True 如果服务端健康
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.health_check)

    def get_server_info(self) -> Optional[ServerInfo]:
        """
        同步获取服务器信息

        Returns:
            ServerInfo 或 None（如果无法连接）
        """
        try:
            url = f"{self.endpoint}/api/v1/status"
            req = Request(url, method="GET")
            self._add_headers(req)

            with urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode())
                return self._parse_server_info(data.get("server", {}))
        except Exception as e:
            self._logger.debug(f"获取服务器信息失败: {e}")
            return None

    @property
    def request_stats(self) -> Dict[str, Any]:
        """
        获取请求统计信息

        Returns:
            包含请求数、最后请求时间等的字典
        """
        return {
            "total_requests": self._request_count,
            "last_request_time": self._last_request_time,
            "endpoint": self.endpoint,
            "has_active_session": self._session_id is not None,
        }

    async def close(self) -> None:
        """
        关闭客户端，释放资源

        清理缓存、移除所有事件监听器。
        通常在程序退出前调用。
        """
        self._events.remove_all_listeners()
        self._logger.info("客户端已关闭")

    # ==================== 内部方法 ====================

    async def _request(
        self,
        method: str,
        path: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        发送 HTTP 请求（内部方法）

        使用线程池执行同步 HTTP 请求，模拟异步行为。

        Args:
            method: HTTP 方法 (GET/POST/PUT/DELETE)
            path: API 路径
            data: 请求数据（仅 POST/PUT 时使用）

        Returns:
            解析后的 JSON 响应数据

        Raises:
            PDDConnectionError: 连接失败
            AuthError: 认证失败 (401)
            ValidationError: 参数错误 (400)
            ServerError: 服务端错误 (5xx)
            PDDTimeoutError: 超时
            RateLimitError: 限流 (429)
        """
        self._request_count += 1
        self._last_request_time = time.time()

        # 在线程池中执行同步 HTTP 请求
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self._sync_request(method, path, data)
        )

        return response

    def _sync_request(
        self,
        method: str,
        path: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        同步 HTTP 请求实现（内部方法）

        使用标准库 urllib 实现 HTTP 通信。

        Args:
            method: HTTP 方法
            path: API 路径
            data: 请求数据

        Returns:
            JSON 响应数据
        """
        url = f"{self.endpoint}{path}"
        body = None

        if data and method in ("POST", "PUT"):
            body = json.dumps(data).encode("utf-8")

        req = Request(url, data=body, method=method)
        self._add_headers(req)

        try:
            self._logger.debug(f"发送请求: {method} {url}")

            with urlopen(req, timeout=self.timeout) as resp:
                response_data = resp.read()
                status_code = resp.status if hasattr(resp, 'status') else 200

                self._logger.debug(
                    f"收到响应: {status_code} | 大小: {len(response_data)} bytes"
                )

                result = json.loads(response_data.decode())

                # 检查业务层错误
                if not result.get("success", True):
                    error_msg = result.get("message", "未知错误")
                    error_code = result.get("code")
                    raise self._map_error(error_msg, error_code, status_code)

                return result

        except HTTPError as e:
            error_body = {}
            try:
                error_body = json.loads(e.read().decode())
            except Exception:
                pass

            status_code = e.code
            raise self._map_error(
                error_body.get("message", str(e)),
                error_body.get("code"),
                status_code
            )

        except URLError as e:
            raise PDDConnectionError(
                message=f"无法连接到服务端: {e.reason}",
                details={"endpoint": self.endpoint, "reason": str(e.reason)}
            )

        except TimeoutError as e:
            raise PDDTimeoutError(
                message=f"请求超时 ({self.timeout}s)",
                details={"timeout": self.timeout}
            )

    def _add_headers(self, req: Request) -> None:
        """
        添加 HTTP 请求头

        Args:
            req: urllib Request 对象
        """
        req.add_header("Content-Type", "application/json; charset=utf-8")
        req.add_header("Accept", "application/json")
        req.add_header("User-Agent", "PDD-Python-SDK/1.0.0")

        if self.api_key:
            req.add_header("Authorization", f"Bearer {self.api_key}")

        if self._session_id:
            req.add_header("X-Session-ID", self._session_id)

    def _map_error(
        self,
        message: str,
        code: Optional[str],
        status_code: int,
    ) -> PDDError:
        """
        将 HTTP 错误映射为 SDK 异常

        Args:
            message: 错误消息
            code: 错误代码
            status_code: HTTP 状态码

        Returns:
            对应类型的 PDDError 子类
        """
        if status_code == 401 or code == "AUTH_ERROR":
            return AuthError(message=message, details={"status_code": status_code})
        elif status_code == 400 or code == "VALIDATION_ERROR":
            return ValidationError(message=message, details={"status_code": status_code})
        elif status_code == 429 or code == "RATE_LIMIT_ERROR":
            return RateLimitError(message=message, details={"status_code": status_code})
        elif status_code >= 500:
            return ServerError(message=message, details={"status_code": status_code})
        else:
            return PDDError(message=message, code=code, details={"status_code": status_code})

    async def _emit_event(self, event_name: str, data: Dict[str, Any]) -> None:
        """内部方法：触发事件"""
        try:
            await self._events.async_emit(event_name, **data)
        except Exception as e:
            self._logger.debug(f"事件触发失败 ({event_name}): {e}")

    # ==================== 响应解析方法 ====================

    @staticmethod
    def _parse_spec_result(data: Dict[str, Any]) -> SpecResult:
        """解析规格生成响应"""
        raw_features = data.get("features", [])
        features = []
        for f in raw_features:
            if isinstance(f, dict):
                features.append({
                    "id": f.get("id", ""),
                    "name": f.get("name", ""),
                    "description": f.get("description", ""),
                })
            elif isinstance(f, str):
                features.append({"id": f, "name": f})

        return SpecResult(
            success=data.get("success", False),
            spec_id=data.get("spec_id", ""),
            spec_path=data.get("spec_path", ""),
            features=features,
            warnings=data.get("warnings", []),
            errors=data.get("errors", []),
            metadata=data.get("metadata", {}),
        )

    @staticmethod
    def _parse_code_result(data: Dict[str, Any]) -> CodeResult:
        """解析代码生成响应"""
        raw_files = data.get("files_generated", [])
        files = []
        for f in raw_files:
            if isinstance(f, dict):
                files.append(GeneratedFile(
                    path=f.get("path", ""),
                    absolute_path=f.get("absolute_path", ""),
                    lines_of_code=f.get("lines_of_code", 0),
                    language=f.get("language", ""),
                    size_bytes=f.get("size_bytes", 0),
                ))
            elif isinstance(f, str):
                files.append(GeneratedFile(path=f))

        return CodeResult(
            success=data.get("success", False),
            feature_id=data.get("feature_id", ""),
            files_generated=files,
            lines_of_code=data.get("lines_of_code", 0),
            warnings=data.get("warnings", []),
            errors=data.get("errors", []),
        )

    @staticmethod
    def _parse_verify_result(data: Dict[str, Any]) -> VerifyResult:
        """解析验证响应"""
        raw_issues = data.get("issues", [])
        issues = []
        for issue in raw_issues:
            severity_val = issue.get("severity", "error")
            severity = next(
                (s for s in Severity if s.value == severity_val), Severity.ERROR
            )
            issues.append(VerifyIssue(
                file_path=issue.get("file_path", ""),
                message=issue.get("message", ""),
                severity=severity,
                line_number=issue.get("line_number"),
                suggestion=issue.get("suggestion", ""),
            ))

        return VerifyResult(
            success=data.get("success", False),
            coverage_percent=float(data.get("coverage_percent", 0)),
            criteria_passed=data.get("criteria_passed", []),
            criteria_failed=data.get("criteria_failed", []),
            issues=issues,
            summary=data.get("summary", ""),
        )

    @staticmethod
    def _parse_review_result(data: Dict[str, Any]) -> ReviewResult:
        """解析代码审查响应"""
        raw_findings = data.get("findings", [])
        findings = []
        for f in raw_findings:
            severity_val = f.get("severity", "error")
            severity = next(
                (s for s in Severity if s.value == severity_val), Severity.ERROR
            )
            findings.append(ReviewFinding(
                rule_id=f.get("rule_id", ""),
                category=f.get("category", "general"),
                severity=severity,
                message=f.get("message", ""),
                file_path=f.get("file_path", ""),
                line_number=f.get("line_number"),
                suggestion=f.get("suggestion", ""),
            ))

        return ReviewResult(
            success=data.get("success", False),
            score=float(data.get("score", 0)),
            grade=data.get("grade", ""),
            findings=findings,
            metrics=data.get("metrics", {}),
            summary=data.get("summary", ""),
        )

    @staticmethod
    def _parse_skills_list(data: Union[List, Dict]) -> List[SkillInfo]:
        """解析技能列表响应"""
        items = data if isinstance(data, list) else data.get("skills", [])
        skills = []
        for item in items:
            skills.append(SkillInfo(
                name=item.get("name", ""),
                version=item.get("version", "1.0.0"),
                description=item.get("description", ""),
                category=item.get("category", "general"),
                triggers=item.get("triggers", []),
                has_evals=item.get("has_evals", False),
                author=item.get("author"),
                tags=item.get("tags", []),
            ))
        return skills

    @staticmethod
    def _parse_server_info(data: Dict[str, Any]) -> ServerInfo:
        """解析服务器信息"""
        return ServerInfo(
            version=data.get("version", "unknown"),
            uptime=float(data.get("uptime", 0)),
            supported_apis=data.get("supported_apis", []),
            available_skills=int(data.get("available_skills", 0)),
            system_info=data.get("system_info", {}),
        )

    @staticmethod
    def _parse_session(data: Dict[str, Any]) -> Session:
        """解析会话数据"""
        from datetime import datetime

        created_at_str = data.get("created_at")
        updated_at_str = data.get("updated_at")

        try:
            created_at = datetime.fromisoformat(created_at_str) if created_at_str else datetime.now()
        except (ValueError, TypeError):
            created_at = datetime.now()

        try:
            updated_at = datetime.fromisoformat(updated_at_str) if updated_at_str else datetime.now()
        except (ValueError, TypeError):
            updated_at = datetime.now()

        status_val = data.get("status", "pending")
        status = next(
            (s for s in TaskStatus if s.value == status_val), TaskStatus.PENDING
        )

        return Session(
            session_id=data.get("session_id", ""),
            name=data.get("name", ""),
            created_at=created_at,
            updated_at=updated_at,
            status=status,
            specs=data.get("specs", []),
            metadata=data.get("metadata", {}),
        )

    def __repr__(self) -> str:
        """返回对象的字符串表示"""
        return (
            f"PDDClient(endpoint='{self.endpoint}', "
            f"debug={self.debug}, retries={self.max_retries})"
        )

    async def __aenter__(self) -> "PDDClient":
        """异步上下文管理器入口"""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """异步上下文管理器出口"""
        await self.close()
