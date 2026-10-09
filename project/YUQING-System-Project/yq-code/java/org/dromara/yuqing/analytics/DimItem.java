package org.dromara.yuqing.analytics;

import lombok.Data;

/**
 * 看板上的一个维度条目（分布卡片的一行、趋势曲线的一个点）
 *
 * <p>分布与趋势共用同一结构：趋势就是把 dimKey/dimLabel 当成时间桶，
 * 前端两条渲染路径可以复用同一套 tooltip 与下钻逻辑。</p>
 *
 * @author ruoyi
 */
@Data
public class DimItem {

    /** 维度类型 */
    private String dimType;

    /** 维度取值（趋势行是时间桶标识，可字典序排序） */
    private String dimKey;

    /** 展示名 */
    private String dimLabel;

    /** 条数 */
    private Integer opinionCount;

    /** 正面条数 */
    private Integer positiveCount;

    /** 中性条数 */
    private Integer neutralCount;

    /** 负面条数 */
    private Integer negativeCount;

    /** 严重级条数 */
    private Integer highRiskCount;

    /** 阅读量合计 */
    private Long readSum;

    /** 评论量合计 */
    private Long commentSum;

    /** 转发量合计 */
    private Long shareSum;

    /** 点赞量合计 */
    private Long likeSum;

    /** 热度合计 */
    private Long heatSum;

    /** 负面占比（%） */
    private Double negativeRate;

    /** 本条目占其所属维度总量的比例（%） */
    private Double share;
}
