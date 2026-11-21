"""
ADB Executor - Android 设备命令封装

封装 adb 常用操作：设备列表、应用启停、点击/输入/滑动、截图。
与 tests/framework/action_executor.py（Web 端）平级，供 android_run.py 调用。

用法:
    from tests.framework.adb_executor import AdbExecutor
    adb = AdbExecutor(serial="emulator-5554")
    adb.launch("com.example.mycomposeapp")
    adb.tap(500, 1200)
    adb.input_text("testuser")
    adb.screenshot("login.png")
"""

from __future__ import annotations

import re
import subprocess
import time
from typing import Optional


class AdbError(RuntimeError):
    """adb 命令执行失败"""


class AdbExecutor:
    """单设备 ADB 命令封装"""

    def __init__(self, serial: Optional[str] = None, timeout: int = 30):
        self.serial = serial
        self.timeout = timeout

    # ---------- 基础 ----------

    def run(self, *args: str, check: bool = True) -> str:
        """执行 adb 命令并返回 stdout"""
        cmd = ["adb"]
        if self.serial:
            cmd += ["-s", self.serial]
        cmd += list(args)
        try:
            proc = subprocess.run(
                cmd, capture_output=True, text=True, timeout=self.timeout
            )
        except FileNotFoundError as e:
            raise AdbError("adb 不在 PATH 中，请安装 Android SDK Platform-Tools") from e
        except subprocess.TimeoutExpired as e:
            raise AdbError(f"adb 命令超时: {' '.join(args)}") from e
        if check and proc.returncode != 0:
            raise AdbError(f"adb {' '.join(args)} 失败: {proc.stderr.strip() or proc.stdout.strip()}")
        return proc.stdout

    @staticmethod
    def devices() -> list[str]:
        """列出在线设备 serial"""
        try:
            out = subprocess.run(
                ["adb", "devices"], capture_output=True, text=True, timeout=15
            ).stdout
        except FileNotFoundError as e:
            raise AdbError("adb 不在 PATH 中，请安装 Android SDK Platform-Tools") from e
        devs = []
        for line in out.splitlines()[1:]:
            m = re.match(r"^(\S+)\s+device\s*$", line.strip())
            if m:
                devs.append(m.group(1))
        return devs

    def wait_for_device(self, timeout: int = 60) -> None:
        """等待设备就绪"""
        deadline = time.time() + timeout
        while time.time() < deadline:
            if self.serial in self.devices():
                return
            time.sleep(1)
        raise AdbError(f"设备 {self.serial} 未就绪（超时 {timeout}s）")

    # ---------- 应用 ----------

    def launch(self, app_id: str, wait_first_frame: float = 2.0) -> None:
        """启动应用并等待首帧"""
        monkey_out = self.run(
            "shell", "monkey", "-p", app_id, "-c",
            "android.intent.category.LAUNCHER", "1"
        )
        if "No activities found" in monkey_out:
            raise AdbError(f"应用 {app_id} 未安装或无 LAUNCHER 入口")
        time.sleep(wait_first_frame)

    def stop(self, app_id: str) -> None:
        self.run("shell", "am", "force-stop", app_id)

    # ---------- 交互 ----------

    def tap(self, x: int, y: int) -> None:
        self.run("shell", "input", "tap", str(int(x)), str(int(y)))

    def swipe(self, x1: int, y1: int, x2: int, y2: int, duration_ms: int = 300) -> None:
        self.run("shell", "input", "swipe", str(int(x1)), str(int(y1)),
                 str(int(x2)), str(int(y2)), str(int(duration_ms)))

    def input_text(self, text: str) -> None:
        # 中文/空格需经剪贴板场景由用例层处理，此处覆盖 ASCII 常规输入
        self.run("shell", "input", "text", text.replace(" ", "%s"))

    def key_back(self) -> None:
        self.run("shell", "input", "keyevent", "4")

    def screenshot(self, save_path: str) -> str:
        """截图并拉取到本地，返回本地路径"""
        remote = f"/sdcard/pdd_snapshot_{int(time.time() * 1000)}.png"
        self.run("shell", "screencap", "-p", remote)
        self.run("pull", remote, save_path)
        self.run("shell", "rm", remote)
        return save_path

    def screen_size(self) -> tuple[int, int]:
        """返回 (宽, 高)"""
        out = self.run("shell", "wm", "size")
        m = re.search(r"(\d+)x(\d+)", out)
        if not m:
            raise AdbError(f"无法解析屏幕尺寸: {out.strip()}")
        return int(m.group(1)), int(m.group(2))
