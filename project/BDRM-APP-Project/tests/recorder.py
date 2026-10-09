"""
Testcase Recorder v2.0 - 交互式标注录制器
==============================================
从"全自动录制"升级为"人机协作标注"模式。

核心理念:
  - 录制负责"捕捉鼠标/键盘事件"
  - 人类负责"理解业务语义"
  - 重要节点弹出标注，普通操作自动处理

v2.0 变更 (重大重构):
  ✨ 新增: 智能节点检测算法
  ✨ 新增: 交互式标注界面 (控制台)
  ✨ 新增: 业务语义模板库
  ✨ 改进: 步骤编号连续无跳跃
  ✨ 改进: target 描述更准确

用法:
  python tests/testcase-ai.py --record [output.yaml]
  python tests/testcase-ai.py --record-annotate [output.yaml]  # 强制标注模式
"""

import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
import time
import tempfile
from typing import Any, Dict, List, Optional, Tuple

import yaml
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


# ============================================================
# 常量定义
# ============================================================

IMPORTANT_NODE_PATTERNS = {
    "submit": ["登录", "login", "submit", "确定", "确认", "提交", "保存", "申请",
              "下一步", "next", "完成", "finish", "发送", "send"],
    "navigate": ["菜单", "menu", "首页", "home", "返回", "back", "退出", "logout",
                "切换", "switch", "tab"],
    "page_change": [],
}

MEANINGLESS_TARGETS = {"IMG", "SVG", "PATH", "I", "SPAN", "DIV", "A",
                       "BUTTON", "INPUT", "FORM", "SECTION", "ARTICLE",
                       "HEADER", "FOOTER", "NAV", "MAIN", "ASIDE"}

BUSINESS_TEMPLATES = {
    "login": {"desc": "登录系统", "action": "click", "category": "认证"},
    "submit_form": {"desc": "提交表单", "action": "click", "category": "数据操作"},
    "navigate_menu": {"desc": "导航到菜单", "action": "click", "category": "导航"},
    "search_query": {"desc": "执行查询", "action": "click", "category": "查询"},
    "new_tab": {"desc": "打开新标签页", "action": "switch_page", "category": "导航"},
    "fill_field": {"desc": "填写字段", "action": "fill", "category": "数据输入"},
    "select_option": {"desc": "选择选项", "action": "select_option", "category": "选择"},
}


def _find_chrome_executable() -> str:
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expanduser(r"~\AppData\Local\Google\Chrome\Application\chrome.exe"),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return shutil.which("chrome") or "chrome"


def _launch_chrome_with_flags(port: int = 9222) -> subprocess.Popen:
    chrome_exe = _find_chrome_executable()
    user_data_dir = tempfile.mkdtemp(prefix="chrome_mcp_")
    args = [
        chrome_exe, f"--remote-debugging-port={port}", "--incognito",
        "--no-first-run", "--no-default-browser-check", "--disable-default-apps",
        "--disable-sync", "--disable-extensions",
        "--disable-component-extensions-with-background-pages", "--disable-popup-blocking",
        "--ignore-certificate-errors", "--ignore-certificate-errors-spki-list",
        "--disable-web-security", "--allow-running-insecure-content",
        "--unsafely-treat-insecure-origin-as-secure", "--window-size=1920,1080",
        f"--user-data-dir={user_data_dir}", "--about:blank",
    ]
    proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2)
    return proc


def _create_incognito_server_params() -> StdioServerParameters:
    npx_args = ["-y", "chrome-devtools-mcp@latest", "--browser-url=http://127.0.0.1:9222"]
    return StdioServerParameters(name="Chrome DevTools MCP (Connected)", command="npx", args=npx_args, env=None)


SERVER_PARAMS = _create_incognito_server_params()
_global_chrome_process: Optional[subprocess.Popen] = None


def _extract_text(result) -> str:
    parts = []
    if hasattr(result, 'content') and result.content:
        for item in result.content:
            if hasattr(item, 'text'):
                raw = item.text
                code_block = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', raw, re.DOTALL)
                if code_block: parts.append(code_block.group(1).strip())
                else: parts.append(raw)
            else: parts.append(str(item))
    return "".join(parts)


async def _call(session: ClientSession, tool: str, kwargs: dict = None) -> Any:
    raw = await session.call_tool(tool, kwargs or {})
    text = _extract_text(raw)
    if not text or not text.strip(): return None
    try: return json.loads(text)
    except (json.JSONDecodeError, TypeError): return text


RECORDER_JS = r"""() => {
  if (window.__recorder) { return { ok: false, message: 'Already running', count: window.__recorder.events.length }; }
  window.__recorder = { events: [], start: Date.now(), version: '2.0' };
  function capture(e, extra) {
    const t = e.target; const tag = t.tagName; const role = t.getAttribute('role') || '';
    let desc = ''; const ph = t.placeholder || ''; const name = t.name || ''; const id = t.id || '';
    const val = (t.value || '').slice(0, 100); const href = t.href || ''; const cls = (t.className || '').toString();
    desc = ph || name || id || '';
    if (tag === 'IMG' && !desc) { desc = t.alt || t.title || (t.src || '').split('/').pop().replace(/\.[^.]+$/, '') || ''; }
    if ((tag === 'A' || role === 'link') && !desc && href) { desc = (t.textContent || '').trim().slice(0, 50) || href.slice(0, 50); }
    if ((tag === 'BUTTON' || role === 'button') && !desc) { desc = (t.textContent || '').trim().slice(0, 50) || (t.value || '').slice(0, 50); }
    const isSelect = (tag === 'SELECT' || cls.includes('el-select') || t.closest('.el-select') !== null || role === 'listbox' || role === 'option');
    let selectedText = '';
    if (isSelect && tag === 'SELECT') { selectedText = t.options[t.selectedIndex]?.text || ''; } else if (isSelect) { selectedText = (t.textContent || '').trim().slice(0, 80); }
    window.__recorder.events.push({ type: extra.type || e.type, ts: Date.now(), tag, desc: desc || (t.textContent || '').trim().slice(0, 50), value: val, isSelect, selectedText, url: location.href, ...extra });
  }
  document.addEventListener('click', (e) => capture(e, { type: 'click' }), true);
  document.addEventListener('input', (e) => capture(e, { type: 'input' }), true);
  document.addEventListener('change', (e) => capture(e, { type: 'change' }), true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter') capture(e, { type: 'enter' }); }, true);
  return { ok: true, message: 'Recorder v2.0 started', url: location.href };
}"""

POLL_JS = r"""() => {
  if (!window.__recorder) return { ok: false, error: 'not_found' };
  const evts = window.__recorder.events; const result = [...evts]; window.__recorder.events = [];
  return { ok: true, elapsed: Math.round((Date.now() - window.__recorder.start) / 1000), events: result };
}"""

STOP_JS = r"""() => {
  if (!window.__recorder) return { ok: false, events: [] };
  const all = window.__recorder.events; window.__recorder = null;
  return { ok: true, totalEvents: all.length, events: all };
}"""


class NodeClassifier:
    @staticmethod
    def classify(evt: Dict) -> Tuple[str, str]:
        etype = evt.get("type", ""); desc = evt.get("desc", "").lower(); tag = evt.get("tag", "").upper()
        if etype == "click":
            if tag in MEANINGLESS_TARGETS and not desc:
                has_info = any([evt.get("imgAlt"), evt.get("imgTitle"), evt.get("selectedText"), evt.get("value")])
                if not has_info: return ("skip", "meaningless_click")
        if etype in ("click", "enter"):
            if any(kw in desc for kw in IMPORTANT_NODE_PATTERNS["submit"]): return ("important", "submit")
        if etype == "click":
            if any(kw in desc for kw in IMPORTANT_NODE_PATTERNS["navigate"]): return ("important", "navigate")
        if evt.get("isSelect") and evt.get("selectedText"): return ("semi_auto", "select")
        if etype in ("input", "change"):
            if evt.get("value"): return ("auto", "fill")
        if etype == "click" and desc: return ("auto", "click")
        return ("skip", "unknown")


class InteractiveAnnotator:
    def __init__(self, force_annotate: bool = False):
        self.force_annotate = force_annotate; self.annotation_count = 0

    def should_annotate(self, category: str, sub_type: str) -> bool:
        if self.force_annotate: return True
        return category in ("important",)

    async def annotate(self, step_num: int, step: Dict, category: str, sub_type: str) -> Dict:
        self.annotation_count += 1
        action = step.get("action", ""); desc = step.get("desc", "")
        target = step.get("target", "") or step.get("desc", "")
        print(f"\n{'─' * 50}\n  📝 步骤 #{step_num} 需要标注\n{'─' * 50}")
        print(f"  检测到的操作: [{action}] {desc}\n  目标元素: {target}\n")
        templates = self._get_relevant_templates(sub_type, target)
        print(f"  可选业务模板:")
        for i, (key, tmpl) in enumerate(templates.items(), 1): print(f"    [{i}] {tmpl['desc']} ({tmpl['category']})")
        print(f"    [c] 自定义描述\n    [s] 跳过此步骤\n    [d] 使用默认 (保持原样)\n")
        choice = input(f"  请选择 [1-{len(templates)}/c/s/d] (默认d): ").strip().lower() or "d"
        enhanced = dict(step)
        if choice == "s": return None
        elif choice == "c":
            custom_desc = input(f"  请输入业务描述: ").strip()
            if custom_desc: enhanced["desc"] = custom_desc; enhanced["_business_desc"] = custom_desc
        elif choice.isdigit():
            idx = int(choice) - 1; keys = list(templates.keys())
            if 0 <= idx < len(keys):
                selected_key = keys[idx]; tmpl = templates[selected_key]
                enhanced["desc"] = tmpl["desc"]; enhanced["_business_type"] = selected_key; enhanced["_category"] = tmpl["category"]
                if selected_key == "login":
                    enhanced["wait_after"] = {"type": "time", "duration": 3000}
                    enhanced["assertion"] = {"type": "url_contains", "expected": "", "confidence": "high", "note": "登录后预期URL特征"}
                elif selected_key == "submit_form":
                    enhanced["wait_after"] = {"type": "time", "duration": 2000}
                    enhanced["assertions"] = [{"type": "toast_visible", "expected": "", "confidence": "high"}, {"type": "network_called", "url_pattern": "/api/*", "method": "POST", "response_code": 200}]
        print()
        return enhanced

    def _get_relevant_templates(self, sub_type: str, target: str) -> Dict:
        relevant = {}; target_lower = target.lower()
        if any(kw in target_lower for kw in ["登录", "login"]): relevant["login"] = BUSINESS_TEMPLATES["login"]
        if any(kw in target_lower for kw in ["提交", "保存", "申请", "确定", "确认"]): relevant["submit_form"] = BUSINESS_TEMPLATES["submit_form"]
        if any(kw in target_lower for kw in ["查询", "搜索", "search"]): relevant["search_query"] = BUSINESS_TEMPLATES["search_query"]
        if any(kw in target_lower for kw in ["菜单", "menu", "首页", "home"]): relevant["navigate_menu"] = BUSINESS_TEMPLATES["navigate_menu"]
        if sub_type == "fill" and "fill_field" not in relevant: relevant["fill_field"] = BUSINESS_TEMPLATES["fill_field"]
        if sub_type == "select" and "select_option" not in relevant: relevant["select_option"] = BUSINESS_TEMPLATES["select_option"]
        if sub_type == "navigate" and "navigate_menu" not in relevant: relevant["navigate_menu"] = BUSINESS_TEMPLATES["navigate_menu"]
        if not relevant: relevant["generic"] = {"desc": f"{target}", "action": "click", "category": "其他"}
        return relevant


def _event_to_step(evt: Dict, step_num: int) -> Optional[Dict]:
    etype = evt.get("type", ""); desc = evt.get("desc", "") or ""
    is_select = evt.get("isSelect", False); selected_text = evt.get("selectedText", "")
    value = evt.get("value", ""); tag = evt.get("tag", "").upper()
    if etype == "click":
        target = desc or f"{tag}"
        if tag in MEANINGLESS_TARGETS and not desc and not evt.get("imgAlt"): return None
        if len(target) > 60: target = target[:57] + "..."
        step = {"step": step_num, "desc": f"点击'{target}'", "action": "click", "target": target}
        return step
    elif etype in ("input", "change"):
        if not value: return None
        target = desc or f"字段{step_num}"
        if is_select and selected_text: return {"step": step_num, "desc": f"选择'{selected_text}'", "action": "select_option", "target": target, "option": selected_text}
        if value.replace(".", "").replace("-", "").isdigit():
            return {"step": step_num, "desc": f"填写数值'{value}'到{target}", "action": "fill", "target": target, "value": value}
        return {"step": step_num, "desc": f"填写'{target}'为'{value}'", "action": "fill", "target": target, "value": value}
    elif etype == "navigate":
        return {"step": step_num, "desc": f"页面导航至 '{evt.get('url', '')[:50]}'", "action": "navigate", "url": evt.get("url", ""), "wait_after": {"type": "time", "duration": 2000}}
    return None


def _merge_input_events(steps: List[Dict]) -> List[Dict]:
    merged = []; i = 0
    while i < len(steps):
        s = steps[i]
        if s.get("action") in ("input", "change", "fill") and s.get("value"):
            last_val = s["value"]; last_target = s["target"]; j = i + 1
            while j < len(steps):
                nxt = steps[j]
                if (nxt.get("action") in ("input", "change", "fill") and nxt.get("target") == last_target and nxt.get("value")):
                    last_val = nxt["value"]; j += 1
                else: break
            merged.append({**s, "value": last_val}); i = j
        else: merged.append(s); i += 1
    return merged


def _enrich_steps(steps: List[Dict]) -> List[Dict]:
    enriched = []
    for s in steps:
        action = s.get("action", ""); step_copy = dict(s)
        if action in ("fill", "click", "select_option"):
            target = s.get("target", "")
            safe_key = re.sub(r'[^a-zA-Z0-9]', '_', target).lower().strip('_') or f"step_{s['step']}"
            step_copy["locator"] = {"uid_cache_key": f"{action}_{safe_key}"}
        if "assertion" not in step_copy and "assertions" not in step_copy:
            if action == "fill":
                target_lower = s.get("target", "").lower()
                if any(kw in target_lower for kw in ("密码", "password", "pass")): step_copy["isSensitive"] = True
                step_copy["assertion"] = {"type": "field_filled", "expected": "已填写", "confidence": "high"}
            elif action == "select_option": step_copy["assertion"] = {"type": "element_text", "expected": s.get("option", ""), "confidence": "high"}
            elif action == "click": step_copy["assertion"] = {"type": "element_visible", "expected": "", "confidence": "medium", "note": "请验证"}
            elif action == "navigate": step_copy["assertion"] = {"type": "text_contains", "expected": "", "confidence": "high", "note": "页面特征"}
        for key in list(step_copy.keys()):
            if key.startswith("_"): del step_copy[key]
        enriched.append(step_copy)
    return enriched


async def run_record_mode(output_path: str, force_annotate: bool = False):
    def log(msg: str): print(msg, flush=True)
    log("=" * 60); log("  Testcase Recorder v2.0"); log("  模式: 交互式标注录制"); log("=" * 60)
    global _global_chrome_process
    log("\n[0/5] 启动 Chrome Incognito...")
    _global_chrome_process = _launch_chrome_with_flags(port=9222)
    if _global_chrome_process and _global_chrome_process.poll() is None: log(f"       Chrome 已启动 (PID: {_global_chrome_process.pid})")
    else: log("       [WARN] Chrome 启动失败")
    annotator = InteractiveAnnotator(force_annotate=force_annotate)
    try:
        async with stdio_client(SERVER_PARAMS) as (_read, _write):
            async with ClientSession(_read, _write) as session:
                await session.initialize(); log("\n[1/5] Browser connected... OK")
                current_url = await _prepare_page(session, log)
                if not current_url: return
                inject_data = await _call(session, "evaluate_script", {"function": RECORDER_JS})
                if isinstance(inject_data, dict) and inject_data.get("ok"): log("[2/5] Event listeners injected... OK")
                log("\n+--------------------------------------------------+\n|  🎬 录制中...                                       |\n|  📌 重要操作时会弹出标注提示                           |\n|  ⌨️  Ctrl+C 结束录制                                  |\n+--------------------------------------------------\n")
                all_events: List[Dict] = []; step_num = 0; poll_count = 0; consecutive_errors = 0; MAX_ERRORS = 5
                log("[3/5] Recording...\n")
                try:
                    while True:
                        await asyncio.sleep(1.5); poll_count += 1
                        data = await _call(session, "evaluate_script", {"function": POLL_JS})
                        if data is None:
                            if poll_count % 10 == 0: log(f"   [poll#{poll_count}] (无响应)")
                            consecutive_errors += 1
                            if consecutive_errors >= MAX_ERRORS: log("\n   [!] 连接可能丢失"); break
                            continue
                        consecutive_errors = 0
                        if not isinstance(data, dict) or not data.get("ok"):
                            if poll_count % 20 == 0: log(f"   [poll#{poll_count}] Error: {data.get('error','?') if isinstance(data,dict) else '?'}")
                            continue
                        evts = data.get("events", [])
                        if evts:
                            for evt in evts:
                                raw_step = _event_to_step(evt, step_num + 1)
                                if not raw_step: continue
                                category, sub_type = NodeClassifier.classify(evt)
                                if category == "skip": log(f"   [-] 跳过: {raw_step.get('desc', '?')[:40]}"); continue
                                step_num += 1; raw_step["step"] = step_num
                                if annotator.should_annotate(category, sub_type):
                                    annotated = await annotator.annotate(step_num, raw_step, category, sub_type)
                                    if annotated is None: log(f"   [{step_num:02d}] ⏭️  用户跳过"); step_num -= 1; continue
                                    final_step = annotated; log(f"   [{step_num:02d}] ✅ 已标注: {final_step.get('desc', '?')}")
                                else:
                                    final_step = raw_step
                                    icon = {"click": "[click]", "fill": "[fill]", "select": "[sel]", "nav": "[nav]"}.get(final_step["action"], "[act]")
                                    val = f" = '{final_step.get('value', '')}'" if final_step.get("value") else ""
                                    opt = f" → {final_step.get('option', '')}" if final_step.get("option") else ""
                                    log(f"   [{step_num:02d}] {icon} {final_step['desc']}{val}{opt}")
                                all_events.append(final_step)
                        elif poll_count % 15 == 0: log(f"   [poll#{poll_count}] ... ({data.get('elapsed','?')}s)")
                except (KeyboardInterrupt, asyncio.CancelledError): log("\n\n[4/5] Recording stopped by user")
                final_data = await _call(session, "evaluate_script", {"function": STOP_JS})
                if isinstance(final_data, dict) and final_data.get("events"):
                    for evt in final_data["events"]:
                        step_num += 1; step = _event_to_step(evt, step_num)
                        if step: step["step"] = step_num; all_events.append(step)
                log(f"\n       Captured: {len(all_events)} steps")
                if not all_events: log("[WARN] No operations captured."); return
                merged = _merge_input_events(all_events); final_steps = _enrich_steps(merged)
                nav_step = {"step": 1, "desc": "打开目标页面", "action": "navigate", "url": current_url, "wait_after": {"type": "time", "duration": 2000}, "assertion": {"type": "text_contains", "expected": "", "confidence": "high", "note": "页面标题或关键文本"}}
                for s in final_steps: s["step"] = s["step"] + 1
                final_steps.insert(0, nav_step)
                log(f"       Final: {len(final_steps)} steps\n")
                base_url = ""; parts = current_url.split("/") if "://" in current_url else []
                if len(parts) >= 3: base_url = parts[0] + "//" + parts[2]
                yaml_data = {"test_id": f"REC-{int(time.time())}-annotated", "title": f"交互式标注测试用例 - {os.path.basename(output_path)}", "priority": "P1", "tags": ["recorded", "annotated", "v2.0"], "author": "Testcase Recorder v2.0 (Interactive)", "context_check": {"login_url": base_url, "home_indicator": "", "credentials": {"username": "${TEST_USER}", "password": "${TEST_PASS}"}, "captcha_required": False}, "steps": final_steps, "teardown": [{"action": "screenshot", "name": "result-{timestamp}.png", "fullPage": True}], "metadata": {"created_by": "testcase-recorder v2.0", "annotation_count": annotator.annotation_count, "total_steps": len(final_steps), "note": "使用交互式标注模式生成，重要节点已由人工确认"}}
                out_dir = os.path.dirname(output_path); os.makedirs(out_dir, exist_ok=True)
                with open(output_path, 'w', encoding='utf-8') as f: yaml.dump(yaml_data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
                log(f"   OK  YAML: {output_path}")
                env_path = output_path.rsplit('.', 1)[0] + ".env"; extracted_env: Dict[str, str] = {}
                for s in final_steps:
                    val = s.get("value", ""); target = s.get("target", "").lower()
                    if not val or "${" in val: continue
                    if any(kw in target for kw in ("用户名", "username")): extracted_env["TEST_USER"] = val
                    elif any(kw in target for kw in ("密码", "password")): extracted_env["TEST_PASS"] = val
                with open(env_path, 'w', encoding='utf-8') as f:
                    f.write(f"# Generated by Testcase Recorder v2.0 at {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
                    for k, v in sorted(extracted_env.items()): f.write(f"{k}={v}\n")
                log(f"   OK  ENV:  {env_path}")
                log(f"\n{'=' * 50}\nRecording complete!\n   Steps  : {len(final_steps)}\n   Annotated: {annotator.annotation_count} nodes\n   Output :\n     - {output_path}\n     - {env_path}")
    except Exception as e: log(f"\n[FATAL] {type(e).__name__}: {e}"); import traceback; traceback.print_exc()
    finally:
        if _global_chrome_process and _global_chrome_process.poll() is None:
            log("\n[清理] 关闭 Chrome..."); _global_chrome_process.terminate()


async def _prepare_page(session: ClientSession, log) -> Optional[str]:
    pages_raw = await session.call_tool("list_pages", {})
    pages_text = _extract_text(pages_raw)
    pages_data = json.loads(pages_text) if isinstance(pages_text, str) else (pages_text if isinstance(pages_text, list) else None)
    current_url = "about:blank"
    if isinstance(pages_data, list) and len(pages_data) > 0:
        for p in pages_data:
            if isinstance(p, dict):
                url = p.get("url", ""); title = p.get("title", "") or url; pid = p.get("pageId", 0)
                is_blank = "about:blank" in url; log(f"       Tab[{pid}] {title}{' ← 当前' if is_blank else ''}")
                if not is_blank and url.startswith("http"): current_url = url
    if current_url == "about:blank":
        target_url = input("\n       [!] 当前空白页，请输入目标 URL\n       URL> ").strip()
        if target_url:
            if not target_url.startswith(("http://", "https://")): target_url = "http://" + target_url
            log(f"\n       导航至: {target_url}")
            await _call(session, "evaluate_script", {"function": f"() => {{ location.href = '{target_url}'; return location.href; }}"})
            log("       等待加载..."); await asyncio.sleep(3)
            check = await _call(session, "evaluate_script", {"function": "() => location.href"})
            if isinstance(check, str): current_url = check
    verify = await _call(session, "evaluate_script", {"function": "() => location.href"})
    if isinstance(verify, str): current_url = verify
    log(f"\n[1/5] Target: {current_url}"); return current_url


__all__ = ["run_record_mode"]
