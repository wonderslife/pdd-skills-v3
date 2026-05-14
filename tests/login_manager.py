#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
FastAI Test Framework - 登录状态管理器

功能:
  1. 检测是否已登录
  2. 验证当前用户身份
  3. 自动注销（支持"用户名下拉菜单→退出"模式）
  4. 智能跳过或重新登录

设计原则:
  - 快速：<0.5秒完成检测
  - 实用：80%场景自动处理
  - 鲁棒：失败时优雅降级
"""

import os
import re
import asyncio
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any


@dataclass
class LoginState:
    """登录状态"""
    is_logged_in: bool = False
    confidence: float = 0.0
    details: str = ""


@dataclass
class LoginStatus:
    """登录状态检测结果"""
    action: str = "login"              # "skip" | "login" | "re_login"
    current_user: Optional[str] = None
    reason: str = ""
    steps_to_skip: List[int] = field(default_factory=list)
    warning: bool = False


@dataclass
class SnapshotElement:
    """快照元素"""
    uid: str = ""
    text: str = ""
    role: str = ""


class LoginManager:
    """
    登录状态管理器
    
    使用方式:
      manager = LoginManager()
      status = await manager.check_and_ensure_login(session, parser, config, "${TEST_USER}")
      
      if status.action == "skip":
          # 跳过登录步骤
          pass
      elif status.action == "re_login":
          # 已自动注销，准备重新登录
          pass
      else:
          # 执行完整登录流程
          pass
    """
    
    def __init__(self, snapshot_dir: str = None):
        self._snapshot_cache = {}
        self._element_cache = {}
        self._snapshot_dir = snapshot_dir

    @staticmethod
    def _check_result_has_error(content: str) -> bool:
        if not content:
            return False
        content_lower = content.lower()
        strict_errors = ["mcp error", "input validation error", "invalid arguments",
                         "elementclickinterceptederror", "not interactable"]
        if any(err in content_lower for err in strict_errors):
            return True
        loose_patterns = ["error:", "failed to", "did not become", "timeout",
                         "could not", "unable to", "no such", "cannot find"]
        if any(p in content_lower for p in loose_patterns):
            return True
        if content_lower.startswith("error:") or content_lower.startswith("err:"):
            return True
        return False
    
    async def check_and_ensure_login(
        self,
        session,
        parser,
        config: Dict[str, Any],
        required_user: str,
        context_check: Optional[Dict] = None
    ) -> LoginStatus:
        """
        检查并确保以指定用户登录
        
        Args:
            session: MCP会话对象
            parser: 快照解析器
            config: 配置字典
            required_user: 需要的用户名 (如 "${TEST_USER}")
            context_check: YAML中的context_check配置
            
        Returns:
            LoginStatus 对象
        """
        try:
            # Step 1: 获取页面快照
            snapshot_text = await self._get_snapshot(session)

            if not snapshot_text:
                return LoginStatus(
                    action="login",
                    reason="无法获取页面快照，将执行登录流程"
                )

            # 调试：保存登录检测用的快照
            try:
                import time as _time
                _snap_dir = self._snapshot_dir or os.path.join(
                    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "snapshots")
                os.makedirs(_snap_dir, exist_ok=True)
                _debug_path = os.path.join(_snap_dir, f"snap-login-detect-{_time.strftime('%Y%m%d-%H%M%S')}.txt")
                with open(_debug_path, "w", encoding="utf-8") as _f:
                    _f.write(snapshot_text)
                log(f"  [Debug] 登录检测快照已保存: {_debug_path}", 3)
            except Exception:
                pass
            
            # Step 2: 判断登录状态
            login_state = self._detect_login_state(
                snapshot_text,
                context_check.get("home_indicator", "") if context_check else ""
            )
            
            if not login_state.is_logged_in:
                return LoginStatus(
                    action="login",
                    current_user=None,
                    reason="🔓 未登录，将执行登录流程",
                    steps_to_skip=[]
                )
            
            # Step 3: 已登录，验证用户身份（支持中文名对比）
            display_name = None
            if context_check:
                creds = context_check.get("credentials", {})
                raw_display = creds.get("display_name", "")
                display_name = self._resolve_env_var(raw_display) if raw_display else None

            current_user = await self._detect_current_user(
                snapshot_text, config=config, display_name=display_name)
            resolved_required = self._resolve_env_var(required_user)

            log(f"[Login Check] 当前用户: {current_user or '未知'}", 2)
            log(f"[Login Check] 需要账号: {resolved_required} | 中文名: {display_name or '未配置'}", 3)

            # 对比逻辑：username匹配 或 display_name匹配 任一即可
            is_match = False
            match_reason = ""

            if current_user and self._is_same_user(current_user, resolved_required):
                is_match = True
                match_reason = f"账号'{current_user}'匹配"
            elif current_user and display_name and self._is_same_user(current_user, display_name):
                is_match = True
                match_reason = f"中文名'{current_user}'匹配'{display_name}'"
            elif not current_user and display_name:
                is_match = False
                match_reason = "未检测到用户名"

            if is_match:
                return LoginStatus(
                    action="skip",
                    current_user=current_user,
                    reason=f"✅ {match_reason}，跳过登录步骤",
                    steps_to_skip=self._get_login_step_indices(context_check=config)
                )
            else:
                detail = f"(当前:'{current_user}', 需要:{resolved_required}"
                if display_name:
                    detail += f", 中文名:{display_name}"
                detail += ")"
                # Step 4: 用户不匹配，尝试自动切换
                auto_switch = True
                if context_check:
                    auto_switch = context_check.get("auto_switch_user", True)
                
                if auto_switch:
                    return await self._handle_user_mismatch(
                        session, parser, current_user, resolved_required
                    )
                else:
                    return LoginStatus(
                        action="login",
                        current_user=current_user,
                        reason=f"⚠️ 用户不匹配{detail}，auto_switch未启用",
                        warning=True,
                        steps_to_skip=[]
                    )
                    
        except Exception as e:
            log(f"[Login Manager Error] {e}", 2)
            return LoginStatus(
                action="login",
                reason=f"⚠️ 检测异常: {str(e)[:50]}，将执行登录流程"
            )
    
    async def _handle_user_mismatch(
        self,
        session,
        parser,
        current_user: Optional[str],
        required_user: str
    ) -> LoginStatus:
        """处理用户不匹配的情况"""
        log(f"⚠️ 用户不匹配: 当前='{current_user or '未知'}', 需要='{required_user}'", 1)
        
        # 尝试自动注销
        logout_success = await self._auto_logout(session, parser)
        
        if logout_success:
            return LoginStatus(
                action="re_login",
                current_user=None,
                reason=f"🔄 已注销(原用户:{current_user})，将使用'{required_user}'重新登录",
                steps_to_skip=[]
            )
        else:
            # 注销失败，降级处理
            return LoginStatus(
                action="login",
                current_user=current_user,
                reason=f"⚠️ 自动注销失败，将尝试覆盖登录",
                warning=True,
                steps_to_skip=[]
            )
    
    def _detect_login_state(self, snapshot_text: str, home_indicator: str = "") -> LoginState:
        """
        检测登录状态 - 基于规则的快速检测 (<0.1秒)
        """
        text_lower = snapshot_text.lower() if snapshot_text else ""
        
        # 已登录的强标志
        logged_in_markers = [
            home_indicator.lower() if home_indicator else None,
            "统一门户", "门户", "首页", "退出", "注销",
            "工作台", "dashboard", "welcome", "已登录",
            "个人中心", "用户信息"
        ]
        logged_in_markers = [m for m in logged_in_markers if m]
        
        # 未登录的强标志
        logged_out_markers = [
            "欢迎登录", "请登录", "请输入用户名", "请输入密码",
            "sign in", "log in", "username", "password"
        ]
        
        # 计算得分
        in_score = sum(1 for m in logged_in_markers if m in text_lower)
        out_score = sum(1 for m in logged_out_markers if m in text_lower)
        
        # 判断逻辑
        is_logged_in = in_score > out_score and in_score > 0
        confidence = min(0.95, abs(in_score - out_score) / max(in_score, out_score, 1))
        
        details = f"in={in_score}, out={out_score}"
        
        return LoginState(
            is_logged_in=is_logged_in,
            confidence=confidence,
            details=details
        )
    
    async def _detect_current_user(self, snapshot_text: str,
                                   config: Optional[Dict] = None,
                                   display_name: Optional[str] = None) -> Optional[str]:
        """
        检测当前登录的用户名
        
        策略（优先级从高到低）:
          P0: 统一门户固定UID uid=1_72 （硬编码，不变）
          P1: YAML配置的 user_indicator 文本精确匹配
          P2: uid=1_x 后缀范围 [50,100] 模糊匹配（兜底）
        """
        test_user = os.environ.get("TEST_USER", "")

        # ===== 方法1: 精确UID定位 =====
        for line in snapshot_text.split('\n'):
            if 'uid=1_72' in line and 'StaticText' in line:
                start = line.find('StaticText "') + len('StaticText "')
                end = line.find('"', start)
                if start > -1 and end > start:
                    name = line[start:end]
                    if name and len(name) >= 2:
                        log(f"  [用户检测] uid=1_72精确命中: '{name}'", 3)
                        return name

        # ===== P1: YAML配置的 user_indicator 精确匹配 =====
        if config:
            indicator = config.get("user_indicator")
            if indicator and len(indicator) >= 2:
                for line in snapshot_text.split('\n'):
                    if 'StaticText "' in line and indicator in line:
                        start = line.find('StaticText "') + len('StaticText "')
                        end = line.find('"', start)
                        if start > -1 and end > start:
                            name = line[start:end]
                            if name and len(name) >= 2 and name != indicator:
                                log(f"  [用户检测] user_indicator命中: '{name}' (indicator='{indicator}')", 3)
                                return name

        # ===== P2: 位置+范围过滤兜底 =====
        banned = {
            '统一门户', '统一门户（新）', '资产评估', '投资管理', '电子档案',
            '资产管理', '资产处置', '超级管理员', '待办', '待阅', '已办', '已阅',
            '邮件', '党建平台', '个人工作台', '显示', '隐藏', '固定区',
            '语言切换', '中文', '自定义时不可调整', '此区域', '用户自定',
            '不可调整', '首页', '消息', '全屏', '主题', '大小',
            '当天没有更多日程安排', '快创建新日程',
        }
        best_name = None
        best_suffix = 999

        for line in snapshot_text.split('\n'):
            if 'uid=1_' not in line or 'StaticText "' not in line:
                continue

            uid_pos = line.find('uid=1_')
            if uid_pos == -1:
                continue

            space_pos = line.find(' ', uid_pos + 4)
            if space_pos == -1:
                continue

            uid_suffix_str = line[uid_pos + 4:space_pos]
            try:
                suffix = int(uid_suffix_str)
            except ValueError:
                continue

            txt_pos = line.find('StaticText "')
            if txt_pos == -1:
                continue

            val_start = txt_pos + len('StaticText "')
            val_end = line.find('"', val_start)
            if val_end <= val_start:
                continue

            name = line[val_start:val_end]

            if not name or len(name) < 2 or name.isdigit() or name in banned:
                continue

            if 50 <= suffix <= 100 and suffix < best_suffix:
                best_name = name
                best_suffix = suffix

        if best_name:
            log(f"  [用户检测] 位置过滤命中: '{best_name}' (suffix={best_suffix})", 3)
            return best_name

        # ===== P2.5: 全页StaticText兜底（覆盖非uid=1_前缀的情况）=====
        if display_name and len(display_name) >= 2:
            for line in snapshot_text.split('\n'):
                if 'StaticText "' not in line:
                    continue
                txt_pos = line.find('StaticText "')
                val_start = txt_pos + len('StaticText "')
                val_end = line.find('"', val_start)
                if val_end <= val_start:
                    continue
                name = line[val_start:val_end]
                if name == display_name and len(name) >= 2 and name not in banned:
                    log(f"  [用户检测] 全页精确命中display_name: '{name}'", 3)
                    return name

        # ===== P3: TEST_USER 直接匹配 =====
        if test_user and test_user.lower() in snapshot_text.lower():
            log(f"  [用户检测] TEST_USER匹配: {test_user}", 3)
            return test_user

        log("  [用户检测] 所有方法均未匹配", 3)
        return None
    
    def _is_same_user(self, user1: str, user2: str) -> bool:
        """判断两个用户名是否相同（忽略大小写和空格）"""
        if not user1 or not user2:
            return False
        return user1.strip().lower() == user2.strip().lower()
    
    def _resolve_env_var(self, value: str) -> str:
        """解析环境变量引用 (${VAR} 格式）"""
        import re
        def replacer(match):
            var_name = match.group(1)
            return os.environ.get(var_name, match.group(0))
        return re.sub(r'\$\{([^}]+)\}', replacer, value)
    
    def _get_login_step_indices(self, context_check: Optional[Dict] = None) -> List[int]:
        """获取需要跳过的登录步骤索引
        
        优先从YAML的context_check.login_steps读取，
        未配置时默认跳过前4步（步骤1-4，索引0-3）
        """
        if context_check:
            steps = context_check.get("login_steps")
            if isinstance(steps, list):
                return [s - 1 for s in steps if isinstance(s, int) and s >= 1]
        return [0, 1, 2, 3]
    
    async def _get_snapshot(self, session, force: bool = False) -> str:
        """获取页面快照（带缓存）"""
        cache_key = "current_page"
        
        if not force and cache_key in self._snapshot_cache:
            return self._snapshot_cache[cache_key]
        
        try:
            result = await session.call_tool("take_snapshot", {"verbose": False})
            snapshot_text = ""
            
            if result.content:
                for item in result.content:
                    if hasattr(item, 'text'):
                        snapshot_text += item.text + "\n"
                    elif hasattr(item, 'content'):
                        snapshot_text += str(item.content) + "\n"
            
            self._snapshot_cache[cache_key] = snapshot_text
            return snapshot_text
            
        except Exception as e:
            log(f"[Snapshot Error] {e}", 3)
            return ""
    
    async def _auto_logout(self, session, parser) -> bool:
        """
        自动注销 - 支持多种UI模式
        
        模式支持:
          1. 用户名下拉菜单 → 退出（主要模式）
          2. 直接的退出按钮（备选模式）
        """
        try:
            log("[Auto-Logout] 开始尝试自动注销...", 2)
            
            # 尝试模式1: 下拉菜单式
            success = await self._logout_via_dropdown_menu(session, parser)
            if success:
                return True
            
            # 尝试模式2: 直接按钮式
            log("[Auto-Logout] 下拉菜单方式失败，尝试直接退出按钮...", 2)
            success = await self._logout_via_direct_button(session)
            if success:
                return True
            
            log("⚠️ 所有注销方式均失败", 2)
            return False
            
        except Exception as e:
            log(f"[Auto-Logout Error] {e}", 2)
            return False
    
    async def _logout_via_dropdown_menu(self, session, parser) -> bool:
        """
        通过用户名下拉菜单注销

        查找策略（按优先级）:
          1. 找 headPortrait 头像图片 → 点击
          2. 找右上角区域 2-4 汉字的用户名 → 点击
          3. 找 header 区域的 image 元素(头像/箭头) → 点击
        """
        import re

        snapshot_text = await self._get_snapshot(session, force=True)

        if not snapshot_text:
            return False

        elements = []
        try:
            parsed = parser.parse(snapshot_text)
            if hasattr(parsed, 'elements'):
                elements = parsed.elements
            elif isinstance(parsed, list):
                elements = parsed
        except:
            elements = []

        user_element = None
        excluded_names = {'统一门户', '资产评估', '投资管理', '电子档案', '资产管理',
                         '资产处置', '超级管理员', '待办', '待阅', '已办', '已阅',
                         '邮件', '党建平台', '个人工作台', '显示', '隐藏', '固定区',
                         '语言切换'}

        # 策略1: 通过 headPortrait 头像定位
        for elem in elements:
            elem_uid = getattr(elem, 'uid', '') or ''
            elem_text = getattr(elem, 'text', '') or ''
            elem_role = getattr(elem, 'role', '') or ''

            full_text = f"{elem_text} {elem_role}".lower()
            if 'headportrait' in full_text and self._is_header_element(elem_uid):
                user_element = SnapshotElement(uid=elem_uid, text=elem_text or '(头像)')
                log(f"[Auto-Logout] 策略1-头像命中: {user_element.uid}", 2)
                break

        # 策略2: header 区域的中文用户名
        if not user_element:
            for elem in elements:
                elem_uid = getattr(elem, 'uid', '') or ''
                elem_text = getattr(elem, 'text', '') or ''

                if not self._is_header_element(elem_uid):
                    continue
                if not re.match(r'^[\u4e00-\u9fa5]{2,4}$', elem_text):
                    continue
                if elem_text in excluded_names:
                    continue
                user_element = SnapshotElement(uid=elem_uid, text=elem_text)
                log(f"[Auto-Logout] 策略2-用户名命中: {user_element.uid} ({user_element.text})", 2)
                break

        # 策略3: header 区域的 image 元素
        if not user_element:
            for elem in elements:
                elem_uid = getattr(elem, 'uid', '') or ''
                elem_role = getattr(elem, 'role', '') or ''
                elem_text = getattr(elem, 'text', '') or ''

                if not self._is_header_element(elem_uid):
                    continue
                if elem_role == 'image':
                    user_element = SnapshotElement(uid=elem_uid, text=elem_text or '(图标)')
                    log(f"[Auto-Logout] 策略3-图标命中: {user_element.uid}", 2)
                    break

        if not user_element:
            log("[Auto-Logout] 所有策略均未找到用户区元素", 3)
            return False

        # 点击展开下拉菜单
        try:
            click_result = await session.call_tool("click", {"uid": user_element.uid})
            err_text = ""
            if hasattr(click_result, 'content') and click_result.content:
                for c in click_result.content:
                    if hasattr(c, 'text'): err_text += c.text
            if (hasattr(click_result, 'is_error') and click_result.is_error) or \
               self._check_result_has_error(err_text):
                log(f"[Auto-Logout] 点击失败: {err_text[:100]}", 3)
                return False
        except Exception as e:
            log(f"[Auto-Logout] 点击异常: {e}", 3)
            return False

        log("[Auto-Logout] 已点击用户区，等待下拉菜单...", 2)
        await asyncio.sleep(1.0)

        # 在展开菜单中查找退出选项
        new_snapshot = await self._get_snapshot(session, force=True)
        logout_elem = self._find_logout_element(new_snapshot)

        if not logout_elem:
            log("[Auto-Logout] 菜单中未找到退出选项", 3)
            return False

        log(f"[Auto-Logout] 找到退出: {logout_elem.uid} ({logout_elem.text[:20]})", 2)

        # 点击退出
        try:
            logout_result = await session.call_tool("click", {"uid": logout_elem.uid})
            err = ""
            if hasattr(logout_result, 'content') and logout_result.content:
                for c in logout_result.content:
                    if hasattr(c, 'text'): err += c.text
            if (hasattr(logout_result, 'is_error') and logout_result.is_error) or \
               self._check_result_has_error(err):
                log(f"[Auto-Logout] 点击退出失败: {err[:100]}", 3)
                return False
        except Exception as e:
            log(f"[Auto-Logout] 点击退出异常: {e}", 3)
            return False

        log("[Auto-Logout] 已点击退出，等待跳转...", 2)
        await asyncio.sleep(2.0)

        # 验证注销成功
        final_snapshot = await self._get_snapshot(session, force=True)
        if self._is_login_page(final_snapshot):
            log("✅ 自动注销成功！", 1)
            return True
        else:
            log("⚠️ 注销后页面特征不明显，假设成功", 2)
            return True

    async def _logout_via_direct_button(self, session) -> bool:
        """通过直接退出按钮注销"""
        snapshot_text = await self._get_snapshot(session, force=True)
        
        if not snapshot_text:
            return False
        
        logout_keywords = ["退出", "退出登录", "登出", "注销", "exit", "logout"]
        text_lines = snapshot_text.split('\n')
        
        for line in text_lines:
            line_lower = line.strip().lower()
            for kw in logout_keywords:
                if kw in line_lower:
                    # 提取UID（如果有的话）
                    uid_match = re.search(r'(\d+_\d+)', line)
                    if uid_match:
                        uid = uid_match.group(1)
                        result = await session.call_tool("click", {"uid": uid})
                        if not (hasattr(result, 'is_error') and result.is_error):
                            await asyncio.sleep(1.5)
                            return True
        
        return False
    
    def _find_logout_element(self, snapshot_text: str) -> Optional[SnapshotElement]:
        """在快照中查找退出/注销元素"""
        import re
        
        logout_keywords = ["退出", "退出登录", "登出", "注销", "exit", "logout", "sign out"]
        
        lines = snapshot_text.split('\n')
        for line in lines:
            line_lower = line.strip().lower()
            for kw in logout_keywords:
                if kw in line_lower:
                    uid_match = re.search(r'(\d+_\d+)', line)
                    text_match = re.search(r'"([^"]*)"', line)
                    
                    if uid_match:
                        return SnapshotElement(
                            uid=uid_match.group(1),
                            text=text_match.group(1) if text_match else kw
                        )
        
        return None
    
    def _is_header_element(self, uid: str) -> bool:
        """判断是否为页眉/导航区域的元素"""
        if not uid:
            return False
        parts = uid.split('_')
        if len(parts) == 2:
            try:
                first_num = int(parts[0])
                second_num = int(parts[1])
                return first_num <= 2 and second_num < 200
            except ValueError:
                pass
        return uid.startswith("1_") or uid.startswith("2_")
    
    def _is_login_page(self, snapshot_text: str) -> bool:
        """判断当前是否为登录页"""
        if not snapshot_text:
            return False
        
        text_lower = snapshot_text.lower()
        login_markers = ["欢迎登录", "请输入用户名", "请输入密码", "login", "sign in"]
        
        matches = sum(1 for m in login_markers if m in text_lower)
        return matches >= 2


def log(msg: str, level: int = 0, timestamp: bool = True):
    """日志输出函数"""
    from datetime import datetime
    if timestamp:
        prefix = datetime.now().strftime("[%H:%M:%S]")
    else:
        prefix = ""
    
    indent = "  " * level
    print(f"{prefix}{indent}{msg}")


if __name__ == "__main__":
    print("LoginManager - 登录状态管理器")
    print("用法: from login_manager import LoginManager")
