package org.dromara.yuqing.collect.keyword;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 词表导入解析器 —— 把业务同事手写的词表文本转成结构化条目。
 *
 * <p><b>支持的输入形态</b>（对齐《关键词样例.txt》的真实写法）：</p>
 * <pre>
 *   样例1：
 *   (辽宁|沈阳|大连)+(药监局|药品|医疗器械)       ← 带序号/冒号的段落标记行
 *   样例2：
 *   ((东北|东三省)+(东北超|足球联赛))              ← 整段被外层括号包住也能解析
 *   药监监测:(辽宁|沈阳)+(药监局|药品)              ← 冒号前是业务自定义标题，自动剥离
 *   排除：
 *   广告|代理|招聘|超厚                            ← 排除词段：竖线或换行分隔
 * </pre>
 *
 * <p><b>段落规则</b>：标记行只认「排除/排除词/负向词/降噪词/屏蔽词/过滤词」与
 * 「样例/示例」，且整行去空白、去数字、去冒号后必须与标记词完全相等，
 * 避免把「例」「排除率」之类的普通词误判成段落标记。</p>
 *
 * <p><b>无标记时的兜底</b>：含 {@code ( ) |} 的行按组合表达式处理，
 * 其余按分隔符（竖线/顿号/逗号/分号/空白/全角同类）拆成普通词。</p>
 *
 * @author ruoyi
 */
public final class KeywordImportParser {

    /** 组合表达式 */
    public static final String TYPE_COMBO = "combo";
    /** 否定 / 排除词 */
    public static final String TYPE_NEGATIVE = "negative";
    /** 普通词 */
    public static final String TYPE_PLAIN = "fuzzy";

    /** 分类：核心监测词 */
    public static final String CATEGORY_CORE = "core";
    /** 分类：关联监测词 */
    public static final String CATEGORY_RELATED = "related";
    /** 分类：屏蔽词 */
    public static final String CATEGORY_BLOCK = "block";

    /** yq_keyword.keyword_text 列宽 */
    public static final int MAX_KEYWORD_TEXT = 100;
    /** yq_keyword.combo_expression 列宽 */
    public static final int MAX_COMBO_EXPRESSION = 500;
    /** yq_keyword.remark 列宽 */
    public static final int MAX_REMARK = 200;

    /** 单次导入行数上限 */
    private static final int MAX_LINES = 20000;
    /** 单次导入条目上限 */
    private static final int MAX_ITEMS = 5000;

    /** 排除词段标记（顺序敏感：「排除词」需先于「排除」比对，这里用完全相等，故无影响） */
    private static final String[] EXCLUDE_MARKERS = {"排除", "排除词", "负向词", "降噪词", "屏蔽词", "过滤词"};
    /** 组合表达式段标记 */
    private static final String[] COMBO_MARKERS = {"样例", "示例", "样例表达式", "示例表达式"};
    /** 标记行长度上限（超过则认为是正文而非标记） */
    private static final int MARKER_MAX_LENGTH = 12;

    private KeywordImportParser() {
    }

    /**
     * 解析词表文本。
     *
     * @param text 词表原文
     * @return 解析结果（含条目、错误、提醒）
     */
    public static KeywordImportResult parse(String text) {
        KeywordImportResult result = new KeywordImportResult();
        if (text == null || text.isBlank()) {
            result.getErrors().add("导入内容为空");
            return result;
        }
        List<String> rawLines = text.lines().toList();
        result.setTotalLines(rawLines.size());
        if (rawLines.size() > MAX_LINES) {
            result.getErrors().add("行数 " + rawLines.size() + " 超过上限 " + MAX_LINES + "，请拆分后再导入");
            return result;
        }

        Set<String> seen = new LinkedHashSet<>();
        boolean excludeSection = false;
        String sectionLabel = null;
        int lineNo = 0;
        for (String raw : rawLines) {
            lineNo++;
            String line = raw == null ? "" : raw.trim();
            if (line.isEmpty() || line.startsWith("#") || line.startsWith("//")) {
                continue;
            }
            String marker = matchMarker(line);
            if (marker != null) {
                excludeSection = isExcludeMarker(marker);
                sectionLabel = marker;
                continue;
            }
            if (excludeSection) {
                addWords(result, splitWords(line), TYPE_NEGATIVE, CATEGORY_BLOCK, lineNo,
                    "词表导入[" + label(sectionLabel, "排除") + "]", false, seen);
                continue;
            }
            String[] labelled = stripLeadingLabel(line);
            if (labelled[1] != null) {
                /* 「药监监测:(辽宁|沈阳)+(药监局|药品)」：冒号前是业务自己写的标题，
                   混进表达式会撞「左括号缺少配对」，这里剥离并当作段落名。 */
                addCombo(result, labelled[1], lineNo,
                    label(labelled[0] != null ? labelled[0] : sectionLabel, "组合表达式"), seen);
            } else if (KeywordExpression.looksLikeExpression(line)) {
                addCombo(result, line, lineNo, label(sectionLabel, "组合表达式"), seen);
            } else {
                addWords(result, splitWords(line), TYPE_PLAIN, CATEGORY_RELATED, lineNo,
                    "词表导入[" + label(sectionLabel, "普通词") + "]", false, seen);
            }
        }

        if (result.getItems().isEmpty() && result.getErrors().isEmpty()) {
            result.getErrors().add("未解析出任何关键词，请检查格式（示例行需含括号或竖线；排除词段以「排除:」开头）");
        }
        if (result.getItems().size() > MAX_ITEMS) {
            result.getErrors().add("解析出 " + result.getItems().size() + " 条，超过单次导入上限 " + MAX_ITEMS);
        }
        return result;
    }

    /* ------------------------------------------------------------ 组合表达式 */

    private static void addCombo(KeywordImportResult result, String line, int lineNo,
                                 String section, Set<String> seen) {
        List<String> issues = KeywordExpression.validate(line);
        if (!issues.isEmpty()) {
            result.getErrors().add("第 " + lineNo + " 行：" + issues.get(0));
            return;
        }
        KeywordExpression expression;
        try {
            expression = KeywordExpression.parse(line);
        } catch (KeywordExpressionException e) {
            result.getErrors().add("第 " + lineNo + " 行：" + e.getMessage());
            return;
        }
        String normalized = expression.getNormalized();
        if (normalized.length() > MAX_KEYWORD_TEXT) {
            result.getErrors().add("第 " + lineNo + " 行：表达式 " + normalized.length()
                + " 字符，超过关键词文本列宽 " + MAX_KEYWORD_TEXT + "（请拆成多个子表达式分别监测）");
            return;
        }
        if (normalized.length() > MAX_COMBO_EXPRESSION) {
            result.getErrors().add("第 " + lineNo + " 行：表达式超过组合表达式列宽 " + MAX_COMBO_EXPRESSION);
            return;
        }
        List<String> searchTerms = expression.primaryGroup();
        KeywordImportItem item = new KeywordImportItem();
        item.setKeywordText(normalized);
        item.setKeywordType(TYPE_COMBO);
        item.setKeywordCategory(CATEGORY_CORE);
        item.setComboExpression(normalized);
        item.setLineNo(lineNo);
        item.setGroupCount(expression.getGroups().size());
        item.setWordCount(expression.wordCount());
        item.setSearchTerms(searchTerms);
        item.setRemark(clip(section + "；" + expression.getGroups().size() + " 组 / "
            + expression.wordCount() + " 词，以 " + searchTerms.size() + " 个检索词发起检索",
            MAX_REMARK));
        if (!register(result, item, seen)) {
            return;
        }
        result.setComboCount(result.getComboCount() + 1);
        result.setSearchTermCount(result.getSearchTermCount() + searchTerms.size());
        if (searchTerms.size() > 8) {
            result.getWarnings().add("第 " + lineNo + " 行：检索词组有 " + searchTerms.size()
                + " 个词，将产生同量级检索请求，注意渠道 request_interval 与并发上限");
        }
        /* 表达式内联排除段 -(a|b) 同时登记为排除词，保证「表达式匹配」与「任务降噪」口径一致 */
        if (!expression.getExcludes().isEmpty()) {
            addWords(result, expression.getExcludes(), TYPE_NEGATIVE, CATEGORY_BLOCK, lineNo,
                "词表导入[表达式内联排除]", true, seen);
        }
    }

    /* ---------------------------------------------------------------- 普通词 */

    private static void addWords(KeywordImportResult result, List<String> words, String type, String category,
                                 int lineNo, String section, boolean inline, Set<String> seen) {
        for (String word : words) {
            if (word.length() > KeywordExpression.MAX_WORD_LENGTH) {
                result.getErrors().add("第 " + lineNo + " 行：词「" + clip(word, 24) + "」长度 "
                    + word.length() + " 超过上限 " + KeywordExpression.MAX_WORD_LENGTH);
                continue;
            }
            if (word.length() > MAX_KEYWORD_TEXT) {
                result.getErrors().add("第 " + lineNo + " 行：词「" + clip(word, 24)
                    + "」超过关键词文本列宽 " + MAX_KEYWORD_TEXT);
                continue;
            }
            KeywordImportItem item = new KeywordImportItem();
            item.setKeywordText(word);
            item.setKeywordType(type);
            item.setKeywordCategory(category);
            item.setRemark(clip(section, MAX_REMARK));
            item.setLineNo(lineNo);
            item.setInlineExclude(inline);
            if (!register(result, item, seen)) {
                continue;
            }
            if (TYPE_NEGATIVE.equals(type)) {
                result.setNegativeCount(result.getNegativeCount() + 1);
                if (inline) {
                    result.setInlineExcludeCount(result.getInlineExcludeCount() + 1);
                }
            } else {
                result.setPlainCount(result.getPlainCount() + 1);
            }
        }
    }

    private static boolean register(KeywordImportResult result, KeywordImportItem item, Set<String> seen) {
        if (!seen.add(item.getKeywordText())) {
            item.setDuplicate(true);
            result.setDuplicateCount(result.getDuplicateCount() + 1);
            result.getDuplicates().add(item.getKeywordText());
            return false;
        }
        result.getItems().add(item);
        return true;
    }

    /* ---------------------------------------------------------------- 工具 */

    /**
     * 按分隔符拆词。使用字符判定而非正则，避免词里出现 {@code \} {@code $} 等被正则吃掉。
     *
     * @param line 单行文本
     * @return 去重后的词列表
     */
    private static List<String> splitWords(String line) {
        List<String> words = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (isSeparator(ch)) {
                flush(words, current);
                continue;
            }
            if (Character.isISOControl(ch)) {
                continue;
            }
            current.append(ch);
        }
        flush(words, current);
        return words;
    }

    private static void flush(List<String> words, StringBuilder current) {
        String word = current.toString().trim();
        current.setLength(0);
        if (!word.isEmpty()) {
            /* 此处刻意不去重：重复计数统一交给 register()，
               否则同一行内的重复词会被静默吃掉，「跳过重复 N 条」恒为 0。 */
            words.add(word);
        }
    }

    private static boolean isSeparator(char ch) {
        return ch == '|' || ch == '｜' || ch == ',' || ch == '，' || ch == '、'
            || ch == ';' || ch == '；' || ch == '(' || ch == '（' || ch == ')'
            || ch == '）' || ch == '+' || ch == '＋' || ch == '　' || Character.isWhitespace(ch);
    }

    /**
     * 识别段落标记行。
     *
     * @param line 单行原文
     * @return 命中的标记词；不是标记行返回 null
     */
    private static String matchMarker(String line) {
        if (line.length() > MARKER_MAX_LENGTH) {
            return null;
        }
        String core = stripMarkerNoise(line);
        if (core.isEmpty()) {
            return null;
        }
        for (String marker : EXCLUDE_MARKERS) {
            if (core.equals(marker)) {
                return marker;
            }
        }
        for (String marker : COMBO_MARKERS) {
            if (core.equals(marker)) {
                return marker;
            }
        }
        return null;
    }

    private static boolean isExcludeMarker(String marker) {
        for (String m : EXCLUDE_MARKERS) {
            if (m.equals(marker)) {
                return true;
            }
        }
        return false;
    }

    /** 去掉序号、冒号、空白与破折号，便于「样例1：」与「样例」比对 */
    private static String stripMarkerNoise(String line) {
        StringBuilder sb = new StringBuilder(line.length());
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (Character.isWhitespace(ch) || ch == ':' || ch == '：'
                || ch == '-' || ch == '—' || ch == '．' || ch == '.') {
                continue;
            }
            if (ch >= '0' && ch <= '9') {
                continue;
            }
            sb.append(ch);
        }
        return sb.toString();
    }

    /**
     * 剥离表达式前面的业务自定义标题。
     *
     * <p>「药监监测:(辽宁|沈阳)+(药监局|药品)」里的冒号前缀不属于表达式，
     * 直接送去解析会撞「左括号 '(' 缺少配对的右括号」。只有在冒号右侧确实像
     * 表达式（含括号或竖线）时才剥离，避免把 {@code 时间:12:30} 这类普通词切坏。</p>
     *
     * @param line 单行原文
     * @return 二元数组 {@code [标题, 表达式]}；未命中时两项均为 null
     */
    private static String[] stripLeadingLabel(String line) {
        int idx = -1;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '(' || ch == '（' || ch == '|' || ch == '｜') {
                break;
            }
            if (ch == ':' || ch == '：') {
                idx = i;
                break;
            }
        }
        if (idx <= 0) {
            return new String[]{null, null};
        }
        String title = line.substring(0, idx).trim();
        String rest = line.substring(idx + 1).trim();
        if (title.isEmpty() || rest.isEmpty() || !KeywordExpression.looksLikeExpression(rest)) {
            return new String[]{null, null};
        }
        return new String[]{title, rest};
    }

    private static String label(String section, String fallback) {
        return section == null ? fallback : section;
    }

    private static String clip(String text, int max) {
        if (text == null) {
            return null;
        }
        return text.length() <= max ? text : text.substring(0, max - 3) + "...";
    }
}
