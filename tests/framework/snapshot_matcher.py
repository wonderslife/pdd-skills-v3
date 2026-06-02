"""AI Test Framework - 快照解析与匹配引擎

从 run_testcase.py 提取的 SnapshotParser 类，负责：
  - 解析 Chrome DevTools MCP take_snapshot 输出
  - 三层匹配策略（精确/模糊/缓存）
  - 意图检测与元素评分
"""
import re
from typing import Dict, List, Optional, Set, Tuple

from tests.framework.constants import INPUT_ROLES
from tests.framework.snapshot_models import SnapshotElement


def _log(msg: str, level: int = 0):
    """内部日志（debug级别使用print，生产环境可替换为logging）"""
    prefix = "  " * level
    print(f"{prefix}{msg}", flush=True)


class SnapshotParser:
    """
    解析 Chrome DevTools MCP take_snapshot 输出

    v2.0 增强:
      - 多格式兼容（带/不带 uid= 前缀、引号/无引号）
      - 属性提取（name=, url=, value=, checked= 等）
      - 层级结构保留（indent_level）
      - 位置信息记录
      - 高级匹配算法
    """

    KNOWN_ROLES = {
        "rootwebarea", "textbox", "button", "link", "menu", "menuitem",
        "combobox", "listbox", "option", "checkbox", "radio", "slider",
        "switch", "tab", "tabpanel", "dialog", "alert", "statictext",
        "inlinetextbox", "generic", "image", "heading", "grid", "gridcell",
        "row", "columnheader", "table", "list", "listitem", "group",
        "form", "input", "textarea", "select", "navigation", "banner",
        "main", "complementary", "contentinfo", "search", "ignored",
        "document", "application", "iframe", "section", "sectionheader",
        "separator", "progressbar", "meter", "tooltip", "status",
        "timer", "log", "marquee", "spinbutton", "tree", "treeitem",
        "toolbar", "menubar", "figure", "caption", "term", "definition",
        "math", "note", "code", "strong", "emphasis", "delete", "insert",
        "subscript", "superscript", "article", "aside", "footer", "header",
        "nav", "figure", "figcaption", "details", "summary", "mark",
        "time", "address", "blockquote", "q", "cite", "abbr", "bdi", "bdo",
        "data", "dfn", "kbd", "samp", "var", "wbr", "ruby", "rt", "rp",
    }

    def __init__(self):
        self.elements: Dict[str, SnapshotElement] = {}
        self.raw_text: str = ""
        self.element_order: List[str] = []

    def parse(self, snapshot_text: str) -> Dict[str, SnapshotElement]:
        """解析快照文本为结构化元素字典"""
        self.raw_text = snapshot_text
        self.elements = {}
        self.element_order = []

        for line in snapshot_text.split("\n"):
            line = line.rstrip()
            if not line or line.startswith("#") or line.startswith("##"):
                continue

            element = self._parse_line(line)
            if element and element.uid:
                self.elements[element.uid] = element
                self.element_order.append(element.uid)

        return self.elements

    def _parse_line(self, line: str) -> Optional[SnapshotElement]:
        """解析单行快照"""
        stripped = line.lstrip()
        indent = len(line) - len(stripped)

        uid_match = re.match(r'^(uid=)?(\S+)\s+(.*)', stripped)
        if not uid_match:
            return None

        raw_uid = uid_match.group(2)
        uid = raw_uid[4:] if raw_uid.startswith("uid=") else raw_uid
        rest = uid_match.group(3).strip()

        if not rest or uid.startswith("#"):
            return None

        role, name, text, value, attrs = self._parse_tokens(rest)

        return SnapshotElement(
            uid=uid,
            role=role,
            name=name,
            text=text,
            value=value,
            attributes=attrs,
            raw_line=line,
            indent_level=indent // 2,
        )

    def _parse_tokens(self, rest: str) -> Tuple[str, str, str, str, Dict[str, str]]:
        """解析角色、名称、文本和属性"""
        tokens = re.findall(r'("[^"]*"|\S+)', rest)
        i = 0
        role = ""
        name = ""
        text = ""
        value = ""
        attrs = {}

        while i < len(tokens):
            token = tokens[i]

            if token.startswith('"') and token.endswith('"'):
                content = token[1:-1]

                if not role:
                    possible_role = content.lower()
                    if possible_role in self.KNOWN_ROLES:
                        role = possible_role
                    elif not text:
                        text = content
                    else:
                        if not name:
                            name = content
                        else:
                            text = content if not text else text + " " + content
                elif not name and role in INPUT_ROLES:
                    name = content
                else:
                    if not text:
                        text = content
                    elif not name:
                        name = content
                    else:
                        text = text + " " + content
            else:
                lower_token = token.lower()

                if lower_token in self.KNOWN_ROLES and not role:
                    role = lower_token
                elif lower_token.startswith('url='):
                    attrs['url'] = token[4:].strip('"')
                elif lower_token.startswith('name='):
                    name = token[5:].strip('"')
                elif lower_token.startswith('value='):
                    value = token[6:].strip('"')
                elif lower_token.startswith('checked='):
                    attrs['checked'] = token[8:]
                elif lower_token.startswith('selected='):
                    attrs['selected'] = token[9:]
                elif lower_token.startswith('expanded='):
                    attrs['expanded'] = token[9:]
                elif lower_token.startswith('level='):
                    attrs['level'] = token[6:]
                elif lower_token.startswith('orientation='):
                    attrs['orientation'] = token[12:]
                elif lower_token.startswith('for='):
                    attrs['for'] = token[4:]
                elif lower_token.startswith('href='):
                    attrs['href'] = token[5:]
                elif lower_token == 'ignored' and not role:
                    role = "ignored"

            i += 1

        return role, name, text, value, attrs

    def find_uid(self, target_description: str, cache: Dict[str, str],
                 prefer_role: Optional[str] = None,
                 exclude_roles: Optional[set] = None,
                 require_interactive: bool = False) -> Optional[str]:
        """
        三层匹配策略（v3.0）:
          Layer 1: 精确匹配 - target文本与元素text/name/value完全一致或包含
          Layer 2: 模糊评分 - 关键词打分排序（兜底，会打WARN）
          缓存层贯穿始终
        """
        target_lower = (target_description or "").lower().strip()
        target_raw = (target_description or "").strip()

        cached = cache.get(target_lower)
        if cached and cached in self.elements:
            _log(f"[Cache Hit] '{target_description}' -> {cached}", 3)
            return cached

        if not self.elements:
            return None

        exact_uid = self._exact_match_uid(target_raw, target_lower, prefer_role, exclude_roles, require_interactive)
        if exact_uid:
            cache[target_lower] = exact_uid
            elem = self.elements[exact_uid]
            _log(f"[Exact] '{target_description}' -> {exact_uid} "
                f"(role={elem.role}, text='{elem.text[:30]}')", 3)
            return exact_uid

        candidates = self._score_candidates(target_lower, prefer_role, exclude_roles, require_interactive)

        if not candidates:
            _log(f"[Miss] '{target_description}' - 无候选元素", 3)
            self._log_debug_info(target_lower)
            return None

        best_uid, best_score = candidates[0]

        _log(f"[Fuzzy-WARN] '{target_description}' -> {best_uid} (score={best_score}, "
            f"建议YAML使用精确文本匹配以提升可靠性)", 2)

        if best_score > 0:
            cache[target_lower] = best_uid
            elem = self.elements[best_uid]
            _log(f"[Match] '{target_description}' -> {best_uid} "
                f"(score={best_score}, role={elem.role}, text='{elem.text[:30]}')", 3)
        else:
            _log(f"[Low Score] '{target_description}' -> {best_uid} (score={best_score})", 3)

        return best_uid

    def _exact_match_uid(self, target_raw: str, target_lower: str,
                          prefer_role: Optional[str], exclude_roles: Optional[set],
                          require_interactive: bool) -> Optional[str]:
        """Layer 1: 精确文本匹配，交互元素优先"""
        best_uid = None
        best_match_len = 0
        best_is_interactive = False

        for uid, elem in self.elements.items():
            if exclude_roles and elem.role in exclude_roles:
                continue
            if require_interactive and not elem.is_interactive:
                continue
            if prefer_role and elem.role != prefer_role:
                continue

            match_len = 0
            if elem.text and target_raw in elem.text:
                match_len = len(target_raw)
            elif elem.text and elem.text in target_raw:
                match_len = len(elem.text)
            elif elem.name and target_raw in elem.name:
                match_len = len(target_raw) // 2
            elif elem.value and target_raw in elem.value:
                match_len = len(target_raw) // 2

            if match_len > 0:
                is_interactive = elem.is_interactive
                should_update = (
                    match_len > best_match_len or
                    (match_len == best_match_len and is_interactive and not best_is_interactive)
                )
                if should_update:
                    best_match_len = match_len
                    best_uid = uid
                    best_is_interactive = is_interactive

        return best_uid

    def _score_candidates(self, target: str, prefer_role: Optional[str],
                          exclude_roles: Optional[set], require_interactive: bool) -> List[Tuple[str, int]]:
        """对所有候选元素评分并排序"""
        scored = []
        keywords = self._build_keywords(target)

        target_intent = self._detect_intent(target)

        for uid, elem in self.elements.items():
            score = self._score_element(elem, keywords, target_intent, prefer_role, exclude_roles, require_interactive)
            if score > 0:
                scored.append((uid, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:10]

    def _score_element(self, elem: SnapshotElement, keywords: List[str],
                       intent: Dict[str, bool], prefer_role: Optional[str],
                       exclude_roles: Optional[set], require_interactive: bool) -> int:
        """对单个元素评分"""
        score = 0
        combined = elem.combined_text

        if exclude_roles and elem.role in exclude_roles:
            return 0

        if require_interactive and not elem.is_interactive:
            return 0

        for kw in keywords:
            kw_l = kw.lower()

            if elem.role and kw_l in elem.role:
                score += 15
            if elem.name and kw_l in elem.name.lower():
                score += 12
            if elem.text and kw_l in elem.text.lower():
                score += 8
            if elem.value and kw_l in elem.value.lower():
                score += 10
            if kw_l in combined:
                score += 5

        if intent["button"]:
            score += self._score_for_button(elem, intent["target_words"])
        if intent["input"]:
            score += self._score_for_input(elem, intent["target_words"])
        if intent["menu"]:
            score += self._score_for_menu(elem, intent["target_words"])
        if intent["link"]:
            score += self._score_for_link(elem, intent["target_words"])
        if intent["select"]:
            score += self._score_for_select(elem, intent["target_words"])

        if prefer_role and elem.role == prefer_role:
            score += 25

        if elem.uid.startswith("1_") and len(elem.uid) <= 3:
            score -= 10
        elif elem.role == "ignored":
            score -= 30
        elif elem.role == "RootWebArea":
            score -= 25
        elif elem.role in ("StaticText", "InlineTextBox") and intent.get("need_interactive"):
            score -= 15

        return max(0, score)

    def _detect_intent(self, target: str) -> Dict[str, bool]:
        """检测用户意图"""
        words = target.lower().split()
        return {
            "button": any(w in target for w in [
                "按钮", "button", "click", "提交", "submit", "登录", "login",
                "新增", "add", "保存", "save", "删除", "delete", "确认", "confirm",
                "取消", "cancel", "搜索", "search", "查询", "query",
            ]),
            "input": any(w in target for w in [
                "输入框", "input", "字段", "field", "用户名", "密码", "password",
                "名称", "name", "金额", "amount", "项目", "project", "搜索框",
                "填写", "fill", "输入", "type",
            ]),
            "menu": any(w in target for w in [
                "菜单", "menu", "导航", "nav", "侧栏", "sidebar", "展开",
                "expand", "collapse",
            ]),
            "link": any(w in target for w in [
                "入口", "entry", "链接", "link", "系统", "system", "跳转",
            ]),
            "select": any(w in target for w in [
                "下拉", "select", "选择", "option", "类型", "type", "combo",
                "评估类型", "状态",
            ]),
            "need_interactive": True,
            "target_words": words,
        }

    def _score_for_button(self, elem: SnapshotElement, words: List[str]) -> int:
        """按钮类元素加分"""
        score = 0
        if elem.role == "button":
            score += 20
        elif elem.role == "link":
            score += 12
        elif elem.role == "generic" and elem.text and len(elem.text) < 20:
            score += 5

        button_keywords = ["提交", "保存", "新增", "删除", "确认", "搜索", "登录",
                          "login", "submit", "add", "save", "delete", "confirm"]
        if any(kw in elem.text for kw in button_keywords):
            score += 10

        return score

    def _score_for_input(self, elem: SnapshotElement, words: List[str]) -> int:
        """输入框类元素加分"""
        score = 0
        if elem.role in ("textbox", "input"):
            score += 20
        elif elem.role == "combobox":
            score += 15
        elif elem.role == "spinbutton":
            score += 18
        elif "InlineTextBox" in elem.raw_line or "textbox" in elem.raw_line.lower():
            score += 10

        input_keywords = ["用户名", "密码", "名称", "项目", "金额", "搜索", "username",
                         "password", "name", "project", "amount",
                         "评估值", "报送", "万元", "评估方法"]
        if any(kw in elem.text for kw in input_keywords):
            score += 8
        if any(kw in elem.name for kw in input_keywords):
            score += 10

        return score

    def _score_for_menu(self, elem: SnapshotElement, words: List[str]) -> int:
        """菜单类元素加分"""
        score = 0
        if elem.role in ("menuitem", "menu"):
            score += 18
        if any(w in elem.text.lower() for w in words):
            score += 10
        return score

    def _score_for_link(self, elem: SnapshotElement, words: List[str]) -> int:
        """链接类元素加分"""
        score = 0
        if elem.role == "link":
            score += 18
        if any(w in elem.text.lower() for w in words):
            score += 10
        return score

    def _score_for_select(self, elem: SnapshotElement, words: List[str]) -> int:
        """选择框类元素加分"""
        score = 0
        if elem.role in ("combobox", "select"):
            score += 20
        elif elem.role == "option":
            score += 15
        select_keywords = ["类型", "type", "状态", "status", "选择", "select",
                          "评估类型", "eval-type"]
        if any(kw in elem.text or kw in elem.name for kw in select_keywords):
            score += 10
        return score

    @staticmethod
    def _build_keywords(target: str) -> List[str]:
        """构建搜索关键词列表"""
        keywords = [target]

        expansions = {
            "用户名输入框": ["用户名", "username", "user", "账号", "account", "loginname"],
            "密码输入框": ["密码", "password", "passwd", "pass", "pwd"],
            "登录按钮": ["登录", "login", "signin", "sign in", "submit"],
            "资产评估": ["asset", "eval", "评估", "资产"],
            "资产评估菜单": ["资产评估", "asset-eval", "eval-menu"],
            "资产评估核准": ["核准", "approval", "asset-eval-approval"],
            "核准申请": ["核准申请", "approval-apply", "apply"],
            "新增申请按钮": ["新增", "new", "add", "创建", "create", "+", "添加"],
            "项目名称输入框": ["项目名称", "project", "name", "项目"],
            "金额输入框": ["金额", "amount", "money", "price", "评估金额"],
            "报送评估值输入框": ["报送", "评估值", "评估金额", "万元", "amount", "报送评估值"],
            "评估类型下拉框": ["评估类型", "eval-type", "type", "类型", "下拉", "select"],
            "评估方法下拉框": ["评估方法", "eval-method", "method", "方法", "市场法", "收益法", "成本法", "资产基础法", "下拉", "select"],
            "提交按钮": ["提交", "submit", "save", "保存", "确认", "confirm"],
            "资产评估系统": ["资产评估", "asset-eval", "评估系统", "system"],
        }

        for key, exps in expansions.items():
            if key in target or any(e in target for e in exps):
                keywords.extend(exps)

        words = re.split(r'[\s\'\"\(\)\[\]{}、，。：:；;，,]', target)
        keywords.extend([w for w in words if len(w) >= 2])

        return list(set(keywords))

    def _log_debug_info(self, target: str):
        """输出调试信息"""
        interactive = [(u, e.role, e.text[:40]) for u, e in self.elements.items()
                      if e.is_interactive]
        buttons = [(u, e.role, e.text[:40]) for u, e in self.elements.items()
                  if e.role in ("button", "link")]
        inputs = [(u, e.role, e.text[:40]) for u, e in self.elements.items()
                 if e.role in INPUT_ROLES]

        if interactive:
            _log(f"[Debug] Interactive elements ({len(interactive)}): {interactive[:8]}", 3)
        if buttons:
            _log(f"[Debug] Buttons ({len(buttons)}): {buttons[:5]}", 3)
        if inputs:
            _log(f"[Debug] Inputs ({len(inputs)}): {inputs[:5]}", 3)

    def find_all_by_role(self, role: str) -> List[SnapshotElement]:
        """查找所有指定角色的元素"""
        return [e for e in self.elements.values() if e.role == role]

    def find_by_text_contains(self, text: str) -> List[SnapshotElement]:
        """查找包含指定文本的所有元素"""
        text_lower = text.lower()
        return [e for e in self.elements.values()
                if text_lower in e.text.lower() or text_lower in e.name.lower()]

    def get_element_context(self, uid: str, radius: int = 2) -> List[SnapshotElement]:
        """获取元素的上下文（前后相邻元素）"""
        if uid not in self.element_order:
            return []

        idx = self.element_order.index(uid)
        start = max(0, idx - radius)
        end = min(len(self.element_order), idx + radius + 1)
        return [self.elements[self.element_order[i]] for i in range(start, end)]
