package org.dromara.inspect.domain;

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
 * 模板明细对象 insp_item_template_detail
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("insp_item_template_detail")
@ExcelIgnoreUnannotated
public class InspectItemTemplateDetail extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 模板明细ID,主键 */
    @TableId(value = "detail_id")
    private Long detailId;

    /** 所属模板ID */
    private Long templateId;

    /** 巡检项名称 */
    @ExcelProperty(value = "巡检项名称")
    private String itemName;

    /** 巡检项类型 */
    private String itemType;

    /** 判定标准 */
    @ExcelProperty(value = "判定标准")
    private String standard;

    /** 是否必填（0否 1是） */
    private String required;

    /** 显示顺序 */
    private Integer orderNum;
}
