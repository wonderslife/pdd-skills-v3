package org.dromara.yuqing.report.domain;

import java.time.LocalDateTime;

/**
 * 日报「重点舆情」章节的一行（不可变）
 *
 * @param opinionId   舆情ID
 * @param title       标题
 * @param channelName 平台/渠道
 * @param sentiAttr   情感属性
 * @param riskLevel   风险等级
 * @param heatScore   热度分
 * @param readCount   阅读数
 * @param shareCount  转发数
 * @param commentCount 评论数
 * @param opinionUrl  原文链接
 * @param publishTime 发布时间
 * @author ruoyi
 */
public record DailyHotRow(Long opinionId, String title, String channelName, String sentiAttr, String riskLevel,
                          Integer heatScore, Long readCount, Long shareCount, Long commentCount,
                          String opinionUrl, LocalDateTime publishTime) {
}
