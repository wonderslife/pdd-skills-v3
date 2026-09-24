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
 * 点位对象 insp_point
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("insp_point")
@ExcelIgnoreUnannotated
public class InspectPoint extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 点位ID,主键 */
    @TableId(value = "point_id")
    private Long pointId;

    /** 所属机房ID */
    private Long roomId;

    /** 所属区域ID */
    private Long areaId;

    /** 点位名称 */
    @ExcelProperty(value = "点位名称")
    private String pointName;

    /** 点位编码 */
    @ExcelProperty(value = "点位编码")
    private String pointCode;

    /** 位置描述 */
    @ExcelProperty(value = "位置描述")
    private String location;

    /** 巡检周期类型 */
    @ExcelProperty(value = "巡检周期类型")
    private String cycleType;

    /** 自定义间隔天数 */
    private Integer cycleValue;

    /** GPS校验（0关 1开） */
    private String gpsEnabled;

    /** 上次巡检时间 */
    @ExcelProperty(value = "上次巡检时间")
    private LocalDateTime lastInspectTime;

    /** 点位状态 */
    @ExcelProperty(value = "点位状态")
    private String status;

    /** 备注 */
    private String remark;

    /** 删除标志（0存在 2删除） */
    @TableLogic
    private String delFlag;

    /** 机房名称 */
    @TableField(exist = false)
    private String roomName;

    /** 区域名称 */
    @TableField(exist = false)
    private String areaName;

    /** 巡检项清单 */
    @TableField(exist = false)
    private List<InspectPointItem> itemList;
}
