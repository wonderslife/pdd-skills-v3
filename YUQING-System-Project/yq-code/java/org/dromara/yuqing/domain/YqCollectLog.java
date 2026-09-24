package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import java.io.Serializable;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.io.Serial;

/**
 * 采集日志对象 yq_collect_log *
 * <p>⚠ 本表存储于 <b>Apache Doris</b>，业务侧只读（禁止 INSERT/UPDATE/DELETE），
 * 写入由采集/研判 Worker 经 Stream Load 完成，详见《技术架构说明》§4.6。</p>
 *
 *
 * @author ruoyi
 */
@Data
@TableName("yq_collect_log")
@ExcelIgnoreUnannotated
public class YqCollectLog implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键 */
    @TableId(value = "log_id")
    private Long logId;

    /** 任务ID */
    private Long taskId;

    /** 渠道ID */
    private Long channelId;

    /** 采集批次号 */
    @ExcelProperty(value = "采集批次号")
    private String batchNo;

    /** 采集来源 */
    @ExcelProperty(value = "采集来源")
    private String collectSource;

    /** 采集策略 */
    @ExcelProperty(value = "采集策略")
    private String strategy;

    /** 抓取条数 */
    private Integer fetchedCount;

    /** 入库条数 */
    private Integer insertedCount;

    /** 去重剔除条数 */
    private Integer dupCount;

    /** 降噪剔除条数 */
    private Integer rejectedCount;

    /** 失败条数 */
    private Integer failedCount;

    /** 耗时（毫秒） */
    private Integer costMs;

    /** 执行结果 */
    @ExcelProperty(value = "执行结果")
    private String resultStatus;

    /** 失败原因 */
    private String failReason;

    /** 记录时间 */
    @ExcelProperty(value = "记录时间")
    private LocalDateTime createTime;

    /** 任务名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "任务名称")
    private String taskName;

    /** 渠道名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "渠道名称")
    private String channelName;

    /**
     * 扩展请求参数（beginTime / endTime 等），不映射数据库字段
     */
    @TableField(exist = false)
    private Map<String, Object> params = new HashMap<>();
}
