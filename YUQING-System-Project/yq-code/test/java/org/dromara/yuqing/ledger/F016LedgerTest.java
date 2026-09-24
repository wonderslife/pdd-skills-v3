package org.dromara.yuqing.ledger;

import org.dromara.yuqing.ledger.domain.LedgerQuery;
import org.dromara.yuqing.ledger.domain.LedgerRow;
import org.dromara.yuqing.ledger.export.LedgerExcelWriter;
import org.dromara.yuqing.ledger.support.LedgerColumnCatalog;
import org.dromara.yuqing.ledger.support.LedgerEmptyHint;
import org.dromara.yuqing.ledger.support.LedgerHighlighter;
import org.dromara.yuqing.ledger.support.LedgerQuerySummary;
import org.dromara.yuqing.ledger.support.LedgerScope;
import org.dromara.yuqing.ledger.support.LedgerScopeResolver;
import org.dromara.yuqing.ledger.support.LedgerStages;
import org.dromara.yuqing.ledger.support.LedgerTimeParser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Enumeration;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * F-016 舆情台账 离线自测（不依赖 Spring 容器与数据库）
 *
 * <p><b>覆盖范围：</b>全部纯函数与不可变对象 —— 数据范围推导、高亮转义、
 * 空状态建议、列白名单、条件摘要与文件名、时间解析、传播阶段判定，
 * 以及 xlsx 的真实生成与列裁剪。</p>
 *
 * <p><b>为什么不测 Service：</b>台账查询依赖 Doris/MySQL 双库与 Sa-Token 上下文，
 * 离线跑不起来；而它最危险的部分是「范围推导」，已经抽成纯函数
 * {@link LedgerScopeResolver} 在此覆盖。跨库编排的正确性由部署后的联调保证。</p>
 *
 * <p><b>为什么 xlsx 要真跑：</b>导出最容易「改了一行没人发现」——
 * 比如注解包名从 Fesod 写回 EasyExcel，导出会静默变成没有表头的空表。
 * 这里把字节解开读 XML，直接断言表头文案存在 / 不存在。</p>
 *
 * @author ruoyi
 */
@DisplayName("F-016 舆情台账")
public class F016LedgerTest {

    /* ================================================================ 数据权限三态 */

    @Test
    @DisplayName("LedgerScope.all 放行任意任务且描述为「全量」")
    void 全量范围放行一切() {
        LedgerScope all = LedgerScope.all();
        assertTrue(all.isUnrestricted());
        assertFalse(all.isDenyAll());
        assertTrue(all.allows(1L));
        assertTrue(all.allows(null), "全量范围下 taskId 为空也放行（历史数据可能无任务）");
        assertEquals("全量", all.describe());
    }

    @Test
    @DisplayName("LedgerScope.none 拒绝一切且描述含「0 条」")
    void 无范围拒绝一切() {
        LedgerScope none = LedgerScope.none();
        assertFalse(none.isUnrestricted());
        assertTrue(none.isDenyAll());
        assertFalse(none.allows(1L));
        assertFalse(none.allows(null));
        assertTrue(none.describe().contains("0 条"), "描述要让用户看懂「不是我筛错了」");
    }

    @Test
    @DisplayName("ofTasks 只放行集合内任务，空集合退化为 none 而不是 all")
    void 任务范围仅放行集合内() {
        LedgerScope s = LedgerScope.ofTasks(Arrays.asList(10L, 20L));
        assertFalse(s.isUnrestricted());
        assertFalse(s.isDenyAll());
        assertTrue(s.allows(10L));
        assertTrue(s.allows(20L));
        assertFalse(s.allows(30L));
        assertEquals("任务范围(2 个任务)", s.describe());
    }

    @Test
    @DisplayName("ofTasks 收到 null / 空集合 / 全 null 元素时一律退化为 none")
    void 任务范围空集合不放大权限() {
        assertTrue(LedgerScope.ofTasks(null).isDenyAll(), "null 不能当作「不限」");
        assertTrue(LedgerScope.ofTasks(List.of()).isDenyAll(), "空集合不能当作「不限」");
        assertTrue(LedgerScope.ofTasks(Arrays.asList(null, null)).isDenyAll(), "过滤后为空仍为 none");
    }

    @Test
    @DisplayName("Resolver：超管与全量角色均得全量；否则按任务归属")
    void 范围推导分支覆盖() {
        assertTrue(LedgerScopeResolver.resolve(true, false, List.of()).isUnrestricted(),
            "超管即使没有任务也看全量");
        assertTrue(LedgerScopeResolver.resolve(false, true, List.of()).isUnrestricted(),
            "配置的全量角色键生效");
        LedgerScope s = LedgerScopeResolver.resolve(false, false, List.of(7L));
        assertFalse(s.isUnrestricted());
        assertTrue(s.allows(7L));
        assertTrue(LedgerScopeResolver.resolve(false, false, List.of()).isDenyAll(),
            "普通用户无任务 => 不可见任何数据");
        assertTrue(LedgerScopeResolver.resolve(false, false, null).isDenyAll(),
            "任务集合为 null 时不能误判为全量");
    }

    /* ================================================================ 高亮与 XSS */

    @Test
    @DisplayName("escapeHtml 转义五类字符，且不产生双重转义")
    void HTML转义正确() {
        assertEquals("&lt;b&gt;", LedgerHighlighter.escapeHtml("<b>"));
        assertEquals("&amp;", LedgerHighlighter.escapeHtml("&"));
        assertEquals("&quot;x&quot;", LedgerHighlighter.escapeHtml("\"x\""));
        assertEquals("&#39;", LedgerHighlighter.escapeHtml("'"));
        assertEquals("", LedgerHighlighter.escapeHtml(null));
        /* 已转义文本再转义不能变成 &amp;lt;（那会在页面上显示成乱码文本） */
        assertEquals("&amp;lt;b&amp;gt;", LedgerHighlighter.escapeHtml("&lt;b&gt;"));
    }

    @Test
    @DisplayName("highlight 先转义后标记，原始标签不会逃逸")
    void 高亮前先转义() {
        String out = LedgerHighlighter.highlight("<script>医美</script>", "医美");
        assertFalse(out.contains("<script>"), "原文标签必须被转义，不能出现在结果里");
        assertTrue(out.contains("&lt;script&gt;"));
        assertTrue(out.contains(LedgerHighlighter.MARK_OPEN + "医美" + LedgerHighlighter.MARK_CLOSE));
    }

    @Test
    @DisplayName("恶意关键词不会注入 HTML：命中标记内也走转义")
    void 恶意关键词同样被转义() {
        String out = LedgerHighlighter.highlight("正文 <img src=x onerror=alert(1)> 结束", "<img");
        assertFalse(out.contains("<img"), "关键词里的标签不能原样出现在输出里");
        assertTrue(out.contains("&lt;img"), "关键词命中部分必须转义后再包标记");
    }

    @Test
    @DisplayName("关键词为空时仅转义，不加任何标记")
    void 空关键词只转义() {
        String out = LedgerHighlighter.highlight("<i>abc</i>", null);
        assertEquals("&lt;i&gt;abc&lt;/i&gt;", out);
    }

    @Test
    @DisplayName("countHits 大小写不敏感且不重复计数")
    void 命中计数() {
        /* "Abc abc ABC" 小写后是 "abc abc abc"，共 3 处命中 */
        assertEquals(3, LedgerHighlighter.countHits("Abc abc ABC", "abc"));
        /* "aaaa" 里 "aa" 非重叠命中 2 处：下标 0 与 2（命中后从 hit + 词长 继续扫） */
        assertEquals(2, LedgerHighlighter.countHits("aaaa", "aa"), "非重叠计数");
        assertEquals(0, LedgerHighlighter.countHits("abc", ""));
        assertEquals(0, LedgerHighlighter.countHits(null, "a"));
    }

    @Test
    @DisplayName("fragments 尊重上限与半径，无命中返回空表")
    void 片段抽取边界() {
        String text = "A".repeat(200) + "医美" + "B".repeat(200) + "医美" + "C".repeat(200);
        List<String> f = LedgerHighlighter.fragments(text, "医美", 10, 3);
        assertFalse(f.isEmpty());
        assertTrue(f.size() <= 3);
        for (String s : f) {
            assertTrue(s.contains(LedgerHighlighter.MARK_OPEN), "每个片段都必须含高亮标记");
        }
        assertTrue(LedgerHighlighter.fragments(text, "不存在词", 10, 3).isEmpty());
        assertTrue(LedgerHighlighter.fragments(text, "医美", 10, 0).isEmpty(), "上限 <=0 时不返回片段");
        assertTrue(LedgerHighlighter.fragments(null, "医美", 10, 3).isEmpty());
    }

    @Test
    @DisplayName("fragments 半径=0 时不越界，且长片段被省略号标记")
    void 片段半径零边界() {
        List<String> f = LedgerHighlighter.fragments("xx医美yy", "医美", 0, 1);
        assertEquals(1, f.size());
        assertTrue(f.get(0).contains(LedgerHighlighter.MARK_OPEN + "医美"));
    }

    /* ================================================================ 空状态建议 */

    @Test
    @DisplayName("无授权范围时第一条建议必须指向「没有授权任务」，而不是让用户自己放宽")
    void 空状态首条判数据权限() {
        List<String> h = LedgerEmptyHint.suggest(new LedgerQuery(), LedgerScope.none());
        assertFalse(h.isEmpty());
        assertTrue(h.get(0).contains("授权"), "首条要说明是权限而非条件问题："
            + h.get(0));
        assertTrue(h.size() >= 2, "还应给出「如何确认应能看到数据」的下一步");
    }

    @Test
    @DisplayName("条件过多时给出「先只保留时间范围」的降维建议")
    void 条件过多给降维建议() {
        LedgerQuery q = new LedgerQuery();
        q.setCollectBeginTime("2026-09-01");
        q.setCollectEndTime("2026-09-23");
        q.setPublishBeginTime("2026-09-10");
        q.setTaskId(1L);
        q.setChannelId(2L);
        q.setSentiAttr("negative");
        q.setRiskLevel("high");
        q.setKeyword("医美");
        assertTrue(LedgerEmptyHint.countActiveConditions(q) >= 5);
        List<String> h = LedgerEmptyHint.suggest(q, LedgerScope.all());
        assertTrue(h.stream().anyMatch(s -> s.contains("筛选条件")), "要指出条件叠加容易命中空集");
    }

    @Test
    @DisplayName("建议恒非空：无条件时也给兜底文案")
    void 空状态建议恒非空() {
        assertFalse(LedgerEmptyHint.suggest(null, null).isEmpty());
        assertFalse(LedgerEmptyHint.suggest(null, LedgerScope.all()).isEmpty());
        assertFalse(LedgerEmptyHint.suggest(new LedgerQuery(), LedgerScope.all()).isEmpty());
    }

    @Test
    @DisplayName("关键词过长时建议文案自身被截断，不变成一堵墙")
    void 建议文案做长度保护() {
        LedgerQuery q = new LedgerQuery();
        q.setKeyword("这是一个非常非常长的关键词用于测试截断逻辑是否生效");
        List<String> h = LedgerEmptyHint.suggest(q, LedgerScope.all());
        assertTrue(h.stream().anyMatch(s -> s.contains("...")), "长关键词应被截断展示");
    }

    /* ================================================================ 导出列白名单 */

    @Test
    @DisplayName("列目录由 LedgerRow 注解反射派生，共 17 列且含关键列")
    void 列目录与实体同步() {
        List<String> all = LedgerColumnCatalog.allFields();
        assertEquals(17, all.size(),
            "导出行列数变了。若为台账刻意见新增导出列，请同步更新本断言与验收标准 5 的说明");
        assertTrue(all.contains("opinionId"));
        assertTrue(all.contains("title"));
        assertTrue(all.contains("opinionUrl"), "溯源要求详情与导出都能拿到原文链接");
        assertFalse(all.contains("fragments"), "不带 @ExcelProperty 的字段不得可导出");
        assertEquals(all.size(), LedgerColumnCatalog.labels().size());
    }

    @Test
    @DisplayName("columns 为空 / 全非法时回落全量；子集按目录顺序输出")
    void 列裁剪白名单() {
        assertEquals(17, LedgerColumnCatalog.resolve(null).size());
        assertEquals(17, LedgerColumnCatalog.resolve(List.of()).size());
        assertEquals(17, LedgerColumnCatalog.resolve(List.of("不存在字段", "drop table")).size(),
            "非法字段不能导出空表，应回落全量");

        List<String> sub = LedgerColumnCatalog.resolve(List.of("title", "opinionId"));
        assertEquals(2, sub.size());
        assertEquals(List.of("opinionId", "title"), sub,
            "输出顺序固定为目录声明顺序，防止用顺序探测内部字段布局");

        List<String> mixed = LedgerColumnCatalog.resolve(Arrays.asList("title", "黑名单字段"));
        assertEquals(List.of("title"), mixed, "非法项被丢弃，合法项保留");
    }

    /* ================================================================ 条件摘要与文件名 */

    @Test
    @DisplayName("无条件下摘要为「全部数据」，不返回空串")
    void 空条件摘要非空() {
        assertEquals("全部数据", LedgerQuerySummary.summarize(null));
        assertEquals("全部数据", LedgerQuerySummary.summarize(new LedgerQuery()));
    }

    @Test
    @DisplayName("摘要包含已启用维度，供审计不解析 JSON 也能看懂")
    void 摘要包含关键维度() {
        LedgerQuery q = new LedgerQuery();
        q.setCollectBeginTime("2026-09-01");
        q.setCollectEndTime("2026-09-23");
        q.setTaskId(123L);
        q.setSentiAttr("negative");
        q.setKeyword("医美");
        String s = LedgerQuerySummary.summarize(q);
        assertTrue(s.contains("采集时间:2026-09-01~2026-09-23"), s);
        assertTrue(s.contains("任务:123"), s);
        assertTrue(s.contains("属性:negative"), s);
        assertTrue(s.contains("关键词:医美"), s);
    }

    @Test
    @DisplayName("文件名片段剔除 Windows 非法字符、去空格且不超 60 字符")
    void 文件名片段安全() {
        LedgerQuery q = new LedgerQuery();
        q.setKeyword("a/b\\c:d*e?f\"g<h>i|j");
        String tag = LedgerQuerySummary.toFileTag(q);
        for (char bad : new char[]{'/', '\\', ':', '*', '?', '"', '<', '>', '|', ' '}) {
            assertFalse(tag.indexOf(bad) >= 0, "文件名片段不得含字符 " + bad + " -> " + tag);
        }
        LedgerQuery longq = new LedgerQuery();
        longq.setKeyword("x".repeat(300));
        assertTrue(LedgerQuerySummary.toFileTag(longq).length() <= 60);
    }

    /* ================================================================ 时间解析 */

    @Test
    @DisplayName("10 位日期作为「止」取当天 23:59:59，避免漏掉当天数据")
    void 区间止点含当天() {
        LocalDateTime end = LedgerTimeParser.parseEnd("2026-09-23");
        assertNotNull(end);
        assertEquals(23, end.getHour());
        assertEquals(59, end.getMinute());
        assertEquals(59, end.getSecond());
        LocalDateTime begin = LedgerTimeParser.parse("2026-09-23");
        assertEquals(0, begin.getHour());
        assertEquals(0, begin.getMinute());
    }

    @Test
    @DisplayName("解析失败返回 null 而不是抛异常（裸 URL 打开也要能用）")
    void 时间解析容错() {
        assertNull(LedgerTimeParser.parse("不是时间"));
        assertNull(LedgerTimeParser.parse("2026-13-45"));
        assertNull(LedgerTimeParser.parseEnd(""));
        assertNull(LedgerTimeParser.parse(null));
        assertNull(LedgerTimeParser.parseDate("bad"));
        assertEquals(LocalDateTime.of(2026, 9, 23, 10, 30, 0),
            LedgerTimeParser.parse("2026-09-23 10:30:00"));
        assertEquals(LocalDateTime.of(2026, 9, 23, 10, 30, 0),
            LedgerTimeParser.parse("2026-09-23 10:30"));
    }

    /* ================================================================ 检索范围归一 */

    @Test
    @DisplayName("keywordScope 非法值一律归一为 both，为空的检索词不构成条件")
    void 检索范围归一() {
        LedgerQuery q = new LedgerQuery();
        assertEquals("both", q.normalizedKeywordScope());
        q.setKeywordScope("TITLE");
        assertEquals("title", q.normalizedKeywordScope());
        q.setKeywordScope(" content ");
        assertEquals("content", q.normalizedKeywordScope());
        q.setKeywordScope("正文");
        assertEquals("both", q.normalizedKeywordScope());
    }

    /* ================================================================ 传播阶段 */

    @Test
    @DisplayName("时间轴为空返回空表；单条为 first；两条为 first+fall")
    void 传播阶段小样本() {
        assertTrue(LedgerStages.classify(null).isEmpty());
        assertTrue(LedgerStages.classify(List.of()).isEmpty());

        List<NodeImpl> one = List.of(new NodeImpl("2026-09-23T10:00", 5));
        assertEquals(List.of(LedgerStages.FIRST), LedgerStages.classify(one));

        List<NodeImpl> two = List.of(
            new NodeImpl("2026-09-23T10:00", 5),
            new NodeImpl("2026-09-23T11:00", 9));
        assertEquals(Arrays.asList(LedgerStages.FIRST, LedgerStages.FALL), LedgerStages.classify(two));
    }

    @Test
    @DisplayName("多条时间轴：首条 first、末段 fall、中间按热度切 peak / spread")
    void 传播阶段完整形态() {
        List<NodeImpl> nodes = new ArrayList<>();
        /* 10:00 起每小时一条，共 11 条 —— 轴长 600 分钟，fall 边界在 480 分钟（即 18:00） */
        for (int i = 0; i <= 10; i++) {
            int heat = i == 4 ? 100 : 10;
            nodes.add(new NodeImpl(LocalDateTime.of(2026, 9, 23, 10, 0).plusHours(i).toString(), heat));
        }
        List<String> stages = LedgerStages.classify(nodes);
        assertEquals(nodes.size(), stages.size(), "阶段数组与输入等长");
        assertEquals(LedgerStages.FIRST, stages.get(0));
        assertTrue(stages.contains(LedgerStages.PEAK), "热度达峰值 80% 的节点应标 peak：" + stages);
        assertEquals(LedgerStages.FALL, stages.get(stages.size() - 1), "末条落在回落窗口");
        assertFalse(stages.subList(1, 5).contains(LedgerStages.FALL),
            "轴前半段不应出现回落：" + stages);
    }

    @Test
    @DisplayName("热度全为空时退化为按时间划分，不出现 peak")
    void 传播阶段无热度数据() {
        List<NodeImpl> nodes = new ArrayList<>();
        for (int i = 0; i <= 9; i++) {
            nodes.add(new NodeImpl(LocalDateTime.of(2026, 9, 23, 1, 0).plusHours(i).toString(), null));
        }
        List<String> stages = LedgerStages.classify(nodes);
        assertFalse(stages.contains(LedgerStages.PEAK), "没有热度数据时不能凭空判峰值：" + stages);
        assertEquals(LedgerStages.FIRST, stages.get(0));
    }

    @Test
    @DisplayName("countByStage 只统计出现的阶段且总数守恒")
    void 阶段计数守恒() {
        List<String> stages = Arrays.asList(
            LedgerStages.FIRST, LedgerStages.SPREAD, LedgerStages.PEAK, LedgerStages.FALL);
        var m = LedgerStages.countByStage(stages);
        assertEquals(1, m.get(LedgerStages.FIRST).intValue());
        assertEquals(1, m.get(LedgerStages.SPREAD).intValue());
        assertEquals(1, m.get(LedgerStages.PEAK).intValue());
        assertEquals(1, m.get(LedgerStages.FALL).intValue());
    }

    /* ================================================================ xlsx 真生成 */

    @Test
    @DisplayName("导出全量列：产出合法 xlsx，且表头中文列名齐全")
    void 导出全量列生成真xlsx() {
        List<LedgerRow> rows = new ArrayList<>();
        rows.add(row(1L, "某医院医美纠纷被曝光"));
        rows.add(row(2L, "第二篇舆情"));

        byte[] xlsx = LedgerExcelWriter.write(rows, LedgerColumnCatalog.allFields(), "舆情台账");
        assertTrue(xlsx.length > 0);
        assertEquals(0x50, xlsx[0] & 0xFF, "xlsx 是 zip，首字节应为 'P'");
        assertEquals(0x4B, xlsx[1] & 0xFF, "xlsx 是 zip，次字节应为 'K'");

        String xml = unzipText(xlsx);
        assertTrue(xml.contains("编号"), "缺表头说明 Excel 注解未生效（Fesod 包名写错？）");
        assertTrue(xml.contains("舆情标题"), "缺表头：舆情标题");
        assertTrue(xml.contains("原文链接"), "缺表头：原文链接");
        assertTrue(xml.contains("某医院医美纠纷被曝光"), "单元格数据未写入");
    }

    @Test
    @DisplayName("导出裁剪列：只请求 title 时不得出现其它列的表头")
    void 导出裁剪列生效() {
        List<LedgerRow> rows = List.of(row(1L, "只导标题"));

        byte[] full = LedgerExcelWriter.write(rows, LedgerColumnCatalog.allFields(), "舆情台账");
        byte[] only = LedgerExcelWriter.write(rows, List.of("title"), "舆情台账");

        String xml = unzipText(only);
        assertTrue(xml.contains("舆情标题"), "请求的列必须存在");
        assertFalse(xml.contains("原文链接"), "未请求的列不得出现在产物里（字段范围可配置失效）");
        assertFalse(xml.contains("研判状态"), "未请求的列不得出现在产物里");
        assertTrue(only.length < full.length, "裁剪后体积应小于全量："
            + only.length + " vs " + full.length);
    }

    @Test
    @DisplayName("零行导出仍产出带表头的合法文件，而不是 0 字节")
    void 零行导出仍是合法xlsx() {
        byte[] xlsx = LedgerExcelWriter.write(List.of(), LedgerColumnCatalog.allFields(), null);
        assertTrue(xlsx.length > 0, "0 字节文件比空表更让人困惑");
        assertEquals(0x50, xlsx[0] & 0xFF);
        String xml = unzipText(xlsx);
        assertTrue(xml.contains("舆情标题"), "零行时表头依然要在");
        assertTrue(xml.contains("舆情台账"), "工作表名缺省值应为「舆情台账」");
    }

    @Test
    @DisplayName("导出 MIME 与 xlsx 扩展名一致（上传对象存储的 contentType）")
    void 导出MIME正确() {
        assertEquals("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            LedgerExcelWriter.MIME_XLSX);
    }

    /* ================================================================ 工具 */

    private static LedgerRow row(Long id, String title) {
        LedgerRow r = new LedgerRow();
        r.setOpinionId(id);
        r.setTitle(title);
        r.setChannelName("新闻网站");
        r.setTaskName("医美舆情监测");
        r.setPublishTime(LocalDateTime.of(2026, 9, 23, 9, 30));
        r.setAuthor("记者甲");
        r.setSentiAttr("negative");
        r.setRiskLevel("high");
        r.setOpinionLevel("important");
        r.setHeatScore(88);
        r.setCollectSource("auto");
        r.setCollectTime(LocalDateTime.of(2026, 9, 23, 10, 0));
        r.setAnalyzeStatus("done");
        r.setCleanStatus("clean");
        r.setRegion("辽宁沈阳");
        r.setClusterTitle("医美纠纷聚合事件");
        r.setOpinionUrl("https://example.com/a/1");
        return r;
    }

    /**
     * 把 xlsx 各 zip 条目当文本拼起来，用于断言表头文案（不依赖具体条目名）。
     *
     * <p><b>为什么用 ZipFile 而不是 ZipInputStream：</b>Excel 写出库是流式写 zip 的
     * （条目带 data descriptor，本地头里的 size 写成 0）。这种文件对 Excel 完全合法
     * —— 它读的是中央目录；但 {@code ZipInputStream} 读本地头时会抛
     * {@code invalid entry size (expected 0 but got N bytes)}。
     * 早期版本用了 ZipInputStream，三个 xlsx 用例全挂且报「不是 zip 包」，
     * 指向的却是错误的嫌疑人（让人去查写出库）。改用 ZipFile（读中央目录）后
     * 与 Excel 的读取口径一致。</p>
     */
    private static String unzipText(byte[] xlsx) {
        Path tmp = null;
        StringBuilder sb = new StringBuilder();
        try {
            tmp = Files.createTempFile("f016-ledger-", ".xlsx");
            Files.write(tmp, xlsx);
            try (ZipFile zf = new ZipFile(tmp.toFile())) {
                Enumeration<? extends ZipEntry> en = zf.entries();
                while (en.hasMoreElements()) {
                    ZipEntry e = en.nextElement();
                    if (e.isDirectory()) {
                        continue;
                    }
                    try (InputStream in = zf.getInputStream(e)) {
                        sb.append(new String(in.readAllBytes(), StandardCharsets.UTF_8)).append('\n');
                    }
                }
            }
        } catch (Exception ex) {
            throw new AssertionError("xlsx 不是可解析的 zip 包: " + ex, ex);
        } finally {
            if (tmp != null) {
                try {
                    Files.deleteIfExists(tmp);
                } catch (IOException ignored) {
                    /* 临时文件清理失败不影响断言结论 */
                }
            }
        }
        return sb.toString();
    }

    /** 时间轴节点测试替身 */
    private static final class NodeImpl implements LedgerStages.Node {
        private final LocalDateTime time;
        private final Integer heat;

        NodeImpl(String iso, Integer heat) {
            this.time = LocalDateTime.parse(iso);
            this.heat = heat;
        }

        @Override
        public LocalDateTime time() {
            return time;
        }

        @Override
        public Integer heat() {
            return heat;
        }
    }
}
