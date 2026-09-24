package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 详情页的预警记录行（F-016 验收标准 3）
 *
 * <p>数据来自 yq_alert（MySQL，非 Doris）。详情页只读展示，
 * 处置动作仍在 F-010 的预警模块完成 —— 台账不重复提供处置入口，
 * 避免两处都能改状态导致口径打架。</p>
 *
 * @author ruoyi
 */
@Data
public class LedgerAlertView implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 预警ID */
    private Long alertId;

    /** 预警标题 */
    private String alertTitle;

    /** 触发场景 */
    private String triggerScene;

    /** 预警级别 */
    private String alertLevel;

    /** 触发值描述 */
    private String triggerValue;

    /** 触发时间 */
    private LocalDateTime triggerTime;

    /** 处置状态 */
    private String status;

    /** 处置说明 */
    private String processRemark;

    /** 处置人用户ID */
    private Long processBy;

    /** 处置人姓名 */
    private String processByName;

    /** 处置时间 */
    private LocalDateTime processTime;

    /** 推送结果 */
    private String pushResult;

    /** 触发规则名称 */
    private String ruleName;
}
