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
import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.io.Serial;

/**
 * 巡检记录对象 insp_record
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("insp_record")
@ExcelIgnoreUnannotated
public class InspectRecord extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 巡检记录ID,主键 */
    @TableId(value = "record_id")
    private Long recordId;

    /** 点位ID */
    private Long pointId;

    /** 机房ID */
    private Long roomId;

    /** 巡检员用户ID */
    private Long inspectorId;

    /** 巡检时间 */
    @ExcelProperty(value = "巡检时间")
    private LocalDateTime inspectTime;

    /** 耗时（秒） */
    private Integer duration;

    /** 巡检结果 */
    @ExcelProperty(value = "巡检结果")
    private String result;

    /** 异常项数量 */
    private Integer abnormalCount;

    /** 数据来源 */
    @ExcelProperty(value = "数据来源")
    private String source;

    /** 整体备注 */
    private String remark;

    /** 管理员追加备注 */
    private String adminRemark;

    /** 删除标志（审计要求：不可删） */
    @TableLogic
    private String delFlag;

    /** 点位名称 */
    @TableField(exist = false)
    private String pointName;

    /** 机房名称 */
    @TableField(exist = false)
    private String roomName;

    /** 巡检员名称 */
    @TableField(exist = false)
    private String inspectorName;

    /** 巡检项结果 */
    @TableField(exist = false)
    private List<InspectRecordItem> itemResults;

    /** 巡检照片 */
    @TableField(exist = false)
    private List<InspectPhoto> photos;

    /**
     * 扩展请求参数（beginTime / endTime 等），不映射数据库字段
     */
    @TableField(exist = false)
    private Map<String, Object> params = new HashMap<>();
}
