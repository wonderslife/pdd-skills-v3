package org.dromara.inspect.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.io.Serializable;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.io.Serial;

/**
 * 统计预聚合对象 insp_stats_daily
 *
 * @author ruoyi
 */
@Data
@TableName("insp_stats_daily")
@ExcelIgnoreUnannotated
public class InspectStatsDaily implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 统计预聚合ID,主键 */
    @TableId(value = "stats_id")
    private Long statsId;

    /** 统计日期 */
    @ExcelProperty(value = "统计日期")
    private LocalDate statsDate;

    /** 机房ID */
    private Long roomId;

    /** 点位ID */
    private Long pointId;

    /** 巡检次数 */
    private Integer inspectCount;

    /** 异常次数 */
    private Integer abnormalCount;

    /** 逾期数 */
    private Integer overdueCount;

    /** 异常率(%) */
    private BigDecimal abnormalRate;
}
