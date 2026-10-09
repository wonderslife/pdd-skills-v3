package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.io.Serial;

/**
 * 聚合批次对象 yq_stats_batch
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_stats_batch")
@ExcelIgnoreUnannotated
public class YqStatsBatch extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 批次ID,主键 */
    @TableId(value = "batch_id")
    private Long batchId;

    /** 批次号 */
    @ExcelProperty(value = "批次号")
    private String batchNo;

    /** 聚合起始统计日 */
    @ExcelProperty(value = "聚合起始统计日")
    private LocalDate beginDate;

    /** 聚合截止统计日 */
    @ExcelProperty(value = "聚合截止统计日")
    private LocalDate endDate;

    /** 触发方式 */
    @ExcelProperty(value = "触发方式")
    private String triggerType;

    /** 执行状态 */
    @ExcelProperty(value = "执行状态")
    private String status;

    /** 读取明细条数 */
    @ExcelProperty(value = "读取明细条数")
    private Integer sourceCount;

    /** 写入 daily 行数 */
    @ExcelProperty(value = "写入 daily 行数")
    private Integer dailyRows;

    /** 写入 dim 行数 */
    @ExcelProperty(value = "写入 dim 行数")
    private Integer dimRows;

    /** 写入 hot 行数 */
    @ExcelProperty(value = "写入 hot 行数")
    private Integer hotRows;

    /** 耗时（毫秒） */
    @ExcelProperty(value = "耗时（毫秒）")
    private Long costMs;

    /** 数据截止时间（本次覆盖到的最新发布时间） */
    @ExcelProperty(value = "数据截止时间（本次覆盖到的最新发布时间）")
    private LocalDateTime dataUntil;

    /** 非致命提示（如命中读取上限被截断） */
    private String notice;

    /** 结构化分析结论（JSON） */
    private String conclusionJson;

    /** 失败原因 */
    private String failReason;

    /**
     * 扩展请求参数（beginTime / endTime 等），不映射数据库字段
     */
    @TableField(exist = false)
    private Map<String, Object> params = new HashMap<>();
}
