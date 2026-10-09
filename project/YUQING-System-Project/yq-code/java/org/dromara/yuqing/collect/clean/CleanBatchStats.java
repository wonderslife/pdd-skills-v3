package org.dromara.yuqing.collect.clean;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 一次净化批次的统计结果（F-006 验收标准 7：去重率与降噪剔除率）。
 *
 * @author ruoyi
 */
@Data
public class CleanBatchStats implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 批次ID（执行模式落库后回填） */
    private Long batchId;

    /** 批次名称 */
    private String batchName;

    /** 扫描条数 */
    private int totalCount;

    /** 净化保留条数 */
    private int cleanedCount;

    /** 降噪剔除条数 */
    private int rejectedCount;

    /** 链接去重条数 */
    private int dupCount;

    /** 跨渠道重复条数 */
    private int dupChannelCount;

    /** 按七类降噪类别的剔除量（台账按原因统计的数据源） */
    private final Map<String, Integer> byCategory = new LinkedHashMap<>();

    /** 是否只预览未落库 */
    private boolean previewOnly = true;

    /** 耗时（毫秒） */
    private long costMs;

    /** 失败原因（执行模式才有值） */
    private String failReason;

    public CleanBatchStats() {
        for (NoiseCategory c : NoiseCategory.values()) {
            byCategory.put(c.code(), 0);
        }
    }

    /**
     * 累加一次降噪剔除。
     *
     * @param category 降噪类别；为空时归入 spam
     */
    public void incRejected(NoiseCategory category) {
        String key = category == null ? NoiseCategory.SPAM.code() : category.code();
        byCategory.merge(key, 1, Integer::sum);
        rejectedCount++;
    }

    /**
     * 取某一类别的剔除量。
     *
     * @param category 类别
     * @return 条数
     */
    public int countOf(NoiseCategory category) {
        return byCategory.getOrDefault(category.code(), 0);
    }

    /**
     * 去重率（%）：被判重复的条数占扫描条数的比例。
     *
     * @return 百分比，保留两位；扫描条数为 0 时返回 0
     */
    public BigDecimal dupRate() {
        return rate(dupCount);
    }

    /**
     * 降噪剔除率（%）：剔除条数占扫描条数的比例。
     *
     * @return 百分比，保留两位；扫描条数为 0 时返回 0
     */
    public BigDecimal rejectRate() {
        return rate(rejectedCount);
    }

    private BigDecimal rate(int n) {
        if (totalCount <= 0) {
            return BigDecimal.ZERO.setScale(2);
        }
        return BigDecimal.valueOf(n * 100L)
            .divide(BigDecimal.valueOf(totalCount), 2, RoundingMode.HALF_UP);
    }

    /**
     * 一行摘要，便于写日志与批次备注。
     *
     * @return 摘要串
     */
    public String summary() {
        return "扫描 " + totalCount + " 条：保留 " + cleanedCount + " / 剔除 " + rejectedCount
            + " / 重复 " + dupCount + "（跨渠道 " + dupChannelCount + "）"
            + "，去重率 " + dupRate() + "%、降噪率 " + rejectRate() + "%";
    }
}
