package org.dromara.yuqing.collect.clean;

import java.util.Locale;

/**
 * 正文标准化（F-006「统一数据格式」）。
 *
 * <p>四步：去脚本/样式块 → 剥 HTML 标签 → 解码常用实体 → 空白与全半角归一。
 * 全程用字符扫描而不是正则：抓取回来的 HTML 脏得没边（缺闭合、嵌套错乱），
 * 正则既慢又容易在畸形输入上回溯爆栈。</p>
 *
 * <p><b>安全基线：</b>本类只产出纯文本，不做「白名单标签放行」——
 * 舆情正文属于不可信内容，一律降级为文本后再入库与展示，从源头消掉 XSS。</p>
 *
 * @author ruoyi
 */
public final class ContentPurifier {

    /** 需要整块抹掉的标签（内容一并丢弃，防脚本文本被当成正文） */
    private static final String[] DROP_BLOCKS = {"script", "style", "iframe", "object", "embed", "noscript"};

    /** 全角 ASCII 区段起点（！ ～），映射到 0x21~0x7E */
    private static final char FULLWIDTH_START = 0xFF01;

    private static final char FULLWIDTH_END = 0xFF5E;

    private ContentPurifier() {
    }

    /**
     * 正文净化：剥标签、解实体、归一空白与全半角、压掉连续空行。
     *
     * @param html 原始正文（可为 null）
     * @return 纯文本；入参为空时返回空串
     */
    public static String purify(String html) {
        if (html == null || html.isEmpty()) {
            return "";
        }
        String text = dropBlocks(html);
        text = stripTags(text);
        text = decodeEntities(text);
        return normalize(text);
    }

    /**
     * 标题净化：比正文更激进——标题里不该出现换行，统一压成单空格。
     *
     * @param title 原始标题
     * @return 单行纯文本
     */
    public static String purifyTitle(String title) {
        String text = purify(title);
        StringBuilder sb = new StringBuilder(text.length());
        boolean prevSpace = false;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\f' || c == 0x0B) {
                if (!prevSpace) {
                    sb.append(' ');
                    prevSpace = true;
                }
            } else {
                sb.append(c);
                prevSpace = false;
            }
        }
        return sb.toString().trim();
    }

    /**
     * 有效字符数：剔除空白与零宽字符后的长度，用于「无意义短句」判定。
     *
     * <p>用码点扫描，避免把 emoji（代理对）算成 2 个字符而误判长文本为短句。</p>
     *
     * @param text 文本
     * @return 有效字符数
     */
    public static int effectiveLength(String text) {
        if (text == null || text.isEmpty()) {
            return 0;
        }
        int n = 0;
        for (int i = 0; i < text.length(); ) {
            int cp = text.codePointAt(i);
            i += Character.charCount(cp);
            if (Character.isWhitespace(cp) || isZeroWidth(cp)) {
                continue;
            }
            n++;
        }
        return n;
    }

    /**
     * 截断到指定字符数（按码点，不切断代理对）。
     *
     * @param text 文本
     * @param max  最大字符数
     * @return 截断后的文本
     */
    public static String truncate(String text, int max) {
        if (text == null || max <= 0) {
            return "";
        }
        if (text.codePointCount(0, text.length()) <= max) {
            return text;
        }
        int end = text.offsetByCodePoints(0, max);
        return text.substring(0, end);
    }

    /**
     * 整块抹掉 script / style 等危险标签及其内容。
     */
    private static String dropBlocks(String html) {
        String lower = html.toLowerCase(Locale.ROOT);
        StringBuilder sb = new StringBuilder(html.length());
        int i = 0;
        while (i < html.length()) {
            int open = lower.indexOf('<', i);
            if (open < 0) {
                sb.append(html, i, html.length());
                break;
            }
            sb.append(html, i, open);
            String name = tagNameAt(lower, open + 1);
            if (isDropBlock(name)) {
                int close = findCloseTag(lower, name, open);
                if (close < 0) {
                    // 缺闭合：丢到末尾，宁可少拿也不要漏出脚本文本
                    break;
                }
                i = close;
                continue;
            }
            sb.append('<');
            i = open + 1;
        }
        return sb.toString();
    }

    /**
     * 剥掉所有 HTML 标签，保留文本节点。
     */
    private static String stripTags(String html) {
        StringBuilder sb = new StringBuilder(html.length());
        boolean inTag = false;
        for (int i = 0; i < html.length(); i++) {
            char c = html.charAt(i);
            if (c == '<') {
                inTag = true;
                continue;
            }
            if (c == '>') {
                inTag = false;
                continue;
            }
            if (!inTag) {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    /**
     * 解码常用 HTML 实体。
     *
     * <p>只处理最常用的几个：抓取侧真正高频的就是 {@code &nbsp;} 与 {@code &amp;}，
     * 引入完整实体表会让包体变大而收益极低。数字实体（{@code &#39;}）单独走一趟。</p>
     */
    private static String decodeEntities(String text) {
        String s = text;
        s = replace(s, "&nbsp;", " ");
        s = replace(s, "&amp;", "&");
        s = replace(s, "&lt;", "<");
        s = replace(s, "&gt;", ">");
        s = replace(s, "&quot;", "\"");
        s = replace(s, "&apos;", "'");
        s = replace(s, "&#39;", "'");
        s = replace(s, "&#34;", "\"");
        return s;
    }

    private static String replace(String text, String from, String to) {
        if (!text.contains(from)) {
            return text;
        }
        StringBuilder sb = new StringBuilder(text.length());
        int i = 0;
        while (true) {
            int at = text.indexOf(from, i);
            if (at < 0) {
                sb.append(text, i, text.length());
                break;
            }
            sb.append(text, i, at).append(to);
            i = at + from.length();
        }
        return sb.toString();
    }

    /**
     * 空白归一 + 全半角归一 + 零宽/控制字符清理 + 连续空行压缩。
     */
    private static String normalize(String text) {
        StringBuilder sb = new StringBuilder(text.length());
        int blankLines = 0;
        boolean lineStart = true;
        for (int i = 0; i < text.length(); ) {
            int cp = text.codePointAt(i);
            i += Character.charCount(cp);
            if (isZeroWidth(cp)) {
                continue;
            }
            if (cp == '\r') {
                continue;
            }
            if (cp == '\n' || cp == '\f' || cp == 0x0B) {
                if (blankLines < 2) {
                    sb.append('\n');
                    blankLines++;
                }
                lineStart = true;
                continue;
            }
            if (cp == '\t' || cp == 0xA0 || cp == 0x3000 || Character.isSpaceChar(cp)) {
                cp = ' ';
            }
            if (cp >= FULLWIDTH_START && cp <= FULLWIDTH_END) {
                cp = (char) (cp - FULLWIDTH_START + 0x21);
            }
            if (Character.isISOControl(cp)) {
                continue;
            }
            if (cp == ' ' && lineStart && blankLines > 0) {
                continue;
            }
            sb.appendCodePoint(cp);
            if (cp != ' ') {
                lineStart = false;
                blankLines = 0;
            }
        }
        return sb.toString().trim();
    }

    private static boolean isZeroWidth(int cp) {
        return cp == 0x200B || cp == 0x200C || cp == 0x200D || cp == 0xFEFF;
    }

    private static String tagNameAt(String lower, int from) {
        StringBuilder sb = new StringBuilder();
        for (int i = from; i < lower.length() && i < from + 16; i++) {
            char c = lower.charAt(i);
            if (c >= 'a' && c <= 'z') {
                sb.append(c);
            } else {
                break;
            }
        }
        return sb.toString();
    }

    private static boolean isDropBlock(String name) {
        for (String b : DROP_BLOCKS) {
            if (b.equals(name)) {
                return true;
            }
        }
        return false;
    }

    private static int findCloseTag(String lower, String name, int from) {
        int at = lower.indexOf("</" + name, from);
        if (at < 0) {
            return -1;
        }
        int gt = lower.indexOf('>', at);
        // 缺 '>' 时返回 -1：否则会退化成 0，让调用方原地打转
        return gt < 0 ? -1 : gt + 1;
    }
}
