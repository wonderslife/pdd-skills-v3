"""AI Test Framework - 数据模型定义

从 run_testcase.py 提取的纯数据结构，不包含任何业务逻辑。
包含: StepStatus枚举、SnapshotElement快照元素、StepResult步骤结果、TestcaseResult用例结果。
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

from tests.framework.constants import INTERACTIVE_ROLES


class StepStatus(Enum):
    SUCCESS = "success"
    FAILED = "failed"
    FAILED_ASSERT = "failed_assert"
    SKIPPED = "skipped"
    ERROR = "error"
    RETRIED = "retried"


@dataclass
class SnapshotElement:
    uid: str
    role: str = ""
    name: str = ""
    text: str = ""
    value: str = ""
    attributes: Dict[str, str] = field(default_factory=dict)
    raw_line: str = ""
    indent_level: int = 0

    @property
    def combined_text(self) -> str:
        parts = [self.role, self.name, self.text, self.value]
        return " ".join(p for p in parts if p).lower()

    @property
    def is_interactive(self) -> bool:
        return self.role in INTERACTIVE_ROLES

    @property
    def is_visible(self) -> bool:
        return self.role not in ("ignored",) and self.role != ""

    @property
    def is_readonly(self) -> bool:
        return "readonly" in self.raw_line.lower() or self.attributes.get("readonly") == "true"


@dataclass
class StepResult:
    step_num: int
    desc: str
    action: str
    status: StepStatus
    mcp_tool: str = ""
    mcp_args: Dict[str, Any] = field(default_factory=dict)
    output: str = ""
    error: str = ""
    assertions: List[Dict[str, Any]] = field(default_factory=list)
    duration_ms: int = 0
    retry_count: int = 0
    snapshot_before: str = ""
    snapshot_after: str = ""
    snapshot_path: str = ""
    thinking: str = ""
    thinking_pre: str = ""
    thinking_post: str = ""
    llm_confidence: float = 0.0
    llm_suggestions: List[str] = field(default_factory=list)


@dataclass
class TestcaseResult:
    test_id: str
    title: str
    priority: str
    yaml_file: str
    timestamp: str
    config: Dict[str, Any] = field(default_factory=dict)
    steps: List[StepResult] = field(default_factory=list)
    screenshots: List[str] = field(default_factory=list)
    log_lines: List[str] = field(default_factory=list)
    env_used: Dict[str, str] = field(default_factory=dict)

    @property
    def total_steps(self) -> int:
        return len(self.steps)

    @property
    def passed_count(self) -> int:
        return sum(1 for s in self.steps if s.status == StepStatus.SUCCESS)

    @property
    def failed_count(self) -> int:
        return sum(1 for s in self.steps if s.status in (StepStatus.FAILED, StepStatus.FAILED_ASSERT, StepStatus.ERROR))

    @property
    def skipped_count(self) -> int:
        return sum(1 for s in self.steps if s.status == StepStatus.SKIPPED)

    @property
    def pass_rate(self) -> float:
        if self.total_steps == 0:
            return 0.0
        executed = self.total_steps - self.skipped_count
        if executed == 0:
            return 0.0
        return (self.passed_count / executed) * 100

    @property
    def overall_status(self) -> str:
        if self.failed_count == 0 and self.skipped_count == 0:
            return "PASS"
        elif self.passed_count > 0:
            return "PARTIAL"
        else:
            return "FAIL"
