package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.time.LocalDateTime;
import java.util.List;
import java.io.Serial;

/**
 * 报告模板对象 yq_report_template
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_report_template")
@ExcelIgnoreUnannotated
public class YqReportTemplate extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 模板ID,主键 */
    @TableId(value = "template_id")
    private Long templateId;

    /** 模板名称 */
    @ExcelProperty(value = "模板名称")
    private String templateName;

    /** 报告类型 */
    @ExcelProperty(value = "报告类型")
    private String reportType;

    /** 是否同类型默认（0否 1是） */
    private String isDefault;

    /** 封面字段（JSON） */
    private String coverFields;

    /** 正文字体 */
    private String fontFamily;

    /** 标题编号规则 */
    private String headingNumberRule;

    /** 状态（0正常 1停用） */
    private String status;

    /** 删除标志（0存在 2删除） */
    @TableLogic
    private String delFlag;

    /** 模板章节 */
    @TableField(exist = false)
    private List<YqReportSection> sectionList;
}
