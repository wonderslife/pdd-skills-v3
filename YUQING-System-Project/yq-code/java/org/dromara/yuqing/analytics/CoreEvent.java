package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 核心舆情事件（F-009 验收标准 5 「核心舆情事件」）
 *
 * @author ruoyi
 */
@Data
public class CoreEvent {

    /** 事件聚合ID（无聚合时为 0） */
    private Long clusterId;

    /** 事件标题（取组内热度最高那条） */
    private String title;

    /** 代表条目链接 */
    private String opinionUrl;

    /** 代表条目ID（下钻用） */
    private Long opinionId;

    /** 组内条数 */
    private Integer opinionCount;

    /** 负面条数 */
    private Integer negativeCount;

    /** 负面占比（%） */
    private Double negativeRate;

    /** 热度合计 */
    private Long heatSum;

    /** 首次出现时间 */
    private LocalDateTime firstTime;

    /** 最后一次出现时间 */
    private LocalDateTime lastTime;

    /** 涉及渠道（保序去重） */
    private List<String> channels = new ArrayList<>();
}
