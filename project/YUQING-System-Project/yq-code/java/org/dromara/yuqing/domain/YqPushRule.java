package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.time.LocalDateTime;
import java.io.Serial;

/**
 * 推送规则对象 yq_push_rule
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_push_rule")
@ExcelIgnoreUnannotated
public class YqPushRule extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 规则ID,主键 */
    @TableId(value = "rule_id")
    private Long ruleId;

    /** 规则名称 */
    @ExcelProperty(value = "规则名称")
    private String ruleName;

    /** 推送场景（逗号分隔） */
    @ExcelProperty(value = "推送场景（逗号分隔）")
    private String pushScenes;

    /** 推送级别 */
    @ExcelProperty(value = "推送级别")
    private String pushLevel;

    /** 定时批量 cron */
    private String scheduleCron;

    /** 推送模板ID */
    private Long pushTemplateId;

    /** 目标类型 */
    @ExcelProperty(value = "目标类型")
    private String targetType;

    /** 目标ID（逗号分隔） */
    private String targetIds;

    /** 免打扰开始时间 HH:mm */
    @ExcelProperty(value = "免打扰开始时间 HH:mm")
    private String quietStart;

    /** 免打扰结束时间 HH:mm */
    @ExcelProperty(value = "免打扰结束时间 HH:mm")
    private String quietEnd;

    /** 失败重试上限 */
    private Integer maxRetry;

    /** 状态（0正常 1停用） */
    private String status;

    /** 推送模板名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "推送模板名称")
    private String templateName;
}
