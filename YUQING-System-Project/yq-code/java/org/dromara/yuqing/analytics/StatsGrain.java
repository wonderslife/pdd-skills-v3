package org.dromara.yuqing.analytics;

/**
 * 趋势曲线时间粒度（F-009 验收标准 4）
 *
 * <p>三种粒度在**聚合阶段就已物化**（{@code yq_stats_dim.time_grain}），
 * 看板切换粒度只是换一个等值条件，查询成本恒定，不会退化成实时 GROUP BY。</p>
 *
 * @author ruoyi
 */
public enum StatsGrain {

    /** 小时 */
    HOUR("hour", "小时"),

    /** 日 */
    DAY("day", "日"),

    /** 周（ISO 周，周一为一周起点） */
    WEEK("week", "周");

    private final String code;

    private final String label;

    StatsGrain(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }

    /**
     * 宽松解析：非法值回落 {@link #DAY}
     *
     * <p>看板不应因为前端传了错粒度就 500，回落并继续出图更符合运维预期。</p>
     */
    public static StatsGrain of(String v) {
        if (v == null || v.isBlank()) {
            return DAY;
        }
        String s = v.trim().toLowerCase();
        for (StatsGrain g : values()) {
            if (g.code.equals(s)) {
                return g;
            }
        }
        return DAY;
    }
}
