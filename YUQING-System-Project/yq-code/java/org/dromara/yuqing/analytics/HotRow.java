package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 热点排行行 —— 对应 Doris {@code yq_stats_hot}
 *
 * <p>Unique Key 是 {@code (stats_date, rank_by, rank_no)}：名次本身是键的一部分，
 * 因此每天每口径固定写 TopN 行，重跑只覆盖同名次，不会累积。</p>
 *
 * @author ruoyi
 */
@Data
public class HotRow {

    /** 统计日 */
    private LocalDate statsDate;

    /** 排序口径 */
    private String rankBy;

    /** 名次（从 1 起） */
    private Integer rankNo;

    /** 舆情ID */
    private Long opinionId;

    /** 任务ID（0=未归属） */
    private Long taskId;

    /** 渠道ID（0=未归属） */
    private Long channelId;

    /** 舆情标题 */
    private String title;

    /** 渠道名称 */
    private String channelName;

    /** 原文链接 */
    private String opinionUrl;

    /** 发布时间 */
    private LocalDateTime publishTime;

    /** 舆情属性 */
    private String sentiAttr;

    /** 风险等级 */
    private String riskLevel;

    /** 阅读量 */
    private Long readCount;

    /** 评论量 */
    private Long commentCount;

    /** 转发量 */
    private Long shareCount;

    /** 点赞量 */
    private Long likeCount;

    /** 综合热度分值 */
    private Integer heatScore;
}
