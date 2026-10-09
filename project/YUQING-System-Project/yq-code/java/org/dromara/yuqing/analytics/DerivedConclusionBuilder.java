package org.dromara.yuqing.analytics;

import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.analytics.config.YqAnalyticsProperties;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * 派生结论构建器
 *
 * <p><b>为什么需要它：</b>核心事件与传播路径必须从明细提炼，所以只有聚合任务
 * （明细在内存里的那一刻）才算得出来。可看板允许使用者自由改筛选条件，
 * 改完之后的组合几乎不可能正好等于某个历史批次。这时如果什么都不给，
 * 验收标准 5 的四类结论在看板上就有两块永远空着。</p>
 *
 * <p>于是分两条路：范围命中批次 → 用批次结论（{@code batch}）；
 * 否则用本类从预聚合数据推导（{@code derived}），给得出「舆论焦点」与「潜在风险点」，
 * 并在文字里说明核心事件与传播路径需要「按批次范围查看」。
 * <b>不硬凑</b>——宁可少两块，也不拿总量去编事件。</p>
 *
 * @author ruoyi
 */
@RequiredArgsConstructor
public class DerivedConclusionBuilder {

    private final YqAnalyticsProperties props;

    /**
     * 由预聚合结果推导结论
     *
     * @param view 已装配的看板视图（需要其中已填好的各维度卡片）
     * @return 结论（永远非空）
     */
    public AnalysisConclusion build(DashboardView view) {
        AnalysisConclusion c = new AnalysisConclusion();
        c.setGeneratedAt(LocalDateTime.now());
        TotalsView t = view == null ? null : view.getTotals();
        if (t == null || t.getTotalCount() == null || t.getTotalCount() == 0) {
            c.getNarrative().add("统计范围内无有效舆情数据。");
            c.setDurationHours(0L);
            c.setSpeedPerHour(0D);
            return c;
        }
        c.setClusterBased(false);
        c.setFocusPoints(focus(view));
        c.setRiskPoints(risks(view, t));
        peak(c, view);
        c.getNarrative().addAll(narrative(view, t, c));
        return c;
    }

    private List<FocusPoint> focus(DashboardView view) {
        List<FocusPoint> out = new ArrayList<>();
        out.addAll(convert(view.getTopic(), "topic"));
        out.addAll(convert(view.getRegion(), "region"));
        int cap = 10;
        return out.size() <= cap ? out : new ArrayList<>(out.subList(0, cap));
    }

    private List<FocusPoint> convert(List<DimItem> items, String kind) {
        List<FocusPoint> rows = new ArrayList<>();
        if (items == null) {
            return rows;
        }
        for (DimItem it : items) {
            FocusPoint p = new FocusPoint();
            p.setKind(kind);
            p.setKey(it.getDimKey());
            p.setLabel(it.getDimLabel());
            p.setOpinionCount(it.getOpinionCount());
            p.setShare(it.getShare());
            p.setNegativeRate(it.getNegativeRate());
            p.setHeatSum(it.getHeatSum());
            rows.add(p);
        }
        rows.sort(Comparator
            .comparingInt((FocusPoint p) -> p.getOpinionCount() == null ? 0 : p.getOpinionCount()).reversed()
            .thenComparing(p -> String.valueOf(p.getKey())));
        return rows.size() <= 5 ? rows : new ArrayList<>(rows.subList(0, 5));
    }

    private List<RiskPoint> risks(DashboardView view, TotalsView t) {
        List<RiskPoint> out = new ArrayList<>();
        int total = t.getTotalCount() == null ? 0 : t.getTotalCount();
        double negRate = t.getNegativeRate() == null ? 0D : t.getNegativeRate();
        if (negRate >= props.getRiskNegativeRate()) {
            double threshold = props.getRiskNegativeRate();
            RiskPoint r = new RiskPoint();
            r.setLevel(negRate >= threshold * 2D ? "high" : "medium");
            r.setType("负面占比偏高");
            r.setDetail("负面 " + t.getNegativeCount() + " 条，占总量 " + negRate + "%");
            r.setValue(negRate);
            r.setThreshold(threshold);
            out.add(r);
        }
        int severe = t.getHighRiskCount() == null ? 0 : t.getHighRiskCount();
        double severeRate = total == 0 ? 0D : DailyRow.round2(severe * 100D / total);
        if (severeRate >= props.getRiskSevereRate()) {
            RiskPoint r = new RiskPoint();
            r.setLevel(severeRate >= props.getRiskSevereRate() * 2D ? "high" : "medium");
            r.setType("高风险占比偏高");
            r.setDetail("严重级 " + severe + " 条，占总量 " + severeRate + "%");
            r.setValue(severeRate);
            r.setThreshold(props.getRiskSevereRate());
            out.add(r);
        }
        if (view.getTopic() != null) {
            for (DimItem it : view.getTopic()) {
                if (it.getNegativeRate() == null || it.getOpinionCount() == null) {
                    continue;
                }
                if (it.getNegativeRate() >= props.getRiskNegativeRate() + 20D && it.getOpinionCount() >= 3) {
                    RiskPoint r = new RiskPoint();
                    r.setLevel(it.getNegativeRate() >= 80D ? "high" : "medium");
                    r.setType("负面聚集话题");
                    r.setDetail("话题「" + it.getDimLabel() + "」共 " + it.getOpinionCount() + " 条，负面占 "
                        + it.getNegativeRate() + "%");
                    r.setValue(it.getNegativeRate());
                    r.setThreshold(props.getRiskNegativeRate() + 20D);
                    r.setTarget(it.getDimKey());
                    out.add(r);
                    break;
                }
            }
        }
        if (view.getTrend() != null && view.getTrend().size() >= 2) {
            int peak = 0;
            int sum = 0;
            String peakKey = null;
            for (DimItem it : view.getTrend()) {
                int n = it.getOpinionCount() == null ? 0 : it.getOpinionCount();
                sum += n;
                if (n > peak) {
                    peak = n;
                    peakKey = it.getDimKey();
                }
            }
            double avg = sum / (double) view.getTrend().size();
            double ratio = avg <= 0 ? 0D : DailyRow.round2(peak / avg);
            if (ratio >= 3D) {
                RiskPoint r = new RiskPoint();
                r.setLevel(ratio >= 5D ? "high" : "medium");
                r.setType("时段量突增");
                r.setDetail("峰值时段 " + peakKey + " 共 " + peak + " 条，为均值的 " + ratio + " 倍");
                r.setValue(ratio);
                r.setThreshold(3D);
                r.setTarget(peakKey);
                out.add(r);
            }
        }
        out.sort((a, b) -> {
            int c1 = Integer.compare(rank(b.getLevel()), rank(a.getLevel()));
            if (c1 != 0) {
                return c1;
            }
            return Double.compare(dbl(b.getValue()), dbl(a.getValue()));
        });
        return out.size() <= 5 ? out : new ArrayList<>(out.subList(0, 5));
    }

    private void peak(AnalysisConclusion c, DashboardView view) {
        String grain = view.getGrain();
        if (!StatsGrain.HOUR.getCode().equals(grain) || view.getTrend() == null) {
            return;
        }
        DimItem best = null;
        for (DimItem it : view.getTrend()) {
            if (best == null || nz(it.getOpinionCount()) > nz(best.getOpinionCount())) {
                best = it;
            }
        }
        if (best != null) {
            c.setPeakBucket(best.getDimKey());
            c.setPeakCount(best.getOpinionCount());
        }
    }

    private List<String> narrative(DashboardView view, TotalsView t, AnalysisConclusion c) {
        List<String> lines = new ArrayList<>();
        lines.add("统计范围内共采集舆情 " + t.getTotalCount() + " 条，其中正面 " + t.getPositiveCount()
            + " 条、中性 " + t.getNeutralCount() + " 条、负面 " + t.getNegativeCount()
            + " 条（负面占比 " + t.getNegativeRate() + "%）。");
        if (view.getPlatform() != null && !view.getPlatform().isEmpty()) {
            DimItem top = view.getPlatform().get(0);
            lines.add("主要来源平台为 " + top.getDimLabel() + "，共 " + top.getOpinionCount()
                + " 条，占本范围的 " + top.getShare() + "%。");
        }
        if (view.getRegion() != null && !view.getRegion().isEmpty()) {
            DimItem top = view.getRegion().get(0);
            lines.add("地域分布上 " + top.getDimLabel() + " 最集中，共 " + top.getOpinionCount()
                + " 条，占 " + top.getShare() + "%。");
        }
        if (cover(view.getTopic())) {
            DimItem top = view.getTopic().get(0);
            lines.add("舆论焦点集中在话题「" + top.getDimLabel() + "」，共 " + top.getOpinionCount()
                + " 条，负面占比 " + top.getNegativeRate() + "%。");
        }
        lines.add("互动数据：阅读 " + t.getReadSum() + "、评论 " + t.getCommentSum()
            + "、转发 " + t.getShareSum() + "、点赞 " + t.getLikeSum()
            + "，互动合计 " + t.getInteractionSum() + "。");
        if (c.getRiskPoints().isEmpty()) {
            lines.add("未触发潜在风险阈值。");
        } else {
            for (RiskPoint r : c.getRiskPoints()) {
                lines.add("风险[" + levelCn(r.getLevel()) + "] " + r.getType() + "：" + r.getDetail());
            }
        }
        lines.add("说明：当前筛选条件与最近一次聚合批次的范围不一致，因此本结论由预聚合数据推导，"
            + "不含「核心舆情事件」与「传播路径」——这两项需要按批次范围（通常是定时的整日范围）查看。");
        return lines;
    }

    private static boolean cover(List<DimItem> list) {
        return list != null && !list.isEmpty();
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }

    private static double dbl(Double v) {
        return v == null ? 0D : v;
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

    private static String levelCn(String level) {
        if ("high".equals(level)) {
            return "高";
        }
        if ("medium".equals(level)) {
            return "中";
        }
        return "低";
    }
}
