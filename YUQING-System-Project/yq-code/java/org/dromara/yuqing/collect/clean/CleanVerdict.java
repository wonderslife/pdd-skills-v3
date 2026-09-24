package org.dromara.yuqing.collect.clean;

/**
 * 单条舆情的净化结论（F-006 验收标准 5 的三态）。
 *
 * @author ruoyi
 */
public final class CleanVerdict {

    /** 清洗状态取值，与字典 yq_clean_status 一致 */
    public static final String RAW = "raw";

    public static final String CLEANED = "cleaned";

    public static final String REJECTED = "rejected";

    private final String cleanStatus;

    private final NoiseCategory category;

    private final String noiseReason;

    private final Long ruleId;

    private final String purifiedTitle;

    private final String purifiedContent;

    private CleanVerdict(String cleanStatus, NoiseCategory category, String noiseReason, Long ruleId,
                         String purifiedTitle, String purifiedContent) {
        this.cleanStatus = cleanStatus;
        this.category = category;
        this.noiseReason = noiseReason;
        this.ruleId = ruleId;
        this.purifiedTitle = purifiedTitle;
        this.purifiedContent = purifiedContent;
    }

    /**
     * 通过净化，保留。
     *
     * @param title   净化后标题
     * @param content 净化后正文
     * @return 结论
     */
    public static CleanVerdict accept(String title, String content) {
        return new CleanVerdict(CLEANED, null, null, null, title, content);
    }

    /**
     * 命中降噪，剔除。
     *
     * @param hit     命中记录
     * @param title   净化后标题（保留下来便于人工复核为什么被剔）
     * @param content 净化后正文
     * @return 结论
     */
    public static CleanVerdict reject(NoiseHit hit, String title, String content) {
        return new CleanVerdict(REJECTED, hit.getCategory(), hit.persistReason(), hit.getRuleId(), title, content);
    }

    public String getCleanStatus() {
        return cleanStatus;
    }

    public NoiseCategory getCategory() {
        return category;
    }

    public String getNoiseReason() {
        return noiseReason;
    }

    public Long getRuleId() {
        return ruleId;
    }

    public String getPurifiedTitle() {
        return purifiedTitle;
    }

    public String getPurifiedContent() {
        return purifiedContent;
    }

    /**
     * 是否被剔除。
     *
     * @return true 表示判为低价值数据，不进入研判流程
     */
    public boolean isRejected() {
        return REJECTED.equals(cleanStatus);
    }
}
