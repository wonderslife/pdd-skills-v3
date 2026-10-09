package org.dromara.yuqing.analytics;

import java.util.List;

/**
 * 维度类型
 *
 * <p>前七个是 F-009 验收标准 1 要求展示的「分布类」指标；
 * {@link #TREND} 是第八个——它不是分布，而是**趋势曲线的载体**：
 * 把时间桶也塞进同一张长表，趋势与分布共用一套读写路径，
 * 少一张表、少一套代码，且天然享受同一个 Unique Key 幂等语义。</p>
 *
 * @author ruoyi
 */
public enum DimType {

    /** 平台（渠道）分布 */
    CHANNEL("channel", "平台分布"),

    /** 地域分布 */
    REGION("region", "地域分布"),

    /** 话题分布 */
    TOPIC("topic", "话题分布"),

    /** 舆情属性分布（正/中/负） */
    SENTI("senti", "舆情属性分布"),

    /** 风险等级分布 */
    RISK("risk", "风险等级分布"),

    /** 舆情分级分布 */
    LEVEL("level", "舆情分级分布"),

    /** 传播量级分布 */
    SPREAD("spread", "传播量级分布"),

    /** 传播趋势（dim_key 为时间桶标识，按 time_grain 区分小时/日/周） */
    TREND("trend", "传播趋势");

    private final String code;

    private final String label;

    DimType(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }

    /** 七个分布类维度（看板卡片，不含趋势） */
    public static List<DimType> distributions() {
        return List.of(CHANNEL, REGION, TOPIC, SENTI, RISK, LEVEL, SPREAD);
    }

    /** 宽松解析，未知值返回 {@code null}（调用方据此判 400，不做静默兜底到某个维度） */
    public static DimType of(String v) {
        if (v == null || v.isBlank()) {
            return null;
        }
        String s = v.trim().toLowerCase();
        for (DimType t : values()) {
            if (t.code.equals(s)) {
                return t;
            }
        }
        return null;
    }
}
