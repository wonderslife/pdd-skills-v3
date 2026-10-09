package org.dromara.yuqing.collect.adapter;

import cn.hutool.core.date.DateUtil;
import cn.hutool.core.date.LocalDateTimeUtil;

import java.time.LocalDateTime;

/**
 * 发布时间解析：站点时间格式千奇百怪，统一归一化为 LocalDateTime。
 *
 * @author ruoyi
 */
public final class TimeParser {

    private TimeParser() {
    }

    /**
     * 解析时间文本。
     *
     * @param text              原始文本，如「2026-09-18 15:00」「2026年09月18日」
     * @param preferredPattern  适配器指定的时间格式，可空
     * @return 时间；无法解析返回 null
     */
    public static LocalDateTime parse(String text, String preferredPattern) {
        if (text == null) {
            return null;
        }
        String normalized = normalize(text);
        if (normalized.isEmpty()) {
            return null;
        }
        if (isDigits(normalized)) {
            long value = Long.parseLong(normalized);
            if (normalized.length() == 10) {
                return LocalDateTime.ofInstant(java.time.Instant.ofEpochSecond(value), java.time.ZoneId.systemDefault());
            }
            if (normalized.length() == 13) {
                return LocalDateTime.ofInstant(java.time.Instant.ofEpochMilli(value), java.time.ZoneId.systemDefault());
            }
        }
        if (preferredPattern != null && !preferredPattern.isBlank()) {
            try {
                return LocalDateTimeUtil.parse(normalized, preferredPattern);
            } catch (Exception ignored) {
                // 适配器给的格式不匹配时继续走兜底解析
            }
        }
        try {
            return LocalDateTimeUtil.of(DateUtil.parse(normalized));
        } catch (Exception ignored) {
            return null;
        }
    }

    /**
     * 归一化：全角转半角、中文单位转符号、压缩空白。
     *
     * @param text 原文
     * @return 归一化文本
     */
    private static String normalize(String text) {
        String s = text.trim()
            .replace('年', '-')
            .replace('月', '-')
            .replace('/', '-')
            .replace('日', ' ')
            .replace('T', ' ')
            .replace('：', ':');
        StringBuilder sb = new StringBuilder(s.length());
        boolean lastSpace = false;
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            if (ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r') {
                if (!lastSpace && sb.length() > 0) {
                    sb.append(' ');
                }
                lastSpace = true;
            } else {
                sb.append(ch);
                lastSpace = false;
            }
        }
        return sb.toString().trim();
    }

    private static boolean isDigits(String s) {
        for (int i = 0; i < s.length(); i++) {
            if (!Character.isDigit(s.charAt(i))) {
                return false;
            }
        }
        return !s.isEmpty();
    }
}
