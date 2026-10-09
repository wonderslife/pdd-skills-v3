#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""entropy_scan.py 多语言检测能力单测

直接运行即可（不依赖 pytest）：
    python test_entropy_scan.py            # 跑完自动清理临时样本
    python test_entropy_scan.py --keep     # 保留样本目录，便于人工核对

覆盖 JS/TS、Python、Java 三语言的函数长度、嵌套深度、命名规则、重复代码，
并专门包含两条最容易误报的场景：对象字面量嵌套、Python 续行。
"""
import argparse
import shutil
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
import entropy_scan  # noqa: E402


def body(n, indent, kind):
    """生成 n 行无重复的占位代码"""
    if kind == 'js':
        return [f'{indent}const a{i} = {i};' for i in range(n)]
    if kind == 'py':
        return [f'{indent}a{i} = {i}' for i in range(n)]
    return [f'{indent}int a{i} = {i};' for i in range(n)]


def build(fix: Path):
    (fix / 'src').mkdir(parents=True)

    def write(name, lines):
        (fix / 'src' / name).write_text('\n'.join(lines) + '\n', encoding='utf-8')

    # ---- JS：三种函数写法各一个 62 行长函数 + 一个短函数 + 单字母函数名
    js = ['function longJsFunc() {'] + body(60, '  ', 'js') + ['}', '']
    js += ['function shortJsFunc() {', '  return 1;', '}', '']
    js += ['const arrowLong = () => {'] + body(60, '  ', 'js') + ['};', '']
    js += ['class Demo {', '  classMethod() {'] + body(60, '    ', 'js') + ['  }', '}']
    js += ['', 'function t(key) {', '  return key;', '}']
    write('js_sample.js', js)

    # ---- JS：if 嵌套 6 层（function 1 + if 6 = 7）
    deep = ['function deepJs() {']
    for i in range(6):
        deep.append('  ' * (i + 1) + f'if ({i}) {{')
    deep.append('  ' * 7 + 'return 1;')
    for i in range(5, -1, -1):
        deep.append('  ' * (i + 1) + '}')
    deep.append('}')
    write('js_deep.js', deep)

    # ---- JS：纯对象字面量嵌套 6 层，字面量必须被排除，否则会虚报深度
    lit = ['function literalOnly() {', '  const cfg = {']
    for i, key in enumerate(['a', 'b', 'c', 'd', 'e', 'f']):
        lit.append('  ' * (i + 2) + f'{key}: {{')
    lit.append('  ' * 8 + 'z: 1')
    for i in range(5, -1, -1):
        lit.append('  ' * (i + 2) + '}')
    lit += ['  };', '  return cfg;', '}']
    write('js_literal_only.js', lit)

    # ---- JS：Node ESM 标准全局量不该被当成命名问题
    write('js_dirname.js', [
        "import { fileURLToPath } from 'url';",
        "const __filename = fileURLToPath(import.meta.url);",
        "const __dirname = path.dirname(__filename);",
        "let _realPrivate = 1;",
    ])

    # ---- Python：长函数 + 短函数 + 单字母函数名
    py = ['def long_py_func():'] + body(60, '    ', 'py') + ['    return 0', '', '']
    py += ['def short_py_func():', '    return 1', '', '']
    py += ['def q():', '    return 2']
    write('py_sample.py', py)

    # ---- Python：if 嵌套 6 层（def + if 6 + return = 7）
    deep = ['def deep_py():']
    for i in range(6):
        deep.append('    ' * (i + 1) + 'if True:')
    deep.append('    ' * 7 + 'return 1')
    write('py_deep.py', deep)

    # ---- Python：带续行的 if 链，总深度 5 正好卡阈值（不应报）
    #      若续行未被跳过，续行会对齐到 19 列，把深度顶到 6 而误报
    write('py_continuation.py', [
        'def pick(value):',
        '    if True:',
        '        if True:',
        '            if True:',
        "                if (value.startswith('\"') and value.endswith('\"')) or \\",
        '                   (value.startswith("\'") and value.endswith("\'")):',
        '                    return value',
    ])

    # ---- Java：长方法 + 短方法 + 单字母方法名
    java = ['public class Sample {', '    public void longJavaMethod() {']
    java += body(60, '        ', 'java')
    java += ['    }', '', '    private int shortMethod() {', '        return 1;', '    }', '']
    java += ['    private int x() {', '        return 2;', '    }', '}']
    write('Sample.java', java)

    # ---- Java：class + method + if 6 层 = 8
    jd = ['public class JavaDeep {', '    public void deepJava() {']
    for i in range(6):
        jd.append('        ' + '    ' * i + 'if (true) {')
    jd.append('        ' + '    ' * 6 + 'return;')
    for i in range(5, -1, -1):
        jd.append('        ' + '    ' * i + '}')
    jd += ['    }', '}']
    write('JavaDeep.java', jd)

    # ---- 重复代码：5 个文件各含完全相同的 20 行（对齐到 10 行块边界）
    shared = [f'    value_{i} = compute_{i}(input_{i})' for i in range(20)]
    for idx in range(1, 6):
        write(f'dup{idx}.py', shared)


def run(fix: Path):
    scanner = entropy_scan.EntropyScanner(str(fix))
    report = scanner.scan()
    return report, scanner.issues


def main():
    parser = argparse.ArgumentParser(description='entropy_scan 多语言能力单测')
    parser.add_argument('--keep', action='store_true', help='保留样本目录')
    args = parser.parse_args()

    fix = Path(tempfile.mkdtemp(prefix='entropy-fixture-'))
    try:
        build(fix)
        report, issues = run(fix)

        def hit(title, keyword, suffix=''):
            for i in issues:
                blob = i.location + ' ' + i.description
                if i.title == title and keyword in blob and (not suffix or suffix in i.location):
                    return i
            return None

        checks = []

        def check(name, ok, detail=''):
            checks.append((name, ok, detail))

        # ---- 函数长度：三语言都必须检出，且行数精确
        for label, kw in (
            ('JS function 长函数', 'longJsFunc'),
            ('JS 箭头函数长函数', 'arrowLong'),
            ('JS 类方法长函数', 'classMethod'),
            ('Python 长函数', 'long_py_func'),
            ('Java 长方法', 'longJavaMethod'),
        ):
            found = hit('函数过长', kw)
            check(f'{label} 检出且行数=62', bool(found) and '有 62 行' in found.description,
                  found.description if found else '未检出')

        for label, kw in (
            ('JS 短函数', 'shortJsFunc'),
            ('Python 短函数', 'short_py_func'),
            ('Java 短方法', 'shortMethod'),
        ):
            check(f'{label} 不误报', hit('函数过长', kw) is None)

        # ---- 嵌套深度：同构结构在三语言下口径一致
        check('JS 深嵌套 6 层 if → 深度 7',
              (lambda f: bool(f) and '深度 7' in f.description)(hit('嵌套过深', 'js_deep.js')))
        check('Java 深嵌套 6 层 if → 深度 8',
              (lambda f: bool(f) and '深度 8' in f.description)(hit('嵌套过深', 'JavaDeep.java')))
        check('Python 深嵌套 6 层 if → 深度 7',
              (lambda f: bool(f) and '深度 7' in f.description)(hit('嵌套过深', 'py_deep.py')))

        # ---- 两条关键「不应报」
        check('纯对象字面量嵌套不报（字面量已排除）', hit('嵌套过深', 'js_literal_only.js') is None)
        check('Python 续行不抬高深度（卡阈值不报）', hit('嵌套过深', 'py_continuation.py') is None)

        # ---- 命名规则按语言生效
        check('JS 单字母函数名检出', hit('命名不规范', '单字母函数名', 'js_sample.js') is not None)
        check('Python 单字母函数名检出', hit('命名不规范', '单字母函数名', 'py_sample.py') is not None)
        check('Java 单字母方法名检出', hit('命名不规范', '单字母方法名', 'Sample.java') is not None)
        dirname_hits = [i for i in issues
                        if 'js_dirname.js' in i.location and i.description == '下划线前缀变量']
        check('__dirname/__filename 不误报（同文件 _realPrivate 应报）',
              len(dirname_hits) == 1, f'该文件下划线告警 {len(dirname_hits)} 条，期望 1 条')

        # ---- 重复代码按文件组聚合，不能爆炸
        dup = hit('重复代码', '5 个文件之间存在')
        check('重复代码聚合为 1 条（5 文件 × 2 块）', dup is not None,
              dup.description if dup else '未检出')
        dup_count = len([i for i in issues if i.title == '重复代码'])
        check(f'重复代码未爆炸（共 {dup_count} 条）', dup_count <= 3)

        # ---- 评分口径（100 = 最有秩序）
        check('无问题维度 = 100',
              entropy_scan.EntropyScanner(str(fix))._calculate_category_entropy([]) == 100)
        check('状态文案用五档之一',
              report.get_status().split(' ', 1)[-1] in ('优秀', '良好', '一般', '警告', '危急'))

        # ---- 规模归一化评分模型（防止大项目一律撞底）
        scanner = entropy_scan.EntropyScanner(str(fix))
        tol_code = entropy_scan.SCALE_TOLERANCE['code']

        def code_score(kloc, deduction):
            """构造指定规模 + 指定扣分，返回 code 维度评分"""
            s = entropy_scan.EntropyScanner(str(fix))
            s._code_lines_cache = int(kloc * 1000)
            issue = entropy_scan.EntropyIssue('code', 'medium', 't', 'l', 'd', 's', deduction)
            return s._calculate_category_entropy([issue], 'code')

        # 同密度 → 同分（大项目不再因规模吃亏）
        check('同问题密度跨规模同分（5 vs 200 KLOC）',
              code_score(5, int(tol_code * 0.2 * 5)) == code_score(200, int(tol_code * 0.2 * 200)),
              f'{code_score(5, int(tol_code))} vs {code_score(200, int(tol_code * 200))}')

        # 中大型项目扣分撞顶后不再恒为 0
        check('大项目不再是 0 分（200 KLOC 扣 2000 分）',
              code_score(200, 2000) > 0, f'得 {code_score(200, 2000)} 分')

        # 密度刚好到容忍值 → 0 分；超过 → 仍 0 分（有上界）
        check('密度达容忍值 = 0 分',
              code_score(10, int(tol_code * 10)) == 0, f'得 {code_score(10, int(tol_code * 10))} 分')

        # 小项目仍敏感：同样扣分，小项目应明显低于大项目
        check('小项目同扣分更低（规模敏感）',
              code_score(5, 100) < code_score(50, 100),
              f'5KLOC={code_score(5, 100)} < 50KLOC={code_score(50, 100)}')

        # 改善可见：减少扣分应带来评分提升且非跳变
        s1, s2, s3 = code_score(50, 1500), code_score(50, 1000), code_score(50, 500)
        check('扣分减少评分单调上升', s1 < s2 < s3, f'{s1} < {s2} < {s3}')

        # 规模地板：空项目不应因除零放大成 0 或异常
        check('0 行项目评分不崩（地板生效）',
              entropy_scan.EntropyScanner(str(fix))._calculate_category_entropy(
                  [entropy_scan.EntropyIssue('code', 'low', 't', 'l', 'd', 's', 1)], 'code') > 0)

        # 报告带规模信息
        check('报告输出代码规模', report.code_lines > 0, f'{report.code_lines} 行 / {report.kloc:.1f} KLOC')

        width = max(len(n) for n, _, _ in checks)
        failed = 0
        for name, ok, detail in checks:
            if not ok:
                failed += 1
            print(f'  [{"PASS" if ok else "FAIL"}] {name.ljust(width)} {detail}')
        print()
        print(f'合计 {len(checks)} 项，通过 {len(checks) - failed}，失败 {failed}')
        print(f'（样本评分 {report.total_entropy}/100 {report.get_status()}，问题 {len(issues)} 条）')
        if args.keep:
            print(f'样本目录：{fix}')
        return 1 if failed else 0
    finally:
        if not args.keep:
            shutil.rmtree(fix, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main())
