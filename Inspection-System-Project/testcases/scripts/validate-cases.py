#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
巡检系统测试用例静态校验（不依赖浏览器，秒级完成）

校验项：
  1. YAML 语法可解析
  2. 必填字段齐全（test_id / title / priority / tags / author / context_check / steps / teardown）
  3. step 编号必须是纯整数且连续（_include 重编号依赖此规则）
  4. 每个 step 有 step / desc / action，且带 assertion 或 assertions
  5. 同目录同名 .env 必须存在
  6. YAML 中引用的 ${VAR} 必须在 .env 中定义（或属于引擎内置变量）

用法:
  python validate-cases.py [testcases 目录，默认 ../testcases/inspect]
"""
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("缺少 pyyaml，请先 pip install pyyaml")

# 引擎内置占位符，无需在 .env 中定义
BUILTIN_VARS = {
    "LOGIN_URL",
    "current_url",
    "timestamp",
}
VAR_RE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-[^}]*)?\}")

REQUIRED_TOP = ["test_id", "title", "priority", "tags", "author", "context_check", "steps"]
VALID_PRIORITY = {"P0", "P1", "P2", "P3"}

# 断言至少命中其中一个「校验目标」字段
TARGET_KEYS = ("expected", "target", "url_pattern", "value", "min_count", "message", "pattern")


def parse_env(env_path: Path) -> set:
    keys = set()
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        keys.add(line.split("=", 1)[0].strip())
    return keys


def collect_vars(node, acc: set):
    if isinstance(node, dict):
        for v in node.values():
            collect_vars(v, acc)
    elif isinstance(node, list):
        for v in node:
            collect_vars(v, acc)
    elif isinstance(node, str):
        acc.update(VAR_RE.findall(node))


def validate(yaml_path: Path):
    errors, warnings = [], []
    text = yaml_path.read_text(encoding="utf-8")
    try:
        doc = yaml.safe_load(text)
    except yaml.YAMLError as e:
        return [f"YAML 解析失败: {e}"], []

    if not isinstance(doc, dict):
        return ["顶层结构不是映射（mapping）"], []

    for k in REQUIRED_TOP:
        if k not in doc:
            errors.append(f"缺少必填字段: {k}")
    if "teardown" not in doc:
        warnings.append("缺少 teardown（建议补后置清理）")
    if doc.get("priority") not in VALID_PRIORITY:
        errors.append(f"priority 非法: {doc.get('priority')!r}（应为 P0-P3）")

    cc = doc.get("context_check") or {}
    if not isinstance(cc, dict):
        errors.append("context_check 不是映射")
    else:
        if not cc.get("login_url"):
            errors.append("context_check.login_url 为空")
        if not cc.get("credentials"):
            warnings.append("context_check.credentials 为空（无法自动登录）")

    steps = doc.get("steps")
    if not isinstance(steps, list) or not steps:
        errors.append("steps 缺失或为空")
    else:
        expect = 1
        for i, st in enumerate(steps):
            if not isinstance(st, dict):
                errors.append(f"steps[{i}] 不是映射")
                continue
            num = st.get("step")
            if not isinstance(num, int) or isinstance(num, bool):
                errors.append(f"steps[{i}] step 编号必须为纯整数，当前为 {num!r}")
            else:
                if num != expect:
                    warnings.append(f"steps[{i}] step 编号不连续：期望 {expect}，实际 {num}")
                expect = num + 1
            for f in ("desc", "action"):
                if not st.get(f):
                    errors.append(f"steps[{i}]（step={num}）缺少 {f}")
            has_assert = bool(st.get("assertion")) or bool(st.get("assertions"))
            if not has_assert:
                errors.append(f"steps[{i}]（step={num}）缺少 assertion/assertions")
            if "assertions" in st and isinstance(st["assertions"], list):
                for j, a in enumerate(st["assertions"]):
                    if not isinstance(a, dict):
                        errors.append(f"steps[{i}].assertions[{j}] 不是映射")
                    else:
                        if not a.get("type"):
                            errors.append(f"steps[{i}].assertions[{j}] 缺少 type")
                        elif not any(a.get(k) not in (None, "") for k in TARGET_KEYS):
                            errors.append(
                                f"steps[{i}].assertions[{j}]（{a.get('type')}）"
                                f"缺少校验目标（{'/'.join(TARGET_KEYS)} 至少一个）"
                            )

    # .env 配对
    env_path = yaml_path.with_suffix(".env")
    env_keys = set()
    if not env_path.exists():
        errors.append(f"缺少配套 .env 文件: {env_path.name}")
    else:
        env_keys = parse_env(env_path)

    used = set()
    collect_vars(doc, used)
    missing = sorted(v for v in used if v not in env_keys and v not in BUILTIN_VARS)
    if missing:
        errors.append(f"以下变量在 .env 中未定义: {', '.join(missing)}")
    unused = sorted(k for k in env_keys if k not in used)
    if unused:
        warnings.append(f".env 中未被引用的变量: {', '.join(unused)}")

    return errors, warnings


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "../testcases/inspect")
    root = (Path(__file__).parent / root).resolve() if not root.is_absolute() else root
    files = sorted(p for p in root.rglob("*.yaml"))
    if not files:
        sys.exit(f"未找到 YAML 用例: {root}")

    total_err = 0
    print(f"校验目录: {root}\n共 {len(files)} 个用例\n" + "=" * 72)
    for f in files:
        errors, warnings = validate(f)
        rel = f.relative_to(root)
        if errors:
            status = "FAIL"
            total_err += len(errors)
        elif warnings:
            status = "WARN"
        else:
            status = "PASS"
        print(f"[{status}] {rel}")
        for e in errors:
            print(f"       ✗ {e}")
        for w in warnings:
            print(f"       ! {w}")

    print("=" * 72)
    if total_err:
        print(f"结果: 发现 {total_err} 个错误，请修复后重跑")
        sys.exit(1)
    print("结果: 全部用例通过静态校验")


if __name__ == "__main__":
    main()
