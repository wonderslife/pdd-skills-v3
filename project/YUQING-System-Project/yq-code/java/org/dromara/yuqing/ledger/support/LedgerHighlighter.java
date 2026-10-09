package org.dromara.yuqing.ledger.support;

import java.util.ArrayList;
import java.util.List;

/**
 * 全文检索高亮（F-016 验收标准 7）
 *
 * <p><b>安全核心：先转义、后标记。</b>返回的片段是「可被 v-html 直接渲染的
 * 安全 HTML」，因此转义必须在服务端完成，且顺序不可颠倒：</p>
 * <ol>
 *   <li>对原文中**非命中部分**做 HTML 实体转义（&amp; &lt; &gt; &quot; &#39;）；</li>
 *   <li>命中词本身同样转义后，再整体包进 &lt;em class="yq-hit"&gt; 标记；</li>
 *   <li>标记字符串由本类以自己的常量拼接，绝不来自输入。</li>
 * </ol>
 *
 * <p>如果反过来（先插标记再转义），标记会被转义成文本，高亮失效；
 * 如果先插标记且不转义，那么正文里的 {@code <script>} 会原样进入 DOM ——
 * 因为采集来的舆情正文是完全不可信的外部内容，这是存储型 XSS 的标准入口。</p>
 *
 * <p>关键词本身也不可信：用户可以把 {@code <img onerror=...>} 当关键词搜。
 * 本类对命中词做了与正文同样的转义，因此关键词注入同样无效
 * （自测用例 F016LedgerTest 覆盖）。</p>
 *
 * @author ruoyi
 */
public final class LedgerHighlighter {

    /** 高亮标记（前端样式类名固定为 yq-hit，勿改） */
    public static final String MARK_OPEN = "<em class=\"yq-hit\">";
    public static final String MARK_CLOSE = "</em>";

    /** 省略号占位 */
    private static final String ELLIPSIS = "...";

    private LedgerHighlighter() {
    }

    /**
     * HTML 实体转义。
     *
     * <p>顺序敏感：{@code &} 必须最先替换，否则会把后续替换产生的
     * {@code &lt;} 再转义成 {@code &amp;lt;}（双重转义，页面显示成乱码文本）。</p>
     */
    public static String escapeHtml(String raw) {
        if (raw == null || raw.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder(raw.length() + 16);
        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            switch (c) {
                case '&':
                    sb.append("&amp;");
                    break;
                case '<':
                    sb.append("&lt;");
                    break;
                case '>':
                    sb.append("&gt;");
                    break;
                case '"':
                    sb.append("&quot;");
                    break;
                case '\'':
                    sb.append("&#39;");
                    break;
                default:
                    sb.append(c);
            }
        }
        return sb.toString();
    }

    /**
     * 统计命中次数（大小写不敏感）。
     *
     * @return 命中次数；正文或关键词为空时返回 0
     */
    public static int countHits(String text, String keyword) {
        if (text == null || text.isEmpty() || keyword == null || keyword.isEmpty()) {
            return 0;
        }
        String lower = text.toLowerCase();
        String lk = keyword.toLowerCase();
        int count = 0;
        int i = 0;
        while (true) {
            int hit = lower.indexOf(lk, i);
            if (hit < 0) {
                break;
            }
            count++;
            i = hit + lk.length();
        }
        return count;
    }

    /**
     * 整段高亮（用于摘要 / 标题等短文本）。
     *
     * @return 已转义的安全 HTML
     */
    public static String highlight(String text, String keyword) {
        if (text == null || text.isEmpty()) {
            return "";
        }
        if (keyword == null || keyword.isEmpty()) {
            return escapeHtml(text);
        }
        String lower = text.toLowerCase();
        String lk = keyword.toLowerCase();
        StringBuilder sb = new StringBuilder(text.length() + 32);
        int i = 0;
        while (i < text.length()) {
            int hit = lower.indexOf(lk, i);
            if (hit < 0) {
                sb.append(escapeHtml(text.substring(i)));
                break;
            }
            sb.append(escapeHtml(text.substring(i, hit)));
            sb.append(MARK_OPEN)
              .append(escapeHtml(text.substring(hit, hit + keyword.length())))
              .append(MARK_CLOSE);
            i = hit + keyword.length();
        }
        return sb.toString();
    }

    /**
     * 抽取高亮片段（验收标准 7 的「高亮命中片段」）。
     *
     * <p>算法：先定位所有命中位置，把每个命中扩成半径 {@code radius} 的窗口，
     * 再合并相互重叠/相邻的窗口，最后对每个窗口做整段高亮并补省略号。
     * 这样长正文里连续多处命中会合并成一段，而不是产出几条几乎重复的碎片。</p>
     *
     * @param text         原文
     * @param keyword      关键词
     * @param radius       命中词左右各取的字符数（小于 0 视为 0）
     * @param maxFragments 最多返回的片段数（小于等于 0 时返回空列表）
     * @return 已转义的片段列表（可直接 v-html）；无命中返回空列表
     */
    public static List<String> fragments(String text, String keyword, int radius, int maxFragments) {
        List<String> out = new ArrayList<>();
        if (text == null || text.isEmpty() || keyword == null || keyword.isEmpty() || maxFragments <= 0) {
            return out;
        }
        int r = Math.max(radius, 0);
        int klen = keyword.length();
        String lower = text.toLowerCase();
        String lk = keyword.toLowerCase();

        /* 1. 收集命中区间并扩窗 */
        List<int[]> windows = new ArrayList<>();
        int i = 0;
        while (true) {
            int hit = lower.indexOf(lk, i);
            if (hit < 0) {
                break;
            }
            int start = Math.max(0, hit - r);
            int end = Math.min(text.length(), hit + klen + r);
            if (!windows.isEmpty()) {
                int[] last = windows.get(windows.size() - 1);
                if (start <= last[1]) {
                    /* 与上一窗口重叠或相接 -> 合并 */
                    last[1] = Math.max(last[1], end);
                    i = hit + klen;
                    continue;
                }
            }
            windows.add(new int[]{start, end});
            i = hit + klen;
        }

        /* 2. 逐窗口整段高亮（内部仍按命中位置插标记，保证窗口内所有命中都高亮） */
        for (int w = 0; w < windows.size() && out.size() < maxFragments; w++) {
            int start = windows.get(w)[0];
            int end = windows.get(w)[1];
            String piece = highlight(text.substring(start, end), keyword);
            StringBuilder sb = new StringBuilder();
            if (start > 0) {
                sb.append(ELLIPSIS);
            }
            sb.append(piece);
            if (end < text.length()) {
                sb.append(ELLIPSIS);
            }
            out.add(sb.toString());
        }
        return out;
    }

    /**
     * 命中字段判定（验收标准 7 要求区分标题 / 正文命中）。
     *
     * @return title / content / both / none
     */
    public static String hitField(String title, String content, String keyword) {
        boolean t = countHits(title, keyword) > 0;
        boolean c = countHits(content, keyword) > 0;
        if (t && c) {
            return "both";
        }
        if (t) {
            return "title";
        }
        if (c) {
            return "content";
        }
        return "none";
    }
}
