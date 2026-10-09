package org.dromara.yuqing.analytics;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 话题标签拆解
 *
 * <p>采集侧的 {@code topic_tags} 是「逗号分隔」的自由文本，实际会出现：
 * 中英文逗号混用、分号、井号包裹、前后空格、重复标签、超长标签。
 * 这里统一拆成干净的去重列表。</p>
 *
 * <p>不引入正则表达式是刻意的：正则写法一旦出现在生成器模板里就要处理反斜杠转义，
 * 本项目已有「三层转义」踩坑史，能不用就不用。</p>
 *
 * @author ruoyi
 */
public final class TopicSplitter {

    /** 单个话题最大长度：超出截断（保护 dim_key 的 VARCHAR(96)） */
    public static final int MAX_TOPIC_CHARS = 80;

    /** 单条舆情最多取几个话题：防止一条灌水数据刷出上百个维度行 */
    public static final int MAX_TOPICS_PER_OPINION = 8;

    private static final char[] SEPARATORS = {',', '，', ';', '；', '#', '　', ' ', '|', '/'};

    /**
     * 拆解话题标签
     *
     * @param tags 原始标签文本
     * @return 去重后的话题列表（保序），永不为 {@code null}
     */
    public static List<String> split(String tags) {
        List<String> out = new ArrayList<>();
        if (tags == null || tags.isBlank()) {
            return out;
        }
        Set<String> seen = new LinkedHashSet<>();
        for (String part : rawSplit(tags)) {
            String t = trim(part);
            if (t.isEmpty()) {
                continue;
            }
            if (t.length() > MAX_TOPIC_CHARS) {
                t = t.substring(0, MAX_TOPIC_CHARS);
            }
            if (seen.add(t)) {
                out.add(t);
                if (out.size() >= MAX_TOPICS_PER_OPINION) {
                    break;
                }
            }
        }
        return out;
    }

    /**
     * 是否可入维度表
     *
     * <p>过滤掉纯符号与纯数字标签：这类多为页码、序号、表情残留，
     * 计入话题分布只会污染 TOP 榜。</p>
     */
    public static boolean meaningful(String topic) {
        if (topic == null) {
            return false;
        }
        String t = trim(topic);
        if (t.length() < 2) {
            return false;
        }
        boolean hasWord = false;
        boolean hasDigitOnly = true;
        for (int i = 0; i < t.length(); i++) {
            char c = t.charAt(i);
            if (Character.isLetter(c) || Character.UnicodeScript.of(c) == Character.UnicodeScript.HAN) {
                hasWord = true;
                hasDigitOnly = false;
            } else if (!Character.isDigit(c)) {
                hasDigitOnly = false;
            }
        }
        return hasWord && !hasDigitOnly;
    }

    private static List<String> rawSplit(String s) {
        List<String> parts = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (isSeparator(c)) {
                parts.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(c);
            }
        }
        parts.add(cur.toString());
        return parts;
    }

    private static boolean isSeparator(char c) {
        // 制表符与回车由 Character.isWhitespace 兜住（见 isBlank），此处不重复列
        for (char s : SEPARATORS) {
            if (c == s) {
                return true;
            }
        }
        return false;
    }

    private static String trim(String s) {
        int start = 0;
        int end = s.length();
        while (start < end && isBlank(s.charAt(start))) {
            start++;
        }
        while (end > start && isBlank(s.charAt(end - 1))) {
            end--;
        }
        return s.substring(start, end);
    }

    private static boolean isBlank(char c) {
        return Character.isWhitespace(c) || c == 0x3000 || c == '#';
    }

    private TopicSplitter() {
    }
}
