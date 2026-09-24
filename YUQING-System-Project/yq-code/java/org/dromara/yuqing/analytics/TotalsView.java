package org.dromara.yuqing.analytics;

import lombok.Data;

/**
 * 看板总量卡（F-009 验收标准 1 的「舆情总量 / 正负面占比 / 互动数据统计」）
 *
 * @author ruoyi
 */
@Data
public class TotalsView {

    /** 舆情总量 */
    private Integer totalCount;

    /** 正面条数 */
    private Integer positiveCount;

    /** 中性条数 */
    private Integer neutralCount;

    /** 负面条数 */
    private Integer negativeCount;

    /** 严重级条数 */
    private Integer highRiskCount;

    /** 正面占比（%） */
    private Double positiveRate;

    /** 中性占比（%） */
    private Double neutralRate;

    /** 负面占比（%） */
    private Double negativeRate;

    /** 阅读量合计 */
    private Long readSum;

    /** 评论量合计 */
    private Long commentSum;

    /** 转发量合计 */
    private Long shareSum;

    /** 点赞量合计 */
    private Long likeSum;

    /** 互动量合计（阅读+评论+转发+点赞） */
    private Long interactionSum;

    /** 平均综合热度 */
    private Double avgHeatScore;

    /** 去重剔除条数 */
    private Integer dupCount;

    /** 降噪剔除条数 */
    private Integer rejectedCount;

    /** 预警条数 */
    private Integer alertCount;

    /** 推送条数 */
    private Integer pushCount;

    /** 报告生成数 */
    private Integer reportCount;
}
