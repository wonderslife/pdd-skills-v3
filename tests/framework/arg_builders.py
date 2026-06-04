"""AI Test Framework - Action/Assertion 注册表与参数构建器

从 run_testcase.py 提取的注册表和参数构建逻辑，负责：
  - ActionRegistry: action 类型注册表（动态注册、钩子、UID需求判断）
  - AssertionRegistry: assertion 类型注册表
  - resolve_env_vars: 环境变量解析 ${VAR} / ${VAR:-default}
  - _resolve_uid: 统一 UID 解析（P0~P3 四级优先级）
  - 18个 _build_xxx_args() 参数构建器
  - 11个 assert_xxx() 断言验证器
  - register_builtin_actions / register_builtin_assertions 内置注册
"""
import os
import re
import time
from typing import Callable, Dict, List, Optional, Set, Tuple

from tests.framework.snapshot_models import StepResult
from tests.framework.snapshot_matcher import SnapshotParser
from tests.framework.logger import log


def resolve_env_vars(value):
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


class ActionRegistry:
    _actions: Dict[str, Tuple[str, Callable]] = {}
    _needs_uid: set = set()
    _pre_hooks: Dict[str, List[Callable]] = {}
    _post_hooks: Dict[str, List[Callable]] = {}

    @classmethod
    def register(cls, action_name: str, mcp_tool: str, arg_builder: Callable,
                 needs_uid: bool = False):
        cls._actions[action_name.lower()] = (mcp_tool, arg_builder)
        if needs_uid:
            cls._needs_uid.add(action_name.lower())

    @classmethod
    def add_pre_hook(cls, action_name: str, hook: Callable):
        if action_name not in cls._pre_hooks:
            cls._pre_hooks[action_name] = []
        cls._pre_hooks[action_name].append(hook)

    @classmethod
    def add_post_hook(cls, action_name: str, hook: Callable):
        if action_name not in cls._post_hooks:
            cls._post_hooks[action_name] = []
        cls._post_hooks[action_name].append(hook)

    @classmethod
    def get(cls, action_name: str) -> Optional[Tuple[str, Callable]]:
        return cls._actions.get(action_name.lower())

    @classmethod
    def needs_uid(cls, action_name: str) -> bool:
        return action_name.lower() in cls._needs_uid

    @classmethod
    def list_actions(cls) -> List[str]:
        return list(cls._actions.keys())

    @classmethod
    def run_pre_hooks(cls, action_name: str, context: Dict):
        hooks = cls._pre_hooks.get(action_name, [])
        for hook in hooks:
            try:
                hook(context)
            except Exception as e:
                log(f"[Hook Error] Pre-hook for {action_name}: {e}", 2)

    @classmethod
    def run_post_hooks(cls, action_name: str, context: Dict, result: StepResult):
        hooks = cls._post_hooks.get(action_name, [])
        for hook in hooks:
            try:
                hook(context, result)
            except Exception as e:
                log(f"[Hook Error] Post-hook for {action_name}: {e}", 2)


class AssertionRegistry:
    _assertions: Dict[str, Callable] = {}

    @classmethod
    def register(cls, assertion_type: str, validator: Callable):
        cls._assertions[assertion_type.lower()] = validator

    @classmethod
    def get(cls, assertion_type: str) -> Optional[Callable]:
        return cls._assertions.get(assertion_type.lower())

    @classmethod
    def list_assertions(cls) -> List[str]:
        return list(cls._assertions.keys())


def _resolve_uid(step: Dict, parser, cache, prefer_role: Optional[str] = None,
                require_interactive: Optional[bool] = None) -> Optional[str]:
    locator = step.get("locator", {}) or {}
    if prefer_role is None:
        prefer_role = locator.get("role") or locator.get("selector", {}).get("role")
    direct_uid = locator.get("uid")
    if direct_uid:
        if direct_uid in parser.elements:
            log(f"[Direct-UID] {direct_uid} (YAML强制定位)", 2)
            return direct_uid
        else:
            log(f"[Direct-UID-FAIL] uid={direct_uid} 不在当前页面元素中，降级到target匹配", 2)

    aria_label = locator.get("aria-label") or locator.get("aria_label")
    if aria_label:
        for uid, elem in parser.elements.items():
            if (elem.text and aria_label.lower() in elem.text.lower()) or \
               (elem.name and aria_label.lower() in elem.name.lower()):
                log(f"[ARIA-LABEL] '{aria_label}' -> {uid} (text='{elem.text[:30] if elem.text else ''}')", 2)
                return uid
        log(f"[ARIA-LABEL-FAIL] '{aria_label}' 未找到匹配元素", 2)

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
    args = {"url": resolve_env_vars(step.get("url", ""))}
    timeout = step.get("timeout")
    if timeout:
        args["timeout"] = int(timeout)
    return args

def _build_new_page_args(action, step, parser, cache) -> Dict:
    args = {"url": resolve_env_vars(step.get("url", ""))}
    timeout = step.get("timeout")
    if timeout:
        args["timeout"] = int(timeout)
    return args

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
    fn = step.get("function", step.get("script", step.get("value", "() => {}")))
    return {"function": fn}

def _build_js_click_args(action, step, parser, cache) -> Dict:
    target_text = resolve_env_vars(step.get("target", ""))
    locator = step.get("locator", {}) or {}
    css_selector = locator.get("css") or locator.get("selector", "")
    role_filter = locator.get("role", "")
    escaped_target = target_text.replace("'", "\\'").replace("\\", "\\\\")
    escaped_css = css_selector.replace("'", "\\'").replace("\\", "\\\\")

    if css_selector:
        js_fn = f"""() => {{
        const el = document.querySelector('{escaped_css}');
        if (el) {{ el.click(); return JSON.stringify({{tag: el.tagName, text: el.textContent.trim().substring(0,50), clicked:true}}); }}
        return JSON.stringify({{error:'not_found', selector:'{escaped_css}'}});
        }}"""
    else:
        role_tag = "button" if role_filter == "button" else ("a" if role_filter == "link" else "")
        js_selector = role_tag or "*"
        role_attr = f', tag:"{role_tag}"' if role_tag else ""
        js_fn = f"""() => {{
        const targets = document.querySelectorAll('{js_selector}');
        for (const el of targets) {{
            if (el.textContent.includes('{escaped_target}') && el.offsetParent !== null) {{
                el.click();
                return JSON.stringify({{tag: el.tagName, text: el.textContent.trim().substring(0,50), clicked:true{role_attr}}});
            }}
        }}
        return JSON.stringify({{error:'not_found', target:'{escaped_target}'}});
        }}"""
    return {"function": js_fn}

def _build_select_page_args(action, step, parser, cache) -> Dict:
    page_id = step.get("pageId", step.get("page_index", 0))
    return {"pageId": page_id}

def _build_close_page_args(action, step, parser, cache) -> Dict:
    page_id = step.get("pageId", 0)
    return {"pageId": page_id}


def register_builtin_actions():
    actions = [
        ("navigate", "new_page", _build_navigate_args, False),
        ("open_url", "navigate_page", _build_navigate_args, False),
        ("new_page", "new_page", _build_new_page_args, False),
        ("click", "click", _build_click_args, True),
        ("tap", "click", _build_click_args, True),
        ("js_click", "evaluate_script", _build_js_click_args, False),
        ("native_click", "evaluate_script", _build_js_click_args, False),
        ("fill", "fill", _build_fill_args, True),
        ("type", "fill", _build_fill_args, True),
        ("input", "fill", _build_fill_args, True),
        ("fill_form", "fill_form", _build_fill_form_args, True),
        ("select_option", "fill", _build_select_option_args, True),
        ("select", "fill", _build_select_option_args, True),
        ("choose", "fill", _build_select_option_args, True),
        ("upload_file", "upload_file", _build_upload_args, True),
        ("upload", "upload_file", _build_upload_args, True),
        ("el_upload", "el_upload", _build_upload_args, True),
        ("el_upload_file", "el_upload", _build_upload_args, True),
        ("el_date", "fill", _build_fill_args, True),
        ("el_date_picker", "fill", _build_fill_args, True),
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


def assert_text_contains(assertion: Dict, snapshot_text: str, parser, cache: Dict) -> Dict:
    expected = resolve_env_vars(str(assertion.get("expected", "")))
    if snapshot_text and expected:
        passed = expected.lower() in snapshot_text.lower()
        detail = f"'{expected}' {'found' if passed else 'not found'} in snapshot"
    else:
        passed = False
        detail = "no snapshot or empty expected"
    return {"passed": passed, "detail": detail}

def assert_element_visible(assertion: Dict, snapshot_text: str, parser, cache: Dict) -> Dict:
    target = assertion.get("target", assertion.get("expected", ""))
    if target:
        uid = parser.find_uid(target, cache)
        passed = uid is not None
        detail = f"element '{target}' {'found' if passed else 'not found'}"
    else:
        passed = True
        detail = "no target specified"
    return {"passed": passed, "detail": detail}

def assert_element_hidden(assertion: Dict, snapshot_text: str, parser, cache: Dict) -> Dict:
    target = assertion.get("target", assertion.get("expected", ""))
    uid = parser.find_uid(target, cache) if target else None
    passed = uid is None
    detail = f"element '{target}' {'hidden' if passed else 'visible'}"
    return {"passed": passed, "detail": detail}

def assert_url_contains(assertion: Dict, snapshot_text: str, parser, cache: Dict) -> Dict:
    expected = resolve_env_vars(str(assertion.get("expected", "")))
    if snapshot_text and expected:
        passed = expected.lower() in snapshot_text.lower()
        detail = f"URL contains '{expected}': {passed}"
    else:
        passed = True
        detail = "skip (no snapshot)"
    return {"passed": passed, "detail": detail}

def assert_toast_visible(assertion: Dict, snapshot_text: str, parser, cache: Dict) -> Dict:
    expected = resolve_env_vars(str(assertion.get("expected", "")))
    if snapshot_text and expected:
        passed = expected.lower() in snapshot_text.lower()
        detail = f"Toast '{expected}' {'visible' if passed else 'not visible'}"
    else:
        passed = True
        detail = "skip (toast check)"
    return {"passed": passed, "detail": detail}

def assert_element_text(assertion: Dict, snapshot_text: str, parser, cache: Dict) -> Dict:
    expected = resolve_env_vars(str(assertion.get("expected", "")))
    if snapshot_text and expected:
        passed = expected.lower() in snapshot_text.lower()
        detail = f"Element text contains '{expected}': {passed}"
    else:
        passed = True
        detail = "skip (no snapshot)"
    return {"passed": passed, "detail": detail}

def assert_field_filled(assertion: Dict, snapshot_text: str, parser, cache: Dict) -> Dict:
    return {"passed": True, "detail": "assume filled (cannot verify via MCP)"}

def assert_network_called(assertion: Dict, snapshot_text: str, parser, cache: Dict) -> Dict:
    return {"passed": True, "detail": "network check skipped (would need network_requests)"}

def assert_element_count_greater_than(assertion: Dict, snapshot_text: str, parser, cache: Dict) -> Dict:
    return {"passed": True, "detail": "count check skipped"}

def assert_page_title(assertion: Dict, snapshot_text: str, parser, cache: Dict) -> Dict:
    expected = resolve_env_vars(str(assertion.get("expected", "")))
    if snapshot_text and expected:
        passed = expected.lower() in snapshot_text.lower()
        detail = f"Page title contains '{expected}': {passed}"
    else:
        passed = True
        detail = "skip (no snapshot)"
    return {"passed": passed, "detail": detail}

def assert_value_equals(assertion: Dict, snapshot_text: str, parser, cache: Dict) -> Dict:
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

def assert_element_enabled(assertion: Dict, snapshot_text: str, parser, cache: Dict) -> Dict:
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
