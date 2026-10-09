package org.dromara.yuqing.collect.keyword;

import java.io.Serial;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 关键词组合表达式：解析 + 校验。
 *
 * <p>语法对齐业务同事现有录入习惯（样例见《网址与关键词-代码匹配核查》）：</p>
 * <pre>
 *   (辽宁|沈阳|大连)+(药监局|药品监管|医疗器械监管)   地区组 AND 主题组
 *   (东北超|辽超)+(药企|医药企业)-(广告|代理)         末尾 - 组为排除词
 *   ((东北|东三省)+(东北超|足球联赛))                 整段被外层括号包住：自动剥离，不报嵌套错
 *   (药监局|药品监管)                                 单组：既检索也匹配
 *   药监局|药品监管                                   不带括号的 OR 组
 * </pre>
 *
 * <p><b>关键约定</b>：最后一个组是「检索词组」，用于填充适配器 {@code {kw}} 占位符发起检索；
 * 所有组同时作为「本地匹配组」，命中才允许入库。这样请求量是「主题词个数 N」，
 * 而不是「地区 × 主题」的笛卡尔积（16 × 6 = 96 → 6）。</p>
 *
 * <p><b>宽容输入</b>：全角括号 / 竖线 / 加号 / 减号，顿号、逗号、分号、空白一律按分隔符识别，
 * 降低录入门槛（业务同事不一定会切英文输入法）。</p>
 *
 * @author ruoyi
 */
public final class KeywordExpression implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 表达式词数上限：防止一次检索把渠道限流打爆 */
    public static final int MAX_WORDS = 200;

    /** 单个词长度上限 */
    public static final int MAX_WORD_LENGTH = 50;

    /** AND 组：每组内部是 OR 关系 */
    private final List<List<String>> groups;

    /** 排除词 */
    private final List<String> excludes;

    /** 归一化后的表达式（便于回显与排错） */
    private final String normalized;

    private KeywordExpression(List<List<String>> groups, List<String> excludes, String normalized) {
        this.groups = groups;
        this.excludes = excludes;
        this.normalized = normalized;
    }

    /* ---------------------------------------------------------------- 访问器 */

    public List<List<String>> getGroups() {
        return groups;
    }

    public List<String> getExcludes() {
        return excludes;
    }

    public String getNormalized() {
        return normalized;
    }

    /**
     * 是否只有排除词、没有检索组。
     *
     * @return true 表示表达式不可用于检索
     */
    public boolean hasNoGroup() {
        return groups.isEmpty();
    }

    /**
     * 全部有效词数量（含排除词）。
     *
     * @return 词数
     */
    public int wordCount() {
        int total = excludes.size();
        for (List<String> group : groups) {
            total += group.size();
        }
        return total;
    }

    /**
     * 检索词组（按约定取最后一组）。
     *
     * @return 检索词；无组时返回空列表
     */
    public List<String> primaryGroup() {
        if (groups.isEmpty()) {
            return new ArrayList<>();
        }
        return new ArrayList<>(groups.get(groups.size() - 1));
    }

    /* ---------------------------------------------------------------- 解析 */

    /**
     * 解析表达式，语法错误抛 {@link KeywordExpressionException}（含列位置）。
     *
     * @param expression 表达式原文
     * @return 解析结果
     */
    public static KeywordExpression parse(String expression) {
        if (expression == null || expression.trim().isEmpty()) {
            throw new KeywordExpressionException(0, "表达式为空");
        }
        String text = unwrapRedundantParens(normalize(expression).trim());
        List<List<String>> groups = new ArrayList<>();
        Set<String> excludes = new LinkedHashSet<>();
        int length = text.length();
        int index = 0;
        boolean negate = false;
        boolean expectTerm = true;
        while (index < length) {
            char ch = text.charAt(index);
            if (Character.isWhitespace(ch)) {
                index++;
                continue;
            }
            if (ch == '+') {
                if (expectTerm) {
                    throw new KeywordExpressionException(index + 1, "连接符 '+' 位置错误：左侧没有词组");
                }
                expectTerm = true;
                index++;
                continue;
            }
            if (ch == '-') {
                if (negate) {
                    throw new KeywordExpressionException(index + 1, "重复的排除符 '-'");
                }
                /* 允许以 - 开头：-(广告|代理) 是「只有排除词」的表达式，
                   解析通过但会被 validate 判定为缺少检索词组 */
                if (expectTerm && !groups.isEmpty()) {
                    throw new KeywordExpressionException(index + 1, "排除符 '-' 位置错误：左侧没有词组");
                }
                negate = true;
                index++;
                continue;
            }
            if (ch == ')') {
                throw new KeywordExpressionException(index + 1, "多余的右括号 ')'");
            }
            int[] cursor = {index};
            List<String> words = readWords(text, cursor);
            index = cursor[0];
            if (words.isEmpty()) {
                throw new KeywordExpressionException(index + 1, "无法识别的内容");
            }
            if (negate) {
                excludes.addAll(words);
                negate = false;
            } else {
                groups.add(words);
            }
            expectTerm = false;
        }
        if (negate) {
            throw new KeywordExpressionException(length, "表达式以排除符 '-' 结尾，缺少排除词");
        }
        if (expectTerm && !groups.isEmpty()) {
            throw new KeywordExpressionException(length, "表达式以连接符 '+' 结尾");
        }
        if (groups.isEmpty() && excludes.isEmpty()) {
            throw new KeywordExpressionException(0, "表达式不含任何有效词");
        }
        int total = excludes.size();
        for (List<String> group : groups) {
            total += group.size();
        }
        if (total > MAX_WORDS) {
            throw new KeywordExpressionException(0, "表达式共 " + total + " 个词，超过上限 " + MAX_WORDS);
        }
        return new KeywordExpression(groups, new ArrayList<>(excludes), text.trim());
    }

    /**
     * 语法校验：返回问题列表，为空即合法。
     *
     * <p>供关键词库录入界面实时提示（F-002 验收标准 3）。</p>
     *
     * @param expression 表达式原文
     * @return 问题列表，每条自带列位置描述
     */
    public static List<String> validate(String expression) {
        List<String> issues = new ArrayList<>();
        if (expression == null || expression.trim().isEmpty()) {
            issues.add("表达式为空");
            return issues;
        }
        try {
            KeywordExpression parsed = parse(expression);
            if (parsed.hasNoGroup()) {
                issues.add("表达式只包含排除词，缺少检索词组");
            }
            return issues;
        } catch (KeywordExpressionException e) {
            issues.add(e.getMessage() == null ? "表达式语法错误" : e.getMessage());
            return issues;
        }
    }

    /**
     * 是否像组合表达式（用于判断走「组合解析」还是「普通单词」）。
     *
     * <p>只认括号与竖线：这类字符几乎不可能出现在普通词里，避免把 {@code C++} 之类误判成表达式。</p>
     *
     * @param text 文本
     * @return true 表示应按组合表达式处理
     */
    public static boolean looksLikeExpression(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        return text.indexOf('(') >= 0 || text.indexOf('（') >= 0
            || text.indexOf('|') >= 0 || text.indexOf('｜') >= 0;
    }

    /* ---------------------------------------------------------------- 内部 */

    /**
     * 读取一个 term（可能是 {@code (...)} 组，也可能是不带括号的 OR 词序列）。
     */
    private static List<String> readWords(String text, int[] cursor) {
        int index = cursor[0];
        int length = text.length();
        boolean inGroup = text.charAt(index) == '(';
        if (inGroup) {
            index++;
        }
        List<String> words = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        int wordStart = index;
        while (true) {
            if (index >= length) {
                if (inGroup) {
                    throw new KeywordExpressionException(length, "缺少配对的右括号 ')'");
                }
                break;
            }
            char ch = text.charAt(index);
            if (inGroup) {
                if (ch == ')') {
                    break;
                }
                if (ch == '(') {
                    throw new KeywordExpressionException(index + 1, "不支持嵌套括号");
                }
            } else {
                if (ch == '(') {
                    throw new KeywordExpressionException(index + 1, "左括号 '(' 缺少配对的右括号");
                }
                if (ch == '+' || ch == '-') {
                    break;
                }
            }
            if (isSeparator(ch)) {
                appendWord(words, current, wordStart);
                current.setLength(0);
                index++;
                wordStart = index;
                continue;
            }
            current.append(ch);
            index++;
        }
        appendWord(words, current, wordStart);
        cursor[0] = inGroup ? index + 1 : index;
        return words;
    }

    private static void appendWord(List<String> words, StringBuilder current, int start) {
        String word = current.toString().trim();
        if (word.isEmpty()) {
            return;
        }
        if (word.length() > MAX_WORD_LENGTH) {
            throw new KeywordExpressionException(start + 1,
                "词过长（" + word.length() + " 字符，上限 " + MAX_WORD_LENGTH + "）：" + cut(word));
        }
        if (!words.contains(word)) {
            words.add(word);
        }
    }

    private static boolean isSeparator(char ch) {
        return ch == '|' || ch == ',' || ch == ';' || Character.isWhitespace(ch);
    }

    /**
     * 全角 / 中文标点归一化为半角，保持字符下标不变（1:1 映射，列号可原样回显）。
     */
    private static String normalize(String text) {
        StringBuilder sb = new StringBuilder(text.length());
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            switch (ch) {
                case '（' -> sb.append('(');
                case '）' -> sb.append(')');
                case '｜' -> sb.append('|');
                case '＋' -> sb.append('+');
                case '－', '—', '–' -> sb.append('-');
                case '，', '、' -> sb.append(',');
                case '；' -> sb.append(';');
                case '　' -> sb.append(' ');
                default -> sb.append(ch);
            }
        }
        return sb.toString();
    }

    /**
     * 剥离「把整段表达式包起来」的冗余括号。
     *
     * <p>业务同事手写词表时常写成 {@code ((东北|…)+(地区…))} —— 外层括号只是分组习惯，
     * 语义与去括号后完全一致，但会被解析器判为「不支持嵌套括号」。这里在解析前把
     * 最外层成对括号<b>置为空格</b>而不是删除，字符下标 1:1 不变，报错列号仍与原文对齐。</p>
     *
     * <p>只处理「首尾成对且内部无提前闭合」的情况；{@code (A)+(B)} 这种首括号在中途闭合的
     * 表达式不会被误剥。</p>
     *
     * @param text 已归一化的表达式
     * @return 剥离冗余外层括号后的表达式（等长）
     */
    private static String unwrapRedundantParens(String text) {
        char[] chars = text.toCharArray();
        while (true) {
            int start = 0;
            int end = chars.length - 1;
            while (start <= end && Character.isWhitespace(chars[start])) {
                start++;
            }
            while (end >= start && Character.isWhitespace(chars[end])) {
                end--;
            }
            if (start >= end || chars[start] != '(' || chars[end] != ')') {
                return new String(chars);
            }
            /* 校验 start 处的 '(' 是否恰好与 end 处的 ')' 配对 */
            int depth = 0;
            boolean wraps = true;
            for (int i = start; i <= end; i++) {
                char ch = chars[i];
                if (ch == '(') {
                    depth++;
                } else if (ch == ')') {
                    depth--;
                    if (depth < 0 || (depth == 0 && i != end)) {
                        wraps = false;
                        break;
                    }
                }
            }
            if (!wraps || depth != 0) {
                return new String(chars);
            }
            chars[start] = ' ';
            chars[end] = ' ';
        }
    }

    private static String cut(String word) {
        return word.length() > 30 ? word.substring(0, 30) + "..." : word;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        for (List<String> group : groups) {
            if (sb.length() > 0) {
                sb.append('+');
            }
            sb.append('(').append(String.join("|", group)).append(')');
        }
        if (!excludes.isEmpty()) {
            sb.append("-(").append(String.join("|", excludes)).append(')');
        }
        return sb.toString();
    }
}
