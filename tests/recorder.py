"""
Testcase Recorder v1.1 - 交互式浏览器操作录制器
==============================================
从 testcase-ai.py 中提取的独立录制模块，遵循 SRP 原则。

v1.1 修复:
  - 修复 about:blank 注入问题（先导航到目标页面）
  - 修复 Enter 无法停止问题（改用 Ctrl+C）
  - 修复 MCP 返回值 Markdown 包裹解析问题

用法:
  python tests/testcase-ai.py --record [output.yaml]
"""

import asyncio
import json
import os
import re
import sys
import time
import tempfile
from typing import Any, Dict, List, Optional

import yaml
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


def _create_incognito_server_params() -> StdioServerParameters:
    """创建使用隐私模式 Chrome 的 MCP 连接参数

    chrome-devtools-mcp 通过 --chromeArg=VALUE 格式传递额外 Chrome 启动参数
    参考: https://github.com/ChromeDevTools/chrome-devtools-mcp/pull/338

    正确格式: --chromeArg=--incognito (不是 --chromeArg --incognito)
    """
    npx_args = [
        "-y", "chrome-devtools-mcp@latest",
        "--isolated",                    # 使用临时用户数据目录（类似 Incognito）
        "--chromeArg=--incognito",       # 隐私模式
        "--chromeArg=--no-first-run",
        "--chromeArg=--no-default-browser-check",
        "--chromeArg=--disable-sync",
        "--chromeArg=--disable-extensions",
        "--chromeArg=--window-size=1920,1080",
    ]

    return StdioServerParameters(
        name="Chrome DevTools MCP (Incognito)",
        command="npx",
        args=npx_args,
        env=None,
    )


SERVER_PARAMS = _create_incognito_server_params()


def _extract_text(result) -> str:
    """从 CallToolResult 提取文本，剥离 Markdown ```json ... ``` 包裹"""
    parts = []
    if hasattr(result, 'content') and result.content:
        for item in result.content:
            if hasattr(item, 'text'):
                raw = item.text
                code_block = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', raw, re.DOTALL)
                if code_block:
                    parts.append(code_block.group(1).strip())
                else:
                    parts.append(raw)
            else:
                parts.append(str(item))
    return "".join(parts)


async def _call(session: ClientSession, tool: str, kwargs: dict = None) -> Any:
    """MCP 调用，返回提取后的文本或原始结果"""
    raw = await session.call_tool(tool, kwargs or {})
    text = _extract_text(raw)
    if not text or not text.strip():
        return None
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return text


# ============================================================
# JS 注入脚本
# ============================================================

RECORDER_JS = r"""() => {
  if (window.__recorder) {
    return { ok: false, message: 'Already running', count: window.__recorder.events.length };
  }
  window.__recorder = { events: [], start: Date.now(), version: '1.1' };

  function capture(e, extra) {
    const t = e.target;
    window.__recorder.events.push({
      type: extra.type || e.type,
      ts: Date.now(),
      tag: t.tagName,
      id: t.id || '',
      cls: (t.className || '').toString().slice(0, 60),
      text: (t.textContent || '').trim().slice(0, 80),
      ph: t.placeholder || '',
      role: t.getAttribute('role') || '',
      val: (t.value || '').slice(0, 100),
      href: t.href || '',
      name: t.name || '',
      url: location.href,
      ...extra
    });
  }

  document.addEventListener('click', (e) => capture(e, { type: 'click' }), true);
  document.addEventListener('input', (e) => capture(e, { type: 'input' }), true);
  document.addEventListener('change', (e) => capture(e, { type: 'change' }), true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') capture(e, { type: 'enter' });
  }, true);

  const origPush = history.pushState;
  history.pushState = function() {
    window.__recorder.events.push({ type: 'navigate', ts: Date.now(), url: arguments[2] || location.href });
    return origPush.apply(this, arguments);
  };

  return { ok: true, message: 'Recorder started', url: location.href };
}"""

POLL_JS = r"""() => {
  if (!window.__recorder) return { ok: false, error: 'not_found' };
  const evts = window.__recorder.events;
  const result = [...evts];
  window.__recorder.events = [];
  return { ok: true, elapsed: Math.round((Date.now() - window.__recorder.start) / 1000), events: result };
}"""

STOP_JS = r"""() => {
  if (!window.__recorder) return { ok: false, events: [] };
  const all = window.__recorder.events;
  window.__recorder = null;
  return { ok: true, totalEvents: all.length, events: all };
}"""


def _event_to_step(evt: Dict, step_num: int) -> Optional[Dict]:
    etype = evt.get("type", "")
    if etype == "click":
        text = evt.get("text", "") or ""
        ph = evt.get("ph", "") or ""
        href = evt.get("href", "")
        tag = evt.get("tag", "")
        target = ph or text or href or f"{tag}"
        if len(target) > 50: target = target[:47] + "..."
        step = {"step": step_num, "desc": f"点击'{target}'", "action": "click", "target": target}
        if href and href.startswith("http"): step["wait_after"] = {"type": "navigation", "timeout": 8000}
        return step
    elif etype in ("input", "change"):
        val = evt.get("val", "")
        ph = evt.get("ph", "") or ""
        target = ph or evt.get("name") or f"{evt.get('tag','')}"
        if not val: return None
        step = {"step": step_num, "desc": f"填写'{target}'为'{val}'", "action": "fill", "target": target, "value": val}
        if val.replace(".", "").replace("-", "").isdigit(): step["desc"] = f"填写数值'{val}'到{target}"
        return step
    elif etype == "navigate":
        return {"step": step_num, "desc": f"导航至 '{evt.get('url', '')}'", "action": "navigate",
                "url": evt.get("url", ""), "wait_after": {"type": "time", "duration": 2000}}
    return None


def _merge_input_events(steps: List[Dict]) -> List[Dict]:
    """合并同一目标上的连续 input 事件为一步（只保留最终值）

    例如用户输入 'qikun' 会产生 5 个 input 事件：
      q → qi → qik → qiku → qikun
    合并后只保留最后一个：fill 'qikun'
    """
    merged = []
    i = 0
    while i < len(steps):
        s = steps[i]
        if s.get("action") in ("input", "change", "fill") and s.get("value"):
            last_val = s["value"]
            last_target = s["target"]
            j = i + 1
            while j < len(steps):
                nxt = steps[j]
                if (nxt.get("action") in ("input", "change", "fill")
                        and nxt.get("target") == last_target
                        and nxt.get("value")):
                    last_val = nxt["value"]
                    j += 1
                else:
                    break
            merged.append({**s, "value": last_val,
                           "desc": f"填写'{last_target}'为'{last_val}'"})
            i = j
        else:
            merged.append(s)
            i += 1
    return merged


def _prepend_navigate_step(steps: List[Dict], nav_url: str) -> List[Dict]:
    """在步骤列表前插入 navigate 步骤，后续步骤编号顺延"""
    if not nav_url or "about:blank" in nav_url:
        return steps
    nav_step = {
        "step": 1,
        "desc": f"打开目标页面",
        "action": "navigate",
        "url": nav_url,
        "wait_after": {"type": "time", "duration": 2000},
    }
    renumbered = [nav_step]
    for s in steps:
        renumbered.append({**s, "step": s["step"] + 1})
    return renumbered


async def run_record_mode(output_path: str):
    """
    交互式录制模式 — 使用 Ctrl+C 停止（不是 Enter）

    流程:
      1. 连接 Chrome DevTools MCP
      2. 导航到目标页面（避免 about:blank）
      3. 注入 JS 事件监听器
      4. 轮询捕获操作，实时显示步骤
      5. 按 Ctrl+C 停止 → 生成 YAML + .env
    """

    def log(msg: str):
        print(msg, flush=True)

    log("=" * 60)
    log("  Testcase Recorder v1.4")
    log("  模式: Chrome Incognito (隐私模式)")
    log("  停止方式: 按 Ctrl+C (不是 Enter)")
    log("=" * 60)

    async with stdio_client(SERVER_PARAMS) as (_read, _write):
        async with ClientSession(_read, _write) as session:
            await session.initialize()
            log("\n[1/4] Browser connected... OK")

            # ===== 验证 Incognito 模式 =====
            check_incognito = await _call(session, "evaluate_script", {
                "function": "() => ({"
                "  isIncognito: !!(window.chrome && window.chrome.runtime && window.chrome.runtime.id === undefined"
                "    && (navigator.webdriver || false)),"
                "  hasIncognitoUI: document.querySelector('.incognito-icon') !== null,"
                "  storageEstimate: typeof navigator.storage?.estimate === 'function',"
                "})"
            })
            if isinstance(check_incognito, dict):
                log(f"       Incognito 检测: {json.dumps(check_incognito, ensure_ascii=False)[:120]}")
                if not check_incognito.get("storageEstimate"):
                    log("       ✓ 可能是 Incognito 模式（无持久化存储）")
                else:
                    log("       ⚠ 检测到持久化存储，可能非 Incognito")
            log("")

            # ===== 列出页面 =====
            pages_raw = await session.call_tool("list_pages", {})
            pages_text = _extract_text(pages_raw)
            log(f"\n       [DEBUG] list_pages 原始返回: {str(pages_text)[:200]}")

            pages_data = None
            if pages_text:
                try:
                    parsed = json.loads(pages_text) if isinstance(pages_text, str) else pages_text
                    if isinstance(parsed, list):
                        pages_data = parsed
                    elif isinstance(parsed, dict):
                        if "pages" in parsed:
                            pages_data = parsed["pages"]
                        elif "result" in parsed:
                            pages_data = parsed["result"]
                        else:
                            pages_data = [parsed]
                except (json.JSONDecodeError, TypeError):
                    log(f"       [DEBUG] 无法解析为JSON: {type(pages_text)}")

            log(f"\n       Open tabs:")
            current_url = "about:blank"
            if isinstance(pages_data, list) and len(pages_data) > 0:
                for i, p in enumerate(pages_data):
                    if not isinstance(p, dict):
                        log(f"         [{i}] {p} (非字典格式)")
                        continue
                    url = p.get("url", "") or ""
                    title = p.get("title", "") or url or f"Tab {i}"
                    pid = p.get("pageId", i)
                    is_blank = "about:blank" in url
                    marker = "" if not is_blank else " ← 当前选中(空白!)"
                    log(f"         [{i}] {title}{marker} (id={pid})")
                    if not is_blank:
                        current_url = url
            else:
                log(f"         (无法列出页面, 类型: {type(pages_data).__name__})")

            # ===== 尝试选择非空白页或导航 =====
            if current_url == "about:blank":
                log("\n       [WARN] 当前是空白页！尝试自动切换...")
                if isinstance(pages_data, list) and len(pages_data) > 1:
                    for p in reversed(pages_data):
                        url = p.get("url", "") or ""
                        if "about:blank" not in url and url.startswith("http"):
                            pid = p.get("pageId")
                            log(f"       切换到: {url}")
                            await session.call_tool("select_page", {"pageId": pid})
                            await asyncio.sleep(1)
                            current_url = url
                            break

            if current_url == "about:blank":
                log("\n       [!] 当前是空白页。请选择操作：")
                log("       [1] 手动输入目标 URL 进行导航")
                log("       [2] 列出所有标签页并选择")
                choice = input("       选择 (1/2, 默认1): ").strip() or "1"

                if choice == "2":
                    if isinstance(pages_data, list) and len(pages_data) > 0:
                        log("\n       可用标签页:")
                        for i, p in enumerate(pages_data):
                            url = p.get("url", "") or "(未知)"
                            title = p.get("title", "") or f"Tab {i}"
                            pid = p.get("pageId", i)
                            log(f"         [{i}] {title} - {url} (id={pid})")

                        try:
                            idx = int(input("\n       选择标签页编号: ").strip())
                            if 0 <= idx < len(pages_data):
                                selected = pages_data[idx]
                                pid = selected.get("pageId", idx)
                                url = selected.get("url", "") or ""
                                log(f"\n       切换到标签 [{idx}]...")
                                await session.call_tool("select_page", {"pageId": pid})
                                await asyncio.sleep(1)
                                current_url = url
                            else:
                                log("       [!] 无效编号")
                        except ValueError:
                            log("       [!] 请输入数字")
                    else:
                        log("       [!] 没有可用的标签页")
                else:
                    target_url = input("       输入目标 URL (如 uniportal.sjjk.com.cn): ").strip()
                    if target_url:
                        if not target_url.startswith("http"):
                            protocol = input("       使用协议 [1]http 或 [2]https? (默认1/http): ").strip() or "1"
                            prefix = "https://" if protocol == "2" else "http://"
                            target_url = prefix + target_url
                            log(f"       使用协议: {prefix.rstrip('://')}")

                        log(f"\n       正在导航至: {target_url}")
                        log("       (等待页面加载...)")
                        nav_result = await session.call_tool("navigate_page", {
                            "url": target_url,
                            "timeout": 15000,
                            "type": "url"
                        })
                        log(f"       导航结果: {_extract_text(nav_result)[:100]}")

                        log("       等待页面稳定...")
                        await asyncio.sleep(3)

                        for wait_attempt in range(5):
                            await asyncio.sleep(1)
                            verify_url = await _call(session, "evaluate_script", {
                                "function": "() => ({href: location.href, ready: document.readyState, title: document.title})"
                            })
                            log(f"       检查 #{wait_attempt+1}: readyState={verify_url.get('ready','?')}, url={str(verify_url.get('href',''))[:60]}")

                            if isinstance(verify_url, dict):
                                actual_url = verify_url.get("href", "")
                                ready = verify_url.get("ready", "")
                                if actual_url and "about:blank" not in actual_url and ready in ("complete", "interactive"):
                                    current_url = actual_url
                                    log(f"       ✓ 页面已加载: {actual_url[:80]}")
                                    break
                                elif wait_attempt == 4:
                                    current_url = actual_url or target_url
                                    log(f"       ⚠ 超时，使用当前URL: {current_url[:80]}")

            # ===== 确认当前页面并注入 =====
            check_url = await _call(session, "evaluate_script", {"function": "() => location.href"})
            if isinstance(check_url, str):
                current_url = check_url
            log(f"\n[1/4] Target page: {current_url}")

            inject_data = await _call(session, "evaluate_script", {"function": RECORDER_JS})

            if isinstance(inject_data, dict) and inject_data.get("ok"):
                log("[2/4] Event listeners injected... OK")
                inject_url = inject_data.get("url", current_url)
                if inject_url != current_url:
                    log(f"       (JS 确认 URL: {inject_url})")
            elif isinstance(inject_data, dict) and inject_data.get("message") == "Already running":
                log(f"[2/4] Recorder already running ({inject_data.get('count')} events)")
            else:
                raw = str(inject_data)[:150] if inject_data else "(no response)"
                log(f"[2/4] Injection response: {raw}")

            log("""
+--------------------------------------------------+
|  🎬 录制中... 在浏览器中操作                          |
|                                                    |
|  操作完成后按 **Ctrl+C** 停止录制                  |
|  (注意: 是 Ctrl+C 不是 Enter)                         |
+--------------------------------------------------+
""")

            all_events: List[Dict] = []
            step_num = 0
            last_url = current_url
            poll_count = 0
            consecutive_errors = 0
            MAX_ERRORS = 5

            log("[3/4] Recording... (Ctrl+C to stop)\n")

            try:
                while True:
                    await asyncio.sleep(1.5)
                    poll_count += 1

                    data = await _call(session, "evaluate_script", {"function": POLL_JS})

                    if data is None:
                        if poll_count <= 3 or poll_count % 15 == 0:
                            log(f"   [poll#{poll_count}] (无响应)")
                        consecutive_errors += 1
                        if consecutive_errors >= MAX_ERRORS:
                            log(f"\n   [!] 连续 {MAX_ERRORS} 次无响应，可能页面已关闭或导航")
                            break
                        continue

                    consecutive_errors = 0

                    if not isinstance(data, dict):
                        if poll_count <= 3:
                            log(f"   [poll#{poll_count}] 意外格式: {str(data)[:60]}")
                        continue

                    if not data.get("ok"):
                        err = data.get("error", "?")
                        if poll_count <= 5:
                            log(f"   [poll#{poll_count}] Recorder error: {err}")
                        elif poll_count % 20 == 0:
                            log(f"   [poll#{poll_count}] still error: {err}")
                        if "not_found" in str(err):
                            log(f"\n   [!] 录制器丢失！页面可能已刷新/导航")
                            log(f"   建议: 按 Ctrl+C 停止，重新运行 --record")
                        await asyncio.sleep(2)
                        continue

                    evts = data.get("events", [])
                    elapsed = data.get("elapsed", "?")

                    if evts:
                        for evt in evts:
                            step_num += 1
                            step = _event_to_step(evt, step_num)
                            if step:
                                all_events.append(step)
                                icon = {"click": "[click]", "fill": "[fill]", "navigate": "[nav]"}.get(step["action"], "[act]")
                                val = f" -> '{step['value']}'" if step.get("value") else ""
                                log(f"   [{step_num:02d}] {icon} {step['desc']}{val}")
                        last_url = evts[-1].get("url", last_url)
                    elif poll_count <= 3 or poll_count % 15 == 0:
                        log(f"   [poll#{poll_count}] ... ({elapsed}s, waiting)")

            except (KeyboardInterrupt, asyncio.CancelledError):
                log("\n\n[4/4] Recording stopped by user (Ctrl+C)")

            # ===== 收尾 =====
            final_data = await _call(session, "evaluate_script", {"function": STOP_JS})
            if isinstance(final_data, dict) and final_data.get("events"):
                for evt in final_data["events"]:
                    step_num += 1
                    step = _event_to_step(evt, step_num)
                    if step:
                        all_events.append(step)

            log(f"\n       Stopped. Raw events: {len(all_events)}")

            if not all_events:
                log("[WARN] No operations captured.")
                log("\n可能原因:")
                log("  1. 录制器注入到了空白页 (about:blank)，你在另一个标签页操作")
                log("  2. 页面在录制过程中被刷新/导航")
                log("  3. 操作发生在 iframe 或 shadow DOM 中")
                log("\n建议:")
                log("  - 运行前确保目标页面已在浏览器中打开")
                log("  - 如果有多个标签页，MCP 可能连接到了错误的标签")
                return

            # ===== 后处理：合并连续输入 + 插入导航步骤 =====
            merged = _merge_input_events(all_events)
            final_steps = _prepend_navigate_step(merged, current_url)
            log(f"       After merge: {len(merged)} steps (+1 navigate = {len(final_steps)})\n")

            # ===== 写入文件 =====
            yaml_data = {
                "test_id": f"REC-{int(time.time())}-recorded",
                "title": "Browser Operation Recording (auto-generated)",
                "priority": "P1", "tags": ["recorded", "auto-generated"],
                "author": "Testcase Recorder v1.4",
                "context_check": {
                    "login_url": current_url.split("/")[0] + "//" + current_url.split("/")[2] if "://" in current_url else "",
                    "credentials": {"username": "${TEST_USER}", "password": "${TEST_PASS}"},
                    "captcha_required": False,
                },
                "steps": final_steps,
                "teardown": [{"action": "screenshot", "name": "recorded-result-{timestamp}.png", "fullPage": True}],
            }

            env_vars = set()
            for s in final_steps:
                v = str(s.get("value", ""))
                if "${" in v: env_vars.add(v[2:-1])

            out_dir = os.path.dirname(output_path)
            os.makedirs(out_dir, exist_ok=True)

            with open(output_path, 'w', encoding='utf-8') as f:
                yaml.dump(yaml_data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
            log(f"   OK  YAML: {output_path}")

            env_path = output_path.rsplit('.', 1)[0] + ".env"

            # ===== 从录制步骤中提取实际的用户名/密码等值 =====
            extracted_env: Dict[str, str] = {}
            for s in final_steps:
                val = s.get("value", "")
                target = s.get("target", "").lower()
                if not val or "${" in val:
                    continue
                if any(kw in target for kw in ("用户名", "username", "account")):
                    extracted_env["TEST_USER"] = val
                elif any(kw in target for kw in ("密码", "password", "pass")):
                    extracted_env["TEST_PASS"] = val
                elif "项目" in target and "名称" in target:
                    extracted_env["TEST_PROJECT_NAME"] = val
                elif "金额" in target or "评估值" in target:
                    extracted_env["TEST_AMOUNT"] = val

            # 合并：提取到的值优先，其余用占位符
            all_env_vars = dict(extracted_env)
            for v in sorted(env_vars):
                if v not in all_env_vars:
                    all_env_vars[v] = "<please fill>"

            with open(env_path, 'w', encoding='utf-8') as f:
                f.write("# Recorded test case environment variables (auto-generated)\n")
                f.write(f"# Generated by Testcase Recorder v1.4 at {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"# Source URL: {current_url}\n\n")
                for var_name, var_val in all_env_vars.items():
                    f.write(f"{var_name}={var_val}\n")
            log(f"   OK  ENV:  {env_path} ({len(all_env_vars)} vars: {', '.join(sorted(all_env_vars.keys()))})")

            log(f"\n{'-' * 50}")
            log("Recording complete!")
            log(f"   Case ID : {yaml_data['test_id']}")
            log(f"   Raw     : {len(all_events)} events")
            log(f"   Merged  : {len(merged)} steps")
            log(f"   Final   : {len(final_steps)} steps (含 navigate)")
            log(f"   Output:")
            log(f"     - {output_path}")
            log(f"     - {env_path}")
            log(f"\nNext: edit .env → review YAML → python tests/testcase-ai.py {output_path}")


__all__ = ["run_record_mode"]
