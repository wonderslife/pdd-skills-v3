package org.dromara.yuqing.collect.keyword;

import java.io.Serial;
import java.io.Serializable;
import java.util.Locale;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

/**
 * 降噪排除规则：命中即丢弃该条内容。
 *
 * <p>两类来源：</p>
 * <ul>
 *   <li>{@code yq_keyword} 中 {@code keyword_type = negative} 的词，经 {@code yq_task_keyword}
 *       关联到任务 —— <b>天然带任务维度</b>，避免全局降噪误杀（见《网址与关键词-代码匹配核查》）</li>
 *   <li>{@code yq_noise_rule} 的系统内置规则（可选，默认不参与采集，留给 F-006 净化去重）</li>
 * </ul>
 *
 * @author ruoyi
 */
public class ExcludeRule implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 正则规则值长度上限，防超长表达式拖慢匹配 */
    private static final int MAX_REGEX_LENGTH = 200;

    private final String name;

    private final String matchType;

    private final String value;

    private final boolean regex;

    private final Pattern pattern;

    private ExcludeRule(String name, String matchType, String value, boolean regex, Pattern pattern) {
        this.name = name;
        this.matchType = matchType;
        this.value = value;
        this.regex = regex;
        this.pattern = pattern;
    }

    /**
     * 关键词（子串）规则。
     *
     * @param name  规则名
     * @param value 匹配内容
     * @return 规则
     */
    public static ExcludeRule keyword(String name, String value) {
        return new ExcludeRule(name, "keyword", value, false, null);
    }

    /**
     * 正则规则；表达式非法或存在灾难性回溯风险时自动降级为关键词匹配。
     *
     * @param name  规则名
     * @param value 正则表达式
     * @return 规则
     */
    public static ExcludeRule regex(String name, String value) {
        if (value == null || value.isBlank() || value.length() > MAX_REGEX_LENGTH || risky(value)) {
            return keyword(name, value);
        }
        try {
            return new ExcludeRule(name, "regex", value, true, Pattern.compile(value));
        } catch (PatternSyntaxException e) {
            return keyword(name, value);
        }
    }

    /**
     * 是否命中。
     *
     * @param text 待检文本
     * @return true 表示命中（应丢弃）
     */
    public boolean hit(String text) {
        if (text == null || text.isEmpty() || value == null || value.isEmpty()) {
            return false;
        }
        if (regex && pattern != null) {
            return pattern.matcher(text).find();
        }
        return text.toLowerCase(Locale.ROOT).contains(value.toLowerCase(Locale.ROOT));
    }

    public String getName() {
        return name;
    }

    public String getMatchType() {
        return matchType;
    }

    public String getValue() {
        return value;
    }

    public boolean isRegex() {
        return regex;
    }

    @Override
    public String toString() {
        return matchType + ":" + value;
    }

    /**
     * 粗略识别 {@code (a+)+} / {@code (a*)*} 这类灾难性回溯形态（纯字符扫描，不引入新的正则）。
     */
    private static boolean risky(String value) {
        boolean inGroup = false;
        boolean quantifierInGroup = false;
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            if (ch == '(') {
                inGroup = true;
                quantifierInGroup = false;
            } else if (ch == ')') {
                if (inGroup && quantifierInGroup && i + 1 < value.length()) {
                    char next = value.charAt(i + 1);
                    if (next == '+' || next == '*' || next == '{') {
                        return true;
                    }
                }
                inGroup = false;
            } else if (inGroup && (ch == '+' || ch == '*')) {
                quantifierInGroup = true;
            }
        }
        return false;
    }
}
