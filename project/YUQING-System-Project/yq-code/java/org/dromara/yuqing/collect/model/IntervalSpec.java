package org.dromara.yuqing.collect.model;

import java.util.ArrayList;
import java.util.List;

/**
 * 采集频率四档换算与校验（F-004 验收标准 2）。
 *
 * <p>支持秒级 / 分钟级 / 小时级 / 日级四档；校验采集间隔不低于「渠道限流下限」与「全局最小间隔」。</p>
 *
 * @author ruoyi
 */
public final class IntervalSpec {

    /** 秒级 */
    public static final String UNIT_SECOND = "s";
    /** 分钟级 */
    public static final String UNIT_MINUTE = "m";
    /** 小时级 */
    public static final String UNIT_HOUR = "h";
    /** 日级 */
    public static final String UNIT_DAY = "d";

    private static final int SEC_MINUTE = 60;
    private static final int SEC_HOUR = 3600;
    private static final int SEC_DAY = 86400;

    private IntervalSpec() {
    }

    /**
     * 档位换算为秒。
     *
     * @param value 数值，必须为正
     * @param unit  档位：s / m / h / d，为空按秒处理
     * @return 秒数；参数非法返回 -1
     */
    public static int toSeconds(int value, String unit) {
        if (value <= 0) {
            return -1;
        }
        String u = unit == null ? UNIT_SECOND : unit.trim().toLowerCase();
        return switch (u) {
            case UNIT_MINUTE -> value * SEC_MINUTE;
            case UNIT_HOUR -> value * SEC_HOUR;
            case UNIT_DAY -> value * SEC_DAY;
            default -> value;
        };
    }

    /**
     * 秒数落到四档的哪一档。
     *
     * @param seconds 秒数
     * @return 档位字符；非四档整数倍返回粒度最细的 s
     */
    public static String unitOf(int seconds) {
        if (seconds > 0 && seconds % SEC_DAY == 0) {
            return UNIT_DAY;
        }
        if (seconds > 0 && seconds % SEC_HOUR == 0) {
            return UNIT_HOUR;
        }
        if (seconds > 0 && seconds % SEC_MINUTE == 0) {
            return UNIT_MINUTE;
        }
        return UNIT_SECOND;
    }

    /**
     * 秒数换算为对应档位下的数值。
     *
     * @param seconds 秒数
     * @return 档位数值
     */
    public static int valueOf(int seconds) {
        String unit = unitOf(seconds);
        return switch (unit) {
            case UNIT_DAY -> seconds / SEC_DAY;
            case UNIT_HOUR -> seconds / SEC_HOUR;
            case UNIT_MINUTE -> seconds / SEC_MINUTE;
            default -> seconds;
        };
    }

    /**
     * 人类可读描述。
     *
     * @param seconds 秒数
     * @return 例如「30 秒」「5 分钟」「1 小时」「1 天」
     */
    public static String describe(int seconds) {
        if (seconds <= 0) {
            return "未配置";
        }
        int v = valueOf(seconds);
        String unit = unitOf(seconds);
        String label = switch (unit) {
            case UNIT_DAY -> "天";
            case UNIT_HOUR -> "小时";
            case UNIT_MINUTE -> "分钟";
            default -> "秒";
        };
        return v + " " + label;
    }

    /**
     * 计算渠道限流下限（秒）：请求间隔 × 并发上限，即该渠道在满载情况下的最小平均出词周期。
     *
     * @param requestIntervalMs 渠道请求间隔（毫秒），空按 0 处理
     * @param concurrencyLimit  渠道并发上限，空按 1 处理
     * @return 限流下限（秒），向上取整，最小 1
     */
    public static int rateFloorSeconds(Integer requestIntervalMs, Integer concurrencyLimit) {
        int interval = requestIntervalMs == null ? 0 : Math.max(requestIntervalMs, 0);
        int concurrency = concurrencyLimit == null || concurrencyLimit <= 0 ? 1 : concurrencyLimit;
        if (interval <= 0) {
            return 1;
        }
        long msFloor = (long) interval * concurrency;
        return (int) Math.max(1L, (msFloor + 999L) / 1000L);
    }

    /**
     * 校验采集间隔是否合法。
     *
     * @param intervalSeconds   配置的采集间隔（秒）
     * @param requestIntervalMs 渠道请求间隔（毫秒）
     * @param concurrencyLimit  渠道并发上限
     * @param globalMinSeconds  全局最小间隔（秒）
     * @return 问题列表，空表示合法
     */
    public static List<String> validate(Integer intervalSeconds, Integer requestIntervalMs,
                                       Integer concurrencyLimit, int globalMinSeconds) {
        List<String> issues = new ArrayList<>();
        if (intervalSeconds == null || intervalSeconds <= 0) {
            issues.add("采集间隔未配置或非正数");
            return issues;
        }
        if (globalMinSeconds > 0 && intervalSeconds < globalMinSeconds) {
            issues.add("采集间隔 " + describe(intervalSeconds) + " 低于全局最小间隔 " + describe(globalMinSeconds));
        }
        int floor = rateFloorSeconds(requestIntervalMs, concurrencyLimit);
        if (intervalSeconds < floor) {
            issues.add("采集间隔 " + describe(intervalSeconds) + " 低于渠道限流下限 " + describe(floor)
                + "（请求间隔 " + (requestIntervalMs == null ? 0 : requestIntervalMs) + "ms × 并发 "
                + (concurrencyLimit == null ? 1 : concurrencyLimit) + "）");
        }
        return issues;
    }
}
