package org.dromara.yuqing.report.domain;

import java.time.LocalDateTime;

/**
 * 日报「新增预警」章节的一行（不可变）
 *
 * @param alertId      预警ID
 * @param alertTitle   预警标题
 * @param alertLevel   预警等级
 * @param triggerScene 触发场景
 * @param triggerValue 触发值（关键词/数值）
 * @param channelName  来源渠道
 * @param triggerTime  触发时间
 * @param status       处置状态
 * @author ruoyi
 */
public record DailyAlertRow(Long alertId, String alertTitle, String alertLevel, String triggerScene,
                            String triggerValue, String channelName, LocalDateTime triggerTime, String status) {
}
