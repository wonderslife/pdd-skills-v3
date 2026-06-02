"""AI Test Framework - 统一日志模块

提供带时间戳、缩进级别和文件输出的日志功能。
所有 framework 模块和 run_testcase.py 共用此模块。
"""
import time

_log_file = None


def set_log_file(path: str):
    """设置日志输出文件路径"""
    global _log_file
    _log_file = path


def log(msg: str, level: int = 0, timestamp: bool = True):
    """统一日志输出（控制台 + 文件）

    Args:
        msg: 日志消息
        level: 缩进级别（0=顶层, 1=一级, 2=二级...）
        timestamp: 是否显示时间戳
    """
    prefix = "  " * level
    ts = f"[{time.strftime('%H:%M:%S')}]" if timestamp else ""
    line = f"{prefix}{ts} {msg}" if ts else f"{prefix}{msg}"
    print(line, flush=True)
    if _log_file:
        try:
            with open(_log_file, "a", encoding="utf-8") as f:
                f.write(line + "\n")
        except Exception:
            pass
