"""
Android 用例执行入口

复用现有用例模型（yaml_loader）与报告格式，执行 adb.* / ui.* 动作命名空间的 YAML 用例。
与 tests/run_testcase.py（Web 端）平级。

用法:
    python tests/framework/android_run.py --case tests/cases/android/ --serial emulator-5554
    python tests/framework/android_run.py --case tests/cases/android/login_error.yaml --report out.json

动作:
    adb.launch            {app: com.demo}（或用例顶层 app 字段）
    adb.tap               {x, y} 或 {selector: {...}}
    adb.input             {text: "..."}
    adb.swipe             {x1, y1, x2, y2, duration?: 300}
    adb.screenshot        {save: "xx.png"}
    adb.back              {}
    ui.assert_text        {selector: {...}}（断言元素存在）
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Optional

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from tests.framework.adb_executor import AdbExecutor, AdbError  # noqa: E402
from tests.framework import ui_selector  # noqa: E402

STEP_WAIT = 0.6  # 步骤间默认等待（秒）


def load_cases(case_path: Path) -> list[dict]:
    """加载用例文件或目录下全部 .yaml 用例（复用 yaml_loader 的 include 解析）"""
    from tests.framework.yaml_loader import _resolve_includes

    paths = [case_path] if case_path.is_file() else sorted(case_path.glob("*.yaml"))
    cases = []
    for p in paths:
        raw = yaml.safe_load(p.read_text(encoding="utf-8"))
        case = _resolve_includes(raw, p.parent)
        case["_file"] = str(p)
        cases.append(case)
    return cases


class AndroidCaseRunner:
    def __init__(self, adb: AdbExecutor):
        self.adb = adb

    def run_step(self, step: dict, app_id: str) -> None:
        action = step.get("action", "")
        if action == "adb.launch":
            self.adb.launch(step.get("app") or app_id)
        elif action == "adb.tap":
            if "selector" in step:
                x, y = ui_selector.resolve(self.adb, step["selector"])
                self.adb.tap(x, y)
            else:
                self.adb.tap(step["x"], step["y"])
        elif action == "adb.input":
            self.adb.input_text(step["text"])
        elif action == "adb.swipe":
            self.adb.swipe(step["x1"], step["y1"], step["x2"], step["y2"],
                           step.get("duration", 300))
        elif action == "adb.screenshot":
            self.adb.screenshot(step.get("save", f"screenshot_{int(time.time())}.png"))
        elif action == "adb.back":
            self.adb.key_back()
        elif action == "ui.assert_text":
            nodes = ui_selector.find_nodes(self.adb, step["selector"])
            if not nodes:
                raise AdbError(f"断言失败: 未找到元素 {step['selector']}")
        else:
            raise AdbError(f"未知动作: {action}（支持 adb.launch/tap/input/swipe/screenshot/back, ui.assert_text）")

    def run_case(self, case: dict) -> dict:
        app_id = case.get("app", "")
        started = time.time()
        result = {
            "case": case.get("case", case["_file"]),
            "file": case["_file"],
            "app": app_id,
            "success": True,
            "error": None,
            "steps_total": len(case.get("steps", [])),
            "steps_done": 0,
            "duration": 0.0,
        }
        try:
            for i, step in enumerate(case.get("steps", []), 1):
                self.run_step(step, app_id)
                result["steps_done"] = i
                time.sleep(step.get("wait", STEP_WAIT))
        except (AdbError, KeyError) as e:
            result["success"] = False
            result["error"] = str(e)
        result["duration"] = round(time.time() - started, 2)
        return result


def main() -> int:
    parser = argparse.ArgumentParser(description="PDD Android 用例执行器")
    parser.add_argument("--case", required=True, help="用例文件或目录")
    parser.add_argument("--serial", default=None, help="设备 serial（默认取首个在线设备）")
    parser.add_argument("--report", default=None, help="JSON 报告输出路径")
    args = parser.parse_args()

    try:
        devs = AdbExecutor.devices()
    except AdbError as e:
        print(f"✗ {e}", file=sys.stderr)
        return 2
    if not devs:
        print("✗ 未发现在线设备（adb devices 为空）\n  指引: 启动模拟器或连接真机后重试", file=sys.stderr)
        return 2
    serial = args.serial or devs[0]
    if args.serial and args.serial not in devs:
        print(f"✗ 指定设备 {args.serial} 不在线，当前: {devs}", file=sys.stderr)
        return 2

    adb = AdbExecutor(serial=serial)
    adb.wait_for_device()

    cases = load_cases(Path(args.case))
    if not cases:
        print(f"✗ 未找到用例: {args.case}", file=sys.stderr)
        return 2

    runner = AndroidCaseRunner(adb)
    results = []
    for case in cases:
        r = runner.run_case(case)
        results.append(r)
        icon = "✓" if r["success"] else "✗"
        err = f"  [{r['error']}]" if r["error"] else ""
        print(f"{icon} {r['case']:<30} {r['duration']}s ({r['steps_done']}/{r['steps_total']}){err}")

    passed = sum(1 for r in results if r["success"])
    summary = {
        "device": serial,
        "total": len(results),
        "passed": passed,
        "failed": len(results) - passed,
        "results": results,
    }
    print(f"\n{passed} passed, {len(results) - passed} failed (设备: {serial})")

    if args.report:
        Path(args.report).write_text(
            json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"报告: {args.report}")

    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
