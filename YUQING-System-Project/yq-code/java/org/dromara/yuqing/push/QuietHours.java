package org.dromara.yuqing.push;

import java.time.LocalTime;
import java.time.format.DateTimeParseException;

/**
 * 免打扰时段判定（F-011 验收标准 1）
 *
 * <p>支持跨夜时段（如 22:00 → 08:00）。约定：</p>
 * <ul>
 *   <li>任一端解析失败 → 视为未配置，不在免打扰内（宁可多发，不可漏发）。</li>
 *   <li>起止相同 → 视为未配置（防止误配成「全天免打扰」把预警全部吞掉）。</li>
 * </ul>
 *
 * @author ruoyi
 */
public final class QuietHours {

    private QuietHours() {
    }

    /** 解析 HH:mm；失败返回 null */
    public static LocalTime parse(String hhmm) {
        if (hhmm == null || hhmm.isBlank()) {
            return null;
        }
        String v = hhmm.trim();
        try {
            return LocalTime.parse(v.length() == 4 ? "0" + v : v);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /**
     * 当前时刻是否处于免打扰时段
     *
     * @param start 起始 HH:mm
     * @param end   结束 HH:mm
     * @param now   当前时刻
     */
    public static boolean inQuiet(String start, String end, LocalTime now) {
        LocalTime s = parse(start);
        LocalTime e = parse(end);
        if (s == null || e == null || s.equals(e) || now == null) {
            return false;
        }
        if (s.isBefore(e)) {
            // 同日区间 [s, e)
            return !now.isBefore(s) && now.isBefore(e);
        }
        // 跨夜区间 [s, 24:00) ∪ [00:00, e)
        return !now.isBefore(s) || now.isBefore(e);
    }

    /**
     * 免打扰结束时刻（用于把定时批量顺延）
     *
     * @return 结束时刻；未配置返回 null
     */
    public static LocalTime resolveResumeTime(String end) {
        return parse(end);
    }
}
