package org.dromara.yuqing.analytics;

/**
 * 热点排行排序口径（F-009 验收标准 3）
 *
 * @author ruoyi
 */
public enum RankBy {

    /** 阅读量 */
    READ("read", "阅读量"),

    /** 转发量 */
    SHARE("share", "转发量"),

    /** 评论量 */
    COMMENT("comment", "评论量"),

    /** 综合热度 */
    HEAT("heat", "综合热度");

    private final String code;

    private final String label;

    RankBy(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }

    /** 宽松解析，非法值回落 {@link #HEAT}（默认按综合热度，业务上最常用） */
    public static RankBy of(String v) {
        if (v == null || v.isBlank()) {
            return HEAT;
        }
        String s = v.trim().toLowerCase();
        for (RankBy r : values()) {
            if (r.code.equals(s)) {
                return r;
            }
        }
        return HEAT;
    }
}
