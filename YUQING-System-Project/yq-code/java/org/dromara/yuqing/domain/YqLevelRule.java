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
 * 研判分级规则对象 yq_level_rule
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_level_rule")
@ExcelIgnoreUnannotated
public class YqLevelRule extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 规则ID,主键 */
    @TableId(value = "rule_id")
    private Long ruleId;

    /** 规则名称 */
    @ExcelProperty(value = "规则名称")
    private String ruleName;

    /** 是否默认规则（0是 1否） */
    private String isDefault;

    /** 评分依据 */
    private String scoreMetric;

    /** 四档分级区间定义 */
    private String levelRanges;

    /** 三级风险等级判定条件 */
    private String riskMapping;

    /** 负面情感占比判定阈值 */
    private BigDecimal sentiThreshold;

    /** 状态（0正常 1停用） */
    private String status;

    /** 备注 */
    private String remark;
}
