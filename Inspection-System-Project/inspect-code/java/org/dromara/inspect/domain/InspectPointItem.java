package org.dromara.inspect.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.TableLogic;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.time.LocalDateTime;
import java.io.Serial;

/**
 * 点位巡检项对象 insp_point_item
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("insp_point_item")
@ExcelIgnoreUnannotated
public class InspectPointItem extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 点位巡检项ID,主键 */
    @TableId(value = "item_id")
    private Long itemId;

    /** 所属点位ID */
    private Long pointId;

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

    /** 来源模板ID */
    private Long templateId;

    /** 备注 */
    private String remark;

    /** 删除标志（0存在 2删除） */
    @TableLogic
    private String delFlag;
}
