package org.dromara.yuqing.report.render;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.dromara.yuqing.report.config.YqReportProperties;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * PDF 渲染器（openhtmltopdf，F-014 验收标准 5）
 *
 * <p><b>渲染链路：</b>Markdown →（{@link MarkdownToHtml}）→ XHTML 片段
 * →（本类套壳 + CSS）→ PDF 字节。</p>
 *
 * <p><b>字体：</b>必须内嵌中文字体，否则 PDF 里全是方框。
 * openhtmltopdf 走的是 PDFBox 的字体加载，Windows 上的 msyh.ttc 是 TTC 集合、
 * Linux 上常见的是 Noto Sans CJK。本类按「配置路径 → 常见系统路径」顺序探测，
 * 都找不到时**返回明确失败**而不是产出乱码 PDF ——
 * 一份满屏方框的日报发到领导手机上，比生成失败严重得多。</p>
 *
 * @author ruoyi
 */
@Component
public class PdfRenderer {

    /** 常见中文字体路径（按优先级；TTC 与 TTF 混排） */
    private static final String[] FONT_CANDIDATES = {
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/simsun.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
        "/System/Library/Fonts/PingFang.ttc"
    };

    private final YqReportProperties props;

    public PdfRenderer(YqReportProperties props) {
        this.props = props;
        if (props.isRenderSelfCheck()) {
            String f = resolveFont();
            if (f == null) {
                org.slf4j.LoggerFactory.getLogger(PdfRenderer.class).warn(
                    "[报告] 未找到中文字体，PDF 导出将不可用；请配置 yuqing.report.pdf-font-path");
            }
        }
    }

    /**
     * 渲染 PDF
     *
     * @param title    文档标题
     * @param markdown 正文
     * @param fileName 输出文件名
     */
    public RenderResult render(String title, String markdown, String fileName) {
        String font = resolveFont();
        if (font == null) {
            return RenderResult.fail(DocumentFormat.PDF, fileName,
                "未找到可用的中文字体，无法生成 PDF。请在服务器安装 Noto Sans CJK 或配置字体路径。");
        }
        try {
            String html = wrap(title, markdown);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.useFont(new java.io.File(font), "cjk");
            builder.toStream(bos);
            builder.run();
            byte[] bytes = bos.toByteArray();
            if (bytes.length == 0) {
                return RenderResult.fail(DocumentFormat.PDF, fileName, "PDF 渲染产出 0 字节");
            }
            return RenderResult.ok(DocumentFormat.PDF, fileName, bytes);
        } catch (IOException e) {
            return RenderResult.fail(DocumentFormat.PDF, fileName, "PDF 渲染失败: " + e.getMessage());
        } catch (RuntimeException e) {
            return RenderResult.fail(DocumentFormat.PDF, fileName, "PDF 渲染异常: " + e.getMessage());
        }
    }

    /**
     * 套 XHTML 外壳 + 基础排版样式。
     *
     * <p>XHTML 而非 HTML4：openhtmltopdf 严格按 XML 解析，标签必须闭合，
     * {@link MarkdownToHtml} 的输出已满足这一约束。</p>
     */
    private String wrap(String title, String markdown) {
        String body = MarkdownToHtml.toBody(markdown);
        String t = MarkdownToHtml.escape(title == null ? "舆情报告" : title);
        return """
            <!DOCTYPE html>
            <html xmlns="http://www.w3.org/1999/xhtml">
            <head>
            <meta charset="UTF-8"/>
            <style>
              @page { size: A4; margin: 20mm 18mm; }
              body { font-family: "cjk", sans-serif; font-size: 10.5pt; line-height: 1.65; color: #1a1a1a; }
              h1 { font-size: 19pt; text-align: center; margin: 0 0 14pt 0; color: #0f2c4d; }
              h2 { font-size: 14pt; margin: 16pt 0 8pt 0; color: #14446f; border-bottom: 1px solid #cfd8e3; padding-bottom: 3pt; }
              h3 { font-size: 12pt; margin: 12pt 0 6pt 0; color: #1c5580; }
              p { margin: 5pt 0; }
              ul { margin: 5pt 0 5pt 16pt; padding: 0; }
              li { margin: 3pt 0; }
              table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 9.5pt; }
              th, td { border: 0.6pt solid #b9c4d0; padding: 4pt 6pt; text-align: left; }
              th { background: #eef3f8; font-weight: bold; }
              blockquote { margin: 8pt 0; padding: 6pt 10pt; background: #f6f8fa; border-left: 3pt solid #7aa3c9; color: #444; font-size: 9.5pt; }
              .empty { color: #888; font-style: italic; }
              strong { font-weight: bold; }
            </style>
            </head>
            <body>
            <h1>%s</h1>
            %s
            </body>
            </html>""".formatted(t, body);
    }

    /** 按配置路径 → 常见系统路径顺序探测 */
    private String resolveFont() {
        if (props != null && props.getPdfFontPath() != null && !props.getPdfFontPath().isBlank()) {
            java.io.File f = new java.io.File(props.getPdfFontPath());
            if (f.isFile()) {
                return f.getAbsolutePath();
            }
        }
        for (String p : FONT_CANDIDATES) {
            java.io.File f = new java.io.File(p);
            if (f.isFile()) {
                return f.getAbsolutePath();
            }
        }
        return null;
    }

    /** 供启动自检与运维接口查询 */
    public String fontPath() {
        return resolveFont();
    }

    /** 未使用的占位保持 —— StandardCharsets 供后续文本写出 */
    @SuppressWarnings("unused")
    private static final java.nio.charset.Charset UTF8 = StandardCharsets.UTF_8;
}
