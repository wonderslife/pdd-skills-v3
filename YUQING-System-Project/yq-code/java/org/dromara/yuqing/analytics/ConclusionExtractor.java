package org.dromara.yuqing.analytics;

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
