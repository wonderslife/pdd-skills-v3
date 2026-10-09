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
import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.io.Serial;

/**
 * 异常项对象 insp_abnormal
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("insp_abnormal")
@ExcelIgnoreUnannotated
public class InspectAbnormal extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 异常项ID,主键 */
    @TableId(value = "abnormal_id")
    private Long abnormalId;

    /** 所属记录ID */
    private Long recordId;

    /** 关联巡检项结果ID */
    private Long recordItemId;

    /** 点位ID */
    private Long pointId;

    /** 机房ID */
    private Long roomId;

    /** 处理状态 */
    @ExcelProperty(value = "处理状态")
    private String status;

    /** 处理说明 */
    @ExcelProperty(value = "处理说明")
    private String processRemark;

    /** 处理人用户ID */
    private Long processBy;

    /** 处理时间 */
    @ExcelProperty(value = "处理时间")
    private LocalDateTime processTime;

    /** 点位名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "点位名称")
    private String pointName;

    /** 机房名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "机房名称")
    private String roomName;

    /** 巡检项名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "巡检项名称")
    private String itemName;

    /** 巡检时间 */
    @TableField(exist = false)
    @ExcelProperty(value = "巡检时间")
    private LocalDateTime inspectTime;

    /** 异常说明 */
    @TableField(exist = false)
    @ExcelProperty(value = "异常说明")
    private String description;

    /** 现场照片URL */
    @TableField(exist = false)
    private List<String> photoUrls;

    /**
     * 扩展请求参数（beginTime / endTime 等），不映射数据库字段
     */
    @TableField(exist = false)
    private Map<String, Object> params = new HashMap<>();
}
