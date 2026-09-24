package org.dromara.yuqing.collect.clean;

/**
 * 一次降噪判定结果（F-006 验收标准 3：记录剔除原因，支持按原因统计剔除量）。
 *
 * @author ruoyi
 */
public final class NoiseHit {

    private final NoiseCategory category;

    private final Long ruleId;

    private final String ruleName;

    private final String reason;

    private NoiseHit(NoiseCategory category, Long ruleId, String ruleName, String reason) {
        this.category = category;
        this.ruleId = ruleId;
        this.ruleName = ruleName;
        this.reason = reason;
    }

    /**
     * 构造一次命中。
     *
     * @param category 降噪类别
     * @param ruleId   命中规则ID（内置判定为 null）
     * @param ruleName 命中规则名
     * @param reason   人类可读原因（会落 yq_opinion.noise_reason）
     * @return 命中记录
     */
    public static NoiseHit of(NoiseCategory category, Long ruleId, String ruleName, String reason) {
        return new NoiseHit(category, ruleId, ruleName, reason);
    }

    public NoiseCategory getCategory() {
        return category;
    }

    public Long getRuleId() {
        return ruleId;
    }

    public String getRuleName() {
        return ruleName;
    }

    public String getReason() {
        return reason;
    }

    /**
     * 落库的剔除原因：类别编码 + 具体依据，便于台账按原因下钻。
     *
     * @return 原因串（不超过 200 字符，对齐 yq_opinion.noise_reason 列宽）
     */
    public String persistReason() {
        String base = category.label() + "(" + category.code() + ")";
        if (reason == null || reason.isEmpty()) {
            return base;
        }
        String merged = base + ": " + reason;
        return merged.length() > 200 ? merged.substring(0, 200) : merged;
    }
}
