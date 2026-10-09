package org.dromara.inspect.utils;

import cn.hutool.core.util.StrUtil;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;

/**
 * 巡检周期工具
 * <p>
 * 用于计算「当前周期起始时间」，支撑两条业务规则：
 * - PRD 模块 8：同一点位同一周期重复提交时被拦截（本周期已巡检）
 *
 * @author ruoyi
 */
public final class InspectCycleUtils {

    private InspectCycleUtils() {
    }

    /**
     * 计算当前巡检周期的起始时间
     *
     * @param cycleType  周期类型 daily/weekly/monthly/custom
     * @param cycleValue 自定义间隔天数（cycleType=custom 时使用）
     * @param now        基准时间
     * @return 周期起始时间；无法识别时返回当天 0 点
     */
    public static LocalDateTime cycleStart(String cycleType, Integer cycleValue, LocalDateTime now) {
        LocalDateTime base = now == null ? LocalDateTime.now() : now;
        LocalDate today = base.toLocalDate();
        String type = StrUtil.blankToDefault(cycleType, "daily");
        return switch (type) {
            case "weekly" -> LocalDateTime.of(today.with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY)), LocalTime.MIN);
            case "monthly" -> LocalDateTime.of(today.withDayOfMonth(1), LocalTime.MIN);
            // 自定义间隔：以「当前时间往前推 N 天」为窗口起点
            case "custom" -> {
                int days = (cycleValue == null || cycleValue < 1) ? 1 : cycleValue;
                yield LocalDateTime.of(today.minusDays(days), LocalTime.MIN);
            }
            // daily 及未知类型
            default -> LocalDateTime.of(today, LocalTime.MIN);
        };
    }

    /**
     * 周期类型的展示名（用于错误提示）
     */
    public static String cycleLabel(String cycleType) {
        return switch (StrUtil.blankToDefault(cycleType, "daily")) {
            case "weekly" -> "本周";
            case "monthly" -> "本月";
            case "custom" -> "本周期";
            default -> "本日";
        };
    }

    /**
     * 按周期类型生成点位编码：PT-{机房编码}-{yyyyMMdd}{序号}
     *
     * @param roomCode 机房编码
     * @param seq      序号
     */
    public static String generatePointCode(String roomCode, int seq) {
        String code = StrUtil.blankToDefault(roomCode, "ROOM").replaceAll("[^A-Za-z0-9]", "");
        String day = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        return String.format("PT-%s-%s%03d", code.toUpperCase(), day, seq);
    }

    /**
     * 周期类型的合法值校验
     */
    public static boolean isValidCycleType(String cycleType) {
        return "daily".equals(cycleType) || "weekly".equals(cycleType)
            || "monthly".equals(cycleType) || "custom".equals(cycleType);
    }

}
