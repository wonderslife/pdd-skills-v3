"""AI Test Framework - YAML 测试用例加载器

从 run_testcase.py 提取的 YAML 加载工具函数，负责：
  - _resolve_includes: 解析 _include 字段，合并共享步骤
  - _load_env_from_file: 从 .env 文件加载环境变量
  - _load_testcase_env: 从 YAML 同目录加载配套 .env 文件
"""
import os
import re
from pathlib import Path
from typing import Dict

import yaml

from tests.framework.constants import BASE_DIR, ENV_FILE_PATH
from tests.framework.logger import log


def _resolve_includes(testcase: Dict, base_dir: str, depth: int = 0) -> Dict:
    """解析 _include 字段，将共享步骤合并到当前测试用例
    
    Args:
        testcase: 已加载的 YAML 字典
        base_dir: 基础目录（用于解析相对路径）
        depth: 当前递归深度（防止循环引用，最大3层）
    
    Returns:
        合并后的 testcase 字典（steps 已包含被引用文件的步骤）
    """
    indent = "  " * depth
    current_file = testcase.get("test_id", "?")
    
    log(f"{indent}[_include] 开始解析 | 文件={current_file} | 深度={depth}", 1)
    
    if depth > 3:
        log(f"{indent}[_include] ❌ 超过最大嵌套深度(3)，停止递归", 2)
        return testcase

    include_path = testcase.get("_include")
    if not include_path:
        log(f"{indent}[_include] 无 _include 字段，跳过", 3)
        return testcase

    if not isinstance(include_path, str):
        log(f"{indent}[_include] ❌ _include 必须是字符串路径，实际类型={type(include_path).__name__}", 2)
        return testcase

    resolved_path = Path(base_dir) / include_path
    abs_path = str(resolved_path.resolve())
    
    if not resolved_path.exists():
        log(f"{indent}[_include] ❌ 引用文件不存在: {abs_path}", 1)
        del testcase["_include"]
        return testcase

    log(f"{indent}[_include] 📂 加载共享模块:", 1)
    log(f"{indent}         路径: {abs_path}", 1)

    with open(resolved_path, "r", encoding="utf-8") as _f:
        included = yaml.safe_load(_f)

    if not included or not isinstance(included, dict):
        log(f"{indent}[_include] ❌ 引用文件格式错误(非dict或空): {include_path}", 2)
        del testcase["_include"]
        return testcase

    included_id = included.get("test_id", "?")
    log(f"{indent}[_include] 📋 共享模块 ID: {included_id}", 2)

    included = _resolve_includes(included, str(resolved_path.parent), depth + 1)

    included_steps = included.get("steps", [])
    current_steps = testcase.get("steps", [])

    log(f"{indent}[_include] ── 合并前统计 ──", 1)
    log(f"{indent}         共享模块({included_id}) 步骤数: {len(included_steps)}", 1)
    log(f"{indent}         当前文件({current_file}) 步骤数: {len(current_steps)}", 1)

    if included_steps:
        log(f"{indent}         共享步骤明细:", 2)
        for i, s in enumerate(included_steps):
            desc = s.get("desc", s.get("target", "?"))
            action = s.get("action", "?")
            step_num = s.get("step", "?")
            log(f"{indent}           [{step_num}] {action}: {desc}", 2)

    if current_steps:
        log(f"{indent}         当前文件步骤明细:", 2)
        for i, s in enumerate(current_steps):
            desc = s.get("desc", s.get("target", "?"))
            action = s.get("action", "?")
            step_num = s.get("step", "?")
            log(f"{indent}           [{step_num}] {action}: {desc}", 2)

    merged_steps = list(included_steps) + list(current_steps)
    step_offset = len(included_steps)
    
    renumbered = []
    for idx, s in enumerate(merged_steps):
        old_num = s.get("step", 0)
        new_num = old_num
        
        source_tag = ""
        if idx < step_offset:
            source_tag = f"[共享:{included_id}]"
        else:
            source_tag = "[本文件]"
            if old_num:
                try:
                    new_num = int(old_num) + step_offset
                    s["step"] = new_num
                except (TypeError, ValueError):
                    pass
        
        desc = s.get("desc", s.get("target", "?"))
        action = s.get("action", "?")
        
        renumbered.append(f"  #{new_num} {source_tag} {action}: {desc}")
        
        log(f"{indent}         → #{new_num} {source_tag} "
            f"action={action} target='{s.get('target', '')}' "
            f"(原编号={old_num})", 3)

    testcase["steps"] = merged_steps
    testcase["_included_from"] = include_path
    del testcase["_include"]

    log(f"{indent}[_include] ✅ 合并完成:", 1)
    log(f"{indent}         总计: {len(merged_steps)} 步 (共享{len(included_steps)} + 本文件{len(current_steps)})", 1)
    log(f"{indent}         步骤偏移量: +{step_offset}", 2)
    log(f"{indent}         最终步骤序列:", 2)
    for line in renumbered:
        log(f"{indent}           {line}", 2)

    return testcase


def _load_env_from_file():
    """从 .env 文件加载环境变量（优先级：.env.local > .env.test）"""
    env_files = [
        Path(ENV_FILE_PATH),
        Path(BASE_DIR) / ".env.local",
    ]

    for env_file in env_files:
        if env_file.exists():
            loaded_count = 0
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    match = re.match(r'^([A-Za-z_][A-Za-z0-9_]*)=(.*)$', line)
                    if match:
                        key, value = match.group(1), match.group(2).strip()
                        if (value.startswith('"') and value.endswith('"')) or \
                           (value.startswith("'") and value.endswith("'")):
                            value = value[1:-1]
                        if key not in os.environ:
                            os.environ[key] = value
                            loaded_count += 1

            if loaded_count > 0:
                log(f"📂 从 {env_file.name} 加载了 {loaded_count} 个环境变量")
            break


def _load_testcase_env(yaml_path: str) -> Dict[str, str]:
    """从 YAML 同目录加载同名 .env 文件（如 asset-eval-apply.yaml → asset-eval-apply.env）

    返回加载的变量字典，用于执行后清理。
    """
    yaml_path = Path(yaml_path)
    env_path = yaml_path.with_suffix('.env')
    loaded = {}

    if not env_path.exists():
        log(f"  [Env] 无配套 .env 文件: {env_path.name}", 2)
        return loaded

    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            match = re.match(r'^([A-Za-z_][A-Za-z0-9_]*)=(.*)$', line)
            if match:
                key, value = match.group(1), match.group(2).strip()
                if (value.startswith('"') and value.endswith('"')) or \
                   (value.startswith("'") and value.endswith("'")):
                    value = value[1:-1]
                old_val = os.environ.get(key)
                os.environ[key] = value
                loaded[key] = old_val

    if loaded:
        log(f"  [Env] 📂 从 {env_path.name} 加载 {len(loaded)} 个变量: {list(loaded.keys())}", 1)
    return loaded
