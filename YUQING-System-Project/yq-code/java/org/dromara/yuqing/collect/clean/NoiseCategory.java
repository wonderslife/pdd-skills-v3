package org.dromara.yuqing.collect.clean;

import java.util.Locale;

/**
 * 七类低价值数据（F-006 验收标准 1）。
 *
 * <p>取值与字典 {@code yq_noise_category} 严格一致：字典项改了这里也要改，
 * 否则台账里的「剔除原因」下拉会筛不出数据。</p>
 *
 * @author ruoyi
 */
public enum NoiseCategory {

    /** 垃圾内容 */
    SPAM("spam", "垃圾内容"),
    /** 广告营销 */
    ADVERTISEMENT("advertisement", "广告营销"),
    /** 灌水评论 */
    FLOODING("flooding", "灌水评论"),
    /** 无意义短句 */
    MEANINGLESS("meaningless", "无意义短句"),
    /** 机器人内容 */
    BOT("bot", "机器人内容"),
    /** 空白内容 */
    BLANK("blank", "空白内容"),
    /** 违规屏蔽 */
    VIOLATION("violation", "违规屏蔽");

    private final String code;

    private final String label;

    NoiseCategory(String code, String label) {
        this.code = code;
        this.label = label;
    }

    /**
     * 字典取值。
     *
     * @return 与 {@code yq_noise_category.dict_value} 一致的编码
     */
    public String code() {
        return code;
    }

    /**
     * 字典标签。
     *
     * @return 中文名
     */
    public String label() {
        return label;
    }

    /**
     * 按编码解析枚举。
     *
     * @param code 编码（大小写与首尾空格不敏感）
     * @return 对应枚举；无法识别时返回 null
     */
    public static NoiseCategory of(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        String v = code.trim().toLowerCase(Locale.ROOT);
        for (NoiseCategory c : values()) {
            if (c.code.equals(v)) {
                return c;
            }
        }
        return null;
    }

    /**
     * 是否为已定义的降噪类别。
     *
     * @param code 编码
     * @return true 表示七类之一
     */
    public static boolean isKnown(String code) {
        return of(code) != null;
    }
}
