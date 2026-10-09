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
import java.util.HashMap;
import java.util.Map;
import java.io.Serial;

/**
 * 台账导出记录对象 yq_ledger_export_log
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_ledger_export_log")
@ExcelIgnoreUnannotated
public class YqLedgerExportLog extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 导出记录ID,主键 */
    @TableId(value = "export_id")
    private Long exportId;

    /** 导出范围（台账/事件聚合） */
    @ExcelProperty(value = "导出范围（台账/事件聚合）")
    private String exportScope;

    /** 筛选条件可读摘要 */
    @ExcelProperty(value = "筛选条件可读摘要")
    private String querySummary;

    /** 筛选条件快照（JSON） */
    private String queryJson;

    /** 导出字段清单（JSON 数组） */
    private String columnsJson;

    /** 导出条数 */
    @ExcelProperty(value = "导出条数")
    private Integer rowCount;

    /** 导出字段数 */
    @ExcelProperty(value = "导出字段数")
    private Integer columnCount;

    /** 导出方式（sync同步 / async异步） */
    @ExcelProperty(value = "导出方式（sync同步 / async异步）")
    private String exportMode;

    /** 任务状态（pending/running/success/failed） */
    @ExcelProperty(value = "任务状态（pending/running/success/failed）")
    private String status;

    /** 导出文件名 */
    @ExcelProperty(value = "导出文件名")
    private String fileName;

    /** 下载地址（异步任务完成后回填） */
    private String fileUrl;

    /** 完成时间 */
    @ExcelProperty(value = "完成时间")
    private LocalDateTime finishTime;

    /** 失败原因 */
    private String failReason;

    /** 操作来源IP */
    private String operIp;

    /**
     * 扩展请求参数（beginTime / endTime 等），不映射数据库字段
     */
    @TableField(exist = false)
    private Map<String, Object> params = new HashMap<>();
}
