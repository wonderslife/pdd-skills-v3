package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.time.LocalDateTime;
import java.io.Serial;

/**
 * 降噪规则对象 yq_noise_rule
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_noise_rule")
@ExcelIgnoreUnannotated
public class YqNoiseRule extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 规则ID,主键 */
    @TableId(value = "rule_id")
    private Long ruleId;

    /** 规则名称 */
    @ExcelProperty(value = "规则名称")
    private String ruleName;

    /** 规则类型 */
    @ExcelProperty(value = "规则类型")
    private String ruleType;

    /** 降噪类别 */
    @ExcelProperty(value = "降噪类别")
    private String noiseCategory;

    /** 匹配方式 */
    @ExcelProperty(value = "匹配方式")
    private String matchType;

    /** 匹配内容 */
    @ExcelProperty(value = "匹配内容")
    private String matchValue;

    /** 执行优先级 */
    private Integer priority;

    /** 状态（0正常 1停用） */
    private String status;

    /** 备注 */
    private String remark;
}
