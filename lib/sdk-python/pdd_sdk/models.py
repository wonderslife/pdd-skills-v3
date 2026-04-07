"""
PDD SDK 数据模型定义

使用 dataclass 定义所有请求和响应的数据结构，
提供完整的类型注解和默认值。
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class Severity(Enum):
    """问题严重程度枚举"""

    INFO = "info"
    """信息级别，仅作提示"""

    WARN = "warn"
    """警告级别，可能存在问题"""

    ERROR = "error"
    """错误级别，必须修复"""


class TaskStatus(Enum):
    """任务状态枚举"""

    PENDING = "pending"
    """等待执行"""

    RUNNING = "running"
    """正在执行"""

    COMPLETED = "completed"
    """已完成"""

    FAILED = "failed"
    """执行失败"""

    CANCELLED = "cancelled"
    """已取消"""


# ==================== 规格生成相关模型 ====================


@dataclass
class FeatureInfo:
    """
    功能点信息

    Attributes:
        id: 功能点唯一标识
        name: 功能点名称
        description: 功能点描述
        priority: 优先级 (1-5)
        status: 当前状态
        acceptance_criteria: 验收标准列表
    """

    id: str
    name: str
    description: str = ""
    priority: int = 3
    status: str = "pending"
    acceptance_criteria: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "priority": self.priority,
            "status": self.status,
            "acceptance_criteria": self.acceptance_criteria
        }


@dataclass
class SpecResult:
    """
    规格生成结果

    Attributes:
        success: 是否成功
        spec_id: 规格文档唯一标识
        spec_path: 规格文件路径
        features: 提取的功能点列表
        warnings: 警告信息列表
        errors: 错误信息列表
        duration_ms: 执行耗时（毫秒）
        metadata: 额外的元数据
    """

    success: bool
    spec_id: str
    spec_path: str
    features: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    duration_ms: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def feature_count(self) -> int:
        """返回功能点数量"""
        return len(self.features)


# ==================== 代码生成相关模型 ====================


@dataclass
class GeneratedFile:
    """
    生成的文件信息

    Attributes:
        path: 文件相对路径
        absolute_path: 文件绝对路径
        lines_of_code: 代码行数
        language: 编程语言
        size_bytes: 文件大小（字节）
    """

    path: str
    absolute_path: str = ""
    lines_of_code: int = 0
    language: str = ""
    size_bytes: int = 0


@dataclass
class CodeResult:
    """
    代码生成结果

    Attributes:
        success: 是否成功
        feature_id: 生成的功能点 ID
        files_generated: 生成的文件列表
        lines_of_code: 总代码行数
        warnings: 警告信息列表
        errors: 错误信息列表
        duration_ms: 执行耗时（毫秒）
    """

    success: bool
    feature_id: str
    files_generated: List[GeneratedFile] = field(default_factory=list)
    lines_of_code: int = 0
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    duration_ms: int = 0

    @property
    def file_count(self) -> int:
        """返回生成的文件数量"""
        return len(self.files_generated)

    @property
    def file_paths(self) -> List[str]:
        """返回所有文件的路径列表"""
        return [f.path for f in self.files_generated]


# ==================== 验证相关模型 ====================


@dataclass
class VerifyCriterion:
    """
    单个验收标准验证结果

    Attributes:
        name: 标准名称
        passed: 是否通过
        details: 详细说明
        severity: 严重程度
    """

    name: str
    passed: bool
    details: str = ""
    severity: Severity = Severity.INFO


@dataclass
class VerifyIssue:
    """
    验证发现的问题

    Attributes:
        file_path: 问题所在文件
        line_number: 行号（可选）
        message: 问题描述
        severity: 严重程度
        suggestion: 修复建议
    """

    file_path: str
    message: str
    severity: Severity = Severity.ERROR
    line_number: Optional[int] = None
    suggestion: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "file_path": self.file_path,
            "line_number": self.line_number,
            "message": self.message,
            "severity": self.severity.value,
            "suggestion": self.suggestion
        }


@dataclass
class VerifyResult:
    """
    功能验证结果

    Attributes:
        success: 是否通过验证
        coverage_percent: 覆盖率百分比
        criteria_passed: 通过的验收标准列表
        criteria_failed: 未通过的验收标准列表
        issues: 发现的问题列表
        summary: 验证摘要
        duration_ms: 执行耗时（毫秒）
    """

    success: bool
    coverage_percent: float = 0.0
    criteria_passed: List[str] = field(default_factory=list)
    criteria_failed: List[str] = field(default_factory=list)
    issues: List[VerifyIssue] = field(default_factory=list)
    summary: str = ""
    duration_ms: int = 0

    @property
    def total_criteria(self) -> int:
        """返回总验收标准数"""
        return len(self.criteria_passed) + len(self.criteria_failed)

    @property
    def issue_count(self) -> int:
        """返回问题总数"""
        return len(self.issues)

    @property
    def error_count(self) -> int:
        """返回错误级别问题数量"""
        return sum(1 for i in self.issues if i.severity == Severity.ERROR)


# ==================== 代码审查相关模型 ====================


@dataclass
class ReviewFinding:
    """
    审查发现项

    Attributes:
        rule_id: 规则 ID
        category: 分类 (complexity|security|style|performance|best-practice)
        severity: 严重程度
        file_path: 所在文件
        line_number: 行号
        message: 描述信息
        suggestion: 改进建议
    """

    rule_id: str
    category: str
    severity: Severity
    message: str
    file_path: str = ""
    line_number: Optional[int] = None
    suggestion: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "rule_id": self.rule_id,
            "category": self.category,
            "severity": self.severity.value,
            "file_path": self.file_path,
            "line_number": self.line_number,
            "message": self.message,
            "suggestion": self.suggestion
        }


@dataclass
class ReviewResult:
    """
    代码审查结果

    Attributes:
        success: 是否成功完成审查
        score: 综合评分 (0-100)
        grade: 等级 (A/B/C/D/F)
        findings: 发现的问题列表
        metrics: 各维度指标
        summary: 审查摘要
        duration_ms: 执行耗时（毫秒）
    """

    success: bool
    score: float = 0.0
    grade: str = ""
    findings: List[ReviewFinding] = field(default_factory=list)
    metrics: Dict[str, float] = field(default_factory=dict)
    summary: str = ""
    duration_ms: int = 0

    @property
    def finding_count(self) -> int:
        """返回问题总数"""
        return len(self.findings)

    @property
    def critical_count(self) -> int:
        """返回严重问题数量"""
        return sum(1 for f in self.findings if f.severity == Severity.ERROR)

    def get_findings_by_severity(self, severity: Severity) -> List[ReviewFinding]:
        """按严重程度筛选问题"""
        return [f for f in self.findings if f.severity == severity]


# ==================== 技能相关模型 ====================


@dataclass
class SkillInfo:
    """
    技能信息

    Attributes:
        name: 技能名称
        version: 版本号
        description: 技能描述
        category: 所属分类
        triggers: 触发关键词列表
        has_evals: 是否包含评估用例
        author: 作者（可选）
        tags: 标签列表
    """

    name: str
    version: str
    description: str
    category: str
    triggers: List[str] = field(default_factory=list)
    has_evals: bool = False
    author: Optional[str] = None
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "category": self.category,
            "triggers": self.triggers,
            "has_evals": self.has_evals,
            "author": self.author,
            "tags": self.tags
        }


# ==================== 会话相关模型 ====================


@dataclass
class Session:
    """
    开发会话

    Attributes:
        session_id: 会话唯一标识
        name: 会话名称
        created_at: 创建时间
        updated_at: 最后更新时间
        status: 会话状态
        specs: 关联的规格列表
        metadata: 额外元数据
    """

    session_id: str
    name: str
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    status: TaskStatus = TaskStatus.PENDING
    specs: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "session_id": self.session_id,
            "name": self.name,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "status": self.status.value,
            "specs": self.specs,
            "metadata": self.metadata
        }


# ==================== 服务状态模型 ====================


@dataclass
class ServerInfo:
    """
    服务端信息

    Attributes:
        version: 服务版本号
        uptime: 运行时间（秒）
        supported_apis: 支持的 API 列表
        available_skills: 可用技能数量
        system_info: 系统信息
    """

    version: str
    uptime: float = 0.0
    supported_apis: List[str] = field(default_factory=list)
    available_skills: int = 0
    system_info: Dict[str, str] = field(default_factory=dict)


@dataclass
class StatusResult:
    """
    服务状态查询结果

    Attributes:
        healthy: 是否健康
        server_info: 服务端详细信息
        response_time_ms: 响应时间（毫秒）
        timestamp: 查询时间戳
    """

    healthy: bool
    server_info: Optional[ServerInfo] = None
    response_time_ms: int = 0
    timestamp: datetime = field(default_factory=datetime.now)


# ==================== 批量操作结果 ====================


@dataclass
class BatchResult:
    """
    批量操作结果

    Attributes:
        total: 总任务数
        succeeded: 成功数
        failed: 失败数
        results: 各任务的结果列表
        errors: 失败任务的错误信息
        total_duration_ms: 总耗时（毫秒）
    """

    total: int
    succeeded: int = 0
    failed: int = 0
    results: List[Any] = field(default_factory=list)
    errors: List[Dict[str, Any]] = field(default_factory=list)
    total_duration_ms: int = 0

    @property
    def success_rate(self) -> float:
        """返回成功率百分比"""
        if self.total == 0:
            return 0.0
        return (self.succeeded / self.total) * 100


# ==================== 事件数据模型 ====================


@dataclass
class EventData:
    """
    事件数据

    Attributes:
        event_type: 事件类型
        timestamp: 事件发生时间
        data: 事件负载数据
        source: 事件来源
    """

    event_type: str
    data: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.now)
    source: str = "pdd_sdk"

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "event_type": self.event_type,
            "timestamp": self.timestamp.isoformat(),
            "data": self.data,
            "source": self.source
        }
