package org.dromara.yuqing.analytics;

import java.util.Map;

/**
 * 维度取值的中文展示名
 *
 * <p>取值来自 {@code yq_dict.sql} 的四个字典（yq_senti_attr / yq_risk_level /
 * yq_opinion_level / yq_spread_level）。这里做一份引擎内映射，原因是
 * **聚合任务跑在定时线程里，拿不到 HttpServletRequest，也就读不到字典缓存**；
 * 若只在查询期翻译，预聚合表的 dim_label 就得每次 join 字典，不划算。</p>
 *
 * <p>未知取值原样返回，不吞成「其他」—— 看到英文原值才知道是脏数据。</p>
 *
 * @author ruoyi
 */
public final class DimLabels {

    private static final Map<String, String> SENTI = Map.of(
        "positive", "正面",
        "neutral", "中性",
        "negative", "负面");

    private static final Map<String, String> RISK = Map.of(
        "general", "一般",
        "moderate", "较重",
        "severe", "严重");

    private static final Map<String, String> LEVEL = Map.of(
        "normal", "一般",
        "attention", "关注",
        "warning", "预警",
        "urgent", "紧急");

    private static final Map<String, String> SPREAD = Map.of(
        "low", "低",
        "medium", "中",
        "high", "高",
        "viral", "爆");

    /** 舆情属性中文名 */
    public static String senti(String code) {
        return pick(SENTI, code);
    }

    /** 风险等级中文名 */
    public static String risk(String code) {
        return pick(RISK, code);
    }

    /** 舆情分级中文名 */
    public static String level(String code) {
        return pick(LEVEL, code);
    }

    /** 传播量级中文名 */
    public static String spread(String code) {
        return pick(SPREAD, code);
    }

    /** 按维度类型翻译取值 */
    public static String of(DimType type, String code) {
        if (type == null || code == null) {
            return code;
        }
        switch (type) {
            case SENTI:
                return senti(code);
            case RISK:
                return risk(code);
            case LEVEL:
                return level(code);
            case SPREAD:
                return spread(code);
            default:
                return code;
        }
    }

    private static String pick(Map<String, String> m, String code) {
        if (code == null || code.isBlank()) {
            return "未标注";
        }
        String hit = m.get(code);
        return hit == null ? code : hit;
    }

    private DimLabels() {
    }
}
