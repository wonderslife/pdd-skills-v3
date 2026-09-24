package org.dromara.inspect.domain;

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
 * 巡检项模板对象 insp_item_template
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("insp_item_template")
@ExcelIgnoreUnannotated
public class InspectItemTemplate extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 巡检项模板ID,主键 */
    @TableId(value = "template_id")
    private Long templateId;

    /** 模板名称 */
    @ExcelProperty(value = "模板名称")
    private String templateName;

    /** 模板说明 */
    @ExcelProperty(value = "模板说明")
    private String description;

    /** 备注 */
    private String remark;

    /** 删除标志（0存在 2删除） */
    @TableLogic
    private String delFlag;

    /** 模板明细 */
    @TableField(exist = false)
    private List<InspectItemTemplateDetail> detailList;
}
