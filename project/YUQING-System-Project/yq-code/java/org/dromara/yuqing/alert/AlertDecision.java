package org.dromara.yuqing.alert;

import lombok.Builder;
import lombok.Data;

/**
 * 一次预警判定结果
 *
 * <p>由 {@link AlertEngine} 产出，由 Service 落库为 {@code yq_alert} 并驱动推送。</p>
 *
 * @author ruoyi
 */
@Data
@Builder
public class AlertDecision {

    /** 触发规则 */
    private Long ruleId;
    private String ruleName;

    /** 关联舆情 / 事件 */
    private Long opinionId;
    private Long clusterId;

    /** 触发场景 */
    private String scene;
    /** 预警级别 */
    private String alertLevel;
    /** 联动的推送级别 */
    private String pushLevel;

    /** 预警标题 */
    private String alertTitle;
    /** 触发值描述（落 trigger_value，用于事后复盘） */
    private String triggerValue;
    /** 事件聚合指纹 */
    private String fingerprint;

    /** 候选舆情快照（推送渲染用） */
    private AlertCandidate candidate;
}
