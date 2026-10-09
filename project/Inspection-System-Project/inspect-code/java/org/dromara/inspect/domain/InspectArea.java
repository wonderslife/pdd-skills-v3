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
import java.io.Serial;

/**
 * 区域对象 insp_area
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("insp_area")
@ExcelIgnoreUnannotated
public class InspectArea extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 区域ID,主键 */
    @TableId(value = "area_id")
    private Long areaId;

    /** 所属机房ID */
    private Long roomId;

    /** 父区域ID（顶级为0） */
    private Long parentId;

    /** 区域名称 */
    @ExcelProperty(value = "区域名称")
    private String areaName;

    /** 显示顺序 */
    private Integer orderNum;

    /** 状态 */
    private String status;

    /** 备注 */
    private String remark;

    /** 删除标志（0存在 2删除） */
    @TableLogic
    private String delFlag;

    /** 机房名称 */
    @TableField(exist = false)
    private String roomName;

    /** 父区域名称 */
    @TableField(exist = false)
    private String parentName;
}
