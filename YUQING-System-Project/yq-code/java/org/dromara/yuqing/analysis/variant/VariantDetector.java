package org.dromara.yuqing.analysis.variant;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 隐性 / 变体表述识别（F-007 验收标准 3）
 *
 * <p><b>识别思路：以「任务关键词」为锚点做归一化匹配。</b>
 * 舆情规避检索的常见手法是在关键词里插字符（政*府、政 府）、
 * 用全角字、改大小写、用数字替代字母。这些手法的共同点是：
 * <b>把文本做一层归一化后，原词就出现了</b>。</p>
 *
 * <p>因此本识别器做的是：对原文与关键词分别归一化（去空白与常见分隔符、
 * 全角转半角、英文小写），若归一化后命中而原文里「原样」不命中，
 * 就判定为一次变体命中，并按差异类型归类。</p>
 *
 * <p><b>能力边界（必须如实说明，不能夸大）：</b></p>
 * <ul>
 *   <li><b>能做</b>：分隔符插入、全半角、大小写、字符间空白这几类
 *       —— 它们只改「写法」不改「读音」，归一化即可还原；</li>
 *   <li><b>不能做真正的谐音识别</b>：如用同音字代替原词。拼音与同音字
 *       需要词典或拼音库，本模块不引入外部依赖，因此不做。
 *       真正的谐音识别交给大模型（提示词里已明确要求模型在
 *       {@code matchEvidence} 字段里列出它识别到的谐音与别字），
 *       本类负责的是<b>确定性可复核</b>的那一半；</li>
 *   <li><b>缩写</b>：只做「原文出现连续大写字母（2~6 位）」的提示性标记，
 *       不宣称它就是某词的缩写 —— 是否成立需要模型或人工确认。</li>
 * </ul>
 *
 * @author ruoyi
 */
public final class VariantDetector {

    /**
     * 归一化时被剔除的分隔符（制造变体最常用的手法）。
     *
     * <p>用字符数组而不是字符串字面量：里面含引号与反斜杠，
     * 写成字面量需要多层转义，容易写错且不易读。</p>
     */
    private static final char[] SEPARATOR_CHARS = {
        ' ', (char) 9, (char) 10, (char) 13, '*', '·', '・', '.', '．', '-', '_', '—', '－', '|', '/',
        (char) 92, '(', ')', '（', '）', '[', ']', '【', '】', '<', '>', '《', '》', '、',
        ',', '，', ';', '；', ':', '：', '!', '！', '?', '？', '~', '～', '^', '&', '+', '=',
        '%', '$', '#', '@', (char) 39, '"'};

    /** 缩写提示的最小/最大长度 */
    private static final int ABBR_MIN = 2;
    private static final int ABBR_MAX = 6;

    /** 缩写提示的条数上限 */
    private static final int ABBR_LIMIT = 20;

    private static final Pattern ABBR = Pattern.compile("[A-Z]{" + ABBR_MIN + "," + ABBR_MAX + "}");

    private VariantDetector() {
    }

    /**
     * 识别变体表述。
     *
     * @param content  舆情原文
     * @param keywords 任务关键词集合（为 null / 空则只做缩写提示）
     * @return 命中列表，按位置升序；永不返回 null
     */
    public static List<VariantRule> detect(String content, Collection<String> keywords) {
        List<VariantRule> hits = new ArrayList<>();
        if (content == null || content.isBlank()) {
            return hits;
        }
        if (keywords != null) {
            Set<String> seenKw = new LinkedHashSet<>();
            for (String kw : keywords) {
                if (kw == null || kw.isBlank()) {
                    continue;
                }
                String normalizedKw = kw.trim();
                if (!seenKw.add(normalizedKw)) {
                    continue;
                }
                VariantRule hit = matchOne(content, normalizedKw);
                if (hit != null) {
                    hits.add(hit);
                }
            }
        }
        hits.addAll(abbrHints(content));
        hits.sort(Comparator.comparingInt(VariantRule::getPosition));
        return hits;
    }

    /**
     * 单词匹配：归一化后命中、原样不命中，即记为变体。
     *
     * @return 命中项；原样即可命中（说明规则检索本来就能抓到）时返回 null
     */
    static VariantRule matchOne(String content, String keyword) {
        if (content.contains(keyword)) {
            return null;
        }
        String normContent = normalize(content);
        String normKeyword = normalize(keyword);
        if (normKeyword.isEmpty() || !normContent.contains(normKeyword)) {
            return null;
        }
        return new VariantRule(keyword, keyword, classify(content, keyword),
            Math.max(firstNonSeparator(content), 0));
    }

    /** 判定变体类别：按「哪一种归一化步骤是必需的」倒推 */
    static String classify(String content, String keyword) {
        if (removeSeparators(content).contains(keyword)) {
            return "separator";
        }
        if (toHalfWidth(content).contains(keyword)) {
            return "fullwidth";
        }
        if (content.toLowerCase().contains(keyword.toLowerCase())) {
            return "case";
        }
        if (removeSeparators(toHalfWidth(content)).contains(removeSeparators(keyword))) {
            return "spaced";
        }
        return "numeric";
    }

    /** 缩写提示：连续 2~6 位大写字母（保留原样，是否成立交给人工判断） */
    static List<VariantRule> abbrHints(String content) {
        List<VariantRule> out = new ArrayList<>();
        Matcher m = ABBR.matcher(content);
        while (m.find()) {
            out.add(new VariantRule(null, m.group(), "abbr", m.start()));
            if (out.size() >= ABBR_LIMIT) {
                break;
            }
        }
        return out;
    }

    /** 归一化：去分隔符 + 全角转半角 + 英文小写 */
    public static String normalize(String s) {
        if (s == null) {
            return "";
        }
        return removeSeparators(toHalfWidth(s)).toLowerCase();
    }

    /** 去分隔符 */
    public static String removeSeparators(String s) {
        if (s == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (!isSeparator(c)) {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    /** 是否为分隔符 */
    public static boolean isSeparator(char c) {
        for (char sep : SEPARATOR_CHARS) {
            if (c == sep) {
                return true;
            }
        }
        return false;
    }

    /** 全角转半角（含全角空格） */
    public static String toHalfWidth(String s) {
        if (s == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == 0x3000) {
                sb.append(' ');
            } else if (c > 0xFF00 && c < 0xFF5F) {
                sb.append((char) (c - 0xFEE0));
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    /** 命中依据的人类可读描述（落 yq_opinion_analysis.match_evidence） */
    public static String describe(List<VariantRule> hits) {
        if (hits == null || hits.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (VariantRule h : hits) {
            if (sb.length() > 0) {
                sb.append("; ");
            }
            sb.append(label(h.getCategory())).append(": ").append(h.getForm());
            if (h.getKeyword() != null) {
                sb.append(" -> ").append(h.getKeyword());
            }
        }
        String s = sb.toString();
        return s.length() > 1000 ? s.substring(0, 1000) : s;
    }

    /** 类别中文标签 */
    public static String label(String category) {
        if (category == null) {
            return "未知";
        }
        switch (category) {
            case "separator":
                return "插入分隔符";
            case "fullwidth":
                return "全半角替换";
            case "case":
                return "大小写替换";
            case "spaced":
                return "字符间插空白";
            case "abbr":
                return "疑似缩写";
            case "numeric":
                return "数字字母混写";
            default:
                return "其它";
        }
    }

    private static int firstNonSeparator(String s) {
        for (int i = 0; i < s.length(); i++) {
            if (!isSeparator(s.charAt(i))) {
                return i;
            }
        }
        return -1;
    }
}
