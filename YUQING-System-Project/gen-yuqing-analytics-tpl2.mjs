/**
 * F-009 多维分析 · 第 2 片：聚合器 + 结论提炼 + 看板视图 + 报告交接
 */
export const ANALYTICS_TPL2 = [

  /* ================================================================== 配置 */
  {
    rel: 'analytics/config/YqAnalyticsProperties.java',
    content: `package org.dromara.yuqing.analytics.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 多维分析引擎配置（前缀 {@code yuqing.analytics}）
 *
 * <p>样例见 {@code config/yq_analytics.yml}。</p>
 *
 * @author ruoyi
 */
@Data
@Component
@ConfigurationProperties(prefix = "yuqing.analytics")
public class YqAnalyticsProperties {

    /** 引擎总开关；关闭时聚合任务直接返回 */
    private boolean enabled = true;

    /** 单次聚合允许的最大统计跨度（天） */
    private int maxScopeDays = 366;

    /** 单次聚合允许读入内存的明细条数（保护性上限，命中即截断并记提示） */
    private int maxSourceRecords = 200000;

    /** 定时任务的回看天数（含当天）；补算任意历史区间走手动重算接口 */
    private int jobLookbackDays = 2;

    /** 分布类维度每类保留的取值个数 */
    private int dimTopN = 50;

    /** 热点排行 TopN */
    private int hotTopN = 20;

    /** 小时级趋势只回算最近多少天（小时桶行数增长快，必须封顶） */
    private int hourTrendDays = 30;

    /** 结论里保留的核心事件条数 */
    private int conclusionTopEvents = 5;

    /** 触发「负面占比偏高」风险的阈值（%） */
    private double riskNegativeRate = 30D;

    /** 触发器「高风险占比偏高」风险的阈值（%） */
    private double riskSevereRate = 10D;

    /** 趋势曲线是否按发布时间归属（false 则按采集时间） */
    private boolean trendByPublishTime = true;

    /** 下钻明细单页最大条数 */
    private int maxDrilldownPageSize = 200;

    /** 导出 Excel 的最大行数 */
    private int exportMaxRows = 20000;
}
`,
  },

  /* ================================================================ 聚合器 */
  {
    rel: 'analytics/StatsAggregator.java',
    content: `package org.dromara.yuqing.analytics;

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
`,
  },

  /* ============================================================ 结论相关类 */
  {
    rel: 'analytics/CoreEvent.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 核心舆情事件（F-009 验收标准 5 「核心舆情事件」）
 *
 * @author ruoyi
 */
@Data
public class CoreEvent {

    /** 事件聚合ID（无聚合时为 0） */
    private Long clusterId;

    /** 事件标题（取组内热度最高那条） */
    private String title;

    /** 代表条目链接 */
    private String opinionUrl;

    /** 代表条目ID（下钻用） */
    private Long opinionId;

    /** 组内条数 */
    private Integer opinionCount;

    /** 负面条数 */
    private Integer negativeCount;

    /** 负面占比（%） */
    private Double negativeRate;

    /** 热度合计 */
    private Long heatSum;

    /** 首次出现时间 */
    private LocalDateTime firstTime;

    /** 最后一次出现时间 */
    private LocalDateTime lastTime;

    /** 涉及渠道（保序去重） */
    private List<String> channels = new ArrayList<>();
}
`,
  },
  {
    rel: 'analytics/PropagationStage.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 传播路径中的一站（F-009 验收标准 5 「传播路径」）
 *
 * <p>按渠道**首次发布时间**排序，形成「先在哪传、后在哪传」的链路，
 * 而不是按渠道条数排 —— 条数排出来的不是路径，是榜单。</p>
 *
 * @author ruoyi
 */
@Data
public class PropagationStage {

    /** 序号（从 1 起，按首次发布时间升序） */
    private Integer seq;

    /** 渠道名称 */
    private String channelName;

    /** 该渠道首次发布时间 */
    private LocalDateTime firstTime;

    /** 该渠道最后发布时间 */
    private LocalDateTime lastTime;

    /** 该渠道条数 */
    private Integer opinionCount;

    /** 该渠道条数占比（%） */
    private Double countShare;

    /** 相对上一站的间隔分钟数（第一站为 0） */
    private Long gapMinutes;
}
`,
  },
  {
    rel: 'analytics/FocusPoint.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

/**
 * 舆论焦点（F-009 验收标准 5 「舆论焦点」）
 *
 * @author ruoyi
 */
@Data
public class FocusPoint {

    /** 焦点类型：topic / region */
    private String kind;

    /** 取值 */
    private String key;

    /** 展示名 */
    private String label;

    /** 条数 */
    private Integer opinionCount;

    /** 占比（%） */
    private Double share;

    /** 负面占比（%） */
    private Double negativeRate;

    /** 热度合计 */
    private Long heatSum;
}
`,
  },
  {
    rel: 'analytics/RiskPoint.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

/**
 * 潜在风险点（F-009 验收标准 5 「潜在风险点」）
 *
 * @author ruoyi
 */
@Data
public class RiskPoint {

    /** 风险级别 high / medium / low */
    private String level;

    /** 风险类型标签，如「负面占比偏高」 */
    private String type;

    /** 一句话描述（含具体数字，避免看的人再算一遍） */
    private String detail;

    /** 实测值 */
    private Double value;

    /** 触发阈值 */
    private Double threshold;

    /** 关联对象（话题名 / 渠道名 / 日期，无则为空） */
    private String target;
}
`,
  },
  {
    rel: 'analytics/AnalysisConclusion.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 结构化分析结论（F-009 验收标准 5）
 *
 * <p>「结构化」不是把一段文字拆成几行 —— 四类结论各自是对象列表，
 * 前端可以按卡片渲染，F-014 报告生成也可以按章节取用，
 * 文字版只是它们的投影（{@link #narrative}）。</p>
 *
 * @author ruoyi
 */
@Data
public class AnalysisConclusion {

    /** 是否基于事件聚类（false 说明 clusterId 缺失，退化为标题分组） */
    private boolean clusterBased;

    /** 核心舆情事件 */
    private List<CoreEvent> coreEvents = new ArrayList<>();

    /** 传播路径 */
    private List<PropagationStage> propagation = new ArrayList<>();

    /** 舆论焦点 */
    private List<FocusPoint> focusPoints = new ArrayList<>();

    /** 潜在风险点 */
    private List<RiskPoint> riskPoints = new ArrayList<>();

    /** 主题文字版结论（每行一条，供报告直接引用） */
    private List<String> narrative = new ArrayList<>();

    /** 最早发布时间 */
    private LocalDateTime firstTime;

    /** 最晚发布时间 */
    private LocalDateTime lastTime;

    /** 跨度小时数（不足 1 小时按 1 计，避免除零） */
    private Long durationHours;

    /** 传播速度（条/小时） */
    private Double speedPerHour;

    /** 峰值时间桶（dim_key） */
    private String peakBucket;

    /** 峰值条数 */
    private Integer peakCount;

    /** 结论生成时间 */
    private LocalDateTime generatedAt;
}
`,
  },
  {
    rel: 'analytics/ConclusionExtractor.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.analytics.config.YqAnalyticsProperties;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 分析结论提炼器（F-009 验收标准 5）
 *
 * <p>四类结论的提炼口径都写成确定性规则，不用任何模型 —— 原因很直接：
 * 看板上每个数字都能被下游拿来写报告、发预警，如果结论出自一个不可复现的过程，
 * 复核时没人能解释「为什么昨天说风险高、今天同样数据说风险低」。
 * F-007 智能研判落地后可以把这里换成模型口径，但**兜底规则必须一直保留**。</p>
 *
 * @author ruoyi
 */
@RequiredArgsConstructor
public class ConclusionExtractor {

    private final YqAnalyticsProperties props;

    /**
     * 提炼结论
     *
     * @param slices 明细切片
     * @param dims   该范围的趋势行（用于挑峰值时段），可为空
     * @return 结构化结论
     */
    public AnalysisConclusion extract(List<OpinionSlice> slices, List<DimRow> dims) {
        AnalysisConclusion c = new AnalysisConclusion();
        c.setGeneratedAt(LocalDateTime.now());
        List<OpinionSlice> list = slices == null ? List.of() : slices;
        int total = list.size();
        if (total == 0) {
            c.getNarrative().add("统计范围内无有效舆情数据。");
            c.setDurationHours(0L);
            c.setSpeedPerHour(0D);
            return c;
        }

        Timeline tl = timeline(list);
        c.setFirstTime(tl.first);
        c.setLastTime(tl.last);
        long hours = tl.durationHours();
        c.setDurationHours(hours);
        c.setSpeedPerHour(DailyRow.round2(total / (double) hours));

        boolean clusterBased = list.stream().anyMatch(s -> s.getClusterId() != null && s.getClusterId() > 0L);
        c.setClusterBased(clusterBased);
        c.setCoreEvents(coreEvents(list, clusterBased));
        c.setPropagation(propagation(list, total));
        c.setFocusPoints(focusPoints(list, total));
        c.setRiskPoints(riskPoints(list, total, tl, dims));
        peak(c, dims);
        c.getNarrative().addAll(narrative(c, total));
        return c;
    }

    /* ---------------------------------------------------------- 核心事件 */

    private List<CoreEvent> coreEvents(List<OpinionSlice> list, boolean byCluster) {
        Map<String, List<OpinionSlice>> groups = new LinkedHashMap<>();
        for (OpinionSlice s : list) {
            String key = byCluster
                ? "c" + (s.getClusterId() == null ? 0L : s.getClusterId())
                : "t" + StatsAggregator.nvl(s.getTitle()).trim();
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
        }
        List<CoreEvent> events = new ArrayList<>();
        for (Map.Entry<String, List<OpinionSlice>> e : groups.entrySet()) {
            List<OpinionSlice> g = e.getValue();
            CoreEvent ev = new CoreEvent();
            long clusterId = 0L;
            if (byCluster && e.getKey().startsWith("c")) {
                clusterId = parseLong(e.getKey().substring(1));
            }
            ev.setClusterId(clusterId);
            ev.setOpinionCount(g.size());
            ev.setNegativeCount((int) g.stream().filter(s -> "negative".equals(s.getSentiAttr())).count());
            ev.setNegativeRate(DailyRow.round2(ev.getNegativeCount() * 100D / g.size()));
            ev.setHeatSum(g.stream().mapToLong(HeatScorer::score).sum());

            List<OpinionSlice> ranked = StatsAggregator.rankTop(g, RankBy.HEAT, 1);
            if (!ranked.isEmpty()) {
                OpinionSlice top = ranked.get(0);
                ev.setTitle(StatsAggregator.nvl(top.getTitle()));
                ev.setOpinionUrl(top.getOpinionUrl());
                ev.setOpinionId(top.getOpinionId());
            }
            Timeline t = timeline(g);
            ev.setFirstTime(t.first);
            ev.setLastTime(t.last);
            Set<String> chs = new LinkedHashSet<>();
            for (OpinionSlice s : g) {
                chs.add(channelOf(s));
                if (chs.size() >= 8) {
                    break;
                }
            }
            ev.setChannels(new ArrayList<>(chs));
            events.add(ev);
        }
        events.sort(Comparator
            .comparingLong((CoreEvent x) -> x.getHeatSum() == null ? 0L : x.getHeatSum()).reversed()
            .thenComparing(x -> x.getOpinionCount() == null ? 0 : x.getOpinionCount(), Comparator.reverseOrder())
            .thenComparing(x -> StatsAggregator.nvl(x.getTitle())));
        int cap = Math.max(1, props.getConclusionTopEvents());
        return events.size() <= cap ? events : new ArrayList<>(events.subList(0, cap));
    }

    /* ---------------------------------------------------------- 传播路径 */

    private List<PropagationStage> propagation(List<OpinionSlice> list, int total) {
        Map<String, List<OpinionSlice>> byChannel = new LinkedHashMap<>();
        for (OpinionSlice s : list) {
            byChannel.computeIfAbsent(channelOf(s), k -> new ArrayList<>()).add(s);
        }
        List<PropagationStage> stages = new ArrayList<>();
        for (Map.Entry<String, List<OpinionSlice>> e : byChannel.entrySet()) {
            Timeline t = timeline(e.getValue());
            PropagationStage st = new PropagationStage();
            st.setChannelName(e.getKey());
            st.setFirstTime(t.first);
            st.setLastTime(t.last);
            st.setOpinionCount(e.getValue().size());
            st.setCountShare(DailyRow.round2(e.getValue().size() * 100D / Math.max(total, 1)));
            stages.add(st);
        }
        stages.sort(Comparator
            .comparing((PropagationStage s) -> s.getFirstTime() == null ? LocalDateTime.MAX : s.getFirstTime())
            .thenComparing(s -> StatsAggregator.nvl(s.getChannelName())));
        LocalDateTime prev = null;
        int seq = 1;
        for (PropagationStage s : stages) {
            s.setSeq(seq++);
            if (prev == null || s.getFirstTime() == null) {
                s.setGapMinutes(0L);
            } else {
                s.setGapMinutes(Math.max(0L, Duration.between(prev, s.getFirstTime()).toMinutes()));
            }
            prev = s.getFirstTime() == null ? prev : s.getFirstTime();
        }
        return stages.size() <= 10 ? stages : new ArrayList<>(stages.subList(0, 10));
    }

    /* ---------------------------------------------------------- 舆论焦点 */

    private List<FocusPoint> focusPoints(List<OpinionSlice> list, int total) {
        List<FocusPoint> out = new ArrayList<>();
        out.addAll(focusOf(list, total, true));
        out.addAll(focusOf(list, total, false));
        return out.size() <= 10 ? out : new ArrayList<>(out.subList(0, 10));
    }

    private List<FocusPoint> focusOf(List<OpinionSlice> list, int total, boolean topic) {
        Map<String, int[]> agg = new LinkedHashMap<>();
        Map<String, Long> heat = new LinkedHashMap<>();
        for (OpinionSlice s : list) {
            List<String> keys = new ArrayList<>();
            if (topic) {
                for (String t : TopicSplitter.split(s.getTopicTags())) {
                    if (TopicSplitter.meaningful(t)) {
                        keys.add(t);
                    }
                }
            } else {
                keys.add(RegionNormalizer.normalize(s.getRegion()));
            }
            for (String k : keys) {
                int[] cell = agg.computeIfAbsent(k, x -> new int[2]);
                cell[0]++;
                if ("negative".equals(s.getSentiAttr())) {
                    cell[1]++;
                }
                heat.merge(k, HeatScorer.score(s), Long::sum);
            }
        }
        List<FocusPoint> rows = new ArrayList<>();
        for (Map.Entry<String, int[]> e : agg.entrySet()) {
            int[] cell = e.getValue();
            FocusPoint p = new FocusPoint();
            p.setKind(topic ? "topic" : "region");
            p.setKey(e.getKey());
            p.setLabel(e.getKey());
            p.setOpinionCount(cell[0]);
            p.setShare(DailyRow.round2(cell[0] * 100D / Math.max(total, 1)));
            p.setNegativeRate(DailyRow.round2(cell[1] * 100D / Math.max(cell[0], 1)));
            p.setHeatSum(heat.getOrDefault(e.getKey(), 0L));
            rows.add(p);
        }
        rows.sort(Comparator
            .comparingInt((FocusPoint p) -> p.getOpinionCount() == null ? 0 : p.getOpinionCount()).reversed()
            .thenComparing(p -> StatsAggregator.nvl(p.getKey())));
        return rows.size() <= 5 ? rows : new ArrayList<>(rows.subList(0, 5));
    }

    /* ---------------------------------------------------------- 潜在风险 */

    private List<RiskPoint> riskPoints(List<OpinionSlice> list, int total, Timeline tl, List<DimRow> dims) {
        List<RiskPoint> risks = new ArrayList<>();
        long severe = list.stream().filter(s -> "severe".equals(s.getRiskLevel())).count();
        long negative = list.stream().filter(s -> "negative".equals(s.getSentiAttr())).count();
        double severeRate = DailyRow.round2(severe * 100D / total);
        double negativeRate = DailyRow.round2(negative * 100D / total);

        addRisk(risks, "负面占比偏高", negativeRate, props.getRiskNegativeRate(),
            "负面 " + negative + " 条，占总量 " + negativeRate + "%", null);
        addRisk(risks, "高风险占比偏高", severeRate, props.getRiskSevereRate(),
            "严重级 " + severe + " 条，占总量 " + severeRate + "%", null);

        // 突增：单日峰值 / 日均
        Map<String, Integer> byDay = new LinkedHashMap<>();
        for (OpinionSlice s : list) {
            if (s.getCollectDate() != null) {
                byDay.merge(s.getCollectDate().toString(), 1, Integer::sum);
            }
        }
        if (byDay.size() >= 2) {
            int peak = byDay.values().stream().mapToInt(Integer::intValue).max().orElse(0);
            double avg = total / (double) byDay.size();
            double ratio = avg <= 0 ? 0D : DailyRow.round2(peak / avg);
            if (ratio >= 3D) {
                String day = byDay.entrySet().stream()
                    .max(Comparator.comparingInt(Map.Entry::getValue)).map(Map.Entry::getKey).orElse("");
                RiskPoint r = new RiskPoint();
                r.setLevel(ratio >= 5D ? "high" : "medium");
                r.setType("单日量突增");
                r.setDetail("峰值日 " + day + " 采集 " + peak + " 条，为日均 " + DailyRow.round2(avg) + " 条的 " + ratio + " 倍");
                r.setValue(ratio);
                r.setThreshold(3D);
                r.setTarget(day);
                risks.add(r);
            }
        }

        // 传播速度
        double speed = total / (double) tl.durationHours();
        if (speed >= 50D) {
            RiskPoint r = new RiskPoint();
            r.setLevel(speed >= 200D ? "high" : "medium");
            r.setType("传播速度偏快");
            r.setDetail("统计区间内平均 " + DailyRow.round2(speed) + " 条/小时");
            r.setValue(DailyRow.round2(speed));
            r.setThreshold(50D);
            risks.add(r);
        }

        // 负面聚集话题
        if (dims != null) {
            for (DimRow d : dims) {
                if (!DimType.TOPIC.getCode().equals(d.getDimType()) || d.getNegativeRate() == null) {
                    continue;
                }
                if (d.getNegativeRate() >= props.getRiskNegativeRate() + 20D && d.getOpinionCount() >= 3) {
                    RiskPoint r = new RiskPoint();
                    r.setLevel(d.getNegativeRate() >= 80D ? "high" : "medium");
                    r.setType("负面聚集话题");
                    r.setDetail("话题「" + d.getDimKey() + "」共 " + d.getOpinionCount() + " 条，负面占 "
                        + d.getNegativeRate() + "%");
                    r.setValue(d.getNegativeRate());
                    r.setThreshold(props.getRiskNegativeRate() + 20D);
                    r.setTarget(d.getDimKey());
                    risks.add(r);
                    if (risks.size() >= 6) {
                        break;
                    }
                }
            }
        }

        risks.sort((a, b) -> {
            int c1 = Integer.compare(rank(b.getLevel()), rank(a.getLevel()));
            if (c1 != 0) {
                return c1;
            }
            return Double.compare(dbl(b.getValue()), dbl(a.getValue()));
        });
        return risks.size() <= 5 ? risks : new ArrayList<>(risks.subList(0, 5));
    }

    private static double dbl(Double v) {
        return v == null ? 0D : v;
    }

    private void addRisk(List<RiskPoint> risks, String type, double value, double threshold,
                         String detail, String target) {
        if (threshold <= 0D || value < threshold) {
            return;
        }
        RiskPoint r = new RiskPoint();
        r.setLevel(value >= threshold * 2D ? "high" : "medium");
        r.setType(type);
        r.setDetail(detail);
        r.setValue(value);
        r.setThreshold(threshold);
        r.setTarget(target);
        risks.add(r);
    }

    private static int rank(String level) {
        if ("high".equals(level)) {
            return 3;
        }
        if ("medium".equals(level)) {
            return 2;
        }
        return 1;
    }

    /* ------------------------------------------------------------ 峰值 */

    private void peak(AnalysisConclusion c, List<DimRow> dims) {
        if (dims == null || dims.isEmpty()) {
            return;
        }
        DimRow best = null;
        for (DimRow d : dims) {
            if (!DimType.TREND.getCode().equals(d.getDimType()) || !StatsGrain.HOUR.getCode().equals(d.getTimeGrain())) {
                continue;
            }
            if (best == null || nz(d.getOpinionCount()) > nz(best.getOpinionCount())) {
                best = d;
            }
        }
        if (best != null) {
            c.setPeakBucket(best.getDimKey());
            c.setPeakCount(best.getOpinionCount());
        }
    }

    /* ---------------------------------------------------------- 文字版 */

    private List<String> narrative(AnalysisConclusion c, int total) {
        List<String> lines = new ArrayList<>();
        lines.add("统计范围内共采集舆情 " + total + " 条，最早出现于 " + fmt(c.getFirstTime())
            + "，最晚 " + fmt(c.getLastTime()) + "，跨度约 " + c.getDurationHours() + " 小时。");
        lines.add("统计区间平均传播速度 " + c.getSpeedPerHour() + " 条/小时。");
        if (c.getPeakBucket() != null) {
            lines.add("传播峰值出现在 " + c.getPeakBucket() + "，该时段 " + c.getPeakCount() + " 条。");
        }
        if (!c.getCoreEvents().isEmpty()) {
            CoreEvent top = c.getCoreEvents().get(0);
            lines.add("核心事件「" + safe(top.getTitle()) + "」相关 " + top.getOpinionCount() + " 条，热度合计 "
                + top.getHeatSum() + (c.isClusterBased() ? "（按事件聚类口径）" : "（事件聚类缺失，按标题口径）"));
        }
        if (!c.getPropagation().isEmpty()) {
            StringBuilder sb = new StringBuilder("传播路径：");
            for (PropagationStage s : c.getPropagation()) {
                if (s.getSeq() > 6) {
                    sb.append(" 等 ").append(c.getPropagation().size()).append(" 个渠道");
                    break;
                }
                sb.append(s.getChannelName()).append("(").append(s.getOpinionCount()).append("条)");
                if (s.getSeq() < Math.min(c.getPropagation().size(), 6)) {
                    sb.append(" → ");
                }
            }
            lines.add(sb.toString());
        }
        if (!c.getFocusPoints().isEmpty()) {
            StringBuilder sb = new StringBuilder("舆论焦点：");
            for (FocusPoint p : c.getFocusPoints()) {
                if ("topic".equals(p.getKind())) {
                    sb.append(p.getKey()).append("(").append(p.getOpinionCount()).append("条,负面")
                        .append(p.getNegativeRate()).append("%) ");
                }
            }
            lines.add(sb.toString().trim());
        }
        if (c.getRiskPoints().isEmpty()) {
            lines.add("未触发潜在风险阈值。");
        } else {
            for (RiskPoint r : c.getRiskPoints()) {
                lines.add("风险[" + levelCn(r.getLevel()) + "] " + r.getType() + "：" + r.getDetail());
            }
        }
        return lines;
    }

    private static String levelCn(String level) {
        if ("high".equals(level)) {
            return "高";
        }
        if ("medium".equals(level)) {
            return "中";
        }
        return "低";
    }

    private static String safe(String v) {
        if (v == null || v.isBlank()) {
            return "未命名事件";
        }
        return v.length() > 40 ? v.substring(0, 40) + "…" : v;
    }

    private static String fmt(LocalDateTime t) {
        if (t == null) {
            return "未知时间";
        }
        return t.toString().replace('T', ' ');
    }

    private static String channelOf(OpinionSlice s) {
        if (s.getChannelName() != null && !s.getChannelName().isBlank()) {
            return s.getChannelName();
        }
        return s.getChannelId() == null || s.getChannelId() == 0L ? "未标注渠道" : "渠道" + s.getChannelId();
    }

    private static long nz(Integer v) {
        return v == null ? 0L : v;
    }

    private static long parseLong(String v) {
        try {
            return Long.parseLong(v);
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    /** 时间轴小工具 */
    private static final class Timeline {

        private final LocalDateTime first;

        private final LocalDateTime last;

        private Timeline(LocalDateTime first, LocalDateTime last) {
            this.first = first;
            this.last = last;
        }

        private long durationHours() {
            if (first == null || last == null) {
                return 1L;
            }
            long h = Duration.between(first, last).toHours();
            return h <= 0 ? 1L : h;
        }
    }

    private static Timeline timeline(List<OpinionSlice> list) {
        LocalDateTime first = null;
        LocalDateTime last = null;
        for (OpinionSlice s : list) {
            LocalDateTime t = s.getTrendTime();
            if (t == null) {
                continue;
            }
            if (first == null || t.isBefore(first)) {
                first = t;
            }
            if (last == null || t.isAfter(last)) {
                last = t;
            }
        }
        return new Timeline(first, last);
    }

    /** 暴露给自测：确认当前配置下的阈值口径 */
    public double negativeRateThreshold() {
        return props.getRiskNegativeRate();
    }
}
`,
  },
];
