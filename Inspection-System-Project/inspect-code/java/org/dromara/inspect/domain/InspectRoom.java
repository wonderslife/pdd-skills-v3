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
 * 机房对象 insp_room
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("insp_room")
@ExcelIgnoreUnannotated
public class InspectRoom extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 机房ID,主键 */
    @TableId(value = "room_id")
    private Long roomId;

    /** 机房名称 */
    @ExcelProperty(value = "机房名称")
    private String roomName;

    /** 机房编码 */
    @ExcelProperty(value = "机房编码")
    private String roomCode;

    /** 机房地址 */
    @ExcelProperty(value = "机房地址")
    private String address;

    /** 负责人姓名 */
    @ExcelProperty(value = "负责人姓名")
    private String managerName;

    /** 负责人电话 */
    @ExcelProperty(value = "负责人电话")
    private String managerPhone;

    /** 状态 */
    private String status;

    /** 备注 */
    private String remark;

    /** 删除标志（0存在 2删除） */
    @TableLogic
    private String delFlag;
}
