package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.io.Serializable;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.io.Serial;

/**
 * 模型版本对象 yq_model_version
 *
 * @author ruoyi
 */
@Data
@TableName("yq_model_version")
@ExcelIgnoreUnannotated
public class YqModelVersion implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键 */
    @TableId(value = "model_version_id")
    private Long modelVersionId;

    /** 版本名称 */
    @ExcelProperty(value = "版本名称")
    private String versionName;

    /** 类型 */
    @ExcelProperty(value = "类型")
    private String modelType;

    /** 提供方 */
    @ExcelProperty(value = "提供方")
    private String provider;

    /** 训练样本量 */
    private Integer sampleCount;

    /** 训练时间 */
    @ExcelProperty(value = "训练时间")
    private LocalDateTime trainTime;

    /** 评测准确率（%） */
    private BigDecimal evalAccuracy;

    /** 是否启用（0否 1是） */
    private String isActive;

    /** 从哪个版本回滚而来 */
    private Long rollbackFrom;

    /** 备注/回滚原因 */
    private String remark;
}
