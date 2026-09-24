/**
 * F-009 多维分析 · 第 3 片：看板视图 + 下钻 + 报告交接 + 导出（全为纯函数）
 */
export const ANALYTICS_TPL3 = [

  {
    rel: 'analytics/DimItem.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

/**
 * 看板上的一个维度条目（分布卡片的一行、趋势曲线的一个点）
 *
 * <p>分布与趋势共用同一结构：趋势就是把 dimKey/dimLabel 当成时间桶，
 * 前端两条渲染路径可以复用同一套 tooltip 与下钻逻辑。</p>
 *
 * @author ruoyi
 */
@Data
public class DimItem {

    /** 维度类型 */
    private String dimType;

    /** 维度取值（趋势行是时间桶标识，可字典序排序） */
    private String dimKey;

    /** 展示名 */
    private String dimLabel;

    /** 条数 */
    private Integer opinionCount;

    /** 正面条数 */
    private Integer positiveCount;

    /** 中性条数 */
    private Integer neutralCount;

    /** 负面条数 */
    private Integer negativeCount;

    /** 严重级条数 */
    private Integer highRiskCount;

    /** 阅读量合计 */
    private Long readSum;

    /** 评论量合计 */
    private Long commentSum;

    /** 转发量合计 */
    private Long shareSum;

    /** 点赞量合计 */
    private Long likeSum;

    /** 热度合计 */
    private Long heatSum;

    /** 负面占比（%） */
    private Double negativeRate;

    /** 本条目占其所属维度总量的比例（%） */
    private Double share;
}
`,
  },
  {
    rel: 'analytics/TotalsView.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

/**
 * 看板总量卡（F-009 验收标准 1 的「舆情总量 / 正负面占比 / 互动数据统计」）
 *
 * @author ruoyi
 */
@Data
public class TotalsView {

    /** 舆情总量 */
    private Integer totalCount;

    /** 正面条数 */
    private Integer positiveCount;

    /** 中性条数 */
    private Integer neutralCount;

    /** 负面条数 */
    private Integer negativeCount;

    /** 严重级条数 */
    private Integer highRiskCount;

    /** 正面占比（%） */
    private Double positiveRate;

    /** 中性占比（%） */
    private Double neutralRate;

    /** 负面占比（%） */
    private Double negativeRate;

    /** 阅读量合计 */
    private Long readSum;

    /** 评论量合计 */
    private Long commentSum;

    /** 转发量合计 */
    private Long shareSum;

    /** 点赞量合计 */
    private Long likeSum;

    /** 互动量合计（阅读+评论+转发+点赞） */
    private Long interactionSum;

    /** 平均综合热度 */
    private Double avgHeatScore;

    /** 去重剔除条数 */
    private Integer dupCount;

    /** 降噪剔除条数 */
    private Integer rejectedCount;

    /** 预警条数 */
    private Integer alertCount;

    /** 推送条数 */
    private Integer pushCount;

    /** 报告生成数 */
    private Integer reportCount;
}
`,
  },
  {
    rel: 'analytics/HotItem.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 热点排行条目（F-009 验收标准 3）
 *
 * @author ruoyi
 */
@Data
public class HotItem {

    /** 名次（1 起；跨日范围查询时由服务层按分数重排后回填） */
    private Integer rankNo;

    /** 舆情ID */
    private Long opinionId;

    /** 任务ID */
    private Long taskId;

    /** 渠道ID */
    private Long channelId;

    /** 标题 */
    private String title;

    /** 渠道名称 */
    private String channelName;

    /** 原文链接 */
    private String opinionUrl;

    /** 发布时间 */
    private LocalDateTime publishTime;

    /** 舆情属性 */
    private String sentiAttr;

    /** 风险等级 */
    private String riskLevel;

    /** 阅读量 */
    private Long readCount;

    /** 评论量 */
    private Long commentCount;

    /** 转发量 */
    private Long shareCount;

    /** 点赞量 */
    private Long likeCount;

    /** 综合热度 */
    private Integer heatScore;
}
`,
  },
  {
    rel: 'analytics/BatchMeta.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 数据来源批次元信息（F-009 验收标准 9）
 *
 * <p>预聚合任务失败时看板不报错，而是展示最近一次成功的聚合结果，
 * 并把「这批数据截止到什么时候」显式告诉使用者 —— 让看板能自证新鲜度，
 * 是防止误判形势最便宜的手段。</p>
 *
 * @author ruoyi
 */
@Data
public class BatchMeta {

    /** 最近一次成功聚合的批次号 */
    private String batchNo;

    /** 该批次的起止统计日 */
    private String beginDate;

    /** 该批次的结束统计日 */
    private String endDate;

    /** 数据截止时间（该批次覆盖到的最新发布时间） */
    private LocalDateTime dataUntil;

    /** 该批次的完成时间 */
    private LocalDateTime aggregatedAt;

    /** 最近一次聚合是否失败（看板据此显示黄色告警条） */
    private boolean degraded;

    /** 最近失败批次的失败原因 */
    private String failReason;

    /**
     * 该批次产出的结构化结论 JSON
     *
     * <p>为什么不另建一张结论表：结论是「一次聚合的产物」，与批次的生存周期
     * 完全一致（同一次运行产生、同一次重跑覆盖），拆表反而要维护外键与清理逻辑。</p>
     */
    private String conclusionJson;

    /** 是否存在可用的聚合结果 */
    private boolean available;
}
`,
  },
  {
    rel: 'analytics/DashboardView.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 看板聚合响应（F-009 验收标准 1 / 2 / 3 / 4 / 9）
 *
 * <p>七类指标各占一个字段，筛选条件原样回显（{@link #scope}）——
 * 回显是为了让前端在导出、带入报告、分享链接时能复现同一份视图，
 * 而不是让使用者对着图回忆「我刚才选的是哪几天」。</p>
 *
 * @author ruoyi
 */
@Data
public class DashboardView {

    /** 生效的范围（归一化后回显） */
    private AggregateScope scope;

    /** 生效的时间粒度 */
    private String grain;

    /** 生效的排序口径 */
    private String rankBy;

    /** 趋势归属口径说明（publish_time / collect_time） */
    private String trendBase;

    /** 总量卡 */
    private TotalsView totals;

    /** 平台（渠道）分布 */
    private List<DimItem> platform = new ArrayList<>();

    /** 地域分布 */
    private List<DimItem> region = new ArrayList<>();

    /** 话题分布 */
    private List<DimItem> topic = new ArrayList<>();

    /** 舆情属性分布 */
    private List<DimItem> senti = new ArrayList<>();

    /** 风险等级分布 */
    private List<DimItem> risk = new ArrayList<>();

    /** 舆情分级分布 */
    private List<DimItem> level = new ArrayList<>();

    /** 传播量级分布 */
    private List<DimItem> spread = new ArrayList<>();

    /** 传播趋势（按 grain 切换） */
    private List<DimItem> trend = new ArrayList<>();

    /** 热点排行 */
    private List<HotItem> hot = new ArrayList<>();

    /** 结构化分析结论 */
    private AnalysisConclusion conclusion;

    /**
     * 结论来源
     *
     * <ul>
     *   <li>{@code batch}：来自聚合批次落库的结论（含核心事件与传播路径，最完整）</li>
     *   <li>{@code derived}：当前筛选条件与批次不一致，由预聚合数据即时推导
     *       （只有舆论焦点与风险点，没有核心事件与传播路径）</li>
     *   <li>{@code none}：无数据</li>
     * </ul>
     * 显式告知来源，是为了避免使用者把「派生结论」当成全量结论 ——
     * 两者差着「核心事件」和「传播路径」两块，不标出来就是误导。
     */
    private String conclusionMode;

    /** 数据来源批次元信息 */
    private BatchMeta batch;

    /** 非致命提示 */
    private List<String> notices = new ArrayList<>();

    /** 生效的起始统计日（冗余出来方便前端拼接导出文件名） */
    private LocalDate dateFrom;

    /** 生效的截止统计日 */
    private LocalDate dateTo;

    /** 是否为空数据（前端显示空态而不是空白图） */
    public boolean isEmpty() {
        return totals == null || totals.getTotalCount() == null || totals.getTotalCount() == 0;
    }
}
`,
  },
  {
    rel: 'analytics/DashboardInput.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 看板装配入参
 *
 * <p>把「已从预聚合表查出来的行」交给 {@link DashboardAssembler}，
 * 装配逻辑因此不碰数据库，可以被离线自测完整覆盖。</p>
 *
 * @author ruoyi
 */
@Data
public class DashboardInput {

    /** 生效范围 */
    private AggregateScope scope;

    /** 时间粒度 */
    private StatsGrain grain = StatsGrain.DAY;

    /** 排序口径 */
    private RankBy rankBy = RankBy.HEAT;

    /** 趋势归属口径说明 */
    private String trendBase;

    /** 范围汇总后的日聚合行 */
    private List<DailyRow> daily = new ArrayList<>();

    /** 七个分布类维度行（已按 dim_type 汇总） */
    private List<DimRow> distributions = new ArrayList<>();

    /** 趋势行（已按 grain 汇总） */
    private List<DimRow> trend = new ArrayList<>();

    /** 热点行 */
    private List<HotRow> hot = new ArrayList<>();

    /** 结论 */
    private AnalysisConclusion conclusion;

    /** 批次元信息 */
    private BatchMeta batch;

    /** 提示 */
    private List<String> notices = new ArrayList<>();

    /** 每个分布类维度最多保留的取值个数 */
    private int dimTopN = 50;
}
`,
  },
  {
    rel: 'analytics/DashboardAssembler.java',
    content: `package org.dromara.yuqing.analytics;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 看板装配器（纯函数）
 *
 * <p>只做三件事：把行汇总成总量、把维度行切成维度卡片、把热点行补上名次。
 * 一切「业务判定」都不在这里 —— 结论在 {@link ConclusionExtractor}，
 * 数据在 JDBC 层，本类出错只可能是算错占比，不会算错事实。</p>
 *
 * @author ruoyi
 */
public final class DashboardAssembler {

    /**
     * 装配
     *
     * @param in 入参
     * @return 看板视图
     */
    public static DashboardView assemble(DashboardInput in) {
        DashboardView v = new DashboardView();
        v.setScope(in.getScope());
        v.setGrain(in.getGrain().getCode());
        v.setRankBy(in.getRankBy().getCode());
        v.setTrendBase(in.getTrendBase());
        if (in.getScope() != null) {
            v.setDateFrom(in.getScope().getDateFrom());
            v.setDateTo(in.getScope().getDateTo());
        }
        v.setTotals(totals(in.getDaily()));
        v.setConclusion(in.getConclusion());
        // 默认按「派生」标注：只有 Service 层确认取到了批次结论才会改成 batch
        v.setConclusionMode(in.getConclusion() == null ? "none" : "derived");
        v.setBatch(in.getBatch());
        v.setNotices(in.getNotices() == null ? new ArrayList<>() : new ArrayList<>(in.getNotices()));

        Map<String, List<DimRow>> byType = new LinkedHashMap<>();
        if (in.getDistributions() != null) {
            for (DimRow r : in.getDistributions()) {
                byType.computeIfAbsent(StatsAggregator.nvl(r.getDimType()), k -> new ArrayList<>()).add(r);
            }
        }
        int topN = Math.max(1, in.getDimTopN());
        v.setPlatform(items(byType.get(DimType.CHANNEL.getCode()), topN, true));
        v.setRegion(items(byType.get(DimType.REGION.getCode()), topN, true));
        v.setTopic(items(byType.get(DimType.TOPIC.getCode()), topN, true));
        v.setSenti(items(byType.get(DimType.SENTI.getCode()), topN, false));
        v.setRisk(items(byType.get(DimType.RISK.getCode()), topN, false));
        v.setLevel(items(byType.get(DimType.LEVEL.getCode()), topN, false));
        v.setSpread(items(byType.get(DimType.SPREAD.getCode()), topN, false));
        v.setTrend(items(in.getTrend(), Math.max(topN, 400), false));
        v.setHot(hotItems(in.getHot(), in.getRankBy()));
        // 严重级条数落在风险分布这一维度上，总量卡从那里取，避免为了一个数单独存一列
        v.getTotals().setHighRiskCount(severeCount(v.getRisk()));
        return v;
    }

    /** 从风险分布里取 severe 的数量 */
    static Integer severeCount(List<DimItem> riskItems) {
        if (riskItems == null) {
            return 0;
        }
        for (DimItem it : riskItems) {
            if ("severe".equals(it.getDimKey())) {
                return nz(it.getOpinionCount());
            }
        }
        return 0;
    }

    /* ------------------------------------------------------------- 总量 */

    static TotalsView totals(List<DailyRow> daily) {
        TotalsView t = new TotalsView();
        int total = 0;
        int positive = 0;
        int neutral = 0;
        int negative = 0;
        int dup = 0;
        int rejected = 0;
        int alert = 0;
        int push = 0;
        int report = 0;
        long read = 0L;
        long comment = 0L;
        long share = 0L;
        long like = 0L;
        if (daily != null) {
            for (DailyRow r : daily) {
                total += nz(r.getTotalCount());
                positive += nz(r.getPositiveCount());
                neutral += nz(r.getNeutralCount());
                negative += nz(r.getNegativeCount());
                dup += nz(r.getDupCount());
                rejected += nz(r.getRejectedCount());
                alert += nz(r.getAlertCount());
                push += nz(r.getPushCount());
                report += nz(r.getReportCount());
                read += nz(r.getReadSum());
                comment += nz(r.getCommentSum());
                share += nz(r.getShareSum());
                like += nz(r.getLikeSum());
            }
        }
        t.setTotalCount(total);
        t.setPositiveCount(positive);
        t.setNeutralCount(neutral);
        t.setNegativeCount(negative);
        t.setDupCount(dup);
        t.setRejectedCount(rejected);
        t.setAlertCount(alert);
        t.setPushCount(push);
        t.setReportCount(report);
        t.setReadSum(read);
        t.setCommentSum(comment);
        t.setShareSum(share);
        t.setLikeSum(like);
        t.setInteractionSum(read + comment + share + like);
        t.setPositiveRate(rate(positive, total));
        t.setNeutralRate(rate(neutral, total));
        t.setNegativeRate(rate(negative, total));
        // 平均热度：用互动总量估算会失真，这里以「条数 × 互动均值」不可得，
        // 因此退化为互动密度的千分位表示，前端展示为「互动/条」更直观
        t.setAvgHeatScore(total == 0 ? 0D : DailyRow.round2((read + comment + share + like) / (double) total));
        return t;
    }

    /* --------------------------------------------------------- 维度条目 */

    /**
     * 把维度行汇总成条目
     *
     * @param rows  同一 dim_type 的行
     * @param topN  最多保留条数
     * @param byCount true 按条数降序，false 按业务固定顺序（字典维度按取值排序）
     */
    static List<DimItem> items(List<DimRow> rows, int topN, boolean byCount) {
        List<DimItem> out = new ArrayList<>();
        if (rows == null || rows.isEmpty()) {
            return out;
        }
        Map<String, DimItem> agg = new LinkedHashMap<>();
        for (DimRow r : rows) {
            String key = StatsAggregator.nvl(r.getDimKey());
            DimItem it = agg.get(key);
            if (it == null) {
                it = new DimItem();
                it.setDimType(r.getDimType());
                it.setDimKey(key);
                it.setDimLabel(r.getDimLabel() == null ? key : r.getDimLabel());
                it.setOpinionCount(0);
                it.setPositiveCount(0);
                it.setNeutralCount(0);
                it.setNegativeCount(0);
                it.setHighRiskCount(0);
                it.setReadSum(0L);
                it.setCommentSum(0L);
                it.setShareSum(0L);
                it.setLikeSum(0L);
                it.setHeatSum(0L);
                agg.put(key, it);
            }
            it.setOpinionCount(it.getOpinionCount() + nz(r.getOpinionCount()));
            it.setPositiveCount(it.getPositiveCount() + nz(r.getPositiveCount()));
            it.setNeutralCount(it.getNeutralCount() + nz(r.getNeutralCount()));
            it.setNegativeCount(it.getNegativeCount() + nz(r.getNegativeCount()));
            it.setHighRiskCount(it.getHighRiskCount() + nz(r.getHighRiskCount()));
            it.setReadSum(it.getReadSum() + nz(r.getReadSum()));
            it.setCommentSum(it.getCommentSum() + nz(r.getCommentSum()));
            it.setShareSum(it.getShareSum() + nz(r.getShareSum()));
            it.setLikeSum(it.getLikeSum() + nz(r.getLikeSum()));
            it.setHeatSum(it.getHeatSum() + nz(r.getHeatSum()));
        }
        long sum = 0L;
        for (DimItem it : agg.values()) {
            it.setNegativeRate(rate(nz(it.getNegativeCount()), nz(it.getOpinionCount())));
            sum += nz(it.getOpinionCount());
        }
        for (DimItem it : agg.values()) {
            it.setShare(sum == 0L ? 0D : DailyRow.round2(nz(it.getOpinionCount()) * 100D / sum));
        }
        out.addAll(agg.values());
        if (byCount) {
            out.sort((a, b) -> {
                int c = Integer.compare(nz(b.getOpinionCount()), nz(a.getOpinionCount()));
                return c != 0 ? c : StatsAggregator.nvl(a.getDimKey()).compareTo(StatsAggregator.nvl(b.getDimKey()));
            });
        } else {
            out.sort((a, b) -> StatsAggregator.nvl(a.getDimKey()).compareTo(StatsAggregator.nvl(b.getDimKey())));
        }
        return out.size() <= topN ? out : new ArrayList<>(out.subList(0, topN));
    }

    /* ------------------------------------------------------------- 热点 */

    /**
     * 热点条目：按当前口径重排并回填名次
     *
     * <p>跨日查询时数据库里存的是「每天的 TopN」，直接按 rank_no 排会得到
     * 「1 号、1 号、1 号…」这种错乱结果。这里按分数重排是正确的：
     * 若某条在整段范围内排第 k（k ≤ N），那么它在自己那一天必然也排第 k 或更前，
     * 因此「每天 TopN 的并集」一定包含「整段 TopN」，重排即可得到全局名次。</p>
     */
    static List<HotItem> hotItems(List<HotRow> rows, RankBy by) {
        List<HotItem> out = new ArrayList<>();
        if (rows == null || rows.isEmpty()) {
            return out;
        }
        Map<String, HotItem> uniq = new LinkedHashMap<>();
        for (HotRow r : rows) {
            String key = String.valueOf(r.getOpinionId() == null ? 0L : r.getOpinionId());
            HotItem it = uniq.get(key);
            if (it == null) {
                it = new HotItem();
                it.setOpinionId(r.getOpinionId());
                it.setTaskId(r.getTaskId());
                it.setChannelId(r.getChannelId());
                it.setTitle(r.getTitle());
                it.setChannelName(r.getChannelName());
                it.setOpinionUrl(r.getOpinionUrl());
                it.setPublishTime(r.getPublishTime());
                it.setSentiAttr(r.getSentiAttr());
                it.setRiskLevel(r.getRiskLevel());
                it.setReadCount(nz(r.getReadCount()));
                it.setCommentCount(nz(r.getCommentCount()));
                it.setShareCount(nz(r.getShareCount()));
                it.setLikeCount(nz(r.getLikeCount()));
                it.setHeatScore(r.getHeatScore());
                uniq.put(key, it);
            }
        }
        out.addAll(uniq.values());
        out.sort((a, b) -> {
            int c = Long.compare(score(b, by), score(a, by));
            if (c != 0) {
                return c;
            }
            int t = compareTimeDesc(a, b);
            if (t != 0) {
                return t;
            }
            return Long.compare(idOf(b), idOf(a));
        });
        for (int i = 0; i < out.size(); i++) {
            out.get(i).setRankNo(i + 1);
        }
        return out;
    }

    private static long score(HotItem it, RankBy by) {
        switch (by) {
            case READ:
                return nz(it.getReadCount());
            case SHARE:
                return nz(it.getShareCount());
            case COMMENT:
                return nz(it.getCommentCount());
            default:
                return nz(it.getHeatScore());
        }
    }

    private static int compareTimeDesc(HotItem a, HotItem b) {
        if (a.getPublishTime() == null && b.getPublishTime() == null) {
            return 0;
        }
        if (a.getPublishTime() == null) {
            return 1;
        }
        if (b.getPublishTime() == null) {
            return -1;
        }
        return b.getPublishTime().compareTo(a.getPublishTime());
    }

    private static long idOf(HotItem it) {
        return it.getOpinionId() == null ? 0L : it.getOpinionId();
    }

    static Double rate(int part, int total) {
        return total <= 0 ? 0D : DailyRow.round2(part * 100D / total);
    }

    static int nz(Integer v) {
        return v == null ? 0 : v;
    }

    static long nz(Long v) {
        return v == null ? 0L : v;
    }

    private DashboardAssembler() {
    }
}
`,
  },
  {
    rel: 'analytics/DrilldownQuery.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 下钻查询条件（F-009 验收标准 6）
 *
 * <p><b>这是整个 F-009 的安全关键点。</b>用户点击的是「某个维度取值」，
 * 而这个取值来自采集侧的文本字段（地域、话题）。任何把它直接拼进 SQL 的写法
 * 都会立刻变成注入点。因此这里只做「归一 + 参数化准备」：</p>
 * <ul>
 *   <li>地域：{@link RegionNormalizer#matchToken} 得到核心词，JDBC 层用
 *       {@code INSTR(region, ?) > 0} —— 不做 LIKE，彻底规避 % 与 _ 的转义问题；</li>
 *   <li>话题：直接作为参数传给 {@code INSTR(topic_tags, ?) > 0}；</li>
 *   <li>其余维度：等值参数。</li>
 * </ul>
 * <p>本类里没有、也不允许出现任何 SQL 片段。</p>
 *
 * @author ruoyi
 */
@Data
public class DrilldownQuery {

    /** 范围条件 */
    private AggregateScope scope;

    /** 维度类型（dim_type 或 hot） */
    private String dimType;

    /** 维度取值 */
    private String dimKey;

    /** 展示名（回显用） */
    private String dimLabel;

    /** 渠道ID（dim_type=channel 时使用） */
    private Long channelId;

    /** 地域核心词（INSTR 参数） */
    private String regionToken;

    /** 话题文本（INSTR 参数） */
    private String topicToken;

    /** 舆情属性等值条件 */
    private String sentiAttr;

    /** 风险等级等值条件 */
    private String riskLevel;

    /** 舆情分级等值条件 */
    private String opinionLevel;

    /** 传播量级等值条件 */
    private String spreadLevel;

    /** 单条舆情下钻（热点行点击） */
    private Long opinionId;

    /** 趋势行下钻：发布时间起（含） */
    private LocalDateTime timeFrom;

    /** 趋势行下钻：发布时间止（不含） */
    private LocalDateTime timeTo;

    /** 页码 */
    private int pageNum = 1;

    /** 每页条数 */
    private int pageSize = 20;

    /**
     * 由维度条目构造下钻条件
     *
     * @param scope  生效范围
     * @param type   维度类型
     * @param key    维度取值
     * @param label  展示名
     * @param grain  当前粒度（趋势下钻用）
     * @return 下钻条件；无法映射时返回 {@code null}
     */
    public static DrilldownQuery of(AggregateScope scope, DimType type, String key, String label, StatsGrain grain) {
        if (scope == null || type == null || key == null || key.isBlank()) {
            return null;
        }
        DrilldownQuery q = new DrilldownQuery();
        q.setScope(scope);
        q.setDimType(type.getCode());
        q.setDimKey(key);
        q.setDimLabel(label == null ? key : label);
        switch (type) {
            case CHANNEL:
                try {
                    q.setChannelId(Long.parseLong(key));
                } catch (NumberFormatException e) {
                    return null;
                }
                break;
            case REGION:
                q.setRegionToken(RegionNormalizer.matchToken(key));
                if (q.getRegionToken().isEmpty()) {
                    // 未知 / 海外 / 其他 三个桶无法用单值匹配，交给 Service 走「无地域」分支
                    q.setRegionToken(null);
                }
                break;
            case TOPIC:
                q.setTopicToken(key);
                break;
            case SENTI:
                q.setSentiAttr(key);
                break;
            case RISK:
                q.setRiskLevel(key);
                break;
            case LEVEL:
                q.setOpinionLevel(key);
                break;
            case SPREAD:
                q.setSpreadLevel(key);
                break;
            case TREND:
                LocalDateTime[] range = trendRange(key, grain);
                if (range == null) {
                    return null;
                }
                q.setTimeFrom(range[0]);
                q.setTimeTo(range[1]);
                break;
            default:
                return null;
        }
        return q;
    }

    /**
     * 由时间桶标识反解出精确的发布时间区间 [起, 止)
     *
     * <p>桶标识是自产的 ISO 串（yyyy-MM-dd / yyyy-MM-dd HH:00 / yyyy-Www），
     * 解析失败即返回 {@code null}，绝不猜测；小时桶必须解析到「时」，
     * 否则下钻出来的是一整天而不是那一个小时，使用者会以为数据错了。</p>
     */
    static LocalDateTime[] trendRange(String bucketKey, StatsGrain grain) {
        if (bucketKey == null || bucketKey.isBlank()) {
            return null;
        }
        try {
            if (grain == StatsGrain.HOUR) {
                /* 小时桶键形如 2026-09-05 14:00（16 位），必须解析到「时」 */
                if (bucketKey.length() < 13) {
                    return null;
                }
                LocalDateTime t = LocalDateTime.parse(bucketKey.substring(0, 13).replace(' ', 'T') + ":00");
                return new LocalDateTime[]{t, t.plusHours(1L)};
            }
            if (grain == StatsGrain.WEEK) {
                int idx = bucketKey.indexOf("-W");
                if (idx < 4) {
                    return null;
                }
                int year = Integer.parseInt(bucketKey.substring(0, idx));
                int week = Integer.parseInt(bucketKey.substring(idx + 2));
                java.time.temporal.WeekFields iso = java.time.temporal.WeekFields.ISO;
                LocalDate monday = LocalDate.of(year, 1, 4).with(iso.dayOfWeek(), 1).plusWeeks(week - 1L);
                // 跨年边界用 ISO 周反算可能差一周，做一次对齐校验
                if (monday.get(iso.weekBasedYear()) != year || monday.get(iso.weekOfWeekBasedYear()) != week) {
                    monday = monday.plusWeeks(1L);
                }
                return new LocalDateTime[]{monday.atStartOfDay(), monday.plusDays(7L).atStartOfDay()};
            }
            /* 日桶键形如 2026-09-05（10 位）—— 显式挡短串，不靠 substring 抛异常兜底 */
            if (bucketKey.length() < 10) {
                return null;
            }
            LocalDate d = LocalDate.parse(bucketKey.substring(0, 10));
            return new LocalDateTime[]{d.atStartOfDay(), d.plusDays(1L).atStartOfDay()};
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** 归一化分页参数 */
    public DrilldownQuery paged(int maxPageSize) {
        if (pageNum < 1) {
            pageNum = 1;
        }
        int max = Math.max(1, maxPageSize);
        if (pageSize < 1) {
            pageSize = 20;
        }
        if (pageSize > max) {
            pageSize = max;
        }
        return this;
    }

    /** 人类可读的条件描述（前端下钻抽屉标题） */
    public String describe() {
        StringBuilder sb = new StringBuilder();
        if (scope == null) {
            return "（无范围条件）";
        }
        sb.append(scope.getDateFrom()).append(" 至 ").append(scope.getDateTo());
        if (scope.getTaskId() != null) {
            sb.append(" · 任务#").append(scope.getTaskId());
        }
        if (scope.getChannelId() != null) {
            sb.append(" · 渠道#").append(scope.getChannelId());
        }
        if (dimLabel != null && !dimLabel.isBlank()) {
            sb.append(" · ").append(dimLabel);
        }
        return sb.toString();
    }
}
`,
  },
  {
    rel: 'analytics/DrilldownResult.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 下钻结果（F-009 验收标准 6）
 *
 * @author ruoyi
 */
@Data
public class DrilldownResult {

    /** 维度类型 */
    private String dimType;

    /** 维度取值 */
    private String dimKey;

    /** 展示名 */
    private String dimLabel;

    /** 条件描述 */
    private String conditionText;

    /** 命中总条数 */
    private long total;

    /** 页码 */
    private int pageNum;

    /** 每页条数 */
    private int pageSize;

    /** 明细行 */
    private List<Row> rows = new ArrayList<>();

    /**
     * 下钻明细行（字段与舆情台账列表对齐，便于前端复用同一套表格列）
     *
     * @author ruoyi
     */
    @Data
    public static class Row {

        /** 舆情ID */
        private Long opinionId;

        /** 标题 */
        private String title;

        /** 渠道名称 */
        private String channelName;

        /** 发布时间 */
        private LocalDateTime publishTime;

        /** 舆情属性 */
        private String sentiAttr;

        /** 风险等级 */
        private String riskLevel;

        /** 发布地域 */
        private String region;

        /** 话题标签 */
        private String topicTags;

        /** 阅读量 */
        private Long readCount;

        /** 评论量 */
        private Long commentCount;

        /** 转发量 */
        private Long shareCount;

        /** 点赞量 */
        private Long likeCount;

        /** 原文链接 */
        private String opinionUrl;
    }
}
`,
  },
  {
    rel: 'analytics/ReportSection.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 报告章节交接包（F-009 验收标准 7）
 *
 * <p>「一键带入报告生成流程」的实现方式不是让 F-009 去调 F-014 的接口，
 * 而是由 F-009 产出一个自描述的数据包：<b>报告模块只依赖本类，不反向依赖分析模块</b>。
 * 这样 F-014 可以晚于 F-009 落地，也可以在报告模板里挑着用（只要「总体态势」一节也行）。</p>
 *
 * @author ruoyi
 */
@Data
public class ReportSection {

    /** 章节编码（F-014 按此匹配模板占位） */
    private String sectionCode = "data_analysis";

    /** 章节标题 */
    private String title = "数据分析";

    /** 正文（Markdown 片段，无代码块、无内联样式，保证能直接进 Word 与微信） */
    private String markdown;

    /** 结构化指标（键值对，供模板做可配置的字段级引用） */
    private Map<String, Object> metrics = new LinkedHashMap<>();

    /** 结构化结论（前端渲染卡片 / 模板取数） */
    private AnalysisConclusion conclusion;

    /** 生效范围描述 */
    private String scopeText;

    /** 数据截止时间 */
    private LocalDateTime dataUntil;

    /** 来源批次号 */
    private String sourceBatch;

    /** 生成时间 */
    private LocalDateTime generatedAt;

    /** 明细行（供报告里的数据表章节） */
    private List<DimItem> platform;

    /** 趋势行 */
    private List<DimItem> trend;

    /** 热点行 */
    private List<HotItem> hot;
}
`,
  },
  {
    rel: 'analytics/ReportHandoffBuilder.java',
    content: `package org.dromara.yuqing.analytics;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 报告交接包构建器（F-009 验收标准 7，纯函数）
 *
 * <p>正文用 Markdown 而非 HTML：微信图文与 Word 都能吃 Markdown 片段，
 * 而内联样式的 HTML 在两边都会渲染成灾难。也刻意不用代码块与反引号 ——
 * 本项目的生成器对反引号有硬性拦截（三层转义约定），产物里出现反引号
 * 迟早会有人在改生成器时把它漏出去。</p>
 *
 * @author ruoyi
 */
public final class ReportHandoffBuilder {

    /**
     * 由看板视图构建报告章节
     *
     * @param view        看板视图
     * @param sourceBatch 来源批次号
     * @return 报告章节包
     */
    public static ReportSection build(DashboardView view, String sourceBatch) {
        ReportSection s = new ReportSection();
        s.setGeneratedAt(LocalDateTime.now());
        s.setSourceBatch(sourceBatch);
        if (view == null) {
            s.setMarkdown("## 数据分析\\n\\n暂无可用数据。");
            return s;
        }
        s.setConclusion(view.getConclusion());
        s.setPlatform(view.getPlatform());
        s.setTrend(view.getTrend());
        s.setHot(view.getHot());
        s.setDataUntil(view.getBatch() == null ? null : view.getBatch().getDataUntil());
        s.setScopeText(scopeText(view));
        s.setMetrics(metrics(view));
        s.setMarkdown(markdown(view));
        return s;
    }

    private static String scopeText(DashboardView v) {
        StringBuilder sb = new StringBuilder();
        sb.append(v.getDateFrom()).append(" 至 ").append(v.getDateTo());
        if (v.getScope() != null) {
            if (v.getScope().getTaskId() != null) {
                sb.append("，任务 #").append(v.getScope().getTaskId());
            }
            if (v.getScope().getChannelId() != null) {
                sb.append("，渠道 #").append(v.getScope().getChannelId());
            }
            if (v.getScope().getSentiAttr() != null) {
                sb.append("，属性 ").append(DimLabels.senti(v.getScope().getSentiAttr()));
            }
            if (v.getScope().getRiskLevel() != null) {
                sb.append("，风险 ").append(DimLabels.risk(v.getScope().getRiskLevel()));
            }
        }
        return sb.toString();
    }

    private static java.util.Map<String, Object> metrics(DashboardView v) {
        java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
        TotalsView t = v.getTotals();
        if (t == null) {
            return m;
        }
        m.put("totalCount", t.getTotalCount());
        m.put("positiveCount", t.getPositiveCount());
        m.put("neutralCount", t.getNeutralCount());
        m.put("negativeCount", t.getNegativeCount());
        m.put("negativeRate", t.getNegativeRate());
        m.put("highRiskCount", t.getHighRiskCount());
        m.put("readSum", t.getReadSum());
        m.put("commentSum", t.getCommentSum());
        m.put("shareSum", t.getShareSum());
        m.put("likeSum", t.getLikeSum());
        m.put("interactionSum", t.getInteractionSum());
        m.put("avgHeatScore", t.getAvgHeatScore());
        m.put("dateFrom", String.valueOf(v.getDateFrom()));
        m.put("dateTo", String.valueOf(v.getDateTo()));
        m.put("trendBase", v.getTrendBase());
        if (v.getBatch() != null) {
            m.put("dataUntil", String.valueOf(v.getBatch().getDataUntil()));
            m.put("sourceBatch", v.getBatch().getBatchNo());
        }
        return m;
    }

    private static String markdown(DashboardView v) {
        StringBuilder sb = new StringBuilder();
        TotalsView t = v.getTotals();
        sb.append("## 数据分析").append(NL);
        sb.append(NL);
        sb.append("统计范围：").append(scopeText(v)).append(NL);
        sb.append(NL);
        if (t == null || t.getTotalCount() == null || t.getTotalCount() == 0) {
            sb.append("统计范围内无有效舆情数据。").append(NL);
            return sb.toString();
        }

        sb.append("### 一、总体态势").append(NL);
        sb.append(NL);
        sb.append("- 舆情总量：").append(t.getTotalCount()).append(" 条").append(NL);
        sb.append("- 属性分布：正面 ").append(t.getPositiveCount()).append(" 条（").append(t.getPositiveRate())
            .append("%）、中性 ").append(t.getNeutralCount()).append(" 条（").append(t.getNeutralRate())
            .append("%）、负面 ").append(t.getNegativeCount()).append(" 条（").append(t.getNegativeRate())
            .append("%）").append(NL);
        sb.append("- 严重级风险：").append(t.getHighRiskCount()).append(" 条").append(NL);
        sb.append("- 互动总量：").append(t.getInteractionSum()).append("（阅读 ").append(t.getReadSum())
            .append(" / 评论 ").append(t.getCommentSum())
            .append(" / 转发 ").append(t.getShareSum())
            .append(" / 点赞 ").append(t.getLikeSum()).append("）").append(NL);
        sb.append(NL);

        sb.append("### 二、平台分布").append(NL);
        sb.append(NL);
        sb.append("| 平台 | 条数 | 占比 | 负面占比 |").append(NL);
        sb.append("| --- | --- | --- | --- |").append(NL);
        for (DimItem it : top(v.getPlatform(), 8)) {
            sb.append("| ").append(it.getDimLabel()).append(" | ").append(it.getOpinionCount())
                .append(" | ").append(it.getShare()).append("% | ").append(it.getNegativeRate())
                .append("% |").append(NL);
        }
        sb.append(NL);

        sb.append("### 三、地域分布").append(NL);
        sb.append(NL);
        sb.append("| 地域 | 条数 | 占比 | 负面占比 |").append(NL);
        sb.append("| --- | --- | --- | --- |").append(NL);
        for (DimItem it : top(v.getRegion(), 8)) {
            sb.append("| ").append(it.getDimLabel()).append(" | ").append(it.getOpinionCount())
                .append(" | ").append(it.getShare()).append("% | ").append(it.getNegativeRate())
                .append("% |").append(NL);
        }
        sb.append(NL);

        sb.append("### 四、话题分布").append(NL);
        sb.append(NL);
        sb.append("| 话题 | 条数 | 占比 | 负面占比 |").append(NL);
        sb.append("| --- | --- | --- | --- |").append(NL);
        for (DimItem it : top(v.getTopic(), 8)) {
            sb.append("| ").append(it.getDimLabel()).append(" | ").append(it.getOpinionCount())
                .append(" | ").append(it.getShare()).append("% | ").append(it.getNegativeRate())
                .append("% |").append(NL);
        }
        sb.append(NL);

        sb.append("### 五、传播趋势（粒度：").append(v.getGrain())
            .append("，按 ").append(v.getTrendBase()).append(" 归属）").append(NL);
        sb.append(NL);
        sb.append("| 时段 | 条数 | 占比 |").append(NL);
        sb.append("| --- | --- | --- |").append(NL);
        for (DimItem it : top(v.getTrend(), 24)) {
            sb.append("| ").append(it.getDimLabel()).append(" | ").append(it.getOpinionCount())
                .append(" | ").append(it.getShare()).append("% |").append(NL);
        }
        sb.append(NL);

        sb.append("### 六、热点舆情 TOP 排行（口径：").append(v.getRankBy()).append("）").append(NL);
        sb.append(NL);
        sb.append("| 名次 | 标题 | 平台 | 阅读 | 转发 | 评论 | 热度 |").append(NL);
        sb.append("| --- | --- | --- | --- | --- | --- | --- |").append(NL);
        for (HotItem it : topHot(v.getHot(), 10)) {
            sb.append("| ").append(it.getRankNo()).append(" | ").append(oneLine(it.getTitle()))
                .append(" | ").append(it.getChannelName()).append(" | ").append(it.getReadCount())
                .append(" | ").append(it.getShareCount()).append(" | ").append(it.getCommentCount())
                .append(" | ").append(it.getHeatScore()).append(" |").append(NL);
        }
        sb.append(NL);

        sb.append("### 七、分析结论").append(NL);
        sb.append(NL);
        AnalysisConclusion c = v.getConclusion();
        if (c == null) {
            sb.append("未生成分析结论。").append(NL);
        } else {
            for (String line : c.getNarrative()) {
                sb.append("- ").append(line).append(NL);
            }
            if (!c.getCoreEvents().isEmpty()) {
                sb.append(NL).append("核心事件：").append(NL);
                for (CoreEvent ev : c.getCoreEvents()) {
                    sb.append("- ").append(oneLine(ev.getTitle())).append("（").append(ev.getOpinionCount())
                        .append(" 条，负面 ").append(ev.getNegativeRate()).append("%）").append(NL);
                }
            }
            if (!c.getRiskPoints().isEmpty()) {
                sb.append(NL).append("风险提示：").append(NL);
                for (RiskPoint r : c.getRiskPoints()) {
                    sb.append("- ").append(r.getType()).append("：").append(r.getDetail()).append(NL);
                }
            }
        }
        if (v.getBatch() != null && v.getBatch().getDataUntil() != null) {
            sb.append(NL).append("> 数据截止时间：").append(v.getBatch().getDataUntil())
                .append("（批次 ").append(v.getBatch().getBatchNo()).append("）").append(NL);
        }
        return sb.toString();
    }

    private static final String NL = "\\n";

    private static List<DimItem> top(List<DimItem> list, int n) {
        if (list == null) {
            return new ArrayList<>();
        }
        return list.size() <= n ? list : new ArrayList<>(list.subList(0, n));
    }

    private static List<HotItem> topHot(List<HotItem> list, int n) {
        if (list == null) {
            return new ArrayList<>();
        }
        return list.size() <= n ? list : new ArrayList<>(list.subList(0, n));
    }

    /** 表格单元格里不能出现换行与竖线，否则整行表格错列 */
    private static String oneLine(String v) {
        if (v == null || v.isBlank()) {
            return "—";
        }
        String s = v.replace('|', '/').replace('\\r', ' ').replace('\\n', ' ');
        return s.length() > 40 ? s.substring(0, 40) + "…" : s;
    }

    private ReportHandoffBuilder() {
    }
}
`,
  },
  {
    rel: 'analytics/StatsExportRow.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;

/**
 * 看板导出的一行（F-009 验收标准 10）
 *
 * <p><b>为什么导出用「长表」而不是「七个 sheet」：</b>
 * 当前框架的导出构造器一次只写一个 sheet，要拼多 sheet 得走模板导出；
 * 长表（区块 / 维度 / 取值 / 数值 / 占比）用一份数据就能承载七类指标，
 * 下游做透视表反而比多 sheet 更顺手。真要拆 sheet 时，按「区块」列过滤即可。</p>
 *
 * @author ruoyi
 */
@Data
@ExcelIgnoreUnannotated
public class StatsExportRow {

    /** 指标区块：总量 / 平台分布 / 地域分布 / 话题分布 / 属性分布 / 趋势 / 热点排行 */
    @ExcelProperty(value = "指标区块")
    private String block;

    /** 维度（长表内再分一层，如「互动量」下有阅读/评论/转发/点赞） */
    @ExcelProperty(value = "维度")
    private String dimension;

    /** 取值 */
    @ExcelProperty(value = "取值")
    private String itemKey;

    /** 数值 */
    @ExcelProperty(value = "数值")
    private Long value;

    /** 占比（%），无占比语义时为空 */
    @ExcelProperty(value = "占比(%)")
    private Double share;

    /** 附加说明 */
    @ExcelProperty(value = "说明")
    private String remark;
}
`,
  },
  {
    rel: 'analytics/StatsExportBuilder.java',
    content: `package org.dromara.yuqing.analytics;

import java.util.ArrayList;
import java.util.List;

/**
 * 看板导出数据构建器（F-009 验收标准 10，纯函数）
 *
 * @author ruoyi
 */
public final class StatsExportBuilder {

    /**
     * 构建导出行
     *
     * @param v    看板视图
     * @param maxRows 最大行数（超出截断，防止把内存导爆）
     * @return 导出行列表
     */
    public static List<StatsExportRow> build(DashboardView v, int maxRows) {
        List<StatsExportRow> rows = new ArrayList<>();
        if (v == null) {
            return rows;
        }
        TotalsView t = v.getTotals();
        if (t != null) {
            add(rows, "总量", "舆情总量", "全部", num(t.getTotalCount()), 100D, "");
            add(rows, "总量", "正面", "positive", num(t.getPositiveCount()), t.getPositiveRate(),
                DimLabels.senti("positive"));
            add(rows, "总量", "中性", "neutral", num(t.getNeutralCount()), t.getNeutralRate(),
                DimLabels.senti("neutral"));
            add(rows, "总量", "负面", "negative", num(t.getNegativeCount()), t.getNegativeRate(),
                DimLabels.senti("negative"));
            add(rows, "总量", "严重级", "severe", num(t.getHighRiskCount()), null, "风险等级=severe");
            add(rows, "互动量", "阅读量", "read", t.getReadSum(), null, "");
            add(rows, "互动量", "评论量", "comment", t.getCommentSum(), null, "");
            add(rows, "互动量", "转发量", "share", t.getShareSum(), null, "");
            add(rows, "互动量", "点赞量", "like", t.getLikeSum(), null, "");
            add(rows, "互动量", "互动合计", "interaction", t.getInteractionSum(), null, "阅读+评论+转发+点赞");
            add(rows, "流程量", "去重剔除", "dup", num(t.getDupCount()), null, "来自采集批次");
            add(rows, "流程量", "降噪剔除", "rejected", num(t.getRejectedCount()), null, "来自采集批次");
            add(rows, "流程量", "预警条数", "alert", num(t.getAlertCount()), null, "");
            add(rows, "流程量", "推送条数", "push", num(t.getPushCount()), null, "");
        }
        dimBlock(rows, "平台分布", v.getPlatform());
        dimBlock(rows, "地域分布", v.getRegion());
        dimBlock(rows, "话题分布", v.getTopic());
        dimBlock(rows, "属性分布", v.getSenti());
        dimBlock(rows, "风险分布", v.getRisk());
        dimBlock(rows, "分级分布", v.getLevel());
        dimBlock(rows, "传播量级分布", v.getSpread());
        dimBlock(rows, "传播趋势(" + v.getGrain() + ")", v.getTrend());
        if (v.getHot() != null) {
            for (HotItem it : v.getHot()) {
                add(rows, "热点排行", "第 " + it.getRankNo() + " 名", String.valueOf(it.getOpinionId()),
                    it.getHeatScore() == null ? null : it.getHeatScore().longValue(), null,
                    oneLine(it.getTitle()) + " | " + nvl(it.getChannelName()) + " | 阅读 " + nz(it.getReadCount())
                        + " 转发 " + nz(it.getShareCount()) + " 评论 " + nz(it.getCommentCount()));
            }
        }
        if (v.getBatch() != null) {
            add(rows, "元信息", "数据截止时间", "dataUntil", null, null,
                String.valueOf(v.getBatch().getDataUntil()));
            add(rows, "元信息", "来源批次", "batchNo", null, null, nvl(v.getBatch().getBatchNo()));
            add(rows, "元信息", "统计范围", "scope", null, null,
                String.valueOf(v.getDateFrom()) + " ~ " + String.valueOf(v.getDateTo()));
            add(rows, "元信息", "趋势归属", "trendBase", null, null,
                nvl(v.getTrendBase()) + "，粒度 " + nvl(v.getGrain()));
        }
        int cap = maxRows <= 0 ? 20000 : maxRows;
        return rows.size() <= cap ? rows : new ArrayList<>(rows.subList(0, cap));
    }

    private static void dimBlock(List<StatsExportRow> rows, String block, List<DimItem> items) {
        if (items == null) {
            return;
        }
        for (DimItem it : items) {
            add(rows, block, "条数", it.getDimKey(), num(it.getOpinionCount()), it.getShare(),
                it.getDimLabel());
        }
    }

    private static void add(List<StatsExportRow> rows, String block, String dimension, String key,
                            Long value, Double share, String remark) {
        StatsExportRow r = new StatsExportRow();
        r.setBlock(block);
        r.setDimension(dimension);
        r.setItemKey(key);
        r.setValue(value);
        r.setShare(share);
        r.setRemark(remark);
        rows.add(r);
    }

    private static Long num(Integer v) {
        return v == null ? 0L : v.longValue();
    }

    private static long nz(Long v) {
        return v == null ? 0L : v;
    }

    private static String nvl(String v) {
        return v == null ? "" : v;
    }

    private static String oneLine(String v) {
        if (v == null) {
            return "";
        }
        return v.replace('|', '/').replace('\\r', ' ').replace('\\n', ' ');
    }

    private StatsExportBuilder() {
    }
}
`,
  },
];
