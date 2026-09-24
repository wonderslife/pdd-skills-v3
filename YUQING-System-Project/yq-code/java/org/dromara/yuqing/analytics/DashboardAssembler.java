package org.dromara.yuqing.analytics;

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
