package org.dromara.yuqing.analytics;

import lombok.Data;

/**
 * 潜在风险点（F-009 验收标准 5 「潜在风险点」）
 *
 * @author ruoyi
 */
@Data
public class RiskPoint {

    /** 风险级别 high / medium / low */
    private String level;

    /** 风险类型标签，如「负面占比偏高」 */
    private String type;

    /** 一句话描述（含具体数字，避免看的人再算一遍） */
    private String detail;

    /** 实测值 */
    private Double value;

    /** 触发阈值 */
    private Double threshold;

    /** 关联对象（话题名 / 渠道名 / 日期，无则为空） */
    private String target;
}
