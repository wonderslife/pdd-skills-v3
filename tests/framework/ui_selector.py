"""
UI Selector - UiAutomator selector 与 YAML 用例 DSL 的映射

将用例中的 selector 字典解析为屏幕元素坐标：
    selector: { resourceId: "com.demo:id/et_username" }
    selector: { textContains: "密码错误" }
    selector: { text: "登录", class: "android.widget.Button" }

实现：`adb exec-out uiautomator dump /dev/tty` 获取 XML 层级，用 ElementTree 解析。
注意：Compose 节点需开启 semantics { testTagsAsResourceId = true } 才能以 resourceId 定位。
"""

from __future__ import annotations

import re
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Optional

from tests.framework.adb_executor import AdbExecutor, AdbError

SUPPORTED_KEYS = ("resourceId", "text", "textContains", "content-desc", "class")


@dataclass
class UiNode:
    resource_id: str
    text: str
    content_desc: str
    cls: str
    bounds: tuple[int, int, int, int]  # left, top, right, bottom

    @property
    def center(self) -> tuple[int, int]:
        left, top, right, bottom = self.bounds
        return (left + right) // 2, (top + bottom) // 2


def parse_bounds(raw: str) -> tuple[int, int, int, int]:
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", raw or "")
    if not m:
        raise AdbError(f"无法解析 bounds: {raw!r}")
    return tuple(int(g) for g in m.groups())  # type: ignore[return-value]


def dump_ui(adb: AdbExecutor) -> str:
    """获取当前屏幕控件层级 XML"""
    out = adb.run("exec-out", "uiautomator", "dump", "/dev/tty")
    # 兼容部分设备会附带提示行，仅截取 XML 部分
    start = out.find("<?xml")
    if start == -1:
        start = out.find("<hierarchy")
    if start == -1:
        raise AdbError("uiautomator dump 未返回有效 XML（界面可能不兼容）")
    end = out.rfind("</hierarchy>")
    return out[start:end + len("</hierarchy>")]


def _node_from_xml(el: ET.Element) -> UiNode:
    attrs = el.attrib
    return UiNode(
        resource_id=attrs.get("resource-id", ""),
        text=attrs.get("text", ""),
        content_desc=attrs.get("content-desc", ""),
        cls=attrs.get("class", ""),
        bounds=parse_bounds(attrs.get("bounds", "")),
    )


def find_nodes(adb: AdbExecutor, selector: dict) -> list[UiNode]:
    """按 selector 查找全部匹配节点"""
    unknown = set(selector) - set(SUPPORTED_KEYS)
    if unknown:
        raise AdbError(f"不支持的 selector 字段: {unknown}（支持 {SUPPORTED_KEYS}）")

    root = ET.fromstring(dump_ui(adb))
    matched: list[UiNode] = []
    for el in root.iter("node"):
        node = _node_from_xml(el)
        if selector.get("resourceId") and node.resource_id != selector["resourceId"]:
            continue
        if selector.get("text") and node.text != selector["text"]:
            continue
        if selector.get("textContains") and selector["textContains"] not in node.text:
            continue
        if selector.get("content-desc") and node.content_desc != selector["content-desc"]:
            continue
        if selector.get("class") and node.cls != selector["class"]:
            continue
        matched.append(node)
    return matched


def resolve(adb: AdbExecutor, selector: dict, timeout: float = 10.0,
            poll_interval: float = 0.5) -> tuple[int, int]:
    """等待并返回首个匹配节点的中心坐标"""
    deadline = time.time() + timeout
    last_count = 0
    while time.time() < deadline:
        nodes = find_nodes(adb, selector)
        last_count = len(nodes)
        if nodes:
            return nodes[0].center
        time.sleep(poll_interval)
    raise AdbError(f"未找到元素 {selector}（等待 {timeout}s，末次匹配 {last_count} 个）")
