package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import java.io.Serializable;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.time.LocalDateTime;
import java.io.Serial;

/**
 * 训练样本对象 yq_train_sample
 *
 * @author ruoyi
 */
@Data
@TableName("yq_train_sample")
@ExcelIgnoreUnannotated
public class YqTrainSample implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 样本ID,主键 */
    @TableId(value = "sample_id")
    private Long sampleId;

    /** 来源案例ID */
    private Long knowledgeId;

    /** 使用的模型版本ID */
    private Long modelVersionId;

    /** 样本状态 */
    @ExcelProperty(value = "样本状态")
    private String sampleStatus;

    /** 标注内容（JSON） */
    private String labelContent;

    /** 标注人 */
    private Long labeledBy;

    /** 标注时间 */
    @ExcelProperty(value = "标注时间")
    private LocalDateTime labeledTime;

    /** 来源案例标题 */
    @TableField(exist = false)
    @ExcelProperty(value = "来源案例标题")
    private String caseTitle;

    /** 模型版本 */
    @TableField(exist = false)
    @ExcelProperty(value = "模型版本")
    private String versionName;
}
