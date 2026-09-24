package org.dromara.inspect.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
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
 * 巡检项结果对象 insp_record_item
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("insp_record_item")
@ExcelIgnoreUnannotated
public class InspectRecordItem extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 巡检项结果ID,主键 */
    @TableId(value = "record_item_id")
    private Long recordItemId;

    /** 所属记录ID */
    private Long recordId;

    /** 关联点位巡检项ID */
    private Long itemId;

    /** 巡检项名称（快照） */
    @ExcelProperty(value = "巡检项名称（快照）")
    private String itemName;

    /** 判定结果 */
    @ExcelProperty(value = "判定结果")
    private String result;

    /** 填写数值 */
    @ExcelProperty(value = "填写数值")
    private String value;

    /** 异常说明 */
    private String description;

    /** 显示顺序 */
    private Integer orderNum;

    /** 该项照片 */
    @TableField(exist = false)
    private List<InspectPhoto> photos;
}
