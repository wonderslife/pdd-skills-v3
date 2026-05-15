"""
AI Test Framework v2.1 - 通用 AI 测试框架（含思维链）
======================================================
基于 Chrome DevTools MCP + LLM 的 YAML 驱动 E2E 测试执行器

v2.1 新增:
  🧠 LLM 思维链：每步执行前后调用大模型输出决策思考过程
  📝 智能分析：元素匹配推理、操作风险评估、断言预测
  💭 可视化思考：清晰展示模型的"为什么这样做"

v2.0 改进:
  ✅ 完整执行保证：所有步骤强制执行，支持 continue_on_error 策略
  ✅ 智能重试机制：自动重试失败操作（可配置次数和间隔）
  ✅ 增强元素匹配：多策略匹配 + 同义词扩展 + 位置感知
  ✅ 完整断言系统：10+ 断言类型，支持复合断言和置信度
  ✅ 插件化架构：支持自定义 Action 和 Assertion 扩展

用法:
  python testcase-ai.py                          # 列出用例
  python testcase-ai.py --all                     # 全部运行
  python testcase-ai.py tc2-zccz                  # 运行目录
  python testcase-ai.py testcases/tc2-zccz/asset-eval-apply.yaml
  python testcase-ai.py --think                   # 启用思维链输出
  python testcase-ai.py --think-deep              # 深度思维模式
"""

import asyncio
import json
import os
import re
import shutil
import sys
import time
import traceback
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple, Type, Union

import yaml
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


# ============================================================
# LLM 配置区
# ============================================================

LLM_CONFIG = {
    "enabled": True,
    "base_url": os.environ.get("LLM_BASE_URL", "http://10.0.11.6:8005/v1"),
    "api_key": os.environ.get("LLM_API_KEY", "APIKEY"),
    "model": os.environ.get("LLM_MODEL", "gemma-4-26B-A4B-it"),
    "temperature": 0.3,
    "max_tokens": 2048,
    "timeout": 30,
    "think_mode": "auto",
}

try:
    from openai import OpenAI
    LLM_AVAILABLE = True
except ImportError:
    LLM_AVAILABLE = False


# ============================================================
# MCP 配置区
# ============================================================

SERVER_PARAMS = StdioServerParameters(
    name="Chrome DevTools MCP",
    command="npx",
    args=["-y", "chrome-devtools-mcp@latest"],
    env=None,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
TESTCASES_ROOT = os.path.join(PROJECT_ROOT, "testcases")
RESULT_BASE_DIR = os.path.join(PROJECT_ROOT, "test-result")
ENV_FILE_PATH = os.path.join(BASE_DIR, ".env.test")

DEFAULT_CONFIG = {
    "max_retries": 3,
    "retry_delay": 1.0,
    "default_wait": 2.0,
    "snapshot_timeout": 10.0,
    "element_wait_timeout": 5.0,
    "continue_on_error": True,
    "screenshot_on_error": True,
    "verbose_logging": True,
    "llm_think_enabled": False,
    "llm_think_deep": False,
}


# ============================================================
# 数据模型
# ============================================================

INTERACTIVE_ROLES = frozenset({
    "button", "link", "textbox", "input", "combobox", "select",
    "checkbox", "radio", "menuitem", "option", "tab", "spinbutton",
    "treeitem", "slider", "switch",
})

INPUT_ROLES = frozenset({"textbox", "input", "textarea", "combobox", "select", "search"})


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
    thinking: str = ""           # LLM 思考过程（思维链）
    thinking_pre: str = ""       # 执行前思考
    thinking_post: str = ""      # 执行后反思
    llm_confidence: float = 0.0  # LLM 置信度
    llm_suggestions: List[str] = field(default_factory=list)  # LLM 建议


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


# ============================================================
# 工具函数
# ============================================================

def resolve_env_vars(value):
    """解析环境变量 ${VAR} 和 ${VAR:-default} 格式"""
    if not isinstance(value, str):
        return value

    def replacer(match):
        var_expr = match.group(1)
        if ":-" in var_expr:
            var_name, default = var_expr.split(":-", 1)
            return os.environ.get(var_name.strip(), default.strip())
        resolved = os.environ.get(var_expr.strip())
        if resolved is None:
            return match.group(0)
        return resolved

    return re.sub(r"\$\{([^}]+)\}", replacer, value)


def _load_env_from_file():
    """从 .env 文件加载环境变量（优先级：.env.local > .env.test）"""
    import re as _re
    from pathlib import Path

    env_files = [
        Path(ENV_FILE_PATH),
        Path(BASE_DIR) / ".env.local",
    ]

    for env_file in env_files:
        if env_file.exists():
            loaded_count = 0
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    match = _re.match(r'^([A-Za-z_][A-Za-z0-9_]*)=(.*)$', line)
                    if match:
                        key, value = match.group(1), match.group(2).strip()
                        if (value.startswith('"') and value.endswith('"')) or \
                           (value.startswith("'") and value.endswith("'")):
                            value = value[1:-1]
                        if key not in os.environ:
                            os.environ[key] = value
                            loaded_count += 1

            if loaded_count > 0:
                log(f"📂 从 {env_file.name} 加载了 {loaded_count} 个环境变量")
            break


def _load_testcase_env(yaml_path: str) -> Dict[str, str]:
    """从 YAML 同目录加载同名 .env 文件（如 asset-eval-apply.yaml → asset-eval-apply.env）

    返回加载的变量字典，用于执行后清理。
    """
    import re as _re
    from pathlib import Path

    yaml_path = Path(yaml_path)
    env_path = yaml_path.with_suffix('.env')
    loaded = {}

    if not env_path.exists():
        log(f"  [Env] 无配套 .env 文件: {env_path.name}", 2)
        return loaded

    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            match = _re.match(r'^([A-Za-z_][A-Za-z0-9_]*)=(.*)$', line)
            if match:
                key, value = match.group(1), match.group(2).strip()
                if (value.startswith('"') and value.endswith('"')) or \
                   (value.startswith("'") and value.endswith("'")):
                    value = value[1:-1]
                old_val = os.environ.get(key)
                os.environ[key] = value
                loaded[key] = old_val

    if loaded:
        log(f"  [Env] 📂 从 {env_path.name} 加载 {len(loaded)} 个变量: {list(loaded.keys())}", 1)
    return loaded


def log(msg: str, level: int = 0, timestamp: bool = True):
    prefix = "  " * level
    ts = f"[{time.strftime('%H:%M:%S')}]" if timestamp else ""
    print(f"{prefix}{ts} {msg}" if ts else f"{prefix}{msg}")


def deep_get(d: Dict, keys: str, default=None):
    """安全获取嵌套字典值"""
    keys = keys.split(".")
    for key in keys:
        if isinstance(d, dict):
            d = d.get(key, default)
        else:
            return default
    return d


# ============================================================
# 智能登录状态检测器
# ============================================================

class LoginStateDetector:
    """
    登录状态智能检测器 - 使用 LLM 判断当前是否已登录
    
    功能:
      1. 获取页面快照，分析当前页面状态
      2. 调用 LLM 判断是否已登录（基于 home_indicator 等标志）
      3. 自动识别并跳过登录相关步骤
      
    使用场景:
      - 测试用例包含登录步骤，但浏览器可能已处于登录状态
      - 避免重复登录导致的测试失败或时间浪费
      - 提高测试执行效率
    """
    
    DETECTION_PROMPT = """你是一个专业的 Web 应用状态检测 AI。

## 任务
判断当前用户是否已经登录了目标系统。

## 判断依据
1. **页面特征**: 当前页面显示的关键元素（如用户头像、姓名、已登录标志等）
2. **URL 特征**: 当前 URL 是否包含已登录后的路径特征
3. **元素存在性**: 是否存在登录表单 vs 已登录后的导航/内容区域

## 输出格式（严格 JSON）
{
  "is_logged_in": true/false,
  "confidence": 0.0-1.0,
  "reason": "判断理由（中文，简短）",
  "indicators": {
    "found": ["检测到的已登录标志"],
    "missing": ["缺失的未登录标志"]
  }
}

## 参考信息
- **期望的已登录标志 (home_indicator)**: {home_indicator}
- **登录页特征**: 包含"欢迎登录"、用户名输入框、密码输入框、登录按钮等
- **已登录后特征**: 包含首页内容、用户信息、导航菜单、工作台等

## 页面快照
{snapshot_summary}

请分析上述快照，判断用户是否已登录。只输出 JSON，不要其他内容。"""

    def __init__(self, session, parser, config: Dict[str, Any], think_engine=None):
        self.session = session
        self.parser = parser
        self.config = config
        self.think_engine = think_engine
        self.detection_result = None
        
    async def detect_login_state(self, context_check: Dict[str, Any]) -> Dict[str, Any]:
        """
        检测当前登录状态
        
        Args:
            context_check: YAML 中的 context_check 配置
            
        Returns:
            {
                "is_logged_in": bool,
                "confidence": float,
                "reason": str,
                "method": "llm" | "rule" | "fallback",
                "skipped_steps": List[int]
            }
        """
        home_indicator = context_check.get("home_indicator", "")
        login_url = context_check.get("login_url", "")
        
        log(f"🔍 开始检测登录状态...", 2)
        
        # 策略 1：使用 LLM 智能检测（优先）
        if self.think_engine and self.think_engine.enabled:
            result = await self._detect_with_llm(home_indicator)
            if result:
                self.detection_result = result
                return result
        
        # 策略 2：规则匹配（备选）
        result = await self._detect_with_rules(home_indicator, login_url)
        if result:
            self.detection_result = result
            return result
        
        # 策略 3：默认未登录（兜底）
        return {
            "is_logged_in": False,
            "confidence": 0.0,
            "reason": "无法检测，默认为未登录状态",
            "method": "fallback",
            "skipped_steps": []
        }
    
    async def _detect_with_llm(self, home_indicator: str) -> Optional[Dict]:
        """使用 LLM 进行智能检测"""
        try:
            snapshot_text = await self._get_snapshot_summary()
            if not snapshot_text:
                return None
            
            prompt = self.DETECTION_PROMPT.format(
                home_indicator=home_indicator,
                snapshot_summary=snapshot_text[:3000]
            )
            
            response = await self.think_engine._call_llm(prompt, max_tokens=500)
            if not response or not response.strip():
                return None
            
            import json
            # 清理响应文本，提取 JSON
            cleaned_response = response.strip()
            
            # 尝试直接解析
            try:
                result = json.loads(cleaned_response)
            except json.JSONDecodeError:
                # 尝试提取 JSON 对象（处理 markdown 代码块等情况）
                json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', cleaned_response, re.DOTALL)
                if json_match:
                    try:
                        result = json.loads(json_match.group())
                    except json.JSONDecodeError:
                        log(f"  ⚠️ LLM JSON 解析失败，尝试修复...", 3)
                        # 尝试修复常见的 JSON 格式问题
                        json_str = json_match.group()
                        json_str = re.sub(r',\s*([}\]])', r'\1', json_str)  # 移除尾部逗号
                        json_str = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', json_str)  # 移除控制字符
                        try:
                            result = json.loads(json_str)
                        except json.JSONDecodeError as e2:
                            log(f"  ⚠️ LLM JSON 修复失败: {e2}", 3)
                            return None
                else:
                    return None
            
            is_logged_in = result.get("is_logged_in", False)
            confidence = result.get("confidence", 0)
            reason = result.get("reason", "")
            
            log(f"  🧠 LLM 判断: {'✅ 已登录' if is_logged_in else '❌ 未登录'} (置信度: {confidence:.0%})", 2)
            log(f"     理由: {reason}", 3)
            
            return {
                "is_logged_in": is_logged_in,
                "confidence": confidence,
                "reason": reason,
                "method": "llm",
                "skipped_steps": []
            }
                
        except Exception as e:
            log(f"  ⚠️ LLM 检测失败: {e}", 3)
        
        return None
    
    async def _detect_with_rules(self, home_indicator: str, login_url: str) -> Optional[Dict]:
        """使用规则进行快速检测"""
        try:
            snapshot_text = await self._get_snapshot_summary()
            if not snapshot_text:
                return None
            
            text_lower = snapshot_text.lower()
            indicator_lower = home_indicator.lower() if home_indicator else ""
            
            # 已登录标志检测
            logged_in_indicators = [
                indicator_lower,
                "个人工作台",
                "首页",
                "退出",
                "注销",
                "用户信息",
                "我的",
                "dashboard",
                "welcome",
                "已登录",
            ]
            
            # 未登录标志检测
            logged_out_indicators = [
                "欢迎登录",
                "请登录",
                "登录表单",
                "username",
                "password",
                "用户名",
                "密码",
                "sign in",
                "log in",
                "login",
            ]
            
            found_logged_in = sum(1 for ind in logged_in_indicators if ind and ind in text_lower)
            found_logged_out = sum(1 for ind in logged_out_indicators if ind and ind in text_lower)
            
            is_logged_in = found_logged_in > found_logged_out and found_logged_in > 0
            confidence = min(0.9, abs(found_logged_in - found_logged_out) / max(found_logged_in, found_logged_out, 1))
            
            reason = f"规则检测: 已登录标志={found_logged_in}, 未登录标志={found_logged_out}"
            
            log(f"  📋 规则判断: {'✅ 已登录' if is_logged_in else '❌ 未登录'} (置信度: {confidence:.0%})", 2)
            
            return {
                "is_logged_in": is_logged_in,
                "confidence": confidence,
                "reason": reason,
                "method": "rule",
                "skipped_steps": []
            }
            
        except Exception as e:
            log(f"  ⚠️ 规则检测失败: {e}", 3)
        
        return None
    
    async def _get_snapshot_summary(self) -> str:
        """获取页面快照摘要"""
        try:
            result = await self.session.call_tool("take_snapshot", {"verbose": True})
            snapshot_text = ""
            if result.content:
                for item in result.content:
                    if hasattr(item, 'text'):
                        snapshot_text += item.text + "\n"
                    else:
                        snapshot_text += str(item) + "\n"
            
            if snapshot_text:
                self.parser.parse(snapshot_text)
            
            return snapshot_text
        except Exception as e:
            log(f"  [Snapshot Error] {e}", 3)
            return ""
    
    def identify_login_steps(self, steps: List[Dict], context_check: Dict) -> Tuple[List[int], List[int]]:
        """
        识别哪些步骤属于登录流程
        
        Returns:
            (login_step_indices, post_login_step_indices)
        """
        login_steps = []
        post_login_steps = []
        
        login_keywords = [
            "登录", "login", "用户名", "密码", "username", "password",
            "凭据", "credential", "认证", "auth"
        ]
        
        for idx, step in enumerate(steps):
            step_text = " ".join([
                str(step.get("desc", "")),
                str(step.get("action", "")),
                str(step.get("target", ""))
            ]).lower()
            
            is_login_step = any(kw in step_text for kw in login_keywords)
            
            if is_login_step:
                login_steps.append(idx)
            else:
                post_login_steps.append(idx)
        
        return login_steps, post_login_steps


def should_skip_step(step_idx: int, detection_result: Dict, login_step_indices: List[int]) -> bool:
    """
    判断某个步骤是否应该被跳过
    
    Args:
        step_idx: 步骤索引（从 0 开始）
        detection_result: 登录检测结果
        login_step_indices: 登录步骤索引列表
        
    Returns:
        True 表示应该跳过
    """
    if not detection_result.get("is_logged_in"):
        return False
    
    return step_idx in login_step_indices


# ============================================================
# LLM 思维链引擎 v2.1
# ============================================================

class ThinkChainEngine:
    """
    LLM 思维链引擎 - 为每步测试生成 AI 决策思考过程
    
    功能:
      1. 执行前分析：理解步骤意图、评估页面状态、预测操作结果
      2. 执行后反思：验证结果符合预期、分析异常原因、给出建议
    
    输出格式:
      🧠 [思考] 分析当前步骤的目标和上下文...
      🔍 [观察] 页面状态：检测到 X 个可交互元素...
      🎯 [决策] 选择元素 UID=xxx，理由是...
      ⚠️ [风险] 潜在问题：...
      💡 [建议] 后续步骤可能需要...
    """
    
    SYSTEM_PROMPT = """你是一个专业的 UI 测试自动化 AI 助手。
你的任务是为每个测试步骤生成结构化的思维链（Chain-of-Thought）输出。

## 你的角色
- 测试执行分析师：分析每步操作的合理性和可行性
- 风险评估员：识别潜在的操作失败点
- 问题诊断师：当步骤失败时，分析可能的原因

## 输出格式要求
请严格按照以下格式输出，使用中文：

### 执行前思考 (Pre-execution Thinking)
```
🧠 **目标理解**: [用一句话描述这步要做什么]
📊 **上下文分析**: 
   - 当前动作类型: {action}
   - 目标元素: {target}
   - 操作参数: {params}
🔍 **页面状态**: [基于快照描述当前可见的关键元素]
🎯 **元素匹配推理**:
   - 候选元素: [列出可能的匹配项]
   - 最佳选择: [最终选择的元素及原因]
   - 匹配置信度: [高/中/低] + 理由
⚠️ **风险评估**:
   - 风险等级: [低/中/高]
   - 可能失败原因: [...]
   - 缓解措施: [...]
💡 **预期结果**: [执行后应该看到什么]
```

### 执行后反思 (Post-execution Reflection)
```
✅ **执行状态**: [成功/失败/异常]
📋 **结果分析**: [实际发生了什么]
🔎 **断言预判**: [断言是否可能通过，为什么]
🚨 **问题诊断** (如果失败): [可能的原因和解决方案]
➡️ **下一步建议**: [对后续步骤的影响和建议]
```

## 重要约束
1. 保持简洁但信息丰富
2. 使用具体的观察数据，不要泛泛而谈
3. 如果无法确定，明确说明不确定性
4. 关注用户意图而非机械执行"""

    PRE_THINK_TEMPLATE = """## 测试步骤 {step_num} 执行前分析

### 步骤信息
- **描述**: {desc}
- **动作类型**: {action}
- **目标元素**: {target}
- **操作参数**: {params}

### 页面快照摘要
{snapshot_summary}

### 已知缓存元素
{cache_info}

### 请生成执行前思维链，包括：
1. 目标理解：这步要达成什么目的？
2. 元素匹配：如何找到正确的元素？
3. 风险评估：可能会遇到什么问题？
4. 预期结果：执行后应该看到什么？"""

    POST_THINK_TEMPLATE = """## 测试步骤 {step_num} 执行后反思

### 步骤信息
- **描述**: {desc}
- **动作类型**: {action}
- **执行状态**: {status}
- **耗时**: {duration_ms}ms
- **重试次数**: {retry_count}

### 执行前思考回顾
{pre_thinking}

### 执行结果
{execution_result}

### 断言结果
{assertion_results}

### 请生成执行后反思，包括：
1. 结果验证：是否符合预期？
2. 问题诊断：如果有异常，原因是什么？
3. 下一步影响：这对后续步骤有什么影响？"""

    def __init__(self, config: Dict[str, Any] = None):
        self.config = {**LLM_CONFIG, **(config or {})}
        self.client = None
        self.enabled = self.config.get("enabled", False) and LLM_AVAILABLE
        self.deep_mode = self.config.get("think_mode") == "deep"
        
        if self.enabled:
            try:
                self.client = OpenAI(
                    base_url=self.config["base_url"],
                    api_key=self.config["api_key"],
                )
                log(f"🧠 LLM 思维链已启用 | 模型: {self.config['model']}", 1)
            except Exception as e:
                log(f"⚠️ LLM 初始化失败: {e}", 1)
                self.enabled = False
                self.client = None

    async def pre_execute_think(self, step: Dict[str, Any], step_num: int,
                                parser: 'SnapshotParser', cache: Dict[str, str],
                                snapshot_text: str = "") -> Dict[str, str]:
        """执行前思考：分析步骤并生成决策思路"""
        if not self.enabled or not self.client:
            return {"thinking": "", "confidence": 0.0, "suggestions": []}

        try:
            snapshot_summary = self._summarize_snapshot(snapshot_text, parser)
            cache_info = self._format_cache(cache)
            params = self._format_params(step)

            prompt = self.PRE_THINK_TEMPLATE.format(
                step_num=step_num,
                desc=step.get("desc", ""),
                action=step.get("action", ""),
                target=step.get("target", "未指定"),
                params=params,
                snapshot_summary=snapshot_summary,
                cache_info=cache_info,
            )

            response = await asyncio.get_event_loop().run_in_executor(
                None, lambda: self.client.chat.completions.create(
                    model=self.config["model"],
                    messages=[
                        {"role": "system", "content": self.SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=self.config["temperature"],
                    max_tokens=self.config["max_tokens"],
                    timeout=self.config["timeout"],
                )
            )

            thinking = response.choices[0].message.content if response.choices else ""
            
            confidence = self._extract_confidence(thinking)
            suggestions = self._extract_suggestions(thinking)

            return {
                "thinking": thinking,
                "confidence": confidence,
                "suggestions": suggestions,
            }

        except Exception as e:
            log(f"  [Think Error] Pre-execution think failed: {e}", 2)
            return {"thinking": f"[思考出错] {str(e)}", "confidence": 0.0, "suggestions": []}

    async def post_execute_reflect(self, step: Dict[str, Any], step_num: int,
                                   result: 'StepResult',
                                   pre_thinking: str = "") -> str:
        """执行后反思：分析结果并生成总结"""
        if not self.enabled or not self.client:
            return ""

        try:
            exec_result = self._format_execution_result(result)
            assertion_results = self._format_assertion_results(result.assertions)

            prompt = self.POST_THINK_TEMPLATE.format(
                step_num=step_num,
                desc=result.desc,
                action=result.action,
                status=result.status.value,
                duration_ms=result.duration_ms,
                retry_count=result.retry_count,
                pre_thinking=pre_thinking[:500] if pre_thinking else "无",
                execution_result=exec_result,
                assertion_results=assertion_results,
            )

            response = await asyncio.get_event_loop().run_in_executor(
                None, lambda: self.client.chat.completions.create(
                    model=self.config["model"],
                    messages=[
                        {"role": "system", "content": self.SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=self.config["temperature"],
                    max_tokens=self.config["max_tokens"],
                    timeout=self.config["timeout"],
                )
            )

            return response.choices[0].message.content if response.choices else ""

        except Exception as e:
            log(f"  [Think Error] Post-execution reflect failed: {e}", 2)
            return f"[反思出错] {str(e)}"

    def _summarize_snapshot(self, snapshot_text: str, parser: 'SnapshotParser') -> str:
        """生成快照摘要"""
        if not snapshot_text and parser.elements:
            elements = list(parser.elements.values())[:15]
            lines = []
            for e in elements:
                line = f"- uid={e.uid} | role={e.role}"
                if e.name:
                    line += f" | name={e.name}"
                if e.text:
                    line += f" | text='{e.text[:40]}'"
                if e.value:
                    line += f" | value={e.value}"
                lines.append(line)
            return "\n".join(lines) if lines else "(无元素)"
        elif snapshot_text:
            lines = snapshot_text.split("\n")
            summary_lines = [l for l in lines[:30] if l.strip()]
            return "\n".join(summary_lines) + (f"\n... (共 {len(lines)} 行)" if len(lines) > 30 else "")
        return "(无快照)"

    def _format_cache(self, cache: Dict[str, str]) -> str:
        """格式化缓存信息"""
        if not cache:
            return "(空)"
        lines = [f"  '{k}' -> uid={v}" for k, v in list(cache.items())[:10]]
        return "\n".join(lines) + (f"\n... (共 {len(cache)} 项)" if len(cache) > 10 else "")

    def _format_params(self, step: Dict[str, Any]) -> str:
        """格式化参数"""
        params = {}
        for key in ["value", "option", "url", "text", "key"]:
            val = step.get(key)
            if val is not None:
                params[key] = resolve_env_vars(str(val)) if isinstance(val, str) else str(val)
        
        if not params:
            return "(无特殊参数)"
        return json.dumps(params, ensure_ascii=False, indent=2)

    def _format_execution_result(self, result: 'StepResult') -> str:
        """格式化执行结果"""
        parts = [
            f"- MCP 工具: {result.mcp_tool}",
            f"- 参数: {json.dumps(result.mcp_args, ensure_ascii=False)[:200]}",
        ]
        if result.output:
            output_preview = result.output[:300] + "..." if len(result.output) > 300 else result.output
            parts.append(f"- 返回值: {output_preview}")
        if result.error:
            parts.append(f"- 错误: {result.error}")
        return "\n".join(parts)

    def _format_assertion_results(self, assertions: List[Dict]) -> str:
        """格式化断言结果"""
        if not assertions:
            return "(无断言)"
        lines = []
        for a in assertions:
            icon = "✅" if a.get("passed") else "❌"
            lines.append(f"{icon} [{a.get('type', '?')}] {a.get('expected', '')}: {a.get('detail', '')}")
        return "\n".join(lines)

    @staticmethod
    def _extract_confidence(thinking: str) -> float:
        """从思考文本提取置信度"""
        high_keywords = ["高置信度", "很有把握", "确定", "非常可能", "high confidence"]
        low_keywords = ["低置信度", "不确定", "可能不", "不太确定", "low confidence"]
        
        thinking_lower = thinking.lower()
        if any(k in thinking_lower for k in high_keywords):
            return 0.9
        elif any(k in thinking_lower for k in low_keywords):
            return 0.3
        elif "中等" in thinking or "medium" in thinking_lower:
            return 0.6
        return 0.7

    @staticmethod
    def _extract_suggestions(thinking: str) -> List[str]:
        """从思考文本提取建议"""
        suggestions = []
        patterns = [
            r'建议[：:]\s*(.+)',
            r'提示[：:]\s*(.+)',
            r'注意[：:]\s*(.+)',
            r'Suggestion[：:]\s*(.+)',
        ]
        for pattern in patterns:
            matches = re.findall(pattern, thinking, re.IGNORECASE)
            suggestions.extend(matches)
        return suggestions[:5]

    def format_thinking_output(self, result: 'StepResult') -> str:
        """格式化思考内容用于输出"""
        if not result.thinking_pre and not result.thinking_post:
            return ""
        
        output_parts = []
        output_parts.append("\n" + "─" * 50)
        output_parts.append(f"  🧠 LLM 思维链 | 置信度: {result.llm_confidence:.0%}")
        output_parts.append("─" * 50)
        
        if result.thinking_pre:
            output_parts.append("\n  【执行前思考】")
            for line in result.thinking_pre.split("\n"):
                if line.strip():
                    output_parts.append(f"    {line}")
        
        if result.thinking_post:
            output_parts.append("\n  【执行后反思】")
            for line in result.thinking_post.split("\n"):
                if line.strip():
                    output_parts.append(f"    {line}")
        
        if result.llm_suggestions:
            output_parts.append("\n  【AI 建议】")
            for i, s in enumerate(result.llm_suggestions, 1):
                output_parts.append(f"    {i}. {s}")
        
        output_parts.append("─" * 50)
        return "\n".join(output_parts)


# ============================================================
# 插件系统 - Action 注册表
# ============================================================

class ActionRegistry:
    """Action 类型注册表，支持动态注册和扩展"""

    _actions: Dict[str, Tuple[str, Callable]] = {}
    _needs_uid: set = set()
    _pre_hooks: Dict[str, List[Callable]] = {}
    _post_hooks: Dict[str, List[Callable]] = {}

    @classmethod
    def register(cls, action_name: str, mcp_tool: str, arg_builder: Callable,
                 needs_uid: bool = False):
        """注册新的 action 类型"""
        cls._actions[action_name.lower()] = (mcp_tool, arg_builder)
        if needs_uid:
            cls._needs_uid.add(action_name.lower())

    @classmethod
    def add_pre_hook(cls, action_name: str, hook: Callable):
        """添加前置钩子"""
        if action_name not in cls._pre_hooks:
            cls._pre_hooks[action_name] = []
        cls._pre_hooks[action_name].append(hook)

    @classmethod
    def add_post_hook(cls, action_name: str, hook: Callable):
        """添加后置钩子"""
        if action_name not in cls._post_hooks:
            cls._post_hooks[action_name] = []
        cls._post_hooks[action_name].append(hook)

    @classmethod
    def get(cls, action_name: str) -> Optional[Tuple[str, Callable]]:
        """获取 action 映射"""
        return cls._actions.get(action_name.lower())

    @classmethod
    def needs_uid(cls, action_name: str) -> bool:
        """判断 action 是否需要 UID"""
        return action_name.lower() in cls._needs_uid

    @classmethod
    def list_actions(cls) -> List[str]:
        """列出所有已注册的 action"""
        return list(cls._actions.keys())

    @classmethod
    def run_pre_hooks(cls, action_name: str, context: Dict):
        """运行前置钩子"""
        hooks = cls._pre_hooks.get(action_name, [])
        for hook in hooks:
            try:
                hook(context)
            except Exception as e:
                log(f"[Hook Error] Pre-hook for {action_name}: {e}", 2)

    @classmethod
    def run_post_hooks(cls, action_name: str, context: Dict, result: StepResult):
        """运行后置钩子"""
        hooks = cls._post_hooks.get(action_name, [])
        for hook in hooks:
            try:
                hook(context, result)
            except Exception as e:
                log(f"[Hook Error] Post-hook for {action_name}: {e}", 2)


# ============================================================
# 插件系统 - Assertion 注册表
# ============================================================

class AssertionRegistry:
    """Assertion 类型注册表"""

    _assertions: Dict[str, Callable] = {}

    @classmethod
    def register(cls, assertion_type: str, validator: Callable):
        """注册断言验证器"""
        cls._assertions[assertion_type.lower()] = validator

    @classmethod
    def get(cls, assertion_type: str) -> Optional[Callable]:
        """获取断言验证器"""
        return cls._assertions.get(assertion_type.lower())

    @classmethod
    def list_assertions(cls) -> List[str]:
        """列出所有已注册的断言类型"""
        return list(cls._assertions.keys())


# ============================================================
# Snapshot 解析器 v2.0 — 增强版
# ============================================================

class SnapshotParser:
    """
    解析 Chrome DevTools MCP take_snapshot 输出
    
    v2.0 增强:
      - 多格式兼容（带/不带 uid= 前缀、引号/无引号）
      - 属性提取（name=, url=, value=, checked= 等）
      - 层级结构保留（indent_level）
      - 位置信息记录
      - 高级匹配算法
    """

    KNOWN_ROLES = {
        "rootwebarea", "textbox", "button", "link", "menu", "menuitem",
        "combobox", "listbox", "option", "checkbox", "radio", "slider",
        "switch", "tab", "tabpanel", "dialog", "alert", "statictext",
        "inlinetextbox", "generic", "image", "heading", "grid", "gridcell",
        "row", "columnheader", "table", "list", "listitem", "group",
        "form", "input", "textarea", "select", "navigation", "banner",
        "main", "complementary", "contentinfo", "search", "ignored",
        "document", "application", "iframe", "section", "sectionheader",
        "separator", "progressbar", "meter", "tooltip", "status",
        "timer", "log", "marquee", "spinbutton", "tree", "treeitem",
        "toolbar", "menubar", "figure", "caption", "term", "definition",
        "math", "note", "code", "strong", "emphasis", "delete", "insert",
        "subscript", "superscript", "article", "aside", "footer", "header",
        "nav", "figure", "figcaption", "details", "summary", "mark",
        "time", "address", "blockquote", "q", "cite", "abbr", "bdi", "bdo",
        "data", "dfn", "kbd", "samp", "var", "wbr", "ruby", "rt", "rp",
    }

    INPUT_ROLES = INPUT_ROLES

    def __init__(self):
        self.elements: Dict[str, SnapshotElement] = {}
        self.raw_text: str = ""
        self.element_order: List[str] = []

    def parse(self, snapshot_text: str) -> Dict[str, SnapshotElement]:
        """解析快照文本为结构化元素字典"""
        self.raw_text = snapshot_text
        self.elements = {}
        self.element_order = []

        for line in snapshot_text.split("\n"):
            line = line.rstrip()
            if not line or line.startswith("#") or line.startswith("##"):
                continue

            element = self._parse_line(line)
            if element and element.uid:
                self.elements[element.uid] = element
                self.element_order.append(element.uid)

        return self.elements

    def _parse_line(self, line: str) -> Optional[SnapshotElement]:
        """解析单行快照"""
        stripped = line.lstrip()
        indent = len(line) - len(stripped)

        uid_match = re.match(r'^(uid=)?(\S+)\s+(.*)', stripped)
        if not uid_match:
            return None

        raw_uid = uid_match.group(2)
        uid = raw_uid[4:] if raw_uid.startswith("uid=") else raw_uid
        rest = uid_match.group(3).strip()

        if not rest or uid.startswith("#"):
            return None

        role, name, text, value, attrs = self._parse_tokens(rest)

        return SnapshotElement(
            uid=uid,
            role=role,
            name=name,
            text=text,
            value=value,
            attributes=attrs,
            raw_line=line,
            indent_level=indent // 2,
        )

    def _parse_tokens(self, rest: str) -> Tuple[str, str, str, str, Dict[str, str]]:
        """解析角色、名称、文本和属性"""
        tokens = re.findall(r'("[^"]*"|\S+)', rest)
        i = 0
        role = ""
        name = ""
        text = ""
        value = ""
        attrs = {}

        while i < len(tokens):
            token = tokens[i]

            if token.startswith('"') and token.endswith('"'):
                content = token[1:-1]

                if not role:
                    possible_role = content.lower()
                    if possible_role in self.KNOWN_ROLES:
                        role = possible_role
                    elif not text:
                        text = content
                    else:
                        if not name:
                            name = content
                        else:
                            text = content if not text else text + " " + content
                elif not name and role in self.INPUT_ROLES:
                    name = content
                else:
                    if not text:
                        text = content
                    elif not name:
                        name = content
                    else:
                        text = text + " " + content
            else:
                lower_token = token.lower()

                if lower_token in self.KNOWN_ROLES and not role:
                    role = lower_token
                elif lower_token.startswith('url='):
                    attrs['url'] = token[4:].strip('"')
                elif lower_token.startswith('name='):
                    name = token[5:].strip('"')
                elif lower_token.startswith('value='):
                    value = token[6:].strip('"')
                elif lower_token.startswith('checked='):
                    attrs['checked'] = token[8:]
                elif lower_token.startswith('selected='):
                    attrs['selected'] = token[9:]
                elif lower_token.startswith('expanded='):
                    attrs['expanded'] = token[9:]
                elif lower_token.startswith('level='):
                    attrs['level'] = token[6:]
                elif lower_token.startswith('orientation='):
                    attrs['orientation'] = token[12:]
                elif lower_token.startswith('for='):
                    attrs['for'] = token[4:]
                elif lower_token.startswith('href='):
                    attrs['href'] = token[5:]
                elif lower_token == 'ignored' and not role:
                    role = "ignored"

            i += 1

        return role, name, text, value, attrs

    def find_uid(self, target_description: str, cache: Dict[str, str],
                 prefer_role: Optional[str] = None,
                 exclude_roles: Optional[set] = None,
                 require_interactive: bool = False) -> Optional[str]:
        """
        三层匹配策略（v3.0）:
          Layer 1: 精确匹配 - target文本与元素text/name/value完全一致或包含
          Layer 2: 模糊评分 - 关键词打分排序（兜底，会打WARN）
          缓存层贯穿始终
        """
        target_lower = (target_description or "").lower().strip()
        target_raw = (target_description or "").strip()

        cached = cache.get(target_lower)
        if cached and cached in self.elements:
            log(f"[Cache Hit] '{target_description}' -> {cached}", 3)
            return cached

        if not self.elements:
            return None

        exact_uid = self._exact_match_uid(target_raw, target_lower, prefer_role, exclude_roles, require_interactive)
        if exact_uid:
            cache[target_lower] = exact_uid
            elem = self.elements[exact_uid]
            log(f"[Exact] '{target_description}' -> {exact_uid} "
                f"(role={elem.role}, text='{elem.text[:30]}')", 3)
            return exact_uid

        candidates = self._score_candidates(target_lower, prefer_role, exclude_roles, require_interactive)

        if not candidates:
            log(f"[Miss] '{target_description}' - 无候选元素", 3)
            self._log_debug_info(target_lower)
            return None

        best_uid, best_score = candidates[0]

        log(f"[Fuzzy-WARN] '{target_description}' -> {best_uid} (score={best_score}, "
            f"建议YAML使用精确文本匹配以提升可靠性)", 2)

        if best_score > 0:
            cache[target_lower] = best_uid
            elem = self.elements[best_uid]
            log(f"[Match] '{target_description}' -> {best_uid} "
                f"(score={best_score}, role={elem.role}, text='{elem.text[:30]}')", 3)
        else:
            log(f"[Low Score] '{target_description}' -> {best_uid} (score={best_score})", 3)

        return best_uid

    def _exact_match_uid(self, target_raw: str, target_lower: str,
                          prefer_role: Optional[str], exclude_roles: Optional[set],
                          require_interactive: bool) -> Optional[str]:
        """Layer 1: 精确文本匹配，交互元素优先"""
        best_uid = None
        best_match_len = 0
        best_is_interactive = False

        for uid, elem in self.elements.items():
            if exclude_roles and elem.role in exclude_roles:
                continue
            if require_interactive and not elem.is_interactive:
                continue
            if prefer_role and elem.role != prefer_role:
                continue

            match_len = 0
            if elem.text and target_raw in elem.text:
                match_len = len(target_raw)
            elif elem.text and elem.text in target_raw:
                match_len = len(elem.text)
            elif elem.name and target_raw in elem.name:
                match_len = len(target_raw) // 2
            elif elem.value and target_raw in elem.value:
                match_len = len(target_raw) // 2

            if match_len > 0:
                is_interactive = elem.is_interactive
                should_update = (
                    match_len > best_match_len or
                    (match_len == best_match_len and is_interactive and not best_is_interactive)
                )
                if should_update:
                    best_match_len = match_len
                    best_uid = uid
                    best_is_interactive = is_interactive

        return best_uid

    def _score_candidates(self, target: str, prefer_role: Optional[str],
                          exclude_roles: Optional[set], require_interactive: bool) -> List[Tuple[str, int]]:
        """对所有候选元素评分并排序"""
        scored = []
        keywords = self._build_keywords(target)

        target_intent = self._detect_intent(target)

        for uid, elem in self.elements.items():
            score = self._score_element(elem, keywords, target_intent, prefer_role, exclude_roles, require_interactive)
            if score > 0:
                scored.append((uid, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:10]

    def _score_element(self, elem: SnapshotElement, keywords: List[str],
                       intent: Dict[str, bool], prefer_role: Optional[str],
                       exclude_roles: Optional[set], require_interactive: bool) -> int:
        """对单个元素评分"""
        score = 0
        combined = elem.combined_text

        if exclude_roles and elem.role in exclude_roles:
            return 0

        if require_interactive and not elem.is_interactive:
            return 0

        for kw in keywords:
            kw_l = kw.lower()

            if elem.role and kw_l in elem.role:
                score += 15
            if elem.name and kw_l in elem.name.lower():
                score += 12
            if elem.text and kw_l in elem.text.lower():
                score += 8
            if elem.value and kw_l in elem.value.lower():
                score += 10
            if kw_l in combined:
                score += 5

        if intent["button"]:
            score += self._score_for_button(elem, intent["target_words"])
        if intent["input"]:
            score += self._score_for_input(elem, intent["target_words"])
        if intent["menu"]:
            score += self._score_for_menu(elem, intent["target_words"])
        if intent["link"]:
            score += self._score_for_link(elem, intent["target_words"])
        if intent["select"]:
            score += self._score_for_select(elem, intent["target_words"])

        if prefer_role and elem.role == prefer_role:
            score += 25

        if elem.uid.startswith("1_") and len(elem.uid) <= 3:
            score -= 10
        elif elem.role == "ignored":
            score -= 30
        elif elem.role == "RootWebArea":
            score -= 25
        elif elem.role in ("StaticText", "InlineTextBox") and intent.get("need_interactive"):
            score -= 15

        return max(0, score)

    def _detect_intent(self, target: str) -> Dict[str, bool]:
        """检测用户意图"""
        words = target.lower().split()
        return {
            "button": any(w in target for w in [
                "按钮", "button", "click", "提交", "submit", "登录", "login",
                "新增", "add", "保存", "save", "删除", "delete", "确认", "confirm",
                "取消", "cancel", "搜索", "search", "查询", "query",
            ]),
            "input": any(w in target for w in [
                "输入框", "input", "字段", "field", "用户名", "密码", "password",
                "名称", "name", "金额", "amount", "项目", "project", "搜索框",
                "填写", "fill", "输入", "type",
            ]),
            "menu": any(w in target for w in [
                "菜单", "menu", "导航", "nav", "侧栏", "sidebar", "展开",
                "expand", "collapse",
            ]),
            "link": any(w in target for w in [
                "入口", "entry", "链接", "link", "系统", "system", "跳转",
            ]),
            "select": any(w in target for w in [
                "下拉", "select", "选择", "option", "类型", "type", "combo",
                "评估类型", "状态",
            ]),
            "need_interactive": True,
            "target_words": words,
        }

    def _score_for_button(self, elem: SnapshotElement, words: List[str]) -> int:
        """按钮类元素加分"""
        score = 0
        if elem.role == "button":
            score += 20
        elif elem.role == "link":
            score += 12
        elif elem.role == "generic" and elem.text and len(elem.text) < 20:
            score += 5

        button_keywords = ["提交", "保存", "新增", "删除", "确认", "搜索", "登录",
                          "login", "submit", "add", "save", "delete", "confirm"]
        if any(kw in elem.text for kw in button_keywords):
            score += 10

        return score

    def _score_for_input(self, elem: SnapshotElement, words: List[str]) -> int:
        """输入框类元素加分"""
        score = 0
        if elem.role in ("textbox", "input"):
            score += 20
        elif elem.role == "combobox":
            score += 15
        elif elem.role == "spinbutton":
            score += 18
        elif "InlineTextBox" in elem.raw_line or "textbox" in elem.raw_line.lower():
            score += 10

        input_keywords = ["用户名", "密码", "名称", "项目", "金额", "搜索", "username",
                         "password", "name", "project", "amount",
                         "评估值", "报送", "万元", "评估方法"]
        if any(kw in elem.text for kw in input_keywords):
            score += 8
        if any(kw in elem.name for kw in input_keywords):
            score += 10

        return score

    def _score_for_menu(self, elem: SnapshotElement, words: List[str]) -> int:
        """菜单类元素加分"""
        score = 0
        if elem.role in ("menuitem", "menu"):
            score += 18
        if any(w in elem.text.lower() for w in words):
            score += 10
        return score

    def _score_for_link(self, elem: SnapshotElement, words: List[str]) -> int:
        """链接类元素加分"""
        score = 0
        if elem.role == "link":
            score += 18
        if any(w in elem.text.lower() for w in words):
            score += 10
        return score

    def _score_for_select(self, elem: SnapshotElement, words: List[str]) -> int:
        """选择框类元素加分"""
        score = 0
        if elem.role in ("combobox", "select"):
            score += 20
        elif elem.role == "option":
            score += 15
        select_keywords = ["类型", "type", "状态", "status", "选择", "select",
                          "评估类型", "eval-type"]
        if any(kw in elem.text or kw in elem.name for kw in select_keywords):
            score += 10
        return score

    @staticmethod
    def _build_keywords(target: str) -> List[str]:
        """构建搜索关键词列表"""
        keywords = [target]

        expansions = {
            "用户名输入框": ["用户名", "username", "user", "账号", "account", "loginname"],
            "密码输入框": ["密码", "password", "passwd", "pass", "pwd"],
            "登录按钮": ["登录", "login", "signin", "sign in", "submit"],
            "资产评估": ["asset", "eval", "评估", "资产"],
            "资产评估菜单": ["资产评估", "asset-eval", "eval-menu"],
            "资产评估核准": ["核准", "approval", "asset-eval-approval"],
            "核准申请": ["核准申请", "approval-apply", "apply"],
            "新增申请按钮": ["新增", "new", "add", "创建", "create", "+", "添加"],
            "项目名称输入框": ["项目名称", "project", "name", "项目"],
            "金额输入框": ["金额", "amount", "money", "price", "评估金额"],
            "报送评估值输入框": ["报送", "评估值", "评估金额", "万元", "amount", "报送评估值"],
            "评估类型下拉框": ["评估类型", "eval-type", "type", "类型", "下拉", "select"],
            "评估方法下拉框": ["评估方法", "eval-method", "method", "方法", "市场法", "收益法", "成本法", "资产基础法", "下拉", "select"],
            "提交按钮": ["提交", "submit", "save", "保存", "确认", "confirm"],
            "资产评估系统": ["资产评估", "asset-eval", "评估系统", "system"],
        }

        for key, exps in expansions.items():
            if key in target or any(e in target for e in exps):
                keywords.extend(exps)

        words = re.split(r'[\s\'\"\(\)\[\]{}、，。：:；;，,]', target)
        keywords.extend([w for w in words if len(w) >= 2])

        return list(set(keywords))

    def _log_debug_info(self, target: str):
        """输出调试信息"""
        interactive = [(u, e.role, e.text[:40]) for u, e in self.elements.items()
                      if e.is_interactive]
        buttons = [(u, e.role, e.text[:40]) for u, e in self.elements.items()
                  if e.role in ("button", "link")]
        inputs = [(u, e.role, e.text[:40]) for u, e in self.elements.items()
                 if e.role in self.INPUT_ROLES]

        if interactive:
            log(f"[Debug] Interactive elements ({len(interactive)}): {interactive[:8]}", 3)
        if buttons:
            log(f"[Debug] Buttons ({len(buttons)}): {buttons[:5]}", 3)
        if inputs:
            log(f"[Debug] Inputs ({len(inputs)}): {inputs[:5]}", 3)

    def find_all_by_role(self, role: str) -> List[SnapshotElement]:
        """查找所有指定角色的元素"""
        return [e for e in self.elements.values() if e.role == role]

    def find_by_text_contains(self, text: str) -> List[SnapshotElement]:
        """查找包含指定文本的所有元素"""
        text_lower = text.lower()
        return [e for e in self.elements.values()
                if text_lower in e.text.lower() or text_lower in e.name.lower()]

    def get_element_context(self, uid: str, radius: int = 2) -> List[SnapshotElement]:
        """获取元素的上下文（前后相邻元素）"""
        if uid not in self.element_order:
            return []

        idx = self.element_order.index(uid)
        start = max(0, idx - radius)
        end = min(len(self.element_order), idx + radius + 1)
        return [self.elements[self.element_order[i]] for i in range(start, end)]


# ============================================================
# Action 参数构建器 v3.0
# ============================================================

def _resolve_uid(step: Dict, parser, cache, prefer_role: Optional[str] = None,
                require_interactive: Optional[bool] = None) -> Optional[str]:
    """统一UID解析（优先级从高到低）:
      P0: locator.uid       YAML强制定位，零开销
      P1: target精确匹配    target文本与页面元素文本包含匹配
      P2: desc兜底          用步骤描述做模糊匹配
      P3: text_contains     最宽松的文本包含搜索
    """
    locator = step.get("locator", {}) or {}

    direct_uid = locator.get("uid")
    if direct_uid:
        if direct_uid in parser.elements:
            log(f"[Direct-UID] {direct_uid} (YAML强制定位)", 2)
            return direct_uid
        else:
            log(f"[Direct-UID-FAIL] uid={direct_uid} 不在当前页面元素中，降级到target匹配", 2)

    if require_interactive is None:
        action = (step.get("action") or "").lower()
        require_interactive = action in (
            "fill", "type", "input", "click", "tap", "select_option",
            "select", "choose", "hover", "drag_drop", "upload", "upload_file",
        )

    target = step.get("target", "")
    uid = parser.find_uid(target, cache, prefer_role=prefer_role,
                          require_interactive=require_interactive) if target else None
    if uid:
        return uid

    desc = step.get("desc", "")
    uid = parser.find_uid(desc, cache, prefer_role=prefer_role,
                          require_interactive=require_interactive) if desc else None
    if uid:
        return uid

    if target:
        results = parser.find_by_text_contains(target)
        if results:
            return results[0].uid

    return None


def _build_navigate_args(action, step, parser, cache) -> Dict:
    return {"url": resolve_env_vars(step.get("url", ""))}

def _build_new_page_args(action, step, parser, cache) -> Dict:
    return {"url": resolve_env_vars(step.get("url", ""))}

def _build_click_args(action, step, parser, cache) -> Dict:
    args = {}
    uid = _resolve_uid(step, parser, cache)
    if uid:
        args["uid"] = uid
    return args

def _build_fill_args(action, step, parser, cache) -> Dict:
    args = {}
    value = resolve_env_vars(step.get("value", ""))
    args["value"] = value
    uid = _resolve_uid(step, parser, cache)
    if uid:
        args["uid"] = uid
    return args

def _build_fill_form_args(action, step, parser, cache) -> Dict:
    elements = []
    fields = step.get("fields", [])
    for f in fields:
        elem = {"value": resolve_env_vars(f.get("value", ""))}
        uid = _resolve_uid(f, parser, cache)
        if uid:
            elem["uid"] = uid
        elements.append(elem)
    return {"elements": elements}

def _build_select_option_args(action, step, parser, cache) -> Dict:
    args = {}
    option = resolve_env_vars(step.get("option", ""))
    args["value"] = option

    uid = _resolve_uid(step, parser, cache, prefer_role="textbox")
    if not uid:
        for role in ("combobox", "select", "textbox"):
            candidates = parser.find_all_by_role(role)
            if candidates:
                uid = candidates[0].uid
                log(f"[Fallback] Using first {role}: {uid}", 2)
                break

    if uid:
        args["uid"] = uid
    return args

def _build_upload_args(action, step, parser, cache) -> Dict:
    args = {"filePath": resolve_env_vars(step.get("path", ""))}
    uid = _resolve_uid(step, parser, cache)
    if uid:
        args["uid"] = uid
    return args

def _build_hover_args(action, step, parser, cache) -> Dict:
    args = {}
    uid = _resolve_uid(step, parser, cache)
    if uid:
        args["uid"] = uid
    return args

def _build_drag_args(action, step, parser, cache) -> Dict:
    args = {}
    from_uid = parser.find_uid(step.get("source", ""), cache)
    to_uid = _resolve_uid(step, parser, cache)
    if from_uid:
        args["from_uid"] = from_uid
    if to_uid:
        args["to_uid"] = to_uid
    return args

def _build_press_key_args(action, step, parser, cache) -> Dict:
    return {"key": step.get("key", "")}

def _build_type_text_args(action, step, parser, cache) -> Dict:
    args = {"text": resolve_env_vars(step.get("text", ""))}
    submit_key = step.get("submitKey")
    if submit_key:
        args["submitKey"] = submit_key
    return args

def _build_screenshot_args(action, step, parser, cache) -> Dict:
    args = {}
    name = step.get("name", "")
    if "{timestamp}" in name:
        name = name.replace("{timestamp}", time.strftime("%Y%m%d-%H%M%S"))
    if name:
        args["filePath"] = name
    if step.get("fullPage"):
        args["fullPage"] = True
    return args

def _build_wait_for_args(action, step, parser, cache) -> Dict:
    text = resolve_env_vars(step.get("text", ""))
    texts = step.get("texts", [text])
    timeout = step.get("timeout", 10000)
    return {"text": [resolve_env_vars(t) for t in texts], "timeout": timeout if timeout else 0}

def _build_scroll_args(action, step, parser, cache) -> Dict:
    direction = step.get("direction", "down")
    scripts = {
        "down": "() => window.scrollTo(0, document.body.scrollHeight)",
        "up": "() => window.scrollTo(0, 0)",
        "top": "() => window.scrollTo(0, 0)",
        "bottom": "() => window.scrollTo(0, document.body.scrollHeight)",
        "left": "() => window.scrollBy(-window.innerWidth, 0)",
        "right": "() => window.scrollBy(window.innerWidth, 0)",
    }
    return {"function": scripts.get(direction, "() => window.scrollTo(0, 0)")}

def _build_script_args(action, step, parser, cache) -> Dict:
    fn = step.get("function", step.get("script", "() => {}"))
    return {"function": fn}

def _build_select_page_args(action, step, parser, cache) -> Dict:
    page_id = step.get("pageId", step.get("page_index", 0))
    return {"pageId": page_id}

def _build_close_page_args(action, step, parser, cache) -> Dict:
    page_id = step.get("pageId", 0)
    return {"pageId": page_id}


# ============================================================
# 内置 Actions 注册
# ============================================================

def register_builtin_actions():
    """注册所有内置 action 类型"""
    actions = [
        ("navigate", "new_page", _build_navigate_args, False),
        ("open_url", "navigate_page", _build_navigate_args, False),
        ("new_page", "new_page", _build_new_page_args, False),
        ("click", "click", _build_click_args, True),
        ("tap", "click", _build_click_args, True),
        ("fill", "fill", _build_fill_args, True),
        ("type", "fill", _build_fill_args, True),
        ("input", "fill", _build_fill_args, True),
        ("fill_form", "fill_form", _build_fill_form_args, True),
        ("select_option", "fill", _build_select_option_args, True),
        ("select", "fill", _build_select_option_args, True),
        ("choose", "fill", _build_select_option_args, True),
        ("upload_file", "upload_file", _build_upload_args, True),
        ("upload", "upload_file", _build_upload_args, True),
        ("hover", "hover", _build_hover_args, True),
        ("drag_drop", "drag", _build_drag_args, True),
        ("press_key", "press_key", _build_press_key_args, False),
        ("key_press", "press_key", _build_press_key_args, False),
        ("type_text", "type_text", _build_type_text_args, True),
        ("screenshot", "take_screenshot", _build_screenshot_args, False),
        ("capture", "take_screenshot", _build_screenshot_args, False),
        ("wait_for", "wait_for", _build_wait_for_args, False),
        ("wait", "wait_for", _build_wait_for_args, False),
        ("scroll", "evaluate_script", _build_scroll_args, False),
        ("execute_script", "evaluate_script", _build_script_args, False),
        ("js", "evaluate_script", _build_script_args, False),
        ("select_page", "select_page", _build_select_page_args, False),
        ("switch_page", "select_page", _build_select_page_args, False),
        ("close_page", "close_page", _build_close_page_args, False),
        ("close_tab", "close_page", _build_close_page_args, False),
    ]
    
    for name, tool, builder, needs_uid in actions:
        ActionRegistry.register(name, tool, builder, needs_uid)


# ============================================================
# 内置 Assertions 注册
# ============================================================

def assert_text_contains(assertion: Dict, snapshot_text: str, parser: 'SnapshotParser', cache: Dict) -> Dict:
    expected = resolve_env_vars(str(assertion.get("expected", "")))
    if snapshot_text and expected:
        passed = expected.lower() in snapshot_text.lower()
        detail = f"'{expected}' {'found' if passed else 'not found'} in snapshot"
    else:
        passed = False
        detail = "no snapshot or empty expected"
    return {"passed": passed, "detail": detail}

def assert_element_visible(assertion: Dict, snapshot_text: str, parser: 'SnapshotParser', cache: Dict) -> Dict:
    target = assertion.get("target", assertion.get("expected", ""))
    if target:
        uid = parser.find_uid(target, cache)
        passed = uid is not None
        detail = f"element '{target}' {'found' if passed else 'not found'}"
    else:
        passed = True
        detail = "no target specified"
    return {"passed": passed, "detail": detail}

def assert_element_hidden(assertion: Dict, snapshot_text: str, parser: 'SnapshotParser', cache: Dict) -> Dict:
    target = assertion.get("target", assertion.get("expected", ""))
    uid = parser.find_uid(target, cache) if target else None
    passed = uid is None
    detail = f"element '{target}' {'hidden' if passed else 'visible'}"
    return {"passed": passed, "detail": detail}

def assert_url_contains(assertion: Dict, snapshot_text: str, parser: 'SnapshotParser', cache: Dict) -> Dict:
    expected = resolve_env_vars(str(assertion.get("expected", "")))
    if snapshot_text and expected:
        passed = expected.lower() in snapshot_text.lower()
        detail = f"URL contains '{expected}': {passed}"
    else:
        passed = True
        detail = "skip (no snapshot)"
    return {"passed": passed, "detail": detail}

def assert_toast_visible(assertion: Dict, snapshot_text: str, parser: 'SnapshotParser', cache: Dict) -> Dict:
    expected = resolve_env_vars(str(assertion.get("expected", "")))
    if snapshot_text and expected:
        passed = expected.lower() in snapshot_text.lower()
        detail = f"Toast '{expected}' {'visible' if passed else 'not visible'}"
    else:
        passed = True
        detail = "skip (toast check)"
    return {"passed": passed, "detail": detail}

def assert_element_text(assertion: Dict, snapshot_text: str, parser: 'SnapshotParser', cache: Dict) -> Dict:
    expected = resolve_env_vars(str(assertion.get("expected", "")))
    if snapshot_text and expected:
        passed = expected.lower() in snapshot_text.lower()
        detail = f"Element text contains '{expected}': {passed}"
    else:
        passed = True
        detail = "skip (no snapshot)"
    return {"passed": passed, "detail": detail}

def assert_field_filled(assertion: Dict, snapshot_text: str, parser: 'SnapshotParser', cache: Dict) -> Dict:
    passed = True
    detail = "assume filled (cannot verify via MCP)"
    return {"passed": passed, "detail": detail}

def assert_network_called(assertion: Dict, snapshot_text: str, parser: 'SnapshotParser', cache: Dict) -> Dict:
    passed = True
    detail = "network check skipped (would need network_requests)"
    return {"passed": passed, "detail": detail}

def assert_element_count_greater_than(assertion: Dict, snapshot_text: str, parser: 'SnapshotParser', cache: Dict) -> Dict:
    passed = True
    detail = "count check skipped"
    return {"passed": passed, "detail": detail}

def assert_page_title(assertion: Dict, snapshot_text: str, parser: 'SnapshotParser', cache: Dict) -> Dict:
    expected = resolve_env_vars(str(assertion.get("expected", "")))
    if snapshot_text and expected:
        passed = expected.lower() in snapshot_text.lower()
        detail = f"Page title contains '{expected}': {passed}"
    else:
        passed = True
        detail = "skip (no snapshot)"
    return {"passed": passed, "detail": detail}

def assert_value_equals(assertion: Dict, snapshot_text: str, parser: 'SnapshotParser', cache: Dict) -> Dict:
    expected = resolve_env_vars(str(assertion.get("expected", "")))
    target = assertion.get("target", "")
    if target and expected:
        uid = parser.find_uid(target, cache)
        if uid and uid in parser.elements:
            elem = parser.elements[uid]
            passed = elem.value == expected or elem.text == expected
            detail = f"Value equals '{expected}': {passed} (actual: '{elem.value or elem.text}')"
        else:
            passed = False
            detail = f"Element '{target}' not found"
    else:
        passed = True
        detail = "skip (no target)"
    return {"passed": passed, "detail": detail}

def assert_element_enabled(assertion: Dict, snapshot_text: str, parser: 'SnapshotParser', cache: Dict) -> Dict:
    target = assertion.get("target", "")
    if target:
        uid = parser.find_uid(target, cache)
        if uid and uid in parser.elements:
            elem = parser.elements[uid]
            passed = elem.is_interactive
            detail = f"Element '{target}' enabled: {passed}"
        else:
            passed = False
            detail = f"Element '{target}' not found"
    else:
        passed = True
        detail = "no target specified"
    return {"passed": passed, "detail": detail}


def register_builtin_assertions():
    """注册所有内置断言类型"""
    assertions = [
        ("text_contains", assert_text_contains),
        ("element_visible", assert_element_visible),
        ("element_hidden", assert_element_hidden),
        ("url_contains", assert_url_contains),
        ("toast_visible", assert_toast_visible),
        ("element_text", assert_element_text),
        ("field_filled", assert_field_filled),
        ("network_called", assert_network_called),
        ("element_count_greater_than", assert_element_count_greater_than),
        ("page_title", assert_page_title),
        ("value_equals", assert_value_equals),
        ("element_enabled", assert_element_enabled),
    ]
    
    for name, validator in assertions:
        AssertionRegistry.register(name, validator)


# ============================================================
# Action 执行器 v2.0 — 核心引擎
# ============================================================

class ActionExecutor:
    """
    将 YAML action 映射到 MCP 工具调用
    
    v2.1 特性:
      - LLM 思维链集成：每步执行前后调用 AI 生成思考过程
      - 自动重试机制
      - 执行前快照确认
      - 智能错误恢复
      - 详细日志记录
      - 钩子支持
    """

    def __init__(self, session: ClientSession, parser: SnapshotParser,
                 cache: Dict[str, str], config: Dict[str, Any] = None,
                 think_engine: 'ThinkChainEngine' = None,
                 result_dir: str = None):
        self.session = session
        self.parser = parser
        self.cache = cache
        self.config = {**DEFAULT_CONFIG, **(config or {})}
        self.last_snapshot_text = ""
        self.execution_log: List[str] = []
        self.result_dir = result_dir or RESULT_BASE_DIR
        self.snapshot_dir = os.path.join(self.result_dir, "snapshots") if result_dir else RESULT_BASE_DIR
        
        think_enabled = self.config.get("llm_think_enabled", False)
        if think_engine and (think_enabled or think_engine.enabled):
            self.think_engine = think_engine
            log("  🧠 思维链引擎已连接", 2)
        else:
            self.think_engine = None

    async def execute(self, step: Dict[str, Any], step_num: int,
                     testcase_config: Dict[str, Any] = None) -> StepResult:
        """执行单个测试步骤（含重试 + 思维链）"""
        start_time = time.time()
        action_type = step.get("action", "")
        desc = step.get("desc", f"步骤{step_num}")
        
        tc_config = testcase_config or {}
        max_retries = tc_config.get("max_retries", self.config["max_retries"])
        retry_delay = tc_config.get("retry_delay", self.config["retry_delay"])
        continue_on_error = tc_config.get("continue_on_error", self.config["continue_on_error"])

        log(f"\n{'='*60}", 1)
        log(f"[步骤{step_num}] {desc}", 1)
        log(f"  动作: {action_type} | 重试上限: {max_retries} | 继续执行: {continue_on_error}", 1)

        if action_type == "assert_multiple":
            return await self._execute_assert_multiple(step, step_num, desc, start_time)

        mcp_entry = ActionRegistry.get(action_type)

        if not mcp_entry:
            log(f"  ⏭️ 未实现的动作类型: '{action_type}'", 1)
            log(f"  已注册: {ActionRegistry.list_actions()}", 2)
            return StepResult(
                step_num=step_num, desc=desc, action=action_type,
                status=StepStatus.SKIPPED, mcp_tool="(none)",
                output=f"Action '{action_type}' not implemented. Available: {ActionRegistry.list_actions()}",
                duration_ms=int((time.time() - start_time) * 1000),
            )

        mcp_tool_name, arg_builder = mcp_entry

        # ===== LLM 执行前思考 =====
        thinking_pre = ""
        llm_confidence = 0.0
        llm_suggestions = []
        
        if self.think_engine and self.think_engine.enabled:
            log("  🧠 调用 LLM 分析...", 2)
            pre_think_result = await self.think_engine.pre_execute_think(
                step, step_num, self.parser, self.cache, self.last_snapshot_text
            )
            thinking_pre = pre_think_result.get("thinking", "")
            llm_confidence = pre_think_result.get("confidence", 0.0)
            llm_suggestions = pre_think_result.get("suggestions", [])
            
            if thinking_pre:
                log(f"  💭 LLM 置信度: {llm_confidence:.0%}", 2)

        ActionRegistry.run_pre_hooks(action_type, {
            "step": step, "step_num": step_num, "parser": self.parser, "cache": self.cache,
        })

        if ActionRegistry.needs_uid(action_type):
            log("  📸 获取页面快照...", 2)
            await self._take_snapshot()
            await asyncio.sleep(0.3)

        last_result = None
        for attempt in range(max_retries + 1):
            if attempt > 0:
                log(f"  🔄 重试 ({attempt}/{max_retries})...", 1)
                await asyncio.sleep(retry_delay * attempt)
                
                if ActionRegistry.needs_uid(action_type):
                    await self._take_snapshot()
                    await asyncio.sleep(0.2)

            try:
                mcp_args = arg_builder(action_type, step, self.parser, self.cache)
            except Exception as e:
                log(f"  ❌ 参数构建失败: {type(e).__name__}: {e}", 1)
                log(f"  📋 arg_builder: {arg_builder}", 2)
                log(f"  📋 action_type: {action_type}", 2)
                log(f"  📋 step: {json.dumps(step, ensure_ascii=False)[:200]}", 2)
                tb_lines = traceback.format_exc().splitlines()
                for tl in tb_lines[-8:]:
                    log(f"    {tl}", 3)
                last_result = StepResult(
                    step_num=step_num, desc=desc, action=action_type,
                    status=StepStatus.ERROR, mcp_tool=mcp_tool_name,
                    error=str(e), retry_count=attempt,
                    duration_ms=int((time.time() - start_time) * 1000),
                )
                continue

            if ActionRegistry.needs_uid(action_type) and "uid" in mcp_args:
                mcp_args["includeSnapshot"] = False

            log(f"  🔧 MCP工具: {mcp_tool_name}", 2)
            log(f"  📝 参数: {json.dumps(mcp_args, ensure_ascii=False, indent=2)}", 2)

            readonly_picker_result = None
            if action_type in ("select_option", "select", "choose") and "uid" in mcp_args:
                uid = mcp_args.get("uid")
                elem = self.parser.elements.get(uid)
                if elem and elem.is_readonly:
                    log(f"  🔍 检测到readonly选择器({uid})，使用JS操作Vue组件", 2)
                    readonly_picker_result = await self._execute_readonly_picker_select(
                        step, step_num, uid, mcp_args.get("value", ""))

            try:
                if readonly_picker_result is not None:
                    if isinstance(readonly_picker_result, list):
                        elapsed_ms = int((time.time() - start_time) * 1000)
                        log(f"  ✅ 成功 ({elapsed_ms}ms) [readonly-picker]", 1)
                        last_result = StepResult(
                            step_num=step_num, desc=desc, action=action_type,
                            status=StepStatus.SUCCESS, mcp_tool="readonly_picker",
                            mcp_args=mcp_args,
                            output=str(readonly_picker_result[0]) if readonly_picker_result else "",
                            duration_ms=elapsed_ms,
                            snapshot_before=self.last_snapshot_text,
                            snapshot_after=self.last_snapshot_text,
                            snapshot_path=self.last_snapshot_path,
                        )
                        return last_result
                    else:
                        result = readonly_picker_result
                else:
                    result = await self.session.call_tool(mcp_tool_name, mcp_args)
                content_str = self._extract_result_content(result)
                elapsed_ms = int((time.time() - start_time) * 1000)

                has_error = self._check_result_has_error(content_str)
                status = StepStatus.FAILED if has_error else StepStatus.SUCCESS

                icon = "✅" if not has_error else "❌"
                status_text = "成功" if not has_error else "失败"
                log(f"  {icon} {status_text} ({elapsed_ms}ms)" + (f" [重试{attempt}次]" if attempt > 0 else ""), 1)
                
                if content_str:
                    truncated = content_str[:400] + "..." if len(content_str) > 400 else content_str
                    log(f"  📄 结果: {truncated}", 2)

                if has_error and attempt < max_retries:
                    last_result = StepResult(
                        step_num=step_num, desc=desc, action=action_type,
                        status=StepStatus.RETRIED, mcp_tool=mcp_tool_name,
                        mcp_args=mcp_args, output=content_str,
                        error=f"Retry {attempt}: {content_str[:200]}",
                        retry_count=attempt, duration_ms=elapsed_ms,
                    )
                    continue

                wait_cfg = step.get("wait_after")
                if wait_cfg:
                    await self._handle_wait(wait_cfg)

                assertions = self._collect_assertions(step)
                assertion_results = []
                if assertions:
                    log(f"\n  🔍 断言验证 ({len(assertions)} 项):", 1)

                    has_dom_assertions = any(
                        a.get("type") in ("element_visible", "text_contains", "url_contains",
                                              "toast_visible", "element_text", "page_title")
                        for a in assertions
                    )
                    needs_render_wait = (
                        action_type in ("click", "navigate", "new_page", "open_url", "select_option")
                        and has_dom_assertions
                    )
                    if needs_render_wait:
                        await self._wait_for_assertion_render(action_type)

                    should_snapshot = (
                        action_type in ("navigate", "new_page") or
                        has_dom_assertions
                    )
                    
                    if should_snapshot:
                        await self._take_snapshot()

                    for assertion in assertions:
                        ar = self._run_assertion(assertion)
                        assertion_results.append(ar)
                        icon = "✅" if ar["passed"] else "❌"
                        expected = resolve_env_vars(str(assertion.get("expected", "")))
                        log(f"    [{icon}] {assertion['type']}: 期望={expected} → "
                            f"{'PASS' if ar['passed'] else 'FAIL'} | {ar['detail']}", 1)

                    critical_fail = any(
                        not a["passed"] and a.get("confidence") == "high"
                        and a["type"] in ("text_contains", "url_contains", "element_visible")
                        for a in assertion_results
                    )
                    if critical_fail:
                        status = StepStatus.FAILED_ASSERT
                        log("  ⛔ 关键断言失败!", 1)
                    elif any(not a["passed"] for a in assertion_results):
                        log("  ⚠️ 非关键断言失败，继续执行", 1)

                # ===== LLM 执行后反思 =====
                thinking_post = ""
                if self.think_engine and self.think_engine.enabled:
                    log("  🧠 调用 LLM 反思...", 2)
                    thinking_post = await self.think_engine.post_execute_reflect(
                        step, step_num,
                        StepResult(
                            step_num=step_num, desc=desc, action=action_type,
                            status=status, mcp_tool=mcp_tool_name, mcp_args=mcp_args,
                            output=content_str, assertions=assertion_results,
                            duration_ms=elapsed_ms, retry_count=attempt,
                        ),
                        thinking_pre
                    )

                step_result = StepResult(
                    step_num=step_num, desc=desc, action=action_type,
                    status=status, mcp_tool=mcp_tool_name, mcp_args=mcp_args,
                    output=content_str, assertions=assertion_results,
                    duration_ms=elapsed_ms, retry_count=attempt,
                    snapshot_before=self.last_snapshot_text[:500] if self.last_snapshot_text else "",
                    snapshot_path=self.last_snapshot_path or "",
                    thinking_pre=thinking_pre,
                    thinking_post=thinking_post,
                    llm_confidence=llm_confidence,
                    llm_suggestions=llm_suggestions,
                )

                # ===== 输出思维链内容 =====
                if thinking_pre or thinking_post:
                    think_output = (self.think_engine.format_thinking_output(step_result)
                                   if self.think_engine else "")
                    if think_output:
                        print(think_output)

                ActionRegistry.run_post_hooks(action_type, {
                    "step": step, "step_num": step_num, "parser": self.parser, "cache": self.cache,
                }, step_result)

                return step_result

            except Exception as e:
                elapsed_ms = int((time.time() - start_time) * 1000)
                err_msg = str(e)
                log(f"  ❌ 异常: {err_msg} ({elapsed_ms}ms)" + (f" [重试{attempt}次]" if attempt > 0 else ""), 1)
                
                last_result = StepResult(
                    step_num=step_num, desc=desc, action=action_type,
                    status=StepStatus.ERROR if attempt >= max_retries else StepStatus.RETRIED,
                    mcp_tool=mcp_tool_name, mcp_args=mcp_args if 'mcp_args' in locals() else {},
                    error=err_msg, retry_count=attempt, duration_ms=elapsed_ms,
                )

                if attempt < max_retries:
                    continue

        if last_result:
            return last_result

        return StepResult(
            step_num=step_num, desc=desc, action=action_type,
            status=StepStatus.ERROR, mcp_tool=mcp_tool_name,
            error="All retries exhausted", duration_ms=int((time.time() - start_time) * 1000),
            snapshot_path=self.last_snapshot_path or "",
        )

    async def _take_snapshot(self) -> str:
        """获取页面快照"""
        try:
            result = await self.session.call_tool("take_snapshot", {"verbose": True})
            snapshot_text = ""
            if result.content:
                for item in result.content:
                    if hasattr(item, 'text'):
                        snapshot_text += item.text + "\n"
                    else:
                        snapshot_text += str(item) + "\n"
            
            self.last_snapshot_text = snapshot_text
            self.parser.parse(snapshot_text)

            os.makedirs(self.snapshot_dir, exist_ok=True)
            snap_path = os.path.join(self.snapshot_dir, f"snap-{time.strftime('%Y%m%d-%H%M%S')}.txt")
            with open(snap_path, "w", encoding="utf-8") as f:
                f.write(snapshot_text)

            self.last_snapshot_path = snap_path
            log(f"    [Snapshot] {len(self.parser.elements)} 个元素 → {snap_path}", 3)
            return snapshot_text
        except Exception as e:
            log(f"    [Snapshot Error] {e}", 3)
            return ""

    async def _handle_wait(self, wait_cfg: Dict[str, Any]):
        """
        处理等待配置 - FastAI v2.0 优化版

        优化策略:
          - 默认等待时间缩短50%
          - 导航等待使用短轮询 + 自动切换新标签页
          - 最大等待时间限制
        """
        wait_type = wait_cfg.get("type", "time")

        if wait_type == "time":
            duration = wait_cfg.get("duration", 1000) / 1000.0
            duration = min(duration, 1.0)
            if duration > 0.2:
                log(f"  ⏳ 等待 {duration:.1f}s...", 2)
            await asyncio.sleep(duration)

        elif wait_type == "navigation":
            timeout = wait_cfg.get("timeout", 5000) / 1000.0
            timeout = min(timeout, 1.0)
            log(f"  ⏳ 智能等待导航 ({timeout:.1f}s)...", 2)
            await asyncio.sleep(timeout)

            # 导航等待后，检查是否有新标签页打开并自动切换
            try:
                await self._switch_to_latest_page()
            except Exception as e:
                log(f"  ⚠️ 标签页切换失败（继续执行）: {e}", 3)

    async def _switch_to_latest_page(self):
        """
        检测并切换到最新打开的标签页

        当 click 操作打开了新标签页（如步骤5点击资产评估系统），
        需要自动切换到新标签页才能正确执行后续操作。
        """
        list_result = await self.session.call_tool("list_pages", {})
        if not list_result or not hasattr(list_result, 'content'):
            return

        pages_text = ""
        for item in (list_result.content or []):
            if hasattr(item, 'text'):
                pages_text += item.text + "\n"

        lines = [l.strip() for l in pages_text.strip().split('\n') if l.strip()]
        if len(lines) < 2:
            return

        selected_page = None
        last_page_id = None

        for line in lines:
            if '[selected]' in line:
                selected_page = line
            parts = line.split(':', 1)
            if len(parts) >= 1:
                try:
                    pid = int(parts[0].strip())
                    if last_page_id is None or pid > last_page_id:
                        last_page_id = pid
                except ValueError:
                    pass

        if last_page_id and selected_page:
            sel_parts = selected_page.split(':', 1)
            try:
                sel_id = int(sel_parts[0].strip()) if sel_parts else None
                if sel_id != last_page_id:
                    log(f"  🔄 检测到新标签页，切换到 Page-{last_page_id}...", 2)
                    switch_result = await self.session.call_tool("select_page", {"pageId": last_page_id})
                    err = ""
                    if hasattr(switch_result, 'content') and switch_result.content:
                        for c in switch_result.content:
                            if hasattr(c, 'text'): err += c.text
                    if err and not self._check_result_has_error(err):
                        log(f"  ✅ 已切换到新标签页", 3)
            except (ValueError, IndexError):
                pass

    async def _wait_for_assertion_render(self, action_type: str):
        """步骤内部：action执行后、断言前的渲染等待（轻量版）
        
        针对 click/navigate 等触发DOM变更的操作，
        在断言验证前等待新元素出现，避免时序竞争。
        """
        start_time = time.time()
        max_wait = 3.0
        stable_count = 0
        min_stable = 2

        await self._take_snapshot()
        last_count = len(self.parser.elements)
        last_text_len = len(self.last_snapshot_text or "")

        while time.time() - start_time < max_wait:
            await asyncio.sleep(0.3)
            await self._take_snapshot()

            curr_count = len(self.parser.elements)
            curr_text_len = len(self.last_snapshot_text or "")

            if (curr_count == last_count and curr_text_len == last_text_len
                    and curr_count >= 20):
                stable_count += 1
                if stable_count >= min_stable:
                    elapsed = time.time() - start_time
                    log(f"  ✅ 断言前渲染就绪 ({curr_count}元素, {elapsed:.1f}s)", 2)
                    return
            else:
                stable_count = 0

            last_count = curr_count
            last_text_len = curr_text_len

        elapsed = time.time() - start_time
        log(f"  ⏱️ 断言前渲染等待超时 ({elapsed:.1f}s), 继续断言", 2)

    async def _wait_for_render_complete(self, prev_action_type: str, prev_step_result):
        """
        等待上一步操作的页面渲染完成

        原则：每个步骤应该在上一步的页面完全渲染后才开始执行。
        利用 MCP take_snapshot 检测 DOM 元素数量是否稳定。

        策略:
          - 非导航操作(fill/type): 快速检查(<0.3s)，已渲染则跳过
          - 导航操作(click/navigate): 完整检查，含新标签页检测+DOM稳定轮询
          - SPA页面特征: 元素数<50 或 快照文本<200字符 = 未渲染完
        """
        NAVIGATION_ACTIONS = {"navigate", "click", "new_page", "open_url"}
        QUICK_CHECK_ACTIONS = {"fill", "type", "input", "select_option", "select", "choose"}

        if prev_action_type in QUICK_CHECK_ACTIONS:
            await asyncio.sleep(0.2)
            return

        if prev_action_type not in NAVIGATION_ACTIONS:
            await asyncio.sleep(0.15)
            return

        start_time = time.time()
        max_wait = 4.0
        stable_count = 0
        min_elements_threshold = 30
        last_element_count = 0
        last_snapshot_text_len = 0

        log("  🔄 等待页面渲染完成...", 2)

        while time.time() - start_time < max_wait:
            try:
                snap_result = await self.session.call_tool("take_snapshot", {"verbose": False})
                snap_text = ""
                if hasattr(snap_result, 'content') and snap_result.content:
                    for item in snap_result.content:
                        if hasattr(item, 'text'):
                            snap_text += item.text + "\n"

                element_count = len(snap_text.split('\n')) if snap_text else 0
                text_len = len(snap_text)

                is_rendered = (
                    element_count >= min_elements_threshold and
                    text_len >= 200 and
                    abs(element_count - last_element_count) < 5 and
                    abs(text_len - last_snapshot_text_len) < 100
                )

                if is_rendered and stable_count >= 1:
                    elapsed = time.time() - start_time
                    self.last_snapshot_text = snap_text
                    self.parser.parse(snap_text)
                    log(f"  ✅ 页面已渲染 ({element_count}元素, {elapsed:.1f}s)", 3)
                    try:
                        await self._switch_to_latest_page()
                    except Exception:
                        pass
                    return

                if is_rendered:
                    stable_count += 1
                else:
                    stable_count = 0

                last_element_count = element_count
                last_snapshot_text_len = text_len

            except Exception:
                pass

            await asyncio.sleep(min(0.5, max_wait - (time.time() - start_time)))

        elapsed = time.time() - start_time
        log(f"  ⏱️ 渲染等待超时 ({elapsed:.1f}s)，继续执行", 3)

    def _find_nearest_interactive_ancestor(self, uid: str, target_roles: set) -> Optional[str]:
        """从给定元素向上查找最近的具有目标role的交互祖先元素

        基于快照的缩进层级+行号邻近性模拟DOM树遍历：
        - 从当前元素的indent_level向上一层一层找
        - 限定在目标元素前后10行范围内，避免匹配到DOM树其他分支的无关元素
        - 返回最近(最高indent_level)且最接近的匹配元素UID

        适用场景：下拉选项的文本在子元素StaticText中，
        需要找到其父级listitem/option等可点击元素。
        """
        elem = self.parser.elements.get(uid)
        if not elem:
            return None
        target_indent = elem.indent_level
        if target_indent <= 0:
            return None

        elem_idx = self.parser.element_order.index(uid) if uid in self.parser.element_order else -1
        if elem_idx < 0:
            return None

        search_range = 15
        start_idx = max(0, elem_idx - search_range)
        end_idx = min(len(self.parser.element_order), elem_idx + search_range)
        nearby_uids = set(self.parser.element_order[start_idx:end_idx])

        best_uid = None
        best_indent = -1

        for cid in nearby_uids:
            if cid == uid:
                continue
            celem = self.parser.elements.get(cid)
            if not celem:
                continue
            if celem.role not in target_roles:
                continue
            if not celem.is_interactive:
                continue
            if 0 < celem.indent_level < target_indent:
                if celem.indent_level > best_indent:
                    best_indent = celem.indent_level
                    best_uid = cid

        return best_uid

    async def _execute_readonly_picker_select(self, step: Dict, step_num: int,
                                              picker_uid: str, option_value: str):
        """readonly选择器: click打开→JS在DOM中找选项→click选中"""
        _LABEL_TO_CODE = {
            "市场法": "market", "资产基础法": "cost", "收益法": "income",
            "假设开发法": "development", "基准地价法": "benchmark", "其他方法": "other",
        }
        code_val = _LABEL_TO_CODE.get(option_value, option_value)

        log(f"  [Picker] Step1: 点击 uid={picker_uid} 打开下拉框", 2)
        await self.session.call_tool("click", {
            "uid": picker_uid, "includeSnapshot": False,
        })
        await asyncio.sleep(1.5)

        js_code = f"""() => {{
            const items = document.querySelectorAll('.el-select-dropdown__item');
            const results = [];
            for (const item of items) {{
                const span = item.querySelector('span');
                const text = span ? span.textContent.trim() : item.textContent.trim();
                results.push({{text:text, visible:item.offsetParent !== null}});
                if (text === '{option_value}' || text.includes('{option_value}')) {{
                    item.click();
                    return {{ok:true, clicked:text, totalItems:items.length}};
                }}
            }}
            // fallback: try clicking by index (market is 3rd item)
            if (items.length >= 3) {{
                items[2].click();
                return {{ok:true, clicked:'index[2]-fallback', totalItems:items.length, allText:results.map(r=>r.text)}};
            }}
            return {{ok:false, error:'option not found', totalItems:items.length, allText:results.map(r=>r.text)}};
        }}"""

        log(f"  [Picker] Step2: JS查找并点击'{option_value}'选项...", 2)
        try:
            result = await self.session.call_tool(
                "evaluate_script", {"function": js_code})
            log(f"  [Picker] JS结果: {result}", 1)
        except Exception as e:
            log(f"  [Picker] JS失败: {e}", 1)

        await asyncio.sleep(0.8)
        return [{"type": "text", "text": f"picker selected '{option_value}' via DOM click"}]

    def _find_picker_option(self, option_value: str, picker_uid: str,
                             target_roles: set, pre_click_uids=None) -> Optional[str]:
        best_uid = None
        best_match_len = 0
        for uid, elem in self.parser.elements.items():
            if uid == picker_uid or (pre_click_uids and uid in pre_click_uids):
                continue
            if elem.role not in target_roles or not elem.is_interactive:
                continue
            if elem.text and option_value in elem.text:
                match_len = len(option_value)
                if match_len > best_match_len:
                    best_match_len = match_len
                    best_uid = uid
                    log(f"    [命中role] uid={uid} role={elem.role} text='{elem.text}'", 3)
        if best_uid:
            return best_uid
        text_matches = self.parser.find_by_text_contains(option_value)
        for me in text_matches:
            mu = me.uid
            if mu == picker_uid or (pre_click_uids and mu in pre_click_uids):
                continue
            if me.role in target_roles and me.is_interactive:
                log(f"    [命中text] uid={mu} role={me.role}", 2)
                return mu
            pu = self._find_nearest_interactive_ancestor(mu, target_roles)
            if pu and pu != picker_uid:
                log(f"    [命中祖先] uid={pu} 源自uid={mu}", 2)
                return pu
        return None

    async def _execute_assert_multiple(self, step: Dict, step_num: int,
                                       desc: str, start_time: float) -> StepResult:
        action_type = "assert_multiple"
        log(f"  📸 获取页面快照用于断言验证...", 2)
        await self._take_snapshot()
        await asyncio.sleep(0.3)

        assertions = self._collect_assertions(step)
        assertion_results = []
        if not assertions:
            return StepResult(
                step_num=step_num, desc=desc, action=action_type,
                status=StepStatus.SUCCESS, mcp_tool="(assert_multiple)",
                output="No assertions defined, auto-pass",
                duration_ms=int((time.time() - start_time) * 1000),
                snapshot_path=self.last_snapshot_path or "",
            )

        log(f"\n  🔍 断言验证 ({len(assertions)} 项):", 1)
        for assertion in assertions:
            ar = self._run_assertion(assertion)
            assertion_results.append(ar)
            icon = "✅" if ar["passed"] else "❌"
            expected = ar.get("expected", "")
            log(f"    [{icon}] {assertion['type']}: 期望={expected} → "
                f"{'PASS' if ar['passed'] else 'FAIL'} | {ar['detail']}", 1)

        all_pass = all(a["passed"] for a in assertion_results)
        critical_fail = any(
            not a["passed"] and a.get("confidence") == "high"
            and a["type"] in ("text_contains", "url_contains", "element_visible")
            for a in assertion_results
        )

        if critical_fail:
            status = StepStatus.FAILED_ASSERT
            log("  ⛔ 关键断言失败!", 1)
        elif not all_pass:
            status = StepStatus.SUCCESS
            log("  ⚠️ 非关键断言失败，标记成功(continue_on_error)", 1)
        else:
            status = StepStatus.SUCCESS
            log("  ✅ 所有断言通过", 1)

        elapsed_ms = int((time.time() - start_time) * 1000)
        detail_summary = "; ".join(
            f"{a['type']}={'PASS' if a['passed'] else 'FAIL'}" for a in assertion_results
        )
        return StepResult(
            step_num=step_num, desc=desc, action=action_type,
            status=status, mcp_tool="(assert_multiple)",
            output=detail_summary, assertions=assertion_results,
            duration_ms=elapsed_ms,
            snapshot_before=self.last_snapshot_text[:500] if self.last_snapshot_text else "",
            snapshot_path=self.last_snapshot_path or "",
        )

    def _collect_assertions(self, step: Dict) -> List[Dict]:
        """收集步骤中的所有断言"""
        assertions = []
        singular = step.get("assertion")
        if singular:
            assertions.append(singular)
        plural = step.get("assertions", [])
        if plural:
            assertions.extend(plural)
        also = step.get("also_assert")
        if also:
            if isinstance(also, list):
                assertions.extend(also)
            else:
                assertions.append(also)
        return assertions

    def _run_assertion(self, assertion: Dict) -> Dict:
        """执行单个断言"""
        assert_type = assertion.get("type", "unknown")
        expected = resolve_env_vars(str(assertion.get("expected", "")))

        validator = AssertionRegistry.get(assert_type)
        
        if validator:
            try:
                result = validator(assertion, self.last_snapshot_text, self.parser, self.cache)
                return {
                    "type": assert_type,
                    "expected": expected,
                    "passed": result["passed"],
                    "detail": result["detail"],
                    "confidence": assertion.get("confidence", "medium"),
                }
            except Exception as e:
                return {
                    "type": assert_type,
                    "expected": expected,
                    "passed": False,
                    "detail": f"Validator error: {e}",
                    "confidence": assertion.get("confidence", "medium"),
                }

        passed = True
        detail = f"Unknown assertion type: {assert_type}, auto-passed"

        return {"type": assert_type, "expected": expected, "passed": passed, "detail": detail}

    @staticmethod
    def _extract_result_content(result) -> str:
        content_parts = []
        if result.content:
            for item in result.content:
                if hasattr(item, 'text'):
                    content_parts.append(item.text)
                else:
                    content_parts.append(str(item))
        return "".join(content_parts)

    @staticmethod
    def _check_result_has_error(content: str) -> bool:
        """
        检测MCP操作结果是否包含错误
        
        FastAI v2.0 修复版：
          - 增强错误识别能力，减少假阳性
          - 覆盖更多 MCP 实际返回的错误格式
        """
        if not content:
            return False
        
        content_lower = content.lower()
        
        # 1️⃣ 严格匹配：明确的错误类型
        strict_errors = [
            "mcp error",
            "input validation error", 
            "invalid arguments",
            "elementclickinterceptederror",
            "elementnotinteractableerror",
            "staleelement",
            "target closed",
            "detached",
            "execution failed",
            "permission denied",
            "access denied",
            "not found on page",
        ]
        
        if any(err in content_lower for err in strict_errors):
            return True
        
        # 2️⃣ 宽松匹配：常见错误关键词（MCP实际返回的格式）
        loose_error_patterns = [
            "error:",                    # "Error: Failed to interact..."
            "failed to",                 # "Failed to interact..."
            "did not become",           # "did not become interactive"
            "not interactive",           # "not interactive within"
            "timeout",                   # "within the configured timeout"
            "could not",                # "Could not find element"
            "unable to",                 # "Unable to click"
            "no such",                   # "No such element"
            "cannot find",              # "Cannot find"
            "element not found",         # "Element not found"
            "interaction failed",        # "interaction failed"
            "click intercepted",         # "Click intercepted"
            "is not clickable",          # "is not clickable"
            "is not visible",            # "is not visible"
            "does not exist",            # "does not exist"
            "unexpected error",          # "Unexpected error"
            "operation failed",          # "Operation failed"
        ]
        
        if any(pattern in content_lower for pattern in loose_error_patterns):
            return True
        
        # 3️⃣ 特殊检测：MCP工具返回的标准错误前缀
        if content_lower.startswith("error:") or content_lower.startswith("err:"):
            return True
            
        # 4️⃣ 长度异常检测：如果结果内容很长且包含可疑词汇
        suspicious_words = ["exception", "traceback", "stack trace"]
        if len(content) > 200 and any(word in content_lower for word in suspicious_words):
            return True
        
        return False


# ============================================================
# 报告生成器 v2.0
# ============================================================

class ReportGenerator:

    @staticmethod
    def generate(all_results: List[Tuple[str, TestcaseResult]], output_dir: str) -> str:
        os.makedirs(output_dir, exist_ok=True)
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        report_path = os.path.join(output_dir, f"report-{timestamp}.md")

        with open(report_path, "w", encoding="utf-8") as rf:
            rf.write("# 测试执行总报告\n\n")
            rf.write(f"**生成时间**: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            rf.write(f"**框架版本**: AI Test Framework v2.0\n\n")
            rf.write("---\n\n")

            rf.write("## 汇总概览\n\n")
            rf.write("| # | 用例ID | 标题 | 优先级 | 步骤 | 通过 | 失败 | 跳过 | 通过率 | 状态 |\n")
            rf.write("|---|--------|------|--------|------|------|------|------|--------|------|\n")

            total_p, total_f, total_s, total_sk = 0, 0, 0, 0
            for i, (_, r) in enumerate(all_results, 1):
                total_p += r.passed_count
                total_f += r.failed_count
                total_s += r.total_steps
                total_sk += r.skipped_count
                
                badge = {"PASS": "**PASS ✅**", "PARTIAL": "**PARTIAL ⚠️**",
                         "FAIL": "**FAIL ❌**"}.get(r.overall_status, r.overall_status)
                rf.write(f"| {i} | `{r.test_id}` | {r.title} | {r.priority} | "
                        f"{r.total_steps} | {r.passed_count} | {r.failed_count} | "
                        f"{r.skipped_count} | {r.pass_rate:.1f}% | {badge} |\n\n")

                rf.write(f"### {i}. {r.title}\n\n")
                rf.write(f"- **ID**: `{r.test_id}`\n")
                rf.write(f"- **文件**: `{os.path.basename(r.yaml_file)}`\n")
                rf.write(f"- **状态**: {badge} ({r.pass_rate:.1f}%)\n")
                rf.write(f"- **时间**: {r.timestamp}\n\n")

                rf.write("**步骤明细**:\n\n")
                rf.write("| # | 描述 | 动作 | 状态 | 重试 | 耗时 |\n")
                rf.write("|---|------|------|------|------|------|\n")
                for sr in r.steps:
                    icon = {StepStatus.SUCCESS: "✅", StepStatus.FAILED: "❌",
                           StepStatus.FAILED_ASSERT: "⚠️", StepStatus.SKIPPED: "⏭️",
                           StepStatus.ERROR: "💥", StepStatus.RETRIED: "🔄"}.get(sr.status, "?")
                    retry_info = f"x{sr.retry_count}" if sr.retry_count > 0 else "-"
                    rf.write(f"| {sr.step_num} | {sr.desc} | {sr.action} | "
                            f"{icon} {sr.status.value} | {retry_info} | {sr.duration_ms}ms |\n")

                if r.screenshots:
                    rf.write("\n**截图**:\n\n")
                    for ss in r.screenshots:
                        ss_name = os.path.basename(ss)
                        dest = os.path.join(output_dir, ss_name)
                        if os.path.exists(ss) and not os.path.exists(dest):
                            try:
                                shutil.copy2(ss, dest)
                            except Exception:
                                pass
                        rf.write(f"- ![]({ss_name})\n")
                rf.write("---\n\n")

            grand_total = total_s
            grand_executed = grand_total - total_sk
            grand_rate = (total_p / grand_executed * 100) if grand_executed > 0 else 0
            overall = "ALL PASS ✅" if total_f == 0 else ("PARTIAL ⚠️" if total_p > 0 else "ALL FAIL ❌")
            
            rf.write(f"\n## 总计\n\n")
            rf.write(f"| 指标 | 值 |\n|------|-----|\n")
            rf.write(f"| 用例数 | {len(all_results)} |\n| 总步骤 | {grand_total} |\n")
            rf.write(f"| 已执行 | {grand_executed} |\n| 跳过 | {total_sk} |\n")
            rf.write(f"| 通过 | {total_p} |\n| 失败 | {total_f} |\n")
            rf.write(f"| 通过率 | {grand_rate:.1f}% |\n| 状态 | **{overall}** |\n")

        for _, r in all_results:
            safe_id = r.test_id.replace("/", "-").replace("\\", "-")
            detail_path = os.path.join(output_dir, f"{safe_id}-detail.md")
            with open(detail_path, "w", encoding="utf-8") as df:
                df.write(f"# {r.title}\n\n")
                df.write(f"- **ID**: `{r.test_id}`\n")
                df.write(f"- **状态**: **{r.overall_status}** ({r.pass_rate:.1f}%)\n")
                df.write(f"- **时间**: {r.timestamp}\n")
                df.write(f"- **配置**: ```json\n{json.dumps(r.config, ensure_ascii=False, indent=2)}\n```\n\n")
                df.write("---\n\n")
                
                for sr in r.steps:
                    icon = {StepStatus.SUCCESS: "✅", StepStatus.FAILED: "❌",
                           StepStatus.FAILED_ASSERT: "⚠️", StepStatus.SKIPPED: "⏭️",
                           StepStatus.ERROR: "💥", StepStatus.RETRIED: "🔄"}.get(sr.status, "?")
                    df.write(f"### 步骤{sr.step_num}: {sr.desc} [{icon} {sr.status.value}]\n\n")
                    df.write(f"```\n动作: {sr.action}\n工具: {sr.mcp_tool}\n")
                    df.write(f"参数: {json.dumps(sr.mcp_args, ensure_ascii=False, indent=2)}\n")
                    if sr.output:
                        out = sr.output[:600] + "..." if len(sr.output) > 600 else sr.output
                        df.write(f"结果: {out}\n")
                    if sr.error:
                        df.write(f"错误: {sr.error}\n")
                    if sr.retry_count > 0:
                        df.write(f"重试次数: {sr.retry_count}\n")
                    if sr.assertions:
                        df.write(f"断言:\n")
                        for ar in sr.assertions:
                            ai = "✅" if ar["passed"] else "❌"
                            conf = ar.get("confidence", "medium")
                            df.write(f"  {ai} [{conf}] {ar['type']}: {ar.get('expected','')} → {ar.get('detail','')}\n")
                    if sr.snapshot_before:
                        snap_preview = sr.snapshot_before[:200] + "..." if len(sr.snapshot_before) > 200 else sr.snapshot_before
                        df.write(f"执行前快照预览:\n{snap_preview}\n")
                    if sr.snapshot_path:
                        df.write(f"快照文件: `{sr.snapshot_path}`\n")
                    
                    # ===== LLM 思维链输出 =====
                    if sr.thinking_pre or sr.thinking_post:
                        df.write(f"\n#### 🧠 LLM 思维链 (置信度: {sr.llm_confidence:.0%})\n\n")
                        if sr.thinking_pre:
                            df.write(f"**执行前思考:**\n\n```\n{sr.thinking_pre}\n```\n\n")
                        if sr.thinking_post:
                            df.write(f"**执行后反思:**\n\n```\n{sr.thinking_post}\n```\n\n")
                        if sr.llm_suggestions:
                            df.write(f"**AI 建议:**\n")
                            for i, s in enumerate(sr.llm_suggestions, 1):
                                df.write(f"  {i}. {s}\n")
                            df.write("\n")
                    
                    df.write("```\n\n")

        return report_path


# ============================================================
# 测试用例发现器
# ============================================================

def discover_testcases(root_dir: str) -> Dict[str, List[Dict]]:
    """扫描 tc-* 目录下的所有 YAML 测试用例"""
    result = {}
    if not os.path.exists(root_dir):
        return result
    for entry in sorted(os.listdir(root_dir)):
        full_path = os.path.join(root_dir, entry)
        if os.path.isdir(full_path) and entry.startswith("tc"):
            yamls = sorted([f for f in os.listdir(full_path)
                           if f.endswith(".yaml") or f.endswith(".yml")])
            if yamls:
                result[entry] = [{"dir": entry, "filename": yf,
                                    "path": os.path.join(full_path, yf)}
                                  for yf in yamls]
    return result


# ============================================================
# 主执行引擎 v2.0
# ============================================================

async def run_single_testcase(yaml_path: str, result_dir: str = None,
                             global_config: Dict[str, Any] = None) -> TestcaseResult:
    """执行单个 YAML 测试用例"""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    parser = SnapshotParser()
    cache = {}
    config = {**DEFAULT_CONFIG, **(global_config or {})}

    log(f"📂 加载: {yaml_path}", 1)
    with open(yaml_path, "r", encoding="utf-8") as f:
        testcase = yaml.safe_load(f)

    test_id = testcase.get("test_id", "UNKNOWN")
    title = testcase.get("title", "未命名")
    priority = testcase.get("priority", "P3")

    tc_config = testcase.get("config", {})
    config.update(tc_config)

    env_used = {}
    context_check = testcase.get("context_check", {})
    if context_check:
        creds = context_check.get("credentials", {})
        for var_name, var_val in creds.items():
            resolved = resolve_env_vars(var_val)
            original = os.environ.get(var_name)
            os.environ[var_name] = resolved
            env_used[var_name] = {"set_to": resolved, "was": original}
            log(f"  凭据: {var_name}={'已设置' if resolved else '未设置'}", 2)

    result = TestcaseResult(
        test_id=test_id, title=title, priority=priority,
        yaml_file=yaml_path, timestamp=timestamp,
        config=config, env_used=env_used,
    )

    steps = testcase.get("steps", [])
    on_fail_strategy = testcase.get("on_fail", "continue")
    if on_fail_strategy not in ("stop", "continue", "retry"):
        on_fail_strategy = "continue"

    log(f"📋 {len(steps)} 个步骤 | 失败策略: {on_fail_strategy}", 1)

    think_enabled = config.get("llm_think_enabled", False)
    think_engine = None
    
    if think_enabled and LLM_AVAILABLE:
        llm_cfg = {
            **LLM_CONFIG,
            "enabled": True,
            "think_mode": "deep" if config.get("llm_think_deep") else "auto",
        }
        think_engine = ThinkChainEngine(llm_cfg)
        if think_engine.enabled:
            log(f"  🧠 思维链已启用 (模式: {llm_cfg['think_mode']})", 1)
        else:
            log(f"  ⚠️ 思维链初始化失败，将使用规则模式", 1)
            think_engine = None
    else:
        log(f"  ⚡ 思维链已禁用 (快速模式)", 2)

    async with stdio_client(SERVER_PARAMS) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools_resp = await session.list_tools()
            log(f"🔌 MCP 已连接 ({len(tools_resp.tools)} 工具)", 1)

            executor = ActionExecutor(session, parser, cache, config, think_engine, result_dir=result_dir)

            # ============================================================
            # FastAI v2.0: 智能登录管理（步骤1导航完成后才检测）
            # ============================================================
            login_status = None
            smart_skip_enabled = testcase.get("smart_skip", True)
            _login_checked = False

            for step_idx, step in enumerate(steps):
                step_num = step.get("step", step_idx + 1)

                # ===== 步骤1（navigate）始终执行，完成后检测登录状态 =====
                if step_idx == 0:
                    log(f"\n{'─'*50}", 1)
                    log(f"[{step_idx+1}/{len(steps)}] 开始执行步骤 {step_num}", 1)
                    sr = await executor.execute(step, step_num, tc_config)
                    result.steps.append(sr)

                    # 步骤1（navigate）完成后，等待SPA渲染再检测登录状态
                    if context_check and smart_skip_enabled and not _login_checked:
                        _login_checked = True
                        # SPA页面需要等待JavaScript渲染完成（否则快照为空）
                        render_wait = config.get("spa_render_wait", 3.0)
                        log(f"  ⏳ 等待SPA渲染 ({render_wait}s)...", 2)
                        await asyncio.sleep(render_wait)

                        try:
                            from login_manager import LoginManager
                            manager = LoginManager(snapshot_dir=executor.snapshot_dir)

                            required_user = context_check.get("credentials", {}).get("username", "${TEST_USER}")
                            login_status = await manager.check_and_ensure_login(
                                session=session,
                                parser=parser,
                                config=config,
                                required_user=required_user,
                                context_check=context_check
                            )

                            if login_status:
                                log(f"\n{'='*55}", 1)
                                log(f"🔐 登录状态检测结果", 1)
                                log(f"   操作: {login_status.action.upper()}", 2)
                                log(f"   当前用户: {login_status.current_user or '未登录'}", 2)
                                log(f"   原因: {login_status.reason}", 2)

                                if login_status.action == "skip":
                                    skip_nums = [steps[i].get("step", i+1) for i in login_status.steps_to_skip]
                                    log(f"   跳过步骤: {skip_nums}", 2)

                                if login_status.warning:
                                    log(f"   ⚠️ 注意: 此结果可能不准确，请人工确认", 2)

                                log(f"{'='*55}\n", 1)

                        except Exception as e:
                            log(f"⚠️ 登录管理器初始化失败: {e}，将执行完整流程", 2)
                            login_status = None

                    if sr.status in (StepStatus.FAILED, StepStatus.ERROR, StepStatus.FAILED_ASSERT):
                        if on_fail_strategy == "stop":
                            log(f"\n⛔ 步骤{step_num}失败，终止执行 (策略: stop)", 1)
                            break
                        else:
                            log(f"\n⚠️ 步骤{step_num}失败，继续执行 (策略: {on_fail_strategy})", 1)
                    continue

                # ===== 步骤2+：智能跳过判断 =====
                should_skip = (
                    login_status and
                    login_status.action == "skip" and
                    step_idx in login_status.steps_to_skip
                )

                if should_skip:
                    skipped_result = StepResult(
                        step_num=step_num,
                        desc=step.get("desc", "已跳过"),
                        action=step.get("action", "skipped"),
                        status=StepStatus.SKIPPED,
                        mcp_tool="smart_login_manager",
                        output=f"智能跳过: {login_status.reason}",
                        duration_ms=0,
                    )
                    result.steps.append(skipped_result)
                    continue
                
                log(f"\n{'─'*50}", 1)
                log(f"[{step_idx+1}/{len(steps)}] 开始执行步骤 {step_num}", 1)

                prev_action = steps[step_idx - 1].get("action", "") if step_idx > 0 else ""
                sr = await executor.execute(step, step_num, tc_config)
                result.steps.append(sr)

                if sr.status in (StepStatus.FAILED, StepStatus.ERROR, StepStatus.FAILED_ASSERT):
                    if on_fail_strategy == "stop":
                        log(f"\n⛔ 步骤{step_num}失败，终止执行 (策略: stop)", 1)
                        break
                    elif on_fail_strategy == "retry":
                        log(f"\n⚠️ 步骤{step_num}失败，但继续执行 (策略: continue)", 1)
                    else:
                        log(f"\n⚠️ 步骤{step_num}失败，继续执行 (策略: {on_fail_strategy})", 1)

                # 等待当前步骤的页面渲染完成，再进入下一步
                if step_idx < len(steps) - 1:
                    current_action = step.get("action", "")
                    try:
                        await executor._wait_for_render_complete(current_action, sr)
                    except Exception as e:
                        log(f"  ⚠️ 渲染等待异常（继续）: {e}", 3)

            teardown = testcase.get("teardown", [])
            if teardown:
                log(f"\n🧹 后置清理 ({len(teardown)} 项)", 1)
                for td in teardown:
                    td_action = td.get("action", "")
                    if td_action == "screenshot":
                        name = td.get("name", f"result-{timestamp}.png").replace(
                            "{timestamp}", time.strftime("%Y%m%d-%H%M%S"))
                        if result_dir:
                            save_name = f"{test_id}-{name}"
                            save_path = os.path.join(result_dir, save_name)
                        else:
                            save_path = name
                        try:
                            await session.call_tool("take_screenshot", {
                                "fullPage": td.get("fullPage", False),
                                "filePath": save_path,
                            })
                            result.screenshots.append(save_path)
                            log(f"  ✅ 截图: {save_name}", 1)
                        except Exception as e:
                            log(f"  ⚠️ 截图失败: {e}", 1)

    for var_name, info in env_used.items():
        if info["was"] is not None:
            os.environ[var_name] = info["was"]
        else:
            os.environ.pop(var_name, None)

    return result


async def run_all(targets: List[Dict], env_overrides: Dict[str, str] = None,
                 global_config: Dict[str, Any] = None) -> List[TestcaseResult]:
    """批量执行多个测试用例"""
    if env_overrides:
        for k, v in env_overrides.items():
            os.environ[k] = v

    results = []
    run_ts = time.strftime("%Y%m%d-%H%M%S")
    this_result_dir = os.path.join(RESULT_BASE_DIR, f"run-{run_ts}")

    log(f"\n{'#'*60}", 1)
    log(f"# AI Test Framework v2.0", 1)
    log(f"# 开始执行 {len(targets)} 个用例", 1)
    log(f"# 结果 → {this_result_dir}/", 1)
    log(f"# 已注册 Actions: {len(ActionRegistry.list_actions())}", 1)
    log(f"# 已注册 Assertions: {len(AssertionRegistry.list_assertions())}", 1)
    log(f"{'#'*60}\n", 1)

    for idx, tc_info in enumerate(targets, 1):
        log(f"\n[{idx}/{len(targets)}] ===== {tc_info['filename']} =====\n", 1)

        tc_env = _load_testcase_env(tc_info["path"])

        try:
            r = await run_single_testcase(tc_info["path"], this_result_dir, global_config)
            results.append(r)
        except Exception as e:
            log(f"[FATAL] 执行异常: {e}\n", 1)
            traceback.print_exc()
            results.append(TestcaseResult(
                test_id="ERROR", title=tc_info["filename"], priority="?",
                yaml_file=tc_info["path"], timestamp=time.strftime('%Y-%m-%d %H:%M:%S'),
                steps=[StepResult(0, "初始化失败", "error", StepStatus.ERROR,
                                error=str(e), duration_ms=0)],
            ))
        finally:
            for key, old_val in tc_env.items():
                if old_val is not None:
                    os.environ[key] = old_val
                else:
                    os.environ.pop(key, None)

    elapsed = time.time() - (time.mktime(time.strptime(run_ts, "%Y%m%d-%H%M%S")))

    if results:
        log(f"\n{'='*60}", 1)
        log(f"# 完成，耗时 {elapsed:.0f}s", 1)
        log(f"{'='*60}\n", 1)

        report_path = ReportGenerator.generate(
            [(r.yaml_file, r) for r in results], this_result_dir)
        log(f"📊 报告: {report_path}", 1)
        log(f"📁 目录: {this_result_dir}/\n", 1)

        tp = sum(r.passed_count for r in results)
        tf = sum(r.failed_count for r in results)
        ts = sum(r.total_steps for r in results)
        tsk = sum(r.skipped_count for r in results)
        te = ts - tsk
        rate = (tp / te * 100) if te > 0 else 0
        status = "ALL PASS ✅" if tf == 0 else ("PARTIAL ⚠️" if tp > 0 else "ALL FAIL ❌")
        log(f"  用例: {len(results)} | 总步骤: {ts} | 已执行: {te} | 跳过: {tsk}")
        log(f"  通过: {tp} | 失败: {tf} | 通过率: {rate:.0f}% | 状态: {status}")

    return results


# ============================================================
# CLI 入口
# ============================================================

def print_usage():
    print("=" * 70)
    print("  AI Test Framework v2.1 - 通用 AI 测试框架 (含录制模式)")
    print("=" * 70)
    print()
    print("用法:")
    print(f"  python testcase-ai.py                          列出用例")
    print(f"  python testcase-ai.py --all                     全部运行")
    print(f"  python testcase-ai.py <目录>                     运行目录")
    print(f"  python testcase-ai.py <yaml路径>                 运行单个文件")
    print(f"  python testcase-ai.py --continue                 失败后继续执行")
    print()
    print("🎬 录制模式 (交互式操作录制):")
    print(f"  python testcase-ai.py --record                   录制到 testcases/recorded/")
    print(f"  python testcase-ai.py --record <路径>             录制到指定路径")
    print()
    print("思维链选项:")
    print(f"  python testcase-ai.py --think <yaml>              启用 LLM 思维链")
    print(f"  python testcase-ai.py --think-deep <yaml>         深度思维模式")
    print()
    print("LLM 配置 (环境变量):")
    print(f"  LLM_BASE_URL     API 地址 (默认: http://10.0.11.6:8005/v1)")
    print(f"  LLM_API_KEY      API 密钥")
    print(f"  LLM_MODEL        模型名称 (默认: gemma-4-26B-A4B-it)")
    print()
    print("测试环境变量:")
    print(f"  TEST_USER       用户名")
    print(f"  TEST_PASS       密码")
    print(f"  TEST_PROJECT_NAME  项目名称")
    print(f"  TEST_AMOUNT       金额")
    print()
    think_status = "✅ 可用" if LLM_AVAILABLE else "❌ 未安装 openai"
    print(f"框架能力:")
    print(f"  Actions ({len(ActionRegistry.list_actions())}): {', '.join(ActionRegistry.list_actions()[:10])}...")
    print(f"  Assertions ({len(AssertionRegistry.list_assertions())}): {', '.join(AssertionRegistry.list_assertions()[:10])}...")
    print(f"  LLM 思维链: {think_status}")
    print()

    dirs = discover_testcases(TESTCASES_ROOT)
    if not dirs:
        print(f"[INFO] {TESTCASES_ROOT} 中无 tc-* 目录")
        return
    print("可用测试用例:")
    for dn, files in dirs.items():
        print(f"\n  📁 {dn}/")
        for fi in files:
            print(f"     └─ {fi['filename']}")


# ============================================================
# Recorder Mode - delegated to tests/recorder.py (SRP extraction)
# ============================================================


if __name__ == "__main__":
    register_builtin_actions()
    register_builtin_assertions()

    args = sys.argv[1:]

    if not args:
        print_usage()
        sys.exit(0)

    # ===== 录制模式（优先于其他模式）=====
    if "--record" in args:
        args.remove("--record")
        output = args[0] if args else "testcases/recorded/testcase.yaml"
        if not output.endswith((".yaml", ".yml")):
            output = os.path.join(output, "testcase.yaml") if not output.endswith(".yaml") else output
        import importlib.util
        _spec = importlib.util.spec_from_file_location("recorder", os.path.join(os.path.dirname(__file__), "recorder.py"))
        _recorder = importlib.util.module_from_spec(_spec)
        _spec.loader.exec_module(_recorder)
        asyncio.run(_recorder.run_record_mode(output))
        sys.exit(0)

    targets = []
    global_config = {}

    # ===== 思维链参数解析 =====
    if "--think" in args:
        global_config["llm_think_enabled"] = True
        global_config["llm_think_deep"] = False
        args.remove("--think")
        log("🧠 LLM 思维链已启用 (标准模式)", 1)
    
    if "--think-deep" in args:
        global_config["llm_think_enabled"] = True
        global_config["llm_think_deep"] = True
        args.remove("--think-deep")
        log("🧠 LLM 思维链已启用 (深度模式)", 1)

    if "--all" in args or "-a" in args:
        all_dirs = discover_testcases(TESTCASES_ROOT)
        if not all_dirs:
            print(f"[ERROR] 未找到测试用例")
            sys.exit(1)
        for files in all_dirs.values():
            targets.extend(files)

    elif args[0].endswith((".yaml", ".yml")):
        p = args[0] if os.path.isabs(args[0]) else os.path.join(PROJECT_ROOT, args[0])
        if not os.path.exists(p):
            print(f"[ERROR] 文件不存在: {p}")
            sys.exit(1)
        targets = [{"dir": "", "filename": os.path.basename(p), "path": p}]

    else:
        dn = args[0]
        if not dn.startswith("tc"):
            dn = f"tc{dn}" if not dn.startswith("tc-") else dn
        dp = os.path.join(TESTCASES_ROOT, dn)
        if not os.path.exists(dp):
            available = [d for d in os.listdir(TESTCASES_ROOT)
                        if os.path.isdir(os.path.join(TESTCASES_ROOT, d)) and d.startswith("tc")]
            print(f"[ERROR] 目录不存在: {dp}")
            print(f"可用: {available}")
            sys.exit(1)
        yfs = [f for f in os.listdir(dp) if f.endswith((".yaml", ".yml"))]
        if not yfs:
            print(f"[ERROR] 目录中无YAML: {dp}")
            sys.exit(1)
        targets = [{"dir": dn, "filename": yf, "path": os.path.join(dp, yf)}
                  for yf in sorted(yfs)]

    if "--continue" in args:
        global_config["continue_on_error"] = True
    if "--stop-on-error" in args:
        global_config["continue_on_error"] = False

    # 加载全局 .env 环境变量配置文件（各用例的 .env 会在执行时自动加载）
    _load_env_from_file()

    env = {}
    asyncio.run(run_all(targets, env, global_config))
