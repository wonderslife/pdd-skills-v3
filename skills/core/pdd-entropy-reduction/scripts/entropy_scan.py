#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDD 熵减检测脚本

用于检测代码库中的熵增问题，包括：
- 文档-代码不一致
- 架构边界违规
- 重复代码
- 过期TODO
- 复杂度过高

使用方法:
    python entropy_scan.py --project /path/to/project --output report.md
"""

import os
import re
import json
import math
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple, Any
from dataclasses import dataclass, field
from collections import defaultdict


# ---------------------------------------------------------------------------
# 评分口径：0-100，100 = 最有秩序（高分 = 健康）
# 对齐 SKILL.md「熵评分系统(0-100，100=最有秩序)」：
#   90-100 优秀 | 70-89 良好 | 50-69 一般 | 30-49 警告 | 0-29 危急
#
# 扣分 → 评分的折算采用「按规模归一化（per-KLOC）」：
#   维度评分 = 100 - (扣分累计 / 代码规模K行) / 容忍密度
# 直接线性相减（100 - 扣分累计）在中大型项目上必然撞底：
# 十几万行的项目里 60 个长函数就扣满 100 分，导致所有大项目「代码质量」恒为 0、
# 彼此没有区分度，也无法反映「改一处涨多少分」。归一化后：
#   - 100 KLOC 项目扣 60 分 → 0.6 分/K行 → 良好档
#   - 5 KLOC 小项目扣 60 分  → 12 分/K行  → 危急档
# 这才是「同样的问题密度，大项目不应比小项目更差」的正确表达。
# ---------------------------------------------------------------------------
SCORE_MIN = 0
SCORE_MAX = 100

# 各维度「容忍密度」：每 KLOC 的扣分达到该值时，该维度扣满 100 分（评分归 0）。
# 取值参照三个真实项目的实测扣分密度标定（若依 v6 131 KLOC / pdd-test-system 16 KLOC /
# pdd-skills-v3 195 KLOC 的 code 密度分别为 37.6 / 41.1 / 26.7 分每 KLOC）：
#   - 健康项目（几乎无问题）→ 密度 ≈ 0 → 评分 ≈ 100
#   - 上述三个真实项目 → 落在「一般 ~ 良好」档，与现实观感一致
#   - 只有密度再翻 1.2~2 倍（问题密集成灾）才归 0 分，避免中大型项目一律撞底
SCALE_TOLERANCE = {
    'doc': 6.0,     # 文档类问题偏致命，容忍度低
    'arch': 10.0,   # 架构违规少但重
    'code': 45.0,   # 复杂度/命名类问题量大且普遍，容忍度最高
    'debt': 10.0,   # 技术债居中
}

# 规模统计的最小地板（KLOC）：防止极小项目因 1 条问题就被归一化公式放成 0 分
MIN_KLOC = 1.0

# 语言分派：括号型用 {} 判断作用域，缩进型（Python）用缩进
BRACE_SUFFIXES = {'.ts', '.js', '.tsx', '.jsx', '.java', '.go', '.rs'}
PY_SUFFIXES = {'.py'}
ANALYZABLE_SUFFIXES = BRACE_SUFFIXES | PY_SUFFIXES

# 括号型语言里不能当函数名的关键字（防止把 if/for/while/new 误判成方法）
CONTROL_KEYWORDS = {
    'if', 'else', 'for', 'while', 'switch', 'case', 'catch', 'try', 'finally',
    'do', 'return', 'new', 'throw', 'delete', 'typeof', 'instanceof', 'in', 'of',
    'void', 'yield', 'await', 'super', 'this', 'class', 'interface', 'enum',
    'record', 'package', 'import', 'assert', 'synchronized', 'default', 'extends',
    'implements', 'throws',
}

# Python: def 定义行（捕获缩进与函数名）
_PY_FUNC_RE = re.compile(r'^(?P<indent>[ \t]*)(?:async\s+)?def\s+(?P<name>\w+)\s*\(')

# JS/TS: 三种函数写法
_BRACE_METHOD_RES = (
    # function name(...)      /  async function* name(...)
    re.compile(r'^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\('),
    # const name = (...) =>   /  const name = async (a) =>
    re.compile(r'^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>'),
    # 类方法/对象方法：name(...) {  /  async name(...) {  /  static name(...) {
    re.compile(r'^\s*(?:(?:public|private|protected|static|async|readonly|override|get|set)\s+)*([A-Za-z_$][\w$]*)\s*\([^;{}]*\)\s*(?::\s*[^;{}]+?)?\s*\{'),
)

# Java: (修饰符)* (返回类型)+ 方法名(...)  {
_JAVA_METHOD_RE = re.compile(
    r'^\s*(?:(?:public|private|protected|static|final|abstract|synchronized|native|default|strictfp)\s+)*'
    r'(?:[\w$<>\[\],\.\?]+\s+)+([A-Za-z_$][\w$]*)\s*\([^;{}]*\)\s*(?:throws\s+[\w\.,\s$]+)?\{'
)

# 行首第一个标识符：用来快速排除 return / new / else 这种语句行
_FIRST_WORD_RE = re.compile(r'^\s*(?:@\w+\s+)*([A-Za-z_$][\w$]*)')


def score_to_status(score: int) -> str:
    """0-100 评分 → 状态文案（100 = 最有秩序）"""
    if score >= 90:
        return "🟢 优秀"
    if score >= 70:
        return "🟢 良好"
    if score >= 50:
        return "🟡 一般"
    if score >= 30:
        return "🟠 警告"
    return "🔴 危急"


def strip_line_noise(line: str, suffix: str) -> str:
    """剥掉行内字符串字面量与注释，供 {} 配对与缩进判断使用。

    逐字符扫描而非正则替换：避免 URL 里的 // 与字符串里的引号互相干扰。
    """
    out = []
    quote = None
    i = 0
    n = len(line)
    is_py = suffix in PY_SUFFIXES
    while i < n:
        ch = line[i]
        if quote is not None:
            if ch == '\\':
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue
        if is_py and ch == '#':
            break
        if not is_py and ch == '/' and i + 1 < n and line[i + 1] == '/':
            break
        if ch in ('"', "'", '`'):
            quote = ch
            i += 1
            continue
        out.append(ch)
        i += 1
    return ''.join(out)


def indent_width(line: str) -> int:
    """缩进宽度（tab 记 4 空格）"""
    body = line.lstrip(' \t')
    return len(line[:len(line) - len(body)].replace('\t', '    '))


def match_function_name(code_line: str, suffix: str):
    """已剥离字符串/注释的行 → 函数名；不是函数定义行则返回 None"""
    first = _FIRST_WORD_RE.match(code_line)
    if first and first.group(1) in CONTROL_KEYWORDS:
        return None

    candidates = (_JAVA_METHOD_RE,) if suffix == '.java' else _BRACE_METHOD_RES
    for pattern in candidates:
        m = pattern.match(code_line)
        if not m:
            continue
        name = m.group(1)
        if name in CONTROL_KEYWORDS:
            continue
        return name
    return None


def find_python_functions(noise_lines: List[str]) -> List[Tuple[str, int, int]]:
    """Python 函数区间 [(名字, 起始行下标, 结束行下标)]，以缩进回到定义行为结束标志"""
    starts: List[Tuple[int, int, str]] = []
    for i, line in enumerate(noise_lines):
        m = _PY_FUNC_RE.match(line)
        if m and m.group('name') not in CONTROL_KEYWORDS:
            starts.append((i, len(m.group('indent').replace('\t', '    ')), m.group('name')))

    total = len(noise_lines)
    found: List[Tuple[str, int, int]] = []
    for start, indent, name in starts:
        end = total - 1
        for j in range(start + 1, total):
            if not noise_lines[j].strip():
                continue
            if indent_width(noise_lines[j]) <= indent:
                end = j - 1
                break
        # 回退尾部空行，否则函数长度会把定义与下一个定义之间的空行也算进去
        while end > start and not noise_lines[end].strip():
            end -= 1
        found.append((name, start, end))
    return found


def find_brace_functions(noise_lines: List[str], suffix: str) -> List[Tuple[str, int, int]]:
    """括号型语言（JS/TS/Java/Go/Rust）的函数区间，按 {} 配对找结尾"""
    total = len(noise_lines)
    found: List[Tuple[str, int, int]] = []
    i = 0
    while i < total:
        name = match_function_name(noise_lines[i], suffix)
        if name is None:
            i += 1
            continue

        balance = 0
        opened = False
        end = i
        j = i
        while j < total:
            balance += noise_lines[j].count('{') - noise_lines[j].count('}')
            if not opened and '{' in noise_lines[j]:
                opened = True
            if opened and balance <= 0:
                end = j
                break
            if not opened and j - i >= 3:
                # const f = () => x + 1 这类单表达式函数没有块体
                end = i
                break
            j += 1
        if j >= total:
            end = total - 1

        found.append((name, i, end))
        i = end + 1
    return found


_BLOCK_KEYWORD_TAIL = ('else', 'try', 'finally', 'do')
_CLASS_LIKE_RE = re.compile(r'\b(?:class|interface|enum|struct|impl|trait|namespace|record)\s+[\w$<>\[\]\.]+$')


def is_block_open(line: str, pos: int) -> bool:
    """判断第 pos 位的 '{' 是逻辑块（控制流/函数/类）还是字面量（对象/数组/字典）

    只看 '{' 紧邻的前文：`)` 与 `=>` 后面是块，`=`/`,`/`(`/`[`/`:`/`return` 后面是字面量。
    不区分的话，配置对象与字典字面量会顶出虚高的「嵌套深度」。
    """
    before = line[:pos].rstrip()
    if not before:
        return True
    if before[-1] in ')>':
        return True
    if any(re.search(rf'\b{kw}$', before) for kw in _BLOCK_KEYWORD_TAIL):
        return True
    return bool(_CLASS_LIKE_RE.search(before))


def brace_nesting_depth(noise_lines: List[str]) -> Tuple[int, int]:
    """按逻辑块统计最大嵌套深度，返回 (深度, 行号)

    用栈记录每个 '{' 是否计入，闭合时按同一属性出栈，
    这样「字面量不计入」不会把深度算成负数。
    """
    stack: List[bool] = []
    depth = 0
    max_depth = 0
    max_line = 0
    for i, line in enumerate(noise_lines):
        for pos, ch in enumerate(line):
            if ch == '{':
                counted = is_block_open(line, pos)
                stack.append(counted)
                if counted:
                    depth += 1
                    if depth > max_depth:
                        max_depth = depth
                        max_line = i + 1
            elif ch == '}' and stack and stack.pop():
                depth -= 1
        if depth < 0:
            depth = 0
    return max_depth, max_line


def python_nesting_depth(noise_lines: List[str]) -> Tuple[int, int]:
    """按缩进统计最大嵌套层级，返回 (层级, 行号)

    续行（上一条语句括号未闭合，或以反斜杠续行）不参与层级判定，
    否则续行的对齐缩进会把深度凭空抬高。
    """
    stack: List[int] = []
    max_depth = 0
    max_line = 0
    pending = 0
    continuation = False

    for i, line in enumerate(noise_lines):
        if not line.strip():
            continue

        was_continuation = continuation
        pending += (line.count('(') + line.count('[') + line.count('{')
                    - line.count(')') - line.count(']') - line.count('}'))
        continuation = line.rstrip().endswith('\\') or pending > 0

        if was_continuation:
            continue

        indent = indent_width(line)
        while stack and stack[-1] >= indent:
            stack.pop()
        stack.append(indent)
        # 减 1：顶层（缩进 0）不算嵌套块，与 JS/Java 的大括号层数口径对齐
        depth = len(stack) - 1
        if depth > max_depth:
            max_depth = depth
            max_line = i + 1

    return max_depth, max_line


# 命名规则：按语言分别取（原来只认 JS 语法）
_JS_NAMING_RULES = [
    (r'\bvar\s+[a-z]\b', '单字母变量名'),
    (r'\bfunction\s+[a-z]\s*\(', '单字母函数名'),
    # 排除 Node ESM 的两个标准全局常量，它们本来就带双下划线，不是命名问题
    (r'\b(const|let|var)\s+(?!__dirname\b|__filename\b)_\w+', '下划线前缀变量'),
]

_PY_NAMING_RULES = [
    (r'^\s*def\s+[a-z]\s*\(', '单字母函数名'),
    (r'^\s*[a-z]\s*=[^=]', '单字母变量名'),
    (r'^\s*class\s+[a-z]', '类名未用大驼峰'),
]

_JAVA_NAMING_RULES = [
    (r'\b(?:public|private|protected)\s+[\w<>\[\],\.\?]+\s+([a-z])\s*\(', '单字母方法名'),
    (r'\bclass\s+[a-z]\w*', '类名未用大驼峰'),
]


def is_test_file(path: Path) -> bool:
    """是否测试文件（多语言）"""
    if path.suffix.lower() not in ANALYZABLE_SUFFIXES:
        return False
    name = path.name.lower()
    return (
        '.test.' in name or '.spec.' in name
        or name.startswith('test_') or name.endswith('_test.py')
        or name.endswith('test.java') or name.endswith('tests.java') or name.endswith('it.java')
    )


def is_source_file(path: Path) -> bool:
    """是否 src/ 下的生产源码"""
    if path.suffix.lower() not in ANALYZABLE_SUFFIXES or is_test_file(path):
        return False
    return 'src' in path.parts


@dataclass
class EntropyIssue:
    """熵增问题"""
    category: str           # 类别: doc, arch, code, debt
    severity: str           # 严重程度: critical, high, medium, low
    title: str              # 问题标题
    location: str           # 位置
    description: str        # 描述
    suggestion: str         # 建议
    score: int = 0          # 熵值贡献


@dataclass
class EntropyReport:
    """熵减报告"""
    project_path: str
    scan_time: str
    doc_entropy: int = 0
    arch_entropy: int = 0
    code_entropy: int = 0
    debt_entropy: int = 0
    total_entropy: int = 0
    code_lines: int = 0        # 参与扫描的代码总行数（评分归一化基数）
    issues: List[EntropyIssue] = field(default_factory=list)

    @property
    def kloc(self) -> float:
        """代码规模（千行），带地板值避免极小项目被过度放大"""
        return max(MIN_KLOC, self.code_lines / 1000.0)

    def calculate_total(self):
        """计算综合评分 = 各维度加权平均（0-100，100 = 最有秩序）"""
        self.total_entropy = int(
            self.doc_entropy * 0.25 +
            self.arch_entropy * 0.30 +
            self.code_entropy * 0.25 +
            self.debt_entropy * 0.20
        )

    def get_status(self) -> str:
        """获取状态（0-100，100 = 最有秩序）"""
        return score_to_status(self.total_entropy)


class EntropyScanner:
    """熵减扫描器"""
    
    def __init__(self, project_path: str):
        self.project_path = Path(project_path)
        self.issues: List[EntropyIssue] = []
        
        # 配置
        self.config = {
            'todo_stale_days': 30,
            'doc_stale_days': 90,
            'complexity_threshold': 20,
            'function_length_threshold': 50,   # 对齐 SKILL.md 黄金原则 3「单函数≤50行」
            'nesting_threshold': 5,
            'duplicate_threshold': 5,
        }
        
        # 排除目录（含第三方依赖与虚拟环境，避免把别人的代码算进自己的技术债）
        self.exclude_dirs = {
            'node_modules', 'dist', 'build', '.git', '__pycache__',
            'target', 'vendor', '.idea', '.vscode',
            '.venv', 'venv', 'site-packages', 'dist-packages',
            '.tox', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.next', 'coverage',
        }

        # 文档引用索引的缓存（惰性构建，见 _is_doc_referenced）
        self._reference_corpus = None

        # 代码行数缓存（惰性构建，见 _count_code_lines）
        self._code_lines_cache = None
        
        # 文档目录
        self.doc_dirs = {'docs', 'doc', 'documentation'}
        
        # 六层模型
        self.layers = {
            'types': 1,
            'config': 2,
            'repo': 3,
            'service': 4,
            'runtime': 5,
            'ui': 6
        }
    
    def scan(self) -> EntropyReport:
        """执行扫描"""
        report = EntropyReport(
            project_path=str(self.project_path),
            scan_time=datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        )
        
        # 1. 文档一致性扫描
        doc_issues = self._scan_document_consistency()
        report.doc_entropy = self._calculate_category_entropy(doc_issues, 'doc')
        self.issues.extend(doc_issues)
        
        # 2. 架构边界扫描
        arch_issues = self._scan_architecture_violations()
        report.arch_entropy = self._calculate_category_entropy(arch_issues, 'arch')
        self.issues.extend(arch_issues)
        
        # 3. 代码质量扫描
        code_issues = self._scan_code_quality()
        report.code_entropy = self._calculate_category_entropy(code_issues, 'code')
        self.issues.extend(code_issues)
        
        # 4. 技术债务扫描
        debt_issues = self._scan_technical_debt()
        report.debt_entropy = self._calculate_category_entropy(debt_issues, 'debt')
        self.issues.extend(debt_issues)

        # 5. 规模统计（供评分归一化与报告口径说明使用）
        report.code_lines = self._count_code_lines()

        report.issues = self.issues
        report.calculate_total()
        
        return report

    def _count_code_lines(self) -> int:
        """统计参与扫描的代码总行数（与 _scan_code_quality 同一文件集合，保证口径一致）"""
        if self._code_lines_cache is not None:
            return self._code_lines_cache

        total = 0
        for file_path in self._iter_code_files():
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    total += sum(1 for _ in f)
            except Exception:
                continue

        self._code_lines_cache = total
        return total
    
    def _scan_document_consistency(self) -> List[EntropyIssue]:
        """扫描文档一致性"""
        issues = []
        
        # 1. 检查过期TODO
        issues.extend(self._check_stale_todos())
        
        # 2. 检查孤立文档
        issues.extend(self._check_orphan_docs())
        
        # 3. 检查API文档一致性
        issues.extend(self._check_api_doc_consistency())
        
        return issues
    
    def _check_stale_todos(self) -> List[EntropyIssue]:
        """检查过期TODO"""
        issues = []
        stale_threshold = datetime.now() - timedelta(days=self.config['todo_stale_days'])
        
        todo_pattern = re.compile(
            r'(?://|#)\s*(TODO|FIXME|HACK|XXX):\s*(.+?)(?:\s*-\s*(\d{4}-\d{2}-\d{2}))?$',
            re.IGNORECASE
        )
        
        for file_path in self._iter_code_files():
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    for line_num, line in enumerate(f, 1):
                        match = todo_pattern.search(line)
                        if match:
                            todo_type, content, date_str = match.groups()
                            
                            if date_str:
                                todo_date = datetime.strptime(date_str, '%Y-%m-%d')
                                if todo_date < stale_threshold:
                                    issues.append(EntropyIssue(
                                        category='doc',
                                        severity='medium',
                                        title=f'过期{todo_type.upper()}',
                                        location=f'{file_path}:{line_num}',
                                        description=f'{todo_type}: {content} (创建于 {date_str})',
                                        suggestion='完成或删除此TODO',
                                        score=5
                                    ))
            except Exception:
                continue
        
        return issues
    
    def _check_orphan_docs(self) -> List[EntropyIssue]:
        """检查孤立文档"""
        issues = []
        
        # 查找文档目录
        for doc_dir in self.doc_dirs:
            doc_path = self.project_path / doc_dir
            if not doc_path.exists():
                continue
            
            # 检查每个文档文件
            for doc_file in doc_path.rglob('*.md'):
                # 检查是否有对应的代码文件
                doc_name = doc_file.stem
                
                # 特殊文档不需要对应代码
                special_docs = {'README', 'CHANGELOG', 'CONTRIBUTING', 'LICENSE', 'index'}
                if doc_name in special_docs:
                    continue
                
                # 检查是否被引用
                referenced = self._is_doc_referenced(doc_file)
                if not referenced:
                    issues.append(EntropyIssue(
                        category='doc',
                        severity='low',
                        title='孤立文档',
                        location=str(doc_file.relative_to(self.project_path)),
                        description='文档未被任何代码或其他文档引用',
                        suggestion='检查是否需要归档或删除',
                        score=3
                    ))
        
        return issues
    
    def _is_doc_referenced(self, doc_file: Path) -> bool:
        """检查文档是否被引用（全部文件内容只读一次并缓存，避免逐文档全量重扫）"""
        if self._reference_corpus is None:
            chunks = []
            for candidate in self._iter_all_files():
                if candidate.suffix.lower() in ANALYZABLE_SUFFIXES | {'.md'}:
                    try:
                        chunks.append(candidate.read_text(encoding='utf-8', errors='ignore'))
                    except Exception:
                        continue
            self._reference_corpus = '\n'.join(chunks)

        return (doc_file.name in self._reference_corpus
                or str(doc_file.relative_to(self.project_path)) in self._reference_corpus)

    def _check_api_doc_consistency(self) -> List[EntropyIssue]:
        """检查API文档一致性"""
        issues = []
        
        # 查找API定义文件
        api_files = []
        for suffix in sorted(ANALYZABLE_SUFFIXES):
            api_files.extend(self.project_path.rglob(f'**/api/*{suffix}'))

        # 查找API文档
        api_docs = list(self.project_path.rglob('**/docs/api/*.md'))
        
        if api_files and not api_docs:
            issues.append(EntropyIssue(
                category='doc',
                severity='high',
                title='缺少API文档',
                location='docs/api/',
                description=f'发现 {len(api_files)} 个API文件，但没有对应的API文档',
                suggestion='创建API文档目录并编写文档',
                score=10
            ))
        
        return issues
    
    def _scan_architecture_violations(self) -> List[EntropyIssue]:
        """扫描架构违规"""
        issues = []
        
        # 检查六层模型违规
        issues.extend(self._check_layer_violations())
        
        # 检查循环依赖
        issues.extend(self._check_circular_dependencies())
        
        return issues
    
    def _check_layer_violations(self) -> List[EntropyIssue]:
        """检查层级违规"""
        issues = []
        
        # 定义层级检测规则
        layer_patterns = {
            'ui': ['components/', 'views/', 'pages/', 'ui/'],
            'service': ['services/', 'service/', 'business/'],
            'repo': ['repositories/', 'repo/', 'dao/', 'data/'],
            'config': ['config/', 'configuration/'],
            'types': ['types/', 'interfaces/', 'models/'],
        }
        
        for file_path in self._iter_code_files():
            file_str = str(file_path)
            
            # 确定文件所在层级
            file_layer = None
            for layer, patterns in layer_patterns.items():
                if any(p in file_str for p in patterns):
                    file_layer = layer
                    break
            
            if not file_layer:
                continue
            
            # 检查导入
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    
                    # 检查导入（支持 JS/TS、Python、Java 三种导入语法）
                    imports = self._extract_imports(content, file_path.suffix.lower())

                    for layer, patterns in layer_patterns.items():
                        if self.layers.get(layer, 0) <= self.layers.get(file_layer, 0):
                            continue
                        for pattern in patterns:
                            key = pattern.rstrip('/')
                            if any(key in imp for imp in imports):
                                issues.append(EntropyIssue(
                                    category='arch',
                                    severity='critical',
                                    title='层级违规',
                                    location=str(file_path.relative_to(self.project_path)),
                                    description=f'{file_layer}层导入了{layer}层（{key}）',
                                    suggestion='重构以符合六层依赖模型',
                                    score=15
                                ))
                                break
            except Exception:
                continue
        
        return issues
    
    def _check_circular_dependencies(self) -> List[EntropyIssue]:
        """检查循环依赖"""
        issues = []
        
        # 简化的循环依赖检测
        imports = defaultdict(set)
        
        for file_path in self._iter_code_files():
            if file_path.suffix not in {'.ts', '.js', '.tsx', '.jsx'}:
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    
                    # 提取导入
                    import_pattern = re.compile(r"from\s+['\"](.+?)['\"]")
                    for match in import_pattern.finditer(content):
                        import_path = match.group(1)
                        if not import_path.startswith('.'):
                            continue
                        
                        # 解析相对路径
                        source = str(file_path.relative_to(self.project_path))
                        imports[source].add(import_path)
            except Exception:
                continue
        
        # 检测循环（简化版）
        # 实际实现需要完整的依赖图分析
        
        return issues
    
    def _scan_code_quality(self) -> List[EntropyIssue]:
        """扫描代码质量"""
        issues = []
        
        # 检查复杂度
        issues.extend(self._check_complexity())
        
        # 检查重复代码
        issues.extend(self._check_duplicates())
        
        # 检查命名规范
        issues.extend(self._check_naming())
        
        return issues
    
    def _check_complexity(self) -> List[EntropyIssue]:
        """检查代码复杂度"""
        issues = []
        
        for file_path in self._iter_code_files():
            if file_path.suffix not in ANALYZABLE_SUFFIXES:
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()
                    
                    # 检查函数长度
                    self._check_function_length(file_path, lines, issues)
                    
                    # 检查嵌套深度
                    self._check_nesting_depth(file_path, lines, issues)
            except Exception:
                continue
        
        return issues
    
    def _extract_imports(self, content: str, suffix: str) -> set:
        """提取文件里的导入路径，支持 JS/TS、Python、Java 三种语法"""
        imports = set()
        if suffix in PY_SUFFIXES:
            for m in re.finditer(r'^\s*from\s+([\w\.]+)\s+import\b', content, re.M):
                imports.add(m.group(1))
            for m in re.finditer(r'^\s*import\s+([\w\.]+)', content, re.M):
                imports.add(m.group(1))
        elif suffix == '.java':
            for m in re.finditer(r'^\s*import\s+(?:static\s+)?([\w\.]+)\s*;', content, re.M):
                imports.add(m.group(1))
        else:
            for m in re.finditer(r"""from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]""", content):
                imports.add(m.group(1) or m.group(2))
        return imports

    def _iter_functions(self, file_path: Path, lines: List[str]) -> List[Tuple[str, int, int]]:
        """列出文件里的函数区间 [(名字, 起始行下标, 结束行下标)]，按语言分派"""
        suffix = file_path.suffix.lower()
        noise = [strip_line_noise(line, suffix) for line in lines]
        if suffix in PY_SUFFIXES:
            return find_python_functions(noise)
        return find_brace_functions(noise, suffix)

    def _check_function_length(self, file_path: Path, lines: List[str], issues: List[EntropyIssue]):
        """检查函数长度（JS/TS、Python、Java 通用；阈值对齐「单函数≤50行」）"""
        threshold = self.config['function_length_threshold']

        for name, start, end in self._iter_functions(file_path, lines):
            length = end - start + 1
            if length > threshold:
                issues.append(EntropyIssue(
                    category='code',
                    severity='medium',
                    title='函数过长',
                    location=f'{file_path}:{start + 1}',
                    description=f'函数 {name} 有 {length} 行，超过阈值 {threshold}',
                    suggestion='拆分为更小的函数',
                    score=8
                ))
    
    def _check_nesting_depth(self, file_path: Path, lines: List[str], issues: List[EntropyIssue]):
        """检查嵌套深度（JS/TS/Java 按 {} 计，Python 按缩进计）"""
        threshold = self.config['nesting_threshold']
        suffix = file_path.suffix.lower()

        if suffix in PY_SUFFIXES:
            noise = [strip_line_noise(line, suffix) for line in lines]
            max_depth, max_depth_line = python_nesting_depth(noise)
        else:
            noise = [strip_line_noise(line, suffix) for line in lines]
            max_depth, max_depth_line = brace_nesting_depth(noise)

        if max_depth > threshold:
            issues.append(EntropyIssue(
                category='code',
                severity='medium',
                title='嵌套过深',
                location=f'{file_path}:{max_depth_line}',
                description=f'最大嵌套深度 {max_depth}，超过阈值 {threshold}',
                suggestion='使用早返回或提取方法减少嵌套',
                score=6
            ))
    
    def _check_duplicates(self) -> List[EntropyIssue]:
        """检查重复代码"""
        issues = []
        
        # 简化的重复检测
        code_blocks = defaultdict(list)
        block_size = 10  # 代码块大小（按整块步进，逐行滑动会让一个重复区域产出几十条重复告警）
        
        for file_path in self._iter_code_files():
            if file_path.suffix not in ANALYZABLE_SUFFIXES:
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()
                    
                    # +1 保证最后一个整块也被扫到，否则 len 正好是块整数倍时会漏尾块
                    for i in range(0, len(lines) - block_size + 1, block_size):
                        block = ''.join(lines[i:i+block_size]).strip()
                        if len(block) > 50:  # 忽略太短的块
                            code_blocks[block].append((str(file_path), i+1))
            except Exception:
                continue
        
        # 找出重复的块，再按「涉及的文件组」合并：同一组文件只报一条，
        # 否则一个跨文件的重复区域会刷出成百上千条同类告警
        grouped = defaultdict(list)
        for block, locations in code_blocks.items():
            if len(locations) >= self.config['duplicate_threshold']:
                grouped[frozenset(p for p, _ in locations)].append(locations)

        for files, hits in sorted(grouped.items(), key=lambda kv: -len(kv[1])):
            flat = [loc for locations in hits for loc in locations]
            issues.append(EntropyIssue(
                category='code',
                severity='high',
                title='重复代码',
                location=', '.join(f'{p}:{l}' for p, l in flat[:3]),
                description=f'{len(files)} 个文件之间存在 {len(hits)} 处相似代码块（合计 {len(flat)} 处命中）',
                suggestion='提取到共享函数',
                score=12
            ))
        
        return issues
    
    def _check_naming(self) -> List[EntropyIssue]:
        """检查命名规范（JS/TS、Python、Java 各取自己的一套规则）"""
        issues = []

        for file_path in self._iter_code_files():
            suffix = file_path.suffix.lower()
            if suffix in PY_SUFFIXES:
                rules = _PY_NAMING_RULES
            elif suffix == '.java':
                rules = _JAVA_NAMING_RULES
            else:
                rules = _JS_NAMING_RULES

            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    for line_num, line in enumerate(f, 1):
                        for pattern, desc in rules:
                            if re.search(pattern, line):
                                issues.append(EntropyIssue(
                                    category='code',
                                    severity='low',
                                    title='命名不规范',
                                    location=f'{file_path}:{line_num}',
                                    description=desc,
                                    suggestion='使用更具描述性的名称',
                                    score=2
                                ))
            except Exception:
                continue

        return issues
    
    def _scan_technical_debt(self) -> List[EntropyIssue]:
        """扫描技术债务"""
        issues = []
        
        # 检查TODO数量
        todo_count = sum(1 for issue in self.issues if 'TODO' in issue.title)
        if todo_count > 20:
            issues.append(EntropyIssue(
                category='debt',
                severity='high',
                title='技术债务过多',
                location='全局',
                description=f'发现 {todo_count} 个未处理的TODO',
                suggestion='分配时间偿还技术债务',
                score=15
            ))
        
        # 检查测试覆盖率（简化）
        all_files = list(self._iter_all_files())
        test_files = [p for p in all_files if is_test_file(p)]
        source_files = [p for p in all_files if is_source_file(p)]
        
        if source_files and len(test_files) / len(source_files) < 0.5:
            issues.append(EntropyIssue(
                category='debt',
                severity='medium',
                title='测试覆盖率低',
                location='tests/',
                description=f'测试文件与源文件比例: {len(test_files)}/{len(source_files)}',
                suggestion='增加单元测试',
                score=8
            ))
        
        return issues
    
    def _calculate_category_entropy(self, issues: List[EntropyIssue], category: str = '') -> int:
        """把问题扣分折算为 0-100 的维度评分（100 = 无问题）

        折算方式：按代码规模归一化 + 平方根压缩，避免大项目一律撞底。
            ratio  = (扣分 / KLOC) / 容忍密度        # 0=完美，1=扣满
            评分   = 100 - 100 * sqrt(min(1, ratio))

        用 sqrt 而不是线性：线性在低密度区间斜率过陡（密度 10/KLOC 就掉到 78 分），
        区分度全挤在高分区；sqrt 让 0~45 这一整段都能拉开差距，
        同时保留「密度达到容忍值即归 0」的上界语义。
        """
        if not issues:
            return SCORE_MAX

        total_score = sum(issue.score for issue in issues)
        if not category:
            category = issues[0].category

        tolerance = SCALE_TOLERANCE.get(category, 45.0)
        kloc = max(MIN_KLOC, (self._code_lines_cache or self._count_code_lines()) / 1000.0)

        ratio = (total_score / kloc) / tolerance
        penalty = 100.0 * math.sqrt(min(1.0, ratio))
        return max(SCORE_MIN, SCORE_MAX - int(round(penalty)))
    
    def _iter_code_files(self):
        """迭代代码文件"""
        for file_path in self.project_path.rglob('*'):
            if file_path.is_file() and file_path.suffix in {
                '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rs'
            }:
                # 排除目录
                if any(part in self.exclude_dirs for part in file_path.parts):
                    continue
                yield file_path
    
    def _iter_all_files(self):
        """迭代所有文件"""
        for file_path in self.project_path.rglob('*'):
            if file_path.is_file():
                if any(part in self.exclude_dirs for part in file_path.parts):
                    continue
                yield file_path


def generate_report(report: EntropyReport, output_format: str = 'markdown') -> str:
    """生成报告"""
    if output_format == 'json':
        return json.dumps({
            'project_path': report.project_path,
            'scan_time': report.scan_time,
            'code_lines': report.code_lines,
            'kloc': round(report.kloc, 1),
            'entropy': {
                'doc': report.doc_entropy,
                'arch': report.arch_entropy,
                'code': report.code_entropy,
                'debt': report.debt_entropy,
                'total': report.total_entropy
            },
            'status': report.get_status(),
            'score_scale': '0-100, 100 = most ordered (higher is healthier)',
            'score_model': 'density-normalized + sqrt compression: score = 100 - 100 * sqrt(min(1, deduction/KLOC / tolerance))',
            'scale_tolerance': SCALE_TOLERANCE,

            'score_bands': {
                'excellent': '90-100',
                'good': '70-89',
                'fair': '50-69',
                'warning': '30-49',
                'critical': '0-29'
            },
            'issues': [
                {
                    'category': i.category,
                    'severity': i.severity,
                    'title': i.title,
                    'location': i.location,
                    'description': i.description,
                    'suggestion': i.suggestion
                }
                for i in report.issues
            ]
        }, indent=2, ensure_ascii=False)
    
    # Markdown 格式
    md = f"""# PDD 熵减报告

## 报告元信息

- **项目路径**: {report.project_path}
- **扫描时间**: {report.scan_time}
- **报告ID**: ER-{datetime.now().strftime('%Y%m%d-%H%M%S')}
- **代码规模**: {report.code_lines} 行（{report.kloc:.1f} KLOC）

## 评分总览

| 维度 | 评分 (0-100) | 状态 |
|------|------|------|
| 文档一致性 | {report.doc_entropy} | {score_to_status(report.doc_entropy)} |
| 架构合规性 | {report.arch_entropy} | {score_to_status(report.arch_entropy)} |
| 代码质量 | {report.code_entropy} | {score_to_status(report.code_entropy)} |
| 技术债务 | {report.debt_entropy} | {score_to_status(report.debt_entropy)} |
| **综合评分** | **{report.total_entropy}** | **{report.get_status()}** |

> 评分口径：**0-100，100 = 最有秩序**（高分=健康）。分档 90-100 优秀 / 70-89 良好 / 50-69 一般 / 30-49 警告 / 0-29 危急。
> 维度评分按代码规模归一化后开方压缩：`评分 = 100 - 100 × sqrt(min(1, 扣分/KLOC ÷ 容忍密度))`，规模地板 {MIN_KLOC:.0f} KLOC。
> 容忍密度（每 KLOC 扣分达到该值即归 0 分）：文档 {SCALE_TOLERANCE['doc']} / 架构 {SCALE_TOLERANCE['arch']} / 代码 {SCALE_TOLERANCE['code']} / 债务 {SCALE_TOLERANCE['debt']}。同样的问题密度，不同规模项目得分可比。

## 问题清单

"""
    
    # 按严重程度分组
    by_severity = defaultdict(list)
    for issue in report.issues:
        by_severity[issue.severity].append(issue)
    
    for severity in ['critical', 'high', 'medium', 'low']:
        if by_severity[severity]:
            md += f"### {severity.upper()} ({len(by_severity[severity])})\n\n"
            for issue in by_severity[severity]:
                md += f"- **{issue.title}**\n"
                md += f"  - 位置: `{issue.location}`\n"
                md += f"  - 描述: {issue.description}\n"
                md += f"  - 建议: {issue.suggestion}\n\n"
    
    md += f"""
## 改进建议

### 立即处理 (Critical)

"""
    
    critical_issues = [i for i in report.issues if i.severity == 'critical']
    if critical_issues:
        for i, issue in enumerate(critical_issues, 1):
            md += f"{i}. [{issue.category}] {issue.title}\n"
            md += f"   - 位置: {issue.location}\n"
            md += f"   - 建议: {issue.suggestion}\n\n"
    else:
        md += "无 Critical 级别问题。\n\n"
    
    md += """
---

> 本报告由 PDD 熵减机制自动生成
"""
    
    return md


def main():
    parser = argparse.ArgumentParser(description='PDD 熵减检测脚本')
    parser.add_argument('--project', '-p', required=True, help='项目路径')
    parser.add_argument('--output', '-o', default='entropy-report.md', help='输出文件')
    parser.add_argument('--format', '-f', choices=['markdown', 'json'], default='markdown', help='输出格式')
    
    args = parser.parse_args()
    
    print(f"正在扫描项目: {args.project}")
    
    scanner = EntropyScanner(args.project)
    report = scanner.scan()
    
    output = generate_report(report, args.format)
    
    with open(args.output, 'w', encoding='utf-8') as f:
        f.write(output)
    
    print(f"报告已生成: {args.output}")
    print(f"代码规模: {report.code_lines} 行 ({report.kloc:.1f} KLOC)")
    print(f"综合评分: {report.total_entropy}/100 (0-100，100=最有秩序) {report.get_status()}")
    print(f"  文档一致性 {report.doc_entropy} | 架构合规性 {report.arch_entropy} "
          f"| 代码质量 {report.code_entropy} | 技术债务 {report.debt_entropy}")


if __name__ == '__main__':
    main()
