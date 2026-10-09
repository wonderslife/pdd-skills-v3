package org.dromara.yuqing.analytics;

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
        return v.replace('|', '/').replace('\r', ' ').replace('\n', ' ');
    }

    private StatsExportBuilder() {
    }
}
