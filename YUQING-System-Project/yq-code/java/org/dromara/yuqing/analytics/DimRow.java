package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDate;

/**
 * 维度分布行 —— 对应 Doris {@code yq_stats_dim}
 *
 * <p>长表设计：{@code (stats_date, dim_type, dim_key, time_grain, task_id, channel_id)}
 * 为 Unique Key。维度取值是开放集合（地域、话题），宽表没法预知列，
 * 所以统一走长表；趋势曲线的「时间桶」也复用这张表（dim_type = trend）。</p>
 *
 * @author ruoyi
 */
@Data
public class DimRow {

    /** 统计日 */
    private LocalDate statsDate;

    /** 维度类型 */
    private String dimType;

    /** 维度取值（ID 或文本） */
    private String dimKey;

    /** 时间粒度（趋势行有效；分布行固定 day） */
    private String timeGrain;

    /** 任务ID（0=未归属） */
    private Long taskId;

    /** 渠道ID（0=未归属） */
    private Long channelId;

    /** 维度展示名 */
    private String dimLabel;

    /** 舆情条数 */
    private Integer opinionCount;

    /** 正面条数 */
    private Integer positiveCount;

    /** 中性条数 */
    private Integer neutralCount;

    /** 负面条数 */
    private Integer negativeCount;

    /** 高风险条数 */
    private Integer highRiskCount;

    /** 阅读量合计 */
    private Long readSum;

    /** 评论量合计 */
    private Long commentSum;

    /** 转发量合计 */
    private Long shareSum;

    /** 点赞量合计 */
    private Long likeSum;

    /** 热度分值合计 */
    private Long heatSum;

    /** 负面占比（%） */
    private Double negativeRate;

    /** 派生占比 */
    public void derive() {
        int total = opinionCount == null ? 0 : opinionCount;
        negativeRate = total == 0 ? 0D : DailyRow.round2((negativeCount == null ? 0 : negativeCount) * 100D / total);
    }
}
