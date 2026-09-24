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
 * 报告模板章节对象 yq_report_section
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_report_section")
@ExcelIgnoreUnannotated
public class YqReportSection extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键 */
    @TableId(value = "section_id")
    private Long sectionId;

    /** 所属模板ID */
    private Long templateId;

    /** 章节编码 */
    @ExcelProperty(value = "章节编码")
    private String sectionCode;

    /** 章节标题 */
    @ExcelProperty(value = "章节标题")
    private String sectionName;

    /** 排序 */
    private Integer orderNum;

    /** 是否必含（0否 1是） */
    private String required;
}
