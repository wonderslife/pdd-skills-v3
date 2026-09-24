package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 传播路径中的一站（F-009 验收标准 5 「传播路径」）
 *
 * <p>按渠道**首次发布时间**排序，形成「先在哪传、后在哪传」的链路，
 * 而不是按渠道条数排 —— 条数排出来的不是路径，是榜单。</p>
 *
 * @author ruoyi
 */
@Data
public class PropagationStage {

    /** 序号（从 1 起，按首次发布时间升序） */
    private Integer seq;

    /** 渠道名称 */
    private String channelName;

    /** 该渠道首次发布时间 */
    private LocalDateTime firstTime;

    /** 该渠道最后发布时间 */
    private LocalDateTime lastTime;

    /** 该渠道条数 */
    private Integer opinionCount;

    /** 该渠道条数占比（%） */
    private Double countShare;

    /** 相对上一站的间隔分钟数（第一站为 0） */
    private Long gapMinutes;
}
