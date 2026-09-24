"""AI Test Framework - MCP 客户端封装层

从 run_testcase.py 提取的 MCP 相关工具函数，负责：
  - Chrome 启动前 Profile 预配置（禁用密码泄露检测等）
  - MCP 响应结果提取与解析
  - MCP 错误检测
  - JSON 响应解析（容错）
"""
import json
import os
import re

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from tests.framework.constants import SERVER_PARAMS
from tests.framework.logger import log


def preconfigure_chrome_profile(server_params):
    """在启动Chrome前，预写入Preferences文件从源头禁用密码泄露检测等功能

    Chrome的Password Leak Detection气泡属于Surface层UI（与地址栏同级），
    不在DOM、不在Accessibility Tree、不是JS alert/confirm，
    三层常规策略都无法触达。最可靠的方式是在Profile中直接禁用该功能。
    """
    user_data_dir = None
    for arg in server_params.args:
        if arg.startswith("--chromeArg=--user-data-dir="):
            user_data_dir = arg.split("=", 1)[1]
            break
    if not user_data_dir or not os.path.isdir(os.path.dirname(user_data_dir)):
        return
    default_dir = os.path.join(user_data_dir, "Default")
    os.makedirs(default_dir, exist_ok=True)
    pref_path = os.path.join(default_dir, "Preferences")
    if os.path.exists(pref_path):
        return
    preferences = {
        "credentials_enable_service": False,
        "password_manager_enabled": False,
        "password_manager": {
            "leak_detection": {"enabled": False}
        },
        "safe_browsing": {
            "enabled": False,
            "password_leak_detection_enabled": False
        },
        "sync_disabled": True,
        "signin_promo_show_on_first_run_allowed": False,
    }
    try:
        with open(pref_path, "w", encoding="utf-8") as f:
            json.dump(preferences, f, ensure_ascii=False, indent=2)
        log(f"   📝 已预配置 Chrome Profile: {pref_path}", 2)
    except Exception as e:
        log(f"   ⚠️ Chrome Profile 预配置失败: {e}", 2)


def extract_result_content(result) -> str:
    """从 MCP CallToolResult 中提取文本内容"""
    content_parts = []
    if result.content:
        for item in result.content:
            if hasattr(item, 'text'):
                content_parts.append(item.text)
            else:
                content_parts.append(str(item))
    return "".join(content_parts)


def check_result_has_error(content: str) -> bool:
    """检测MCP操作结果是否包含错误

    FastAI v2.0 修复版：
      - 增强错误识别能力，减少假阳性
      - 覆盖更多 MCP 实际返回的错误格式
    """
    if not content:
        return False

    content_lower = content.lower()

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

    loose_error_patterns = [
        "error:",
        "failed to",
        "did not become",
        "not interactive",
        "timeout",
        "could not",
        "unable to",
        "no such",
        "cannot find",
        "element not found",
        "interaction failed",
        "click intercepted",
        "is not clickable",
        "is not visible",
        "does not exist",
        "unexpected error",
        "operation failed",
    ]

    if any(pattern in content_lower for pattern in loose_error_patterns):
        return True

    if content_lower.startswith("error:") or content_lower.startswith("err:"):
        return True

    suspicious_words = ["exception", "traceback", "stack trace"]
    if len(content) > 200 and any(word in content_lower for word in suspicious_words):
        return True

    return False


def parse_json_from_mcp_response(text: str):
    """从 MCP 响应文本中提取 JSON 对象（最大容错）

    策略:
      1. 正则提取 markdown 代码块
      2. 多轮尝试 json.loads（包括二次解码）
      3. 正则提取 key:value 作为兜底
      4. 如果包含 found/exposed 等成功标记，返回 {"found": True}
    """
    if not text or not text.strip():
        return {}
    text = text.strip()

    code_block_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
    if code_block_match:
        text = code_block_match.group(1).strip()

    text_clean = text.replace('\n', ' ').replace('\r', '')

    def _try_parse(s):
        s = s.strip()
        if not s or len(s) < 3:
            return None
        try:
            return json.loads(s)
        except (json.JSONDecodeError, ValueError):
            pass
        try:
            cleaned = s.replace('\\n', ' ').replace('\\r', '').replace('\\t', ' ')
            return json.loads(cleaned)
        except (json.JSONDecodeError, ValueError):
            pass
        return None

    def _try_double_parse(s):
        first = _try_parse(s)
        if isinstance(first, dict):
            return first
        if isinstance(first, list):
            return {"_array": first}
        if isinstance(first, str):
            second = _try_parse(first)
            if isinstance(second, dict):
                return second
            if isinstance(second, list):
                return {"_array": second}
        return first

    result = _try_double_parse(text_clean)
    if isinstance(result, dict):
        return result

    start = text_clean.find('{')
    end = text_clean.rfind('}')
    if start != -1 and end != -1 and end > start:
        candidate = text_clean[start:end + 1]
        result = _try_double_parse(candidate)
        if isinstance(result, dict):
            return result

    start = text_clean.find('[')
    end = text_clean.rfind(']')
    if start != -1 and end != -1 and end > start:
        candidate = text_clean[start:end + 1]
        result = _try_parse(candidate)
        if isinstance(result, list):
            return {"_array": result}

    if re.search(r'"found"\s*:\s*true', text_clean) or \
       re.search(r'"exposed"\s*:\s*true', text_clean) or \
       re.search(r'found\s*:\s*true', text_clean):
        log(f"    [MCP-Parse] 通过正则检测到成功标记", 3)
        return {"found": True, "_parse_method": "regex_fallback"}

    log(f"    [MCP-Parse] ⚠️ 无法提取JSON对象 (len={len(text_clean)}, has_found={'found' in text_clean.lower()})", 2)
    return {}
