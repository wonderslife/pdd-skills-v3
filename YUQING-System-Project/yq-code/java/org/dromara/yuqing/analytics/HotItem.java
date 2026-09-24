package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 热点排行条目（F-009 验收标准 3）
 *
 * @author ruoyi
 */
@Data
public class HotItem {

    /** 名次（1 起；跨日范围查询时由服务层按分数重排后回填） */
    private Integer rankNo;

    /** 舆情ID */
    private Long opinionId;

    /** 任务ID */
    private Long taskId;

    /** 渠道ID */
    private Long channelId;

    /** 标题 */
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

    /** 综合热度 */
    private Integer heatScore;
}
