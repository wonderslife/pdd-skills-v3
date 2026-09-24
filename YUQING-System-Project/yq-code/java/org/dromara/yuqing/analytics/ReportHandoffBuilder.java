package org.dromara.yuqing.analytics;

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
            s.setMarkdown("## 数据分析\n\n暂无可用数据。");
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

    private static final String NL = "\n";

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
        String s = v.replace('|', '/').replace('\r', ' ').replace('\n', ' ');
        return s.length() > 40 ? s.substring(0, 40) + "…" : s;
    }

    private ReportHandoffBuilder() {
    }
}
