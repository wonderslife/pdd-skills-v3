package org.dromara.yuqing.alert;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 突发增量判定器（F-010 验收标准 1 之 {@code burst_increment}）
 *
 * <p>口径：把当前窗口之前 {@code baselineWindows} 个同长度窗口的条数取算术平均作为基线，
 * 当前窗口条数与基线之比即增量倍数。同时要求当前窗口条数达到 {@code minBurstCount} 下限，
 * 避免「0 → 2 条」被算成无限倍而误报。</p>
 *
 * <pre>
 *   时间轴  ──►
 *   | w-N | ... | w-2 | w-1 | 当前窗口 |
 *              ↑ 基线 = 均值            ↑ cur
 * </pre>
 *
 * @author ruoyi
 */
public final class BurstDetector {

    private BurstDetector() {
    }

    /**
     * 判定指定任务是否出现突发增量
     *
     * @param source      计数来源
     * @param taskId      任务（为空表示全站口径）
     * @param now         当前时刻（窗口右开边界）
     * @param windowMin   窗口长度（分钟）
     * @param baselineN   基线窗口数
     * @param burstRatio  倍数阈值
     * @param minCount    当前窗口条数下限
     * @return 判定结果（含实际值，便于写入 {@code trigger_value} 留痕）
     */
    public static BurstOutcome detect(AlertCountSource source, Long taskId, LocalDateTime now,
                                      int windowMin, int baselineN, double burstRatio, int minCount) {
        int w = windowMin > 0 ? windowMin : 10;
        int n = baselineN > 0 ? baselineN : 7;
        LocalDateTime curEnd = now;
        LocalDateTime curStart = now.minusMinutes(w);

        long cur = source.count(taskId, null, null, curStart, curEnd);
        if (cur < minCount) {
            return new BurstOutcome(false, cur, 0.0d, burstRatio, minCount, "当前窗口 " + cur + " 条，低于下限 " + minCount);
        }

        long sum = 0L;
        for (int i = 1; i <= n; i++) {
            LocalDateTime end = now.minusMinutes((long) w * i);
            LocalDateTime start = end.minusMinutes(w);
            sum += source.count(taskId, null, null, start, end);
        }
        double baseline = sum / (double) n;
        double ratio = cur / Math.max(baseline, 1.0d);
        boolean hit = ratio >= burstRatio;
        return new BurstOutcome(hit, cur, ratio, burstRatio, minCount,
            "当前窗口 " + cur + " 条 / 基线 " + String.format("%.2f", baseline) + " 条 = " + String.format("%.2f", ratio) + " 倍");
    }

    /** 突发增量判定结果 */
    @Data
    public static class BurstOutcome {

        private final boolean hit;
        /** 当前窗口条数 */
        private final long currentCount;
        /** 实际增量倍数 */
        private final double ratio;
        /** 阈值倍数 */
        private final double thresholdRatio;
        /** 条数下限 */
        private final int minCount;
        /** 人类可读的触发值描述，直接落 trigger_value */
        private final String description;

        public BurstOutcome(boolean hit, long currentCount, double ratio, double thresholdRatio,
                            int minCount, String description) {
            this.hit = hit;
            this.currentCount = currentCount;
            this.ratio = ratio;
            this.thresholdRatio = thresholdRatio;
            this.minCount = minCount;
            this.description = description;
        }
    }
}
