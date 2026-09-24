package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.io.Serial;

/**
 * 预警规则对象 yq_alert_rule
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_alert_rule")
@ExcelIgnoreUnannotated
public class YqAlertRule extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 规则ID,主键 */
    @TableId(value = "rule_id")
    private Long ruleId;

    /** 规则名称 */
    @ExcelProperty(value = "规则名称")
    private String ruleName;

    /** 触发场景（逗号分隔） */
    @ExcelProperty(value = "触发场景（逗号分隔）")
    private String triggerScenes;

    /** 统计时间窗口（分钟） */
    private Integer windowMinutes;

    /** 条数阈值 */
    private Integer countThreshold;

    /** 热度阈值 */
    private Integer heatThreshold;

    /** 最低触发风险等级 */
    private String riskLevelThreshold;

    /** 最低触发传播量级 */
    private String spreadThreshold;

    /** 突发增量倍数阈值 */
    private BigDecimal burstRatio;

    /** 突发增量最小条数（防小样本虚高） */
    private Integer minBurstCount;

    /** 同一事件聚合冷却期（分钟） */
    private Integer cooldownMinutes;

    /** 重点专项标签（逗号分隔） */
    private String topicTags;

    /** 预警级别 */
    @ExcelProperty(value = "预警级别")
    private String alertLevel;

    /** 推送级别 */
    @ExcelProperty(value = "推送级别")
    private String pushLevel;

    /** 通知人用户ID（逗号分隔） */
    private String notifyUserIds;

    /** 状态（0正常 1停用） */
    private String status;
}
