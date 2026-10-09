package org.dromara.yuqing.report.render;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Markdown 正文转 HTML 片段（纯函数，供 PDF 渲染与 H5 在线预览使用）
 *
 * <p><b>为什么自己写而不引 commonmark：</b>本项目的 Markdown 由
 * {@code ReportHandoffBuilder} 与 {@code DailyReportBuilder} 自己产出，
 * 用到的语法只有标题、无序列表、引用、表格、粗体五种，语法面窄且可控。
 * 引一个 300KB 的完整解析器会同时引入它对 HTML 直通的处理策略——
 * 那正是 XSS 的口子。这里**所有文本一律转义后再拼标签**，
 * 产出的 HTML 不含任何来自数据的标签。</p>
 *
 * <p><b>安全约定（验收标准相关）：</b>转义在解析之前做，因此
 * {@code <script>} 会变成 {@code &lt;script&gt;}，不可能逃逸成标签。
 * 本类的输出是「结构可信、文本已转义」的 HTML。</p>
 *
 * @author ruoyi
 */
public final class MarkdownToHtml {

    private static final Pattern H3 = Pattern.compile("^###\\s+(.*)$");
    private static final Pattern H2 = Pattern.compile("^##\\s+(.*)$");
    private static final Pattern H1 = Pattern.compile("^#\\s+(.*)$");
    private static final Pattern UL = Pattern.compile("^[-*]\\s+(.*)$");
    private static final Pattern QUOTE = Pattern.compile("^>\\s?(.*)$");
    private static final Pattern TABLE_ROW = Pattern.compile("^\\|(.*)\\|\\s*$");
    private static final Pattern TABLE_SEP = Pattern.compile("^\\|[\\s:|-]+\\|\\s*$");
    private static final Pattern BOLD = Pattern.compile("\\*\\*(.+?)\\*\\*");

    /**
     * 转 Markdown 为 HTML 正文片段（不含 html/head/body 外壳，便于嵌入模板）
     */
    public static String toBody(String markdown) {
        if (markdown == null || markdown.isBlank()) {
            return "<p class=\"empty\">暂无内容</p>";
        }
        List<String> lines = split(markdown);
        StringBuilder sb = new StringBuilder();
        List<String> tableBuf = new ArrayList<>();
        boolean inUl = false;

        for (String raw : lines) {
            String line = raw.stripTrailing();
            if (line.isBlank()) {
                inUl = flushUl(sb, inUl);
                flushTable(sb, tableBuf);
                continue;
            }

            Matcher mRow = TABLE_ROW.matcher(line);
            if (mRow.matches()) {
                String inner = mRow.group(1);
                if (TABLE_SEP.matcher(line).matches()) {
                    continue;
                }
                tableBuf.add(inner);
                continue;
            }
            flushTable(sb, tableBuf);

            Matcher m;
            if ((m = H1.matcher(line)).matches()) {
                inUl = flushUl(sb, inUl);
                sb.append("<h1>").append(inline(m.group(1))).append("</h1>");
            } else if ((m = H2.matcher(line)).matches()) {
                inUl = flushUl(sb, inUl);
                sb.append("<h2>").append(inline(m.group(1))).append("</h2>");
            } else if ((m = H3.matcher(line)).matches()) {
                inUl = flushUl(sb, inUl);
                sb.append("<h3>").append(inline(m.group(1))).append("</h3>");
            } else if ((m = QUOTE.matcher(line)).matches()) {
                inUl = flushUl(sb, inUl);
                sb.append("<blockquote>").append(inline(m.group(1))).append("</blockquote>");
            } else if ((m = UL.matcher(line)).matches()) {
                if (!inUl) {
                    sb.append("<ul>");
                    inUl = true;
                }
                sb.append("<li>").append(inline(m.group(1))).append("</li>");
            } else {
                inUl = flushUl(sb, inUl);
                sb.append("<p>").append(inline(line)).append("</p>");
            }
        }
        inUl = flushUl(sb, inUl);
        flushTable(sb, tableBuf);
        return sb.toString();
    }

    /** 行内元素：先转义，再只对 **粗体** 开标签 —— 顺序不能反 */
    public static String inline(String s) {
        String esc = escape(s);
        return BOLD.matcher(esc).replaceAll("<strong>$1</strong>");
    }

    /** HTML 实体转义（XSS 防线，全项目文本出口统一走这里） */
    public static String escape(String s) {
        if (s == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder(s.length() + 16);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '&' -> sb.append("&amp;");
                case '<' -> sb.append("&lt;");
                case '>' -> sb.append("&gt;");
                case '"' -> sb.append("&quot;");
                case '\'' -> sb.append("&#39;");
                default -> sb.append(c);
            }
        }
        return sb.toString();
    }

    /* ------------------------------------------------------------------ 内部 */

    private static List<String> split(String md) {
        String[] arr = md.split("\\r?\\n", -1);
        List<String> list = new ArrayList<>(arr.length);
        for (String a : arr) {
            list.add(a);
        }
        return list;
    }

    private static boolean flushUl(StringBuilder sb, boolean inUl) {
        if (inUl) {
            sb.append("</ul>");
        }
        return false;
    }

    private static void flushTable(StringBuilder sb, List<String> buf) {
        if (buf.isEmpty()) {
            return;
        }
        sb.append("<table>");
        for (int i = 0; i < buf.size(); i++) {
            String[] cells = buf.get(i).split("\\|", -1);
            sb.append("<tr>");
            for (String cell : cells) {
                String tag = i == 0 ? "th" : "td";
                sb.append("<").append(tag).append(">").append(inline(cell.trim())).append("</").append(tag).append(">");
            }
            sb.append("</tr>");
        }
        sb.append("</table>");
        buf.clear();
    }

    private MarkdownToHtml() {
    }
}
