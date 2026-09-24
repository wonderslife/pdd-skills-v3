/**
 * F-009 多维分析 · 第 7 片：离线自测
 *
 * ⚠ 本片产出的测试类必须是 {@code public class} —— 它落在
 *   {@code org.dromara.yuqing.analytics} 包，而反射执行器
 *   {@code org.dromara.yuqing.collect.OfflineCollectTestRunner} 在另一个包，
 *   包级私有类会被反射挡在门外（IllegalAccessException）。
 *   F010AlertPushTest 同理，F006CleanTest 因与执行器同包才可以是包级私有。
 */
export const ANALYTICS_TPL7 = [

  {
    rel: 'test/java/org/dromara/yuqing/analytics/F009AnalyticsTest.java',
    content: `package org.dromara.yuqing.analytics;

import org.dromara.yuqing.analytics.config.YqAnalyticsProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * F-009 多维分析 离线自测。
 *
 * <p>分析引擎刻意做成「纯函数 + 无 Spring 容器依赖」，JDBC 访问全部收在
 * {@code analytics.jdbc} 包下并藏在接口后面，因此这里可以在没有 Doris、
 * 没有 MySQL 的环境里把手搓样本喂进聚合器，验证分桶、排序、归一、占比、
 * 结论提炼与下钻条件构造。</p>
 *
 * <p><b>测什么、不测什么：</b>本类只测确定性算法。凡是依赖数据库返回值的
 * （预聚合读写、批次台账）不在覆盖范围 —— 用假数据测它只会得到
 * 「我以为 SQL 是这么写的」这种零信息量的绿灯，那是集成测试的活。</p>
 *
 * <p><b>为什么用 eq() 而不是直接 assertEquals：</b>引擎大量返回包装类型
 * （{@code Integer} / {@code Double} / {@code Long}），直接写
 * {@code assertEquals(50D, someDouble)} 会落进 JUnit 的重载歧义区；
 * 三个同型重载 {@link #eq(int, Integer)} 把类型一次钉死，读起来也更短。</p>
 *
 * @author ruoyi
 */
@Tag("dev")
public class F009AnalyticsTest {

    /* ============================================================ 断言小工具 */

    private static void eq(int expected, Integer actual) {
        assertNotNull(actual, "期望非空整型");
        assertEquals(expected, actual.intValue());
    }

    private static void eq(long expected, Long actual) {
        assertNotNull(actual, "期望非空长整型");
        assertEquals(expected, actual.longValue());
    }

    private static void eq(double expected, Double actual) {
        assertNotNull(actual, "期望非空浮点");
        assertEquals(expected, actual.doubleValue(), 0.0001D);
    }

    /* ============================================================ 构造工具 */

    private static YqAnalyticsProperties props() {
        return new YqAnalyticsProperties();
    }

    private static OpinionSlice.OpinionSliceBuilder base(Long id, LocalDate date, LocalDateTime t) {
        return OpinionSlice.builder()
            .opinionId(id)
            .collectDate(date)
            .taskId(1L)
            .channelId(0L)
            .channelName("微博")
            .title("标题" + id)
            .opinionUrl("https://example.com/" + id)
            .publishTime(t)
            .collectTime(t)
            .readCount(0L)
            .commentCount(0L)
            .shareCount(0L)
            .likeCount(0L)
            .heatScore(0)
            .clusterId(0L);
    }

    private static AggregateScope scope(LocalDate from, LocalDate to) {
        AggregateScope s = new AggregateScope();
        s.setDateFrom(from);
        s.setDateTo(to);
        return s;
    }

    private static DimRow trendRow(String grain, String key, int count) {
        DimRow d = new DimRow();
        d.setStatsDate(LocalDate.of(2026, 9, 5));
        d.setDimType(DimType.TREND.getCode());
        d.setTimeGrain(grain);
        d.setDimKey(key);
        d.setDimLabel(key);
        d.setTaskId(1L);
        d.setChannelId(0L);
        d.setOpinionCount(count);
        d.setPositiveCount(0);
        d.setNeutralCount(0);
        d.setNegativeCount(0);
        d.setHighRiskCount(0);
        d.setReadSum(0L);
        d.setCommentSum(0L);
        d.setShareSum(0L);
        d.setLikeSum(0L);
        d.setHeatSum(0L);
        d.derive();
        return d;
    }

    private static DimRow dimRow(String type, String key, String label, int count, int negative) {
        DimRow d = new DimRow();
        d.setStatsDate(LocalDate.of(2026, 9, 5));
        d.setDimType(type);
        d.setDimKey(key);
        d.setDimLabel(label);
        d.setTimeGrain(StatsGrain.DAY.getCode());
        d.setTaskId(1L);
        d.setChannelId(0L);
        d.setOpinionCount(count);
        d.setPositiveCount(0);
        d.setNeutralCount(count - negative);
        d.setNegativeCount(negative);
        d.setHighRiskCount(0);
        d.setReadSum(0L);
        d.setCommentSum(0L);
        d.setShareSum(0L);
        d.setLikeSum(0L);
        d.setHeatSum(0L);
        d.derive();
        return d;
    }

    private static DailyRow daily(LocalDate d, int total, int pos, int neu, int neg) {
        DailyRow r = new DailyRow();
        r.setStatsDate(d);
        r.setTaskId(1L);
        r.setChannelId(1L);
        r.setTotalCount(total);
        r.setPositiveCount(pos);
        r.setNeutralCount(neu);
        r.setNegativeCount(neg);
        r.setDupCount(0);
        r.setRejectedCount(0);
        r.setAlertCount(0);
        r.setPushCount(0);
        r.setReportCount(0);
        r.setReadSum(0L);
        r.setCommentSum(0L);
        r.setShareSum(0L);
        r.setLikeSum(0L);
        r.derive();
        return r;
    }

    private static HotRow hotRow(long id, int rankNo, String title, int heat, long read) {
        HotRow r = new HotRow();
        r.setStatsDate(LocalDate.of(2026, 9, 5));
        r.setRankBy(RankBy.HEAT.getCode());
        r.setRankNo(rankNo);
        r.setOpinionId(id);
        r.setTitle(title);
        r.setHeatScore(heat);
        r.setReadCount(read);
        r.setCommentCount(0L);
        r.setShareCount(0L);
        r.setLikeCount(0L);
        return r;
    }

    /* ========================================================== 地域归一化 */

    @Test
    @DisplayName("地域别名：全称 / 简称 / 车牌首字 / 自治区缩写都收敛到省级全称")
    void regionAliases() {
        assertEquals("北京市", RegionNormalizer.normalize("北京市"));
        assertEquals("北京市", RegionNormalizer.normalize("北京"));
        assertEquals("北京市", RegionNormalizer.normalize("京"));
        assertEquals("上海市", RegionNormalizer.normalize("沪"));
        assertEquals("内蒙古自治区", RegionNormalizer.normalize("内蒙古"));
        assertEquals("广西壮族自治区", RegionNormalizer.normalize("广西"));
        assertEquals("新疆维吾尔自治区", RegionNormalizer.normalize("新疆维吾尔自治区"));
        assertEquals("香港特别行政区", RegionNormalizer.normalize("香港"));
        assertEquals("澳门特别行政区", RegionNormalizer.normalize("澳"));
        assertEquals("台湾省", RegionNormalizer.normalize("台湾省"));
    }

    @Test
    @DisplayName("地域兜底：空值给「未知」、境外给「海外」、认不出给「其他」，三桶刻意不合并")
    void regionFallbackBuckets() {
        assertEquals(RegionNormalizer.UNKNOWN, RegionNormalizer.normalize(null));
        assertEquals(RegionNormalizer.UNKNOWN, RegionNormalizer.normalize("   "));
        assertEquals(RegionNormalizer.UNKNOWN, RegionNormalizer.normalize("\\u3000"));
        assertEquals(RegionNormalizer.OVERSEAS, RegionNormalizer.normalize("美国"));
        assertEquals(RegionNormalizer.OVERSEAS, RegionNormalizer.normalize("境外"));
        assertEquals(RegionNormalizer.OTHER, RegionNormalizer.normalize("火星省"));
        assertFalse(RegionNormalizer.UNKNOWN.equals(RegionNormalizer.OTHER));
        assertFalse(RegionNormalizer.UNKNOWN.equals(RegionNormalizer.OVERSEAS));
        assertFalse(RegionNormalizer.OVERSEAS.equals(RegionNormalizer.OTHER));
    }

    @Test
    @DisplayName("地域归一：带下级行政区与空白干扰的文本按前缀最长匹配")
    void regionSubLevelAndWhitespace() {
        assertEquals("北京市", RegionNormalizer.normalize("北京市海淀区"));
        assertEquals("广东省", RegionNormalizer.normalize("广东省深圳市南山区"));
        assertEquals("上海市", RegionNormalizer.normalize(" 上海市 浦东新区 "));
        assertEquals("内蒙古自治区", RegionNormalizer.normalize("内蒙古自治区呼和浩特市"));
    }

    @Test
    @DisplayName("地域核心词：给 SQL 用的是去后缀词，三个兜底桶不参与匹配")
    void regionMatchToken() {
        assertEquals("北京", RegionNormalizer.matchToken("北京市"));
        assertEquals("内蒙古", RegionNormalizer.matchToken("内蒙古自治区"));
        assertEquals("广东", RegionNormalizer.matchToken("广东省"));
        assertEquals("", RegionNormalizer.matchToken(RegionNormalizer.UNKNOWN));
        assertEquals("", RegionNormalizer.matchToken(RegionNormalizer.OVERSEAS));
        assertEquals("", RegionNormalizer.matchToken(RegionNormalizer.OTHER));
        assertEquals("", RegionNormalizer.matchToken(null));
    }

    @Test
    @DisplayName("地域清单：34 个省级行政区（含港澳台），只认全称")
    void regionProvinceList() {
        assertEquals(34, RegionNormalizer.provinces().size());
        assertTrue(RegionNormalizer.isProvince("台湾省"));
        assertTrue(RegionNormalizer.isProvince("香港特别行政区"));
        assertFalse(RegionNormalizer.isProvince("北京"));
        assertFalse(RegionNormalizer.isProvince(RegionNormalizer.OTHER));
    }

    /* ============================================================ 话题拆解 */

    @Test
    @DisplayName("话题拆解：中英逗号 / 分号 / 井号 / 空白 / 斜杠混合，去重保序")
    void topicSplitMixedSeparators() {
        List<String> out = TopicSplitter.split("食品安全,校园霸凌，食品安全;#标签#  空白 斜杠/分隔");
        assertEquals(Arrays.asList("食品安全", "校园霸凌", "标签", "空白", "斜杠", "分隔"), out);
    }

    @Test
    @DisplayName("话题拆解：单条最多取 8 个，防止一条灌水数据刷出上百维度行")
    void topicSplitCapAndBlank() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 12; i++) {
            sb.append("话题").append(i).append(',');
        }
        assertEquals(8, TopicSplitter.split(sb.toString()).size());
        assertTrue(TopicSplitter.split(null).isEmpty());
        assertTrue(TopicSplitter.split("  ").isEmpty());
        assertTrue(TopicSplitter.split(",,,，；;;").isEmpty());
    }

    @Test
    @DisplayName("话题拆解：超长标签截断到 80 字符，保护 dim_key 列宽")
    void topicSplitTruncate() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 120; i++) {
            sb.append("话");
        }
        String topic = sb.toString();
        assertEquals(120, topic.length());
        List<String> out = TopicSplitter.split(topic);
        assertEquals(1, out.size());
        assertEquals(TopicSplitter.MAX_TOPIC_CHARS, out.get(0).length());
    }

    @Test
    @DisplayName("话题可用性：纯数字 / 纯符号 / 单字不入维度表，正常短语放行")
    void topicMeaningful() {
        assertFalse(TopicSplitter.meaningful("12345"));
        assertFalse(TopicSplitter.meaningful("a"));
        assertFalse(TopicSplitter.meaningful("#"));
        assertFalse(TopicSplitter.meaningful("  "));
        assertFalse(TopicSplitter.meaningful(null));
        assertTrue(TopicSplitter.meaningful("食品安全"));
        assertTrue(TopicSplitter.meaningful("垃圾分类2024"));
    }

    /* ============================================================ 热度打分 */

    @Test
    @DisplayName("热度打分：阅读1 / 评论3 / 转发5 / 点赞1 / 内容热度10，整数运算可复现")
    void heatScoreWeights() {
        OpinionSlice s = base(1L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 10, 0))
            .readCount(100L).commentCount(10L).shareCount(5L).likeCount(20L).heatScore(3).build();
        // 100*1 + 10*3 + 5*5 + 20*1 + 3*10 = 100 + 30 + 25 + 20 + 30
        assertEquals(205L, HeatScorer.score(s));
        assertEquals(135L, HeatScorer.interaction(s));
        assertEquals(HeatScorer.score(s), HeatScorer.score(s));
    }

    @Test
    @DisplayName("热度打分：负数互动量按 0 计，绝不出现负热度")
    void heatScoreClampsNegative() {
        OpinionSlice s = base(1L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 10, 0))
            .readCount(-100L).commentCount(-1L).shareCount(-1L).likeCount(-1L).heatScore(-5).build();
        assertEquals(0L, HeatScorer.score(s));
        assertEquals(0L, HeatScorer.interaction(s));
        assertEquals(0L, HeatScorer.score(null));
    }

    /* ============================================================ 时间分桶 */

    @Test
    @DisplayName("时间桶标识与展示名：ISO 格式可字典序排序，小时桶精确到点")
    void bucketKeyAndLabel() {
        LocalDateTime t = LocalDateTime.of(2026, 9, 5, 14, 30, 45);
        assertEquals("2026-09-05", StatsAggregator.bucketKey(t, StatsGrain.DAY));
        assertEquals("09-05", StatsAggregator.bucketLabel(t, StatsGrain.DAY));
        assertEquals("2026-09-05 14:00", StatsAggregator.bucketKey(t, StatsGrain.HOUR));
        assertEquals("09-05 14:00", StatsAggregator.bucketLabel(t, StatsGrain.HOUR));
        int wk = t.get(WeekFields.ISO.weekOfWeekBasedYear());
        assertEquals("2026-W" + (wk < 10 ? "0" : "") + wk, StatsAggregator.bucketKey(t, StatsGrain.WEEK));
        assertTrue(StatsAggregator.bucketLabel(t, StatsGrain.WEEK).endsWith(" 起"));
        assertEquals("", StatsAggregator.bucketKey(null, StatsGrain.DAY));
    }

    /* ============================================================ 聚合核心 */

    @Test
    @DisplayName("日聚合：按 (统计日, 任务, 渠道) 分组，未标注属性归中性，负面占比同步派生")
    void aggregateDailyGrouping() {
        List<OpinionSlice> list = new ArrayList<>();
        list.add(base(1L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 10, 0))
            .channelId(1L).sentiAttr("positive").build());
        list.add(base(2L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 11, 0))
            .channelId(1L).sentiAttr("negative").build());
        list.add(base(3L, LocalDate.of(2026, 9, 6), LocalDateTime.of(2026, 9, 6, 9, 0))
            .channelId(1L).sentiAttr(null).build());

        AggregateOutcome out = new StatsAggregator(props())
            .aggregate(list, scope(LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 6)), false);

        eq(3, out.getSourceCount());
        assertEquals(2, out.getDaily().size());
        DailyRow d1 = out.getDaily().get(0);
        assertEquals(LocalDate.of(2026, 9, 5), d1.getStatsDate());
        eq(2, d1.getTotalCount());
        eq(1, d1.getPositiveCount());
        eq(0, d1.getNeutralCount());
        eq(1, d1.getNegativeCount());
        eq(50D, d1.getNegativeRate());
        DailyRow d2 = out.getDaily().get(1);
        eq(1, d2.getTotalCount());
        eq(1, d2.getNeutralCount());
        eq(0D, d2.getNegativeRate());
    }

    @Test
    @DisplayName("维度聚合：七类分布 + 三类趋势一起产出，地域已归一、话题多值各计一次")
    void aggregateDimsCoverage() {
        List<OpinionSlice> list = new ArrayList<>();
        list.add(base(1L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 14, 30))
            .channelId(5L).channelName("微博").region("北京市海淀区")
            .topicTags("食品安全,校园霸凌").sentiAttr("positive").riskLevel("severe")
            .opinionLevel("warning").spreadLevel("high").build());

        AggregateOutcome out = new StatsAggregator(props())
            .aggregate(list, scope(LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 5)), false);

        List<String> types = new ArrayList<>();
        int trend = 0;
        for (DimRow r : out.getDim()) {
            if (DimType.TREND.getCode().equals(r.getDimType())) {
                trend++;
            } else if (!types.contains(r.getDimType())) {
                types.add(r.getDimType());
            }
        }
        assertEquals(7, types.size());
        assertTrue(types.contains(DimType.CHANNEL.getCode()));
        assertTrue(types.contains(DimType.REGION.getCode()));
        assertTrue(types.contains(DimType.TOPIC.getCode()));
        assertTrue(types.contains(DimType.SENTI.getCode()));
        assertTrue(types.contains(DimType.RISK.getCode()));
        assertTrue(types.contains(DimType.LEVEL.getCode()));
        assertTrue(types.contains(DimType.SPREAD.getCode()));
        assertEquals(3, trend);
        // 地域带下级行政区，落库前必须已经归一
        for (DimRow r : out.getDim()) {
            if (DimType.REGION.getCode().equals(r.getDimType())) {
                assertEquals("北京市", r.getDimKey());
            }
        }
    }

    @Test
    @DisplayName("趋势分桶：小时桶只在回算窗口内产出，窗口置 0 时小时行整体消失")
    void aggregateTrendHourWindow() {
        List<OpinionSlice> list = new ArrayList<>();
        list.add(base(1L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 14, 30)).build());
        AggregateScope sc = scope(LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 5));

        YqAnalyticsProperties withHour = props();
        withHour.setHourTrendDays(30);
        List<String> grains = new ArrayList<>();
        for (DimRow r : new StatsAggregator(withHour).aggregate(list, sc, false).getDim()) {
            if (DimType.TREND.getCode().equals(r.getDimType())) {
                grains.add(r.getTimeGrain());
            }
        }
        assertEquals(3, grains.size());
        assertTrue(grains.contains(StatsGrain.HOUR.getCode()));
        assertTrue(grains.contains(StatsGrain.DAY.getCode()));
        assertTrue(grains.contains(StatsGrain.WEEK.getCode()));

        YqAnalyticsProperties noHour = props();
        noHour.setHourTrendDays(0);
        int after = 0;
        for (DimRow r : new StatsAggregator(noHour).aggregate(list, sc, false).getDim()) {
            if (DimType.TREND.getCode().equals(r.getDimType())) {
                after++;
            }
        }
        assertEquals(2, after);
    }

    @Test
    @DisplayName("明细截断：命中读取上限时记提示，且提示按内容去重不重复累加")
    void aggregateTruncationNotice() {
        List<OpinionSlice> list = new ArrayList<>();
        list.add(base(1L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 10, 0)).build());
        AggregateOutcome out = new StatsAggregator(props())
            .aggregate(list, scope(LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 5)), true);
        assertTrue(out.isTruncated());
        assertEquals(1, out.getNotices().size());
        assertNotNull(out.noticeText());
        out.notice(out.getNotices().get(0));
        assertEquals(1, out.getNotices().size());
    }

    @Test
    @DisplayName("热点榜：每天每种口径各产 TopN，名次从 1 连续编号，热度降序")
    void aggregateHotRanking() {
        List<OpinionSlice> list = new ArrayList<>();
        list.add(base(1L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 12, 0)).readCount(10L).build());
        list.add(base(2L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 11, 0)).readCount(100L).build());
        list.add(base(3L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 10, 0)).readCount(1000L).build());

        AggregateOutcome out = new StatsAggregator(props())
            .aggregate(list, scope(LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 5)), false);

        assertEquals(3 * RankBy.values().length, out.getHot().size());
        List<HotRow> heatRows = new ArrayList<>();
        for (HotRow r : out.getHot()) {
            if (RankBy.HEAT.getCode().equals(r.getRankBy())) {
                heatRows.add(r);
            }
        }
        assertEquals(3, heatRows.size());
        eq(1, heatRows.get(0).getRankNo());
        eq(3L, heatRows.get(0).getOpinionId());
        eq(2, heatRows.get(1).getRankNo());
        eq(2L, heatRows.get(1).getOpinionId());
    }

    @Test
    @DisplayName("热点排序稳定：同分先比发布时间倒序、再比舆情ID倒序，保证同日重跑名次不变")
    void rankTopStableTieBreak() {
        List<OpinionSlice> list = new ArrayList<>();
        list.add(base(1L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 10, 0)).readCount(100L).build());
        list.add(base(2L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 12, 0)).readCount(100L).build());
        list.add(base(3L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 12, 0)).readCount(100L).build());

        List<OpinionSlice> ranked = StatsAggregator.rankTop(list, RankBy.READ, 10);
        eq(3L, ranked.get(0).getOpinionId());
        eq(2L, ranked.get(1).getOpinionId());
        eq(1L, ranked.get(2).getOpinionId());
        assertEquals(2, StatsAggregator.rankTop(list, RankBy.READ, 2).size());
        assertSame(RankBy.HEAT, RankBy.of("heat"));
        assertEquals(4, RankBy.values().length);
    }

    /* ============================================================ 结论提炼 */

    @Test
    @DisplayName("结论提炼：空数据只给一句说明，不编造核心事件与风险")
    void conclusionEmpty() {
        AnalysisConclusion c = new ConclusionExtractor(props()).extract(new ArrayList<>(), null);
        assertEquals(1, c.getNarrative().size());
        eq(0L, c.getDurationHours());
        eq(0D, c.getSpeedPerHour());
        assertTrue(c.getCoreEvents().isEmpty());
        assertTrue(c.getRiskPoints().isEmpty());
        assertFalse(c.isClusterBased());
        // 入参为 null 同样走空分支，不抛异常
        AnalysisConclusion nil = new ConclusionExtractor(props()).extract(null, null);
        assertNotNull(nil);
        assertEquals(1, nil.getNarrative().size());
    }

    @Test
    @DisplayName("结论提炼：无事件聚类时按标题归并，并在文字里显式标注口径")
    void conclusionByTitleFallback() {
        List<OpinionSlice> list = new ArrayList<>();
        list.add(base(1L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 9, 0)).title("A事件").build());
        list.add(base(2L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 10, 0)).title("A事件").build());
        list.add(base(3L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 11, 0)).title("B事件").build());

        AnalysisConclusion c = new ConclusionExtractor(props()).extract(list, null);
        assertFalse(c.isClusterBased());
        assertEquals(2, c.getCoreEvents().size());
        assertEquals("A事件", c.getCoreEvents().get(0).getTitle());
        eq(2, c.getCoreEvents().get(0).getOpinionCount());
        eq(0L, c.getCoreEvents().get(0).getClusterId());
        boolean tagged = false;
        for (String line : c.getNarrative()) {
            if (line.contains("核心事件") && line.contains("按标题口径")) {
                tagged = true;
            }
        }
        assertTrue(tagged);
    }

    @Test
    @DisplayName("结论提炼：存在事件聚类时改按 cluster_id 归并，标注切换为聚类口径")
    void conclusionByCluster() {
        List<OpinionSlice> list = new ArrayList<>();
        list.add(base(1L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 9, 0)).clusterId(7L).build());
        list.add(base(2L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 10, 0)).clusterId(7L).build());
        list.add(base(3L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 11, 0)).build());

        AnalysisConclusion c = new ConclusionExtractor(props()).extract(list, null);
        assertTrue(c.isClusterBased());
        assertEquals(2, c.getCoreEvents().size());
        eq(7L, c.getCoreEvents().get(0).getClusterId());
        eq(2, c.getCoreEvents().get(0).getOpinionCount());
        eq(0L, c.getCoreEvents().get(1).getClusterId());
    }

    @Test
    @DisplayName("传播路径：按首发时间排序列号，间隔相对上一站首发时间累进")
    void conclusionPropagationGap() {
        List<OpinionSlice> list = new ArrayList<>();
        list.add(base(1L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 10, 0)).channelName("新闻网站").build());
        list.add(base(2L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 11, 0)).channelName("微信").build());
        list.add(base(3L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 13, 0)).channelName("微博").build());

        List<PropagationStage> stages = new ConclusionExtractor(props()).extract(list, null).getPropagation();
        assertEquals(3, stages.size());
        eq(1, stages.get(0).getSeq());
        assertEquals("新闻网站", stages.get(0).getChannelName());
        eq(0L, stages.get(0).getGapMinutes());
        eq(2, stages.get(1).getSeq());
        eq(60L, stages.get(1).getGapMinutes());
        eq(3, stages.get(2).getSeq());
        eq(120L, stages.get(2).getGapMinutes());
    }

    @Test
    @DisplayName("潜在风险：负面占比达阈值触发一条，未翻倍则为中等级")
    void conclusionRiskNegativeRate() {
        List<OpinionSlice> half = new ArrayList<>();
        half.add(base(1L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 10, 0)).sentiAttr("negative").build());
        half.add(base(2L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 10, 0)).sentiAttr("positive").build());
        ConclusionExtractor extractor = new ConclusionExtractor(props());
        AnalysisConclusion c = extractor.extract(half, null);
        assertEquals(1, c.getRiskPoints().size());
        assertEquals("负面占比偏高", c.getRiskPoints().get(0).getType());
        assertEquals("medium", c.getRiskPoints().get(0).getLevel());
        eq(50D, c.getRiskPoints().get(0).getValue());
        /* 阈值口径挂在提取器（配置）上，不在结论对象上 —— 断言配置真的被读到 */
        assertEquals(30D, extractor.negativeRateThreshold());
    }

    @Test
    @DisplayName("潜在风险：负面占比低于阈值时不产生噪声风险项")
    void conclusionRiskBelowThreshold() {
        List<OpinionSlice> list = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            list.add(base((long) i, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 10, 0))
                .sentiAttr(i == 0 ? "negative" : "positive").build());
        }
        AnalysisConclusion c = new ConclusionExtractor(props()).extract(list, null);
        for (RiskPoint r : c.getRiskPoints()) {
            assertFalse("负面占比偏高".equals(r.getType()));
        }
        // 10 条同小时样本不足 50 条/小时，也不应触发传播速度风险
        for (RiskPoint r : c.getRiskPoints()) {
            assertFalse("传播速度偏快".equals(r.getType()));
        }
    }

    @Test
    @DisplayName("潜在风险：话题负面聚集需同时满足「负面率高于阈值+20」与「至少 3 条」")
    void conclusionRiskTopicCluster() {
        List<OpinionSlice> list = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            list.add(base((long) i, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 10, 0))
                .topicTags("食品安全").sentiAttr(i < 3 ? "negative" : "neutral").build());
        }
        List<DimRow> dims = new ArrayList<>();
        dims.add(dimRow(DimType.TOPIC.getCode(), "食品安全", "食品安全", 4, 3));

        AnalysisConclusion c = new ConclusionExtractor(props()).extract(list, dims);
        boolean hit = false;
        for (RiskPoint r : c.getRiskPoints()) {
            if ("负面聚集话题".equals(r.getType())) {
                hit = true;
                eq(75D, r.getValue());
                assertEquals("食品安全", r.getTarget());
            }
        }
        assertTrue(hit);
    }

    @Test
    @DisplayName("峰值时段：只认小时粒度趋势行，取条数最大的那个桶")
    void conclusionPeakBucket() {
        List<OpinionSlice> list = new ArrayList<>();
        list.add(base(1L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 14, 0)).build());
        List<DimRow> dims = new ArrayList<>();
        dims.add(trendRow(StatsGrain.HOUR.getCode(), "2026-09-05 13:00", 3));
        dims.add(trendRow(StatsGrain.HOUR.getCode(), "2026-09-05 14:00", 9));
        dims.add(trendRow(StatsGrain.DAY.getCode(), "2026-09-05", 12));

        AnalysisConclusion c = new ConclusionExtractor(props()).extract(list, dims);
        assertEquals("2026-09-05 14:00", c.getPeakBucket());
        eq(9, c.getPeakCount());
    }

    @Test
    @DisplayName("舆论焦点：话题与地域分开归集，占比按总量、负率按自身条数")
    void conclusionFocusPoints() {
        List<OpinionSlice> list = new ArrayList<>();
        list.add(base(1L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 10, 0))
            .topicTags("食品安全,校园霸凌").region("北京市").sentiAttr("negative").build());
        list.add(base(2L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 11, 0))
            .topicTags("食品安全,校园霸凌").region("北京市").sentiAttr("neutral").build());
        list.add(base(3L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 12, 0))
            .topicTags("食品安全,校园霸凌").region("北京市").sentiAttr("neutral").build());
        list.add(base(4L, LocalDate.of(2026, 9, 5), LocalDateTime.of(2026, 9, 5, 13, 0))
            .topicTags("食品安全").region("上海市").sentiAttr("positive").build());

        List<FocusPoint> points = new ConclusionExtractor(props()).extract(list, null).getFocusPoints();
        FocusPoint food = null;
        FocusPoint region = null;
        for (FocusPoint p : points) {
            if ("topic".equals(p.getKind()) && "食品安全".equals(p.getKey())) {
                food = p;
            }
            if ("region".equals(p.getKind()) && "北京市".equals(p.getKey())) {
                region = p;
            }
        }
        assertNotNull(food);
        eq(4, food.getOpinionCount());
        eq(100D, food.getShare());
        eq(25D, food.getNegativeRate());
        assertNotNull(region);
        eq(3, region.getOpinionCount());
        eq(75D, region.getShare());
    }

    /* ============================================================ 看板装配 */

    @Test
    @DisplayName("总量卡：跨行汇总条数、占比与互动合计，平均热度按「互动/条」给出")
    void assemblerTotals() {
        List<DailyRow> daily = new ArrayList<>();
        DailyRow a = daily(LocalDate.of(2026, 9, 5), 10, 4, 5, 1);
        a.setDupCount(2);
        a.setRejectedCount(3);
        a.setAlertCount(1);
        a.setPushCount(2);
        a.setReadSum(100L);
        a.setCommentSum(20L);
        a.setShareSum(10L);
        a.setLikeSum(30L);
        DailyRow b = daily(LocalDate.of(2026, 9, 6), 6, 2, 2, 2);
        b.setReadSum(50L);
        b.setCommentSum(10L);
        b.setShareSum(5L);
        b.setLikeSum(15L);
        daily.add(a);
        daily.add(b);

        TotalsView t = DashboardAssembler.totals(daily);
        eq(16, t.getTotalCount());
        eq(6, t.getPositiveCount());
        eq(7, t.getNeutralCount());
        eq(3, t.getNegativeCount());
        eq(37.5D, t.getPositiveRate());
        eq(43.75D, t.getNeutralRate());
        eq(18.75D, t.getNegativeRate());
        eq(2, t.getDupCount());
        eq(3, t.getRejectedCount());
        eq(1, t.getAlertCount());
        eq(2, t.getPushCount());
        eq(240L, t.getInteractionSum());
        eq(15D, t.getAvgHeatScore());
        eq(0D, DashboardAssembler.totals(new ArrayList<>()).getNegativeRate());
    }

    @Test
    @DisplayName("看板装配：严重级条数从风险分布取，平台卡按条数降序，结论来源显式标注")
    void assemblerAssemble() {
        DashboardInput in = new DashboardInput();
        in.setScope(scope(LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 5)));
        in.setGrain(StatsGrain.DAY);
        in.setRankBy(RankBy.HEAT);
        in.setTrendBase("publish_time");
        List<DailyRow> daily = new ArrayList<>();
        daily.add(daily(LocalDate.of(2026, 9, 5), 4, 1, 1, 2));
        in.setDaily(daily);
        List<DimRow> dist = new ArrayList<>();
        dist.add(dimRow(DimType.RISK.getCode(), "severe", "严重", 2, 2));
        dist.add(dimRow(DimType.CHANNEL.getCode(), "5", "微博", 3, 1));
        dist.add(dimRow(DimType.CHANNEL.getCode(), "6", "微信", 1, 0));
        in.setDistributions(dist);

        DashboardView v = DashboardAssembler.assemble(in);
        eq(2, v.getTotals().getHighRiskCount());
        assertEquals(2, v.getPlatform().size());
        assertEquals("5", v.getPlatform().get(0).getDimKey());
        assertEquals("none", v.getConclusionMode());
        assertEquals("2026-09-05", String.valueOf(v.getDateFrom()));
        assertEquals("day", v.getGrain());
        assertFalse(v.isEmpty());

        in.setConclusion(new ConclusionExtractor(props()).extract(new ArrayList<>(), null));
        assertEquals("derived", DashboardAssembler.assemble(in).getConclusionMode());
    }

    @Test
    @DisplayName("维度卡片：按条数排序时同数按 key 升序，字典维度按 key 固定顺序，占比按类内合计")
    void assemblerItemsSorting() {
        List<DimRow> rows = new ArrayList<>();
        rows.add(dimRow(DimType.TOPIC.getCode(), "b", "b", 5, 0));
        rows.add(dimRow(DimType.TOPIC.getCode(), "a", "a", 5, 0));
        rows.add(dimRow(DimType.TOPIC.getCode(), "c", "c", 9, 0));

        List<DimItem> byCount = DashboardAssembler.items(rows, 50, true);
        assertEquals("c", byCount.get(0).getDimKey());
        assertEquals("a", byCount.get(1).getDimKey());
        assertEquals("b", byCount.get(2).getDimKey());
        eq(47.37D, byCount.get(0).getShare());
        eq(26.32D, byCount.get(1).getShare());

        List<DimItem> byKey = DashboardAssembler.items(rows, 50, false);
        assertEquals("a", byKey.get(0).getDimKey());
        assertEquals("c", byKey.get(2).getDimKey());
        assertEquals(2, DashboardAssembler.items(rows, 2, true).size());
        assertTrue(DashboardAssembler.items(new ArrayList<>(), 50, true).isEmpty());
    }

    @Test
    @DisplayName("热点条目：跨日同名条目去重后按当前口径重排名次，不再沿用按天名次")
    void assemblerHotReorder() {
        List<HotRow> rows = new ArrayList<>();
        rows.add(hotRow(9L, 1, "同一条", 100, 10L));
        rows.add(hotRow(9L, 3, "同一条", 100, 10L));
        rows.add(hotRow(11L, 1, "另一条", 500, 20L));

        List<HotItem> items = DashboardAssembler.hotItems(rows, RankBy.HEAT);
        assertEquals(2, items.size());
        eq(11L, items.get(0).getOpinionId());
        eq(1, items.get(0).getRankNo());
        eq(2, items.get(1).getRankNo());
        eq(9L, items.get(1).getOpinionId());
    }

    @Test
    @DisplayName("热点条目：按阅读口径重排时忽略热度，阅读量大的在前")
    void assemblerHotReorderByRead() {
        List<HotRow> rows = new ArrayList<>();
        rows.add(hotRow(1L, 2, "低阅读", 999, 1L));
        rows.add(hotRow(2L, 1, "高阅读", 1, 100L));
        List<HotItem> items = DashboardAssembler.hotItems(rows, RankBy.READ);
        eq(2L, items.get(0).getOpinionId());
        eq(1L, items.get(1).getOpinionId());
    }

    /* ============================================================ 下钻条件 */

    @Test
    @DisplayName("下钻条件：平台维度转渠道ID，非法 key 一律返回空而不是猜一个")
    void drilldownChannel() {
        DrilldownQuery q = DrilldownQuery.of(scope(LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 5)),
            DimType.CHANNEL, "5", "微博", StatsGrain.DAY);
        assertNotNull(q);
        eq(5L, q.getChannelId());
        assertEquals(DimType.CHANNEL.getCode(), q.getDimType());
        assertEquals("微博", q.getDimLabel());

        assertNull(DrilldownQuery.of(scope(LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 5)),
            DimType.CHANNEL, "微博", "微博", StatsGrain.DAY));
        assertNull(DrilldownQuery.of(null, DimType.CHANNEL, "5", "微博", StatsGrain.DAY));
        assertNull(DrilldownQuery.of(scope(LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 5)),
            null, "5", "微博", StatsGrain.DAY));
    }

    @Test
    @DisplayName("下钻条件：地域用核心词做 INSTR 参数，三个兜底桶无法单值匹配则置空交给 Service")
    void drilldownRegion() {
        AggregateScope sc = scope(LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 5));
        DrilldownQuery beijing = DrilldownQuery.of(sc, DimType.REGION, "北京市", "北京市", StatsGrain.DAY);
        assertEquals("北京", beijing.getRegionToken());
        DrilldownQuery unknown = DrilldownQuery.of(sc, DimType.REGION, RegionNormalizer.UNKNOWN,
            RegionNormalizer.UNKNOWN, StatsGrain.DAY);
        assertNotNull(unknown);
        assertNull(unknown.getRegionToken());
        DrilldownQuery topic = DrilldownQuery.of(sc, DimType.TOPIC, "食品安全", "食品安全", StatsGrain.DAY);
        assertEquals("食品安全", topic.getTopicToken());
        assertNull(topic.getRegionToken());
    }

    @Test
    @DisplayName("下钻条件：趋势桶反解出精确区间，小时桶必须落到「时」而不是一整天")
    void drilldownTrendRange() {
        LocalDateTime[] hour = DrilldownQuery.trendRange("2026-09-05 14:00", StatsGrain.HOUR);
        assertNotNull(hour);
        assertEquals(LocalDateTime.of(2026, 9, 5, 14, 0), hour[0]);
        assertEquals(LocalDateTime.of(2026, 9, 5, 15, 0), hour[1]);

        LocalDateTime[] day = DrilldownQuery.trendRange("2026-09-05", StatsGrain.DAY);
        assertNotNull(day);
        assertEquals(LocalDateTime.of(2026, 9, 5, 0, 0), day[0]);
        assertEquals(LocalDateTime.of(2026, 9, 6, 0, 0), day[1]);

        LocalDateTime[] week = DrilldownQuery.trendRange("2026-W36", StatsGrain.WEEK);
        assertNotNull(week);
        assertEquals(7L, week[1].toLocalDate().toEpochDay() - week[0].toLocalDate().toEpochDay());

        assertNull(DrilldownQuery.trendRange("bogus", StatsGrain.DAY));
        assertNull(DrilldownQuery.trendRange(null, StatsGrain.DAY));
        assertNull(DrilldownQuery.trendRange("2026-09-05 14:00", StatsGrain.WEEK));
        assertNull(DrilldownQuery.of(scope(LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 5)),
            DimType.TREND, "bogus", "bogus", StatsGrain.DAY));
    }

    @Test
    @DisplayName("下钻分页：页码与页大小双向夹紧，条件描述可读")
    void drilldownPaging() {
        DrilldownQuery q = DrilldownQuery.of(scope(LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 5)),
            DimType.SENTI, "negative", "负面", StatsGrain.DAY);
        q.setPageNum(0);
        q.setPageSize(1000);
        q.paged(200);
        assertEquals(1, q.getPageNum());
        assertEquals(200, q.getPageSize());
        q.setPageSize(-5);
        q.paged(200);
        assertEquals(20, q.getPageSize());
        assertTrue(q.describe().contains("2026-09-05"));
        assertTrue(q.describe().contains("负面"));

        DrilldownQuery none = new DrilldownQuery();
        assertEquals("（无范围条件）", none.describe());
    }

    /* ============================================================ 范围归一 */

    @Test
    @DisplayName("范围归一：缺左端点补 7 天、倒置区间自动交换、超跨度按末日回退截断")
    void scopeNormalized() {
        AggregateScope s = new AggregateScope();
        s.setDateTo(LocalDate.of(2026, 9, 5));
        s.normalized(366);
        assertEquals(LocalDate.of(2026, 8, 30), s.getDateFrom());
        assertEquals(7, s.spanDays());

        AggregateScope swapped = scope(LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 1));
        swapped.normalized(366);
        assertEquals(LocalDate.of(2026, 9, 1), swapped.getDateFrom());
        assertEquals(LocalDate.of(2026, 9, 10), swapped.getDateTo());

        AggregateScope clamped = scope(LocalDate.of(2020, 1, 1), LocalDate.of(2026, 9, 5));
        clamped.normalized(30);
        assertEquals(30, clamped.spanDays());
        assertEquals(LocalDate.of(2026, 9, 5), clamped.getDateTo());
        assertFalse(clamped.singleDay());

        AggregateScope single = scope(LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 5));
        assertTrue(single.singleDay());
        assertEquals(1, single.spanDays());
    }

    @Test
    @DisplayName("范围归一：非正的任务/渠道视为未指定，空白属性条件视为不限")
    void scopeNormalizedFilters() {
        AggregateScope s = scope(LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 5));
        s.setTaskId(0L);
        s.setChannelId(-1L);
        s.setSentiAttr("   ");
        s.setRiskLevel(" severe ");
        s.normalized(366);
        assertNull(s.getTaskId());
        assertNull(s.getChannelId());
        assertNull(s.getSentiAttr());
        assertEquals("severe", s.getRiskLevel());
    }

    /* ========================================================== 导出与交接 */

    @Test
    @DisplayName("导出构建：总量/互动/流程量/各维度块/热点/元信息齐全，并按上限截断")
    void exportBuilderBlocks() {
        DashboardInput in = new DashboardInput();
        in.setScope(scope(LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 5)));
        in.setTrendBase("publish_time");
        List<DailyRow> daily = new ArrayList<>();
        daily.add(daily(LocalDate.of(2026, 9, 5), 4, 1, 1, 2));
        in.setDaily(daily);
        List<DimRow> dist = new ArrayList<>();
        dist.add(dimRow(DimType.CHANNEL.getCode(), "5", "微博", 4, 2));
        in.setDistributions(dist);
        List<HotRow> hot = new ArrayList<>();
        hot.add(hotRow(1L, 1, "热点标题", 88, 10L));
        in.setHot(hot);
        BatchMeta meta = new BatchMeta();
        meta.setBatchNo("YQ20260905");
        meta.setDataUntil(LocalDateTime.of(2026, 9, 5, 23, 59));
        in.setBatch(meta);

        DashboardView v = DashboardAssembler.assemble(in);
        List<StatsExportRow> rows = StatsExportBuilder.build(v, 20000);
        assertTrue(rows.size() > 10);
        List<String> blocks = new ArrayList<>();
        for (StatsExportRow r : rows) {
            if (!blocks.contains(r.getBlock())) {
                blocks.add(r.getBlock());
            }
        }
        assertTrue(blocks.contains("总量"));
        assertTrue(blocks.contains("互动量"));
        assertTrue(blocks.contains("流程量"));
        assertTrue(blocks.contains("平台分布"));
        assertTrue(blocks.contains("热点排行"));
        assertTrue(blocks.contains("元信息"));
        assertEquals(3, StatsExportBuilder.build(v, 3).size());
        assertTrue(StatsExportBuilder.build(null, 10).isEmpty());
    }

    @Test
    @DisplayName("报告交接：Markdown 表格齐备，单元格内竖线被替换，指标包键值可用")
    void reportHandoff() {
        DashboardInput in = new DashboardInput();
        in.setScope(scope(LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 5)));
        in.setTrendBase("publish_time");
        List<DailyRow> daily = new ArrayList<>();
        daily.add(daily(LocalDate.of(2026, 9, 5), 4, 1, 1, 2));
        in.setDaily(daily);
        List<DimRow> dist = new ArrayList<>();
        dist.add(dimRow(DimType.CHANNEL.getCode(), "5", "微博", 4, 2));
        in.setDistributions(dist);
        List<HotRow> hot = new ArrayList<>();
        hot.add(hotRow(1L, 1, "含竖线|标题", 88, 10L));
        in.setHot(hot);
        DashboardView v = DashboardAssembler.assemble(in);

        ReportSection s = ReportHandoffBuilder.build(v, "YQ20260905");
        assertEquals("data_analysis", s.getSectionCode());
        assertEquals("YQ20260905", s.getSourceBatch());
        assertTrue(s.getMarkdown().contains("## 数据分析"));
        assertTrue(s.getMarkdown().contains("### 一、总体态势"));
        assertTrue(s.getMarkdown().contains("### 六、热点舆情 TOP 排行"));
        assertFalse(s.getMarkdown().contains("含竖线|标题"));
        assertTrue(s.getMarkdown().contains("含竖线/标题"));
        assertTrue(s.getMetrics().containsKey("totalCount"));
        assertEquals(4, ((Number) s.getMetrics().get("totalCount")).intValue());
        assertNotNull(s.getScopeText());

        assertTrue(ReportHandoffBuilder.build(null, null).getMarkdown().contains("暂无可用数据"));
    }

    /* ======================================================== 派生结论兜底 */

    @Test
    @DisplayName("派生结论：看板筛选不出批次范围时由预聚合数据推导，并说明缺哪两块")
    void derivedConclusion() {
        DashboardInput in = new DashboardInput();
        in.setScope(scope(LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 5)));
        in.setTrendBase("publish_time");
        List<DailyRow> daily = new ArrayList<>();
        daily.add(daily(LocalDate.of(2026, 9, 5), 4, 1, 1, 2));
        in.setDaily(daily);
        List<DimRow> dist = new ArrayList<>();
        dist.add(dimRow(DimType.TOPIC.getCode(), "食品安全", "食品安全", 4, 4));
        dist.add(dimRow(DimType.CHANNEL.getCode(), "5", "微博", 3, 2));
        dist.add(dimRow(DimType.REGION.getCode(), "北京市", "北京市", 3, 2));
        dist.add(dimRow(DimType.RISK.getCode(), "severe", "严重", 2, 2));
        in.setDistributions(dist);
        List<DimRow> trend = new ArrayList<>();
        trend.add(trendRow(StatsGrain.DAY.getCode(), "2026-09-05", 4));
        in.setTrend(trend);

        DashboardView v = DashboardAssembler.assemble(in);
        AnalysisConclusion c = new DerivedConclusionBuilder(props()).build(v);
        assertFalse(c.isClusterBased());
        assertTrue(c.getCoreEvents().isEmpty());
        assertTrue(c.getPropagation().isEmpty());
        assertFalse(c.getFocusPoints().isEmpty());
        boolean hasNote = false;
        for (String line : c.getNarrative()) {
            if (line.contains("核心舆情事件")) {
                hasNote = true;
            }
        }
        assertTrue(hasNote);
        boolean risk = false;
        for (RiskPoint r : c.getRiskPoints()) {
            if ("负面占比偏高".equals(r.getType()) || "负面聚集话题".equals(r.getType())) {
                risk = true;
            }
        }
        assertTrue(risk);
    }

    @Test
    @DisplayName("派生结论：空数据只给说明，不产生风险项")
    void derivedConclusionEmpty() {
        DashboardView v = new DashboardView();
        v.setTotals(DashboardAssembler.totals(new ArrayList<>()));
        AnalysisConclusion c = new DerivedConclusionBuilder(props()).build(v);
        assertEquals(1, c.getNarrative().size());
        assertTrue(c.getRiskPoints().isEmpty());
        assertTrue(new DerivedConclusionBuilder(props()).build(null).getRiskPoints().isEmpty());
    }

    @Test
    @DisplayName("枚举解析：未知值返回空而非静默兜底到某个维度，七个分布类不含趋势")
    void enumParsing() {
        assertSame(StatsGrain.HOUR, StatsGrain.of("hour"));
        assertEquals(3, StatsGrain.values().length);
        assertSame(DimType.TREND, DimType.of("TREND"));
        assertNull(DimType.of("unknown_dim"));
        assertNull(DimType.of(null));
        assertEquals(7, DimType.distributions().size());
        assertFalse(DimType.distributions().contains(DimType.TREND));
        assertEquals(8, DimType.values().length);
    }
}
`,
  },

];
