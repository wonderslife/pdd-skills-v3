/**
 * F-014 日报生成 · 模板分片 1/5
 * 归属：配置类 + 文档渲染工具（Word/PDF）
 *
 * 产物：
 *   report/config/YqReportProperties.java
 *   report/render/DocumentFormat.java
 *   report/render/RenderResult.java
 *   report/render/WordRenderer.java
 *   report/render/PdfRenderer.java
 *   report/render/MarkdownToHtml.java
 *
 * ⚠ 三层转义：模板里写 \\ 才能产出 Java 的单个反斜杠；产物严禁出现反引号。
 *   Java 一律用文本块或显式拼接，不用 \n / \t 转义序列（见主生成器约定）。
 */
export const REPORT_TPL1 = [
  /* ------------------------------------------------------------ 配置属性 */
  {
    rel: 'report/config/YqReportProperties.java',
    content: `package org.dromara.yuqing.report.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 舆情日报 / 月报生成配置（F-014 / F-015）
 *
 * <p>前缀 {@code yuqing.report}。所有开关默认保守：{@code enabled} 默认 true 但
 * {@code auto-generate} 默认 false —— 定时任务依赖 SnailJob 控制台创建执行器，
 * 在运维配置前不自动跑，避免半夜给全公司推送空日报。</p>
 *
 * @author ruoyi
 */
@Data
@Component
@ConfigurationProperties(prefix = "yuqing.report")
public class YqReportProperties {

    /** 是否启用报告生成引擎（产品开关） */
    private boolean enabled = true;

    /** 是否启用定时自动生成（需先在 SnailJob 控制台创建 yuqingDailyReport 执行器） */
    private boolean autoGenerate = false;

    /** 自动生成的报告类型：daily / monthly */
    private String autoType = "daily";

    /** 自动生成时使用的默认模板ID；为空则用系统内置无模板渲染 */
    private Long defaultTemplateId;

    /** 正文纳入的重点舆情条数上限 */
    private int hotOpinionLimit = 10;

    /** 正文纳入的预警条数上限 */
    private int alertLimit = 20;

    /** 是否在生成后自动推送至企业微信 */
    private boolean pushAfterGenerate = false;

    /** 启动时自检字体与渲染器可用性，缺依赖直接打 error 而非静默降级 */
    private boolean renderSelfCheck = true;

    /**
     * PDF 中文字体文件路径。
     *
     * <p>留空则由 {@code PdfRenderer} 按内置候选清单探测
     * （Windows 的 msyh.ttc / Linux 的 NotoSansCJK）。Linux 服务器上
     * 若用 Docker 精简镜像，务必显式配置本项或安装 fonts-noto-cjk，
     * 否则 PDF 导出会因找不到字体而明确失败。</p>
     */
    private String pdfFontPath;
}
`,
  },

  /* ------------------------------------------------------------ 枚举 */
  {
    rel: 'report/render/DocumentFormat.java',
    content: `package org.dromara.yuqing.report.render;

/**
 * 报告导出格式（F-014 验收标准 5：PDF 与 Word 两种）
 *
 * <p>企业微信应用消息的 file 类型只吃 doc/docx/xls/xlsx/ppt/pptx/pdf，
 * 因此两种格式都能直接推送，无需中转。</p>
 *
 * @author ruoyi
 */
public enum DocumentFormat {

    /** Word 文档（.docx），由 poi-tl 渲染 */
    DOCX("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),

    /** PDF 文档，由 openhtmltopdf 渲染 */
    PDF("pdf", "application/pdf"),

    /** 纯 Markdown 文本，仅用于在线查看与降级，不推送 */
    MARKDOWN("md", "text/markdown");

    private final String ext;

    private final String mime;

    DocumentFormat(String ext, String mime) {
        this.ext = ext;
        this.mime = mime;
    }

    public String getExt() {
        return ext;
    }

    public String getMime() {
        return mime;
    }

    /**
     * 宽松解析：未知或空值回落 MARKDOWN 而不是抛异常 ——
     * 导出格式是前端传参，不该因为一个拼错的值让整个接口 500。
     */
    public static DocumentFormat of(String v) {
        if (v == null) {
            return MARKDOWN;
        }
        String s = v.trim().toLowerCase();
        for (DocumentFormat f : values()) {
            if (f.ext.equals(s) || f.name().equalsIgnoreCase(s)) {
                return f;
            }
        }
        if ("word".equals(s) || "doc".equals(s)) {
            return DOCX;
        }
        return MARKDOWN;
    }
}
`,
  },

  /* ------------------------------------------------------------ 渲染结果 */
  {
    rel: 'report/render/RenderResult.java',
    content: `package org.dromara.yuqing.report.render;

/**
 * 渲染结果（不可变）
 *
 * <p>刻意用「成功 + 字节」而非抛异常：报告生成是长流程，
 * 渲染失败要能让上层落一条 status=failed 记录并写 failReason，
 * 异常一路抛到 Controller 会丢掉已生成的前半截内容。</p>
 *
 * @param ok       是否成功
 * @param format   目标格式
 * @param fileName 建议文件名（不含路径）
 * @param bytes    文件字节；失败时为 null
 * @param message  成功时的说明或失败原因
 * @author ruoyi
 */
public record RenderResult(boolean ok, DocumentFormat format, String fileName, byte[] bytes, String message) {

    public static RenderResult ok(DocumentFormat format, String fileName, byte[] bytes) {
        return new RenderResult(true, format, fileName, bytes, "渲染成功，共 " + (bytes == null ? 0 : bytes.length) + " 字节");
    }

    public static RenderResult fail(DocumentFormat format, String fileName, String message) {
        return new RenderResult(false, format, fileName, null, message);
    }

    public int size() {
        return bytes == null ? 0 : bytes.length;
    }
}
`,
  },

  /* ------------------------------------------------------------ Markdown→HTML */
  {
    rel: 'report/render/MarkdownToHtml.java',
    content: `package org.dromara.yuqing.report.render;

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

    private static final Pattern H3 = Pattern.compile("^###\\\\s+(.*)$");
    private static final Pattern H2 = Pattern.compile("^##\\\\s+(.*)$");
    private static final Pattern H1 = Pattern.compile("^#\\\\s+(.*)$");
    private static final Pattern UL = Pattern.compile("^[-*]\\\\s+(.*)$");
    private static final Pattern QUOTE = Pattern.compile("^>\\\\s?(.*)$");
    private static final Pattern TABLE_ROW = Pattern.compile("^\\\\|(.*)\\\\|\\\\s*$");
    private static final Pattern TABLE_SEP = Pattern.compile("^\\\\|[\\\\s:|-]+\\\\|\\\\s*$");
    private static final Pattern BOLD = Pattern.compile("\\\\*\\\\*(.+?)\\\\*\\\\*");

    /**
     * 转 Markdown 为 HTML 正文片段（不含 html/head/body 外壳，便于嵌入模板）
     */
    public static String toBody(String markdown) {
        if (markdown == null || markdown.isBlank()) {
            return "<p class=\\"empty\\">暂无内容</p>";
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
                case '\\'' -> sb.append("&#39;");
                default -> sb.append(c);
            }
        }
        return sb.toString();
    }

    /* ------------------------------------------------------------------ 内部 */

    private static List<String> split(String md) {
        String[] arr = md.split("\\\\r?\\\\n", -1);
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
            String[] cells = buf.get(i).split("\\\\|", -1);
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
`,
  },

  /* ------------------------------------------------------------ Word 渲染 */
  {
    rel: 'report/render/WordRenderer.java',
    content: `package org.dromara.yuqing.report.render;

import com.deepoove.poi.XWPFTemplate;
import com.deepoove.poi.data.ParagraphRenderData;
import com.deepoove.poi.data.Paragraphs;
import com.deepoove.poi.data.Texts;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Word 渲染器（poi-tl，F-014 验收标准 5）
 *
 * <p><b>无模板降级：</b>poi-tl 的常规用法是拿一个 .docx 模板填占位符。
 * 但日报的模板（{@code yq_report_template}）是业务人员在 PC 端配的字段清单，
 * 不是 docx 文件；要求每个单位上传一个 docx 模板不现实。因此本渲染器
 * **不依赖外部模板文件**：它把 Markdown 正文逐行转成 poi-tl 的段落对象流，
 * 套用内置的标题/正文样式后写出 docx。</p>
 *
 * <p>这样做的代价是版式是内置的（标题层级 + 正文 + 表格），
 * 收益是「生成即成功」，不会因为运营忘了传模板而整条链路失败。</p>
 *
 * @author ruoyi
 */
@Component
public class WordRenderer {

    private static final Pattern H1 = Pattern.compile("^#\\\\s+(.*)$");
    private static final Pattern H2 = Pattern.compile("^##\\\\s+(.*)$");
    private static final Pattern H3 = Pattern.compile("^###\\\\s+(.*)$");
    private static final Pattern UL = Pattern.compile("^[-*]\\\\s+(.*)$");
    private static final Pattern TABLE_ROW = Pattern.compile("^\\\\|(.*)\\\\|\\\\s*$");
    private static final Pattern TABLE_SEP = Pattern.compile("^\\\\|[\\\\s:|-]+\\\\|\\\\s*$");
    private static final Pattern QUOTE = Pattern.compile("^>\\\\s?(.*)$");

    /**
     * 渲染 docx
     *
     * @param title    文档标题（报告名称）
     * @param markdown 正文 Markdown
     * @param fileName 输出文件名
     */
    public RenderResult render(String title, String markdown, String fileName) {
        try (InputStream in = blankTemplate()) {
            XWPFTemplate tpl = XWPFTemplate.compile(in);
            Map<String, Object> model = new HashMap<>();
            model.put("title", Texts.of(title == null ? "舆情报告" : title).bold().fontSize(18).create());
            model.put("body", paragraphs(markdown));
            tpl.render(model);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            tpl.write(bos);
            tpl.close();
            byte[] bytes = bos.toByteArray();
            if (bytes.length == 0) {
                return RenderResult.fail(DocumentFormat.DOCX, fileName, "poi-tl 写出 0 字节，模板可能不合法");
            }
            return RenderResult.ok(DocumentFormat.DOCX, fileName, bytes);
        } catch (IOException e) {
            return RenderResult.fail(DocumentFormat.DOCX, fileName, "Word 渲染失败: " + e.getMessage());
        } catch (RuntimeException e) {
            return RenderResult.fail(DocumentFormat.DOCX, fileName, "Word 渲染异常: " + e.getMessage());
        }
    }

    /**
     * 内置空白模板：一个含 {{title}} 与 {{body}} 两处占位的最小 docx。
     *
     * <p>不落资源文件而在这里用编程方式构造，是为了避免生成器要同时管理
     * 二进制资源 —— 生成器只产文本，二进制由运行时构造，边界干净。</p>
     */
    private InputStream blankTemplate() {
        byte[] docx = MinimalDocx.build("{{title}}", "{{body}}");
        return new java.io.ByteArrayInputStream(docx);
    }

    /**
     * Markdown → poi-tl 段落列表
     */
    private List<ParagraphRenderData> paragraphs(String markdown) {
        List<ParagraphRenderData> out = new ArrayList<>();
        if (markdown == null || markdown.isBlank()) {
            out.add(Paragraphs.of(Texts.of("暂无内容").create()).create());
            return out;
        }
        List<String> tableBuf = new ArrayList<>();
        for (String raw : markdown.split("\\\\r?\\\\n", -1)) {
            String line = raw.stripTrailing();
            if (line.isBlank()) {
                flushTable(out, tableBuf);
                continue;
            }
            Matcher mRow = TABLE_ROW.matcher(line);
            if (mRow.matches()) {
                if (!TABLE_SEP.matcher(line).matches()) {
                    tableBuf.add(mRow.group(1));
                }
                continue;
            }
            flushTable(out, tableBuf);

            Matcher m;
            if ((m = H1.matcher(line)).matches()) {
                out.add(Paragraphs.of(Texts.of(m.group(1)).bold().fontSize(16).create()).create());
            } else if ((m = H2.matcher(line)).matches()) {
                out.add(Paragraphs.of(Texts.of(m.group(1)).bold().fontSize(14).create()).create());
            } else if ((m = H3.matcher(line)).matches()) {
                out.add(Paragraphs.of(Texts.of(m.group(1)).bold().fontSize(12).create()).create());
            } else if ((m = QUOTE.matcher(line)).matches()) {
                out.add(Paragraphs.of(Texts.of("　" + m.group(1)).italic().create()).create());
            } else if ((m = UL.matcher(line)).matches()) {
                out.add(Paragraphs.of(Texts.of("· " + m.group(1)).create()).create());
            } else {
                out.add(Paragraphs.of(Texts.of(line).create()).create());
            }
        }
        flushTable(out, tableBuf);
        return out;
    }

    /** 表格转成「列1 | 列2 | 列3」的等宽文本行 —— docx 里画真表格代码量大且易错 */
    private void flushTable(List<ParagraphRenderData> out, List<String> buf) {
        if (buf.isEmpty()) {
            return;
        }
        for (String row : buf) {
            String[] cells = row.split("\\\\|", -1);
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < cells.length; i++) {
                if (i > 0) {
                    sb.append("  |  ");
                }
                sb.append(cells[i].trim());
            }
            out.add(Paragraphs.of(Texts.of(sb.toString()).create()).create());
        }
        buf.clear();
    }
}
`,
  },

  /* ------------------------------------------------------------ 最小 docx 构造器 */
  {
    rel: 'report/render/MinimalDocx.java',
    content: `package org.dromara.yuqing.report.render;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * 最小合法 .docx 构造器（纯函数）
 *
 * <p>docx 本质是一个 zip，至少要含 [Content_Types].xml、_rels/.rels、
 * word/document.xml 三个条目。这里按 OOXML 最小子集手工拼一份，
 * 供 {@link WordRenderer} 作为 poi-tl 的编译输入。</p>
 *
 * <p>为什么不放在 resources 下做成二进制资源：生成器体系只产文本文件，
 * 二进制资源会让「一个产物一个归属」的校验失效。构造逻辑在这里是代码，
 * 可读、可测、可 diff。</p>
 *
 * @author ruoyi
 */
final class MinimalDocx {

    private static final String CONTENT_TYPES = """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
        </Types>""";

    private static final String RELS = """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
        </Relationships>""";

    /**
     * 构造含两个占位段落的最小 docx
     *
     * @param titlePlaceholder 标题占位符（如 {{title}}）
     * @param bodyPlaceholder  正文占位符（如 {{body}}）
     */
    static byte[] build(String titlePlaceholder, String bodyPlaceholder) {
        String doc = """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
              <w:body>
                <w:p><w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>
                <w:p><w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>
                <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
              </w:body>
            </w:document>""".formatted(xml(titlePlaceholder), xml(bodyPlaceholder));
        try {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(bos)) {
                put(zip, "[Content_Types].xml", CONTENT_TYPES);
                put(zip, "_rels/.rels", RELS);
                put(zip, "word/document.xml", doc);
            }
            return bos.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("构造最小 docx 失败: " + e.getMessage(), e);
        }
    }

    private static void put(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private static String xml(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\\"", "&quot;");
    }

    private MinimalDocx() {
    }
}
`,
  },
];
