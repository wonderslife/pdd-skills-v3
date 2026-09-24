package org.dromara.yuqing.analytics;

import lombok.Data;

/**
 * 舆论焦点（F-009 验收标准 5 「舆论焦点」）
 *
 * @author ruoyi
 */
@Data
public class FocusPoint {

    /** 焦点类型：topic / region */
    private String kind;

    /** 取值 */
    private String key;

    /** 展示名 */
    private String label;

    /** 条数 */
    private Integer opinionCount;

    /** 占比（%） */
    private Double share;

    /** 负面占比（%） */
    private Double negativeRate;

    /** 热度合计 */
    private Long heatSum;
}
