"""
Testcase Recorder v1.0 - 交互式浏览器操作录制器
==============================================
从 testcase-ai.py 中提取的独立录制模块，遵循 SRP 原则。

功能:
  🎬 注入 JS 事件监听器，捕获用户在浏览器中的操作
  📝 将操作事件自动转换为 YAML 测试步骤
  💾 同时生成 .yaml 和 .env 文件

用法:
  from tests.recorder import run_record_mode
  asyncio.run(run_record_mode("output.yaml"))

  或通过 CLI:
    python tests/testcase-ai.py --record [output_path]
"""

import asyncio
import json
import os
import sys
import time
from typing import Any, Dict, List, Optional

import yaml


if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


# ============================================================
# JS 注入脚本：注入到浏览器页面中捕获用户操作
# ============================================================

RECORDER_JS = """() => {
  if (window.__recorder) {
    return { ok: false, message: 'Already running', count: window.__recorder.events.length };
  }
  window.__recorder = { events: [], start: Date.now(), version: '1.0' };

  function getXPath(el) {
    const parts = [];
    while (el && el.nodeType === 1) {
      let idx = 1, sib = el.previousSibling;
      while (sib) { if (sib.nodeType === 1) idx++; sib = sib.previousSibling; }
      parts.unshift(el.tagName.toLowerCase() + '[' + idx + ']');
      el = el.parentNode;
    }
    return '/' + parts.join('/');
  }

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
      xpath: getXPath(t),
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

  return { ok: true, message: 'Recorder started', pid: performance.now().toString(36) };
}"""

POLL_JS = """() => {
  if (!window.__recorder) return { ok: false };
  const evts = window.__recorder.events;
  const result = [...evts];
  window.__recorder.events = [];
  return { ok: true, elapsed: Math.round((Date.now() - window.__recorder.start) / 1000), events: result };
}"""

STOP_JS = """() => {
  if (!window.__recorder) return { ok: false, events: [] };
  const all = window.__recorder.events;
  window.__recorder = null;
  return { ok: true, totalEvents: all.length, events: all };
}"""


# ============================================================
# 事件 → 步骤转换器
# ============================================================

def _event_to_step(evt: Dict, step_num: int) -> Optional[Dict]:
    """将录制事件转换为 YAML 步骤

    Args:
        evt: 从浏览器捕获的原始事件数据
        step_num: 当前步骤序号

    Returns:
        YAML 步骤字典，或 None（跳过该事件）
    """
    etype = evt.get("type", "")

    if etype == "click":
        text = evt.get("text", "") or ""
        ph = evt.get("ph", "") or ""
        href = evt.get("href", "")
        tag = evt.get("tag", "")

        target = ph or text or href or f"{tag}元素"
        if len(target) > 50:
            target = target[:47] + "..."

        step = {
            "step": step_num,
            "desc": f"点击'{target}'",
            "action": "click",
            "target": target,
        }
        if href and href.startswith("http"):
            step["wait_after"] = {"type": "navigation", "timeout": 8000}
        return step

    elif etype in ("input", "change"):
        val = evt.get("val", "")
        ph = evt.get("ph", "") or ""
        target = ph or evt.get("name") or f"{evt.get('tag','')}输入框"
        if not val:
            return None

        is_number = val.replace(".", "").replace("-", "").isdigit()
        action = "fill"

        step = {
            "step": step_num,
            "desc": f"填写'{target}'为'{val}'",
            "action": action,
            "target": target,
            "value": val,
        }
        if is_number:
            step["desc"] = f"填写数值'{val}'到{target}"
        return step

    elif etype == "navigate":
        return {
            "step": step_num,
            "desc": f"导航至 '{evt.get('url', '')}'",
            "action": "navigate",
            "url": evt.get("url", ""),
            "wait_after": {"type": "time", "duration": 2000},
        }

    elif etype == "enter":
        return None

    return None


# ============================================================
# 录制模式主流程
# ============================================================

async def run_record_mode(output_path: str):
    """交互式录制模式：监听用户操作 → 自动生成 YAML + .env

    流程:
      1. 通过 LoginManager 连接 Chrome DevTools MCP
      2. 向页面注入 RECORDER_JS 事件监听器
      3. 轮询 POLL_JS 获取捕获的事件，实时转换为步骤显示
      4. 用户按 Enter 停止，调用 STOP_JS 收尾
      5. 生成 YAML 用例文件和 .env 环境变量文件

    Args:
        output_path: 输出 YAML 文件路径（.env 同目录同名生成）
    """
    from .login_manager import LoginManager

    print("=" * 60)
    print("  Testcase Recorder v1.0")
    print("  Interactive Browser Operation Recorder")
    print("=" * 60)

    lm = LoginManager()
    session = await lm.create_session()
    if not session:
        print("[ERROR] Cannot connect to Chrome DevTools MCP service")
        sys.exit(1)

    print(f"\n[1/4] Browser connected... OK")

    try:
        await session.call_tool("evaluate_script", {"function": RECORDER_JS})
        print("[2/4] Event listeners injected... OK")
    except Exception as e:
        print(f"[ERROR] Injection failed: {e}")
        sys.exit(1)

    print("""
+--------------------------------------------------+
|           You can operate in browser now!          |
|                                                    |
|   - Click buttons, links, inputs                   |
|   - Fill forms, select dropdowns                   |
|   - Navigate to different pages                     |
|                                                    |
|   Press Enter to stop recording                    |
+--------------------------------------------------+
""")

    all_events: List[Dict] = []
    step_num = 0
    last_url = ""

    import msvcrt
    print("\n[3/4] Recording... (Press Enter to stop)\n")

    while True:
        await asyncio.sleep(1.5)
        try:
            raw = await session.call_tool("evaluate_script", {"function": POLL_JS})
            data = json.loads(raw[0]["text"]) if isinstance(raw, list) else raw
            if data.get("ok") and data.get("events"):
                new_evts = data["events"]
                for evt in new_evts:
                    step_num += 1
                    step = _event_to_step(evt, step_num)
                    if step:
                        all_events.append(step)
                        action_icon = {"click": "[click]", "fill": "[fill]", "navigate": "[nav]"}.get(step["action"], "[act]")
                        val_info = f" -> '{step.get('value','')}'" if step.get("value") else ""
                        print(f"   [{step_num:02d}] {action_icon} {step['desc']}{val_info}")

                if new_evts:
                    last_url = new_evts[-1].get("url", last_url)
        except Exception:
            pass

        if msvcrt.kbhit():
            key = msvcrt.getwch()
            if key == '\r':
                break

    print(f"\n[4/4] Stopped. Captured {len(all_events)} operation steps\n")

    try:
        raw = await session.call_tool("evaluate_script", {"function": STOP_JS})
        final_data = json.loads(raw[0]["text"]) if isinstance(raw, list) else raw
        remaining = final_data.get("events", [])
        for evt in remaining:
            step_num += 1
            step = _event_to_step(evt, step_num)
            if step:
                all_events.append(step)
    except Exception:
        pass

    if not all_events:
        print("[WARN] No operations captured, no files generated.")
        return

    yaml_data = {
        "test_id": f"REC-{int(time.time())}-recorded",
        "title": "Browser Operation Recording (auto-generated)",
        "priority": "P1",
        "tags": ["recorded", "auto-generated"],
        "author": "Testcase Recorder v1.0",
        "context_check": {
            "login_url": last_url.split("/")[0] + "//" + last_url.split("/")[2] if "://" in last_url else "",
            "home_indicator": "",
            "credentials": {"username": "${TEST_USER}", "password": "${TEST_PASS}"},
            "captcha_required": False,
        },
        "steps": all_events,
        "teardown": [
            {"action": "screenshot", "name": "recorded-result-{timestamp}.png", "fullPage": True}
        ],
    }

    env_vars = set()
    for step in all_events:
        val = str(step.get("value", ""))
        if "${" in val:
            env_vars.add(val[2:-1])

    out_dir = os.path.dirname(output_path)
    os.makedirs(out_dir, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        yaml.dump(yaml_data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    print(f"   OK  YAML: {output_path}")

    env_path = output_path.rsplit('.', 1)[0] + ".env"
    if env_vars:
        with open(env_path, 'w', encoding='utf-8') as f:
            f.write("# Recorded test case environment variables (auto-generated)\n")
            for var in sorted(env_vars):
                f.write(f"{var}=<please fill>\n")
        print(f"   OK  ENV:  {env_path} ({len(env_vars)} vars pending)")
    else:
        with open(env_path, 'w', encoding='utf-8') as f:
            f.write("# Recorded test case environment variables (auto-generated)\nTEST_USER=yuanye\nTEST_PASS=yuanye\n")
        print(f"   OK  ENV:  {env_path}")

    print(f"\n{'-' * 50}")
    print(f"Recording complete!")
    print(f"   Case ID : {yaml_data['test_id']}")
    print(f"   Steps   : {len(all_events)}")
    print(f"   Output:")
    print(f"     - {output_path}")
    print(f"     - {env_path}")
    print(f"\nNext steps:")
    print(f"   1. Edit .env file to fill real test data")
    print(f"   2. Review and optimize YAML step descriptions and assertions")
    print(f"   3. Run: python tests/testcase-ai.py {output_path}")


__all__ = ["run_record_mode", "_event_to_step", "RECORDER_JS", "POLL_JS", "STOP_JS"]
