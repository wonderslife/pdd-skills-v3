"""
AI Test Framework - 常量定义
==========================

从 run_testcase.py 提取的纯数据常量和配置。
包含: LLM配置、MCP连接参数、路径配置、角色定义、默认执行参数。
"""

import os
import time

from mcp import StdioServerParameters

# ============================================================
# 路径配置
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(BASE_DIR))
os.environ.setdefault("PROJECT_ROOT", PROJECT_ROOT)

TESTCASES_ROOT = os.path.join(PROJECT_ROOT, "testcases")
RESULT_BASE_DIR = os.path.join(PROJECT_ROOT, "test-result")
ENV_FILE_PATH = os.path.join(BASE_DIR, ".env.test")


# ============================================================
# LLM 配置
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
# MCP Chrome 连接参数
# ============================================================

def _create_incognito_server_params() -> StdioServerParameters:
    """创建使用隔离模式 Chrome 的 MCP 连接参数

    所有 --disable-features 合并为一个逗号分隔字符串，
    避免后一个覆盖前一个的问题。
    """
    disabled_features = ",".join([
        "Translate",
        "OptimizationHints",
        "MediaRouter",
        "DialMediaRouteProvider",
        "PasswordCheck",
        "PasswordLeakDetection",
        "SafeBrowsingPasswordProtectionTrigger",
        "PasswordGeneration",
        "AutofillShowTypePredictions",
    ])

    npx_args = [
        "-y", "chrome-devtools-mcp@latest",
        "--isolated",
        "--chromeArg=--no-first-run",
        "--chromeArg=--no-default-browser-check",
        "--chromeArg=--disable-sync",
        "--chromeArg=--disable-extensions",
        "--chromeArg=--disable-component-extensions-with-background-pages",
        "--chromeArg=--disable-popup-blocking",
        "--chromeArg=--ignore-certificate-errors",
        "--chromeArg=--ignore-certificate-errors-spki-list",
        "--chromeArg=--disable-web-security",
        "--chromeArg=--allow-running-insecure-content",
        "--chromeArg=--unsafely-treat-insecure-origin-as-secure",
        "--chromeArg=--disable-password-manager-reauthentication",
        "--chromeArg=--disable-save-password-bubble",
        "--chromeArg=--password-store=basic",
        f"--chromeArg=--disable-features={disabled_features}",
        "--chromeArg=--disable-blink-features=AutomationControlled",
        "--chromeArg=--disable-autofill",
    ]

    viewport_w = os.environ.get("BROWSER_VIEWPORT_WIDTH") or os.environ.get("BROWSER_WIDTH", "1366")
    viewport_h = os.environ.get("BROWSER_VIEWPORT_HEIGHT") or os.environ.get("BROWSER_HEIGHT", "768")
    npx_args.append(f"--chromeArg=--window-size={viewport_w},{viewport_h}")
    npx_args.append(f"--chromeArg=--user-data-dir={os.path.join(PROJECT_ROOT, 'test-result', f'chrome_profile_{int(time.time()*1000)}')}")

    return StdioServerParameters(
        name="Chrome DevTools MCP (Isolated)",
        command="npx",
        args=npx_args,
        env=None,
    )


SERVER_PARAMS = _create_incognito_server_params()


# ============================================================
# 角色定义 (Accessibility Roles)
# ============================================================

INTERACTIVE_ROLES = frozenset({
    "button", "link", "textbox", "input", "combobox", "select",
    "checkbox", "radio", "menuitem", "option", "tab", "spinbutton",
    "treeitem", "slider", "switch",
})

INPUT_ROLES = frozenset({"textbox", "input", "textarea", "combobox", "select", "search"})


# ============================================================
# 默认执行配置
# ============================================================

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
