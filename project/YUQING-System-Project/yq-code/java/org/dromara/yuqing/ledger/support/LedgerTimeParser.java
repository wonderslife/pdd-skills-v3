package org.dromara.yuqing.ledger.support;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

/**
 * 宽容时间解析（F-016 台账时间维度）
 *
 * <p>台账是「打开就要能用」的页面：用户可能手敲 URL、可能由看板下钻带过来
 * 半截参数。解析失败一律返回 null（该条件不生效），<b>绝不抛异常</b> ——
 * 否则一个拼错的时间参数会让整页 500，而用户其实只想看默认范围。</p>
 *
 * <p>与 YqAnalyticsController 的 parseDate 保持同样的宽容策略，
 * 避免两个页面同样输入却一个能用一个报错。</p>
 *
 * @author ruoyi
 */
public final class LedgerTimeParser {

    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter DT_MIN = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final DateTimeFormatter D = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private LedgerTimeParser() {
    }

    /**
     * 解析为 LocalDateTime。
     *
     * <p>只给日期时：作为「起」取 00:00:00，作为「止」需调用方用
     * {@link #parseEnd(String)} 取 23:59:59，否则会漏掉当天数据。</p>
     */
    public static LocalDateTime parse(String v) {
        if (v == null || v.isBlank()) {
            return null;
        }
        String s = v.trim();
        try {
            if (s.length() == 10) {
                return LocalDate.parse(s, D).atStartOfDay();
            }
            if (s.length() == 16) {
                return LocalDateTime.parse(s, DT_MIN);
            }
            if (s.length() >= 19) {
                return LocalDateTime.parse(s.substring(0, 19), DT);
            }
            return LocalDateTime.parse(s);
        } catch (RuntimeException e) {
            return null;
        }
    }

    /**
     * 解析为「区间止点」。
     *
     * <p>用户选 2026-09-23 作为截止，真实意图是「含当天全部」。
     * 若按 00:00:00 处理，9 月 23 日采到的数据全被排除，
     * 表现为「明明今天有数据却查不到」—— 这是舆情类系统最常见的体验投诉。</p>
     */
    public static LocalDateTime parseEnd(String v) {
        if (v == null || v.isBlank()) {
            return null;
        }
        String s = v.trim();
        if (s.length() == 10) {
            LocalDate d = parseDate(s);
            return d == null ? null : d.atTime(LocalTime.MAX.withNano(0));
        }
        return parse(s);
    }

    /** 解析为 LocalDate */
    public static LocalDate parseDate(String v) {
        if (v == null || v.isBlank()) {
            return null;
        }
        try {
            String s = v.trim();
            if (s.length() == 10) {
                return LocalDate.parse(s, D);
            }
            LocalDateTime dt = parse(s);
            return dt == null ? null : dt.toLocalDate();
        } catch (RuntimeException e) {
            return null;
        }
    }
}
