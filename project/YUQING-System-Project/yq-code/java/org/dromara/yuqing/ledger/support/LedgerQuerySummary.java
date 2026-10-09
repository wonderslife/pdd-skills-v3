package org.dromara.yuqing.ledger.support;

import org.dromara.yuqing.ledger.domain.LedgerQuery;

import java.util.ArrayList;
import java.util.List;

/**
 * 筛选条件可读摘要（F-016 验收标准 10）
 *
 * <p>验收标准 10 要求导出审计记录「导出人、时间、条件、条数」。
 * 「条件」若只存一段 JSON，事后审计要自己解析还看不懂；
 * 因此同时落一份人可读摘要（本类产出）与一份原始 JSON
 * （供将来做条件回放）。</p>
 *
 * <p>本类同时是导出文件名的构成部分，让下载下来的 xlsx 自带语境。</p>
 *
 * @author ruoyi
 */
public final class LedgerQuerySummary {

    private LedgerQuerySummary() {
    }

    /**
     * 生成摘要，形如：
     * {@code 采集时间:2026-09-01~2026-09-23 | 任务:123 | 属性:negative | 关键词:医美}
     *
     * <p>无任何条件时返回「全部数据」，而不是空串 ——
     * 空串在审计表里无法区分「没筛条件」与「记录写坏了」。</p>
     */
    public static String summarize(LedgerQuery q) {
        if (q == null) {
            return "全部数据";
        }
        List<String> parts = new ArrayList<>();
        String cr = range(q.getCollectBeginTime(), q.getCollectEndTime());
        if (cr != null) {
            parts.add("采集时间:" + cr);
        }
        String pr = range(q.getPublishBeginTime(), q.getPublishEndTime());
        if (pr != null) {
            parts.add("发布时间:" + pr);
        }
        add(parts, "任务", q.getTaskId());
        add(parts, "渠道", q.getChannelId());
        add(parts, "事件", q.getClusterId());
        addText(parts, "属性", q.getSentiAttr());
        addText(parts, "风险", q.getRiskLevel());
        addText(parts, "分级", q.getOpinionLevel());
        addText(parts, "传播量级", q.getSpreadLevel());
        addText(parts, "采集来源", q.getCollectSource());
        addText(parts, "清洗状态", q.getCleanStatus());
        addText(parts, "研判状态", q.getAnalyzeStatus());
        if (q.getTagIds() != null && !q.getTagIds().isEmpty()) {
            parts.add("标签:" + q.getTagIds().size() + "个");
        }
        addText(parts, "关键词", q.getKeyword());
        if ("1".equals(q.getAlertFlag())) {
            parts.add("仅看已预警");
        }
        if (parts.isEmpty()) {
            return "全部数据";
        }
        return String.join(" | ", parts);
    }

    /**
     * 由摘要生成安全的文件名片段（去掉不适合做文件名的字符）。
     *
     * <p>Windows 文件名禁止 {@code \ / : * ? " &lt; &gt; |}，
     * 且长度有限 —— 摘要里含时间与中文，直接当文件名会在下载时失败或截断。</p>
     */
    public static String toFileTag(LedgerQuery q) {
        String s = summarize(q);
        String illegal = "\\/:*?\"<>|";
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (illegal.indexOf(c) >= 0) {
                sb.append('_');
            } else if (c == ' ') {
                continue;
            } else {
                sb.append(c);
            }
        }
        String out = sb.toString();
        return out.length() <= 60 ? out : out.substring(0, 60);
    }

    private static String range(String begin, String end) {
        boolean b = begin != null && !begin.isBlank();
        boolean e = end != null && !end.isBlank();
        if (!b && !e) {
            return null;
        }
        return (b ? begin.trim() : "*") + "~" + (e ? end.trim() : "*");
    }

    private static void add(List<String> parts, String label, Object v) {
        if (v != null) {
            parts.add(label + ":" + v);
        }
    }

    private static void addText(List<String> parts, String label, String v) {
        if (v != null && !v.isBlank()) {
            parts.add(label + ":" + v.trim());
        }
    }
}
