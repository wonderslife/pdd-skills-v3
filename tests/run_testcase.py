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
import sys
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))


import shutil
import time
import traceback
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple, Type, Union

import yaml
from tests.framework.constants import (
    LLM_CONFIG,
    LLM_AVAILABLE,
    BASE_DIR,
    PROJECT_ROOT,
    SERVER_PARAMS,
    TESTCASES_ROOT,
    RESULT_BASE_DIR,
    ENV_FILE_PATH,
    DEFAULT_CONFIG,
    INTERACTIVE_ROLES,
    INPUT_ROLES,
)
from tests.framework.snapshot_models import (
    StepStatus, SnapshotElement, StepResult, TestcaseResult,
)
from tests.framework.snapshot_matcher import SnapshotParser
from tests.framework.mcp_client import (
    ClientSession, StdioServerParameters, stdio_client,
    preconfigure_chrome_profile,
    extract_result_content, check_result_has_error, parse_json_from_mcp_response,
)
from tests.framework.yaml_loader import _resolve_includes, _load_env_from_file, _load_testcase_env
from tests.framework.arg_builders import (
    ActionRegistry, AssertionRegistry,
    resolve_env_vars, _resolve_uid,
    register_builtin_actions, register_builtin_assertions,
)
from tests.framework.logger import log, set_log_file
from tests.framework.action_executor import ActionExecutor
from tests.framework.utils import safe_json_dumps

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# resolve_env_vars 已迁移至 tests.framework.arg_builders 模块



# log / set_log_file 已迁移至 tests.framework.logger 模块
# _resolve_includes / _load_env_from_file / _load_testcase_env 已迁移至 tests.framework.yaml_loader 模块


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
            f"- 参数: {safe_json_dumps(result.mcp_args, ensure_ascii=False)[:200]}",
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


# ActionRegistry / AssertionRegistry / _resolve_uid / _build_xxx_args /
# assert_xxx / register_builtin_actions / register_builtin_assertions
# 已迁移至 tests.framework.arg_builders 模块

# ============================================================

# ActionExecutor 已迁移至 tests.framework.action_executor 模块

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
                            except Exception as e:
                                log(f"  ⚠️ 截图复制失败: {ss} → {dest}: {type(e).__name__}: {e}", 3)
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
                    df.write(f"参数: {safe_json_dumps(sr.mcp_args, ensure_ascii=False, indent=2)}\n")
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
# _preconfigure_chrome_profile 已迁移至 tests.framework.mcp_client 模块


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

    base_dir = str(Path(yaml_path).parent)
    testcase = _resolve_includes(testcase, base_dir)

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

    log(f"\n{'='*60}", 1)
    log(f"🌐 启动 Chrome 浏览器...", 1)
    log(f"   命令: npx {' '.join(SERVER_PARAMS.args[:5])}...", 2)
    chrome_args = [a for a in SERVER_PARAMS.args if a.startswith("--chromeArg")]
    log(f"   Chrome 参数 ({len(chrome_args)} 个):", 2)
    for arg in chrome_args:
        clean_arg = arg.replace("--chromeArg=", "")
        log(f"     {clean_arg}", 2)

    preconfigure_chrome_profile(SERVER_PARAMS)

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
                yaml_step = step.get("step")
                step_num = yaml_step if yaml_step else (step_idx + 1)
                step_gap = (yaml_step or 0) - (step_idx + 1) if yaml_step else 0
                gap_info = f" (YAML step#{yaml_step}, 偏移{step_gap:+d})" if abs(step_gap) > 1 else ""

                # ===== 步骤1（navigate）始终执行，完成后检测登录状态 =====
                if step_idx == 0:
                    log(f"\n{'─'*50}", 1)
                    log(f"[{step_idx+1}/{len(steps)}] 开始执行步骤 {step_num}{gap_info}", 1)
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
                log(f"[{step_idx+1}/{len(steps)}] 开始执行步骤 {step_num}{gap_info}", 1)

                prev_action = steps[step_idx - 1].get("action", "") if step_idx > 0 else ""
                sr = await executor.execute(step, step_num, tc_config)
                result.steps.append(sr)

                if sr.status in (StepStatus.FAILED, StepStatus.ERROR, StepStatus.FAILED_ASSERT):
                    is_critical = (
                        step.get("assertion", {}).get("critical", False) or
                        step.get("critical", False)
                    )
                    if is_critical:
                        log(f"\n🛑 步骤{step_num}关键断言失败，立即终止执行", 1)
                        break
                    elif on_fail_strategy == "stop":
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
    os.makedirs(this_result_dir, exist_ok=True)
    set_log_file(os.path.join(this_result_dir, "console.log"))

    log(f"\n{'#'*60}", 1)
    log(f"# AI Test Framework v2.0", 1)
    log(f"# 开始执行 {len(targets)} 个用例", 1)
    log(f"# 结果 → {this_result_dir}/", 1)
    log(f"# 已注册 Actions: {len(ActionRegistry.list_actions())}", 1)
    log(f"# 已注册 Assertions: {len(AssertionRegistry.list_assertions())}", 1)
    log(f"{'#'*60}\n", 1)

    log(f"⚠️  如出现 Chrome 密码泄露检测弹窗，请以管理员权限执行以下命令:", 1)
    log(f"    reg add \"HKLM\\SOFTWARE\\Policies\\Google\\Chrome\" /v PasswordLeakDetectionEnabled /t REG_DWORD /d 0 /f", 1)
    log(f"    reg add \"HKLM\\SOFTWARE\\Policies\\Google\\Chrome\" /v PasswordManagerEnabled /t REG_DWORD /d 0 /f", 1)
    log(f"", 1)

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
        raw_path = args[0]
        if os.path.isabs(raw_path):
            p = raw_path
        else:
            p = os.path.abspath(raw_path)
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
