package org.dromara.yuqing.report.render;

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

    private static final Pattern H1 = Pattern.compile("^#\\s+(.*)$");
    private static final Pattern H2 = Pattern.compile("^##\\s+(.*)$");
    private static final Pattern H3 = Pattern.compile("^###\\s+(.*)$");
    private static final Pattern UL = Pattern.compile("^[-*]\\s+(.*)$");
    private static final Pattern TABLE_ROW = Pattern.compile("^\\|(.*)\\|\\s*$");
    private static final Pattern TABLE_SEP = Pattern.compile("^\\|[\\s:|-]+\\|\\s*$");
    private static final Pattern QUOTE = Pattern.compile("^>\\s?(.*)$");

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
        for (String raw : markdown.split("\\r?\\n", -1)) {
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
            String[] cells = row.split("\\|", -1);
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
