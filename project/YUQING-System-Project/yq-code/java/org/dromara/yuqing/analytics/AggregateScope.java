package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDate;

/**
 * 聚合 / 看板查询范围（F-009 验收标准 2 的多维筛选条件）
 *
 * <p>字段与验收标准 2 一一对应：时间范围、任务、渠道、舆情属性、风险等级，
 * 另外补了舆情分级与传播量级两个可选条件。</p>
 *
 * <p>{@link #normalized(int)} 负责把所有非法组合收敛成可执行范围 —— 校验只在
 * 这一处做，聚合任务与看板查询共用，避免两边口径漂移。</p>
 *
 * @author ruoyi
 */
@Data
public class AggregateScope {

    /** 起始统计日（含） */
    private LocalDate dateFrom;

    /** 截止统计日（含） */
    private LocalDate dateTo;

    /** 任务ID */
    private Long taskId;

    /** 渠道ID */
    private Long channelId;

    /** 舆情属性 */
    private String sentiAttr;

    /** 风险等级 */
    private String riskLevel;

    /** 舆情分级 */
    private String opinionLevel;

    /** 传播量级 */
    private String spreadLevel;

    /**
     * 归一化：补默认值、纠正倒置区间、按上限截断跨度
     *
     * @param maxScopeDays 允许的最大跨度（天）
     * @return 本对象自身（便于链式使用）
     */
    public AggregateScope normalized(int maxScopeDays) {
        LocalDate today = LocalDate.now();
        if (dateTo == null) {
            dateTo = today;
        }
        if (dateFrom == null) {
            dateFrom = dateTo.minusDays(6);
        }
        if (dateFrom.isAfter(dateTo)) {
            LocalDate tmp = dateFrom;
            dateFrom = dateTo;
            dateTo = tmp;
        }
        int limit = maxScopeDays <= 0 ? 366 : maxScopeDays;
        if (dateFrom.plusDays(limit - 1L).isBefore(dateTo)) {
            dateFrom = dateTo.minusDays(limit - 1L);
        }
        taskId = positiveOrNull(taskId);
        channelId = positiveOrNull(channelId);
        sentiAttr = blankToNull(sentiAttr);
        riskLevel = blankToNull(riskLevel);
        opinionLevel = blankToNull(opinionLevel);
        spreadLevel = blankToNull(spreadLevel);
        return this;
    }

    /** 跨度天数 */
    public int spanDays() {
        if (dateFrom == null || dateTo == null) {
            return 0;
        }
        return (int) (dateTo.toEpochDay() - dateFrom.toEpochDay()) + 1;
    }

    /** 是否只覆盖单一统计日（热点快照与批次台账据此判断粒度） */
    public boolean singleDay() {
        return dateFrom != null && dateFrom.equals(dateTo);
    }

    private static Long positiveOrNull(Long v) {
        return v == null || v <= 0L ? null : v;
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
