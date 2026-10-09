package org.dromara.yuqing.analytics;

import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.analytics.config.YqAnalyticsProperties;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * 多维聚合器（F-009 验收标准 1 / 3 / 4 / 8 的算力核心）
 *
 * <p><b>本类不访问任何数据库、不使用任何 Spring 容器设施</b>，输入是明细切片列表，
 * 输出是三张预聚合表的数据行。这么切分有三个好处：
 * <ol>
 *   <li>可以完全离线自测：手搓几十条样本就能覆盖分桶、排序、归一、占比的全部分支；</li>
 *   <li>聚合规则只有一份实现，不存在「定时任务一套、看板实时一套」的口径漂移；</li>
 *   <li>聚合在内存里算，明细只扫一次，三张表一起产出 —— 而不是三张表各扫一遍明细。</li>
 * </ol>
 *
 * <p><b>归属口径（务必看清，这里最容易产生「数字对不上」的疑问）：</b>
 * <ul>
 *   <li>daily / 分布类维度：按 {@code collect_date}（采集日、Doris 分区列）归属；</li>
 *   <li>趋势曲线：按发布时间归属（可配 {@code trendByPublishTime=false} 切回采集时间），
 *       时间缺失的记录只计入总量、不进曲线；</li>
 *   <li>因此「趋势曲线累计」与「总量卡片」在跨日传播场景下允许存在差异，
 *       看板会把 trendBase 一并下发，由前端在图上标注。</li>
 * </ul>
 *
 * @author ruoyi
 */
@RequiredArgsConstructor
public class StatsAggregator {

    private final YqAnalyticsProperties props;

    /**
     * 执行聚合
     *
     * @param slices    明细切片（已按范围过滤）
     * @param scope     聚合范围
     * @param truncated 明细是否因上限被截断
     * @return 聚合产出
     */
    public AggregateOutcome aggregate(List<OpinionSlice> slices, AggregateScope scope, boolean truncated) {
        AggregateOutcome out = new AggregateOutcome();
        out.setBeginDate(scope.getDateFrom());
        out.setEndDate(scope.getDateTo());
        out.setTruncated(truncated);
        List<OpinionSlice> list = slices == null ? List.of() : slices;
        out.setSourceCount(list.size());
        if (truncated) {
            out.notice("明细读取命中上限 " + props.getMaxSourceRecords() + " 条已截断，指标为不完全统计");
        }

        out.setDaily(buildDaily(list));
        out.setDim(buildDims(list, scope));
        out.setHot(buildHot(list));
        return out;
    }

    /* ------------------------------------------------------------- 日聚合 */

    private List<DailyRow> buildDaily(List<OpinionSlice> list) {
        Map<String, DailyRow> map = new TreeMap<>();
        for (OpinionSlice s : list) {
            LocalDate d = s.getCollectDate();
            if (d == null) {
                continue;
            }
            String key = d + "#" + s.getTaskId() + "#" + s.getChannelId();
            DailyRow row = map.get(key);
            if (row == null) {
                row = new DailyRow();
                row.setStatsDate(d);
                row.setTaskId(s.getTaskId());
                row.setChannelId(s.getChannelId());
                row.setTotalCount(0);
                row.setPositiveCount(0);
                row.setNeutralCount(0);
                row.setNegativeCount(0);
                row.setDupCount(0);
                row.setRejectedCount(0);
                row.setAlertCount(0);
                row.setPushCount(0);
                row.setReportCount(0);
                row.setReadSum(0L);
                row.setCommentSum(0L);
                row.setShareSum(0L);
                row.setLikeSum(0L);
                map.put(key, row);
            }
            row.setTotalCount(row.getTotalCount() + 1);
            String senti = s.getSentiAttr();
            if ("positive".equals(senti)) {
                row.setPositiveCount(row.getPositiveCount() + 1);
            } else if ("negative".equals(senti)) {
                row.setNegativeCount(row.getNegativeCount() + 1);
            } else {
                // 中性 + 未标注：未标注不单独设列，避免为了几个脏值改表结构
                row.setNeutralCount(row.getNeutralCount() + 1);
            }
            row.setReadSum(row.getReadSum() + nz(s.getReadCount()));
            row.setCommentSum(row.getCommentSum() + nz(s.getCommentCount()));
            row.setShareSum(row.getShareSum() + nz(s.getShareCount()));
            row.setLikeSum(row.getLikeSum() + nz(s.getLikeCount()));
        }
        List<DailyRow> rows = new ArrayList<>(map.values());
        for (DailyRow r : rows) {
            r.derive();
        }
        return rows;
    }

    /* ----------------------------------------------------------- 维度聚合 */

    private List<DimRow> buildDims(List<OpinionSlice> list, AggregateScope scope) {
        Map<String, DimRow> map = new LinkedHashMap<>();
        for (OpinionSlice s : list) {
            LocalDate d = s.getCollectDate();
            if (d == null) {
                continue;
            }
            // 平台
            addDim(map, d, DimType.CHANNEL, StatsGrain.DAY, String.valueOf(s.getChannelId()),
                channelLabel(s), s);
            // 地域
            String region = RegionNormalizer.normalize(s.getRegion());
            addDim(map, d, DimType.REGION, StatsGrain.DAY, region, region, s);
            // 话题（一条舆情可命中多个话题，各自计数）
            for (String topic : TopicSplitter.split(s.getTopicTags())) {
                if (!TopicSplitter.meaningful(topic)) {
                    continue;
                }
                addDim(map, d, DimType.TOPIC, StatsGrain.DAY, topic, topic, s);
            }
            // 属性 / 风险 / 分级 / 传播量级
            addDictDim(map, d, DimType.SENTI, s.getSentiAttr(), s);
            addDictDim(map, d, DimType.RISK, s.getRiskLevel(), s);
            addDictDim(map, d, DimType.LEVEL, s.getOpinionLevel(), s);
            addDictDim(map, d, DimType.SPREAD, s.getSpreadLevel(), s);
            // 趋势
            addTrend(map, s, scope);
        }
        List<DimRow> rows = new ArrayList<>(map.values());
        for (DimRow r : rows) {
            r.derive();
        }
        rows.sort(Comparator
            .comparing((DimRow r) -> r.getStatsDate() == null ? LocalDate.MIN : r.getStatsDate())
            .thenComparing(r -> nvl(r.getDimType()))
            .thenComparing(r -> nvl(r.getTimeGrain()))
            .thenComparing(r -> nvl(r.getDimKey())));
        return rows;
    }

    private void addDictDim(Map<String, DimRow> map, LocalDate d, DimType type, String code, OpinionSlice s) {
        String key = (code == null || code.isBlank()) ? "unknown" : code.trim();
        String label = (code == null || code.isBlank()) ? "未标注" : DimLabels.of(type, key);
        addDim(map, d, type, StatsGrain.DAY, key, label, s);
    }

    private void addDim(Map<String, DimRow> map, LocalDate d, DimType type, StatsGrain grain,
                        String dimKey, String dimLabel, OpinionSlice s) {
        if (dimKey == null || dimKey.isBlank()) {
            return;
        }
        String key = d + "#" + type.getCode() + "#" + dimKey + "#" + grain.getCode()
            + "#" + s.getTaskId() + "#" + s.getChannelId();
        DimRow row = map.get(key);
        if (row == null) {
            row = new DimRow();
            row.setStatsDate(d);
            row.setDimType(type.getCode());
            row.setDimKey(dimKey);
            row.setTimeGrain(grain.getCode());
            row.setTaskId(s.getTaskId());
            row.setChannelId(s.getChannelId());
            row.setDimLabel(dimLabel);
            row.setOpinionCount(0);
            row.setPositiveCount(0);
            row.setNeutralCount(0);
            row.setNegativeCount(0);
            row.setHighRiskCount(0);
            row.setReadSum(0L);
            row.setCommentSum(0L);
            row.setShareSum(0L);
            row.setLikeSum(0L);
            row.setHeatSum(0L);
            map.put(key, row);
        }
        bump(row, s);
    }

    private void bump(DimRow row, OpinionSlice s) {
        row.setOpinionCount(row.getOpinionCount() + 1);
        String senti = s.getSentiAttr();
        if ("positive".equals(senti)) {
            row.setPositiveCount(row.getPositiveCount() + 1);
        } else if ("negative".equals(senti)) {
            row.setNegativeCount(row.getNegativeCount() + 1);
        } else {
            row.setNeutralCount(row.getNeutralCount() + 1);
        }
        if ("severe".equals(s.getRiskLevel())) {
            row.setHighRiskCount(row.getHighRiskCount() + 1);
        }
        row.setReadSum(row.getReadSum() + nz(s.getReadCount()));
        row.setCommentSum(row.getCommentSum() + nz(s.getCommentCount()));
        row.setShareSum(row.getShareSum() + nz(s.getShareCount()));
        row.setLikeSum(row.getLikeSum() + nz(s.getLikeCount()));
        row.setHeatSum(row.getHeatSum() + HeatScorer.score(s));
    }

    /* ------------------------------------------------------------- 趋势桶 */

    private void addTrend(Map<String, DimRow> map, OpinionSlice s, AggregateScope scope) {
        LocalDateTime t = props.isTrendByPublishTime() ? s.getTrendTime() : s.getCollectTime();
        if (t == null) {
            return;
        }
        LocalDate d = s.getCollectDate() == null ? t.toLocalDate() : s.getCollectDate();
        for (StatsGrain grain : StatsGrain.values()) {
            if (grain == StatsGrain.HOUR && !withinHourWindow(t, scope)) {
                continue;
            }
            String key = bucketKey(t, grain);
            String label = bucketLabel(t, grain);
            addDim(map, d, DimType.TREND, grain, key, label, s);
        }
    }

    /**
     * 小时桶是否在回算窗口内
     *
     * <p>以「范围末日」而不是 {@code now()} 为基准：聚合结果必须只由入参决定，
     * 否则同一份明细在不同时刻重跑会得到不同的行数，幂等就无从谈起。</p>
     */
    private boolean withinHourWindow(LocalDateTime t, AggregateScope scope) {
        int days = props.getHourTrendDays();
        if (days <= 0) {
            return false;
        }
        LocalDate base = scope.getDateTo() == null ? LocalDate.now() : scope.getDateTo();
        LocalDate from = base.minusDays(days - 1L);
        return !t.toLocalDate().isBefore(from);
    }

    /**
     * 计算时间桶标识（可字典序排序：ISO 格式天然按时间递增）
     */
    public static String bucketKey(LocalDateTime t, StatsGrain grain) {
        if (t == null) {
            return "";
        }
        switch (grain) {
            case HOUR:
                return p4(t.getYear()) + "-" + p2(t.getMonthValue()) + "-" + p2(t.getDayOfMonth())
                    + " " + p2(t.getHour()) + ":00";
            case WEEK:
                return p4(t.get(WeekFields.ISO.weekBasedYear())) + "-W"
                    + p2(t.get(WeekFields.ISO.weekOfWeekBasedYear()));
            default:
                return p4(t.getYear()) + "-" + p2(t.getMonthValue()) + "-" + p2(t.getDayOfMonth());
        }
    }

    /**
     * 计算时间桶展示名（曲线 x 轴用短格式，避免标签挤在一起）
     */
    public static String bucketLabel(LocalDateTime t, StatsGrain grain) {
        if (t == null) {
            return "";
        }
        switch (grain) {
            case HOUR:
                return p2(t.getMonthValue()) + "-" + p2(t.getDayOfMonth()) + " " + p2(t.getHour()) + ":00";
            case WEEK:
                LocalDate start = t.toLocalDate().with(WeekFields.ISO.dayOfWeek(), 1);
                return p2(start.getMonthValue()) + "-" + p2(start.getDayOfMonth()) + " 起";
            default:
                return p2(t.getMonthValue()) + "-" + p2(t.getDayOfMonth());
        }
    }

    /* ------------------------------------------------------------- 热点榜 */

    private List<HotRow> buildHot(List<OpinionSlice> list) {
        int topN = Math.max(1, Math.min(props.getHotTopN(), 500));
        Map<LocalDate, List<OpinionSlice>> byDay = new TreeMap<>();
        for (OpinionSlice s : list) {
            LocalDate d = s.getCollectDate();
            if (d == null) {
                continue;
            }
            byDay.computeIfAbsent(d, k -> new ArrayList<>()).add(s);
        }
        List<HotRow> out = new ArrayList<>();
        for (Map.Entry<LocalDate, List<OpinionSlice>> e : byDay.entrySet()) {
            for (RankBy by : RankBy.values()) {
                List<OpinionSlice> ranked = rankTop(e.getValue(), by, topN);
                int no = 1;
                for (OpinionSlice s : ranked) {
                    out.add(toHotRow(e.getKey(), by, no++, s));
                }
            }
        }
        return out;
    }

    private static HotRow toHotRow(LocalDate d, RankBy by, int no, OpinionSlice s) {
        HotRow r = new HotRow();
        r.setStatsDate(d);
        r.setRankBy(by.getCode());
        r.setRankNo(no);
        r.setOpinionId(s.getOpinionId());
        r.setTaskId(s.getTaskId());
        r.setChannelId(s.getChannelId());
        r.setTitle(s.getTitle());
        r.setChannelName(s.getChannelName());
        r.setOpinionUrl(s.getOpinionUrl());
        r.setPublishTime(s.getPublishTime());
        r.setSentiAttr(s.getSentiAttr());
        r.setRiskLevel(s.getRiskLevel());
        r.setReadCount(nz(s.getReadCount()));
        r.setCommentCount(nz(s.getCommentCount()));
        r.setShareCount(nz(s.getShareCount()));
        r.setLikeCount(nz(s.getLikeCount()));
        r.setHeatScore((int) Math.min(HeatScorer.score(s), Integer.MAX_VALUE));
        return r;
    }

    /**
     * 按口径排序取 TopN
     *
     * <p>tie-break 显式三级：主指标降序 → 发布时间降序 → 舆情ID降序。
     * 三级写完才能保证「同一天重跑名次不变」，这是幂等的一部分。</p>
     */
    static List<OpinionSlice> rankTop(List<OpinionSlice> list, RankBy by, int topN) {
        List<OpinionSlice> copy = new ArrayList<>(list);
        copy.sort((a, b) -> {
            int c = Long.compare(primaryScore(b, by), primaryScore(a, by));
            if (c != 0) {
                return c;
            }
            int t = compareTimeDesc(a.getPublishTime(), b.getPublishTime());
            if (t != 0) {
                return t;
            }
            return Long.compare(idOf(b), idOf(a));
        });
        return copy.size() <= topN ? copy : new ArrayList<>(copy.subList(0, topN));
    }

    static long primaryScore(OpinionSlice s, RankBy by) {
        if (s == null) {
            return 0L;
        }
        switch (by) {
            case READ:
                return nz(s.getReadCount());
            case SHARE:
                return nz(s.getShareCount());
            case COMMENT:
                return nz(s.getCommentCount());
            default:
                return HeatScorer.score(s);
        }
    }

    private static int compareTimeDesc(LocalDateTime a, LocalDateTime b) {
        if (a == null && b == null) {
            return 0;
        }
        if (a == null) {
            return 1;
        }
        if (b == null) {
            return -1;
        }
        return b.compareTo(a);
    }

    private static long idOf(OpinionSlice s) {
        return s == null || s.getOpinionId() == null ? 0L : s.getOpinionId();
    }

    static long nz(Long v) {
        return v == null ? 0L : Math.max(v, 0L);
    }

    static String nvl(String v) {
        return v == null ? "" : v;
    }

    private static String channelLabel(OpinionSlice s) {
        if (s.getChannelName() != null && !s.getChannelName().isBlank()) {
            return s.getChannelName();
        }
        return s.getChannelId() == null || s.getChannelId() == 0L ? "未标注渠道" : "渠道" + s.getChannelId();
    }

    private static String p2(int v) {
        return (v < 10 ? "0" : "") + v;
    }

    private static String p4(int v) {
        if (v >= 1000) {
            return String.valueOf(v);
        }
        if (v >= 100) {
            return "0" + v;
        }
        if (v >= 10) {
            return "00" + v;
        }
        return "000" + v;
    }
}
