#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
环境变量加载器 - 从 .env 文件加载测试配置

使用方法：
  python load_env.py                    # 加载 .env.local（优先）或 .env.test
  python load_env.py --file .env.custom # 加载指定文件
  python load_env.py --list             # 列出所有环境变量
  python load_env.py --export           # 导出为 PowerShell/Shell 格式
"""

import os
import sys
import re
from pathlib import Path
from typing import Dict, Optional, List


def find_env_file(filename: Optional[str] = None) -> Optional[Path]:
    """查找环境变量文件"""
    if filename:
        path = Path(filename)
        if path.exists():
            return path
        print(f"❌ 文件不存在: {filename}")
        return None
    
    # 按优先级查找
    base_dir = Path(__file__).parent.parent
    candidates = [
        base_dir / ".env.local",      # 用户本地配置（最高优先级）
        base_dir / ".env.test",       # 测试模板
        base_dir / ".env",            # 通用配置
    ]
    
    for candidate in candidates:
        if candidate.exists():
            return candidate
    
    return None


def parse_env_file(filepath: Path) -> Dict[str, str]:
    """解析 .env 文件"""
    env_vars = {}
    
    with open(filepath, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            
            # 跳过空行和注释
            if not line or line.startswith('#'):
                continue
            
            # 解析 KEY=VALUE 格式
            match = re.match(r'^([A-Za-z_][A-Za-z0-9_]*)=(.*)$', line)
            if match:
                key = match.group(1)
                value = match.group(2).strip()
                
                # 移除引号
                if (value.startswith('"') and value.endswith('"')) or \
                   (value.startswith("'") and value.endswith("'")):
                    value = value[1:-1]
                
                env_vars[key] = value
    
    return env_vars


def load_env_file(filepath: Optional[str] = None, override: bool = False) -> Dict[str, str]:
    """
    加载环境变量文件到 os.environ
    
    Args:
        filepath: 环境变量文件路径，None 则自动查找
        override: 是否覆盖已存在的环境变量
    
    Returns:
        加载的环境变量字典
    """
    env_path = find_env_file(filepath)
    if not env_path:
        print("⚠️ 未找到环境变量文件，使用系统默认值")
        return {}
    
    print(f"📂 加载环境变量: {env_path.name}")
    env_vars = parse_env_file(env_path)
    
    loaded = {}
    for key, value in env_vars.items():
        if key in os.environ and not override:
            continue
        os.environ[key] = value
        loaded[key] = value
    
    if loaded:
        print(f"✅ 已加载 {len(loaded)} 个环境变量")
    else:
        print(f"ℹ️ 所有变量已存在，使用 --override 强制覆盖")
    
    return loaded


def list_env_vars() -> None:
    """列出当前测试相关的环境变量"""
    test_vars = {
        "TEST_USER": "用户名",
        "TEST_PASS": "密码",
        "TEST_PROJECT_NAME": "项目名称",
        "TEST_AMOUNT": "金额",
        "LOGIN_URL": "登录地址",
        "LLM_BASE_URL": "LLM API 地址",
        "LLM_API_KEY": "LLM API 密钥",
        "LLM_MODEL": "LLM 模型",
        "BROWSER_TYPE": "浏览器类型",
        "HEADLESS": "无头模式",
    }
    
    print("\n" + "=" * 60)
    print("📋 当前测试环境变量")
    print("=" * 60)
    
    for var_name, description in test_vars.items():
        value = os.environ.get(var_name, "⚠️ 未设置")
        
        # 隐藏敏感信息
        if var_name in ("TEST_PASS", "LLM_API_KEY"):
            display_value = "***" if value and value != "⚠️ 未设置" else value
        else:
            display_value = value
        
        status = "✅" if value != "⚠️ 未设置" else "❌"
        print(f"{status} {var_name:<25} {display_value:<30} # {description}")
    
    print("=" * 60 + "\n")


def export_env(shell_type: str = "powershell") -> str:
    """导出环境变量为 Shell 脚本格式"""
    lines = []
    
    if shell_type == "powershell":
        lines.append("# PowerShell 环境变量设置脚本")
        lines.append("# 使用方法: .\\set-env.ps1")
        lines.append("")
        for key in sorted(os.environ.keys()):
            if any(key.startswith(prefix) for prefix in ["TEST_", "LOGIN_", "LLM_", "BROWSER_", "HEADLESS"]):
                value = os.environ[key]
                if key in ("TEST_PASS", "LLM_API_KEY"):
                    lines.append(f"$env:{key}=\"{value}\"  # 敏感信息")
                else:
                    lines.append(f"$env:{key}=\"{value}\"")
    
    elif shell_type == "bash":
        lines.append("# Bash 环境变量设置脚本")
        lines.append("# 使用方法: source set-env.sh")
        lines.append("")
        for key in sorted(os.environ.keys()):
            if any(key.startswith(prefix) for prefix in ["TEST_", "LOGIN_", "LLM_", "BROWSER_", "HEADLESS"]):
                value = os.environ[key]
                if key in ("TEST_PASS", "LLM_API_KEY"):
                    lines.append(f'export {key}="{value}"  # 敏感信息')
                else:
                    lines.append(f'export {key}="{value}"')
    
    return "\n".join(lines)


def create_local_config() -> bool:
    """从模板创建本地配置文件"""
    template_path = Path(__file__).parent.parent / ".env.test"
    local_path = Path(__file__).parent.parent / ".env.local"
    
    if not template_path.exists():
        print(f"❌ 模板文件不存在: {template_path}")
        return False
    
    if local_path.exists():
        print(f"⚠️ 本地配置文件已存在: {local_path}")
        return False
    
    import shutil
    shutil.copy(template_path, local_path)
    print(f"✅ 已创建本地配置文件: {local_path}")
    print("   请编辑该文件填入实际的测试凭据")
    return True


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="AI Test Framework 环境变量管理工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python scripts/load_env.py                  # 自动加载环境变量
  python scripts/load_env.py --list           # 列出当前变量
  python scripts/load_env.py --init           # 创建本地配置
  python scripts/load_env.py --export         # 导出 PowerShell 脚本
  python scripts/load_env.py --export bash    # 导出 Bash 脚本
        """
    )
    
    parser.add_argument(
        "--file", "-f",
        help="指定要加载的 .env 文件路径"
    )
    parser.add_argument(
        "--list", "-l",
        action="store_true",
        help="列出当前测试相关环境变量"
    )
    parser.add_argument(
        "--init",
        action="store_true",
        help="从模板创建 .env.local 配置文件"
    )
    parser.add_argument(
        "--export", "-e",
        nargs="?",
        const="powershell",
        choices=["powershell", "bash"],
        help="导出为 Shell 脚本格式"
    )
    parser.add_argument(
        "--override", "-o",
        action="store_true",
        help="强制覆盖已存在的环境变量"
    )
    
    args = parser.parse_args()
    
    if args.init:
        create_local_config()
        return
    
    if args.list:
        load_env_file(args.file)
        list_env_vars()
        return
    
    if args.export:
        load_env_file(args.file, args.override)
        print(export_env(args.export))
        return
    
    # 默认：加载环境变量
    load_env_file(args.file, args.override)


if __name__ == "__main__":
    main()
