package org.dromara.yuqing.report;

import org.dromara.yuqing.report.build.DailyReportBuilder;
import org.dromara.yuqing.report.build.ReportFileName;
import org.dromara.yuqing.report.build.ReportScopeResolver;
import org.dromara.yuqing.report.domain.DailyAlertRow;
import org.dromara.yuqing.report.domain.DailyHotRow;
import org.dromara.yuqing.report.domain.DailyReportContext;
import org.dromara.yuqing.report.render.DocumentFormat;
import org.dromara.yuqing.report.render.MarkdownToHtml;
import org.dromara.yuqing.report.render.RenderResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * F-014 日报生成 离线自测（不依赖 Spring 容器与数据库）
 *
 * <p>覆盖范围：**纯函数**与不可变对象 —— 正文构建器、文件名清洗、
 * 范围解析、Markdown→HTML、格式枚举。渲染器（WordRenderer / PdfRenderer）
 * 与 ExtServiceImpl 依赖三方库与数据库，不在此测。</p>
 *
 * @author ruoyi
 */
@DisplayName("F-014 日报生成")
public class F014ReportTest {

    private static final LocalDate D = LocalDate.of(2026, 9, 22);

    private DailyReportContext baseCtx() {
        DailyReportContext ctx = new DailyReportContext();
        ctx.setReportDate(D);
        return ctx;
    }

    /* ------------------------------------------------------------ 标题与骨架 */

    @Test
    @DisplayName("无报告名时标题为「舆情日报 YYYY-MM-DD」")
    void 标题默认值() {
        String t = DailyReportBuilder.title(baseCtx(), D);
        assertEquals("舆情日报 2026-09-22", t);
    }

    @Test
    @DisplayName("指定报告名时以指定值为准")
    void 标题优先用指定名() {
        DailyReportContext ctx = baseCtx();
        ctx.setReportName("台风梅花舆情专报");
        assertEquals("台风梅花舆情专报", DailyReportBuilder.title(ctx, D));
    }

    @Test
    @DisplayName("正文以 H1 标题开头且含统计日期")
    void 正文骨架完整() {
        String md = DailyReportBuilder.build(baseCtx());
        assertTrue(md.startsWith("# 舆情日报 2026-09-22"), "应以 H1 标题开头");
        assertTrue(md.contains("统计日期：2026-09-22"), "应含统计日期");
        assertTrue(md.contains("### 八、当日新增预警"), "应含预警章节");
        assertTrue(md.contains("### 九、重点舆情详情"), "应含重点舆情章节");
    }

    @Test
    @DisplayName("无分析交接件时给出明确提示而非空白")
    void 无分析数据时提示() {
        String md = DailyReportBuilder.build(baseCtx());
        assertTrue(md.contains("未取到当日分析批次数据"), "应提示缺分析数据");
    }

    @Test
    @DisplayName("交接件自带的一级标题会被剥掉，避免出现两个 H1")
    void 剥离交接件一级标题() {
        DailyReportContext ctx = baseCtx();
        org.dromara.yuqing.analytics.ReportSection s = new org.dromara.yuqing.analytics.ReportSection();
        s.setMarkdown("# 多维分析日报\n\n### 一、总体态势\n\n- 总量 100 条");
        ctx.setSection(s);
        String md = DailyReportBuilder.build(ctx);
        long h1 = md.lines().filter(l -> l.startsWith("# ")).count();
        assertEquals(1L, h1, "正文应只有一个 H1");
        assertTrue(md.contains("### 一、总体态势"), "应保留交接件的二级结构");
    }

    /* ------------------------------------------------------------ 预警章节 */

    @Test
    @DisplayName("预警空清单输出「当日无新增预警」")
    void 预警为空时给出说明() {
        String md = DailyReportBuilder.build(baseCtx());
        assertTrue(md.contains("当日无新增预警"));
    }

    @Test
    @DisplayName("预警按表头七列输出且等级/场景/状态被翻译为中文")
    void 预警表格渲染() {
        DailyReportContext ctx = baseCtx();
        ctx.setAlerts(List.of(new DailyAlertRow(1L, "台风话题负面聚集", "urgent", "keyword",
            "台风", "微博", LocalDateTime.of(2026, 9, 22, 10, 30), "pending")));
        String md = DailyReportBuilder.build(ctx);
        assertTrue(md.contains("| 序号 | 预警等级 | 触发场景 | 预警内容 | 来源渠道 | 触发时间 | 状态 |"));
        assertTrue(md.contains("紧急"), "urgent 应译为紧急");
        assertTrue(md.contains("关键词命中"), "keyword 应译为关键词命中");
        assertTrue(md.contains("未处置"), "pending 应译为未处置");
        assertTrue(md.contains("2026-09-22 10:30"), "时间应按 yyyy-MM-dd HH:mm 输出");
    }

    @Test
    @DisplayName("预警标题中的竖线与换行会被清洗，避免表格错列")
    void 预警标题清洗竖线() {
        DailyReportContext ctx = baseCtx();
        ctx.setAlerts(List.of(new DailyAlertRow(1L, "标题|带竖线\n带换行", "notice", "heat",
            null, null, null, null)));
        String md = DailyReportBuilder.build(ctx);
        assertFalse(md.contains("标题|带竖线"), "竖线应被替换");
        assertTrue(md.contains("标题/带竖线"), "竖线应替换为斜杠");
    }

    /* ------------------------------------------------------------ 重点舆情 */

    @Test
    @DisplayName("重点舆情按列表输出，含平台/属性/热度与互动数")
    void 重点舆情渲染() {
        DailyReportContext ctx = baseCtx();
        ctx.setHotOpinions(List.of(new DailyHotRow(9L, "某地暴雨", "新闻网站", "negative", "high",
            88, 12000L, 340L, 210L, "https://example.com/a", LocalDateTime.of(2026, 9, 22, 8, 0))));
        String md = DailyReportBuilder.build(ctx);
        assertTrue(md.contains("1. **某地暴雨**"));
        assertTrue(md.contains("平台：新闻网站"));
        assertTrue(md.contains("风险：高"), "high 应译为高");
        assertTrue(md.contains("热度：88"));
        assertTrue(md.contains("阅读 12000 / 转发 340 / 评论 210"));
        assertTrue(md.contains("https://example.com/a"));
    }

    @Test
    @DisplayName("非 http(s) 的链接被隐藏，不写入正文")
    void 非法链接被隐藏() {
        DailyReportContext ctx = baseCtx();
        ctx.setHotOpinions(List.of(new DailyHotRow(9L, "标题", null, null, null,
            null, null, null, null, "javascript:alert(1)", null)));
        String md = DailyReportBuilder.build(ctx);
        assertFalse(md.contains("javascript:"), "非 http(s) 链接必须被拒绝");
        assertTrue(md.contains("链接格式异常"));
    }

    @Test
    @DisplayName("标题含 ** 时先摘除，避免破坏加粗配平")
    void 标题加粗符号被摘除() {
        DailyReportContext ctx = baseCtx();
        ctx.setHotOpinions(List.of(new DailyHotRow(1L, "**重点** 事件", null, null, null,
            null, null, null, null, null, null)));
        String md = DailyReportBuilder.build(ctx);
        assertTrue(md.contains("1. **重点 事件**"), "内部 ** 应被摘除但外层保留");
    }

    @Test
    @DisplayName("热度与互动数为 null 时按 0 输出，不出现 null 字样")
    void 空数值按零输出() {
        DailyReportContext ctx = baseCtx();
        ctx.setHotOpinions(List.of(new DailyHotRow(1L, "标题", null, null, null,
            null, null, null, null, null, null)));
        String md = DailyReportBuilder.build(ctx);
        assertTrue(md.contains("热度：0"));
        assertTrue(md.contains("阅读 0 / 转发 0 / 评论 0"));
        assertFalse(md.contains("null"), "正文不应出现 null");
    }

    /* ------------------------------------------------------------ 模板裁剪 */

    @Test
    @DisplayName("模板空清单 = 不裁剪，全章节输出")
    void 模板空清单不裁剪() {
        DailyReportContext ctx = baseCtx();
        ctx.setHotOpinions(List.of(new DailyHotRow(1L, "标题", null, null, null,
            null, null, null, null, null, null)));
        String md = DailyReportBuilder.build(ctx);
        assertTrue(md.contains("### 九、重点舆情详情"));
    }

    @Test
    @DisplayName("模板未勾选 hot 时不输出重点舆情章节")
    void 模板裁剪生效() {
        DailyReportContext ctx = baseCtx();
        ctx.setRequiredSections(List.of("alert"));
        ctx.setHotOpinions(List.of(new DailyHotRow(1L, "标题", null, null, null,
            null, null, null, null, null, null)));
        String md = DailyReportBuilder.build(ctx);
        assertTrue(md.contains("### 八、当日新增预警"), "alert 在清单内应输出");
        assertFalse(md.contains("### 九、重点舆情详情"), "hot 不在清单内应裁剪");
    }

    /* ------------------------------------------------------------ 提示区 */

    @Test
    @DisplayName("取数降级说明写入生成提示区")
    void 提示区渲染() {
        DailyReportContext ctx = baseCtx();
        ctx.setNotices(List.of("多维分析数据获取失败：连接超时", "已保留人工补充的舆情 3 条"));
        String md = DailyReportBuilder.build(ctx);
        assertTrue(md.contains("> **生成提示**"));
        assertTrue(md.contains("> - 多维分析数据获取失败：连接超时"));
        assertTrue(md.contains("> - 已保留人工补充的舆情 3 条"));
    }

    @Test
    @DisplayName("空提示项被忽略，不产出空的引用行")
    void 空提示被忽略() {
        DailyReportContext ctx = baseCtx();
        List<String> notices = new ArrayList<>();
        notices.add("正常提示");
        notices.add("");
        notices.add(null);
        ctx.setNotices(notices);
        String md = DailyReportBuilder.build(ctx);
        assertEquals(1L, md.lines().filter(l -> l.startsWith("> - ")).count());
    }

    @Test
    @DisplayName("收尾统计条数正确")
    void 收尾统计() {
        DailyReportContext ctx = baseCtx();
        ctx.setHotOpinions(List.of(
            new DailyHotRow(1L, "a", null, null, null, null, null, null, null, null, null),
            new DailyHotRow(2L, "b", null, null, null, null, null, null, null, null, null)));
        ctx.setAlerts(List.of(new DailyAlertRow(1L, "x", null, null, null, null, null, null)));
        String md = DailyReportBuilder.build(ctx);
        assertTrue(md.contains("共纳入舆情 2 条、预警 1 条"));
    }

    @Test
    @DisplayName("同一上下文重复构建结果完全一致（确定性）")
    void 构建确定性() {
        DailyReportContext ctx = baseCtx();
        ctx.setAlerts(List.of(new DailyAlertRow(1L, "x", "urgent", "heat", "v", "微博",
            LocalDateTime.of(2026, 9, 22, 1, 2), "pending")));
        ctx.setHotOpinions(List.of(new DailyHotRow(1L, "t", "c", "negative", "high",
            50, 1L, 2L, 3L, "https://a.b", LocalDateTime.of(2026, 9, 22, 3, 4))));
        assertEquals(DailyReportBuilder.build(ctx), DailyReportBuilder.build(ctx));
    }

    @Test
    @DisplayName("null 上下文不抛异常")
    void 空上下文安全() {
        String md = DailyReportBuilder.build(null);
        assertNotNull(md);
        assertTrue(md.contains("舆情日报"));
    }

    /* ------------------------------------------------------------ 范围解析 */

    @Test
    @DisplayName("日报范围为当日 00:00 至当日 24:00（同一天）")
    void 日报范围同一天() {
        var scope = ReportScopeResolver.daily(D);
        assertEquals(D, scope.getDateFrom());
        assertEquals(D, scope.getDateTo());
    }

    @Test
    @DisplayName("日报日期为空时默认取昨天")
    void 日报默认昨天() {
        var scope = ReportScopeResolver.daily(null);
        assertEquals(LocalDate.now().minusDays(1), scope.getDateFrom());
    }

    @Test
    @DisplayName("月报范围覆盖整月首末")
    void 月报范围整月() {
        var scope = ReportScopeResolver.monthly(2026, 2);
        assertEquals(LocalDate.of(2026, 2, 1), scope.getDateFrom());
        assertEquals(LocalDate.of(2026, 2, 28), scope.getDateTo());
    }

    @Test
    @DisplayName("闰年二月月报末位为 29")
    void 闰年月报() {
        var scope = ReportScopeResolver.monthly(2024, 2);
        assertEquals(LocalDate.of(2024, 2, 29), scope.getDateTo());
    }

    /* ------------------------------------------------------------ 文件名 */

    @Test
    @DisplayName("无报告名时按类型与日期生成文件名")
    void 文件名默认() {
        assertEquals("舆情日报-20260922.docx", ReportFileName.of("daily", D, null, "docx"));
        assertEquals("舆情月报-20260901.pdf", ReportFileName.of("monthly", LocalDate.of(2026, 9, 1), null, "pdf"));
    }

    @Test
    @DisplayName("文件名清洗路径分隔符与非法字符")
    void 文件名清洗() {
        String n = ReportFileName.sanitize("9月/22日 报告:第一版*终稿?");
        assertFalse(n.contains("/"));
        assertFalse(n.contains(":"));
        assertFalse(n.contains("*"));
        assertFalse(n.contains("?"));
        assertTrue(n.contains("9月"));
    }

    @Test
    @DisplayName("清洗后为空时回落「舆情报告」")
    void 文件名回落() {
        String n = ReportFileName.sanitize("///");
        assertFalse(n.isBlank());
        assertEquals("___", n);
    }

    @Test
    @DisplayName("超长文件名按 UTF-8 字节截断不超过 120")
    void 文件名长度限制() {
        String longName = "舆情报告".repeat(60);
        String n = ReportFileName.sanitize(longName);
        assertTrue(n.getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= 120);
    }

    /* ------------------------------------------------------------ 格式枚举 */

    @Test
    @DisplayName("格式解析支持大小写与别名")
    void 格式解析() {
        assertEquals(DocumentFormat.DOCX, DocumentFormat.of("docx"));
        assertEquals(DocumentFormat.DOCX, DocumentFormat.of("DOCX"));
        assertEquals(DocumentFormat.DOCX, DocumentFormat.of("word"));
        assertEquals(DocumentFormat.PDF, DocumentFormat.of("PDF"));
        assertEquals(DocumentFormat.MARKDOWN, DocumentFormat.of("md"));
    }

    @Test
    @DisplayName("未知格式回落 MARKDOWN 而非抛异常")
    void 格式回落() {
        assertEquals(DocumentFormat.MARKDOWN, DocumentFormat.of("exe"));
        assertEquals(DocumentFormat.MARKDOWN, DocumentFormat.of(null));
        assertEquals(DocumentFormat.MARKDOWN, DocumentFormat.of("  "));
    }

    /* ------------------------------------------------------------ Markdown→HTML */

    @Test
    @DisplayName("HTML 转义阻断 XSS：标签被转义为实体")
    void html转义阻断xss() {
        String html = MarkdownToHtml.toBody("<script>alert(1)</script>");
        assertFalse(html.contains("<script>"), "不允许出现原始 script 标签");
        assertTrue(html.contains("&lt;script&gt;"));
    }

    @Test
    @DisplayName("HTML 转义覆盖引号与 & 符号")
    void html转义覆盖特殊字符() {
        String html = MarkdownToHtml.inline("a & b \" c ' d");
        assertTrue(html.contains("&amp;"));
        assertTrue(html.contains("&quot;"));
        assertTrue(html.contains("&#39;"));
    }

    @Test
    @DisplayName("标题层级正确映射为 h1/h2/h3")
    void html标题映射() {
        String html = MarkdownToHtml.toBody("# 一级\n## 二级\n### 三级");
        assertTrue(html.contains("<h1>一级</h1>"));
        assertTrue(html.contains("<h2>二级</h2>"));
        assertTrue(html.contains("<h3>三级</h3>"));
    }

    @Test
    @DisplayName("无序列表合并为单个 ul")
    void html列表合并() {
        String html = MarkdownToHtml.toBody("- a\n- b\n- c");
        assertEquals(1, countOf(html, "<ul>"));
        assertEquals(3, countOf(html, "<li>"));
        assertEquals(1, countOf(html, "</ul>"));
    }

    @Test
    @DisplayName("表格含表头行时首行用 th")
    void html表格表头() {
        String html = MarkdownToHtml.toBody("| a | b |\n| --- | --- |\n| 1 | 2 |");
        assertTrue(html.contains("<th>a</th>"));
        assertTrue(html.contains("<td>1</td>"));
        assertEquals(2, countOf(html, "<tr>"));
    }

    @Test
    @DisplayName("引用行转 blockquote")
    void html引用() {
        String html = MarkdownToHtml.toBody("> 数据截止时间：2026-09-22");
        assertTrue(html.contains("<blockquote>"));
    }

    @Test
    @DisplayName("空正文返回占位段落")
    void html空正文() {
        String html = MarkdownToHtml.toBody("");
        assertTrue(html.contains("暂无内容"));
        assertTrue(MarkdownToHtml.toBody(null).contains("暂无内容"));
    }

    @Test
    @DisplayName("粗体先转义再开标签，顺序不可反")
    void html粗体转义顺序() {
        String html = MarkdownToHtml.inline("**<b>x</b>**");
        assertTrue(html.contains("<strong>"));
        assertFalse(html.contains("<b>"), "内部标签必须被转义");
        assertTrue(html.contains("&lt;b&gt;"));
    }

    @Test
    @DisplayName("日报正文可完整转 HTML 且标签配平")
    void 日报正文转html配平() {
        DailyReportContext ctx = baseCtx();
        ctx.setAlerts(List.of(new DailyAlertRow(1L, "预警", "urgent", "keyword", "值", "微博",
            LocalDateTime.of(2026, 9, 22, 9, 0), "pending")));
        String md = DailyReportBuilder.build(ctx);
        String html = MarkdownToHtml.toBody(md);
        assertEquals(countOf(html, "<table>"), countOf(html, "</table>"));
        assertEquals(countOf(html, "<ul>"), countOf(html, "</ul>"));
        assertFalse(html.contains("<script>"));
    }

    /* ------------------------------------------------------------ 渲染结果 */

    @Test
    @DisplayName("渲染结果 ok/fail 语义正确")
    void 渲染结果语义() {
        RenderResult ok = RenderResult.ok(DocumentFormat.PDF, "a.pdf", new byte[]{1, 2, 3});
        assertTrue(ok.ok());
        assertEquals(3, ok.size());

        RenderResult fail = RenderResult.fail(DocumentFormat.PDF, "a.pdf", "字体缺失");
        assertFalse(fail.ok());
        assertEquals(0, fail.size());
        assertTrue(fail.message().contains("字体缺失"));
    }

    /* ------------------------------------------------------------ 工具 */

    private static int countOf(String s, String sub) {
        int c = 0;
        int i = 0;
        while ((i = s.indexOf(sub, i)) >= 0) {
            c++;
            i += sub.length();
        }
        return c;
    }
}
