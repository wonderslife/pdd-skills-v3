package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDate;

/**
 * 聚合请求（F-009 验收标准 8 / 9 的手动触发入口）
 *
 * @author ruoyi
 */
@Data
public class AggregateRequest {

    /** 起始统计日 */
    private LocalDate dateFrom;

    /** 截止统计日 */
    private LocalDate dateTo;

    /** 任务ID（可选） */
    private Long taskId;

    /** 渠道ID（可选） */
    private Long channelId;

    /** 触发方式 auto / manual / replay */
    private String triggerType = "manual";

    /**
     * 是否先清理该范围的旧聚合行
     *
     * <p>默认 false。Doris 的 Unique Key 覆盖写已保证「写过的行不重复」，
     * 只有「某天明细被删后重算、残留旧聚合行」这种场景才需要先删。
     * 打开它会有一个短暂的看板空窗，所以要求显式指定。</p>
     */
    private boolean purge = false;
}
